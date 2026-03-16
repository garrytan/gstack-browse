# gstack development

## Commands

```bash
bun install          # install dependencies
bun test             # run free tests (browse + snapshot + skill validation)
bun run test:evals   # run paid evals: LLM judge + E2E (~$4/run)
bun run test:e2e     # run E2E tests only (~$3.85/run)
bun run dev <cmd>    # run CLI in dev mode, e.g. bun run dev goto https://example.com
bun run build        # gen docs + compile binaries
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run skill:check  # health dashboard for all skills
bun run dev:skill    # watch mode: auto-regen + validate on change
bun run eval:list    # list all eval runs from ~/.gstack-dev/evals/
bun run eval:compare # compare two eval runs (auto-picks most recent)
bun run eval:summary # aggregate stats across all eval runs
```

`test:evals` requires `ANTHROPIC_API_KEY`. E2E tests stream progress in real-time
(tool-by-tool via `--output-format stream-json --verbose`). Results are persisted
to `~/.gstack-dev/evals/` with auto-comparison against the previous run.

## Project structure

```
gstack/
├── browse/          # Headless browser CLI (Playwright)
│   ├── src/         # CLI + server + commands
│   │   ├── commands.ts  # Command registry (single source of truth)
│   │   └── snapshot.ts  # SNAPSHOT_FLAGS metadata array
│   ├── test/        # Integration tests + fixtures
│   └── dist/        # Compiled binary
├── scripts/         # Build + DX tooling
│   ├── gen-skill-docs.ts  # Template → SKILL.md generator
│   ├── skill-check.ts     # Health dashboard
│   └── dev-skill.ts       # Watch mode
├── test/            # Skill validation + eval tests
│   ├── helpers/     # skill-parser.ts, session-runner.ts, llm-judge.ts, eval-store.ts
│   ├── fixtures/    # Ground truth JSON, planted-bug fixtures, eval baselines
│   ├── skill-validation.test.ts  # Tier 1: static validation (free, <1s)
│   ├── gen-skill-docs.test.ts    # Tier 1: generator quality (free, <1s)
│   ├── skill-llm-eval.test.ts   # Tier 3: LLM-as-judge (~$0.15/run)
│   └── skill-e2e.test.ts         # Tier 2: E2E via claude -p (~$3.85/run)
├── qa-only/         # /qa-only skill (report-only QA, no fixes)
├── ship/            # Ship workflow skill
├── review/          # PR review skill
├── plan-ceo-review/ # /plan-ceo-review skill
├── plan-eng-review/ # /plan-eng-review skill
├── retro/           # Retrospective skill
├── setup            # One-time setup: build binary + symlink skills
├── SKILL.md         # Generated from SKILL.md.tmpl (don't edit directly)
├── SKILL.md.tmpl    # Template: edit this, run gen:skill-docs
└── package.json     # Build scripts for browse
```

## SKILL.md workflow

SKILL.md files are **generated** from `.tmpl` templates. To update docs:

1. Edit the `.tmpl` file (e.g. `SKILL.md.tmpl` or `browse/SKILL.md.tmpl`)
2. Run `bun run gen:skill-docs` (or `bun run build` which does it automatically)
3. Commit both the `.tmpl` and generated `.md` files

To add a new browse command: add it to `browse/src/commands.ts` and rebuild.
To add a snapshot flag: add it to `SNAPSHOT_FLAGS` in `browse/src/snapshot.ts` and rebuild.

## Browser interaction

When you need to interact with a browser (QA, dogfooding, cookie setup), use the
`/browse` skill or run the browse binary directly via `$B <command>`. NEVER use
`mcp__claude-in-chrome__*` tools — they are slow, unreliable, and not what this
project uses.

## Vendored symlink awareness

When developing gstack, `.claude/skills/gstack` may be a symlink back to this
working directory (gitignored). This means skill changes are **live immediately** —
great for rapid iteration, risky during big refactors where half-written skills
could break other Claude Code sessions using gstack concurrently.

