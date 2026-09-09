# gstack — AI Engineering Workflow

gstack is a collection of SKILL.md files that give AI agents structured roles for
software development. Each skill is a specialist: CEO reviewer, eng manager,
designer, QA lead, release engineer, debugger, and more.

## Available skills

Skills live in `.agents/skills/` (or `~/.claude/skills/gstack/` on Claude Code).
Invoke them by name (e.g., `/office-hours`).

### Plan-mode reviews

| Skill | What it does |
|-------|-------------|
| `/office-hours` | Start here. Reframes your product idea before you write code. |
| `/plan-ceo-review` | CEO-level review: find the 10-star product in the request. |
| `/plan-eng-review` | Lock architecture, data flow, edge cases, and tests. |
| `/plan-design-review` | Rate each design dimension 0-10, explain what a 10 looks like. |
| `/plan-devex-review` | DX-mode review: TTHW, magical moments, friction points, persona traces. |
| `/plan-tune` | Self-tune AskUserQuestion sensitivity per question. |
| `/autoplan` | One command runs CEO → design → eng → DX review. |
| `/design-consultation` | Build a complete design system from scratch. |
| `/spec` | Turn vague intent into a precise, executable spec in five phases. Files a GitHub issue, optionally spawns a Claude Code agent in a fresh worktree, and lets `/ship` close the source issue on merge. |

### Implementation + review

| Skill | What it does |
|-------|-------------|
| `/review` | Pre-landing PR review. Finds bugs that pass CI but break in prod. |
| `/codex` | Second opinion via OpenAI Codex. Review, challenge, or consult modes. |
| `/investigate` | Systematic root-cause debugging. No fixes without investigation. |
| `/design-review` | Live-site visual audit + fix loop with atomic commits. |
| `/design-shotgun` | Generate multiple AI design variants, comparison board, iterate. |
| `/design-html` | Generate production-quality Pretext-native HTML/CSS. |
| `/devex-review` | Live developer experience audit (TTHW measured against the real flow). |
| `/qa` | Open a real browser, find bugs, fix them, re-verify. |
| `/qa-only` | Same methodology as /qa but report only — no code changes. |
| `/scrape` | Pull data from a web page. First call prototypes; codified call runs in ~200ms. |
| `/skillify` | Codify the most recent successful `/scrape` flow into a permanent browser-skill. |

### Release + deploy

| Skill | What it does |
|-------|-------------|
| `/ship` | Run tests, review, push, open PR. Workspace-aware version queue. |
| `/land-and-deploy` | Merge the PR, wait for CI and deploy, verify production health. |
| `/canary` | Post-deploy monitoring loop using the browse daemon. |
| `/landing-report` | Read-only dashboard for the workspace-aware ship queue. |
| `/document-release` | Update all docs to match what you just shipped. |
| `/document-generate` | Generate Diataxis docs (tutorial / how-to / reference / explanation) from code. |
| `/setup-deploy` | One-time deploy config detection (Fly.io, Render, Vercel, etc.). |
| `/gstack-upgrade` | Update gstack to the latest version. |

### Operational + memory

| Skill | What it does |
|-------|-------------|
| `/context-save` | Save working context (git state, decisions, remaining work). |
| `/context-restore` | Resume from a saved context, even across Conductor workspaces. |
| `/learn` | Manage what gstack learned across sessions. |
| `/retro` | Weekly retro with per-person breakdowns and shipping streaks. |
| `/health` | Code quality dashboard (type checker, linter, tests, dead code). |
| `/benchmark` | Performance regression detection (page load, Core Web Vitals). |
| `/benchmark-models` | Cross-model benchmark for skills (Claude, GPT, Gemini side-by-side). |
| `/cso` | OWASP Top 10 + STRIDE security audit. |
| `/setup-gbrain` | Set up gbrain for cross-machine session memory sync. |
| `/sync-gbrain` | Keep gbrain current with this repo's code; refresh agent search guidance in CLAUDE.md. |

### Browser + agent integration

| Skill | What it does |
|-------|-------------|
| `/browse` | Headless browser — real Chromium, real clicks, ~100ms/command. |
| `/open-gstack-browser` | Launch the visible GStack Browser with sidebar + stealth. |
| `/setup-browser-cookies` | Import cookies from your real browser for authenticated testing. |
| `/pair-agent` | Pair a remote AI agent (OpenClaw, Codex, etc.) with your browser. |

