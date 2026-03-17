---
name: review
description: >
  Paranoid pre-landing PR review. Analyzes diff against the base branch for SQL safety,
  race conditions, LLM trust boundary violations, conditional side effects, and other
  structural issues that tests don't catch. Use when asked to "review my PR", "review
  this branch", "pre-landing review", "code review", "paranoid review", or /review.
  Based on gstack by Garry Tan.
---

# Pre-Landing PR Review

You are running the /review workflow. Analyze the current branch's diff against the base
branch for structural issues that tests don't catch.

## Step 0: Detect base branch

```bash
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || \
       gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || \
       echo "main")
echo "Base branch: $BASE"
CURRENT=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "Current branch: $CURRENT"
```

Use the detected base branch in all subsequent commands.

## Step 1: Check branch

1. If on the base branch, output: "Nothing to review — you're on the base branch." and stop.
2. Run `git fetch origin $BASE --quiet && git diff origin/$BASE --stat` to check for a diff. If no diff, stop.

## Step 2: Read the checklist

Read `references/checklist.md` in this skill's directory.

If the file cannot be read, STOP and report the error. Do not proceed without the checklist.

## Step 3: Get the diff

```bash
git fetch origin $BASE --quiet
git diff origin/$BASE
```

This includes both committed and uncommitted changes against the latest base branch.

## Step 4: Two-pass review

Apply the checklist against the diff in two passes:

**Pass 1 (CRITICAL):** SQL & Data Safety, Race Conditions & Concurrency, LLM Output Trust Boundary, Enum & Value Completeness

**Pass 2 (INFORMATIONAL):** Conditional Side Effects, Magic Numbers & String Coupling, Dead Code & Consistency, LLM Prompt Issues, Test Gaps, View/Frontend

Enum & Value Completeness requires reading code OUTSIDE the diff. When the diff introduces a new enum value, use `grep` to find all files that reference sibling values, then read those files to check if the new value is handled.

## Step 5: Output findings

Always output ALL findings — both critical and informational.

- If CRITICAL issues found: output all findings, then for EACH critical issue present it to the user with:
  - The problem (file:line + description)
  - RECOMMENDATION: Choose A because [one-line reason]
  - Options: A) Fix it now, B) Acknowledge, C) False positive — skip
  After all critical questions are answered, apply fixes for any where user chose A.

- If only non-critical issues found: output findings. No further action needed.

- If no issues found: output `Pre-Landing Review: No issues found.`

## Step 5.5: TODOS cross-reference

Read `TODOS.md` in the repository root (if it exists). Cross-reference the PR:
- Does this PR close any open TODOs?
- Does this PR create work that should become a TODO?
- Are there related TODOs that provide context?

If TODOS.md doesn't exist, skip silently.

## Step 5.6: Documentation staleness check

Cross-reference the diff against documentation files. For each `.md` file in the repo root:
1. Check if code changes affect features described in that doc file
2. If the doc was NOT updated but the code it describes WAS changed, flag as INFORMATIONAL:
   "Documentation may be stale: [file] describes [feature] but code changed in this branch."

## Important Rules

- Read the FULL diff before commenting. Do not flag issues already addressed in the diff.
- Read-only by default. Only modify files if the user explicitly chooses "Fix it now."
- Be terse. One line problem, one line fix. No preamble.
- Only flag real problems. Skip anything that's fine.
- Never commit, push, or create PRs.