**Check once per session:** Run `ls -la .claude/skills/gstack` to see if it's a
symlink or a real copy. If it's a symlink to your working directory, be aware that:
- Template changes + `bun run gen:skill-docs` immediately affect all gstack invocations
- Breaking changes to SKILL.md.tmpl files can break concurrent gstack sessions
- During large refactors, remove the symlink (`rm .claude/skills/gstack`) so the
  global install at `~/.claude/skills/gstack/` is used instead

**For plan reviews:** When reviewing plans that modify skill templates or the
gen-skill-docs pipeline, consider whether the changes should be tested in isolation
before going live (especially if the user is actively using gstack in other windows).

## CHANGELOG style

CHANGELOG.md is **for users**, not contributors. Write it like product release notes:

- Lead with what the user can now **do** that they couldn't before. Sell the feature.
- Use plain language, not implementation details. "You can now..." not "Refactored the..."
- Put contributor/internal changes in a separate "For contributors" section at the bottom.
- Every entry should make someone think "oh nice, I want to try that."
- No jargon: say "every question now tells you which project and branch you're in" not
  "AskUserQuestion format standardized across skill templates via preamble resolver."

## Agent Teams

gstack skills are designed to run as **Claude Code Agent Teams** where teammates
communicate directly with each other. Enable this in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### How it works

When a user says `/team ship` or "create a team to review this code," the lead:
1. Spawns teammates, each assigned a gstack skill persona
2. Each teammate reads their SKILL.md and follows it as their methodology
3. Teammates message findings to each other (security → risk, vc → board, etc.)
4. The lead synthesizes all teammate outputs into a unified report

### Skill dependency graph (who messages whom)

```
ENGINEERING PIPELINE:
  /plan-eng-review → /review + /cso (parallel) → /ship → /qa

EXECUTIVE ANALYSIS:
  /vc + /cfo + /cso (parallel) → /risk (incorporates security) → /board (synthesizes all)

LAUNCH:
  /media + /pr-comms + /comms (parallel, coordinate on messaging consistency)

INCIDENT:
  /escalation (IC, makes decisions) ← /cso (security assessment) ← /comms (drafts comms)

CROSS-FUNCTIONAL:
  /conflicts → /review (knows which PRs conflict)
  /ai-hybrid → any skill (measures AI-assisted workflow effectiveness)
  /retro → all skills (analyzes historical performance)
```

### Team patterns

| Pattern | When to use | Example |
|---------|-------------|---------|
| Pipeline | Sequential workflow | `/team ship`: plan → review → ship → qa |
| Parallel | Independent analysis | `/team review`: 4 reviewers, different lenses |
| War room | Time-critical incident | `/team incident`: IC + security + comms |
| Parallel+deps | Analysis with synthesis | `/team diligence`: 3 analysts → risk → board |

### Pre-built team configurations

See `team/SKILL.md` for the 7 pre-built configurations. The `/team` skill is the
recommended way to spawn agent teams — it handles teammate spawning, skill assignment,
task dependency ordering, and output synthesis.

### Every skill is teammate-aware

The shared `{{PREAMBLE}}` includes agent team detection. When a skill runs as a
teammate, it automatically:
- Messages findings to relevant teammates instead of just outputting
- Waits for upstream teammate findings before dependent analysis
- Challenges other teammates' assessments when it disagrees
- Writes reports to `.gstack/` for cross-teammate access
- Marks shared tasks as completed to unblock downstream work

This means ANY gstack skill works both standalone (user invokes directly) and as
a teammate (lead spawns it in a team). No special configuration needed.

## Deploying to the active skill

The active skill lives at `~/.claude/skills/gstack/`. After making changes:

1. Push your branch
2. Fetch and reset in the skill directory: `cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main`
3. Rebuild: `cd ~/.claude/skills/gstack && bun run build`

Or copy the binary directly: `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`
