/**
 * Single check execution.
 * Takes a check config, finds the right handler, and runs it.
 */

import type {
  CheckContext,
  CheckHandler,
  CheckItemConfig,
  CheckResult,
  LayoutResult,
  NormalizedPage,
  PartClassification,
  VlmRequest,
  VlmResponse,
} from "../types";
import { getCheckHandler } from "./registry";

export async function runCheck(
  check: CheckItemConfig,
  pages: NormalizedPage[],
  layouts: LayoutResult[],
  classification: PartClassification,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
  promptContent?: string,
): Promise<CheckResult> {
  const handler = getCheckHandler(check.id);

  if (!handler) {
    return {
      checkId: check.id,
      checkName: check.name,
      checkNameJa: check.nameJa,
      rank: check.rank,
      verdict: "skip",
      confidence: 0,
      evidence: [],
      reasoning: `No handler registered for check ${check.id}`,
    };
  }

  const ctx: CheckContext = {
    pages,
    layouts,
    classification,
    checkConfig: check,
    promptContent,
  };

  try {
    return await handler(ctx, vlmCall);
  } catch (err: any) {
    return {
      checkId: check.id,
      checkName: check.name,
      checkNameJa: check.nameJa,
      rank: check.rank,
      verdict: "error",
      confidence: 0,
      evidence: [],
      reasoning: `Check execution error: ${err.message}`,
      rawVlmResponse: err.stack,
    };
  }
}
