---
name: mastery-status
version: 1.0.0
description: |
  Project status from Mastery framework docs. Loads project context, finds the
  active feature, reads task progress, and reports where you left off. Use at
  session start to pick up where the last session stopped. Works on any project
  using the Mastery development lifecycle (github.com/RAiWorks/MASTERY.md).
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -delete 2>/dev/null || true
_CONTRIB=$(~/.claude/skills/gstack/bin/gstack-config get gstack_contributor 2>/dev/null || true)
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history or gitStatus), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]`
4. **Options:** Lettered options: `A) ... B) ... C) ...`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Contributor Mode

If `_CONTRIB` is `true`: you are in **contributor mode**. You're a gstack user who also helps make it better.

**At the end of each major workflow step** (not after every single command), reflect on the gstack tooling you used. Rate your experience 0 to 10. If it wasn't a 10, think about why. If there is an obvious, actionable bug OR an insightful, interesting thing that could have been done better by gstack code or skill markdown — file a field report. Maybe our contributor will help make us better!

**Calibration — this is the bar:** For example, `$B js "await fetch(...)"` used to fail with `SyntaxError: await is only valid in async functions` because gstack didn't wrap expressions in async context. Small, but the input was reasonable and gstack should have handled it — that's the kind of thing worth filing. Things less consequential than this, ignore.

**NOT worth filing:** user's app bugs, network errors to user's URL, auth failures on user's site, user's own JS logic bugs.

**To file:** write `~/.gstack/contributor-logs/{slug}.md` with **all sections below** (do not truncate — include every section through the Date/Version footer):

```
# {Title}

Hey gstack team — ran into this while using /{skill-name}:

**What I was trying to do:** {what the user/agent was attempting}
**What happened instead:** {what actually happened}
**My rating:** {0-10} — {one sentence on why it wasn't a 10}

## Steps to reproduce
1. {step}

## Raw output
```
{paste the actual error or unexpected output here}
```

## What would make this a 10
{one sentence: what gstack should have done differently}

**Date:** {YYYY-MM-DD} | **Version:** {gstack version} | **Skill:** /{skill}
```

Slug: lowercase, hyphens, max 60 chars (e.g. `browse-js-no-await`). Skip if file already exists. Max 3 reports per session. File inline and continue — don't stop the workflow. Tell user: "Filed gstack field report: {title}"

# /mastery-status — Project Status from Mastery Docs

You are the project's process brain. Your job: read the project's Mastery docs, figure out exactly where things stand, and give a clear status report so the developer (or another AI agent) can pick up instantly.

## User-invocable
When the user types `/mastery-status`, run this skill.

---

## Step 1: Detect Mastery project

Check if this project uses the Mastery framework:

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
ls "$_ROOT"/docs/project-roadmap.md "$_ROOT"/docs/project-context.md 2>/dev/null
```

**If neither file exists:** This is not a Mastery project. Use AskUserQuestion:

> This project doesn't use the Mastery development framework.
>
> Mastery is a structured lifecycle for building software: Discuss → Design → Plan → Build → Ship → Reflect. It gives AI agents project memory across sessions — so you never start cold.
>
> RECOMMENDATION: Choose A if you want structured project management.
>
> A) Tell me more about Mastery (I'll explain how to set it up)
> B) Skip — I don't need this right now

If A: Explain that Mastery is a single Markdown file they copy into `docs/mastery.md`. Point to `https://github.com/RAiWorks/MASTERY.md` for the framework. Then stop.
If B: Stop.

**If files exist:** Continue to Step 2.

---

## Step 2: Load project context

Read these docs in order. Each one answers a different question:

1. **Read `docs/project-context.md`** — extract:
   - Project name (from the `> **Project**:` line or the `# ` heading)
   - Version (from the `> **Version**:` line, if present)
   - Project type (from the table, if present)

2. **Read `docs/project-roadmap.md`** — extract:
   - All features from the feature table
   - Features marked 🟡 (IN PROGRESS) — these are active
   - Features marked 🔴 (NOT STARTED) — these are next up
   - Overall progress (count ✅ vs total)

