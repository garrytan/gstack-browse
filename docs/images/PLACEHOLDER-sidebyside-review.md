# docs/images/sidebyside-review.png — placeholder

This file is a placeholder. The actual PNG does not exist yet.

**To produce it (30-minute gate check from design doc):**

1. A test workspace is already prepped at `/tmp/jstack-compare/`:
   - `/tmp/jstack-compare/gstack-repo/` — git repo with `sample.py` on baseline commit + a 24-line uncommitted modification introducing 4 realistic bugs.
   - `/tmp/jstack-compare/jstack-repo/` — identical setup.
   - `/tmp/jstack-compare/baseline.py` — the clean baseline file.
   - `/tmp/jstack-compare/sample_modified.py` — the modified file with the bugs.
2. Install a fresh gstack into an isolated home so it doesn't collide with the current jstack install:
   ```
   git clone --depth 1 https://github.com/garrytan/gstack.git /tmp/jstack-compare/gstack
   cd /tmp/jstack-compare/gstack
   HOME=/tmp/jstack-compare/gstack-home ./setup --host claude --no-team
   ```
3. Open **Windows Terminal at 120 columns, default theme, default font**.
4. `cd /tmp/jstack-compare/gstack-repo` and run `/review` from the vanilla gstack session (open Claude Code with `HOME=/tmp/jstack-compare/gstack-home`). Capture the output with Win+Shift+S → save as `docs/images/gstack-review.png`.
5. Open a **new Claude Code session** in the same Windows Terminal (caveman SessionStart hook fires, default mode = full).
6. `cd /tmp/jstack-compare/jstack-repo` and run `/review`. Capture with Win+Shift+S → save as `docs/images/jstack-review.png`.
7. **Gate check:** put both PNGs on screen side by side. Are the line counts visibly different at a glance?
   - **Yes → proceed.** Compose the final `sidebyside-review.png` in any image editor (Paint, Paint.NET, GIMP, Word — place the two PNGs horizontally with a 1px black border between, add labels "gstack /review" and "jstack /review — default terse" at the top). Save into this directory as `sidebyside-review.png` and delete this placeholder file.
   - **No → STOP.** Premise P1 (default-terse is the whole pitch) is falsified. Do not push launch-v0.1 to main. Reconsider the fork's positioning per the design doc's Kill Conditions section.

Source design doc: `C:\Users\jerky\.jstack\projects\jstack\JerkyJesse-main-design-20260414-203757.md`.
