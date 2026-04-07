import type { TemplateContext } from './types';

export function generateTestBootstrap(_ctx: TemplateContext): string {
  return `## Test Framework Bootstrap

**Detect existing test framework and project runtime:**

\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Detect project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
[ -f composer.json ] && echo "RUNTIME:php"
[ -f mix.exs ] && echo "RUNTIME:elixir"
# Detect sub-frameworks
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
# Check for existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini pyproject.toml phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
# Check opt-out marker
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
\`\`\`

**If test framework detected** (config files or test directories found):
Print "Test framework detected: {name} ({N} existing tests). Skipping bootstrap."
Read 2-3 existing test files to learn conventions (naming, imports, assertion style, setup patterns). **Skip the rest of bootstrap.**

**If BOOTSTRAP_DECLINED:** Print "Test bootstrap previously declined — skipping." **Skip the rest of bootstrap.**

**If NO runtime detected:** Use AskUserQuestion:
"I couldn't detect your project's language. What runtime are you using?"
Options: A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) This project doesn't need tests.
If H → write \`.gstack/no-test-bootstrap\` and continue without tests.

**If runtime detected but no test framework:**

### B2. Research best practices

WebSearch: \`"[runtime] best test framework 2025 2026"\` and \`"[framework A] vs [framework B] comparison"\`.

If WebSearch unavailable, use this built-in knowledge table:

| Runtime | Primary recommendation | Alternative |
|---------|----------------------|-------------|
| Ruby/Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node.js | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Go | stdlib testing + testify | stdlib only |
| Rust | cargo test (built-in) + mockall | — |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit (built-in) + ex_machina | — |

### B3. Framework selection

Use AskUserQuestion:
"I detected this is a [Runtime/Framework] project with no test framework. I researched current best practices. Here are the options:
A) [Primary] — [rationale]. Includes: [packages]. Supports: unit, integration, smoke, e2e
B) [Alternative] — [rationale]. Includes: [packages]
C) Skip — don't set up testing right now
RECOMMENDATION: Choose A because [reason based on project context]"

If user picks C → write \`.gstack/no-test-bootstrap\`. Tell user: "If you change your mind later, delete \`.gstack/no-test-bootstrap\` and re-run." Continue without tests.

If multiple runtimes detected (monorepo) → ask which runtime to set up first, with option to do both sequentially.

### B4. Install and configure

1. Install chosen packages (npm/bun/gem/pip/etc.)
2. Create minimal config file
3. Create directory structure (test/, spec/, etc.)
4. Create one example test to verify setup works

If installation fails → debug once. If still failing → revert with \`git checkout -- package.json package-lock.json\` (or equivalent). Warn user and continue without tests.

### B4.5. First real tests

Generate 3-5 real tests for existing code:

1. **Find recently changed files:** \`git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10\`
2. **Prioritize by risk:** Error handlers > business logic > API endpoints > pure functions
3. **Write one test per file** for real behavior with meaningful assertions. Never \`expect(x).toBeDefined()\`.
4. Run each. Passes → keep. Fails → fix once. Still fails → delete silently.
5. At least 1 test, cap at 5.

Never import secrets or credentials. Use environment variables or test fixtures.

### B5. Verify

\`\`\`bash
{detected test command}
\`\`\`

If tests fail → debug once. Still failing → revert all bootstrap changes and warn user.

### B5.5. CI/CD pipeline

\`\`\`bash
# Check CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
\`\`\`

If \`.github/\` exists (or no CI detected — default to GitHub Actions):
Create \`.github/workflows/test.yml\` with:
- \`runs-on: ubuntu-latest\`
- Appropriate setup action for the runtime (setup-node, setup-ruby, setup-python, etc.)
- The same test command verified in B5
- Trigger: push + pull_request

If non-GitHub CI detected → skip CI generation: "Detected {provider} — CI generation supports GitHub Actions only. Add test step to your existing pipeline manually."

### B6. Create TESTING.md

If TESTING.md already exists → read and update/append, don't overwrite.

Write TESTING.md with:
- Philosophy: "100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower."
- Framework name and version
- How to run tests (verified command from B5)
- Test layers: Unit, Integration, Smoke, E2E
- Conventions: naming, assertion style, setup/teardown patterns

### B7. Update CLAUDE.md

If CLAUDE.md already has \`## Testing\` → skip. Don't duplicate.

Append \`## Testing\`:
- Run command and test directory; reference TESTING.md
- Expectations: 100% coverage goal; test new functions, regression-test bugs, test error handling, test both paths of every conditional; never commit with failing tests

### B8. Commit

\`\`\`bash
git status --porcelain
\`\`\`

Only commit if there are changes. Stage all bootstrap files:
\`git commit -m "chore: bootstrap test framework ({framework name})"\`

---`;
}

