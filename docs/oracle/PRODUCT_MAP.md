<!-- schema_version: 1 -->
# Product Map: gstack

## Product Arc
gstack started as Garry Tan's personal AI builder framework, born March 11, 2026. The core insight: Claude Code with structured roles (slash commands as Markdown skill files) turns a single builder into a virtual engineering team. The first commit shipped the foundational trio: browse (headless browser), ship, review, plan reviews, and retro. Within 18 days, the product exploded from 6 skills to 30+, adding QA, design, security, debugging, deployment, and multi-AI support. The arc is clear: every workflow a solo founder needs to ship production software, automated end-to-end, with quality gates at every step. The product is now in its "platform" phase: multi-agent support (Codex, Gemini), a template generation pipeline, E2E eval infrastructure, and community contributions. Oracle (product memory) is the latest inflection, adding persistent product intelligence across sessions.

## Features

### F001: Browse [SHIPPED]
- **Purpose:** Headless browser CLI for QA testing, site dogfooding, and page interaction without leaving the terminal
- **Category:** browser-tooling
- **Data:** Playwright browser sessions, cookie storage, DOM snapshots
- **Patterns:** CLI command registry (commands.ts), snapshot flags metadata array, server-client architecture
- **Components:** cli.ts, server.ts, browser-manager.ts, commands.ts, snapshot.ts, sidebar-agent.ts
- **Decisions:** Bun-compiled binary for zero-dep distribution; Playwright over Puppeteer for cross-browser; snapshot-based DOM representation over raw HTML
- **Connections:** Used by F003 (QA), F004 (QA-Only), F018 (Design Review), F022 (Benchmark), F023 (Canary), F026 (Connect Chrome)
- **Depends on:** None (foundation)
- **Anti-patterns:** None
- **Shipped:** 2026-03-11
- **Inventory:** docs/oracle/inventory/F001-browse.md

### F002: Ship [SHIPPED]
- **Purpose:** End-to-end ship workflow: merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR
- **Category:** release-workflow
- **Data:** Git history, VERSION, CHANGELOG.md, review logs
- **Patterns:** Review readiness gate, branch-scoped versioning, bisected commits
- **Components:** ship/SKILL.md.tmpl
- **Decisions:** CHANGELOG is for users not contributors; VERSION + CHANGELOG are branch-scoped; review gate requires /review or /codex before shipping
- **Connections:** F005 (Review), F013 (Codex), F024 (Land and Deploy), F025 (Document Release)
- **Depends on:** F005 (Review)
- **Anti-patterns:** Early versions didn't cover all branch commits in PR body (fixed v0.12.4.0)
- **Shipped:** 2026-03-11

### F003: QA [SHIPPED]
- **Purpose:** Systematically QA test a web app in a real browser, find bugs, then iteratively fix them with atomic commits
- **Category:** quality-assurance
- **Data:** Browser DOM snapshots, screenshots, bug evidence
- **Patterns:** Test-fix-verify loop, atomic commit per fix, before/after screenshots
- **Components:** qa/SKILL.md.tmpl
- **Decisions:** Uses real browser (not mocks); fixes bugs inline rather than just reporting; never refuses testing on backend-only changes
- **Connections:** F001 (Browse), F004 (QA-Only)
- **Depends on:** F001 (Browse)
- **Anti-patterns:** None
- **Shipped:** 2026-03-13

### F004: QA Only [SHIPPED]
- **Purpose:** Report-only QA testing: structured bug report with health score and repro steps, never fixes anything
- **Category:** quality-assurance
- **Data:** Browser DOM snapshots, screenshots
- **Patterns:** Health score dashboard, structured repro steps
- **Components:** qa-only/SKILL.md.tmpl
- **Decisions:** Separate from QA to support "just report bugs" workflow without risk of unwanted code changes
- **Connections:** F001 (Browse), F003 (QA)
- **Depends on:** F001 (Browse)
- **Anti-patterns:** None
- **Shipped:** 2026-03-15

### F005: Review [SHIPPED]
- **Purpose:** Pre-landing PR review: analyzes diff for SQL safety, LLM trust boundary violations, conditional side effects, and structural issues
- **Category:** code-review
- **Data:** Git diff, review log JSONL
- **Patterns:** Review log architecture (JSONL), adversarial review scaling, design review lite
- **Components:** review/SKILL.md.tmpl, review/lib/
- **Decisions:** Review log persists across sessions for staleness tracking; review chaining with commit hash tracking
- **Connections:** F002 (Ship), F013 (Codex), F009 (Autoplan)
- **Depends on:** None
- **Anti-patterns:** Review log gaps (fixed v0.11.21.0)
- **Shipped:** 2026-03-11

