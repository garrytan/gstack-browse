---
name: hyper-plan
version: 1.0.0
description: |
  Recursive improvement mode that chains /plan-ceo-review → /plan-eng-review → execute
  fixes → /qa into an iterative loop with LLM-as-Judge convergence scoring. Runs up to
  7 iterations, each focused on the 2 weakest quality dimensions from the previous round.
  Stops when target grade is reached (default 8.0/10), improvement converges (<0.2 delta
  for 2 rounds), or any dimension regresses. Use when asked to "hyper-plan", "upgrade
  this codebase", "iterate until good", "recursive review", or "keep improving until done".
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Agent
  - AskUserQuestion
---

# Hyper-Plan: Recursive Codebase Improvement

You are running Hyper-Plan — a mode that turns gstack's review skills into a convergence
loop. Individual `/plan-ceo-review` and `/plan-eng-review` passes find issues. Hyper-Plan
closes the loop: find → fix → verify → score → repeat, focused tighter each round.

## Why This Exists

A single review pass finds problems. But fixing those problems can introduce new ones,
and the fixes themselves deserve review. Hyper-Plan treats codebase quality like gradient
descent — each iteration moves toward the target, with the judge preventing regressions.

## The Loop

```
ITERATION 1 (full scan):
  /plan-ceo-review HOLD SCOPE → strategic findings
  /plan-eng-review             → technical findings
  Compile findings → Execute P0/P1 fixes (up to 7 parallel agents)
  /qa diff-aware               → verify fixes
  JUDGE: Score 10 dimensions   → grade + 2 weakest dimensions

ITERATION 2-7 (focused):
  Review ONLY the 2 weakest dimensions from previous round
  Execute targeted fixes
  /qa → verify
  JUDGE → re-score → converge?
```

## Execution Protocol

### Step 0: Baseline

Before the first iteration, score the current codebase as-is. This is the "before" in
the before/after comparison. Save to `.hyper-plan/BASELINE.md`.

**STOP.** Show the user the baseline scores and ask:

> Your baseline grade is X.X/10. Default target is 8.0.
> What grade should I aim for? (or press enter for 8.0)

### Step 1: Review (iteration-aware)

**Iteration 1:** Run full `/plan-ceo-review` in HOLD SCOPE mode, then `/plan-eng-review`.
Both reviews produce findings. Compile into a single prioritized list.

**Iterations 2+:** Run focused reviews on ONLY the 2 dimensions the judge flagged.
Do not re-review dimensions that already score ≥ 8. This prevents thrashing.

### Step 2: Plan and Execute

Rank all findings: P0 (blocking) → P1 (high) → P2 (medium) → P3 (defer).

Execute P0 and P1 fixes. Use parallel agents when fixes touch different files.
Maximum 7 fixes per batch. After each batch, run the validation gate:

```bash
# Validation gate — all must pass before committing
ruff check . 2>/dev/null; npx tsc --noEmit 2>/dev/null; bun run lint 2>/dev/null
pytest 2>/dev/null || bun test 2>/dev/null
```

If the gate fails, fix lint/type errors before continuing. Commit each successful batch.
The Completeness Principle applies — when fixing an issue, fix it completely.

### Step 3: QA

Run `/qa` in diff-aware mode. It tests the pages and paths affected by this iteration's
changes. If QA finds new bugs, fix them before proceeding to the judge.

### Step 4: Judge

Score all 10 dimensions by reading actual source code. For each dimension:
1. Sample 3-5 relevant files using Glob/Grep
2. Read each file completely
3. Score 1-10 using the rubric below
4. Cite evidence (file:line for each score)
5. Identify the single highest-impact improvement

**Scoring rubric:**

| Dimension | 1-2 | 3-4 | 5-6 | 7-8 | 9-10 |
|-----------|-----|-----|-----|-----|------|
| Code Quality | Frequent bugs | Works but messy | Clean patterns | Elegant | Exemplary |
| Security | Known CVEs | Basic auth | OWASP covered | Pen-test ready | Hardened |
| Performance | >5s loads | Functional | Fast | Optimized | p99 <200ms |
| UX/UI | Broken | Functional | Good | Polished | Delightful |
| Test Coverage | None | <30% | 50-70% | 70-90% | 95%+ |
| Accessibility | None | Partial | WCAG AA | WCAG AAA | AAA + audit |
| Documentation | None | README | API docs | Comprehensive | Interactive |
| Error Handling | Crashes | try/catch | Logged | Recovery actions | Self-healing |
| Observability | None | console.log | Structured logs | Metrics + traces | Dashboards |
| Deploy Safety | Manual | CI | CD | Canary/flags | Blue-green |

**Overall grade** = average of all 10 dimensions.

### Step 5: Converge

After scoring, apply these rules in order:

1. **DEGRADED:** Any dimension scored LOWER than previous iteration → HALT.
   Something went wrong. Show the user which dimension dropped and why.

2. **SUCCESS:** Overall grade ≥ target → STOP. Show final report.

3. **CONVERGED:** Grade improved by <0.2 for this AND previous iteration → STOP.
   The codebase has plateaued at its current architecture.

4. **MAX_REACHED:** 7 iterations completed → STOP with current grade.

5. **CONTINUE:** Identify 2 lowest-scoring dimensions → focus next iteration on those.

## Output

Save all artifacts to `.hyper-plan/` (gitignored):

```
.hyper-plan/
├── BASELINE.md           # Pre-improvement scores
├── ITERATION-1.md        # Findings + fixes + scores
├── ITERATION-2.md        # Focused findings + fixes + scores
├── CONVERGENCE.md        # Grade progression table
└── FINAL-REPORT.md       # Before/after comparison
```

## Integration

Hyper-Plan orchestrates existing gstack skills — it does not replace them:
- `/plan-ceo-review` provides the strategic lens
- `/plan-eng-review` provides the technical depth
- `/qa` provides automated testing and health scoring
- `/review` can be used for final PR review after hyper-plan reaches target
- `/ship` can ship the result once quality is confirmed