// ─── Test Coverage Audit ────────────────────────────────────
//
// Shared methodology for codepath tracing, ASCII diagrams, and test gap analysis.
// Three modes, three placeholders, one inner function:
//
//   {{TEST_COVERAGE_AUDIT_PLAN}}   → plan-eng-review: adds missing tests to the plan
//   {{TEST_COVERAGE_AUDIT_SHIP}}   → ship: auto-generates tests, coverage summary
//   {{TEST_COVERAGE_AUDIT_REVIEW}} → review: generates tests via Fix-First (ASK)
//
//   ┌────────────────────────────────────────────────┐
//   │  generateTestCoverageAuditInner(mode)          │
//   │                                                │
//   │  SHARED: framework detect, codepath trace,     │
//   │    ASCII diagram, quality rubric, E2E matrix,  │
//   │    regression rule                             │
//   │                                                │
//   │  plan:   edit plan file, write artifact        │
//   │  ship:   auto-generate tests, write artifact   │
//   │  review: Fix-First ASK, INFORMATIONAL gaps     │
//   └────────────────────────────────────────────────┘

type CoverageAuditMode = 'plan' | 'ship' | 'review';

function generateTestCoverageAuditInner(mode: CoverageAuditMode): string {
  const sections: string[] = [];

  // ── Intro (mode-specific) ──
  if (mode === 'ship') {
    sections.push(`100% coverage is the goal — every untested path is where bugs hide. Evaluate what was ACTUALLY coded (from the diff), not what was planned.`);
  } else if (mode === 'plan') {
    sections.push(`100% coverage is the goal. Evaluate every codepath in the plan; add missing tests — implementation should include full coverage from the start.`);
  } else {
    sections.push(`100% coverage is the goal. Evaluate every codepath changed in the diff; gaps become INFORMATIONAL findings following the Fix-First flow.`);
  }

  // ── Test framework detection (shared) ──
  sections.push(`
### Test Framework Detection

1. **Read CLAUDE.md** — look for \`## Testing\` section. If found, use as authoritative source.
2. **If no testing section, auto-detect:**

\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Detect project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
# Check for existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* cypress.config.* .rspec pytest.ini phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
\`\`\`

3. **If no framework detected:**${mode === 'ship' ? ' falls through to the Test Framework Bootstrap step (Step 2.5) which handles full setup.' : ' still produce the coverage diagram, but skip test generation.'}`);

  // ── Before/after count (ship only) ──
  if (mode === 'ship') {
    sections.push(`
**0. Before/after test count:**

\`\`\`bash
# Count test files before any generation
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
\`\`\`

Store this number for the PR body.`);
  }

  // ── Codepath tracing methodology (shared, with mode-specific source) ──
  const traceSource = mode === 'plan'
    ? `**Step 1. Trace every codepath in the plan:**

Read the plan document. For each new feature, service, endpoint, or component described, trace how data will flow through the code:`
    : `**${mode === 'ship' ? '1' : 'Step 1'}. Trace every codepath changed** using \`git diff origin/<base>...HEAD\`:

Read every changed file. For each one, trace how data flows through the code:`;

  const traceStep1 = mode === 'plan'
    ? `1. **Read the plan.** For each planned component, understand what it does and how it connects to existing code.`
    : `1. **Read the diff.** For each changed file, read the full file (not just the diff hunk) to understand context.`;

  sections.push(`
${traceSource}

${traceStep1}
2. **Trace data flow.** From each entry point (route handler, exported function, event listener, component render), follow data through every branch:
   - Where does input come from? (request params, props, database, API call)
   - What transforms it? (validation, mapping, computation)
   - Where does it go? (database write, API response, rendered output, side effect)
   - What can go wrong? (null/undefined, invalid input, network failure, empty collection)
3. **Diagram the execution.** For each changed file, draw an ASCII diagram showing:
   - Every function/method added or modified
   - Every conditional branch (if/else, switch, ternary, guard clause, early return)
   - Every error path (try/catch, rescue, error boundary, fallback)
   - Every call to another function (trace into it — does IT have untested branches?)
   - Every edge: null input? Empty array? Invalid type?

This is the critical step — building a map of every line that can execute differently based on input. Every branch needs a test.`);

  // ── User flow coverage (shared) ──
  sections.push(`
**${mode === 'ship' ? '2' : 'Step 2'}. Map user flows, interactions, and error states:**

Code coverage isn't enough — cover how real users interact with changed code:

- **User flows:** Map the full journey (e.g., "click 'Pay' → validate → API → success/failure"). Each step needs a test.
- **Interaction edge cases:** double-click/rapid resubmit, navigate away mid-operation, stale data (session expired), slow connection, concurrent actions (two tabs).
- **Error states:** For every handled error — clear message or silent failure? Can the user recover? No network? 500 from API? Invalid server data?
- **Empty/zero/boundary states:** Zero results? 10,000 results? Single character? Max-length input?

Add these to your diagram. An untested user flow is as much a gap as an untested if/else.`);

  // ── Check branches against tests + quality rubric (shared) ──
  sections.push(`
**${mode === 'ship' ? '3' : 'Step 3'}. Check each branch against existing tests:**

Go through your diagram — code paths AND user flows. Search for a covering test for each:
- \`processPayment()\` → look for \`billing.test.ts\`, \`billing.spec.ts\`, \`test/billing_test.rb\`
- if/else → tests for BOTH true AND false paths
- Error handler → test that triggers that specific error
- \`helperFn()\` with its own branches → those branches need tests too
- User flow → integration or E2E test walking the journey
- Edge case → test simulating the unexpected action

Quality rubric:
- ★★★  Tests behavior with edge cases AND error paths
- ★★   Tests correct behavior, happy path only
- ★    Smoke test / existence check / trivial assertion`);

  // ── E2E test decision matrix (shared) ──
  sections.push(`
### E2E Test Decision Matrix

**[→E2E]:** User flow spanning 3+ components/services; integration point where mocking hides real failures; auth/payment/data-destruction flows.

**[→EVAL]:** Critical LLM call needing quality eval; changes to prompt templates, system instructions, or tool definitions.

**Unit tests:** Pure function; internal helper with no side effects; edge case of a single function; obscure non-customer-facing flow.`);

  // ── Regression rule (shared) ──
  sections.push(`
### REGRESSION RULE (mandatory)

**IRON RULE:** When the audit identifies a REGRESSION — code the diff broke — a regression test is ${mode === 'plan' ? 'added to the plan as a critical requirement' : 'written immediately'}. No AskUserQuestion. No skipping.

A regression: the diff modifies existing behavior; the test suite doesn't cover the changed path; the change introduces a new failure mode for existing callers.

When uncertain, err on the side of writing the test.${mode !== 'plan' ? '\n\nFormat: `test: regression test for {what broke}`' : ''}`);

  // ── ASCII coverage diagram (shared) ──
  sections.push(`
**${mode === 'ship' ? '4' : 'Step 4'}. Output ASCII coverage diagram:**

Include BOTH code paths and user flows. Mark E2E-worthy and eval-worthy paths:

\`\`\`
CODE PATH COVERAGE
===========================
[+] src/services/billing.ts
    │
    ├── processPayment()
    │   ├── [★★★ TESTED] Happy path + card declined + timeout — billing.test.ts:42
    │   ├── [GAP]         Network timeout — NO TEST
    │   └── [GAP]         Invalid currency — NO TEST
    │
    └── refundPayment()
        ├── [★★  TESTED] Full refund — billing.test.ts:89
        └── [★   TESTED] Partial refund (checks non-throw only) — billing.test.ts:101

USER FLOW COVERAGE
===========================
[+] Payment checkout flow
    │
    ├── [★★★ TESTED] Complete purchase — checkout.e2e.ts:15
    ├── [GAP] [→E2E] Double-click submit — needs E2E, not just unit
    ├── [GAP]         Navigate away during payment — unit test sufficient
    └── [★   TESTED]  Form validation errors (checks render only) — checkout.test.ts:40

[+] Error states
    │
    ├── [★★  TESTED] Card declined message — billing.test.ts:58
    ├── [GAP]         Network timeout UX (what does user see?) — NO TEST
    └── [GAP]         Empty cart submission — NO TEST

[+] LLM integration
    │
    └── [GAP] [→EVAL] Prompt template change — needs eval test

─────────────────────────────────
COVERAGE: 5/13 paths tested (38%)
  Code paths: 3/5 (60%)
  User flows: 2/8 (25%)
QUALITY:  ★★★: 2  ★★: 2  ★: 1
GAPS: 8 paths need tests (2 need E2E, 1 needs eval)
─────────────────────────────────
\`\`\`

**Fast path:** All paths covered → "${mode === 'ship' ? 'Step 3.4' : mode === 'review' ? 'Step 4.75' : 'Test review'}: All new code paths have test coverage ✓" Continue.`);

  // ── Mode-specific action section ──
  if (mode === 'plan') {
    sections.push(`
**Step 5. Add missing tests to the plan:**

For each GAP, add a test requirement: test file name (match naming conventions), what to assert (inputs → expected outputs), unit/E2E/eval type. For regressions: flag **CRITICAL** and explain what broke.

The plan must be complete enough that every test is written alongside feature code — not deferred.`);

    // ── Test plan artifact (plan + ship) ──
    sections.push(`
### Test Plan Artifact

Write a test plan artifact for \`/qa\` and \`/qa-only\`:

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
\`\`\`

Write to \`~/.gstack/projects/{slug}/{user}-{branch}-eng-review-test-plan-{datetime}.md\`:

\`\`\`markdown
# Test Plan
Generated by /plan-eng-review on {date}
Branch: {branch}
Repo: {owner/repo}

## Affected Pages/Routes
- {URL path} — {what to test and why}

## Key Interactions to Verify
- {interaction description} on {page}

## Edge Cases
- {edge case} on {page}

## Critical Paths
- {end-to-end flow that must work}
\`\`\`

Include only what helps a QA tester know **what to test and where**.`);
  } else if (mode === 'ship') {
    sections.push(`
**5. Generate tests for uncovered paths:**

If test framework detected (or bootstrapped in Step 2.5):
- Prioritize error handlers and edge cases first
- Read 2-3 existing test files to match conventions
- Unit tests: mock all external dependencies (DB, API, Redis)
- [→E2E] paths: generate integration/E2E tests using the project's E2E framework
- [→EVAL] paths: generate eval tests or flag for manual eval if none exists
- Run each. Passes → commit as \`test: coverage for {feature}\`. Fails → fix once. Still fails → revert, note gap.

Caps: 30 code paths, 20 tests, 2-min per-test exploration.

If no test framework AND user declined bootstrap → diagram only. Note: "Test generation skipped — no test framework configured."

**Diff is test-only changes:** Skip Step 3.4: "No new application code paths to audit."

**6. After-count and coverage summary:**

\`\`\`bash
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
\`\`\`

PR body: \`Tests: {before} → {after} (+{delta} new)\`
Coverage line: \`Test Coverage Audit: N new code paths. M covered (X%). K tests generated, J committed.\`

**7. Coverage gate:**

Check CLAUDE.md for \`## Test Coverage\` with \`Minimum:\` and \`Target:\` fields. Defaults: Minimum = 60%, Target = 80%.

Using \`COVERAGE: X/Y (Z%)\` from the diagram:

- **>= target:** "Coverage gate: PASS ({X}%)." Continue.
- **>= minimum, < target:** AskUserQuestion:
  - "AI-assessed coverage is {X}%. {N} paths untested. Target is {target}%."
  - Options: A) Generate more tests (recommended) B) Ship — I accept the risk C) Mark uncovered paths as intentional
  - A: loop back to substep 5, max 2 passes. B: PR body "Coverage gate: {X}% — user accepted risk." C: PR body "Coverage gate: {X}% — {N} paths intentionally uncovered."

- **< minimum:** AskUserQuestion:
  - "AI-assessed coverage is critically low ({X}%). {N} of {M} paths untested. Minimum: {minimum}%."
  - Options: A) Generate tests (recommended) B) Override — ship anyway
  - A: loop back, max 2 passes. B: PR body "Coverage gate: OVERRIDDEN at {X}%."

**Undetermined percentage:** Skip the gate: "Coverage gate: could not determine percentage — skipping." Don't default to 0%.

**Test-only diffs:** Skip the gate. **100%:** "Coverage gate: PASS (100%)." Continue.`);

    // ── Test plan artifact (ship mode) ──
    sections.push(`
### Test Plan Artifact

Write a test plan artifact for \`/qa\` and \`/qa-only\`:

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
\`\`\`

Write to \`~/.gstack/projects/{slug}/{user}-{branch}-ship-test-plan-{datetime}.md\`:

\`\`\`markdown
# Test Plan
Generated by /ship on {date}
Branch: {branch}
Repo: {owner/repo}

## Affected Pages/Routes
- {URL path} — {what to test and why}

## Key Interactions to Verify
- {interaction description} on {page}

## Edge Cases
- {edge case} on {page}

## Critical Paths
- {end-to-end flow that must work}
\`\`\``);
  } else {
    // review mode
    sections.push(`
**Step 5. Generate tests for gaps (Fix-First):**

If test framework detected and gaps identified:
- **AUTO-FIX:** Simple unit tests for pure functions, edge cases of existing tested functions → generate, run, commit as \`test: coverage for {feature}\`
- **ASK:** E2E tests, new test infrastructure, ambiguous behavior → include in Fix-First batch question
- [→E2E] always ASK; [→EVAL] always ASK

If no test framework → INFORMATIONAL findings only, no generation.

**Diff is test-only changes:** Skip Step 4.75: "No new application code paths to audit."

### Coverage Warning

Check coverage percentage. Read CLAUDE.md for \`## Test Coverage\` with \`Minimum:\` field (default: 60%).

If below minimum, output **before** review findings:

\`\`\`
⚠️ COVERAGE WARNING: AI-assessed coverage is {X}%. {N} code paths untested.
Consider writing tests before running /ship.
\`\`\`

INFORMATIONAL — does not block /review. If coverage percentage undetermined, skip silently.`);
  }

  return sections.join('\n');
}

export function generateTestCoverageAuditPlan(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('plan');
}

export function generateTestCoverageAuditShip(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('ship');
}

export function generateTestCoverageAuditReview(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('review');
}
