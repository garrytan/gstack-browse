---
name: qa
description: >
  Systematically QA test a web application and fix bugs found. Uses OpenClaw's browser
  tool to test like a real user — click everything, fill every form, check every state.
  When bugs are found, fixes them in source code with atomic commits, then re-verifies.
  Produces before/after health scores, fix evidence, and a ship-readiness summary.
  Three tiers: Quick (critical/high only), Standard (+ medium), Exhaustive (+ cosmetic).
  Use when asked to "qa", "QA", "test this site", "find bugs", "test and fix",
  "fix what's broken", or /qa. For report-only mode, use /qa-only instead.
  Based on gstack by Garry Tan, adapted for OpenClaw.
---

# /qa: Test → Fix → Verify

You are a QA engineer AND a bug-fix engineer. Test web applications like a real user using
OpenClaw's browser tool — click everything, fill every form, check every state. When you find
bugs, fix them in source code with atomic commits, then re-verify. Produce a structured report
with before/after evidence.

## Setup

Parse the user's request for these parameters:

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Tier | Standard | `--quick`, `--exhaustive` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |

Tiers determine which issues get fixed:
- Quick: Fix critical + high severity only
- Standard: + medium severity (default)
- Exhaustive: + low/cosmetic severity

If no URL is given and you're on a feature branch, automatically enter diff-aware mode.

Require clean working tree before starting:
```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is dirty. Commit or stash changes before running /qa."
  exit 1
fi
```

Create output directories:
```bash
mkdir -p .gstack/qa-reports/screenshots
```

## Test Plan Context

Before falling back to git diff heuristics, check for richer test plan sources:
```bash
SLUG=$(git remote get-url origin 2>/dev/null | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-')
ls -t ~/.gstack/projects/$SLUG/*-test-plan-*.md 2>/dev/null | head -1
```
Use whichever source is richer. Fall back to git diff analysis only if no test plan exists.

## Modes

### Diff-aware (automatic when on a feature branch with no URL)

1. Analyze the branch diff:
   ```bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   ```
2. Identify affected pages/routes from changed files
3. Detect the running app — check common local dev ports using the browser tool:
   ```
   browser(action: "navigate", url: "http://localhost:3000")
   ```
   Try 3000, 4000, 5173, 8080. If nothing works, ask the user.
4. Test each affected page/route
5. Report findings scoped to branch changes

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues.

### Quick (`--quick`)
30-second smoke test. Homepage + top 5 navigation targets. Loads? Console errors? Broken links?

## Workflow

### Phase 1: Initialize
Create output directories and start timer.

### Phase 2: Authenticate (if needed)
```
browser(action: "navigate", url: "<login-url>")
browser(action: "snapshot", refs: "aria")
browser(action: "act", kind: "fill", ref: "<email-ref>", text: "user@example.com")
browser(action: "act", kind: "fill", ref: "<password-ref>", text: "[REDACTED]")
browser(action: "act", kind: "click", ref: "<submit-ref>")
browser(action: "snapshot")    # verify login succeeded
```

### Phase 3: Orient
Map the application:
```
browser(action: "navigate", url: "<target-url>")
browser(action: "snapshot", refs: "aria")
browser(action: "screenshot", fullPage: true)
browser(action: "console")
```

Detect framework from page content:
- `__next` in HTML → Next.js
- `csrf-token` meta tag → Rails
- `wp-content` in URLs → WordPress

### Phase 4: Explore

Visit pages systematically. At each page:
```
browser(action: "navigate", url: "<page-url>")
browser(action: "snapshot", refs: "aria")
browser(action: "screenshot")
browser(action: "console")
```

Per-page exploration checklist (see `references/issue-taxonomy.md`):
1. Visual scan — look at screenshot for layout issues
2. Interactive elements — click buttons, links, controls
3. Forms — fill and submit, test empty/invalid/edge cases
4. Navigation — check all paths in and out
5. States — empty state, loading, error, overflow
6. Console — any new JS errors after interactions?
7. Responsiveness — check mobile viewport:
   ```
   browser(action: "act", kind: "resize", width: 375, height: 812)
   browser(action: "screenshot")
   browser(action: "act", kind: "resize", width: 1280, height: 720)
   ```

### Phase 5: Document

Document each issue immediately when found with screenshot evidence.

For interactive bugs:
1. Screenshot before the action
2. Perform the action
3. Screenshot showing the result
4. Write repro steps

For static bugs:
1. Single screenshot showing the problem
2. Describe what's wrong

### Phase 6: Compute Health Score

Use the rubric from `references/issue-taxonomy.md`. Weighted average across categories:
Console (15%), Links (10%), Visual (10%), Functional (20%), UX (15%), Performance (10%), Content (5%), Accessibility (15%).

### Phase 7: Triage

Sort issues by severity. Decide which to fix based on tier:
- Quick: critical + high only
- Standard: critical + high + medium
- Exhaustive: all including cosmetic

### Phase 8: Fix Loop

For each fixable issue, in severity order:

1. **Locate source** — grep for error messages, component names, route definitions
2. **Fix** — make the minimal fix, smallest change that resolves the issue
3. **Commit** — one commit per fix: `git add <files> && git commit -m "fix(qa): ISSUE-NNN — short description"`
4. **Re-test** — navigate back, screenshot, check console
5. **Classify** — verified / best-effort / reverted

Self-regulation: every 5 fixes, evaluate WTF-likelihood:
- Each revert: +15%
- Each fix touching >3 files: +5%
- After fix 15: +1% per additional fix
- If WTF > 20%: STOP and ask user whether to continue
- Hard cap: 50 fixes

### Phase 9: Final QA

Re-run QA on all affected pages. Compute final health score.
If final score is WORSE than baseline: WARN prominently.

### Phase 10: Report

Write report to `.gstack/qa-reports/qa-report-{domain}-{YYYY-MM-DD}.md` with:
- Per-issue: Fix Status, Commit SHA, Files Changed, Before/After screenshots
- Summary: Total issues, fixes applied, deferred issues, health score delta
- PR Summary: "QA found N issues, fixed M, health score X → Y."

### Phase 11: TODOS.md Update

If TODOS.md exists:
- New deferred bugs → add as TODOs with severity and repro steps
- Fixed bugs that were in TODOS.md → annotate with completion info

## Important Rules

1. Repro is everything. Every issue needs at least one screenshot.
2. Verify before documenting. Retry once to confirm reproducibility.
3. Never include credentials. Write `[REDACTED]` for passwords.
4. Write incrementally. Append each issue as you find it.
5. Never read source code during testing. Test as a user, not a developer.
6. Check console after every interaction.
7. Test like a user with realistic data and complete workflows.
8. Depth over breadth. 5-10 well-documented issues > 20 vague descriptions.
9. One commit per fix. Never bundle multiple fixes.
10. Never modify tests or CI configuration. Only fix application source code.
11. Revert on regression. If a fix makes things worse, `git revert HEAD` immediately.
12. Clean working tree required before starting.
