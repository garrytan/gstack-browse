/**
 * Unified VLM client for Claude Vision and GPT-4o.
 *
 * OpenAI: raw fetch with image_url content parts (same pattern as design/src/diff.ts).
 * Claude: @anthropic-ai/sdk with image content blocks.
 * Both support JSON extraction and retry on rate limits.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { VlmProvider, VlmRequest, VlmResponse } from "../types";
import { extractJson } from "./structured";

export interface VlmClientConfig {
  openaiKey?: string;
  anthropicKey?: string;
  defaultProvider: VlmProvider;
}

export class VlmClient {
  private config: VlmClientConfig;
  private anthropicClient: Anthropic | null = null;

  constructor(config: VlmClientConfig) {
    this.config = config;
    if (config.anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: config.anthropicKey });
    }
  }

  async call(request: VlmRequest): Promise<VlmResponse> {
    const provider = request.provider || this.config.defaultProvider;
    if (provider === "openai") {
      return this.callOpenAi(request);
    }
    return this.callClaude(request);
  }

  async callWithRetry(request: VlmRequest, maxRetries = 2): Promise<VlmResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.call(request);
      } catch (err: any) {
        lastError = err;
        if (err.status === 429 || err.message?.includes("429")) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  private async callOpenAi(request: VlmRequest): Promise<VlmResponse> {
    const apiKey = this.config.openaiKey;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const imageContent = request.images.map((buf) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${buf.toString("base64")}` },
    }));

    const userContent = [
      { type: "text" as const, text: request.userPrompt },
      ...imageContent,
    ];

    const messages: any[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: userContent });

    const body: Record<string, unknown> = {
      model: "gpt-4o",
      messages,
      max_tokens: request.maxTokens || 2048,
    };

    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`OpenAI API error (${response.status}): ${errorText.slice(0, 300)}`);
        (err as any).status = response.status;
        throw err;
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || "";
      const usage = data.usage || {};

      return {
        text,
        parsedJson: request.responseFormat === "json" ? extractJson(text) ?? undefined : undefined,
        model: data.model || "gpt-4o",
        tokensUsed: {
          input: usage.prompt_tokens || 0,
          output: usage.completion_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callClaude(request: VlmRequest): Promise<VlmResponse> {
    const client = this.anthropicClient;
    if (!client) throw new Error("Anthropic API key not configured");

    const imageContent: Anthropic.ImageBlockParam[] = request.images.map((buf) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: buf.toString("base64"),
      },
    }));

    const userContent: Anthropic.ContentBlockParam[] = [
      ...imageContent,
      { type: "text", text: request.userPrompt },
    ];

    const params: Anthropic.MessageCreateParams = {
      model: "claude-sonnet-4-6",
      max_tokens: request.maxTokens || 2048,
      messages: [{ role: "user", content: userContent }],
    };

    if (request.systemPrompt) {
      params.system = request.systemPrompt;
    }

    const response = await client.messages.create(params);
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      parsedJson: request.responseFormat === "json" ? extractJson(text) ?? undefined : undefined,
      model: response.model,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }
}
