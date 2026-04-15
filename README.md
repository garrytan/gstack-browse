# jstack

> **jstack** is a fork of [gstack](https://github.com/garrytan/gstack) that shuts up by default. Every AI coding tool ships verbose, then makes terseness an opt-in flag you have to remember. jstack flips it. Terse is what you get. Verbose is the opt-in.

![same /review, same patch, different default](docs/images/sidebyside-review.png)

*Left: gstack `/review` on a 24-line patch. Right: jstack `/review` on the same patch, with [caveman](https://github.com/JuliusBrussee/caveman) wired into the SessionStart hook.*

## Install (30 seconds)

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/), and Git.

```bash
git clone https://github.com/JerkyJesse/jstack.git ~/.claude/skills/jstack
cd ~/.claude/skills/jstack && ./setup
```

That's it. Open a new Claude Code session anywhere. The first response lands in caveman mode automatically, no `/caveman` needed.

## What you get

- Every [gstack](https://github.com/garrytan/gstack) skill — `/review`, `/ship`, `/qa`, `/investigate`, `/office-hours`, `/cso`, 40 total — with the same command names, so there's no muscle-memory break if you're migrating from upstream.
- [caveman](https://github.com/JuliusBrussee/caveman) grafted into `~/.claude/settings.json` as `SessionStart` + `UserPromptSubmit` hooks. Default mode is `full`. Toggle per session with `/caveman lite`, `/caveman ultra`, or `stop caveman`.
- A Windows-first install path. bun binaries compile, setup symlinks work under Git Bash, and the statusline script is PowerShell-aware.
- Fully reversible — `~/.claude/skills/jstack/bin/jstack-uninstall` cleans up skills, hooks, and state.

## Why a fork instead of a plugin

Because default behavior wins. Every opt-in terseness workaround — `/caveman` as a plugin command, `be terse` in CLAUDE.md, hand-written system prompts — requires the user to remember to activate it on every session. They don't. So the tool stays verbose. So the senior eng closes the window and goes back to grepping. The only way to change the default is to fork the framework and ship terseness as the baseline.

Also: running gstack + caveman as two separate pieces is fine until you want caveman to fire *before* the first prompt of a new session. That requires a SessionStart hook owned by the install. A fork can own that. A plugin next to a fork cannot.

## Credit

jstack is a personal fork. All substantive skill content and build tooling is upstream gstack by [Garry Tan](https://github.com/garrytan), and the caveman hooks + activation logic are vendored from [Julius Brussee](https://github.com/JuliusBrussee)'s [caveman](https://github.com/JuliusBrussee/caveman). Both MIT. This fork adds the always-on wiring and a Windows-first install path, nothing more.

Upstream remote is kept as `upstream`, so `git fetch upstream && git merge upstream/main` pulls in gstack changes. Expect conflicts on every branding string — that's the cost of a rebrand.

## Uninstall

```bash
~/.claude/skills/jstack/bin/jstack-uninstall
```

Removes the symlinks, the caveman hooks, and `~/.jstack/` state. Your project files are untouched.

## License

MIT. See [LICENSE](LICENSE) — which preserves Garry Tan (gstack), Julius Brussee (caveman), and JerkyJesse (jstack fork modifications) attribution.
