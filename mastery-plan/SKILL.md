---
name: mastery-plan
version: 1.0.0
description: |
  Create feature planning docs for a Mastery project. Walks through the full
  Discuss → Design → Plan flow: writes the discussion doc, architecture doc,
  tasks, and testplan. One command to go from idea to ready-to-build.
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

# /mastery-plan — Plan a Feature from Scratch

You are the feature planner. Your job: take a feature idea and produce a complete set of planning docs — discussion, architecture, tasks, testplan — so someone (human or AI) can build it without guessing.

## User-invocable
When the user types `/mastery-plan`, run this skill.

---

## Step 1: Verify this is a Mastery project

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
ls "$_ROOT"/docs/project-roadmap.md "$_ROOT"/docs/mastery-compact.md 2>/dev/null
```

**If not a Mastery project:** Use AskUserQuestion:

> This project doesn't have the Mastery framework set up yet. You need that before planning features.
>
> RECOMMENDATION: Choose A to set it up first.
>
> A) Set up Mastery first (I'll walk you through it)
> B) Cancel

If A: Tell user to run `/mastery-init`. Stop.
If B: Stop.

**If Mastery exists:** Read `docs/mastery-compact.md` for framework rules, then continue.

---

## Step 2: Pick the feature

Read `docs/project-roadmap.md` and extract the feature table.

Use AskUserQuestion:

> Here are your planned features:
>
> {list features from roadmap with status emoji}
>
> RECOMMENDATION: Choose the next 🔴 Not Started feature, or describe a new one.
>
> A) Start planning Feature #{next 🔴 number} — {name}
> B) I want to plan a different feature (tell me which number)
> C) New feature not on the roadmap yet (describe it)

If C: Ask user to describe the feature. Assign the next available number. Add it to `docs/project-roadmap.md` as 🟡 In Progress using Edit tool.

For A or B: Update the chosen feature to 🟡 In Progress in the roadmap using Edit tool.

Note the feature number (XX) and name for folder creation.

---

## Step 3: Create the feature branch

```bash
FEATURE_NUM={XX}
FEATURE_SLUG={kebab-case-name}
BRANCH="feature/${FEATURE_NUM}-${FEATURE_SLUG}"
git checkout -b "$BRANCH"
echo "Created branch: $BRANCH"
```

Create the feature folder:

```bash
mkdir -p "$_ROOT/docs/features/$(printf '%02d' $FEATURE_NUM)-${FEATURE_SLUG}"
```

---

## Step 4: Write the discussion doc

This is a structured conversation about the feature. Use AskUserQuestion:

> Let's discuss Feature #{XX} — {name}.
>
> Tell me everything about this feature:
> 1. What does it do? (user-facing behavior)
> 2. Why do we need it? (problem it solves)
> 3. Any technical constraints? (must use X, can't touch Y)
> 4. How will we know it's done? (acceptance criteria)
> 5. Any open questions? (things you're not sure about)
>
> RECOMMENDATION: Be thorough — this becomes the permanent record of WHY this feature exists.

After the user responds, create `docs/features/{XX}-{name}/discussion.md`. Load the template from `docs/mastery.md` — search for "### 4. Discussion Document".

Fill in:
- Feature name and number
- The conversation content organized into sections
- Open questions (if any)
- Decision log (capture any decisions made during the discussion)

If the user has open questions, work through them one at a time with AskUserQuestion. Each question gets its own ask — never batch.

Mark status: `> **Status**: ✅ COMPLETE` when all questions are resolved.

---

## Step 5: Write the architecture doc

Read the discussion doc for context. Create `docs/features/{XX}-{name}/architecture.md`. Load the template from `docs/mastery.md` — search for "### 7. Architecture Document".

Fill in:
- Overview (what and why, from discussion)
- File structure (what files will be created or modified)
- Component design (key components and their responsibilities)
- Data flow (how data moves through the system)
- Trade-offs table (alternatives considered, pros/cons, verdict)

Use AskUserQuestion to present the architecture:

> Here's the proposed architecture for Feature #{XX}:
>
> **Approach**: {one-sentence summary}
> **Files touched**: {list}
> **Key trade-off**: {main decision and why}
>
> RECOMMENDATION: Choose A if the design makes sense.
>
> A) Looks good — finalize this architecture
> B) I want to change the approach (tell me what)
> C) I have concerns about {specific aspect}

Mark status: `> **Status**: 🟢 FINALIZED` when approved.

---

## Step 6: Write the tasks doc

Read the architecture doc for context. Create `docs/features/{XX}-{name}/tasks.md`. Load the template from `docs/mastery.md` — search for "### 8. Tasks Document".

Break the architecture into implementation phases with checkboxed tasks:

```markdown
## Phase A — {name}
- [ ] **A.1** — {specific, implementable task}
- [ ] **A.2** — {next task}