### F006: Plan CEO Review [SHIPPED]
- **Purpose:** CEO/founder-mode plan review: rethink the problem, find the 10-star product, challenge premises, expand scope
- **Category:** plan-review
- **Data:** Plan files
- **Patterns:** Four modes (SCOPE EXPANSION, SELECTIVE EXPANSION, HOLD SCOPE, RETHINK), cross-model outside voice
- **Components:** plan-ceo-review/SKILL.md.tmpl
- **Decisions:** Interactive walk-through with opinionated recommendations; handoff context for /office-hours chaining
- **Connections:** F007 (Plan Eng Review), F008 (Plan Design Review), F009 (Autoplan), F011 (Office Hours)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-11

### F007: Plan Eng Review [SHIPPED]
- **Purpose:** Eng manager-mode plan review: lock architecture, data flow, edge cases, test coverage, performance
- **Category:** plan-review
- **Data:** Plan files
- **Patterns:** Worktree parallelization strategy, test coverage catalog
- **Components:** plan-eng-review/SKILL.md.tmpl
- **Decisions:** Always-full review (no shortcuts); test bootstrap integration
- **Connections:** F006 (Plan CEO Review), F008 (Plan Design Review), F009 (Autoplan)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-11

### F008: Plan Design Review [SHIPPED]
- **Purpose:** Designer's eye plan review: rates design dimensions 0-10, explains what makes a 10, fixes the plan
- **Category:** plan-review
- **Data:** Plan files
- **Patterns:** Design dimension scoring, interactive fix loop
- **Components:** plan-design-review/SKILL.md.tmpl
- **Decisions:** Report-only in plan mode (no code changes); separate from design-review which operates on live sites
- **Connections:** F006 (Plan CEO Review), F007 (Plan Eng Review), F009 (Autoplan)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-16

### F009: Autoplan [SHIPPED]
- **Purpose:** Auto-review pipeline that runs CEO, design, and eng reviews sequentially with auto-decisions
- **Category:** plan-review
- **Data:** Plan files, review logs
- **Patterns:** 6 decision principles, taste decision surfacing, triple-voice multi-model review
- **Components:** autoplan/SKILL.md.tmpl
- **Decisions:** Auto-decides using 6 principles; surfaces "taste decisions" (close approaches, borderline scope) for human input
- **Connections:** F006 (Plan CEO Review), F007 (Plan Eng Review), F008 (Plan Design Review)
- **Depends on:** F006, F007, F008
- **Anti-patterns:** Analysis compression during long autoplan runs (fixed v0.10.2.0)
- **Shipped:** 2026-03-22

### F010: Retro [SHIPPED]
- **Purpose:** Weekly engineering retrospective: commit analysis, work patterns, code quality metrics with trend tracking
- **Category:** analytics
- **Data:** Git history, persistent retro history
- **Patterns:** Team-aware per-person breakdown, cross-project global mode, trend tracking
- **Components:** retro/SKILL.md.tmpl
- **Decisions:** Global cross-project mode; GitLab support; wall-clock time for bare dates
- **Connections:** None (standalone)
- **Depends on:** None
- **Anti-patterns:** PR size nagging (removed v0.9.4.1); midnight-aligned dates (fixed v0.7.2, v0.8.5)
- **Shipped:** 2026-03-11

### F011: Office Hours [SHIPPED]
- **Purpose:** YC Office Hours: startup diagnostic (6 forcing questions) + builder brainstorm mode (design thinking)
- **Category:** strategy
- **Data:** None (conversational)
- **Patterns:** Two modes (startup, builder), Codex second opinion integration, inline execution (no "another window")
- **Components:** office-hours/SKILL.md.tmpl
- **Decisions:** Inline execution; hardened diagnostic rigor; CEO review handoff context
- **Connections:** F006 (Plan CEO Review), F013 (Codex)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-18

