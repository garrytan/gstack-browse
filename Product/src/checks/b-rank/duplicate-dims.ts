/**
 * B-Rank: Duplicate/redundant dimension detection (B-003).
 * Checks for dimensions that specify the same measurement redundantly.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { DUPLICATE_DIMENSION_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

interface DuplicateResponse {
  duplicates: Array<{
    value: string;
    count: number;
    locations: Array<{ bbox: { x: number; y: number; w: number; h: number } }>;
    description: string;
  }>;
  hasDuplicates: boolean;
  confidence: number;
  reasoning: string;
}

export const checkDuplicateDimensions = async (
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
  let hasDuplicates = false;

  const viewsToCheck = viewRegions.length > 0 ? viewRegions : [null];
  for (const viewRegion of viewsToCheck) {
    const image = viewRegion ? await cropRegion(page, viewRegion.bbox) : page.imageBuffer;

    const response = await vlmCall({
      provider: "claude",
      images: [image],
      userPrompt: DUPLICATE_DIMENSION_PROMPT,
      responseFormat: "json",
      maxTokens: 1024,
    });

    const data = requireJson<DuplicateResponse>(response.text, "duplicate-dims");

    if (data.hasDuplicates && data.duplicates?.length > 0) {
      hasDuplicates = true;
      for (const dup of data.duplicates) {
        allEvidence.push({
          type: "text",
          extractedValue: dup.value,
          description: `${viewRegion?.label || "View"}: ${dup.description || `Dimension "${dup.value}" appears ${dup.count} times`}`,
          severity: "major",
        });
      }
    }
  }

  if (allEvidence.length === 0) {
    allEvidence.push({
      type: "text",
      description: "No duplicate dimensions detected",
      severity: "minor",
    });
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict: hasDuplicates ? "fail" : "pass",
    confidence: 0.75,
    evidence: allEvidence,
    reasoning: hasDuplicates
      ? `Found ${allEvidence.filter(e => e.severity !== "minor").length} duplicate dimension(s)`
      : "No duplicate dimensions found",
  };
};
