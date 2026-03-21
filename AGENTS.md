# AGENTS

Codex contributors can use gstack from this repo without changing the Claude workflow.

## Using gstack in Codex

- Global install: `git clone https://github.com/garrytan/gstack.git ~/.codex/skills/gstack && cd ~/.codex/skills/gstack && ./setup`
- Repo-local dev mode: `bin/dev-setup --host codex`
- Codex invokes gstack skills with `$skill` or `/skills`, not custom slash commands.
- Use `$browse` for browser work. Use `$review`, `$qa`, `$ship`, `$plan-eng-review`, and the rest of the gstack workflows explicitly when they fit the task.

## Working on this repo

- `SKILL.md` files are generated. Edit `*.tmpl`, then run `bun run gen:skill-docs`.
- `bin/dev-setup --host both` enables Claude and Codex against the same working tree.
- `bin/dev-teardown --host both` removes the local symlinks.
- The browse binary is compiled output. Rebuild it with `bun run build`.
- Keep Claude compatibility intact. Codex support in this repo is additive, not a rebrand.
