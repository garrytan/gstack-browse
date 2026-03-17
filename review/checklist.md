# Pre-Landing Review Checklist

## Instructions

Review the `git diff origin/main` output for the issues listed below. Be specific — cite `file:line` and suggest fixes. Skip anything that's fine. Only flag real problems.

**Two-pass review:**
- **Pass 1 (CRITICAL):** Run Data Mutation Safety and LLM Output Trust Boundary first. These can block `/ship`.
- **Pass 2 (INFORMATIONAL):** Run all remaining categories. These are included in the PR body but do not block.

**Output format:**

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocking /ship):
- [file:line] Problem description
  Fix: suggested fix

**Issues** (non-blocking):
- [file:line] Problem description
  Fix: suggested fix
```

If no issues found: `Pre-Landing Review: No issues found.`

Be terse. For each issue: one line describing the problem, one line with the fix. No preamble, no summaries, no "looks good overall."

---

## Review Categories

### Pass 1 — CRITICAL

#### Data Mutation Safety
- String interpolation in SQL or query builders (even if values are coerced — use parameterized queries or ORM safe bindings, e.g., Prisma `$queryRaw` with template literals, Knex `.where(?, val)`)
- TOCTOU races: check-then-set patterns that should be atomic WHERE + UPDATE (e.g., Prisma `updateMany` with `where`, raw `UPDATE ... WHERE`)
- Direct DB writes bypassing validation layers (e.g., raw SQL `UPDATE`, Prisma `$executeRaw`) on fields that have or should have constraints
- N+1 queries: eager/batch loading missing for associations used in loops or render paths (e.g., Prisma `include`/`select`, GraphQL DataLoader)

#### Race Conditions & Concurrency
- Read-check-write without uniqueness constraint or duplicate-key error handling (e.g., catch Prisma `P2002` unique constraint violation, or `ON CONFLICT` in raw SQL)
- Upsert/find-or-create on columns without unique DB index — concurrent calls can create duplicates
- Status transitions that don't use atomic `WHERE old_status = ? UPDATE SET new_status` — concurrent updates can skip or double-apply transitions
- `dangerouslySetInnerHTML` on user-controlled data (XSS) — check any unescaped HTML rendering, raw template interpolation, or injection of user input into DOM

#### LLM Output Trust Boundary
- LLM-generated values (emails, URLs, names) written to DB or passed to API calls without format validation. Add lightweight guards (`EMAIL_REGEXP`, `new URL()`, `.trim()`) before persisting.
- Structured tool output (arrays, objects) accepted without type/shape checks before database writes.

#### Enum & Value Completeness
When the diff introduces a new enum value, status string, tier name, or type constant:
- **Trace it through every consumer.** Read (don't just grep — READ) each file that switches on, filters by, or displays that value. If any consumer doesn't handle the new value, flag it. Common miss: adding a value to the frontend dropdown but the backend model/compute method doesn't persist it.
- **Check allowlists/filter arrays.** Search for constant arrays or enum definitions containing sibling values (e.g., if adding "revise" to tiers, find every `['quick', 'lfg', 'mega']` or `enum { Quick, Lfg, Mega }` and verify "revise" is included where needed).
- **Check `switch/case` or `if-else if` chains.** If existing code branches on the enum, does the new value fall through to a wrong default?
To do this: If Serena is active, use `find_referencing_symbols` to find all references with surrounding code snippets — returns only relevant lines, not full files. Otherwise, use Grep to find all references to the sibling values (e.g., grep for "lfg" or "mega" to find all tier consumers) and Read each match. This step requires reading code OUTSIDE the diff.

### Pass 2 — INFORMATIONAL

#### Conditional Side Effects
- Code paths that branch on a condition but forget to apply a side effect on one branch. Example: item promoted to verified but URL only attached when a secondary condition is true — the other branch promotes without the URL, creating an inconsistent record.
- Log messages that claim an action happened but the action was conditionally skipped. The log should reflect what actually occurred.

#### Magic Numbers & String Coupling
- Bare numeric literals used in multiple files — should be named constants documented together
- Error message strings used as query filters elsewhere (grep for the string — is anything matching on it?)

#### Dead Code & Consistency
- Variables assigned but never read
- Version mismatch between PR title and VERSION/CHANGELOG files
- CHANGELOG entries that describe changes inaccurately (e.g., "changed from X to Y" when X never existed)
- Comments/docstrings that describe old behavior after the code changed

#### LLM Prompt Issues
- 0-indexed lists in prompts (LLMs reliably return 1-indexed)
- Prompt text listing available tools/capabilities that don't match what's actually wired up in the `tool_classes`/`tools` array
- Word/token limits stated in multiple places that could drift

#### Test Gaps
- Negative-path tests that assert type/status but not the side effects (URL attached? field populated? callback fired?)
- Assertions on string content without checking format (e.g., asserting title present but not URL format)
- Mock assertion (e.g., `expect(fn).not.toHaveBeenCalled()`) missing when a code path should explicitly NOT call an external service
- Security enforcement features (blocking, rate limiting, auth) without integration tests verifying the enforcement path works end-to-end

#### Crypto & Entropy
- Truncation of data instead of hashing (last N chars instead of SHA-256) — less entropy, easier collisions
- `Math.random()` for security-sensitive values — use `crypto.randomUUID()` or `crypto.getRandomValues()` instead
- Non-constant-time comparisons (`==`) on secrets or tokens — vulnerable to timing attacks

#### Time Window Safety
- Date-key lookups that assume "today" covers 24h — report at 8am PT only sees midnight→8am under today's key
- Mismatched time windows between related features — one uses hourly buckets, another uses daily keys for the same data

#### Type Coercion at Boundaries
- Values crossing TypeScript→JSON→API boundaries (or any cross-serialization boundary) where type could change (numeric vs string) — hash/digest inputs must normalize types
- Hash/digest inputs that don't normalize types before serialization (`String()`, `.toString()`, `JSON.stringify()`) — `{ cores: 8 }` vs `{ cores: "8" }` produce different hashes

#### Component/Frontend
- Inline `<style>` blocks in components (re-parsed every render) — use CSS modules, styled-components, or a shared stylesheet
- O(n*m) lookups in render paths (`Array.find()` in a loop instead of `Map` or object lookup built once)
- Client-side `.filter()` on large datasets that could be a server-side WHERE clause or API filter parameter

---

## Gate Classification

```
CRITICAL (blocks /ship):          INFORMATIONAL (in PR body):
├─ Data Mutation Safety           ├─ Conditional Side Effects
├─ Race Conditions & Concurrency  ├─ Magic Numbers & String Coupling
├─ LLM Output Trust Boundary      ├─ Dead Code & Consistency
└─ Enum & Value Completeness      ├─ LLM Prompt Issues
                                   ├─ Test Gaps
                                   ├─ Crypto & Entropy
                                   ├─ Time Window Safety
                                   ├─ Type Coercion at Boundaries
                                   └─ Component/Frontend
```

---

## Suppressions — DO NOT flag these

- "X is redundant with Y" when the redundancy is harmless and aids readability (e.g., truthy check redundant with `length > 20`)
- "Add a comment explaining why this threshold/constant was chosen" — thresholds change during tuning, comments rot
- "This assertion could be tighter" when the assertion already covers the behavior
- Suggesting consistency-only changes (wrapping a value in a conditional to match how another constant is guarded)
- "Regex doesn't handle edge case X" when the input is constrained and X never occurs in practice
- "Test exercises multiple guards simultaneously" — that's fine, tests don't need to isolate every guard
- Eval threshold changes (max_actionable, min scores) — these are tuned empirically and change constantly
- Harmless no-ops (e.g., `.filter()` on an element that's never in the array)
- ANYTHING already addressed in the diff you're reviewing — read the FULL diff before commenting
