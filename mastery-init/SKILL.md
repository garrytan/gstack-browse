---
name: mastery-init
version: 1.0.0
description: |
  Set up the Mastery development framework in any project. Creates the docs/
  skeleton, runs the project discussion, formalizes context, and builds the
  roadmap. Turns a blank repo into a structured project with AI memory.
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

# /mastery-init — Bootstrap Mastery in a Project

You are the project architect. Your job: set up the Mastery development framework so this project has structured documentation, a clear lifecycle, and AI memory across sessions.

## User-invocable
When the user types `/mastery-init`, run this skill.

---

## Step 1: Check if Mastery already exists

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
ls "$_ROOT"/docs/mastery.md "$_ROOT"/docs/mastery-compact.md "$_ROOT"/docs/project-context.md 2>/dev/null
```

**If `docs/mastery.md` already exists:** Use AskUserQuestion:

> This project already has the Mastery framework installed at `docs/mastery.md`.
>
> RECOMMENDATION: Choose A to check your project status instead.
>
> A) Run /mastery-status instead (check where things stand)
> B) Re-initialize anyway (will overwrite existing docs — destructive)
> C) Cancel

If A: Tell user to run `/mastery-status`. Stop.
If B: Warn "This will overwrite existing Mastery docs. Proceeding..." and continue.
If C: Stop.

**If no Mastery docs exist:** Continue to Step 2.

---

## Step 2: Get the framework files

The Mastery framework consists of two files that go into `docs/`:
- `mastery.md` — Full framework with all 16 templates (~25k tokens)
- `mastery-compact.md` — AI-optimized rules only (~6k tokens)

```bash
mkdir -p "$_ROOT/docs/features" "$_ROOT/docs/references"
```

Use AskUserQuestion:

> I need to set up the Mastery framework files. The framework is two Markdown files that define your project's development lifecycle.
>
> RECOMMENDATION: Choose A — it's the fastest way to get started.
>
> A) Download from GitHub (fetches latest from github.com/RAiWorks/MASTERY.md)
> B) I already have the files — just tell me where to put them
> C) I'll paste the content manually

If A: Run:
```bash
curl -sL "https://raw.githubusercontent.com/RAiWorks/MASTERY.md/main/mastery.md" -o "$_ROOT/docs/mastery.md"
curl -sL "https://raw.githubusercontent.com/RAiWorks/MASTERY.md/main/mastery-compact.md" -o "$_ROOT/docs/mastery-compact.md"
echo "Downloaded mastery.md and mastery-compact.md to docs/"
```
Verify the downloads aren't empty. If curl fails, tell the user to download manually from `https://github.com/RAiWorks/MASTERY.md` and place files in `docs/`.

If B: Tell user to place `mastery.md` and `mastery-compact.md` in the project's `docs/` folder. Wait for confirmation, then verify the files exist.

If C: Create placeholder files and tell user to paste content into them.

---

## Step 3: Run the project discussion

Read `docs/mastery-compact.md` to understand the framework rules (context loading order).

Now start the project discussion. Use AskUserQuestion:

> Let's discuss your project. I need to understand what you're building so I can set up the right documentation structure.
>
> RECOMMENDATION: Answer all questions — this becomes your project's permanent memory.
>
> Tell me about your project:
> 1. What is it? (one sentence)
> 2. Why does it exist? (problem it solves)
> 3. Who is it for? (target users)
> 4. What tech stack? (language, framework, database, etc.)
> 5. What are the first 3-5 features you want to build?

After the user responds, create `docs/project-discussion.md` with the full discussion content. Use the template structure from mastery.md — search for "### 4. Discussion Document" in `docs/mastery.md` to get the template.

Mark the discussion status as `> **Status**: ✅ COMPLETE` at the top.

---

## Step 4: Create project-context.md

Distill the discussion into `docs/project-context.md`. Search for "### 5. Project Context" in `docs/mastery.md` for the template.

Key fields to fill:
- Project name, version (start at 0.1.0), description
- Project type, tech stack, architecture style
- Key decisions table (from the discussion)

Use AskUserQuestion to confirm:

> Here's a summary of your project identity. Does this look right?
>
> **{Project Name}** — {one-line description}
> **Stack**: {tech stack}
> **Type**: {project type}
>
> RECOMMENDATION: Choose A if the summary is accurate.
>
> A) Looks good — save it
> B) I want to change something (tell me what)

---

## Step 5: Build the roadmap

Create `docs/project-roadmap.md`. Search for "### 6. Project Roadmap" in `docs/mastery.md` for the template.

Use the features from the discussion (Step 3) to build the feature table. Number features starting at 01. All start as 🔴 Not Started except Feature #01 which should be 🟡 In Progress.

Show the roadmap and confirm with AskUserQuestion:

> Here's your feature roadmap. I've ordered features by what seems like natural dependency order.
>
> {show the feature table}
>
> RECOMMENDATION: Choose A if the order makes sense.
>
> A) Looks good — save it
> B) I want to reorder or rename features (tell me what)
> C) Add more features first

---

## Step 6: Create AGENTS.md

Create an `AGENTS.md` file at the project root. This orients AI agents working on the project. Search for "### 12. AGENTS.md" in `docs/mastery.md` for the template.

Must include:
- Project overview (from context)
- Getting started order (docs to read)
- Key rules (from the framework)
- Conventions (branches, commits, file naming)

---

## Step 7: Create project changelog

Create `docs/project-changelog.md` with an empty `## [Unreleased]` section. Search for "### 16. Project Changelog" in `docs/mastery.md` for the template.

---

## Step 8: Initial commit

```bash
cd "$_ROOT"
git add docs/mastery.md docs/mastery-compact.md docs/project-discussion.md docs/project-context.md docs/project-roadmap.md docs/project-changelog.md AGENTS.md
git status
```

Use AskUserQuestion:

> Mastery is set up! Here's what was created:
>
> - `docs/mastery.md` — Framework (full)
> - `docs/mastery-compact.md` — Framework (compact, for AI)
> - `docs/project-discussion.md` — Project discussion
> - `docs/project-context.md` — Project identity
> - `docs/project-roadmap.md` — Feature roadmap
> - `docs/project-changelog.md` — Changelog
> - `AGENTS.md` — AI agent orientation
>
> RECOMMENDATION: Choose A to commit this setup.
>
> A) Commit all files (`docs: initialize Mastery framework`)
> B) Let me review first — don't commit yet
> C) Start Feature #01 immediately (commit + begin first feature)

If A: `git commit -m "docs: initialize Mastery framework"`
If B: Stop — tell user to review and commit when ready.
If C: Commit, then tell user to run `/mastery-plan` to start planning Feature #01.

---

## Output

```
━━━ MASTERY INITIALIZED ━━━━━━━━━━━━━━━━━━━━━━━

Project:     {name}
Version:     0.1.0
Features:    {N} planned
Next:        Feature #01 — {name}

Files created:
  docs/mastery.md
  docs/mastery-compact.md
  docs/project-discussion.md
  docs/project-context.md
  docs/project-roadmap.md
  docs/project-changelog.md
  AGENTS.md

Run /mastery-plan to start your first feature.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Edge Cases

- **Not a git repo**: Run `git init` first, then proceed. Warn user: "Initialized git repo."
- **docs/ already exists with other files**: Don't touch existing files. Only create Mastery docs.
- **User wants minimal setup**: If they say "skip discussion" or "just the skeleton", create the folder structure and empty template files. Mark discussion as IN PROGRESS.
- **Monorepo**: Ask which subdirectory to initialize. Create docs/ there, not at repo root.