3. **If an active feature (🟡) is found**, note its number and name. If multiple 🟡 features exist, list all of them but focus on the lowest-numbered one (it likely has priority).

4. **If no active feature (🟡)**, check for 🔴 NOT STARTED features. The lowest-numbered one is likely next.

---

## Step 3: Load active feature details

If an active feature was found in Step 2, read its docs. The feature folder is at `docs/features/{XX}-{feature-name}/` where `{XX}` is the zero-padded feature number.

```bash
ls "$_ROOT"/docs/features/ | grep "^$(printf '%02d' $FEATURE_NUM)-"
```

Read in this order:

1. **`tasks.md`** — the execution plan:
   - Count total checkboxes: lines matching `- [x]` (done) and `- [ ]` (not done)
   - Find the LAST checked box (`- [x]`) — that's where work stopped
   - Find the FIRST unchecked box (`- [ ]`) after the last checked one — that's the next task
   - Extract the phase name (look for `## Phase` headings)

2. **`changelog.md`** — what happened last:
   - Look for the most recent `### Session Note` block
   - Extract: Who, Stopped At, Next Steps
   - If no session note exists, check for the latest entry (any heading with a date)

3. **`discussion.md`** — check status:
   - Look for `> **Status**:` line — is it COMPLETE or IN PROGRESS?
   - If IN PROGRESS, the feature is still in the Discuss stage

4. **`architecture.md`** — check status:
   - Look for `> **Status**:` line — is it FINALIZED or DRAFT?
   - If DRAFT, the feature is in the Design stage

Determine the **current stage** from what exists and its status:
- Only discussion.md exists (or it's IN PROGRESS) → **Discuss** stage
- architecture.md exists but DRAFT → **Design** stage
- tasks.md exists but no checkboxes checked → **Plan** stage (just entered Build)
- tasks.md has some boxes checked → **Build** stage
- All tasks checked → **Ship** stage (ready for merge)
- review.md exists → **Reflect** stage

---

## Step 4: Check git status

```bash
git branch --show-current
git log --oneline -5
```

Note the current branch and recent commits. If the branch name matches `feature/{XX}-{name}`, confirm it matches the active feature.

If the developer is on `main` but there's an active feature, mention: "You're on main but Feature #{XX} is in progress. Switch to branch `feature/{XX}-{name}` to continue."

---

## Step 5: Output the status report

Format the output like this:

```
━━━ MASTERY STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:          {name} {version if available}
Overall Progress:  {N}/{M} features complete ({percentage}%)

Active Feature:   #{XX} — {feature name}
Branch:           feature/{XX-name}
Stage:            {Discuss|Design|Plan|Build|Ship|Reflect}
Progress:         {checked}/{total} tasks complete

Last Completed:   {task ID} — {task description}
Next Task:        {task ID} — {task description}
Blockers:         {from session note, or "None"}

Last Session:     {date}
  Who:            {who}
  Stopped At:     {task ref}
  Next Steps:     {what they recommended}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If no active feature:**

```
━━━ MASTERY STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:          {name} {version}
Overall Progress:  {N}/{M} features complete ({percentage}%)

No feature currently in progress.

Next up:          #{XX} — {next 🔴 feature name}
                  #{YY} — {another 🔴 feature name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

End with: **"Ready to work. What do you want to tackle?"**

---

## Edge Cases

- **Multiple 🟡 features**: List all, focus report on lowest-numbered. Mention: "Note: {N} features are in progress simultaneously."
- **No project-context.md but roadmap exists**: Still works — skip project name/version, report features only.
- **Empty tasks.md or no checkboxes**: Report "Tasks doc exists but has no checkboxes yet — feature may still be in planning."
- **No changelog.md or no session notes**: Report "No previous session notes found."
- **Feature folder doesn't match expected naming**: Try fuzzy match on the feature number prefix.
- **docs/ is at a non-standard location**: Check both `docs/` and `doc/` relative to git root.
