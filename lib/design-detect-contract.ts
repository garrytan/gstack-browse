// lib/design-detect-contract.ts — the one owner of the design-detector vocabulary.
//
// Pure module: no I/O, no imports from scripts/. Every sentinel the wrapper
// (bin/gstack-design-detect.ts) or the DESIGN.md tool (bin/gstack-design-md.ts)
// prints, and every one the skill prose reads, is a constant here, so the two
// sides cannot drift: gen-time resolvers import these strings into SKILL.md
// prose, the bins import them at runtime, and test/design-detect-contract.test.ts
// asserts that every sentinel-shaped token in generated docs exists here.
//
//   probe ──► one of: IMPECCABLE_READY | IMPECCABLE_NOT_CACHED | IMPECCABLE_NOT_AVAILABLE | IMPECCABLE_DISABLED
//         ──► always:  IMPECCABLE_SKILL, IMPECCABLE_HOOK, IMPECCABLE_IGNORED_RULES, IMPECCABLE_IGNORED_FILES
//         ──► maybe:   IMPECCABLE_HOOK_OTHER, IMPECCABLE_CONFIG_UNREADABLE, IMPECCABLE_ENV_IGNORED,
//                      IMPECCABLE_ENGINE_UNTESTED, DESIGN_DETECTOR_HINT
//   scan  ──► stdout:  one JSON document (--format gstack) or engine bytes (--format raw)
//         ──► stderr:  DETECT_TOP block, DETECT_SUMMARY, DETECT_EXIT, DETECT_REFUSED / DETECT_NO_TARGETS /
//                      DETECT_TIMEOUT / DETECT_PARSE_ERROR / DETECT_OUTPUT_TOO_LARGE
//   any   ──► exit 3 + DESIGN_DETECT_INTERNAL_ERROR: a gstack bug, never retried

export const SENTINEL = {
  READY: 'IMPECCABLE_READY',
  NOT_CACHED: 'IMPECCABLE_NOT_CACHED',
  NOT_AVAILABLE: 'IMPECCABLE_NOT_AVAILABLE',
  DISABLED: 'IMPECCABLE_DISABLED',
  SKILL: 'IMPECCABLE_SKILL',
  HOOK: 'IMPECCABLE_HOOK',
  HOOK_OTHER: 'IMPECCABLE_HOOK_OTHER',
  IGNORED_RULES: 'IMPECCABLE_IGNORED_RULES',
  IGNORED_FILES: 'IMPECCABLE_IGNORED_FILES',
  CONFIG_UNREADABLE: 'IMPECCABLE_CONFIG_UNREADABLE',
  ENV_IGNORED: 'IMPECCABLE_ENV_IGNORED',
  ENGINE_UNTESTED: 'IMPECCABLE_ENGINE_UNTESTED',
  HINT: 'DESIGN_DETECTOR_HINT',
  DETECT_EXIT: 'DETECT_EXIT',
  DETECT_EXIT_CODE: 'DETECT_EXIT_CODE',
  DETECT_SUMMARY: 'DETECT_SUMMARY',
  DETECT_TOP: 'DETECT_TOP',
  DETECT_REFUSED: 'DETECT_REFUSED',
  DETECT_NO_TARGETS: 'DETECT_NO_TARGETS',
  DETECT_TIMEOUT: 'DETECT_TIMEOUT',
  DETECT_PARSE_ERROR: 'DETECT_PARSE_ERROR',
  DETECT_OUTPUT_TOO_LARGE: 'DETECT_OUTPUT_TOO_LARGE',
  INTERNAL_ERROR: 'DESIGN_DETECT_INTERNAL_ERROR',
  DOM_DUMP_REDACTION_BLOCKED: 'DOM_DUMP_REDACTION_BLOCKED',
  DOM_DUMP_TOO_LARGE: 'DOM_DUMP_TOO_LARGE',
  DESIGN_MD_FORMAT: 'DESIGN_MD_FORMAT',
  DESIGN_MD_CONVERT_REFUSED: 'DESIGN_MD_CONVERT_REFUSED',
  DESIGN_MD_INTERNAL_ERROR: 'DESIGN_MD_INTERNAL_ERROR',
  DESIGN_MD_TOKEN_REF_INVALID: 'DESIGN_MD_TOKEN_REF_INVALID',
} as const;

export type SentinelName = keyof typeof SENTINEL;

/** Engine versions the committed fixtures were captured from. */
export const TESTED_ENGINE_VERSIONS: readonly string[] = ['0.1.3'];

/** Rules the engine reports but never counts (they never change its exit code). */
export const ADVISORY_RULE_IDS: readonly string[] = ['em-dash-overuse'];

export const DETECT_LIMITS = {
  /** default engine wall clock; GSTACK_DESIGN_DETECT_TIMEOUT_MS overrides */
  timeoutMs: 120_000,
  /** absolute paths per engine invocation */
  batch: 100,
  /** engine stdout above this is DETECT_OUTPUT_TOO_LARGE */
  stdoutBytes: 50 * 1024 * 1024,
  /** normalized findings kept; the rest is `truncated: true` */
  findings: 5_000,
  /** locations printed in the DETECT_TOP block */
  topLocations: 50,
  /** rendered-DOM dump above this is DOM_DUMP_TOO_LARGE */
  domDumpBytes: 10 * 1024 * 1024,
  field: { id: 64, message: 120, snippet: 120, value: 200, file: 4096, diagnostic: 400 },
} as const;

/** Markers around any engine text the skill may quote (page text can echo through it). */
export const UNTRUSTED_BEGIN = '═══ BEGIN UNTRUSTED CONTENT (design detector output) ═══';
export const UNTRUSTED_END = '═══ END UNTRUSTED CONTENT ═══';

export interface NormalizedFinding {
  /** catalog id (equals impeccableId when mapped; the engine's id, sanitized, when not) */
  id: string;
  impeccableId: string;
  file: string;
  line: number;
  snippet: string;
  value?: string;
  message: string;
  category: string;
  kind: 'slop' | 'quality' | 'unknown';
  impact: 'high' | 'medium' | 'polish';
  tier: 'auto-fix' | 'ask' | 'possible';
  handoff?: string;
  advisory: boolean;
  unmapped?: true;
}

export interface ScanResult {
  schemaVersion: 1;
  engine: string;
  engineVersion: string;
  targets: number;
  /** engine exit code after precedence (1 over 2 over 0) */
  exit: number;
  total: number;
  counted: number;
  advisory: number;
  /** rule ids the project config ignores (never present in findings) */
  ignoredRules: string[];
  byRule: Record<string, number>;
  findings: NormalizedFinding[];
  truncated: boolean;
  diagnostics: string[];
}

/** The bash a skill renders after a scan so exit 2 (findings) never aborts the block. */
export const DETECT_EXIT_ECHO = `; echo "${SENTINEL.DETECT_EXIT_CODE}=$?"`;