### iOS QA — drive real iPhones over USB or Tailscale (v1.43.0.0+)

| Skill | What it does |
|-------|-------------|
| `/ios-qa` | Live-device iOS QA via USB CoreDevice tunnel + embedded StateServer. Optionally exposes the device over Tailscale so remote agents can drive it. |
| `/ios-fix` | Autonomous iOS bug fixer with regression snapshot capture. |
| `/ios-design-review` | Designer's-eye QA on a real iPhone — 10-dimension Apple HIG rubric. |
| `/ios-clean` | Convenience: strip DebugBridge + #if DEBUG wiring before a Release build. |
| `/ios-sync` | Regenerate the iOS debug bridge against the latest upstream templates. |

Companion CLIs (run on the Mac that's plugged into the device):

| Command | What it does |
|---------|-------------|
| `gstack-ios-qa-daemon` | Mac-side broker. Loopback by default; `--tailnet` adds a Tailscale-facing listener with capability tiers and audit logging. |
| `gstack-ios-qa-mint` | Owner-grant CLI for the tailnet allowlist (`grant`/`revoke`/`list`). |
| `gstack-ios-qa-regen` | Regenerate the canonical local DebugBridge package and typed accessors (`--app-source` / `--bridge-dir`). |

End-to-end walkthrough: [docs/howto-ios-testing-with-gstack.md](docs/howto-ios-testing-with-gstack.md).

### Safety + scoping

| Skill | What it does |
|-------|-------------|
| `/careful` | Warn before destructive commands (rm -rf, DROP TABLE, force-push). |
| `/freeze` | Lock edits to one directory. Hard block, not just a warning. |
| `/guard` | Activate both careful + freeze at once. |
| `/unfreeze` | Remove directory edit restrictions. |
| `/make-pdf` | Turn any markdown file into a publication-quality PDF. |
| `/diagram` | English in, diagram out: mermaid source + editable .excalidraw + SVG/PNG, offline. |

## Build commands

```bash
bun install              # install dependencies
bun test                 # run free tests (no API spend)
bun run test:windows     # curated Windows-safe subset (runs on windows-latest)
bun run build            # generate docs + compile binaries
bun run gen:skill-docs   # regenerate SKILL.md files from templates
bun run skill:check      # health dashboard for all skills
```

## Platform support

- **macOS** + **Linux**: full test suite supported.
- **Windows**: curated Windows-safe subset runs on `windows-latest` via the
  `windows-free-tests` CI job. Setup script (`./setup`) requires Git Bash or
  MSYS today; native PowerShell support is a future expansion. The `bin/gstack-paths`
  helper resolves state roots through `CLAUDE_PLUGIN_DATA` / `GSTACK_HOME` so plugin
  installs work on every platform.

## Key conventions

- SKILL.md files are **generated** from `.tmpl` templates. Edit the template, not the output.
- Run `bun run gen:skill-docs --host codex` to regenerate Codex-specific output.
- The browse binary provides headless browser access. Use `$B <command>` in skills.
- Safety skills (careful, freeze, guard) use inline advisory prose — always confirm before destructive operations.
- State paths resolve via `bin/gstack-paths` (sourced via `eval "$(...)"`). Honors `GSTACK_HOME`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PLANS_DIR`.
- The `claude` CLI binary resolves via `browse/src/claude-bin.ts` (`Bun.which()` + `GSTACK_CLAUDE_BIN` override). Set `GSTACK_CLAUDE_BIN=wsl` plus `GSTACK_CLAUDE_BIN_ARGS='["claude"]'` to run Claude through WSL on Windows.

<!-- Review sections installed by VAS-2757. Canonical text: claude-fleet-config
     claude/review/agents-review-guidelines.md (VAS-2756 AC3) — edit there first, then
     propagate; a per-repo divergence is a deliberate, documented decision, never drift. -->

## Review guidelines

These rules apply to every automated reviewer (Codex GitHub review, CodeRabbit) and to any agent
asked to review a diff. A reviewer is read-only: it reports; it never edits, commits or pushes.

### Severity rubric

- **P0 — ship-stopper.** Data loss or corruption. A security defect: auth or authorisation bypass;
  a Supabase table, view or function reachable without its intended RLS policy; a secret or token
  in code, logs or the client bundle; injection or SSRF; PII sent to a third party the code did not
  send it to before. A change that breaks the production build or deploy. A public API, schema or
  contract broken with no migration path.
- **P1 — must fix before merge.** A functional defect on the main path of this change. A crash or
  unhandled rejection reachable in normal use. A swallowed error on a write path. A race or
  double-write involving money or user data. A new table or column without its migration or
  policy. A server-only value that reaches client code. A test that cannot fail.
- **P2 — should fix, does not block.** An edge-case defect off the main path. A performance
  regression with no user-visible impact. Changed behaviour with no test. Error handling
  inconsistent with the surrounding code. A name that will cause a future defect.
- **P3 — nit.** Style, formatting, wording, comments.

Report P0 and P1 as inline review comments, each prefixed with its severity. Put P2 in the review
summary only. Do not report P3.

### What a finding must contain

1. `path:line` of the defect.
2. The concrete failure: which trigger or input, through which code path, violates which
   invariant, with what impact. If you cannot write that sentence, it is not a finding.
3. The smallest fix, expressed as a deletion or a correction of existing lines.

### Never by addition

Do not raise a finding whose only remedy is adding something: new validation, new handling, new
tests, new docs, new comments, new abstractions, new configuration. Rate it P2, prefix it
`scope:`, and let it become a ticket. Why: review-driven additions made reviewed files grow 2.7×
in one lane and manufactured roughly half of all later findings.

Exception: a defect the severity rubric above already classes P0 or P1 — a missing RLS policy, a
new table or column without its migration or policy — keeps its rubric severity even though the
remedy is an addition. This rule bounds remedies for findings below that bar; it never downgrades
a rubric-defined blocker.

### Scope

- A finding must be resolvable inside this PR's diff, or in a file this diff breaks (a call site,
  a contract, a consumer of a changed type). A cross-file defect caused by this diff is P1,
  prefixed `cross-file:`, naming both locations.
- A pre-existing defect this diff does not touch is P2, prefixed `pre-existing:`.
- A thread already resolved with a `VAS-` ticket link is closed. Do not re-raise it.
- If the newest commits carry a `Review-Fix-Head:` trailer, review those commits and what they
  touch, not the whole PR again.

### Diff-expansion triggers

Inspect beyond the diff when the change touches auth, RLS, database schema, shared domain or API
types, the privileged Supabase client, caching, tenant boundaries, external egress, or a shared
helper used by multiple routes; follow caller, callee, schema, policy and tests only as required
to prove or disprove a finding.

### Do not report

Style or formatting. Naming preferences. Anything phrased "consider", "might", "could".
Speculative performance. Missing comments or docstrings. Alternative architectures. Anything CI
already enforces.

### Documentation and Markdown

Only P0 and P1 apply: a command or code sample that will not run as written; a statement that
contradicts the code; a secret or a production URL that should not be there. No findings on
wording, tone, structure or length.

<!-- GENERATED from review/triage.yml by claude/bin/gen-triage-views.py — do not hand-edit.
     Copied into each repo's AGENTS.md review section by VAS-2757. -->

### Artefact-class triage (generated)

Review depth is set by the artefact-class triage table (claude-fleet-config
`review/triage.yml`): an ordered matcher over touched paths, first match wins, deny
checked first.

- **Refuse — fail, do not review:** `**/.env`, `**/.env.*`, `**/*.pem`, `**/*.key` (except `**/*.example`), or private-key material in the diff.
- **full** (cheap + CodeRabbit + Codex): `supabase/migrations/**`, `supabase/functions/**`, `.github/workflows/**`, `.github/actions/**`, `**/middleware.ts`, `**/route.ts`, `**/pages/api/**`, `lib/**`, `src/lib/**`, `**/*.d.ts`, `**/auth/**`, `**/next.config.*`, `**/stripe/**`, `**/checkout/**`, `**/webhooks/**`, `claude/hooks/**`, `claude/bin/**`, `claude/tests/**`.
- **skim** (cheap voice only, one pass, annotations): `**/CLAUDE.md`, `**/AGENTS.md`, `**/content/config.ts`, `**/content.config.ts`, `**/components/**`, `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*`, `tests/**`, `e2e/**`, `supabase/tests/**`, `**/package.json`, `**/tsconfig*.json`, `**/vitest.config.*`, `**/playwright.config.*`, `**/tailwind.config.*`, `**/postcss.config.*`, `**/eslint.config.*`, `**/.eslintrc*`, `**/.prettierrc*`, `**/astro.config.*`, `**/vercel.json`, `**/components.json`, `**/.env.example`, `**/*.example`, `supabase/seed.sql`.
- **none** (deterministic suite only): `**/package-lock.json`, `**/pnpm-lock.yaml`, `**/yarn.lock`, `**/bun.lockb`, `**/*.lock`, `**/types.gen.ts`, `**/*.gen.ts`, `**/next-env.d.ts`, `.next/**`, `dist/**`, `build/**`, `out/**`, `.vercel/**`, `coverage/**`, `**/tsconfig.tsbuildinfo`, `public/**`, `**/*.png`, `**/*.jpg`, `**/*.jpeg`, `**/*.gif`, `**/*.svg`, `**/*.webp`, `**/*.ico`, `**/*.woff`, `**/*.woff2`, `**/*.mp4`, `**/*.pdf`, `src/content/**`, `docs/**`, `README*`, `**/README*`, `CHANGELOG*`, `**/CHANGELOG*`, `**/*.md`.
- **Unmatched paths:** skim.
- **Content triggers** (deterministic greps on the diff; they only ever escalate): `ROW LEVEL SECURITY` → full; `(CREATE|ALTER|DROP)[[:space:]]+POLICY` → full; `SECURITY DEFINER` → full; `DROP[[:space:]]+TABLE` → full; `\bTRUNCATE\b` → full; `service_role` → full; `dangerouslySetInnerHTML` → full; `'use server'` → full; `"(postinstall|preinstall|prepare)"[[:space:]]*:` → full.
- **docs-as-contract** (claude-fleet-config, → full): A diff that touches a literal string referenced anywhere under claude/bin/** or claude/hooks/** is full. Doctrine text that a script enforces is a contract, and "**/*.md → none" would give it no review: the 8 Sep calibration showed the one real cross-file P1 of the month (cfc PR #193) was a doctrine change to the PASS|FAIL|PARTIAL verdict vocabulary that claude/skills/verify-ship/write-receipt.mjs enforces. Any enum or token vocabulary shared between doctrine and a script gets a parity test in claude/tests/ — claude/tests/triage-parity.test.sh carries the write-receipt verdict enum as the first case.
- **Mixed PRs:** max over the touched paths' classes; content triggers may then raise it. Triggers never lower a class.
- **Context filtering:** hunks whose path class is below the firing class are excluded from the reviewer's context.

## Review fix-pass rules

For the agent that fixes findings (Claude Code or opencode), attended or unattended.

- Act only on unresolved P0/P1 threads bound to the current head commit. P2 and P3 are never fixed
  in the fix pass; the harvest job tickets them.
- One commit per landed review set. Fix by deletion or correction. Do not add files. The commit
  may not grow the touched files by more than 10% (floor 20 lines). If a correct fix needs more
  than that, do not fix: reply in the thread with `needs-scope` and stop.
- Touch only files that carry an open P0/P1 thread, plus files those edits break.
- Commit message `fix(review): <summary>` with trailers `Review-Fix-Head: <reviewed sha>` and one
  `Addresses: <thread url>` per fixed finding. Never rewrite history on a lane branch.
- Never run `@codex fix`. Never commit a reviewer's suggested patch verbatim in an unattended
  lane. The reviewer must not become the author of what it reviews.
- Re-review is a deliberate act. Unattended lanes get at most two automated `@codex review`
  requests per PR; after that the PR is parked with a ticket and a human decides. Attended
  sessions may request review of a **new candidate SHA** at any time — never a repeat pass on an
  unchanged head.
- If you disagree with a P0/P1, reply in the thread with evidence. Only a human resolves a P0/P1
  thread as won't-fix.
