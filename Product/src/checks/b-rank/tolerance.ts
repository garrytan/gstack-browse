/**
 * B-Rank: Tolerance notation consistency check (B-005).
 * Verifies general tolerance specification and slash mark consistency.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { TOLERANCE_NOTATION_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";

interface ToleranceResponse {
  generalToleranceFound: boolean;
  generalToleranceValue: string;
  toleranceTablePresent: boolean;
  slashMarksConsistent: boolean;
  issues: string[];
  confidence: number;
  reasoning: string;
}

export const checkToleranceNotation = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, checkConfig } = ctx;
  const page = pages[0];

  const response = await vlmCall({
    provider: "claude",
    images: [page.imageBuffer],
    userPrompt: TOLERANCE_NOTATION_PROMPT,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<ToleranceResponse>(response.text, "tolerance");

  const evidence: CheckEvidence[] = [];
  let hasIssues = false;

  if (!data.generalToleranceFound) {
    hasIssues = true;
    evidence.push({
      type: "text",
      description: "General tolerance specification not found",
      severity: "major",
    });
  } else {
    evidence.push({
      type: "text",
      extractedValue: data.generalToleranceValue,
      description: `General tolerance: ${data.generalToleranceValue}`,
      severity: "minor",
    });
  }

  if (!data.slashMarksConsistent) {
    hasIssues = true;
    evidence.push({
      type: "text",
      description: "Slash marks in tolerance table are inconsistent",
      severity: "major",
    });
  }

  if (data.issues?.length > 0) {
    hasIssues = true;
    for (const issue of data.issues) {
      evidence.push({
        type: "text",
        description: issue,
        severity: "major",
      });
    }
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict: hasIssues ? "fail" : "pass",
    confidence: data.confidence ?? 0.7,
    evidence,
    reasoning: data.reasoning || "",
    rawVlmResponse: response.text,
  };
};
