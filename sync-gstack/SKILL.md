---
name: sync-gstack
version: 1.0.0
description: |
  Sync gstack-governed fork with upstream gstack. Fetches latest from garrytan/gstack,
  applies predefined trims (preamble, contributor mode) and React/TS adaptations,
  then creates a PR on the fork for review.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Sync Gstack-Governed with Upstream

Pull latest upstream gstack, apply trim rules and React/TS adaptations, create a PR.

## Prerequisites

The fork must have an `upstream` remote pointing to `garrytan/gstack`:
```bash
cd ~/.claude/skills/gstack-governed
git remote -v  # should show upstream → garrytan/gstack
```

If missing: `git remote add upstream https://github.com/garrytan/gstack.git`

## Workflow

### Step 1 — Fetch upstream + read changelog

```bash
cd ~/.claude/skills/gstack-governed
git fetch upstream
```

Read `CHANGELOG.md` diff between current version and upstream:
```bash
OLD_VERSION=$(cat VERSION)
git diff HEAD..upstream/main -- CHANGELOG.md
```

Print a summary of what's new upstream.

### Step 2 — Create sync branch from upstream

```bash
BRANCH="sync-upstream-$(date +%Y%m%d)"
git checkout -b "$BRANCH" upstream/main
```

### Step 3 — Apply trim rules

For every `*/SKILL.md` file in the repo:

**3a. Remove preamble block:**
Find and remove the section starting with `## Preamble (run first)` (or the bash code block starting with `_UPD=`) through the paragraph about `UPGRADE_AVAILABLE` / `JUST_UPGRADED` that ends with "continue."

**3b. Remove contributor mode:**
Find and remove the section from `## Contributor Mode` through the line about "Max 3 reports per session. File inline and continue".

**3c. Keep AskUserQuestion format** section as-is.

### Step 4 — Apply React/TS adaptations

**ship/SKILL.md:**
- Replace all `bin/test-lane` references with "Run project's test/lint/typecheck commands from CLAUDE.local.md 'Project Scripts' table"
- Replace `npm run test` with "project's test commands from CLAUDE.local.md"
- Remove Step 3.25 (Eval Suites) entirely
- Remove Step 4 (VERSION bump) entirely
- Remove Step 5 (CHANGELOG generation) entirely
- Remove Step 5.5 (TODOS.md auto-update) entirely
- Replace commit ordering vocabulary: "migrations" -> "schema changes", "Models & services" -> "Components & hooks", "Controllers & views" -> "Pages & routes"

**review/SKILL.md:**
- Replace ActiveRecord/ORM vocabulary with GraphQL client / data fetching hooks
- Replace Models/Controllers/Concerns with Components/Hooks/Services/Utils
- DO NOT modify `review/checklist.md` — it is maintained directly in the fork

**retro/SKILL.md:**
- Replace "Models / Controllers / Concerns" with "Components / Hooks / Services / Utils"

**plan-eng-review/SKILL.md:**
- Replace Rails error types with React/TS: TypeError, AbortError, DOMException, GraphQL client errors
- Replace architecture vocabulary: Models -> Components, Controllers -> Pages/Routes, Concerns -> Hooks
- Add after architecture section: "When a plan requires new API queries/mutations, include a 'Request for BE team' section: ideal query shape, missing API capabilities, N+1 risks"
- Replace "JS or Rails test" with "project's test framework from CLAUDE.local.md"

**plan-ceo-review/SKILL.md:**
- Same vocabulary replacements as plan-eng-review

**qa/SKILL.md + qa-only/SKILL.md:**
- Remove the `### Rails` framework guidance subsection
- Add React-specific checks: hydration errors, client-side routing, CLS
- Change artifact path from `.gstack/` to `.local-context/`

**browse/SKILL.md:**
- Change artifact path from `.gstack/` to `.local-context/`

### Step 5 — Commit and push

```bash
git add -A
NEW_VERSION=$(cat VERSION)
git commit -m "Sync upstream v${NEW_VERSION}: trim preamble/contributor, apply React/TS adaptations"
git push origin "$BRANCH"
```

### Step 6 — Create PR

```bash
gh pr create --repo lucaslim/gstack-governed --title "Sync upstream v${NEW_VERSION}" --body "$(cat <<'EOF'
## Summary

Synced with upstream gstack and applied governed trims:
- Removed preamble (update check, session management) from all skills
- Removed contributor mode from all skills
- Applied React/TS vocabulary and workflow adaptations

## Upstream changes

<paste changelog diff summary here>

## Review checklist

- [ ] Trims applied correctly (no leftover preamble/contributor sections)
- [ ] React/TS vocabulary correct (no Rails references)
- [ ] checklist.md untouched
- [ ] No regressions in skill workflows
EOF
)"
```

### Step 7 — Report

Print:
- Upstream version synced to
- Summary of upstream changes (from CHANGELOG diff)
- Link to PR
- Reminder: after merging, run `cd ~/.claude/skills/gstack-governed && git checkout main && git pull && ./setup`
