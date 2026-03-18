# gstack for Codex

## Commands

```bash
bun install          # install dependencies
bun test             # run free tests (browse + snapshot + skill validation)
bun run test:evals   # run paid evals: LLM judge + E2E (diff-based, ~$4/run max)
bun run test:e2e     # run E2E tests only (diff-based, ~$3.85/run max)
bun run dev <cmd>    # run CLI in dev mode, e.g. bun run dev goto https://example.com
bun run build        # gen docs + compile binaries
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run skill:check  # health dashboard for all skills
```

## Codex install

```bash
git clone https://github.com/garrytan/gstack.git ~/src/gstack
cd ~/src/gstack
./setup --host codex
```

This installs the root skill at `$HOME/.codex/skills/gstack/` and creates
Codex aliases like:

- `$gstack-browse`
- `$gstack-review`
- `$gstack-ship`
- `$gstack-qa`
- `$gstack-plan-ceo-review`
- `$gstack-plan-eng-review`
- `$gstack-plan-design-review`
- `$gstack-design-consultation`
- `$gstack-design-review`
- `$gstack-office-hours`
- `$gstack-debug`
- `$gstack-document-release`
- `$gstack-retro`
- `$gstack-setup-browser-cookies`
- `$gstack-upgrade`

## Browser interaction

When you need to interact with a browser (QA, dogfooding, cookie setup), use the
installed gstack browse skill or run the browse binary directly via `$B <command>`.
Never use `mcp__claude-in-chrome__*` tools in this repo.

## Active install

The active Codex skill lives at `$HOME/.codex/skills/gstack/`. After making changes:

1. Push your branch
2. Refresh the checkout you want Codex to use
3. Re-run `./setup --host codex`
4. Rebuild with `bun run build` if you changed browse code