## Phase B — {name}
- [ ] **B.1** — {task}
```

Rules:
- Every task must be specific enough to implement without asking questions
- Tasks are ordered by dependency (later tasks can depend on earlier ones)
- Each phase groups related work
- Include a prerequisites section at the top

Show the task list to the user with AskUserQuestion:

> Here's the implementation plan — {N} tasks across {M} phases:
>
> {show phases and tasks}
>
> RECOMMENDATION: Choose A if the breakdown is actionable.
>
> A) Looks good — save it
> B) Too granular — combine some tasks
> C) Not detailed enough — break down {specific task}
> D) Missing something — I need to add {what}

---

## Step 7: Write the testplan doc

Create `docs/features/{XX}-{name}/testplan.md`. Load the template from `docs/mastery.md` — search for "### 9. Test Plan Document".

Generate test cases that cover:
- Happy path for each major task
- Edge cases from the architecture's trade-offs
- Error/failure scenarios
- Integration points (if any)

Format:

```markdown
| TC ID | Description | Steps | Expected | Status |
|-------|-------------|-------|----------|--------|
| TC-01 | {test name} | {steps} | {expected result} | ⬜ |
```

---

## Step 8: Create the changelog doc

Create `docs/features/{XX}-{name}/changelog.md`. Load the template from `docs/mastery.md` — search for "### 11. Feature Changelog".

Add a session note:

```markdown
### Session Note — {today's date}
- **Who**: AI Agent + Developer
- **Duration**: ~1 session
- **Worked On**: Created all planning docs (discussion, architecture, tasks, testplan)
- **Stopped At**: Planning complete — ready for Build stage
- **Blockers**: None
- **Next Steps**: Start Phase A implementation
```

---

## Step 9: Commit and push

```bash
cd "$_ROOT"
git add docs/features/$(printf '%02d' $FEATURE_NUM)-*/
git add docs/project-roadmap.md
git status
```

Use AskUserQuestion:

> Feature #{XX} planning is complete! All docs created:
>
> - `discussion.md` — ✅ COMPLETE
> - `architecture.md` — 🟢 FINALIZED
> - `tasks.md` — {N} tasks across {M} phases
> - `testplan.md` — {N} test cases
> - `changelog.md` — Session note logged
>
> RECOMMENDATION: Choose A to commit and push.
>
> A) Commit and push to feature branch
> B) Let me review first — don't commit
> C) Start building immediately (commit + begin Phase A)

If A:
```bash
git commit -m "docs(feature-{XX}): complete planning docs for {feature-name}"
git push -u origin "$BRANCH"
```

If C: Commit, push, then tell user: "Start implementing Phase A, Task A.1."

---

## Output

```
━━━ FEATURE PLANNED ━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature:     #{XX} — {name}
Branch:      feature/{XX}-{slug}
Stage:       Plan → Build (ready)

Documents:
  discussion.md    ✅ COMPLETE
  architecture.md  🟢 FINALIZED
  tasks.md         {N} tasks, {M} phases
  testplan.md      {N} test cases
  changelog.md     Session note logged

Next: Start Phase A — {first task description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Edge Cases

- **Feature already has some docs**: Read existing docs and skip those steps. Only create what's missing.
- **User wants lightweight feature**: If the feature is trivial (docs-only, config change, < 1 hour), suggest using `lightweight.md` instead. Create a single combined doc per Mastery's lightweight variant rules.
- **Multiple features in progress**: Warn user: "You already have {N} features in progress. Consider finishing one first." But don't block — they may have good reasons.
- **No git**: Warn but continue. Skip branch creation and commit steps.
- **Architecture debate**: If user goes back and forth on the architecture, keep the discussion doc updated with the decision log. Don't finalize architecture until user explicitly approves.
