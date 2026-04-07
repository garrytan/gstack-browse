/**
 * C-Rank: Title block field presence checks (C-001 through C-005).
 * Uses shared prompt template with different field variables.
 */

import type { CheckContext, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { titleBlockFieldPrompt } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

interface FieldCheckResponse {
  fieldFound: boolean;
  fieldValue: string | null;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
  reasoning: string;
}

export const checkTitleBlockField = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const fieldName = checkConfig.promptVariables?.fieldName || "unknown";
  const fieldNameJa = checkConfig.promptVariables?.fieldNameJa || fieldName;

  // Find title block region from first page layout
  const layout = layouts[0];
  const page = pages[0];
  const titleBlock = layout?.regions.find((r) => r.type === "title_block");

  let image: Buffer;
  if (titleBlock) {
    image = await cropRegion(page, titleBlock.bbox);
  } else {
    image = page.imageBuffer;
  }

  const prompt = titleBlockFieldPrompt(fieldName, fieldNameJa);

  const response = await vlmCall({
    provider: "claude",
    images: [image],
    userPrompt: prompt,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<FieldCheckResponse>(response.text, `title-block-field:${fieldName}`);

  const verdict = data.fieldFound ? "pass" : "fail";

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict,
    confidence: data.confidence ?? 0.5,
    evidence: [
      {
        type: data.bbox ? "bbox" : "text",
        bbox: data.bbox ? {
          x: data.bbox.x,
          y: data.bbox.y,
          w: data.bbox.w,
          h: data.bbox.h,
        } : undefined,
        extractedValue: data.fieldValue ?? undefined,
        description: data.fieldFound
          ? `${fieldNameJa} found: "${data.fieldValue}"`
          : `${fieldNameJa} not found or empty`,
        severity: data.fieldFound ? "minor" : "major",
      },
    ],
    reasoning: data.reasoning || "",
    rawVlmResponse: response.text,
  };
};
