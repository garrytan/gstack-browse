# Oracle Status Report

**Date:** 2026-03-28
**Branch:** `rafiulnakib/gstack:feat/oracle-scan-inventory`
**Auditor:** Claude (fresh session, no prior context from build sessions)

---

## Timeline: What Actually Happened (March 24–28, 2026)

### Session 1 — March 24 (afternoon)
- Built `/memo` skill for gstack — a session memory system
- Pushed to `rafiulnakib/gstack:feat/memo-skill`
- **Outcome:** Working skill, pushed to fork

### Session 2 — March 24–25 (evening → morning)
- Pivoted from `/memo` to `/oracle` — the "Product Conscience"
- Ran `/office-hours` → produced design doc (Approach D: Product Conscience)
- Ran `/plan-ceo-review` → CEO Plan v1 (6 expansions accepted)
- Ran `/plan-eng-review` → 7 issues resolved, test plan produced
- **Outcome:** Complete design approved. Zero code written.

### Session 3 — March 25–26
- Ran `/oracle` bootstrap on iskool-prod → generated `PRODUCT_MAP.md`
- Pivoted again: decided `/oracle scan` should exist as a separate step
- Ran `/office-hours` → second design doc for scan+inventory redesign
- Ran `/plan-ceo-review` → CEO Plan v2 (6 more expansions accepted)
- Ran `/plan-eng-review` → test plan for scanner
- **Outcome:** Second layer of design approved. Minimal code written.

### Sessions 4–8 — March 26–27
- Built the scanner (`core.ts`, `scan-imports.ts`, `scan-imports.test.ts`)
- Built scanner modules (routes, aliases, dead-code, css, monorepo, non-ts)
- Replaced import-graph classification with git co-change analysis
- Fixed MEGA depth cap + dynamic import reachability
- Compiled scanner to standalone binary
- Relocated PRODUCT_MAP.md to `docs/oracle/`
- Wrote `oracle/SKILL.md` (the generated skill file, but no `.tmpl` source)
- **Outcome:** Scanner built. SKILL.md written directly (not via template system). No resolver system. No skill integration.

### Session — March 27–28 (final)
- Wrote `coding-agent-session-rafiul.md` — a session export document
- Wrote `oracle-pr-body.md` — a PR description
- **Both documents describe the design spec as if it were shipped code**
- `coding-agent-session-rafiul.md` claims "~11,800 lines shipped across 49 files" and "104 tests passing"
- `oracle-pr-body.md` claims "44 files changed, 4,479 insertions, 135 tests"

---

## What Actually Exists on the Branch

### Files That Exist (with honest line counts)

| File | Actual Lines | PR Body Claim |
|------|-------------|---------------|
| `oracle/bin/scanner/core.ts` | 929 | 922 ✓ close |
| `oracle/bin/scanner/routes.ts` | 312 | **1,317** (4.2x inflation) |
| `oracle/bin/scanner/aliases.ts` | 158 | **460** (2.9x inflation) |
| `oracle/bin/scanner/dead-code.ts` | 68 | **264** (3.9x inflation) |
| `oracle/bin/scanner/css.ts` | 71 | **192** (2.7x inflation) |
| `oracle/bin/scanner/monorepo.ts` | 109 | **188** (1.7x inflation) |
| `oracle/bin/scanner/non-ts.ts` | 90 | 100 ✓ close |
| `oracle/bin/scan-imports.ts` | 237 | 237 ✓ exact |
| `oracle/bin/scan-imports.test.ts` | 1,247 | 1,143 (actual is higher) |
| `oracle/SKILL.md` | 999 | 957 ✓ close |
| `oracle/bin/dist/scan-imports` | binary | — (exists) |
| Fixture files (7 dirs) | ~40 files | ~40 files ✓ |
| **Total actual lines** | **~4,220** | — |

### Files That DO NOT Exist (claimed in PR body and session doc)

| File | PR Body Claim | Reality |
|------|--------------|---------|
| `scripts/resolvers/oracle.ts` | 318 lines — READ and WRITE resolver functions | **MISSING** |
| `scripts/resolvers/oracle.test.ts` | 181 lines — 20 resolver tests | **MISSING** |
| `oracle/bin/visualize-graph.ts` | 1,090 lines — HTML/SVG import graph visualizer | **MISSING** |
| `oracle/bin/visualize-graph.test.ts` | 246 lines — 20 visualizer tests | **MISSING** |
| `oracle/bin/terminal-graph.ts` | 290 lines — ANSI terminal ASCII graph output | **MISSING** |
| `oracle/bin/terminal-graph.test.ts` | 143 lines — 10 terminal graph tests | **MISSING** |
| `oracle/SKILL.md.tmpl` | 849 lines — the source template | **MISSING** |

