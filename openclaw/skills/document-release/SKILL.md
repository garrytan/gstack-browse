---
name: document-release
description: >
  Post-ship documentation update. Reads all project docs, cross-references the diff,
  updates README/ARCHITECTURE/CONTRIBUTING and other docs to match what shipped, polishes
  CHANGELOG voice, cleans up TODOS, and optionally bumps VERSION. Use when asked to
  "update docs", "document release", "update documentation", "sync docs with code",
  "post-ship docs", or /document-release. Based on gstack by Garry Tan, adapted for OpenClaw.
---

# Document Release: Post-Ship Documentation Update

You are running the /document-release workflow. This runs after /ship (code committed, PR
exists or about to exist) but before the PR merges. Your job: ensure every documentation file
in the project is accurate, up to date, and written in a friendly, user-forward voice.

You are mostly automated. Make obvious factual updates directly. Stop and ask only for risky
or subjective decisions.

Only stop for:
- Risky/questionable doc changes (narrative, philosophy, security, removals, large rewrites)
- VERSION bump decision (if not already bumped)
- New TODOS items to add
- Cross-doc contradictions that are narrative (not factual)

Never stop for:
- Factual corrections clearly from the diff
- Adding items to tables/lists
- Updating paths, counts, version numbers
- Fixing stale cross-references
- CHANGELOG voice polish (minor wording adjustments)
- Marking TODOS complete

NEVER do:
- Overwrite, replace, or regenerate CHANGELOG entries — polish wording only
- Bump VERSION without asking
- Use the write tool on CHANGELOG.md — always use edit with exact matches

## Step 0: Detect base branch

```bash
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || \
       gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || \
       echo "main")
echo "Base branch: $BASE"
```

## Step 1: Pre-flight & Diff Analysis

1. Check current branch. If on the base branch, abort.
2. Gather context:
   ```bash
   git diff $BASE...HEAD --stat
   git log $BASE..HEAD --oneline
   git diff $BASE...HEAD --name-only
   ```
3. Discover all documentation files:
   ```bash
   find . -maxdepth 2 -name "*.md" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.gstack/*" -not -path "./.context/*" | sort
   ```
4. Classify changes: new features, changed behavior, removed functionality, infrastructure.
5. Output: "Analyzing N files changed across M commits. Found K documentation files to review."

## Step 2: Per-File Documentation Audit

Read each documentation file and cross-reference against the diff:

- **README.md:** Features, install/setup instructions, examples, troubleshooting
- **ARCHITECTURE.md:** Diagrams, component descriptions, design decisions (be conservative)
- **CONTRIBUTING.md:** Walk through setup as a new contributor — would each step succeed?
- **Project instructions:** Project structure, commands, build/test instructions
- **Any other .md files:** Determine purpose, cross-reference against diff

For each file, classify needed updates as:
- **Auto-update** — factual corrections clearly warranted by the diff
- **Ask user** — narrative changes, section removal, security model changes, large rewrites

## Step 3: Apply Auto-Updates

Make all clear, factual updates directly using the edit tool.

For each file modified, output a one-line summary: not just "Updated README.md" but
"README.md: added /new-skill to skills table, updated skill count from 9 to 10."

Never auto-update: README introduction/positioning, architecture philosophy, security model descriptions.

## Step 4: Ask About Risky/Questionable Changes

For each risky update, present to the user with:
- Context: project, branch, which doc file
- The specific documentation decision
- RECOMMENDATION: Choose [X] because [one-line reason]
- Options including C) Skip — leave as-is

## Step 5: CHANGELOG Voice Polish

CRITICAL — NEVER CLOBBER CHANGELOG ENTRIES.

If CHANGELOG was modified in this branch, review the entry for voice:
- Lead with what the user can now DO — not implementation details
- "You can now..." not "Refactored the..."
- Flag entries that read like commit messages
- Auto-fix minor voice adjustments. Ask if a rewrite would alter meaning.

If CHANGELOG was not modified, skip this step.

## Step 6: Cross-Doc Consistency

After auditing each file individually:
1. Does README's feature list match project instructions?
2. Does ARCHITECTURE match CONTRIBUTING's project structure?
3. Does CHANGELOG's latest version match VERSION file?
4. Discoverability: Is every doc file reachable from README? Flag orphaned docs.
5. Auto-fix factual inconsistencies. Ask about narrative contradictions.

## Step 7: TODOS.md Cleanup

If TODOS.md exists:
1. Cross-reference diff against open TODOs — mark completed items
2. Check if TODOs reference files that were significantly changed
3. Check diff for `TODO`, `FIXME`, `HACK`, `XXX` comments — ask if they should be captured

## Step 8: VERSION Bump Question

If VERSION exists and was NOT bumped on this branch, ask:
- A) Bump PATCH — if doc changes ship alongside code changes
- B) Bump MINOR — if significant standalone release
- C) Skip — no version bump needed (recommended for docs-only)

If VERSION was already bumped, check if it covers the full scope of changes.

## Step 9: Commit & Output

If no documentation files were modified, output "All documentation is up to date." and exit.

Otherwise:
1. Stage modified documentation files by name (never `git add -A`)
2. Commit: `docs: update project documentation for vX.Y.Z`
3. Push: `git push`
4. Update PR body with a Documentation section (if PR exists):
   ```bash
   gh pr view --json body -q .body > /tmp/doc-pr-body-$$.md
   # Append/replace ## Documentation section
   gh pr edit --body-file /tmp/doc-pr-body-$$.md
   rm -f /tmp/doc-pr-body-$$.md
   ```

Output a scannable documentation health summary:
```
Documentation health:
  README.md       [Updated] (added new skill to table)
  ARCHITECTURE.md [Current] (no changes needed)
  CHANGELOG.md    [Voice polished] (rewrote 2 bullets)
  TODOS.md        [Updated] (marked 1 item complete)
  VERSION         [Already bumped] (v1.2.3)
```

## Important Rules

- Read before editing. Always read the full content of a file before modifying it.
- Never clobber CHANGELOG. Polish wording only.
- Never bump VERSION silently. Always ask.
- Be explicit about what changed. Every edit gets a one-line summary.
- Generic heuristics, not project-specific. The audit checks work on any repo.
- Voice: friendly, user-forward, not obscure.
