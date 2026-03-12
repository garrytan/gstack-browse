# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is gstack

An AI engineering workflow toolkit that turns Claude Code into specialized skills. The core component is a persistent headless Chromium browser daemon accessed via compiled CLI binary. Additional skills (ship, review, plan, retro) are prompt-only SKILL.md files.

## Commands

```bash
bun install              # install dependencies + Playwright Chromium
bun test                 # run all integration tests (~3s)
bun test browse/test/commands    # command integration tests only
bun test browse/test/snapshot    # snapshot tests only
bun test --match "*Navigation*"  # run tests matching a pattern
bun run dev <cmd>        # run CLI from source (no compile step)
bun run build            # compile binary to browse/dist/browse (~58MB)
bun run server           # start server directly (for debugging)
```

## Architecture

**Client-server split**: The browse tool is a thin CLI client (`cli.ts`) that sends HTTP POST requests to a persistent Bun HTTP server (`server.ts`). The server manages Chromium via Playwright.

```
CLI (compiled binary) ──HTTP POST──► Bun server (localhost:9400-9410) ──► Playwright ──► Chromium
```

- State file at `/tmp/browse-server.json` stores PID, port, and bearer token (UUID per session)
- CLI auto-starts server on first call; server auto-shuts down after 30 min idle
- Chromium crash causes server exit; CLI detects and auto-restarts on next call

**Snapshot/ref system**: The key abstraction for web interaction. `snapshot.ts` parses Playwright's accessibility tree (`page.locator().ariaSnapshot()`), assigns `@e1`, `@e2`... refs to elements, and builds a `Map<string, Locator>`. Commands like `click @e3` resolve the ref to a Playwright Locator. Refs are invalidated on navigation.

**Command organization**: Commands are split by mutation semantics:
- `read-commands.ts` — non-mutating (text, html, links, js, css, forms, console, network, etc.)
- `write-commands.ts` — mutating (goto, click, fill, select, scroll, viewport, etc.)
- `meta-commands.ts` — server/tab management (status, stop, restart, tabs, screenshot, pdf, chain, diff)

New commands are registered as routes in `server.ts`.

**Buffers** (`buffers.ts`): Ring buffers (50k cap) capture console messages and network requests in memory, flushed to disk every 1s.

## Skills

Each skill directory contains a `SKILL.md` that Claude discovers. Skills other than browse are prompt-only (no code):
- `ship/` — merge → test → review → version bump → commit → push → PR
- `review/` — two-pass pre-landing review checklist
- `bugfix/` — test-driven bug fixing: discover → reproduce → fix → verify → improve
- `plan-ceo-review/` — founder-mode planning (expansion/hold/reduction scopes)
- `plan-eng-review/` — engineering architecture review with diagrams
- `retro/` — weekly retrospective from commit history

## Adding a new command

1. Add handler in `read-commands.ts` (non-mutating) or `write-commands.ts` (mutating)
2. Register route in `server.ts`
3. Add test in `browse/test/commands.test.ts` with HTML fixture if needed
4. `bun test` then `bun run build`

## Testing

Tests use Bun's native test runner. Integration tests spin up a local HTTP server (`browse/test/test-server.ts`) serving fixtures from `browse/test/fixtures/`, then exercise commands against real Playwright browser instances.

## Deploying changes to the active skill

The active skill lives at `~/.claude/skills/gstack/`. After changes:

```bash
cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main && bun run build
```

Or copy the binary directly: `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`
