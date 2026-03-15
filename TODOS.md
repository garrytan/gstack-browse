# TODOS

## Auto-upgrade mode (zero-prompt)

**What:** Add a `GSTACK_AUTO_UPGRADE=1` env var or `~/.gstack/config` option that skips the AskUserQuestion prompt and upgrades automatically when a new version is detected.

**Why:** Power users and CI environments may want zero-friction upgrades without being asked every time.

**Context:** The current upgrade system (v0.3.4) always prompts via AskUserQuestion. This TODO adds an opt-in bypass. Implementation is ~10 lines in the preamble instructions: check for the env var/config before calling AskUserQuestion, and if set, go straight to the upgrade flow. Depends on the full upgrade system being stable first — wait for user feedback on the prompt-based flow before adding this.

**Effort:** S (small)
**Priority:** P3 (nice-to-have, revisit after adoption data)

## Convert remaining skills to .tmpl files

**What:** Convert ship/, review/, plan-ceo-review/, plan-eng-review/, retro/ SKILL.md files to .tmpl templates using the `{{UPDATE_CHECK}}` placeholder.

**Why:** These 5 skills still have the update check preamble copy-pasted. When the preamble changes (like the `|| true` fix in v0.3.5), all 5 need manual updates. The `{{UPDATE_CHECK}}` resolver already exists in `scripts/gen-skill-docs.ts` — these skills just need to be converted.

**Context:** The browse-using skills (SKILL.md, browse/, qa/, setup-browser-cookies/) were converted to .tmpl in v0.3.5. The remaining 5 skills only use `{{UPDATE_CHECK}}` (no `{{BROWSE_SETUP}}`), so the conversion is mechanical: replace the preamble with `{{UPDATE_CHECK}}`, add the path to `findTemplates()` in `scripts/gen-skill-docs.ts`, and commit both .tmpl + generated .md.

**Depends on:** v0.3.5 shipping first (the `{{UPDATE_CHECK}}` resolver).
**Effort:** S (small, ~20 min)
**Priority:** P2 (prevents drift on next preamble change)