### F012: Investigate [SHIPPED]
- **Purpose:** Systematic debugging with root cause investigation: four phases (investigate, analyze, hypothesize, implement)
- **Category:** debugging
- **Data:** Codebase, error logs
- **Patterns:** Iron Law: no fixes without root cause, four-phase methodology
- **Components:** investigate/SKILL.md.tmpl
- **Decisions:** Never skip straight to fixing; always prove root cause first
- **Connections:** None (standalone)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-19

### F013: Codex [SHIPPED]
- **Purpose:** Multi-AI second opinion via OpenAI Codex CLI: code review, adversarial challenge, and consultation modes
- **Category:** multi-ai
- **Data:** Git diff, code files
- **Patterns:** Three modes (review, challenge, consult), cross-model outside voice, session continuity for follow-ups
- **Components:** codex/SKILL.md.tmpl
- **Decisions:** Uses Codex's own auth (no OPENAI_API_KEY needed); 1024-char description limit; filesystem boundary to prevent prompt injection
- **Connections:** F002 (Ship), F005 (Review), F009 (Autoplan), F011 (Office Hours)
- **Depends on:** None (external: OpenAI Codex CLI)
- **Anti-patterns:** Codex description limit exceeded repeatedly (fixed v0.11.9.0, v0.11.19.0); wrong-repo bug (fixed v0.12.6.0); hang issues (fixed v0.12.4.0)
- **Shipped:** 2026-03-19

### F014: CSO [SHIPPED]
- **Purpose:** Chief Security Officer mode: infrastructure-first security audit with OWASP Top 10, STRIDE threat modeling, and active verification
- **Category:** security
- **Data:** Codebase, dependencies, CI/CD config
- **Patterns:** Infrastructure-first (secrets, deps, CI/CD, LLM security before app-layer), active verification
- **Components:** cso/SKILL.md.tmpl
- **Decisions:** Infrastructure-first ordering (most impactful findings first); skill supply chain scanning
- **Connections:** None (standalone)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-22

### F015: Design Consultation [SHIPPED]
- **Purpose:** Full design system from scratch: research, propose aesthetic/typography/color/layout/motion, generate preview pages
- **Category:** design
- **Data:** Creates DESIGN.md
- **Patterns:** Generates font + color preview pages
- **Components:** design-consultation/SKILL.md.tmpl
- **Decisions:** Creates DESIGN.md as the project's design source of truth
- **Connections:** F016 (Design Review), F017 (Design Shotgun)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-16

### F016: Design Binary [SHIPPED]
- **Purpose:** Real UI mockup generation using GPT Image API: generate, iterate, compare variants, serve gallery
- **Category:** design
- **Data:** Image files, design sessions
- **Patterns:** CLI command pattern (generate, variants, compare, serve, evolve, diff)
- **Components:** design/src/cli.ts, design/src/generate.ts, design/src/variants.ts, design/src/compare.ts, design/src/serve.ts
- **Decisions:** Bun-compiled binary; GPT Image API over local diffusion models; session-based iteration
- **Connections:** F015 (Design Consultation), F017 (Design Shotgun)
- **Depends on:** None (external: OpenAI GPT Image API)
- **Anti-patterns:** None
- **Shipped:** 2026-03-27

### F017: Design Shotgun [SHIPPED]
- **Purpose:** Visual design exploration: rapid generation of design variants
- **Category:** design
- **Data:** Image files
- **Patterns:** Uses design binary for generation
- **Components:** design-shotgun/SKILL.md.tmpl
- **Decisions:** Leverages design binary CLI
- **Connections:** F015 (Design Consultation), F016 (Design Binary)
- **Depends on:** F016 (Design Binary)
- **Anti-patterns:** None
- **Shipped:** 2026-03-27
- **Inventory:** docs/oracle/inventory/F016-design-binary.md

### F018: Design Review [SHIPPED]
- **Purpose:** Designer's eye QA on live sites: finds visual inconsistency, spacing issues, hierarchy problems, AI slop, slow interactions, then fixes them
- **Category:** design
- **Data:** Browser DOM snapshots, screenshots
- **Patterns:** Iterative fix loop with before/after screenshots, atomic commits
- **Components:** design-review/SKILL.md.tmpl
- **Decisions:** Fixes inline (unlike plan-design-review which is report-only); uses browse daemon for visual verification
- **Connections:** F001 (Browse), F008 (Plan Design Review)
- **Depends on:** F001 (Browse)
- **Anti-patterns:** None
- **Shipped:** 2026-03-17

