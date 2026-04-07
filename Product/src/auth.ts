/**
 * API key resolution for OpenAI and Anthropic.
 *
 * Resolution order per provider:
 * 1. ~/.gstack/<provider>.json → { "api_key": "..." }
 * 2. Environment variable (OPENAI_API_KEY / ANTHROPIC_API_KEY)
 * 3. null
 */

import fs from "fs";
import path from "path";

const GSTACK_DIR = path.join(process.env.HOME || "~", ".gstack");

function resolveKey(configFile: string, envVar: string): string | null {
  // 1. Config file
  const configPath = path.join(GSTACK_DIR, configFile);
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.api_key && typeof config.api_key === "string") {
        return config.api_key;
      }
    }
  } catch {
    // Fall through
  }

  // 2. Environment variable
  const envValue = process.env[envVar];
  if (envValue) return envValue;

  return null;
}

export function resolveOpenAiKey(): string | null {
  return resolveKey("openai.json", "OPENAI_API_KEY");
}

export function resolveAnthropicKey(): string | null {
  return resolveKey("anthropic.json", "ANTHROPIC_API_KEY");
}

export function requireOpenAiKey(): string {
  const key = resolveOpenAiKey();
  if (!key) {
    console.error("No OpenAI API key found.");
    console.error("Save to ~/.gstack/openai.json: { \"api_key\": \"sk-...\" }");
    console.error("  or set OPENAI_API_KEY environment variable");
    process.exit(1);
  }
  return key;
}

export function requireAnthropicKey(): string {
  const key = resolveAnthropicKey();
  if (!key) {
    console.error("No Anthropic API key found.");
    console.error("Save to ~/.gstack/anthropic.json: { \"api_key\": \"sk-ant-...\" }");
    console.error("  or set ANTHROPIC_API_KEY environment variable");
    process.exit(1);
  }
  return key;
}
