/**
 * Check orchestrator.
 * Filters checks by category, orders C→B→A, dispatches to handlers, aggregates results.
 */

import type {
  CheckItemConfig,
  CheckResult,
  InspectionReport,
  LayoutResult,
  NormalizedPage,
  PartClassification,
  ReportSummary,
  VlmRequest,
  VlmResponse,
} from "../types";
import { filterChecksByCategory, groupChecksByRank } from "../config/loader";
import { runCheck } from "./runner";

function computeSummary(results: CheckResult[]): ReportSummary {
  const total = results.length;
  const passed = results.filter((r) => r.verdict === "pass").length;
  const failed = results.filter((r) => r.verdict === "fail").length;
  const warnings = results.filter((r) => r.verdict === "warn").length;
  const skipped = results.filter((r) => r.verdict === "skip").length;
  const errors = results.filter((r) => r.verdict === "error").length;

  function scoreForRank(rank: string): number {
    const rankResults = results.filter((r) => r.rank === rank && r.verdict !== "skip" && r.verdict !== "error");
    if (rankResults.length === 0) return 1;
    const rankPassed = rankResults.filter((r) => r.verdict === "pass").length;
    return rankPassed / rankResults.length;
  }

  return {
    totalChecks: total,
    passed,
    failed,
    warnings,
    skipped,
    errors,
    cRankScore: scoreForRank("C"),
    bRankScore: scoreForRank("B"),
    aRankScore: scoreForRank("A"),
  };
}

export async function runInspection(
  pages: NormalizedPage[],
  layouts: LayoutResult[],
  classification: PartClassification,
  allChecks: CheckItemConfig[],
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
  options?: {
    onCheckStart?: (check: CheckItemConfig) => void;
    onCheckComplete?: (result: CheckResult) => void;
    concurrency?: number;
  },
): Promise<CheckResult[]> {
  const applicableChecks = filterChecksByCategory(allChecks, classification.category);
  const grouped = groupChecksByRank(applicableChecks);
  const concurrency = options?.concurrency ?? 3;

  const allResults: CheckResult[] = [];

  // Run checks in rank order: C first, then B, then A
  for (const rank of ["C", "B", "A"] as const) {
    const rankChecks = grouped[rank];
    if (rankChecks.length === 0) continue;

    // Run checks within a rank with limited concurrency
    const results = await runWithConcurrency(
      rankChecks,
      async (check) => {
        options?.onCheckStart?.(check);
        const result = await runCheck(check, pages, layouts, classification, vlmCall);
        options?.onCheckComplete?.(result);
        return result;
      },
      concurrency,
    );

    allResults.push(...results);
  }

  return allResults;
}

export function buildReport(
  inputFile: string,
  fileName: string,
  classification: PartClassification,
  layouts: LayoutResult[],
  results: CheckResult[],
): InspectionReport {
  return {
    id: `insp-${Date.now()}`,
    inputFile,
    fileName,
    timestamp: new Date().toISOString(),
    classification,
    layout: layouts,
    results,
    summary: computeSummary(results),
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  const pending: Promise<void>[] = [];

  for (const item of items) {
    const p = fn(item).then((r) => {
      results.push(r);
    });
    pending.push(p);

    if (pending.length >= concurrency) {
      await Promise.race(pending);
      // Remove resolved promises
      for (let i = pending.length - 1; i >= 0; i--) {
        const settled = await Promise.race([
          pending[i].then(() => true),
          Promise.resolve(false),
        ]);
        if (settled) pending.splice(i, 1);
      }
    }
  }

  await Promise.all(pending);
  return results;
}
