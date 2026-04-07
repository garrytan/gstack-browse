/**
 * Part classification via VLM.
 * Crops the title block region and asks VLM to identify business unit + category.
 */

import type { LayoutResult, NormalizedPage, PartClassification, VlmRequest, VlmResponse } from "../types";
import { PART_CLASSIFICATION_PROMPT } from "../vlm/prompts";
import { requireJson } from "../vlm/structured";
import { cropRegion } from "../layout/regions";

interface ClassificationVlmResponse {
  businessUnit: string;
  category: string;
  material?: string;
  confidence: number;
  reasoning?: string;
}

export async function classifyPart(
  page: NormalizedPage,
  layout: LayoutResult,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<PartClassification> {
  // Find title block region
  const titleBlock = layout.regions.find((r) => r.type === "title_block");

  let imageToAnalyze: Buffer;
  if (titleBlock) {
    imageToAnalyze = await cropRegion(page, titleBlock.bbox);
  } else {
    // Use full page if no title block detected
    imageToAnalyze = page.imageBuffer;
  }

  const response = await vlmCall({
    provider: "claude",
    images: [imageToAnalyze],
    userPrompt: PART_CLASSIFICATION_PROMPT,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<ClassificationVlmResponse>(response.text, "part classification");

  return {
    businessUnit: data.businessUnit || "Unknown",
    category: data.category || "Unknown",
    material: data.material ?? undefined,
    confidence: Math.max(0, Math.min(1, data.confidence ?? 0.5)),
  };
}
