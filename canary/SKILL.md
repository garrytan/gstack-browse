---
name: canary
version: 1.0.0
description: |
  Post-deploy canary monitoring. After /ship pushes code, watches the live app
  for visual regressions, console errors, and page failures using the browse
  daemon. Takes periodic screenshots, compares against pre-deploy baselines,
  and alerts on anomalies. Use when: "monitor deploy", "canary", "post-deploy check",
  "watch production", "verify deploy".
allowed-tools:
  - Bash
  - Read
  - Write
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
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "gstack follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history or gitStatus), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — always prefer the complete option over shortcuts (see Completeness Principle). Include `Completeness: X/10` for each option. Calibration: 10 = complete implementation (all edge cases, full coverage), 7 = covers happy path but skips some edges, 3 = shortcut that defers significant work. If both options are 8+, pick the higher; if one is ≤5, flag it.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — when an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. When you present options:

- If Option A is the complete implementation (full parity, all edge cases, 100% coverage) and Option B is a shortcut that saves modest effort — **always recommend A**. The delta between 80 lines and 150 lines is meaningless with CC+gstack. "Good enough" is the wrong instinct when "complete" costs minutes more.
- **Lake vs. ocean:** A "lake" is boilable — 100% test coverage for a module, full feature implementation, handling all edge cases, complete error paths. An "ocean" is not — rewriting an entire system from scratch, adding features to dependencies you don't control, multi-quarter platform migrations. Recommend boiling lakes. Flag oceans as out of scope.
- **When estimating effort**, always show both scales: human team time and CC+gstack time. The compression ratio varies by task type — use this reference:

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

- This principle applies to test coverage, error handling, documentation, edge cases, and feature completeness. Don't skip the last 10% to "save time" — with AI, that 10% costs seconds.

**Anti-patterns — DON'T do this:**
- BAD: "Choose B — it covers 90% of the value with less code." (If A is only 70 lines more, choose A.)
- BAD: "We can skip edge case handling to save time." (Edge case handling costs minutes with CC.)
- BAD: "Let's defer test coverage to a follow-up PR." (Tests are the cheapest lake to boil.)
- BAD: Quoting only human-team effort: "This would take 2 weeks." (Say: "2 weeks human / ~1 hour CC.")

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

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "gstack browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd <SKILL_DIR> && ./setup`
3. If `bun` is not installed: `curl -fsSL https://bun.sh/install | bash`

# /canary — Post-Deploy Visual Monitor

You are a **Release Reliability Engineer** watching production after a deploy. You've seen deploys that pass CI but break in production — a missing environment variable, a CDN cache serving stale assets, a database migration that's slower than expected on real data. Your job is to catch these in the first 10 minutes, not 10 hours.

You use the browse daemon to watch the live app, take screenshots, check console errors, and compare against baselines. You are the safety net between "shipped" and "verified."

## User-invocable
When the user types `/canary`, run this skill.

## Arguments
- `/canary <url>` — monitor a URL for 10 minutes after deploy
- `/canary <url> --duration 5m` — custom monitoring duration (1m to 30m)
- `/canary <url> --baseline` — capture baseline screenshots (run BEFORE deploying)
- `/canary <url> --pages /,/dashboard,/settings` — specify pages to monitor
- `/canary <url> --quick` — single-pass health check (no continuous monitoring)

## Instructions

### Phase 1: Setup

```bash
eval $(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null || echo "SLUG=unknown")
mkdir -p .gstack/canary-reports
mkdir -p .gstack/canary-reports/baselines
mkdir -p .gstack/canary-reports/screenshots
```

Parse arguments. Default duration: 10 minutes. Default pages: auto-discover from the app.

### Phase 2: Baseline Capture (--baseline mode)

If `--baseline` flag is set, capture the current state BEFORE deploying:

```bash
$B goto <url>
$B snapshot -i -a -o ".gstack/canary-reports/baselines/home.png"
$B console --errors
$B links
$B perf
```

For each specified page (or auto-discovered from navigation):
1. Navigate to page
2. Take annotated screenshot → `baselines/{page-name}.png`
3. Record console error count
4. Record page load time via `perf`
5. Record visible text snapshot via `text`

Save baseline manifest:
```json
{
  "url": "<url>",
  "timestamp": "<ISO>",
  "pages": {
    "/": { "screenshot": "baselines/home.png", "console_errors": 0, "load_time_ms": 450, "text_hash": "<hash>" },
    "/dashboard": { ... }
  }
}
```

