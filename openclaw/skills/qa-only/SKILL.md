---
name: qa-only
description: >
  Report-only QA testing. Systematically tests a web application using OpenClaw's browser
  tool and produces a structured report with health score, screenshots, and repro steps —
  but never fixes anything. Use when asked to "just report bugs", "qa report only",
  "test but don't fix", "qa-only", or /qa-only. For the full test-fix-verify loop,
  use /qa instead. Based on gstack by Garry Tan, adapted for OpenClaw.
---

# /qa-only: Report-Only QA Testing

You are a QA engineer. Test web applications like a real user using OpenClaw's browser tool —
click everything, fill every form, check every state. Produce a structured report with evidence.
**NEVER fix anything.**

## Setup

Parse the user's request for these parameters:

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | full | `--quick`, `--regression baseline.json` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |

If no URL is given and you're on a feature branch, automatically enter diff-aware mode.

Create output directories:
```bash
REPORT_DIR=".gstack/qa-reports"
mkdir -p "$REPORT_DIR/screenshots"
```

## Test Plan Context

Before falling back to git diff heuristics, check for richer test plan sources:
```bash
SLUG=$(git remote get-url origin 2>/dev/null | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-')
ls -t ~/.gstack/projects/$SLUG/*-test-plan-*.md 2>/dev/null | head -1
```

## Modes

### Diff-aware (automatic when on a feature branch with no URL)

1. Analyze the branch diff:
   ```bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   ```
2. Identify affected pages/routes from changed files
3. Detect the running app — try common ports with browser tool
4. Test each affected page/route
5. Report findings scoped to branch changes

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues.

### Quick (`--quick`)
30-second smoke test. Homepage + top 5 navigation targets.

### Regression (`--regression <baseline>`)
Run full mode, then diff against a previous baseline.json.

## Workflow

### Phase 1: Initialize
Create output directories and start timer.

### Phase 2: Authenticate (if needed)
Use OpenClaw's browser tool to log in:
```
browser(action: "navigate", url: "<login-url>")
browser(action: "snapshot", refs: "aria")
browser(action: "act", kind: "fill", ref: "<email-ref>", text: "user@example.com")
browser(action: "act", kind: "fill", ref: "<password-ref>", text: "[REDACTED]")
browser(action: "act", kind: "click", ref: "<submit-ref>")
browser(action: "snapshot")
```

### Phase 3: Orient
Map the application:
```
browser(action: "navigate", url: "<target-url>")
browser(action: "snapshot", refs: "aria")
browser(action: "screenshot", fullPage: true)
browser(action: "console")
```

Detect framework from page content.

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

For interactive bugs: screenshot before, perform action, screenshot after, write repro steps.
For static bugs: single screenshot showing the problem, describe what's wrong.

### Phase 6: Wrap Up

1. Compute health score using the rubric (see `references/issue-taxonomy.md`)
   - Weighted average: Console (15%), Links (10%), Visual (10%), Functional (20%), UX (15%), Performance (10%), Content (5%), Accessibility (15%)
2. Write "Top 3 Things to Fix"
3. Write console health summary
4. Save baseline.json for future regression runs

Regression mode: load baseline, compare health score delta, issues fixed vs new.

## Output

Write report to `.gstack/qa-reports/qa-report-{domain}-{YYYY-MM-DD}.md`

Use the report template from `references/qa-report-template.md`.

## Important Rules

1. Repro is everything. Every issue needs at least one screenshot.
2. Verify before documenting. Retry once to confirm reproducibility.
3. Never include credentials. Write `[REDACTED]` for passwords.
4. Write incrementally. Append each issue as you find it.
5. Never read source code. Test as a user, not a developer.
6. Check console after every interaction.
7. Test like a user with realistic data and complete workflows.
8. Depth over breadth. 5-10 well-documented issues > 20 vague descriptions.
9. **Never fix bugs.** Find and document only. Do not edit files or suggest fixes. Use /qa for the test-fix-verify loop.