### F019: Benchmark [SHIPPED]
- **Purpose:** Performance regression detection: establishes baselines for page load, Core Web Vitals, and resource sizes
- **Category:** deployment
- **Data:** Performance metrics, baselines
- **Patterns:** Before/after comparison on every PR, trend tracking
- **Components:** benchmark/SKILL.md.tmpl
- **Decisions:** Uses browse daemon for measurement; tracks trends over time
- **Connections:** F001 (Browse), F023 (Canary)
- **Depends on:** F001 (Browse)
- **Anti-patterns:** None
- **Shipped:** 2026-03-21

### F020: Canary [SHIPPED]
- **Purpose:** Post-deploy canary monitoring: watches live app for console errors, performance regressions, page failures
- **Category:** deployment
- **Data:** Console logs, performance metrics, screenshots
- **Patterns:** Periodic screenshots, pre-deploy baseline comparison, anomaly alerting
- **Components:** canary/SKILL.md.tmpl
- **Decisions:** Compares against pre-deploy baselines; alerts on anomalies
- **Connections:** F001 (Browse), F019 (Benchmark), F021 (Land and Deploy)
- **Depends on:** F001 (Browse)
- **Anti-patterns:** None
- **Shipped:** 2026-03-21

### F021: Land and Deploy [SHIPPED]
- **Purpose:** Merge PR, wait for CI and deploy, verify production health via canary checks
- **Category:** deployment
- **Data:** PR state, CI status, deploy logs
- **Patterns:** First-run dry run, staging-first, trust ladder
- **Components:** land-and-deploy/SKILL.md.tmpl
- **Decisions:** Trust ladder (staging → production); first-run dry run for safety
- **Connections:** F002 (Ship), F020 (Canary), F022 (Setup Deploy)
- **Depends on:** F002 (Ship), F022 (Setup Deploy)
- **Anti-patterns:** None
- **Shipped:** 2026-03-21

### F022: Setup Deploy [SHIPPED]
- **Purpose:** One-time deploy configuration: detects platform (Fly.io, Render, Vercel, etc.), production URL, health checks
- **Category:** deployment
- **Data:** CLAUDE.md deploy config
- **Patterns:** Auto-detection of deploy platform
- **Components:** setup-deploy/SKILL.md.tmpl
- **Decisions:** Writes config to CLAUDE.md so it persists across sessions
- **Connections:** F021 (Land and Deploy)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-21

### F023: Document Release [SHIPPED]
- **Purpose:** Post-ship documentation update: reads all docs, cross-references diff, updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md
- **Category:** release-workflow
- **Data:** Markdown documentation files, git diff
- **Patterns:** Cross-reference against shipped diff, polish CHANGELOG voice
- **Components:** document-release/SKILL.md.tmpl
- **Decisions:** Optionally bumps VERSION; cleans up TODOS
- **Connections:** F002 (Ship)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-16

### F024: Connect Chrome [SHIPPED]
- **Purpose:** Launch real Chrome controlled by gstack with Side Panel extension auto-loaded for real-time activity feed
- **Category:** browser-tooling
- **Data:** Chrome browser session
- **Patterns:** Headed mode, sidebar agent, browse handoff (headless-to-headed)
- **Components:** connect-chrome/SKILL.md.tmpl, extension/
- **Decisions:** Chrome extension with side panel for visibility; browse handoff between headless and headed modes
- **Connections:** F001 (Browse), F025 (Extension)
- **Depends on:** F001 (Browse), F025 (Extension)
- **Anti-patterns:** Sidebar agent used stale Playwright URL instead of real tab URL (fixed v0.12.6.0)
- **Shipped:** 2026-03-26

### F025: Chrome Extension [SHIPPED]
- **Purpose:** Side panel extension that shows live activity feed when Chrome is controlled by gstack
- **Category:** browser-tooling
- **Data:** Activity events from gstack
- **Patterns:** Chrome Side Panel API, background service worker, content scripts
- **Components:** extension/manifest.json, extension/sidepanel.js, extension/background.js, extension/content.js
- **Decisions:** Side Panel over DevTools panel for always-visible activity feed
- **Connections:** F024 (Connect Chrome)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-26
- **Inventory:** docs/oracle/inventory/F025-chrome-extension.md