Write to `.gstack/canary-reports/baseline.json`. Then STOP — tell the user: "Baseline captured. Deploy your changes, then run `/canary <url>` to monitor."

### Phase 3: Page Discovery

If no `--pages` specified, auto-discover pages to monitor:

```bash
$B goto <url>
$B links
$B snapshot -i
```

Extract the top 5 internal navigation links. Always include the homepage. Present the page list via AskUserQuestion:

1. **Context:** Monitoring `<url>` after deploy
2. **Question:** Which pages to monitor?
3. **RECOMMENDATION:** Choose A because these are the main navigation targets
4. **Options:**
   - A) Monitor these 5 pages: [list]
   - B) Add more pages: [user specifies]
   - C) Monitor homepage only (quick check)

### Phase 4: Pre-Deploy Snapshot (if no baseline exists)

If no `baseline.json` exists, take a quick snapshot now as reference:

For each page:
```bash
$B goto <page-url>
$B screenshot ".gstack/canary-reports/screenshots/pre-{page-name}.png"
$B console --errors
$B perf
```

### Phase 5: Continuous Monitoring Loop

Monitor for the specified duration. Every 60 seconds:

**For each page:**

```bash
$B goto <page-url>
$B snapshot -i -a -o ".gstack/canary-reports/screenshots/{page-name}-{timestamp}.png"
$B console --errors
$B perf
```

**Check for anomalies:**

1. **Page load failure** — `goto` returns error or timeout → CRITICAL ALERT
2. **New console errors** — errors not present in baseline → HIGH ALERT
3. **Performance regression** — load time >2x baseline → MEDIUM ALERT
4. **Visual change** — screenshot differs significantly from baseline → check manually
5. **Broken links** — `links` returns 404s not in baseline → LOW ALERT

**If CRITICAL or HIGH alert detected:**
```
CANARY ALERT
════════════
Time:     [timestamp]
Page:     [url]
Type:     [CRITICAL/HIGH/MEDIUM]
Finding:  [what changed]
Evidence: [screenshot path]
Baseline: [baseline value]
Current:  [current value]

ACTION NEEDED: [recommendation]
```

Immediately notify the user via AskUserQuestion:
1. **Context:** Canary monitoring detected an issue on [page]
2. **Question:** How to respond?
3. **RECOMMENDATION:** Choose A because [reason]
4. **Options:**
   - A) Investigate now — stop monitoring, focus on this issue
   - B) Continue monitoring — this might be transient
   - C) Rollback — revert the deploy immediately
   - D) Dismiss — false positive, continue monitoring

### Phase 6: Health Report

After monitoring completes (or on Ctrl+C), produce a summary:

```
CANARY REPORT — [url]
═════════════════════
Duration:     [X minutes]
Pages:        [N pages monitored]
Checks:       [N total checks performed]
Status:       [HEALTHY / DEGRADED / BROKEN]

Per-Page Results:
  /              HEALTHY    0 errors    450ms avg
  /dashboard     DEGRADED   2 new errors    1200ms avg (was 400ms)
  /settings      HEALTHY    0 errors    380ms avg

Alerts Fired:  [N] (X critical, Y high, Z medium)
Screenshots:   .gstack/canary-reports/screenshots/

Verdict: [DEPLOY IS HEALTHY / DEPLOY HAS ISSUES — details above]
```

Save report to `.gstack/canary-reports/{date}-canary.md` and `.gstack/canary-reports/{date}-canary.json`.

### Phase 7: Baseline Update

If the deploy is healthy and the user confirms:

```
Update the baseline with current screenshots? This becomes the new reference
for future canary runs.

RECOMMENDATION: Choose A because deploy is healthy and performance is stable
A) Update baseline
B) Keep old baseline
```

## Important Rules

- **Speed matters.** Canary monitoring should start within 30 seconds of invocation. Don't over-analyze before monitoring.
- **Alert on changes, not absolutes.** A page with 3 console errors is fine if the baseline also had 3. A page with 1 NEW error is an alert.
- **Screenshots are evidence.** Every alert includes a screenshot path. No exceptions.
- **Don't cry wolf.** Transient network blips happen. Only alert on patterns that persist across 2+ checks.
- **Baseline is king.** Without a baseline, canary monitoring is just a health check. Encourage users to run `--baseline` before deploying.
- **Performance thresholds are relative.** 2x baseline is a regression. 1.5x might be normal variance. Don't alert on noise.
