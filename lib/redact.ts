// lib/redact.ts — redact-on-record pipeline for session replay
//
// Pattern-matches common secret formats and replaces with [REDACTED:<type>].
// User can extend via ~/.cavestack/redact.json (array of {name, pattern}).
//
// Critical privacy guarantee: `cavestack replay share` calls verifyRedacted()
// and REFUSES to publish if any unredacted match is found.
//
// Known insufficient for: multi-line keys split across log entries, base64-
// wrapped secrets, URL-embedded credentials beyond basic-auth, custom env
// var names. These are documented at cavestack.jerkyjesse.io/methodology.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface RedactPattern {
  name: string;
  pattern: RegExp;
}

// Built-in patterns. Source: common token formats as of April 2026.
const BUILT_IN_PATTERNS: RedactPattern[] = [
  // AWS
  { name: "AWS_ACCESS_KEY", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "AWS_SECRET_KEY", pattern: /\baws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi },
  // Anthropic
  { name: "ANTHROPIC_KEY", pattern: /\bsk-ant-[a-zA-Z0-9_-]{20,}/g },
  // OpenAI
  { name: "OPENAI_KEY", pattern: /\bsk-(proj-)?[a-zA-Z0-9_-]{32,}/g },
  // GitHub
  { name: "GITHUB_TOKEN", pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}/g },
  // GitLab
  { name: "GITLAB_TOKEN", pattern: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  // Stripe
  { name: "STRIPE_KEY", pattern: /\b(sk|pk|rk)_(test|live)_[a-zA-Z0-9]{24,}/g },
  // Slack
  { name: "SLACK_TOKEN", pattern: /\bxox[baprs]-[0-9]+-[0-9]+-[0-9]+-[a-f0-9]{32,}/g },
  // JWT (header.payload.signature)
  { name: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  // Generic "Bearer <token>"
  { name: "BEARER_TOKEN", pattern: /\bBearer\s+[A-Za-z0-9_\-\.=]{20,}/g },
  // .env fragments (KEY=value when KEY matches known secret names)
  { name: "ENV_SECRET", pattern: /\b(PASSWORD|SECRET|API_KEY|APIKEY|PRIVATE_KEY|PRIVATEKEY|TOKEN|ACCESS_KEY)=['"]?[A-Za-z0-9_\-\/+=]{8,}['"]?/gi },
  // Basic auth in URLs: https://user:pass@host
  { name: "URL_BASIC_AUTH", pattern: /https?:\/\/[^\s:]+:[^\s@]+@[^\s\/]+/g },
  // Private key headers (first line — content redaction is complex multi-line)
  { name: "PRIVATE_KEY_HEADER", pattern: /-----BEGIN\s+(RSA|EC|OPENSSH|DSA|PGP)?\s*PRIVATE KEY-----/g },
];

export function loadUserPatterns(): RedactPattern[] {
  const userRedactPath = path.join(os.homedir(), ".cavestack", "redact.json");
  if (!fs.existsSync(userRedactPath)) return [];
  try {
    const raw = fs.readFileSync(userRedactPath, "utf-8");
    const parsed = JSON.parse(raw) as Array<{ name: string; pattern: string; flags?: string }>;
    return parsed.map((p) => ({
      name: p.name,
      pattern: new RegExp(p.pattern, p.flags ?? "g"),
    }));
  } catch {
    // Malformed user file — return empty, do not crash the pipeline
    return [];
  }
}

export function getAllPatterns(): RedactPattern[] {
  return [...BUILT_IN_PATTERNS, ...loadUserPatterns()];
}

export interface RedactResult {
  text: string;
  matches: Array<{ name: string; count: number }>;
}

export function redact(text: string, patterns: RedactPattern[] = getAllPatterns()): RedactResult {
  let out = text;
  const matches: Array<{ name: string; count: number }> = [];
  for (const p of patterns) {
    let count = 0;
    out = out.replace(p.pattern, () => {
      count += 1;
      return `[REDACTED:${p.name}]`;
    });
    if (count > 0) matches.push({ name: p.name, count });
  }
  return { text: out, matches };
}

// Verify a string has NO remaining secret patterns. Used by share command.
// Returns array of {name, sample} where sample is first 20 chars of the match.
// Empty array = safe to share.
export function verifyRedacted(text: string, patterns: RedactPattern[] = getAllPatterns()): Array<{ name: string; sample: string }> {
  const findings: Array<{ name: string; sample: string }> = [];
  for (const p of patterns) {
    const matches = text.match(p.pattern);
    if (matches && matches.length > 0) {
      findings.push({
        name: p.name,
        sample: matches[0].slice(0, 20) + (matches[0].length > 20 ? "…" : ""),
      });
    }
  }
  return findings;
}