### F026: Safety Skills (Freeze/Careful/Guard) [SHIPPED]
- **Purpose:** Safety guardrails: /freeze restricts edits to a directory, /careful warns before destructive commands, /guard combines both
- **Category:** safety
- **Data:** Session state
- **Patterns:** Directory-scoped edit blocking, destructive command detection
- **Components:** freeze/SKILL.md.tmpl, careful/SKILL.md.tmpl, guard/SKILL.md.tmpl
- **Decisions:** Three separate skills for composability; /guard = /freeze + /careful
- **Connections:** None (standalone, used ad-hoc)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-18

### F027: Oracle [SHIPPED]
- **Purpose:** Product memory and intelligence layer: bootstraps product map from codebase, tracks features across sessions, surfaces connections during planning
- **Category:** product-intelligence
- **Data:** PRODUCT_MAP.md, scan manifests, inventory docs
- **Patterns:** AST-powered scanner (scan-imports.ts), two-tier documentation (Tier 1 map + Tier 2 inventory), product conscience resolver
- **Components:** oracle/SKILL.md.tmpl, oracle/bin/scan-imports.ts, scripts/resolvers/oracle.ts
- **Decisions:** Product map lives in repo (docs/oracle/) not in memory dir; scanner uses TypeScript AST for framework-agnostic analysis; integrated into 19 skills via resolver blocks
- **Connections:** All skills (via PRODUCT_CONSCIENCE_READ/WRITE resolver blocks)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-28
- **Inventory:** docs/oracle/inventory/F027-oracle.md

### F028: Gen-Skill-Docs Pipeline [SHIPPED]
- **Purpose:** Template system that generates SKILL.md files from .tmpl templates with resolver modules for shared behavior
- **Category:** infrastructure
- **Data:** .tmpl template files, resolver modules
- **Patterns:** Template → placeholder → resolver pipeline, multi-host support (Claude, Codex, Agents)
- **Components:** scripts/gen-skill-docs.ts, scripts/resolvers/, scripts/discover-skills.ts
- **Decisions:** Resolvers for shared behavior (preamble, review, oracle, design, testing, codex); multi-host compilation (Claude vs Codex vs Agents)
- **Connections:** All skills (generates their SKILL.md)
- **Depends on:** None
- **Anti-patterns:** None
- **Shipped:** 2026-03-11
- **Inventory:** docs/oracle/inventory/F028-gen-skill-docs.md

### F029: E2E Eval Infrastructure [SHIPPED]
- **Purpose:** Test and eval system: skill validation, LLM-judge quality evals, E2E tests via claude -p, diff-based test selection
- **Category:** infrastructure
- **Data:** Eval results in ~/.gstack-dev/evals/, test fixtures
- **Patterns:** Diff-based touchfiles, two-tier gate/periodic system, session-runner, eval-store with comparison
- **Components:** test/skill-validation.test.ts, test/skill-e2e-*.test.ts, test/helpers/session-runner.ts, test/helpers/touchfiles.ts
- **Decisions:** Diff-based selection to control cost (~$4/run max); gate tier blocks merge, periodic runs weekly; worktree isolation for E2E tests
- **Connections:** F028 (Gen-Skill-Docs)
- **Depends on:** None
- **Anti-patterns:** Context bloat from copying full SKILL.md files into fixtures (documented in CLAUDE.md)
- **Shipped:** 2026-03-13
- **Inventory:** docs/oracle/inventory/F029-eval-infrastructure.md

### F030: Multi-Agent Support [SHIPPED]
- **Purpose:** gstack works on Claude Code, OpenAI Codex CLI, and Google Gemini CLI with host-specific compilation
- **Category:** platform
- **Data:** Host-specific skill files
- **Patterns:** Host detection, path abstraction (HOST_PATHS), Codex-specific YAML generation, description limits
- **Components:** scripts/resolvers/codex-helpers.ts, scripts/resolvers/types.ts
- **Decisions:** Codex has 1024-char description limit; Codex uses YAML frontmatter; filesystem boundary for prompt injection prevention
- **Connections:** F028 (Gen-Skill-Docs), F013 (Codex)
- **Depends on:** F028 (Gen-Skill-Docs)
- **Anti-patterns:** Codex description limit exceeded repeatedly (finally enforced v0.11.9.0); Codex hang from stdout buffering (fixed v0.12.4.0)
- **Shipped:** 2026-03-22

