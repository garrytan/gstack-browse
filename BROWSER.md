# Browser — technical details

This document covers the command reference and internals of gstack's headless browser.

## Command reference

| Category | Commands | What for |
|----------|----------|----------|
| Navigate | `goto`, `back`, `forward`, `reload`, `url` | Get to a page |
| Read | `text`, `html`, `links`, `forms`, `accessibility` | Extract content |
| Snapshot | `snapshot [-i] [-c] [-d N] [-s sel] [-D] [-a] [-o] [-C]` | Get refs, diff, annotate |
| Interact | `click`, `fill`, `select`, `hover`, `type`, `press`, `scroll`, `wait`, `viewport`, `upload` | Use the page |
| Inspect | `js`, `eval`, `css`, `attrs`, `is`, `console`, `network`, `dialog`, `cookies`, `storage`, `perf` | Debug and verify |
| Visual | `screenshot`, `pdf`, `responsive` | See what Claude sees |
| Compare | `diff <url1> <url2>` | Spot differences between environments |
| Dialogs | `dialog-accept [text]`, `dialog-dismiss` | Control alert/confirm/prompt handling |
| Tabs | `tabs`, `tab`, `newtab`, `closetab` | Multi-page workflows |
| Cookies | `cookie-import`, `cookie-import-browser` | Import cookies from file or real browser |
| Multi-step | `chain` (JSON from stdin) | Batch commands in one call |

All selector arguments accept CSS selectors, `@e` refs after `snapshot`, or `@c` refs after `snapshot -C`. 50+ commands total plus cookie import.

## How it works

gstack's browser is a compiled CLI binary that talks to a persistent local Chromium daemon over HTTP. The CLI is a thin client — it reads a state file, sends a command, and prints the response to stdout. The server does the real work via [Playwright](https://playwright.dev/).

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code                                                    │
│                                                                 │
│  "browse goto https://staging.myapp.com"                        │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP POST     ┌──────────────┐                 │
│  │ browse   │ ──────────────── │ Bun HTTP     │                 │
│  │ CLI      │  localhost:rand  │ server       │                 │
│  │          │  Bearer token    │              │                 │
│  │ compiled │ ◄──────────────  │  Playwright  │──── Chromium    │
│  │ binary   │  plain text      │  API calls   │    (headless)   │
│  └──────────┘                  └──────────────┘                 │
│   ~1ms startup                  persistent daemon               │
│                                 auto-starts on first call       │
│                                 auto-stops after 30 min idle    │
└─────────────────────────────────────────────────────────────────┘
```

### Lifecycle

1. **First call**: CLI checks `.gstack/browse.json` (in the project root) for a running server. None found — it spawns `bun run browse/src/server.ts` in the background. The server launches headless Chromium via Playwright, picks a random port (10000-60000), generates a bearer token, writes the state file, and starts accepting HTTP requests. This takes ~3 seconds.

2. **Subsequent calls**: CLI reads the state file, sends an HTTP POST with the bearer token, prints the response. ~100-200ms round trip.

3. **Idle shutdown**: After 30 minutes with no commands, the server shuts down and cleans up the state file. Next call restarts it automatically.

4. **Crash recovery**: If Chromium crashes, the server exits immediately (no self-healing — don't hide failure). The CLI detects the dead server on the next call and starts a fresh one.

### Key components

```
browse/
├── src/
│   ├── cli.ts              # Thin client — reads state file, sends HTTP, prints response
│   ├── server.ts           # Bun.serve HTTP server — routes commands to Playwright
│   ├── browser-manager.ts  # Chromium lifecycle — launch, tabs, ref map, crash handling
│   ├── snapshot.ts         # Accessibility tree → @ref assignment → Locator map + diff/annotate/-C
│   ├── read-commands.ts    # Non-mutating commands (text, html, links, js, css, is, dialog, etc.)
│   ├── write-commands.ts   # Mutating commands (click, fill, select, upload, dialog-accept, etc.)
│   ├── meta-commands.ts    # Server management, chain, diff, snapshot routing
│   ├── cookie-import-browser.ts  # Decrypt + import cookies from real Chromium browsers
│   ├── cookie-picker-routes.ts   # HTTP routes for interactive cookie picker UI
│   ├── cookie-picker-ui.ts       # Self-contained HTML/CSS/JS for cookie picker
│   └── buffers.ts          # CircularBuffer<T> + console/network/dialog capture
├── test/                   # Integration tests + HTML fixtures
└── dist/
    └── browse              # Compiled binary (~58MB, Bun --compile)
