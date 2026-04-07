/**
 * VLM-based layout decomposition.
 *
 * Two-pass strategy:
 * 1. Send full-page image → get region bboxes
 * 2. If title block not found, try bottom-right fallback
 */

import type { LayoutRegion, LayoutResult, NormalizedPage, VlmRequest, VlmResponse } from "../types";
import { LAYOUT_ANALYSIS_PROMPT } from "../vlm/prompts";
import { requireJson } from "../vlm/structured";
import { clampBBox, defaultTitleBlockBBox, isValidBBox } from "./regions";

interface LayoutVlmResponse {
  regions: Array<{
    type: string;
    bbox: { x: number; y: number; w: number; h: number };
    confidence: number;
    label?: string;
  }>;
}

function parseLayoutResponse(response: VlmResponse): LayoutRegion[] {
  const data = requireJson<LayoutVlmResponse>(response.text, "layout analysis");

  if (!data.regions || !Array.isArray(data.regions)) {
    throw new Error("Layout response missing 'regions' array");
  }

  return data.regions
    .map((r) => {
      const bbox = clampBBox({
        x: r.bbox?.x ?? 0,
        y: r.bbox?.y ?? 0,
        w: r.bbox?.w ?? 0,
        h: r.bbox?.h ?? 0,
      });

      return {
        type: r.type as LayoutRegion["type"],
        bbox,
        confidence: Math.max(0, Math.min(1, r.confidence ?? 0.5)),
        label: r.label,
      };
    })
    .filter((r) => isValidBBox(r.bbox));
}

function hasTitleBlock(regions: LayoutRegion[]): boolean {
  return regions.some((r) => r.type === "title_block" && r.confidence > 0.3);
}

export async function analyzeLayout(
  page: NormalizedPage,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<LayoutResult> {
  // Pass 1: Full page layout analysis
  const response = await vlmCall({
    provider: "claude",
    images: [page.imageBuffer],
    userPrompt: LAYOUT_ANALYSIS_PROMPT,
    responseFormat: "json",
    maxTokens: 2048,
  });

  let regions = parseLayoutResponse(response);

  // Fallback: if no title block found, add default bottom-right region
  if (!hasTitleBlock(regions)) {
    regions.push({
      type: "title_block",
      bbox: defaultTitleBlockBBox(),
      confidence: 0.5,
      label: "Title Block (fallback)",
    });
  }

  return {
    pageIndex: page.pageIndex,
    regions,
    rawVlmResponse: response.text,
  };
}
