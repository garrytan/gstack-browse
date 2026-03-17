## Summary

- add Codex as a first-class gstack host without duplicating workflow logic
- generate `.agents/skills/gstack*/SKILL.md` from the same `.tmpl` templates as Claude
- make setup, browse discovery, tests, CI, and docs understand both Claude and Codex installs
- add Codex-facing repo docs (`AGENTS.md`, `agents/openai.yaml`) and generated support links under `.agents/skills/gstack`

## What Changed

- `scripts/gen-skill-docs.ts`
  - adds `--host codex`
  - routes Codex output into `.agents/skills/`
  - injects Codex frontmatter (`name`, `description`)
  - keeps shared resolvers host-aware
  - rewrites skill invocation syntax to `$gstack-*` for Codex
- shared templates
  - replace hardcoded helper-doc paths with minimal placeholders (`{{SKILL_ROOT}}`, `{{LOCAL_SKILL_ROOT}}`, `{{REVIEW_ROOT}}`)
  - keep one template source for both hosts
- install/runtime
  - `setup` now supports `--host claude|codex|auto`
  - `bin/dev-setup` and `bin/dev-teardown` cover the Codex support tree alongside Claude dev mode
  - `browse/src/find-browse.ts` checks `.agents` before `.claude`
- quality gates
  - extend tests for Codex freshness/frontmatter/path safety
  - run Codex dry-run generation in CI
- docs
  - add `AGENTS.md`
  - add `agents/openai.yaml`
  - update README/CONTRIBUTING for dual-host development
  - add user-facing CHANGELOG entry for Codex support

## Testing

```bash
bash -n setup bin/dev-setup bin/dev-teardown
bun test
bun run gen:skill-docs --dry-run
bun run gen:skill-docs --host codex --dry-run
bun run skill:check
TMP_HOME=$(mktemp -d)
HOME="$TMP_HOME" ./setup --host codex
HOME="$TMP_HOME" "$TMP_HOME/.agents/skills/gstack/setup" --host codex
```

## Pre-Landing Review

Pre-Landing Review: No issues found.

## Notes

- Codex skills are generated only. Do not hand-edit `.agents/skills/*/SKILL.md`.
- Codex-generated markdown intentionally contains no `.claude/skills` paths.
- The root Codex skill directory includes support symlinks (`bin`, `browse`, `review`, `setup`, etc.) so helper-doc lookups and browse setup work after `./setup --host codex`.