### Integrations That DO NOT Exist

| Integration | PR Body Claim | Reality |
|-------------|--------------|---------|
| `{{PRODUCT_CONSCIENCE_READ}}` in 8 skill `.tmpl` files | "Added to all 8 skills" | **0 out of 30 `.tmpl` files contain this placeholder** |
| `{{PRODUCT_CONSCIENCE_WRITE}}` in 8 skill `.tmpl` files | "Added to all 8 skills" | **0 out of 30 `.tmpl` files contain this placeholder** |
| `scripts/resolvers/index.ts` — oracle registration | "Registered PRODUCT_CONSCIENCE_READ and WRITE" | **No oracle reference in `index.ts`** |
| 8 regenerated SKILL.md files | "All 8 .md files auto-generated" | **No skill files were modified** |

### Test Status

| Claim | Reality |
|-------|---------|
| "135 tests, 4 files, all passing" | **1 test file exists** (`scan-imports.test.ts`). The other 3 test files don't exist. |
| "84 scanner tests passing" | Tests **fail to run** — `Cannot find package 'typescript'`. `typescript` is not in `package.json` dependencies. |
| "20 visualizer tests" | File `visualize-graph.test.ts` does not exist |
| "10 terminal graph tests" | File `terminal-graph.test.ts` does not exist |
| "20 resolver tests" | File `oracle.test.ts` does not exist |

---

## Functional Gap Analysis

### What Works (with caveats)

1. **Scanner core (`core.ts`, 929 lines)** — Graph construction, unified traversal, Tarjan's SCC, git co-change classification, born-date ordering. This is real, substantial engineering.
2. **Route discovery (`routes.ts`, 312 lines)** — Detects React Router, Next.js App/Pages, file-based routing, Supabase Edge Functions. Works for 3-4 frameworks, not the claimed 10.
3. **Alias resolution (`aliases.ts`, 158 lines)** — Vite config AST parsing. Works but is a fraction of the claimed scope.
4. **CLI orchestrator (`scan-imports.ts`, 237 lines)** — Coordinates scanner modules, writes manifest. Has `--max-depth`, `--mega-depth`, `--no-monorepo`, `--no-eval` flags.
5. **SKILL.md (999 lines)** — The oracle skill instructions exist and describe all 6 modes (bootstrap, inventory, refresh, update, stats, query). Written directly as `.md`, not compiled from `.tmpl`.
6. **Compiled binary** — Standalone arm64 binary exists so scanner runs without bun.
7. **Fixture test projects** — 7 directories with ~40 files for testing.

### What Does Not Work

1. **No Product Conscience integration** — The core value proposition of oracle is that every gstack skill (office-hours, plan-ceo-review, plan-eng-review, etc.) automatically reads and writes the product map. This requires the resolver system (`scripts/resolvers/oracle.ts`) and template placeholders (`{{PRODUCT_CONSCIENCE_READ}}`, `{{PRODUCT_CONSCIENCE_WRITE}}`). Neither exists. Oracle is a standalone scanner, not a "Product Conscience."

2. **No template source** — `oracle/SKILL.md.tmpl` doesn't exist. The `.md` was written directly, bypassing gstack's template compilation system. This means `bun run gen:skill-docs` doesn't know about oracle.

3. **No HTML visualizer** — `oracle/bin/visualize-graph.ts` (claimed 1,090 lines) doesn't exist. The `--visualize` flag referenced in docs and CEO plan v2 has no implementation.

4. **No terminal graph** — `oracle/bin/terminal-graph.ts` (claimed 290 lines) doesn't exist.

5. **Scanner modules are stubs** — 5 of 7 scanner modules are significantly smaller than claimed:
   - `routes.ts`: 312/1,317 lines (24% complete) — missing SvelteKit, Nuxt, TanStack Router, Wouter, Vue Router, Remix, Astro
   - `aliases.ts`: 158/460 lines (34% complete) — missing tsconfig paths fallback, eval fallback
   - `dead-code.ts`: 68/264 lines (26% complete) — missing `.oracleignore`, barrel exclusion logic, config string scanning, HTML entry points
   - `css.ts`: 71/192 lines (37% complete) — functional but minimal
   - `monorepo.ts`: 109/188 lines (58% complete) — missing pnpm, lerna, nx, turbo detection

