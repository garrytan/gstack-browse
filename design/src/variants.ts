/**
 * Generate N design variants from a brief.
 * Uses staggered parallel: 1s delay between API calls to avoid rate limits.
 * Falls back to exponential backoff on 429s.
 */

import fs from "fs";
import path from "path";
import { requireApiKey } from "./auth";
import { parseBrief } from "./brief";

export interface VariantsOptions {
  brief?: string;
  briefFile?: string;
  count: number;
  outputDir: string;
  size?: string;
  quality?: string;
}

const STYLE_VARIATIONS = [
  "", // First variant uses the brief as-is
  "Use a bolder, more dramatic visual style with stronger contrast and larger typography.",
  "Use a calmer, more minimal style with generous whitespace and subtle colors.",
  "Use a warmer, more approachable style with rounded corners and friendly typography.",
  "Use a more professional, corporate style with sharp edges and structured grid layout.",
  "Use a dark theme with light text and accent colors for key interactive elements.",
  "Use a playful, modern style with asymmetric layout and unexpected color accents.",
];

/**
 * Generate a single variant with retry on 429.
 */
async function generateVariant(
  apiKey: string,
  prompt: string,
  outputPath: string,
  size: string,
  quality: string,
): Promise<{ path: string; success: boolean; error?: string }> {
  const maxRetries = 3;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.error(`  Rate limited, retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: prompt,
          tools: [{ type: "image_generation", size, quality }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        lastError = "Rate limited (429)";
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        return { path: outputPath, success: false, error: `API error (${response.status}): ${error.slice(0, 200)}` };
      }

      const data = await response.json() as any;
      const imageItem = data.output?.find((item: any) => item.type === "image_generation_call");

      if (!imageItem?.result) {
        return { path: outputPath, success: false, error: "No image data in response" };
      }

      fs.writeFileSync(outputPath, Buffer.from(imageItem.result, "base64"));
      return { path: outputPath, success: true };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return { path: outputPath, success: false, error: "Timeout (120s)" };
      }
      lastError = err.message;
    }
  }

  return { path: outputPath, success: false, error: lastError };
}

/**
 * Generate N variants with staggered parallel execution.
 */
export async function variants(options: VariantsOptions): Promise<void> {
  const apiKey = requireApiKey();
  const baseBrief = options.briefFile
    ? parseBrief(options.briefFile, true)
    : parseBrief(options.brief!, false);

  const count = Math.min(options.count, 7); // Cap at 7 style variations
  const size = options.size || "1536x1024";
  const quality = options.quality || "high";

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.error(`Generating ${count} variants...`);
  const startTime = Date.now();

  // Staggered parallel: start each call 1.5s apart
  const promises: Promise<{ path: string; success: boolean; error?: string }>[] = [];

  for (let i = 0; i < count; i++) {
    const variation = STYLE_VARIATIONS[i] || "";
    const prompt = variation
      ? `${baseBrief}\n\nStyle direction: ${variation}`
      : baseBrief;

    const outputPath = path.join(options.outputDir, `variant-${String.fromCharCode(65 + i)}.png`);

    // Stagger: wait 1.5s between launches
    const delay = i * 1500;
    promises.push(
      new Promise(resolve => setTimeout(resolve, delay))
        .then(() => {
          console.error(`  Starting variant ${String.fromCharCode(65 + i)}...`);
          return generateVariant(apiKey, prompt, outputPath, size, quality);
        })
    );
  }

  const results = await Promise.allSettled(promises);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      const size = fs.statSync(result.value.path).size;
      console.error(`  ✓ ${path.basename(result.value.path)} (${(size / 1024).toFixed(0)}KB)`);
      succeeded.push(result.value.path);
    } else {
      const error = result.status === "fulfilled" ? result.value.error : (result.reason as Error).message;
      const filePath = result.status === "fulfilled" ? result.value.path : "unknown";
      console.error(`  ✗ ${path.basename(filePath)}: ${error}`);
      failed.push(path.basename(filePath));
    }
  }

  console.error(`\n${succeeded.length}/${count} variants generated (${elapsed}s)`);

  // Output structured result to stdout
  console.log(JSON.stringify({
    outputDir: options.outputDir,
    count,
    succeeded: succeeded.length,
    failed: failed.length,
    paths: succeeded,
    errors: failed,
  }, null, 2));
}
