---
name: ship
description: >
  Fully automated ship workflow. Syncs with base branch, runs tests, does a pre-landing
  review, bumps VERSION, updates CHANGELOG, commits in bisectable chunks, pushes, and
  creates a PR. Use when asked to "ship this", "ship it", "create a PR", "land this
  branch", "push and PR", or /ship. For a ready branch, not for deciding what to build.
  Based on gstack by Garry Tan.
---

# Ship: Fully Automated Ship Workflow

You are running the /ship workflow. This is a non-interactive, fully automated workflow.
Do NOT ask for confirmation at any step. The user said /ship which means DO IT.
Run straight through and output the PR URL at the end.

Only stop for:
- On the base branch (abort)
- Merge conflicts that can't be auto-resolved (stop, show conflicts)
- Test failures (stop, show failures)
- Pre-landing review finds CRITICAL issues and user chooses to fix
- MINOR or MAJOR version bump needed (ask)

Never stop for:
- Uncommitted changes (always include them)
- Version bump choice (auto-pick MICRO or PATCH)
- CHANGELOG content (auto-generate from diff)
- Commit message approval (auto-commit)

## Step 0: Detect base branch

```bash
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || \
       gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || \
       echo "main")
echo "Base branch: $BASE"
```

## Step 1: Pre-flight

1. Check current branch. If on the base branch, abort: "You're on the base branch. Ship from a feature branch."
2. Run `git status`. Uncommitted changes are always included.
3. Run `git diff $BASE...HEAD --stat` and `git log $BASE..HEAD --oneline` to understand what's being shipped.

## Step 2: Merge the base branch

```bash
git fetch origin $BASE && git merge origin/$BASE --no-edit
```

If merge conflicts: try to auto-resolve simple ones (VERSION, CHANGELOG ordering). If complex, STOP and show them.

## Step 3: Run tests

Detect and run the project's test suite. Common patterns:

```bash
# Detect test runner and execute
if [ -f "package.json" ]; then
  npm test 2>&1 | tee /tmp/ship_tests.txt || true
fi
if [ -f "Gemfile" ]; then
  bundle exec rake test 2>&1 | tee /tmp/ship_rails_tests.txt || true
fi
if [ -f "pytest.ini" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
  pytest 2>&1 | tee /tmp/ship_pytest.txt || true
fi
```

If any test fails: show the failures and STOP.
If all pass: continue silently — just note the counts briefly.

## Step 3.5: Pre-Landing Review

Review the diff for structural issues that tests don't catch.

1. Run `git diff origin/$BASE` to get the full diff
2. Apply a two-pass review:
   - Pass 1 (CRITICAL): SQL & Data Safety, Race Conditions, LLM Trust Boundary
   - Pass 2 (INFORMATIONAL): All remaining categories
3. Always output ALL findings
4. If CRITICAL issues found: for EACH, present to user with options:
   A) Fix it now, B) Acknowledge and ship anyway, C) False positive — skip
   If user chose A on any: apply fixes, commit, then tell user to run /ship again.
5. If only non-critical: output them and continue.
6. If none: output `Pre-Landing Review: No issues found.` and continue.

## Step 4: Version bump (auto-decide)

1. Read the current `VERSION` file (if it exists)
2. Auto-decide bump level based on diff:
   - < 50 lines changed → MICRO/PATCH (smallest digit)
   - 50+ lines → PATCH
   - MINOR or MAJOR → ASK the user
3. Write the new version to VERSION file

If no VERSION file exists, skip this step.

## Step 5: CHANGELOG (auto-generate)

1. Read `CHANGELOG.md` header to know the format (if it exists)
2. Auto-generate entry from all commits on the branch:
   - Use `git log $BASE..HEAD --oneline` for commit history
   - Use `git diff $BASE...HEAD` for the full diff
   - Categorize: Added, Changed, Fixed, Removed
   - Insert after file header, dated today
3. Do NOT ask the user to describe changes. Infer from diff and commits.

If no CHANGELOG.md exists, skip this step.

## Step 5.5: TODOS.md (auto-update)

If TODOS.md exists:
1. Cross-reference changes against open TODOs
2. Auto-mark completed items (be conservative — only with clear evidence)
3. Move completed items to Completed section with version and date

## Step 6: Commit (bisectable chunks)

Create small, logical commits that work well with `git bisect`.

Commit ordering (earlier first):
1. Infrastructure: migrations, config, routes
2. Models & services (with their tests)
3. Controllers & views (with their tests)
4. VERSION + CHANGELOG + TODOS.md (final commit)

Each commit must be independently valid. Compose messages as:
`<type>: <summary>` (type = feat/fix/chore/refactor/docs)

## Step 7: Push

```bash
git push -u origin $(git branch --show-current)
```

## Step 8: Create PR

```bash
gh pr create --base $BASE \
  --title "<type>: <summary>" \
  --body "## Summary
<bullet points from CHANGELOG>

## Pre-Landing Review
<findings from Step 3.5, or 'No issues found.'>

## Test plan
- [x] All tests pass

🤖 Generated with gstack for OpenClaw"
```

Output the PR URL — this should be the final output the user sees.

## Important Rules

- Never skip tests. If tests fail, stop.
- Never force push. Use regular `git push` only.
- Never ask for confirmation except for MINOR/MAJOR version bumps and CRITICAL review findings.
- Split commits for bisectability — each commit = one logical change.
- The goal is: user says /ship, next thing they see is the review + PR URL.
