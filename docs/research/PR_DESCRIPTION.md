# PR: Token Optimization Research + Structured Methodology Proposal

## Summary

This branch demonstrates what happens when you apply structured documentation engineering to an AI skill framework. 66 files changed, 13K insertions, 21K deletions. Net result: 25% fewer tokens across all skill templates, 53% fewer in the preamble that ships with every skill invocation, and a set of machine-readable methodology contracts that replace prose-based rules.

The research artifacts in `docs/research/` are the real deliverable. The optimized files prove the techniques work. The TOML structures show what "structured" looks like in practice.

## The Evolution: MD → JSON → TOML

Over the past year we've watched the same pattern repeat across projects using AI agents for planning, review, and implementation:

**Phase 1: Markdown everywhere.** Plans, contracts, review checklists, methodology rules, all in prose. Agents read them, mostly follow them, sometimes hallucinate the parts they skimmed. No way to validate compliance programmatically. No way to diff "what changed in the methodology" from "what changed in the prose." Every agent invocation re-parses the same narrative and extracts (or fails to extract) the same structured intent.

**Phase 2: JSON for structure.** We started encoding DAGs, review gates, and contracts as JSON. Better for machines, worse for humans. Agents handle JSON fine but the authoring experience is painful. Merge conflicts are brutal. Comments aren't supported. The schema lives in documentation that drifts from the actual structure.

**Phase 3: TOML with typed schemas.** Where we are now. TOML gives us the structure of JSON with the readability of markdown. Comments are first-class. The `dag-toml-templates` project provides reference templates with hard invariants documented in the file headers. A SurrealDB-backed runtime (`dagdb`) lets agents query DAG state, traverse traceability chains, and evaluate review gates programmatically instead of parsing text.

The key insight: **the format isn't the point. The schema is.** When methodology rules have `reviewer_checks` arrays, you can scan for compliance. When implementation plans have `depends_on` graphs, you can compute critical paths. When review gates have `pass_conditions` and `block_conditions`, you can evaluate readiness without an agent guessing from prose context.

## What This Branch Contains

### Token Optimization (measured, not estimated)

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| CLAUDE.md | 4,837 tok | 1,701 tok | **65%** |
| preamble.ts (×36 skills) | 8,298 tok | 3,937 tok | **53%** |
| ship/SKILL.md.tmpl | 6,689 tok | 1,983 tok | **70%** |
| All 36 templates | 131,426 tok | 98,507 tok | **25%** |
| All 5 resolvers | 39,087 tok | 29,838 tok | **24%** |

The preamble reduction is the big one. It's injected into every generated skill file. 53% fewer tokens × 36 skills = ~78K tokens saved from the generated output that agents actually consume.

Techniques applied from research (42 articles, 2025-2026): remove filler phrases, remove unnecessary articles, terse descriptions (≤12 words), pipe-separated lists, compact structures. Compression ratio target: 0.65-0.80 (the Goldilocks zone per OpenReview 2025). Markdown over JSON for documentation (16% savings, +10% comprehension per Medium 2026).

All behavioral semantics preserved. `bun run gen:skill-docs` regenerates cleanly. No functional changes.

### Structured Methodology Artifacts

| Artifact | What it does |
|----------|-------------|
| `SKILL_CONTRACTS.toml` | 10 methodology contracts (completeness, user sovereignty, voice, verification, search discipline, test ownership, bisectable commits, platform agnosticism, token efficiency, AI slop detection) with `reviewer_checks` arrays |
| `OPTIMIZATION_TRACEABILITY.toml` | Intent → Feature → Requirement → Implementation → Code → Test chain for the optimization work |
| `OPTIMIZATION_EVIDENCE.toml` | 5 claims backed by evidence artifacts with `scope_covered` and `known_exclusions` |
| `REVIEW_READINESS.toml` | 3 review gates (optimization package, methodology contracts, adoption proposal) with `pass_conditions` and `block_conditions` |
| `OPTIMIZATION_DAG.toml` | 21-unit implementation DAG with critical path, conflict groups, parallelism analysis |
| `AI_SLOP_REVIEW_GUIDE.md` | 25-pattern language-agnostic slop detection guide adapted from Rust-specific research (CodeRabbit, GitClear, Snyk, OX Security) |
| `ADOPTION_PROPOSAL.md` | Full case for adopting these structures into gstack's methodology |

### What These Are NOT

This is not an enterprise multi-tenant governance platform. There's no RBAC, no approval workflows, no audit compliance dashboards. The SurrealDB runtime (`dagdb`) runs embedded per-repository, not as a shared service.

What this IS: **a way to make agent instructions more deterministic.** When a contract says `reviewer_checks = ["zero occurrences of blacklisted word"]`, that's a grep. When a review gate says `block_conditions = ["missing proof artifacts"]`, that's a file existence check. When a DAG says `depends_on = ["U01", "U02"]`, that's a topological sort, not an agent guessing execution order from prose.

The results are more deterministic than straight markdown because:
- **Contracts have binary checks.** Pass or fail, not "the agent interpreted it this way."
- **DAGs have computable properties.** Critical path, conflict groups, ready units. Not "the agent thinks U03 should go next."
- **Review gates have explicit conditions.** Required artifacts, required links, block conditions. Not "the agent felt the review was ready."
- **Traceability has typed edges.** Intent realizes Feature, Requirement verified_by Test. Not "see also: the test file."

The tradeoff: authoring TOML is slightly more work than writing prose. But the TOML is authored once and queried many times. The prose is re-parsed on every agent invocation, and each parse is a new opportunity for the agent to miss something.

## How It Was Done

82 minutes wall time. One human (Werner), one Opus 4.6 orchestrator, 29 Sonnet/Haiku agents across 3 waves. The Opus orchestrator read source material from three internal repos, analyzed the gstack codebase, optimized the 3 highest-impact files directly (achieving 53-70% reduction), then dispatched agent fleets for the remaining ~45 files.

One agent verified the build passes: `bun run gen:skill-docs` regenerates all 36 SKILL.md files cleanly from the optimized templates. Gemini Pro reviewed the full branch for semantic preservation, structural quality, and risk assessment.

Full timeline in `docs/research/SESSION_LOG.md`.

## Test Plan

- [x] `bun run gen:skill-docs` regenerates all SKILL.md files cleanly
- [x] All TOML files parse without errors
- [x] Token counts measured before/after for every modified file
- [x] All {{PLACEHOLDER}} references preserved in templates
- [x] All bash code blocks preserved verbatim
- [x] All YAML frontmatter preserved
- [ ] `bun test` passes (skill validation, gen-skill-docs quality checks)
- [ ] Manual review of 3-5 generated SKILL.md files for comprehension quality
- [ ] LLM judge eval on optimized vs original (comprehension maintained?)
