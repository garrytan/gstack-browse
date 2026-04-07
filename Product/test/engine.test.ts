/**
 * Unit tests for checks/engine.ts — buildReport and summary computation.
 * No API calls needed.
 */

import { describe, it, expect } from "bun:test";
import { buildReport } from "../src/checks/engine";
import type { CheckResult, PartClassification, LayoutResult } from "../src/types";

const mockClassification: PartClassification = {
  businessUnit: "Test",
  category: "Housing",
  confidence: 0.9,
};

const mockLayouts: LayoutResult[] = [
  { pageIndex: 0, regions: [] },
];

function makeResult(id: string, rank: "A" | "B" | "C", verdict: "pass" | "fail" | "skip"): CheckResult {
  return {
    checkId: id,
    checkName: `Check ${id}`,
    rank,
    verdict,
    confidence: 0.8,
    evidence: [],
    reasoning: "test",
  };
}

describe("buildReport", () => {
  it("computes correct summary for all passes", () => {
    const results: CheckResult[] = [
      makeResult("C-001", "C", "pass"),
      makeResult("C-002", "C", "pass"),
      makeResult("B-001", "B", "pass"),
      makeResult("A-001", "A", "pass"),
    ];

    const report = buildReport("test.png", "test.png", mockClassification, mockLayouts, results);

    expect(report.summary.totalChecks).toBe(4);
    expect(report.summary.passed).toBe(4);
    expect(report.summary.failed).toBe(0);
    expect(report.summary.cRankScore).toBe(1);
    expect(report.summary.bRankScore).toBe(1);
    expect(report.summary.aRankScore).toBe(1);
  });

  it("computes correct summary with mixed results", () => {
    const results: CheckResult[] = [
      makeResult("C-001", "C", "pass"),
      makeResult("C-002", "C", "fail"),
      makeResult("C-003", "C", "pass"),
      makeResult("C-004", "C", "pass"),
      makeResult("B-001", "B", "fail"),
      makeResult("B-002", "B", "pass"),
      makeResult("A-001", "A", "skip"),
    ];

    const report = buildReport("test.png", "test.png", mockClassification, mockLayouts, results);

    expect(report.summary.totalChecks).toBe(7);
    expect(report.summary.passed).toBe(4);
    expect(report.summary.failed).toBe(2);
    expect(report.summary.skipped).toBe(1);
    // C: 3/4 = 0.75
    expect(report.summary.cRankScore).toBeCloseTo(0.75, 2);
    // B: 1/2 = 0.5
    expect(report.summary.bRankScore).toBeCloseTo(0.5, 2);
    // A: no non-skip results → 1 (default)
    expect(report.summary.aRankScore).toBe(1);
  });

  it("generates valid report structure", () => {
    const results: CheckResult[] = [makeResult("C-001", "C", "pass")];
    const report = buildReport("test.png", "test.png", mockClassification, mockLayouts, results);

    expect(report.id).toMatch(/^insp-/);
    expect(report.inputFile).toBe("test.png");
    expect(report.fileName).toBe("test.png");
    expect(report.timestamp).toBeTruthy();
    expect(report.classification).toEqual(mockClassification);
    expect(report.layout).toEqual(mockLayouts);
    expect(report.results.length).toBe(1);
  });

  it("handles empty results", () => {
    const report = buildReport("test.png", "test.png", mockClassification, mockLayouts, []);
    expect(report.summary.totalChecks).toBe(0);
    expect(report.summary.passed).toBe(0);
    expect(report.summary.cRankScore).toBe(1); // No checks → default score
  });
});
