# Changelog

## 0.0.2 — 2026-03-12

### Changed

- Reworked `/browse` daemon lifecycle so `stop` and `restart` complete cleanly, serialize startup, and persist user-agent changes across restarts.
- Switched snapshot refs from global live locators to tab-local frozen element handles so refs fail stale instead of drifting across tabs or SPA rerenders.
- Updated network capture to track requests by Playwright request identity and report response size/timing without loading response bodies into memory.

### Fixed

- `browse cookie` now supports an explicit origin before first navigation and returns clear guidance on `about:blank`.
- `browse fill` and `browse select` now accept explicit empty-string values.
- Snapshot parsing now preserves accessible names containing escaped quotes.
- Added regression coverage for lifecycle, ref safety, cookie semantics, empty values, quoted names, and same-URL network attribution.

## 0.0.1 — 2026-03-11

Initial release.

- Five skills: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/browse`
- Headless browser CLI with 40+ commands, ref-based interaction, persistent Chromium daemon
- One-command install as Claude Code skills (submodule or global clone)
- `setup` script for binary compilation and skill symlinking
