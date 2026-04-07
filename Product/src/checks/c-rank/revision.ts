/**
 * C-Rank: Revision symbol consistency check (C-009).
 * Verifies latest revision in revision table matches title block version.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { REVISION_CONSISTENCY_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";

interface RevisionResponse {
  titleBlockRevision: string;
  revisionTableEntries: Array<{
    symbol: string;
    date?: string;
    description?: string;
  }>;
  latestRevisionMatches: boolean;
  isSequential: boolean;
  confidence: number;
  reasoning: string;
}

export const checkRevisionConsistency = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, checkConfig } = ctx;
  const page = pages[0];

  // Use full page since we need both title block and revision table
  const response = await vlmCall({
    provider: "claude",
    images: [page.imageBuffer],
    userPrompt: REVISION_CONSISTENCY_PROMPT,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<RevisionResponse>(response.text, "revision-consistency");

  // Rule-based verification
  const entries = data.revisionTableEntries || [];
  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const titleRev = (data.titleBlockRevision || "").trim().toUpperCase();
  const latestSymbol = (latestEntry?.symbol || "").trim().toUpperCase();

  const revisionsMatch = titleRev === latestSymbol || data.latestRevisionMatches;

  const evidence: CheckEvidence[] = [];

  if (titleRev) {
    evidence.push({
      type: "text",
      extractedValue: titleRev,
      description: `Title block revision: "${data.titleBlockRevision}"`,
      severity: "minor",
    });
  }

  if (latestEntry) {
    evidence.push({
      type: "text",
      extractedValue: latestSymbol,
      description: `Latest revision table entry: "${latestEntry.symbol}"${latestEntry.description ? ` — ${latestEntry.description}` : ""}`,
      severity: "minor",
    });
  }

  if (!revisionsMatch) {
    evidence.push({
      type: "text",
      description: `Mismatch: title block says "${data.titleBlockRevision}" but revision table latest is "${latestEntry?.symbol || "none"}"`,
      severity: "critical",
    });
  }

  if (!data.isSequential && entries.length > 1) {
    evidence.push({
      type: "text",
      description: "Revision symbols are not sequential",
      severity: "major",
    });
  }

  const hasIssues = !revisionsMatch || !data.isSequential;
  const verdict = entries.length === 0 && !titleRev ? "skip" : hasIssues ? "fail" : "pass";

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict,
    confidence: data.confidence ?? 0.7,
    evidence,
    reasoning: data.reasoning || "",
    rawVlmResponse: response.text,
  };
};
