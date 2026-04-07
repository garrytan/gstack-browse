/**
 * B-Rank: Dimension overlap detection (B-001).
 * Checks if dimension text/lines overlap with part outlines or other dimensions.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { DIMENSION_OVERLAP_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

interface OverlapResponse {
  overlaps: Array<{
    description: string;
    severity: string;
    bbox: { x: number; y: number; w: number; h: number };
  }>;
  hasOverlaps: boolean;
  confidence: number;
  reasoning: string;
}

export const checkDimensionOverlap = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const layout = layouts[0];
  const page = pages[0];

  // Find projection view regions
  const viewRegions = layout?.regions.filter(
    (r) => r.type === "projection_view" || r.type === "section_view",
  ) || [];

  const allEvidence: CheckEvidence[] = [];
  let hasOverlaps = false;
  let totalConfidence = 0;
  let viewCount = 0;

  // Check each projection view
  const viewsToCheck = viewRegions.length > 0 ? viewRegions : [null];
  for (const viewRegion of viewsToCheck) {
    const image = viewRegion ? await cropRegion(page, viewRegion.bbox) : page.imageBuffer;

    const response = await vlmCall({
      provider: "claude",
      images: [image],
      userPrompt: DIMENSION_OVERLAP_PROMPT,
      responseFormat: "json",
      maxTokens: 1024,
    });

    const data = requireJson<OverlapResponse>(response.text, "dimension-overlap");
    viewCount++;
    totalConfidence += data.confidence ?? 0.7;

    if (data.hasOverlaps && data.overlaps?.length > 0) {
      hasOverlaps = true;
      for (const overlap of data.overlaps) {
        allEvidence.push({
          type: "bbox",
          bbox: overlap.bbox ? { x: overlap.bbox.x, y: overlap.bbox.y, w: overlap.bbox.w, h: overlap.bbox.h } : undefined,
          description: `${viewRegion?.label || "Main view"}: ${overlap.description}`,
          severity: overlap.severity === "high" ? "critical" : overlap.severity === "medium" ? "major" : "minor",
        });
      }
    }
  }

  if (allEvidence.length === 0) {
    allEvidence.push({
      type: "text",
      description: "No dimension overlaps detected",
      severity: "minor",
    });
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict: hasOverlaps ? "fail" : "pass",
    confidence: viewCount > 0 ? totalConfidence / viewCount : 0.5,
    evidence: allEvidence,
    reasoning: hasOverlaps
      ? `Found ${allEvidence.filter(e => e.severity !== "minor").length} overlap issues across ${viewCount} view(s)`
      : `Checked ${viewCount} view(s), no overlaps found`,
  };
};