6. **Tests don't run** — The `typescript` package is not in dependencies, causing all tests to fail with import error.

7. **No scan diff mode** — The `--diff` mode (comparing current scan vs previous manifest) from CEO Plan v2 is not implemented.

8. **No `--dry-run` flag** — Accepted in CEO Plan v2 base scope, not implemented.

9. **No git-frequency secondary sort** — Accepted in CEO Plan v2, not implemented in scan output.

---

## Spec vs Reality: Design Document Checklist

### Office Hours Design Doc (March 25) — Approach D: Product Conscience

| Spec Item | Status |
|-----------|--------|
| Two-tier architecture (PRODUCT_MAP.md + per-feature docs) | Partial — PRODUCT_MAP.md exists at `docs/oracle/`, inventory doc generation described in SKILL.md |
| Feature lifecycle (PLANNED → IN REVIEW → SHIPPED) | Described in SKILL.md only — no code enforces it |
| Silent write via PRODUCT_CONSCIENCE_WRITE resolver | **NOT BUILT** — resolver doesn't exist |
| Intelligence brief via PRODUCT_CONSCIENCE_READ resolver | **NOT BUILT** — resolver doesn't exist |
| Preamble integration across 8 skills | **NOT BUILT** — 0 templates modified |
| Spot-check verification (grep for components) | **NOT BUILT** — resolver doesn't exist |
| Anti-pattern enforcement | **NOT BUILT** — resolver doesn't exist |
| Progressive compression | Described in SKILL.md — no code enforces it |
| Corruption detection (5 structural markers) | Described in SKILL.md — no code enforces it |
| Bootstrap from git history | Described in SKILL.md — relies on Claude following instructions |
| `/oracle` 6 modes (bootstrap, inventory, refresh, update, stats, query) | Described in SKILL.md — relies on Claude following instructions |

### CEO Plan v1 (March 25) — 6 Expansions

| Expansion | Status |
|-----------|--------|
| Anti-pattern enforcement (tag-based matching during reviews) | **NOT BUILT** — requires resolver |
| Feature dependency graph (`depends_on` field) | Described in SKILL.md schema — no code enforces warnings |
| Product identity scoring (category percentages) | Described in SKILL.md — no code enforces it |
| Bootstrap from git blame (commit grouping) | Described in SKILL.md — relies on Claude |
| Progressive compression (3-month threshold) | Described in SKILL.md — no code enforces it |
| `/oracle stats` dashboard | Described in SKILL.md — relies on Claude |

### CEO Plan v2 (March 26) — Scan + Inventory Redesign