```

### The snapshot system

The browser's key innovation is ref-based element selection, built on Playwright's accessibility tree API:

1. `page.locator(scope).ariaSnapshot()` returns a YAML-like accessibility tree
2. The snapshot parser assigns refs (`@e1`, `@e2`, ...) to each element
3. For each ref, it builds a Playwright `Locator` (using `getByRole` + nth-child)
4. The ref-to-Locator map is stored on `BrowserManager`
5. Later commands like `click @e3` look up the Locator and call `locator.click()`

No DOM mutation. No injected scripts. Just Playwright's native accessibility API.

**Extended snapshot features:**
- `--diff` (`-D`): Stores each snapshot as a baseline. On the next `-D` call, returns a unified diff showing what changed. Use this to verify that an action (click, fill, etc.) actually worked.
- `--annotate` (`-a`): Injects temporary overlay divs at each ref's bounding box, takes a screenshot with ref labels visible, then removes the overlays. Use `-o <path>` to control the output path.
- `--cursor-interactive` (`-C`): Scans for non-ARIA interactive elements (divs with `cursor:pointer`, `onclick`, `tabindex>=0`) using `page.evaluate`. Assigns `@c1`, `@c2`... refs with deterministic `nth-child` CSS selectors. These are elements the ARIA tree misses but users can still click.

### Authentication

Each server session generates a random UUID as a bearer token. The token is written to the state file (`.gstack/browse.json`) with chmod 600. Every HTTP request must include `Authorization: Bearer <token>`. This prevents other processes on the machine from controlling the browser.

### Console, network, and dialog capture

The server hooks into Playwright's `page.on('console')`, `page.on('response')`, and `page.on('dialog')` events. All entries are kept in O(1) circular buffers (50,000 capacity each) and flushed to disk asynchronously via `Bun.write()`:

- Console: `.gstack/browse-console.log`
- Network: `.gstack/browse-network.log`
- Dialog: `.gstack/browse-dialog.log`

The `console`, `network`, and `dialog` commands read from the in-memory buffers, not disk.

### Dialog handling

Dialogs (alert, confirm, prompt) are auto-accepted by default to prevent browser lockup. The `dialog-accept` and `dialog-dismiss` commands control this behavior. For prompts, `dialog-accept <text>` provides the response text. All dialogs are logged to the dialog buffer with type, message, and action taken.

### Multi-workspace support

Each workspace gets its own isolated browser instance with its own Chromium process, tabs, cookies, and logs. State is stored in `.gstack/` inside the project root (detected via `git rev-parse --show-toplevel`).

| Workspace | State file | Port |
|-----------|------------|------|
| `/code/project-a` | `/code/project-a/.gstack/browse.json` | random (10000-60000) |
| `/code/project-b` | `/code/project-b/.gstack/browse.json` | random (10000-60000) |

No port collisions. No shared state. Each project is fully isolated.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSE_PORT` | 0 (random 10000-60000) | Fixed port for the HTTP server (debug override) |
| `BROWSE_IDLE_TIMEOUT` | 1800000 (30 min) | Idle shutdown timeout in ms |
| `BROWSE_STATE_FILE` | `.gstack/browse.json` | Path to state file (CLI passes to server) |
| `BROWSE_SERVER_SCRIPT` | auto-detected | Path to server.ts |

### Performance

| Tool | First call | Subsequent calls | Context overhead per call |
|------|-----------|-----------------|--------------------------|
| Chrome MCP | ~5s | ~2-5s | ~2000 tokens (schema + protocol) |
| Playwright MCP | ~3s | ~1-3s | ~1500 tokens (schema + protocol) |
| **gstack browse** | **~3s** | **~100-200ms** | **0 tokens** (plain text stdout) |

The context overhead difference compounds fast. In a 20-command browser session, MCP tools burn 30,000-40,000 tokens on protocol framing alone. gstack burns zero.

### Why CLI over MCP?

MCP (Model Context Protocol) works well for remote services, but for local browser automation it adds pure overhead:

