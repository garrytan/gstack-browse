# gstack development

## Commands

```bash
bun install          # install dependencies
bun test             # run free tests (browse + snapshot + skill validation)
bun run test:evals   # run paid evals: LLM judge + E2E (~$4/run)
bun run test:e2e     # run E2E tests only (~$3.85/run)
bun run dev <cmd>    # run CLI in dev mode, e.g. bun run dev goto https://example.com
bun run build        # gen docs for Claude + Codex, then compile binaries
bun run gen:skill-docs            # regenerate Claude SKILL.md files
bun run gen:skill-docs --host codex  # regenerate Codex SKILL.md files
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

```text
gstack/
├── .agents/skills/  # Generated Codex skill tree (don't hand-edit)
├── browse/          # Headless browser CLI (Playwright)
│   ├── src/         # CLI + server + commands
│   ├── test/        # Integration tests + fixtures
│   └── dist/        # Compiled binary
├── scripts/         # Build + DX tooling
├── test/            # Skill validation + eval tests
├── ship/            # $gstack-ship / /ship workflow skill
├── review/          # $gstack-review / /review workflow skill
├── setup            # One-time setup: build binary + symlink skills
├── AGENTS.md        # Codex guidance
├── CLAUDE.md        # Claude guidance
├── SKILL.md         # Generated Claude browse skill
├── SKILL.md.tmpl    # Shared template source
└── package.json     # Build scripts for browse + doc generation
```

## SKILL.md workflow

SKILL.md files are **generated** from `.tmpl` templates. To update docs:

1. Edit the `.tmpl` file.
2. Run `bun run gen:skill-docs` for Claude and `bun run gen:skill-docs --host codex` for Codex.
3. Commit both the template and generated outputs.

Codex outputs live in `.agents/skills/gstack*/SKILL.md`. Do not hand-edit them.

## Writing SKILL templates

SKILL.md.tmpl files are prompt templates read by hosts, not bash scripts. Each
bash code block runs in a separate shell, so variables do not persist between blocks.

Rules:
- Use natural language for logic and state.
- Don't hardcode branch names. Use `{{BASE_BRANCH_DETECT}}`.
- Keep bash blocks self-contained.
- Express conditionals as English instead of nested shell control flow.
- Keep the template system as the single source of truth for both hosts.

## Browser interaction

When you need to interact with a browser (QA, dogfooding, cookie setup), use
`$gstack-browse` or run the browse binary directly via `$B <command>`. Never use
`mcp__claude-in-chrome__*` tools.

## Vendored symlink awareness

When developing gstack, `.agents/skills/gstack` may be the checked-in Codex tree
and `.claude/skills/gstack` may be a gitignored symlink back to this working
directory. Skill changes can go live immediately for both hosts.

Check once per session:

```bash
ls -la .agents/skills/gstack
ls -la .claude/skills/gstack 2>/dev/null || true
```

If `.claude/skills/gstack` points at your working tree, template changes plus
`bun run gen:skill-docs` immediately affect active Claude sessions. Codex reads
the checked-in `.agents/skills/` tree, so regenerate Codex docs before testing.

## CHANGELOG style

CHANGELOG.md is for users, not contributors.

- Lead with what the user can now do.
- Use plain language, not implementation details.
- Put contributor/internal notes in a separate "For contributors" section.

## Local plans

Contributors can store long-range vision docs and design documents in
`~/.gstack-dev/plans/`. These are local-only and not checked in.

## E2E eval failure blame protocol

If an E2E eval fails, never claim it is unrelated without proving it on the base
branch first. Prompt and skill changes have invisible couplings.

## Deploying to the active skill

The active Codex skill lives at `~/.agents/skills/gstack/`. After making changes:

1. Push your branch.
2. Refresh the checkout you installed from.
3. Run `./setup --host codex`.

Or copy binaries directly:

```bash
cp browse/dist/browse ~/.agents/skills/gstack/browse/dist/browse
cp browse/dist/find-browse ~/.agents/skills/gstack/browse/dist/find-browse
```