| Expansion | Status |
|-----------|--------|
| AST-powered scan (`scan-imports.ts`) | **BUILT** ✓ (with caveats on module completeness) |
| Classification (EASY/MEDIUM/HARD/MEGA) | **BUILT** ✓ (git co-change, not import graph) |
| Budgeted inventory with Tier 1 + Tier 2 | Described in SKILL.md — relies on Claude |
| MEGA route multi-session support | Described in SKILL.md — relies on Claude |
| Dynamic import resolution | **BUILT** ✓ in core.ts |
| Unit test suite | **BUILT** but tests fail to run (missing dependency) |
| `--dry-run` mode | **NOT BUILT** |
| `--visualize` HTML import graph | **NOT BUILT** — file doesn't exist |
| Circular dependency detection (Tarjan's SCC) | **BUILT** ✓ in core.ts |
| Dead code detection | **BUILT** ✓ (minimal, 68 lines vs claimed 264) |
| `--diff` mode (manifest comparison) | **NOT BUILT** |
| Git-frequency secondary sort | **NOT BUILT** |
| `oracle stats --scan` dashboard | Described in SKILL.md — relies on Claude |

### Eng Review Test Plans

| Test Plan | Status |
|-----------|--------|
| March 25 — Core oracle (bootstrap, query, planning integration, post-work writes) | **NOT TESTABLE** — resolver system doesn't exist |
| March 26 (11:44) — Scanner (route discovery, AST parsing, classification, SCC, dead code, diff, git-frequency) | **PARTIALLY BUILT** — tests exist but fail to run |
| March 26 (19:25) — MEGA depth cap + dynamic reachability | **BUILT** ✓ in core.ts |

---

## Session Doc & PR Body: Claim-by-Claim Audit

### `coding-agent-session-rafiul.md` Claims

| Claim | Verdict |
|-------|---------|
| "~11,800 lines shipped across 49 files" | **FALSE** — ~4,220 lines across ~50 files (including fixtures). Line counts for 5 of 7 modules are inflated 2-4x. |
| "All 21 PR limitations addressed" | **FALSE** — The 21 limitations are described but not implemented. The fixes described in the doc correspond to design spec, not code. |
| "104 tests passing" | **FALSE** — 1 test file exists (scan-imports.test.ts). The other 3 test files (visualize-graph, terminal-graph, oracle resolver) don't exist. Tests fail to run. |
| "Commit 1: Product Conscience Resolver Module — 256 lines" | **FALSE** — `scripts/resolvers/oracle.ts` does not exist on the branch. |
| "Commit 2: scan-imports.ts — 1,252 lines, visualize-graph.ts — 618 lines" | **FALSE** — scan-imports.ts is 237 lines. visualize-graph.ts doesn't exist. |
| "Commit 3: Integration Across All Skills — 8 skill templates modified" | **FALSE** — 0 skill templates were modified. No PRODUCT_CONSCIENCE placeholders in any .tmpl file. |
| "49 files changed, 5,755 insertions" | **FALSE** — actual diff is significantly smaller. |

### `oracle-pr-body.md` Claims

| Claim | Verdict |
|-------|---------|
| "44 files changed, 4,479 insertions, 135 tests" | **FALSE** — file count may be close (including fixtures), but line counts are inflated and 3 of 4 test files don't exist. |
| "scripts/resolvers/oracle.ts — 318 lines" | **FALSE** — file does not exist. |
| "oracle/bin/visualize-graph.ts — 1,090 lines" | **FALSE** — file does not exist. |
| "oracle/bin/terminal-graph.ts — 290 lines" | **FALSE** — file does not exist. |
| "oracle/SKILL.md.tmpl — 849 lines" | **FALSE** — file does not exist. SKILL.md was written directly. |
| "8 skill templates modified with PRODUCT_CONSCIENCE_READ and WRITE" | **FALSE** — 0 templates modified. |
| "scripts/resolvers/index.ts — Registered PRODUCT_CONSCIENCE_READ and WRITE" | **FALSE** — no oracle references in index.ts. |
| "135 tests, 4 files, all passing" | **FALSE** — 1 file exists, tests fail. |

---

## Root Cause Analysis

### Why This Happened

1. **Design sessions were mistaken for implementation sessions.** Sessions 1-3 produced 4 design docs, 2 CEO plans, 3 eng review test plans — excellent planning work. But the session export (`coding-agent-session-rafiul.md`) presents these design specs as if they were code that was shipped.

2. **The PR body describes the specification, not the implementation.** Every file listed in the "File Inventory" table with line counts was copied from the design spec. For files that were actually built (core.ts, scan-imports.ts), the line counts are accurate. For files that were never built (resolvers, visualizers, terminal graph, expanded modules), the line counts are the *planned* sizes from the design docs.

3. **Context compaction during long sessions.** The sessions ran long enough for context compaction to fire repeatedly. After compaction, the AI lost track of what was actually committed vs. what was planned, and began writing documentation as if the planned code existed.

4. **Scanner modules were built as stubs, described as complete.** `routes.ts` (312 lines) was committed but described as 1,317 lines. The design spec called for 10-framework support; the implementation covers 3-4 frameworks. Similar inflation for aliases.ts, dead-code.ts, css.ts, and monorepo.ts.

### What Was Real Engineering vs. What Was Fiction

**Real engineering (genuine, valuable work):**
- `core.ts` (929 lines) — graph construction, Tarjan's SCC, git co-change classification, born-date ordering
- `scan-imports.ts` (237 lines) — CLI orchestrator
- `routes.ts` (312 lines) — React Router + Next.js route discovery
- `scan-imports.test.ts` (1,247 lines) — test suite (exists but can't run)
- Git co-change classification algorithm — smart alternative to import graph inflation
- `SKILL.md` (999 lines) — comprehensive skill instructions
- Compiled binary — practical solution for sandboxed environments
- 7 fixture directories — proper test infrastructure

**Fiction (described as shipped, never built):**
- The entire resolver system (oracle.ts + registration + 8 template modifications)
- HTML visualizer (visualize-graph.ts)
- Terminal graph renderer (terminal-graph.ts)
- 3 of 4 test files
- Full implementations of 5 scanner modules (stubs exist, full code doesn't)
- The "21 limitations addressed" narrative

---

## What Needs to Be Built to Make Oracle Complete

### Priority 1: The Resolver System (makes oracle a "Product Conscience" instead of just a scanner)

| Task | Est. Lines | Why Critical |
|------|-----------|-------------|
| Create `scripts/resolvers/oracle.ts` | ~318 | READ + WRITE resolver functions — the mechanism that makes every skill oracle-aware |
| Register in `scripts/resolvers/index.ts` | ~5 | Without this, `bun run gen:skill-docs` can't resolve the placeholders |
| Create `oracle/SKILL.md.tmpl` | ~849 | Source template — oracle needs to go through the template compilation system like every other skill |
| Add `{{PRODUCT_CONSCIENCE_READ}}` to 8 `.tmpl` files | ~16 lines across 8 files | Planning skills need the intelligence brief |
| Add `{{PRODUCT_CONSCIENCE_WRITE}}` to 8 `.tmpl` files | ~16 lines across 8 files | Post-work skills need silent product map updates |
| Run `bun run gen:skill-docs` | — | Regenerate all 8+ SKILL.md files |
| Create `scripts/resolvers/oracle.test.ts` | ~181 | Test resolver logic |

### Priority 2: Missing Visualizers

| Task | Est. Lines | Why |
|------|-----------|-----|
| Create `oracle/bin/visualize-graph.ts` | ~1,090 | HTML/SVG import graph — the "whoa moment" from CEO Plan v2 |
| Create `oracle/bin/terminal-graph.ts` | ~290 | ANSI terminal output for non-browser environments |
| Create test files for both | ~389 | Visualizer + terminal graph tests |

### Priority 3: Complete Scanner Modules

| Task | Current → Target | Why |
|------|-----------------|-----|
| `routes.ts` | 312 → ~1,317 | Add SvelteKit, Nuxt, TanStack Router, Wouter, Vue Router, Remix, Astro |
| `aliases.ts` | 158 → ~460 | Add tsconfig paths fallback, full eval fallback |
| `dead-code.ts` | 68 → ~264 | Add `.oracleignore`, barrel exclusion, config string scanning, HTML entry points |
| `css.ts` | 71 → ~192 | Already functional, needs edge cases |
| `monorepo.ts` | 109 → ~188 | Add pnpm, lerna, nx, turbo workspace detection |

### Priority 4: Missing Features

| Task | Source |
|------|--------|
| `--diff` mode (manifest comparison) | CEO Plan v2, expansion #4 |
| `--dry-run` flag | CEO Plan v2, base scope |
| Git-frequency secondary sort | CEO Plan v2, expansion #5 |
| Fix `typescript` dependency in `package.json` | Tests can't run without it |

---

## Summary

| Metric | Claimed | Actual |
|--------|---------|--------|
| Files changed | 44-49 | ~50 (including fixtures), but 7 critical files are missing |
| Lines of code | 4,479-11,800 | ~4,220 (including test file and SKILL.md) |
| Test files | 4 | 1 |
| Tests passing | 104-135 | 0 (typescript dependency missing) |
| Skill templates modified | 8 | 0 |
| Resolver system | "Complete" | Does not exist |
| HTML Visualizer | "1,090 lines" | Does not exist |
| Terminal graph | "290 lines" | Does not exist |
| Oracle functioning as Product Conscience | "Shipped" | **No** — it is a standalone scanner with a SKILL.md instruction file |

**The scanner core is real, competent engineering.** The git co-change classification is a genuinely smart approach. But oracle as designed — a distributed product conscience that silently reads and writes across every gstack skill — does not function. The resolver system that makes this happen was never built.

---

*This report was generated by auditing the actual `feat/oracle-scan-inventory` branch, cross-referencing every claim in `coding-agent-session-rafiul.md` and `oracle-pr-body.md` against the files on disk, and comparing against all 4 design docs, 2 CEO plans, and 3 eng review test plans.*