- **Context bloat**: every MCP call includes full JSON schemas and protocol framing. A simple "get the page text" costs 10x more context tokens than it should.
- **Connection fragility**: persistent WebSocket/stdio connections drop and fail to reconnect.
- **Unnecessary abstraction**: Claude Code already has a Bash tool. A CLI that prints to stdout is the simplest possible interface.

gstack skips all of this. Compiled binary. Plain text in, plain text out. No protocol. No schema. No connection management.

## Acknowledgments

The browser automation layer is built on [Playwright](https://playwright.dev/) by Microsoft. Playwright's accessibility tree API, locator system, and headless Chromium management are what make ref-based interaction possible. The snapshot system — assigning `@ref` labels to accessibility tree nodes and mapping them back to Playwright Locators — is built entirely on top of Playwright's primitives. Thank you to the Playwright team for building such a solid foundation.

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Playwright's Chromium (installed automatically by `bun install`)

### Quick start

```bash
bun install              # install dependencies + Playwright Chromium
bun test                 # run integration tests (~3s)
bun run dev <cmd>        # run CLI from source (no compile)
bun run build            # compile to browse/dist/browse
```

### Dev mode vs compiled binary

During development, use `bun run dev` instead of the compiled binary. It runs `browse/src/cli.ts` directly with Bun, so you get instant feedback without a compile step:

```bash
bun run dev goto https://example.com
bun run dev text
bun run dev snapshot -i
bun run dev click @e3
```

The compiled binary (`bun run build`) is only needed for distribution. It produces a single ~58MB executable at `browse/dist/browse` using Bun's `--compile` flag.

### Running tests

```bash
bun test                         # run all tests
bun test browse/test/commands              # run command integration tests only
bun test browse/test/snapshot              # run snapshot tests only
bun test browse/test/cookie-import-browser # run cookie import unit tests only
```

Tests spin up a local HTTP server (`browse/test/test-server.ts`) serving HTML fixtures from `browse/test/fixtures/`, then exercise the CLI commands against those pages. 203 tests across 3 files, ~15 seconds total.

### Source map

| File | Role |
|------|------|
| `browse/src/cli.ts` | Entry point. Reads `.gstack/browse.json`, sends HTTP to the server, prints response. |
| `browse/src/server.ts` | Bun HTTP server. Routes commands to the right handler. Manages idle timeout. |
| `browse/src/browser-manager.ts` | Chromium lifecycle — launch, tab management, ref map, crash detection. |
| `browse/src/snapshot.ts` | Parses accessibility tree, assigns `@e`/`@c` refs, builds Locator map. Handles `--diff`, `--annotate`, `-C`. |
| `browse/src/read-commands.ts` | Non-mutating commands: `text`, `html`, `links`, `js`, `css`, `is`, `dialog`, `forms`, etc. Exports `getCleanText()`. |
| `browse/src/write-commands.ts` | Mutating commands: `goto`, `click`, `fill`, `upload`, `dialog-accept`, `useragent` (with context recreation), etc. |
| `browse/src/meta-commands.ts` | Server management, chain routing, diff (DRY via `getCleanText`), snapshot delegation. |
| `browse/src/cookie-import-browser.ts` | Decrypt Chromium cookies via macOS Keychain + PBKDF2/AES-128-CBC. Auto-detects installed browsers. |
| `browse/src/cookie-picker-routes.ts` | HTTP routes for `/cookie-picker/*` — browser list, domain search, import, remove. |
| `browse/src/cookie-picker-ui.ts` | Self-contained HTML generator for the interactive cookie picker (dark theme, no frameworks). |
| `browse/src/buffers.ts` | `CircularBuffer<T>` (O(1) ring buffer) + console/network/dialog capture with async disk flush. |

### Deploying to the active skill

The active skill lives at `~/.claude/skills/gstack/`. After making changes:

1. Push your branch
2. Pull in the skill directory: `cd ~/.claude/skills/gstack && git pull`
3. Rebuild: `cd ~/.claude/skills/gstack && bun run build`

Or copy the binary directly: `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`

### Adding a new command

1. Add the handler in `read-commands.ts` (non-mutating) or `write-commands.ts` (mutating)
2. Register the route in `server.ts`
3. Add a test case in `browse/test/commands.test.ts` with an HTML fixture if needed
4. Run `bun test` to verify
5. Run `bun run build` to compile
