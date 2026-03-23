---
name: handoff
version: 1.0.0
description: |
  Structured context transfer between parallel agents. Analyzes recent commits,
  diffs, TODOs, and code comments to surface decisions and their rationale,
  embedded assumptions, danger zones, and open threads. Produces a handoff
  artifact the next agent loads as context — eliminating cold starts in parallel
  sprint workflows.
  Use when ending a sprint, handing work to another agent, or resuming a branch
  after a break. Proactively suggest after /ship, /retro, or long sessions.
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
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
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.gstack/analytics
echo '{"skill":"handoff","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

If `PROACTIVE` is `"false"`, do not proactively suggest gstack skills — only invoke
them when the user explicitly asks. The user opted out of proactive suggestions.

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow". If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

If `LAKE_INTRO` is `no`: introduce the Completeness Principle and offer to open the essay. Touch `~/.gstack/.completeness-intro-seen`.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: prompt for telemetry opt-in per the standard flow. Touch `~/.gstack/.telemetry-prompted`.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use `_BRANCH` from the preamble), and the current plan/task.
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — include `Completeness: X/10` for each option.
4. **Options:** Lettered options with effort scales: `(human: ~X / CC: ~Y)`

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. Always recommend the complete option. Show both human and CC+gstack effort estimates. Don't defer edge cases or skip the last 10%.

## Repo Ownership Mode — See Something, Say Something

`REPO_MODE` tells you who owns issues. Solo: investigate and offer to fix proactively. Collaborative: flag via AskUserQuestion. Unknown: treat as collaborative.

## Contributor Mode

If `_CONTRIB` is `true`: reflect on the gstack tooling after each major step. File a field report to `~/.gstack/contributor-logs/{slug}.md` if something wasn't a 10. Max 3 per session.

## Completion Status Protocol

Report one of: **DONE**, **DONE_WITH_CONCERNS**, **BLOCKED**, **NEEDS_CONTEXT**. Escalate after 3 failed attempts. Bad work is worse than no work.

---

# /handoff — Agent Context Transfer

You are producing a structured handoff artifact for the next agent (or future you)
who will work on this branch. Your job is to surface what you know that the code
doesn't say: decisions made, alternatives rejected, assumptions embedded, code that
is fragile, and work that is unfinished.

**The test:** After reading the handoff artifact, the next agent should be able to
start working in under 60 seconds — no re-reading commits, no grepping for context,
no asking "why was this done this way?"

---

## Step 0: Detect scope

```bash
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
COMMIT_COUNT=$(git rev-list --count "$BASE"..HEAD 2>/dev/null || echo "0")
echo "BRANCH: $BRANCH"
echo "REPO: $REPO"
echo "BASE: $BASE"
echo "COMMITS_AHEAD: $COMMIT_COUNT"
git log "$BASE"..HEAD --oneline 2>/dev/null || true
git diff --stat "$BASE"..HEAD 2>/dev/null || true
```

If `COMMITS_AHEAD` is 0 and there are no uncommitted changes, print:

```
nothing to hand off — no commits or changes ahead of $BASE
│ make some progress first, then run /handoff
```

Stop.

---

## Step 1: Ask scope

Use AskUserQuestion:

> **Branch:** `{BRANCH}` in `{REPO}`
>
> I'll analyze your recent work and produce a handoff document the next agent can
> load as context. How thorough should this be?
>
> RECOMMENDATION: Choose B if you're handing off to another agent session today.
> Choose A for a quick record before a short break.
>
> A) Quick — decisions + open threads only (Completeness: 5/10)
> (human: ~5 min / CC: ~30 sec)
>
> B) Deep — decisions, assumptions, danger zones, open threads, and a suggested
> starting point for the next agent (Completeness: 10/10)
> (human: ~20 min / CC: ~2 min)

Store answer as `DEPTH` (quick or deep).

---

## Step 2: Mine commit history

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
git log "$BASE"..HEAD --format="%H%n%B%n---COMMIT_SEP---" 2>/dev/null
```

Extract from commit messages:
- Explicit decisions ("chose X over Y", "switched from", "replaced", "removed", "reverted")
- Reasons given in commit bodies
- References to issues, PRs, or external constraints

---

## Step 3: Mine the diff for implicit decisions

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
git diff "$BASE"..HEAD 2>/dev/null
```

From the diff, identify:

**Decisions** — places where a non-obvious choice was made:
- A function that could have been written simpler but wasn't
- A data structure choice that isn't the obvious default
- An early return or guard clause protecting against a specific scenario
- A hardcoded value that looks deliberate, not lazy

**Assumptions** (deep only) — things the code assumes to be true but doesn't verify:
- Array access without bounds checking (`arr[0]`, `data[key]`)
- Type coercions (`as SomeType`, unchecked casts)
- Environment assumptions (`process.env.X` without fallback)
- Ordering assumptions ("this runs after X" with no enforcement)
- Comments containing "assume", "should be", "always", "never"

