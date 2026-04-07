/**
 * C-Rank: Required notation presence checks (C-006, C-007, C-010).
 * Checks whether specific required notations exist in the drawing.
 */

import type { CheckContext, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { requiredNotationPrompt } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

// Synonym dictionaries for common notations
const SYNONYMS: Record<string, string[]> = {
  recycled_material_prohibition: [
    "再生材の使用不可",
    "再生材使用禁止",
    "バージン材のこと",
    "再生材不可",
    "リサイクル材使用不可",
    "No recycled material",
    "Virgin material only",
  ],
  environmental_regulation: [
    "環境管理物質管理規定",
    "環境規定準拠",
    "RoHS",
    "REACH",
    "環境物質管理",
    "有害物質管理規定",
    "グリーン調達",
    "Environmental compliance",
  ],
  gate_specification: [
    "ゲート方式",
    "ゲート位置",
    "取り数",
    "キャビティ",
    "ランナー",
    "ゲート跡",
    "GATE",
    "gate position",
    "cavity",
  ],
};

interface NotationCheckResponse {
  found: boolean;
  matchedText: string | null;
  isExactMatch: boolean;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
  reasoning: string;
}

export const checkRequiredNotation = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const notationType = checkConfig.promptVariables?.notationType || "unknown";
  const notationJa = checkConfig.promptVariables?.notationJa || notationType;
  const synonyms = SYNONYMS[notationType] || [];

  const layout = layouts[0];
  const page = pages[0];

  // Try notes area first, fall back to full page
  const notesRegion = layout?.regions.find((r) => r.type === "notes_area");
  let image: Buffer;
  if (notesRegion) {
    image = await cropRegion(page, notesRegion.bbox);
  } else {
    image = page.imageBuffer;
  }

  const prompt = requiredNotationPrompt(notationType, notationJa, synonyms);

  const response = await vlmCall({
    provider: "claude",
    images: [image],
    userPrompt: prompt,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<NotationCheckResponse>(response.text, `notation:${notationType}`);

  const verdict = data.found ? "pass" : "fail";

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
        bbox: data.bbox ? { x: data.bbox.x, y: data.bbox.y, w: data.bbox.w, h: data.bbox.h } : undefined,
        extractedValue: data.matchedText ?? undefined,
        description: data.found
          ? `Notation found: "${data.matchedText}"${data.isExactMatch ? " (exact match)" : " (semantic match)"}`
          : `Required notation "${notationJa}" not found`,
        severity: data.found ? "minor" : "major",
      },
    ],
    reasoning: data.reasoning || "",
    rawVlmResponse: response.text,
  };
};
