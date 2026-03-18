---
name: hyper-plan
description: |
  Recursive improvement mode that chains /plan-ceo-review → /plan-eng-review → /qa
  in an iterative loop with LLM-as-Judge scoring. Runs up to 7 iterations until a
  target quality grade is reached. Use when you want to systematically upgrade a
  codebase beyond a single review pass.

  Invoke with: /hyper-plan [target-grade]
  Default target: 8.0/10

  Example: /hyper-plan 9.0
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - Write
---

# Hyper-Plan: Recursive Improvement Mode

You are running **Hyper-Plan** — a recursive loop that chains gstack's review skills
into an iterative improvement pipeline with convergence control.

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  HYPER-PLAN LOOP (up to 7 iterations)               │
│                                                     │
│  1. /plan-ceo-review (HOLD SCOPE)                   │
│     → Strategic review, failure modes, delight opps  │
│                                                     │
│  2. /plan-eng-review                                │
│     → Architecture, edge cases, error handling       │
│                                                     │
│  3. Execute top findings (parallel agents)           │
│     → Fix P0/P1 issues from both reviews             │
│                                                     │
│  4. /qa (diff-aware mode)                           │
│     → Test changes, health score, regressions        │
│                                                     │
│  5. JUDGE: Score 10 dimensions (1-10 each)          │
│     → Code Quality, Security, Performance, UX/UI,   │
│       Tests, Accessibility, Docs, Error Handling,    │
│       Observability, Deployment Safety               │
│                                                     │
│  6. CONVERGE CHECK:                                 │
│     → grade >= target? STOP (SUCCESS)               │
│     → delta < 0.2? STOP (CONVERGED)                 │
│     → iteration >= 7? STOP (MAX)                    │
│     → any dimension decreased? HALT (DEGRADED)      │
│     → else: focus on 2 weakest → NEXT ITERATION     │
└─────────────────────────────────────────────────────┘
```

## Execution Protocol

### Iteration 1 (Full Scan)
1. Run `/plan-ceo-review` in HOLD SCOPE mode on the current codebase
2. Run `/plan-eng-review` focusing on architecture + robustness
3. Compile all findings into a prioritized list (P0/P1/P2/P3)
4. Execute P0 + P1 fixes using parallel agents (max 7 per batch)
5. Run `/qa` in diff-aware mode to validate changes
6. Score all 10 dimensions with evidence from actual code (file:line citations)
7. Compute overall grade and check convergence

### Iterations 2-7 (Focused)
The judge identifies the 2 lowest-scoring dimensions after each iteration.
Subsequent iterations focus exclusively on those dimensions:
- If Tests (4/10) and Security (5/10) are lowest → next iteration only reviews and fixes test coverage and security
- This prevents thrashing and ensures steady convergence

### Scoring Rubric

| Dimension | 1-2 | 3-4 | 5-6 | 7-8 | 9-10 |
|-----------|-----|-----|-----|-----|------|
| Code Quality | Bugs | Works | Clean | Elegant | Exemplary |
| Security | CVEs | Basic | OWASP | Pen-tested | Hardened |
| Performance | Slow | OK | Fast | Optimized | Edge-optimized |
| UX/UI | Broken | Functional | Good | Polished | Delightful |
| Test Coverage | 0% | 30% | 60% | 80% | 95%+ |
| Accessibility | None | Some | AA | AAA | AAA+Audit |
| Documentation | None | README | API docs | Full | Interactive |
| Error Handling | Crashes | try/catch | Logged | Recovery | Self-healing |
| Observability | None | Logs | Metrics | Traces | Dashboards |
| Deploy Safety | YOLO | CI | CD | Canary | Blue-green |

### Convergence Rules
- **SUCCESS**: overall grade >= target (default 8.0)
- **CONVERGED**: improvement < 0.2 for 2 consecutive iterations
- **MAX_REACHED**: 7 iterations completed
- **DEGRADED**: any dimension score decreased → HALT and investigate

### Judge Independence
The judge MUST:
- Read actual source code (file:line evidence required)
- Score independently from fix agents (no self-reporting)
- Lower scores when evidence is insufficient
- Flag any dimension that decreased

## Output

After each iteration, save progress to `.hyper-plan/`:
```
.hyper-plan/
├── ITERATION-1.md    # Full review findings + scores
├── ITERATION-2.md    # Focused review + updated scores
├── ...
├── CONVERGENCE.md    # Grade progression across iterations
└── FINAL-REPORT.md   # Summary with before/after comparison
```

## Integration with Existing gstack Skills

This skill orchestrates — it does not replace:
- `/plan-ceo-review` provides the strategic lens
- `/plan-eng-review` provides the technical depth
- `/qa` provides automated testing and health scoring
- `/review` can be used for final PR review
- `/ship` can be used after hyper-plan reaches target grade

## Credits

Hyper-Plan is inspired by [productupgrade](https://github.com/ShaheerKhawaja/productupgrade),
a 54-agent recursive improvement pipeline by Shaheer Khawaja (EntropyandCo).