**Danger zones** (deep only) — code that is fragile or likely to break on contact:
- Timing-sensitive logic (setTimeout, retry loops, polling)
- Partially-implemented error handling (`catch(e) { /* TODO */ }`)
- Code patched on top of a previous patch
- Anything with a "don't touch" or "be careful" comment
- Functions that mutate shared state

---

## Step 4: Surface open threads

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
# TODOs introduced in this branch (not pre-existing)
git diff "$BASE"..HEAD | grep "^+" | grep -iE "TODO|FIXME|HACK|XXX|TEMP|WIP" | grep -v "^+++" || true
# Commented-out code (likely removed but not decided)
git diff "$BASE"..HEAD | grep "^+" | grep -E "^\+\s*//" | head -20 || true
# Skipped tests
git diff "$BASE"..HEAD | grep "^+" | grep -iE "skip|xit|xdescribe|pending|\.todo" || true
# Stashed work
git stash list 2>/dev/null || true
```

---

## Step 5 (deep only): Suggested entry point for next agent

Skip if `DEPTH` is `quick`.

Based on the open threads and danger zones, produce one concrete suggestion:
- What should the next agent do FIRST
- What should the next agent NOT touch until a specific condition is met
- What question should the next agent answer before making changes

---

## Step 6: Write the artifact

```bash
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
COMMIT_COUNT=$(git rev-list --count "$BASE"..HEAD 2>/dev/null || echo "0")
mkdir -p ~/.gstack/handoffs
ARTIFACT="$HOME/.gstack/handoffs/${REPO}-${BRANCH}-${TIMESTAMP}.md"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
echo "ARTIFACT: $ARTIFACT"
echo "REPO_ROOT: $REPO_ROOT"
```

Write the artifact using the Write tool with this format:

```markdown
# Handoff: {BRANCH}
**Repo:** {REPO} | **Branch:** {BRANCH} | **Created:** {TIMESTAMP}
**Commits ahead of {BASE}:** {N} | **Depth:** {quick|deep}

---

## Decisions

> What was chosen and why — including alternatives that were rejected.

- **{decision}**
  - Chose: {what}
  - Rejected: {alternatives and why}
  - Reason: {rationale from commit message or code context}

*(If no decisions found: "No decisions surfaced — commit messages were terse.
Review the diff manually if something seems non-obvious.")*

---

## Assumptions

> Things the code assumes to be true that aren't enforced or verified.
> *(Quick mode: section omitted)*

- `{file}:{line}` — {what is assumed} *(risk: low|medium|high)*

*(If none found: "No embedded assumptions detected.")*

---

## Danger Zones

> Code that is fragile, partially done, or likely to break on contact.
> *(Quick mode: section omitted)*

- `{file}:{line_range}` — {why it's fragile}
  - Do: {safe approach}
  - Don't: {what to avoid}

*(If none found: "No danger zones detected.")*

---

## Open Threads

> Work that was started but not finished, and why it stopped.

- [ ] {description} — stopped because: {reason}
  - Blocked by: {dependency or decision needed}

*(If none: "No open threads.")*

---

## For the Next Agent

> Load this file at the start of your session. Start here.

{suggested entry point — one concrete action}

**Do not touch** {X} **until** {condition}.

**Answer this question first:** {the question that unblocks the most work}

*(Quick mode: entry point omitted — run /handoff deep for a suggested starting point)*

---

*Generated by /handoff · gstack v{VERSION} · {TIMESTAMP}*
```

After writing `$ARTIFACT`, copy to the repo root:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
cp "$ARTIFACT" "$REPO_ROOT/HANDOFF.md"
```

Check and update `.gitignore` if needed:

```bash
grep -q "^HANDOFF\.md$" "$REPO_ROOT/.gitignore" 2>/dev/null || echo "HANDOFF_NOT_IGNORED"
```

If `HANDOFF_NOT_IGNORED`:

```bash
echo "HANDOFF.md" >> "$REPO_ROOT/.gitignore"
```

Print:

```
  ✓ handoff artifact written
    ~/.gstack/handoffs/{REPO}-{BRANCH}-{TIMESTAMP}.md
    {REPO_ROOT}/HANDOFF.md  (gitignored)

  next agent: load HANDOFF.md at the start of your session
```

---

## Completion

Report status using **DONE**, **DONE_WITH_CONCERNS**, **BLOCKED**, or **NEEDS_CONTEXT**.

State how many decisions, assumptions, danger zones, and open threads were surfaced.

If `DONE_WITH_CONCERNS`: flag if commit messages were too terse to surface decisions — suggest more descriptive commit messages going forward.

If `PROACTIVE` is `true`, suggest: "Run `/retro` for velocity metrics, or `/review` before handing off to a reviewer."

## Telemetry (run last)

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-telemetry-log \
  --skill "handoff" --duration "$_TEL_DUR" --outcome "OUTCOME" \
  --used-browse "false" --session-id "$_SESSION_ID" 2>/dev/null &
```

Replace `OUTCOME` with success/error/abort based on workflow result.
