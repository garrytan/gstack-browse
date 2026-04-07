/**
 * B-Rank: Outermost dimension presence check (B-002).
 * Verifies that overall width and height dimensions exist for each view.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { OUTERMOST_DIMENSION_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

interface OutermostResponse {
  hasOverallWidth: boolean;
  hasOverallHeight: boolean;
  overallWidthValue?: string;
  overallHeightValue?: string;
  missingDirections: string[];
  confidence: number;
  reasoning: string;
}

export const checkOutermostDimensions = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const layout = layouts[0];
  const page = pages[0];

  const viewRegions = layout?.regions.filter(
    (r) => r.type === "projection_view",
  ) || [];

  const allEvidence: CheckEvidence[] = [];
  let allPresent = true;
  let totalConfidence = 0;
  let viewCount = 0;

  const viewsToCheck = viewRegions.length > 0 ? viewRegions : [null];
  for (const viewRegion of viewsToCheck) {
    const image = viewRegion ? await cropRegion(page, viewRegion.bbox) : page.imageBuffer;

    const response = await vlmCall({
      provider: "claude",
      images: [image],
      userPrompt: OUTERMOST_DIMENSION_PROMPT,
      responseFormat: "json",
      maxTokens: 1024,
    });

    const data = requireJson<OutermostResponse>(response.text, "outermost-dims");
    viewCount++;
    totalConfidence += data.confidence ?? 0.7;

    const viewLabel = viewRegion?.label || `View ${viewCount}`;

    if (!data.hasOverallWidth) {
      allPresent = false;
      allEvidence.push({
        type: "text",
        description: `${viewLabel}: Missing overall width dimension`,
        severity: "major",
      });
    }

    if (!data.hasOverallHeight) {
      allPresent = false;
      allEvidence.push({
        type: "text",
        description: `${viewLabel}: Missing overall height dimension`,
        severity: "major",
      });
    }

    if (data.hasOverallWidth && data.hasOverallHeight) {
      allEvidence.push({
        type: "text",
        extractedValue: `W:${data.overallWidthValue || "?"} x H:${data.overallHeightValue || "?"}`,
        description: `${viewLabel}: Overall dimensions present (${data.overallWidthValue} x ${data.overallHeightValue})`,
        severity: "minor",
      });
    }
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict: allPresent ? "pass" : "fail",
    confidence: viewCount > 0 ? totalConfidence / viewCount : 0.5,
    evidence: allEvidence,
    reasoning: allPresent
      ? `All ${viewCount} view(s) have outermost dimensions`
      : `Missing outermost dimensions in some views`,
  };
};
