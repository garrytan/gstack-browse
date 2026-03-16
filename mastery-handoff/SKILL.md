---
name: mastery-handoff
version: 1.0.0
description: |
  Write a session handoff note for a Mastery project. Logs what you worked on,
  where you stopped, and what the next session should pick up. Ensures no
  context is lost between sessions — human-to-AI, AI-to-AI, or AI-to-human.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
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

# /mastery-handoff — Session Handoff Note

You are the session closer. Your job: capture everything that happened in this session so the next person (or AI) can pick up instantly without re-reading the whole codebase.

## User-invocable
When the user types `/mastery-handoff`, run this skill.

---

## Step 1: Verify this is a Mastery project

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
ls "$_ROOT"/docs/project-roadmap.md 2>/dev/null
```

**If not a Mastery project:** Tell user: "This project doesn't use the Mastery framework. A handoff note requires Mastery docs to update. Run `/mastery-init` to set up Mastery first." Stop.

**If Mastery exists:** Continue.

---

## Step 2: Gather session context

Collect what happened this session. Read in parallel:

```bash
git branch --show-current
git log --oneline -20
git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat HEAD
```

Read `docs/project-roadmap.md` — find features marked 🟡 IN PROGRESS.

If an active feature (🟡) is found:
- Note the feature number and name
- Read `docs/features/{XX}-{name}/tasks.md` — count checked/unchecked boxes
- Read `docs/features/{XX}-{name}/changelog.md` — find the most recent session note for context

---

## Step 3: Ask about the session

Use AskUserQuestion:

> I'm writing your session handoff note. Let me confirm what happened:
>
> **Branch**: {current branch}
> **Recent commits**: {last 5 commit messages}
> **Active feature**: #{XX} — {name} ({checked}/{total} tasks done)
>
> Quick questions:
> 1. What did you work on this session? (I'll fill in from commits if you say "auto")
> 2. Where exactly did you stop? (task ID, or describe what's half-done)
> 3. Any blockers or things the next session needs to know?
> 4. What should the next session do first?
>
> RECOMMENDATION: Say "auto" and I'll draft it from git history. You can edit after.

**If user says "auto":**
- Infer "Worked On" from commit messages
- Infer "Stopped At" from the last checked task in tasks.md + any uncommitted changes
- Set "Blockers" to "None" unless git shows merge conflicts or failing tests
- Infer "Next Steps" from the first unchecked task in tasks.md

**If user provides details:** Use their input directly.

---

## Step 4: Update task checkboxes

Read `docs/features/{XX}-{name}/tasks.md`.

Compare the checked boxes against what was actually done (from commits and file changes). If tasks were completed but not checked off:

Use AskUserQuestion:

> I found tasks that look completed but aren't checked off:
>
> {list of tasks with evidence}
>
> RECOMMENDATION: Choose A to check them off.
>
> A) Check them all off
> B) Let me pick which ones to check
> C) Don't touch the tasks doc

If A or B: Use Edit tool to update the checkboxes in tasks.md.

If no discrepancies found, skip this step silently.

---

## Step 5: Write the session note

Add a session note to `docs/features/{XX}-{name}/changelog.md`. Use Edit tool to insert at the top of the file (after the heading).

Format:

```markdown
### Session Note — {YYYY-MM-DD}
- **Who**: {from AskUserQuestion or infer from git author}
- **Duration**: {approximate or "~1 session"}
- **Worked On**: {what was done}
- **Stopped At**: {exact task ID and description, or "between X and Y"}
- **Blockers**: {any blockers, or "None"}
- **Next Steps**: {what the next session should do first}
```

If the feature doesn't have a changelog.md yet, create one with the session note.

---

## Step 6: Commit the handoff

```bash
cd "$_ROOT"
git add docs/features/$(printf '%02d' $FEATURE_NUM)-*/changelog.md
git add docs/features/$(printf '%02d' $FEATURE_NUM)-*/tasks.md
git diff --cached --stat
```

Use AskUserQuestion:

> Session handoff note written. Here's what I'm committing:
>
> {show git diff --cached --stat}
>
> RECOMMENDATION: Choose A to commit and push.
>
> A) Commit and push (`docs: session handoff for feature #{XX}`)
> B) Let me review the changelog first
> C) Don't commit — I'll do it manually

If A:
```bash
git commit -m "docs(feature-{XX}): session handoff — stopped at {task ID}"
git push
```

If B: Open the changelog file for review. Wait for user to confirm.
If C: Stop.

---

## Output

```
━━━ SESSION HANDOFF ━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature:     #{XX} — {name}
Branch:      {branch}
Progress:    {checked}/{total} tasks ({percentage}%)

Stopped At:  {task ID} — {description}
Next:        {task ID} — {description}
Blockers:    {blockers or "None"}

Handoff committed and pushed.
Next session: read changelog.md to pick up where you left off.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Edge Cases

- **No active feature**: If no 🟡 feature exists, write a general project-level session note to `docs/project-changelog.md` instead of a feature changelog.
- **Multiple active features**: Ask which feature the handoff is for. Write one note per feature if user worked on multiple.
- **No commits this session**: That's fine — the user might have been reviewing/discussing. "Worked On: Review and planning (no commits)" is valid.
- **Uncommitted changes**: Warn: "You have uncommitted changes. Want to commit them before the handoff note?" Show `git status`.
- **Merge conflicts**: Flag as a blocker: "Blockers: Merge conflict in {files} — resolve before continuing."
- **User doesn't know task IDs**: Show them the tasks list and let them pick, or infer from the last commit message.
