---
name: bugfix
version: 1.0.0
description: |
  Test-driven bug fixing. Reproduce the bug, validate the root cause, write a
  failing test, fix it, verify, then close the test gap that let it through.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# /bugfix — Test-Driven Bug Fixing

You are running the `/bugfix` workflow. This is a structured, disciplined approach to fixing bugs. The goal is not just to fix the bug — it is to fix it provably and ensure the same class of bug cannot recur.

**Core principle: Reproduce → Prove → Fix → Verify → Improve.**

**Only stop for:**
- Cannot reproduce the bug (ask the user for more information)
- Hypothesis disproved twice with no clear alternative (ask the user for guidance)
- No test runner or test infrastructure detected (ask the user how to run tests)

**Never stop for:**
- Messy or unfamiliar code (read it, understand it, proceed)
- Large number of related tests to run (run them all)
- The fix being small (small fixes still need reproduction and verification)

---

## Step 1: Understand the Bug

Before touching any code:

1. Identify the **expected behavior** vs **actual behavior**.
2. Identify the file(s) and function(s) involved.
3. Check git blame and recent commits on the affected files — was this a regression?

```bash
git log --oneline -20 -- <suspected-file>
```

If the bug report is vague, **STOP** and use AskUserQuestion to get exact reproduction steps, expected vs actual behavior, and any error messages.

---

## Step 2: Run Existing Tests

**MANDATORY FIRST ACTION.** Before changing anything, run the tests related to the affected code.

This tells you three things:
- Whether tests exist for this code at all
- Whether existing tests already catch the bug (they should fail)
- If tests pass, there is a coverage gap for this scenario — note it for Step 8

---

## Step 3: Reproduce the Bug

**You MUST reproduce the bug before making any code changes.**

Try in order:
1. Write a failing test that triggers the exact scenario
2. Run the code and observe the failure directly
3. Inspect state (logs, data, config) to confirm the conditions

**If you cannot reproduce it, STOP.** Tell the user what you tried and use AskUserQuestion to request more information. Do NOT guess. Fixing a bug you cannot reproduce leads to wrong fixes.

---

## Step 4: Validate Your Hypothesis

Form a hypothesis about the root cause, then **prove it before writing the fix.**

The validation must produce evidence — not "I think this is the cause" but "I confirmed this is the cause because X." Add a log or assertion that confirms the bad state, write a targeted test, inspect the data directly, or trace the code path.

If your hypothesis is **disproved**, form a new one and repeat. Do NOT proceed to implementation on a wrong hypothesis.

---

## Step 5: Write a Failing Test (RED)

Write a test that reproduces the exact bug scenario:

- The test MUST **fail** before your fix, proving it catches the bug
- Name it descriptively so the bug scenario is documented in the test name
- Use realistic inputs that mirror the actual failure

Run the test and confirm it fails.

---

## Step 6: Implement the Fix (GREEN)

Fix the bug. Minimal change only.

- Do not refactor surrounding code.
- Do not add features.
- Do not "improve" unrelated things.

---

## Step 7: Verify

Run the reproduction test — it MUST pass.

Run all related tests — no regressions.

If any previously-passing test now fails, you introduced a regression. Fix it before proceeding.

---

## Step 8: Close the Test Gap

**Do not skip this step.** After the fix, answer: **why did existing tests not catch this?**

Common gaps: missing scenario, weak assertion (checked "not null" but not the value), test data that did not trigger the boundary condition, over-mocking that hid the real behavior.

Based on your analysis, add tests that prevent this **class** of bug — not just this instance. If the bug was a boundary issue, add boundary tests. If it was a missing edge case, add edge cases for the same function.

---

## Step 9: Summary

Output a brief summary:

```
## Bug Fix

**Bug**: [description]
**Root cause**: [what was actually wrong]
**Fix**: [what was changed]
**Reproduction test**: [test name] — RED before fix, GREEN after
**Regression check**: [suite] — all passing
**Test gap**: [why tests missed it, what was added]
**Files changed**: [list]
```

---

## Important Rules

- **Never fix a bug you cannot reproduce.** If you cannot trigger it, ask for help.
- **Never implement a fix without validating your hypothesis.** Prove the root cause first.
- **Never skip the test gap analysis.** Understanding WHY tests missed it is as valuable as the fix.
- **Never finish without improving test coverage.** The same bug class should be caught next time.
- **Never fix unrelated code.** Stay focused on the bug.
- **Always show RED → GREEN proof.** The user should see the test fail before the fix and pass after.
