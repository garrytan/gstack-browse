---
name: retro
description: >
  Weekly engineering retrospective. Analyzes commit history, work patterns, and code
  quality metrics with persistent history and trend tracking. Team-aware: breaks down
  per-person contributions with specific praise and growth opportunities. Use when asked
  to "retro", "retrospective", "weekly review", "what did we ship", "engineering retro",
  or /retro. Supports time windows: /retro 24h, /retro 14d, /retro compare.
  Based on gstack by Garry Tan, adapted for OpenClaw.
---

# /retro — Weekly Engineering Retrospective

Generates a comprehensive engineering retrospective analyzing commit history, work patterns,
and code quality metrics. Team-aware: identifies the user running the command, then analyzes
every contributor with per-person praise and growth opportunities.

## Arguments

- `/retro` — default: last 7 days
- `/retro 24h` — last 24 hours
- `/retro 14d` — last 14 days
- `/retro 30d` — last 30 days
- `/retro compare` — compare current window vs prior same-length window
- `/retro compare 14d` — compare with explicit window

## Setup

Detect the default branch and current user:
```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
git fetch origin $DEFAULT_BRANCH --quiet
git config user.name
git config user.email
```

The name returned by `git config user.name` is "you" — the person reading this retro.
All other authors are teammates.

## Step 1: Gather Raw Data

Run ALL of these git commands (they are independent):

```bash
# 1. All commits with timestamps, subject, hash, author, stats
git log origin/$DEFAULT_BRANCH --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. Per-commit test vs total LOC breakdown
git log origin/$DEFAULT_BRANCH --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 3. Commit timestamps for session detection (use local timezone)
git log origin/$DEFAULT_BRANCH --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 4. Hotspot analysis
git log origin/$DEFAULT_BRANCH --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# 5. PR numbers from commit messages
git log origin/$DEFAULT_BRANCH --since="<window>" --format="%s" | grep -oE '#[0-9]+' | sort -n | uniq

# 6. Per-author commit counts
git shortlog origin/$DEFAULT_BRANCH --since="<window>" -sn --no-merges

# 7. TODOS.md backlog (if available)
cat TODOS.md 2>/dev/null || true
```

## Step 2: Compute Metrics

Calculate and present in a summary table:

| Metric | Value |
|--------|-------|
| Commits to main | N |
| Contributors | N |
| PRs merged | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC ratio | N% |
| Active days | N |
| Detected sessions | N |

Then show a per-author leaderboard:
```
Contributor         Commits   +/-          Top area
You (name)               32   +2400/-300   src/
alice                    12   +800/-150    app/services/
```

## Step 3: Commit Time Distribution

Show hourly histogram using bar chart:
```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
```

Identify peak hours, dead zones, late-night clusters.

## Step 4: Work Session Detection

Detect sessions using 45-minute gap threshold between consecutive commits.

Classify:
- Deep sessions (50+ min)
- Medium sessions (20-50 min)
- Micro sessions (<20 min)

Calculate total active coding time, average session length, LOC per hour.

## Step 5: Commit Type Breakdown

Categorize by conventional commit prefix (feat/fix/refactor/test/chore/docs):
```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
```

Flag if fix ratio exceeds 50%.

## Step 6: Hotspot Analysis

Top 10 most-changed files. Flag files changed 5+ times.

## Step 7: PR Size Distribution

Bucket PRs: Small (<100 LOC), Medium (100-500), Large (500-1500), XL (1500+).

## Step 8: Focus Score + Ship of the Week

Focus score: percentage of commits touching the single most-changed top-level directory.
Ship of the week: highest-LOC PR in the window.

## Step 9: Team Member Analysis

For each contributor:
1. Commits and LOC
2. Areas of focus (top 3 directories)
3. Commit type mix
4. Session patterns
5. Test discipline
6. Biggest ship

For the current user ("You"): deepest treatment with all detail.

For each teammate:
- **Praise** (1-2 specific things): Anchor in actual commits. Not "great work" — say exactly what was good.
- **Opportunity for growth** (1 specific thing): Frame as leveling-up, not criticism. Anchor in data.

If solo repo: skip team breakdown.

## Step 10: Week-over-Week Trends (if window >= 14d)

Split into weekly buckets. Show trends for commits, LOC, test ratio, fix ratio.

## Step 11: Streak Tracking

```bash
# Team streak
git log origin/$DEFAULT_BRANCH --format="%ad" --date=format:"%Y-%m-%d" | sort -u
# Personal streak
git log origin/$DEFAULT_BRANCH --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Count consecutive days with at least 1 commit, going back from today.

## Step 12: Load History & Compare

```bash
ls -t .context/retros/*.json 2>/dev/null
```

If prior retros exist, load the most recent one and show trends:
```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
```

## Step 13: Save Retro History

```bash
mkdir -p .context/retros
```

Save a JSON snapshot with metrics, authors, version range, streak, and tweetable summary.

## Step 14: Write the Narrative

Structure:

1. **Tweetable summary** (first line):
   `Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d`

2. **Summary Table** (from Step 2)
3. **Trends vs Last Retro** (from Step 12, skip if first retro)
4. **Time & Session Patterns** (Steps 3-4)
5. **Shipping Velocity** (Steps 5-7)
6. **Code Quality Signals** — test ratio, hotspots, XL PRs
7. **Focus & Highlights** (Step 8)
8. **Your Week** — personal deep-dive
9. **Team Breakdown** — per-teammate sections (skip if solo)
10. **Top 3 Team Wins**
11. **3 Things to Improve** — specific, actionable, anchored in commits
12. **3 Habits for Next Week** — small, practical, <5 min to adopt

## Compare Mode

When `/retro compare`:
1. Compute metrics for current window
2. Compute metrics for prior same-length window (using `--since` and `--until`)
3. Show side-by-side comparison with deltas
4. Narrative highlighting biggest improvements and regressions

## Tone

- Encouraging but candid, no coddling
- Specific and concrete — always anchor in actual commits
- Skip generic praise — say exactly what was good and why
- Frame improvements as leveling up, not criticism
- Never compare teammates negatively
- Keep total output around 3000-4500 words
- Output directly to the conversation — only file written is `.context/retros/` JSON snapshot

## Important Rules

- Use `origin/$DEFAULT_BRANCH` for all git queries (not local main)
- If the window has zero commits, say so and suggest a different window
- Round LOC/hour to nearest 50
- Treat merge commits as PR boundaries
- On first run (no prior retros), skip comparison sections gracefully
