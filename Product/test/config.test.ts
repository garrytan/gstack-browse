/**
 * Unit tests for config/loader.ts.
 */

import { describe, it, expect } from "bun:test";
import path from "path";
import {
  loadChecksConfig,
  resolvePrompt,
  filterChecksByCategory,
  groupChecksByRank,
} from "../src/config/loader";
import { DEFAULT_CHECKS_CONFIG } from "../src/config/defaults";

describe("loadChecksConfig", () => {
  it("loads the default checks.json successfully", () => {
    const configPath = path.join(__dirname, "..", "config", "checks.json");
    const config = loadChecksConfig(configPath);
    expect(config.version).toBe(1);
    expect(config.checks.length).toBeGreaterThan(0);
  });

  it("throws on missing file", () => {
    expect(() => loadChecksConfig("/nonexistent/file.json")).toThrow("not found");
  });
});

describe("resolvePrompt", () => {
  it("substitutes variables", () => {
    const template = "Check the {{fieldNameJa}} ({{fieldName}}) field.";
    const result = resolvePrompt(template, {
      fieldNameJa: "図番",
      fieldName: "drawing_number",
    });
    expect(result).toBe("Check the 図番 (drawing_number) field.");
  });

  it("replaces all occurrences of same variable", () => {
    const template = "{{name}} is {{name}}";
    const result = resolvePrompt(template, { name: "test" });
    expect(result).toBe("test is test");
  });

  it("returns template unchanged with no variables", () => {
    const template = "No variables here.";
    expect(resolvePrompt(template)).toBe(template);
  });

  it("leaves unmatched placeholders", () => {
    const template = "{{known}} and {{unknown}}";
    const result = resolvePrompt(template, { known: "yes" });
    expect(result).toBe("yes and {{unknown}}");
  });
});

describe("filterChecksByCategory", () => {
  const checks = DEFAULT_CHECKS_CONFIG.checks;

  it("returns all wildcard checks for any category", () => {
    const filtered = filterChecksByCategory(checks, "SomeRandomCategory");
    const wildcardChecks = checks.filter((c) => c.enabled && c.categories === "*");
    expect(filtered.length).toBeGreaterThanOrEqual(wildcardChecks.length);
  });

  it("includes category-specific checks for matching category", () => {
    const filtered = filterChecksByCategory(checks, "Housing");
    const housingSpecific = checks.filter(
      (c) => c.enabled && Array.isArray(c.categories) && c.categories.includes("Housing"),
    );
    for (const check of housingSpecific) {
      expect(filtered.some((f) => f.id === check.id)).toBe(true);
    }
  });

  it("excludes disabled checks", () => {
    const modifiedChecks = checks.map((c) =>
      c.id === "C-001" ? { ...c, enabled: false } : c,
    );
    const filtered = filterChecksByCategory(modifiedChecks, "Housing");
    expect(filtered.some((f) => f.id === "C-001")).toBe(false);
  });
});

describe("groupChecksByRank", () => {
  const checks = DEFAULT_CHECKS_CONFIG.checks;

  it("groups checks into C, B, A", () => {
    const grouped = groupChecksByRank(checks);
    expect(grouped.C.length).toBeGreaterThan(0);
    expect(grouped.B.length).toBeGreaterThan(0);
    expect(grouped.A.length).toBeGreaterThan(0);
  });

  it("all C-rank checks have rank C", () => {
    const grouped = groupChecksByRank(checks);
    for (const check of grouped.C) {
      expect(check.rank).toBe("C");
    }
  });

  it("total matches input length", () => {
    const grouped = groupChecksByRank(checks);
    const total = grouped.C.length + grouped.B.length + grouped.A.length;
    expect(total).toBe(checks.length);
  });
});
