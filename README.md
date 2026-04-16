# cavestack

> **cavestack** is a fork of [gstack](https://github.com/garrytan/gstack) that shuts up by default. Every AI coding tool ships verbose, then makes terseness an opt-in flag you have to remember. cavestack flips it. Terse is what you get. Verbose is the opt-in.

![same /review, same patch, different default](docs/images/sidebyside-review.png)

*Left: gstack `/review` on a 24-line patch. Right: cavestack `/review` on the same patch, with [caveman](https://github.com/JuliusBrussee/caveman) wired into the SessionStart hook.*

## Install (30 seconds)

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/), and Git.

```bash
git clone https://github.com/JerkyJesse/cavestack.git ~/.claude/skills/cavestack
cd ~/.claude/skills/cavestack && ./setup
```

That's it. Open a new Claude Code session anywhere. The first response lands in caveman mode automatically, no `/caveman` needed.

## What you get

- Every [gstack](https://github.com/garrytan/gstack) skill — `/review`, `/ship`, `/qa`, `/investigate`, `/office-hours`, `/cso`, 40 total — with the same command names, so there's no muscle-memory break if you're migrating from upstream.
- [caveman](https://github.com/JuliusBrussee/caveman) grafted into `~/.claude/settings.json` as `SessionStart` + `UserPromptSubmit` hooks. Default mode is `full`. Toggle per session with `/caveman lite`, `/caveman ultra`, or `stop caveman`.
- A Windows-first install path. bun binaries compile, setup symlinks work under Git Bash, and the statusline script is PowerShell-aware.
- Fully reversible — `~/.claude/skills/cavestack/bin/cavestack-uninstall` cleans up skills, hooks, and state.

## Why a fork instead of a plugin

Because default behavior wins. Every opt-in terseness workaround — `/caveman` as a plugin command, `be terse` in CLAUDE.md, hand-written system prompts — requires the user to remember to activate it on every session. They don't. So the tool stays verbose. So the senior eng closes the window and goes back to grepping. The only way to change the default is to fork the framework and ship terseness as the baseline.

Also: running gstack + caveman as two separate pieces is fine until you want caveman to fire *before* the first prompt of a new session. That requires a SessionStart hook owned by the install. A fork can own that. A plugin next to a fork cannot.

## Credit

cavestack is a personal fork. All substantive skill content and build tooling is upstream gstack by [Garry Tan](https://github.com/garrytan), and the caveman hooks + activation logic are vendored from [Julius Brussee](https://github.com/JuliusBrussee)'s [caveman](https://github.com/JuliusBrussee/caveman). Both MIT. This fork adds the always-on wiring and a Windows-first install path, nothing more.

Upstream remote is kept as `upstream`, so `git fetch upstream && git merge upstream/main` pulls in gstack changes. Expect conflicts on every branding string — that's the cost of a rebrand.

## Uninstall

```bash
~/.claude/skills/cavestack/bin/cavestack-uninstall
```

Removes the symlinks, the caveman hooks, and `~/.cavestack/` state. Your project files are untouched.

## Troubleshooting

**Skill not showing up?** `cd ~/.claude/skills/cavestack && ./setup`

**`/browse` fails?** `cd ~/.claude/skills/cavestack && bun install && bun run build`

**Stale install?** Run `/cavestack-upgrade` — or set `auto_upgrade: true` in `~/.cavestack/config.yaml`.

**Caveman not firing on new sessions?** Check that `~/.claude/settings.json` has both a `hooks.SessionStart` entry pointing at `caveman-activate.js` and a `hooks.UserPromptSubmit` entry pointing at `caveman-mode-tracker.js`. Re-register with `~/.claude/skills/cavestack/bin/cavestack-settings-hook install-caveman`. Verify Node.js is on PATH (`node --version`) — the hooks run under Node, not Bun.

**Want to stop caveman for one session?** Type `stop caveman` or `normal mode`. Turn it back on with `/caveman` (default `full`) or pick an intensity: `/caveman lite`, `/caveman ultra`.

**Permanently disable caveman?** `~/.claude/skills/cavestack/bin/cavestack-settings-hook remove-caveman` removes the two entries from `settings.json` and writes a `.backup`. cavestack still works without caveman — you just get verbose default output again.

**Want shorter commands?** They're already short. cavestack ships with `skill_prefix: false` by default, so `/qa`, `/ship`, `/review` etc. have the same names as upstream gstack. No muscle-memory break on migration.

**Want namespaced commands to avoid collision with another skill pack?** `cd ~/.claude/skills/cavestack && ./setup --prefix` — switches from `/qa` to `/cavestack-qa`. Your choice is remembered for future upgrades.

**Codex says "Skipped loading skill(s) due to invalid SKILL.md"?** Your Codex skill descriptions are stale. Fix: `cd ~/.codex/skills/cavestack && git pull && ./setup --host codex` — or for repo-local installs: `cd "$(readlink -f .agents/skills/cavestack)" && git pull && ./setup --host codex`.

**Windows users:** cavestack runs on Windows 10/11 via Git Bash or WSL. Both `bun` and `node` must be on PATH — Bun has a known bug with Playwright's pipe transport on Windows ([bun#4253](https://github.com/oven-sh/bun/issues/4253)), so `browse` falls back to Node.js for its server.

**`./setup` fails on `bun run build` with "cannot write multiple output files without an output directory"?** Known upstream issue in `browse/scripts/build-node-server.sh` on Windows Git Bash — a glob pattern resolves to multiple files without an `--outdir` flag. The primary compiled binaries (`browse.exe`, `find-browse.exe`, `design.exe`, `cavestack-global-discover.exe`) still build successfully; only the Node-compat server bundle fails. Non-blocking for most workflows. Workaround: run individual `bun build` commands manually, or use `msedge --headless` for browser automation until the upstream fix lands.

**Claude says it can't see the skills?** Make sure your project's `CLAUDE.md` has a cavestack section. The `/office-hours` skill can add one for you automatically (it prompts on first run). Or add this manually:

```
## cavestack
Use /browse from cavestack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-cavestack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex,
/cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /cavestack-upgrade,
/learn, /caveman, /caveman-commit, /caveman-review, /caveman-help.
```

**Hitting a bug not listed here?** Open an issue at [github.com/JerkyJesse/cavestack/issues](https://github.com/JerkyJesse/cavestack/issues) with your OS, bun version (`bun --version`), node version (`node --version`), and the exact error output. If the bug reproduces on upstream gstack too, upstream it to [garrytan/gstack](https://github.com/garrytan/gstack/issues) — cavestack is a thin fork, most bugs live there.

## License

MIT. See [LICENSE](LICENSE) — which preserves Garry Tan (gstack), Julius Brussee (caveman), and JerkyJesse (cavestack fork modifications) attribution.
