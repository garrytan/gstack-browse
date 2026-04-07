/**
 * Check configuration loader.
 * Reads checks.json and prompt templates, validates schema.
 */

import fs from "fs";
import path from "path";
import type { CheckItemConfig, ChecksConfig, CheckRank, JudgmentMethod, RegionType } from "../types";

const VALID_RANKS: CheckRank[] = ["A", "B", "C"];
const VALID_METHODS: JudgmentMethod[] = ["rule", "rule+llm", "rag+llm"];
const VALID_REGIONS: RegionType[] = [
  "title_block", "revision_table", "notes_area",
  "projection_view", "section_view", "dimension_area", "parts_list", "unknown",
];

function validateCheck(check: any, index: number): string[] {
  const errors: string[] = [];
  const prefix = `checks[${index}] (${check.id || "unknown"})`;

  if (!check.id || typeof check.id !== "string") errors.push(`${prefix}: missing or invalid 'id'`);
  if (!VALID_RANKS.includes(check.rank)) errors.push(`${prefix}: invalid rank '${check.rank}'`);
  if (!check.name) errors.push(`${prefix}: missing 'name'`);
  if (typeof check.enabled !== "boolean") errors.push(`${prefix}: 'enabled' must be boolean`);
  if (!VALID_METHODS.includes(check.judgmentMethod)) errors.push(`${prefix}: invalid judgmentMethod '${check.judgmentMethod}'`);
  if (!check.promptTemplate) errors.push(`${prefix}: missing 'promptTemplate'`);

  if (check.categories !== "*" && !Array.isArray(check.categories)) {
    errors.push(`${prefix}: 'categories' must be "*" or string[]`);
  }

  if (Array.isArray(check.requiredRegions)) {
    for (const r of check.requiredRegions) {
      if (!VALID_REGIONS.includes(r)) errors.push(`${prefix}: invalid region '${r}'`);
    }
  }

  return errors;
}

export function loadChecksConfig(configPath: string): ChecksConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Checks config not found: ${configPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!raw.version || !Array.isArray(raw.checks)) {
    throw new Error("Invalid checks config: must have 'version' and 'checks' array");
  }

  const allErrors: string[] = [];
  for (let i = 0; i < raw.checks.length; i++) {
    allErrors.push(...validateCheck(raw.checks[i], i));
  }

  if (allErrors.length > 0) {
    throw new Error(`Checks config validation errors:\n${allErrors.join("\n")}`);
  }

  return raw as ChecksConfig;
}

export function loadPromptTemplate(configDir: string, templatePath: string): string {
  const fullPath = path.join(configDir, templatePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt template not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

export function resolvePrompt(template: string, variables: Record<string, string> = {}): string {
  let resolved = template;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return resolved;
}

export function filterChecksByCategory(
  checks: CheckItemConfig[],
  category: string,
): CheckItemConfig[] {
  return checks.filter((c) => {
    if (!c.enabled) return false;
    if (c.categories === "*") return true;
    return c.categories.includes(category);
  });
}

export function groupChecksByRank(checks: CheckItemConfig[]): Record<CheckRank, CheckItemConfig[]> {
  return {
    C: checks.filter((c) => c.rank === "C"),
    B: checks.filter((c) => c.rank === "B"),
    A: checks.filter((c) => c.rank === "A"),
  };
}