### F031: Telemetry System [SHIPPED]
- **Purpose:** Opt-in usage telemetry with three tiers: community (device ID), anonymous (no ID), off
- **Category:** infrastructure
- **Data:** ~/.gstack/analytics/skill-usage.jsonl, Supabase remote
- **Patterns:** Local JSONL always logs, remote binary opt-in, first-run prompt flow
- **Components:** bin/gstack-telemetry-log, bin/gstack-config, supabase/
- **Decisions:** Three-tier consent (community/anonymous/off); local always logs; random UUID installation_id; Supabase for remote with RLS lockdown
- **Connections:** All skills (via preamble)
- **Depends on:** None
- **Anti-patterns:** Security issues with telemetry credentials and RLS policies (fixed v0.11.16.0, v0.12.12.0)
- **Shipped:** 2026-03-20
- **Inventory:** docs/oracle/inventory/F031-telemetry.md

## Reusable Patterns
- **Preamble Resolver:** Shared session tracking, update checks, user preference loading, telemetry init. Established in F028. Used by all 30+ skills. Health: healthy.
- **Review Log (JSONL):** Persistent review tracking with skill attribution, commit hash staleness detection, and chaining across sessions. Established in F005. Used by F002, F005, F009, F013. Health: healthy.
- **Template → SKILL.md Pipeline:** .tmpl templates with {{PLACEHOLDER}} resolution from TypeScript resolvers. Established in F028. Used by all skills. Health: healthy.
- **Browse Daemon:** Headless Playwright browser with DOM snapshot representation, used for QA, design review, benchmarking, and canary monitoring. Established in F001. Used by F003, F004, F018, F019, F020, F024. Health: healthy.
- **Atomic Commit Loop:** Test-fix-verify cycle with one commit per fix and before/after evidence. Established in F003. Used by F003, F018. Health: healthy.
- **Cross-Model Outside Voice:** Multi-AI review using Codex/Gemini as independent second opinion. Established in F013. Used by F006, F007, F009, F011. Health: healthy.
- **Product Conscience Resolver:** Silent PRODUCT_CONSCIENCE_READ/WRITE blocks injected into all skills via oracle resolver. Established in F027. Used by 19+ skills. Health: healthy.

## Anti-Patterns
- **Codex Description Overflow:** Codex CLI has a hard 1024-char limit. Early integrations exceeded it, causing silent failures. Fix: explicit truncation + validation. Tags: [codex, integration, silent-failure]. See F013, F030.
- **Platform-Specific Hardcoding:** Early skills hardcoded framework-specific commands (test runners, file patterns). Fix: read CLAUDE.md for project config, AskUserQuestion if missing. Tags: [portability, config]. See CLAUDE.md.
- **zsh Glob NOMATCH:** Bash glob patterns like `~/.gstack/analytics/.pending-*` cause zsh errors when no files match. Fix: use `find` instead of glob expansion. Tags: [cross-shell, zsh]. Fixed three times across v0.11.7.0, v0.12.8.1.
- **Windows Process Management:** Playwright server management assumed Unix process semantics. Fix: health-check-first server startup, detached processes, Node.js fallback. Tags: [windows, cross-platform]. See F001.
- **Telemetry Credential Leaks:** Early telemetry shipped Supabase credentials in cleartext. Fix: RLS lockdown, credential rotation, anonymous mode. Tags: [security, telemetry]. See F031.
- **E2E Fixture Context Bloat:** Copying full 1500-2000 line SKILL.md files into E2E fixtures caused timeouts and flaky tests. Fix: extract only the section under test. Tags: [testing, performance]. See F029.

## Identity
- release-workflow: 10% (Ship, Document Release, Land and Deploy)
- plan-review: 16% (CEO, Eng, Design, Autoplan)
- quality-assurance: 6% (QA, QA-Only)
- code-review: 3% (Review)
- browser-tooling: 10% (Browse, Connect Chrome, Extension)
- design: 13% (Consultation, Binary, Shotgun, Design Review)
- deployment: 10% (Benchmark, Canary, Setup Deploy)
- strategy: 3% (Office Hours)
- debugging: 3% (Investigate)
- security: 3% (CSO)
- safety: 3% (Freeze/Careful/Guard)
- multi-ai: 3% (Codex)
- product-intelligence: 3% (Oracle)
- infrastructure: 10% (Gen-Skill-Docs, E2E Evals, Telemetry)
- platform: 3% (Multi-Agent Support)
- analytics: 3% (Retro)
