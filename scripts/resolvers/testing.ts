import type { TemplateContext } from './types';
import { generateTestFailureTriage } from './preamble';

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
Read 2-3 existing test files to learn conventions (naming, imports, assertion style, setup patterns).
Store conventions as prose context for use in Phase 8e.5 or Step 3.4. **Skip the rest of bootstrap.**

**If BOOTSTRAP_DECLINED** appears: Print "Test bootstrap previously declined — skipping." **Skip the rest of bootstrap.**

**If NO runtime detected** (no config files found): Use AskUserQuestion:
"I couldn't detect your project's language. What runtime are you using?"
Options: A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) This project doesn't need tests.
If user picks H → write \`.gstack/no-test-bootstrap\` and continue without tests.

**If runtime detected but no test framework — bootstrap:**

### B2. Research best practices

Use WebSearch to find current best practices for the detected runtime:
- \`"[runtime] best test framework 2025 2026"\`
- \`"[framework A] vs [framework B] comparison"\`

If WebSearch is unavailable, use this built-in knowledge table:

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

1. Install the chosen packages (npm/bun/gem/pip/etc.)
2. Create minimal config file
3. Create directory structure (test/, spec/, etc.)
4. Create one example test matching the project's code to verify setup works

If package installation fails → debug once. If still failing → revert with \`git checkout -- package.json package-lock.json\` (or equivalent for the runtime). Warn user and continue without tests.

### B4.5. First real tests

Generate 3-5 real tests for existing code:

1. **Find recently changed files:** \`git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10\`
2. **Prioritize by risk:** Error handlers > business logic with conditionals > API endpoints > pure functions
3. **For each file:** Write one test that tests real behavior with meaningful assertions. Never \`expect(x).toBeDefined()\` — test what the code DOES.
4. Run each test. Passes → keep. Fails → fix once. Still fails → delete silently.
5. Generate at least 1 test, cap at 5.

Never import secrets, API keys, or credentials in test files. Use environment variables or test fixtures.

### B5. Verify

\`\`\`bash
# Run the full test suite to confirm everything works
{detected test command}
\`\`\`

If tests fail → debug once. If still failing → revert all bootstrap changes and warn user.

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

If non-GitHub CI detected → skip CI generation with note: "Detected {provider} — CI pipeline generation supports GitHub Actions only. Add test step to your existing pipeline manually."

### B6. Create TESTING.md

First check: If TESTING.md already exists → read it and update/append rather than overwriting. Never destroy existing content.

Write TESTING.md with:
- Philosophy: "100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower."
- Framework name and version
- How to run tests (the verified command from B5)
- Test layers: Unit tests (what, where, when), Integration tests, Smoke tests, E2E tests
- Conventions: file naming, assertion style, setup/teardown patterns

### B7. Update CLAUDE.md

First check: If CLAUDE.md already has a \`## Testing\` section → skip. Don't duplicate.

Append a \`## Testing\` section:
- Run command and test directory
- Reference to TESTING.md
- Test expectations:
  - 100% test coverage is the goal — tests make vibe coding safe
  - When writing new functions, write a corresponding test
  - When fixing a bug, write a regression test
  - When adding error handling, write a test that triggers the error
  - When adding a conditional (if/else, switch), write tests for BOTH paths
  - Never commit code that makes existing tests fail

### B8. Commit

\`\`\`bash
git status --porcelain
\`\`\`

Only commit if there are changes. Stage all bootstrap files (config, test directory, TESTING.md, CLAUDE.md, .github/workflows/test.yml if created):
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
    sections.push(`100% coverage is the goal — every untested path is a path where bugs hide and vibe coding becomes yolo coding. Evaluate what was ACTUALLY coded (from the diff), not what was planned.`);
  } else if (mode === 'plan') {
    sections.push(`100% coverage is the goal. Evaluate every codepath in the plan and ensure the plan includes tests for each one. If the plan is missing tests, add them — the plan should be complete enough that implementation includes full test coverage from the start.`);
  } else {
    sections.push(`100% coverage is the goal. Evaluate every codepath changed in the diff and identify test gaps. Gaps become INFORMATIONAL findings that follow the Fix-First flow.`);
  }

  // ── Test framework detection (shared) ──
  sections.push(`
### Test Framework Detection

Before analyzing coverage, detect the project's test framework:

1. **Read CLAUDE.md** — look for a \`## Testing\` section with test command and framework name. If found, use that as the authoritative source.
2. **If CLAUDE.md has no testing section, auto-detect:**

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

Read the plan document. For each new feature, service, endpoint, or component described, trace how data will flow through the code — don't just list planned functions, actually follow the planned execution:`
    : `**${mode === 'ship' ? '1' : 'Step 1'}. Trace every codepath changed** using \`git diff origin/<base>...HEAD\`:

Read every changed file. For each one, trace how data flows through the code — don't just list functions, actually follow the execution:`;

  const traceStep1 = mode === 'plan'
    ? `1. **Read the plan.** For each planned component, understand what it does and how it connects to existing code.`
    : `1. **Read the diff.** For each changed file, read the full file (not just the diff hunk) to understand context.`;

  sections.push(`
${traceSource}

${traceStep1}
2. **Trace data flow.** Starting from each entry point (route handler, exported function, event listener, component render), follow the data through every branch:
   - Where does input come from? (request params, props, database, API call)
   - What transforms it? (validation, mapping, computation)
   - Where does it go? (database write, API response, rendered output, side effect)
   - What can go wrong at each step? (null/undefined, invalid input, network failure, empty collection)
3. **Diagram the execution.** For each changed file, draw an ASCII diagram showing:
   - Every function/method that was added or modified
   - Every conditional branch (if/else, switch, ternary, guard clause, early return)
   - Every error path (try/catch, rescue, error boundary, fallback)
   - Every call to another function (trace into it — does IT have untested branches?)
   - Every edge: what happens with null input? Empty array? Invalid type?

This is the critical step — you're building a map of every line of code that can execute differently based on input. Every branch in this diagram needs a test.`);

  // ── User flow coverage (shared) ──
  sections.push(`
**${mode === 'ship' ? '2' : 'Step 2'}. Map user flows, interactions, and error states:**

Code coverage isn't enough — you need to cover how real users interact with the changed code. For each changed feature, think through:

- **User flows:** What sequence of actions does a user take that touches this code? Map the full journey (e.g., "user clicks 'Pay' → form validates → API call → success/failure screen"). Each step in the journey needs a test.
- **Interaction edge cases:** What happens when the user does something unexpected?
  - Double-click/rapid resubmit
  - Navigate away mid-operation (back button, close tab, click another link)
  - Submit with stale data (page sat open for 30 minutes, session expired)
  - Slow connection (API takes 10 seconds — what does the user see?)
  - Concurrent actions (two tabs, same form)
- **Error states the user can see:** For every error the code handles, what does the user actually experience?
  - Is there a clear error message or a silent failure?
  - Can the user recover (retry, go back, fix input) or are they stuck?
  - What happens with no network? With a 500 from the API? With invalid data from the server?
- **Empty/zero/boundary states:** What does the UI show with zero results? With 10,000 results? With a single character input? With maximum-length input?

Add these to your diagram alongside the code branches. A user flow with no test is just as much a gap as an untested if/else.`);

  // ── Check branches against tests + quality rubric (shared) ──
  sections.push(`
**${mode === 'ship' ? '3' : 'Step 3'}. Check each branch against existing tests:**

Go through your diagram branch by branch — both code paths AND user flows. For each one, search for a test that exercises it:
- Function \`processPayment()\` → look for \`billing.test.ts\`, \`billing.spec.ts\`, \`test/billing_test.rb\`
- An if/else → look for tests covering BOTH the true AND false path
- An error handler → look for a test that triggers that specific error condition
- A call to \`helperFn()\` that has its own branches → those branches need tests too
- A user flow → look for an integration or E2E test that walks through the journey
- An interaction edge case → look for a test that simulates the unexpected action

Quality scoring rubric:
- ★★★  Tests behavior with edge cases AND error paths
- ★★   Tests correct behavior, happy path only
- ★    Smoke test / existence check / trivial assertion (e.g., "it renders", "it doesn't throw")`);

  // ── E2E test decision matrix (shared) ──
  sections.push(`
### E2E Test Decision Matrix

When checking each branch, also determine whether a unit test or E2E/integration test is the right tool:

**RECOMMEND E2E (mark as [→E2E] in the diagram):**
- Common user flow spanning 3+ components/services (e.g., signup → verify email → first login)
- Integration point where mocking hides real failures (e.g., API → queue → worker → DB)
- Auth/payment/data-destruction flows — too important to trust unit tests alone

**RECOMMEND EVAL (mark as [→EVAL] in the diagram):**
- Critical LLM call that needs a quality eval (e.g., prompt change → test output still meets quality bar)
- Changes to prompt templates, system instructions, or tool definitions

**STICK WITH UNIT TESTS:**
- Pure function with clear inputs/outputs
- Internal helper with no side effects
- Edge case of a single function (null input, empty array)
- Obscure/rare flow that isn't customer-facing`);

  // ── Regression rule (shared) ──
  sections.push(`
### REGRESSION RULE (mandatory)

**IRON RULE:** When the coverage audit identifies a REGRESSION — code that previously worked but the diff broke — a regression test is ${mode === 'plan' ? 'added to the plan as a critical requirement' : 'written immediately'}. No AskUserQuestion. No skipping. Regressions are the highest-priority test because they prove something broke.

A regression is when:
- The diff modifies existing behavior (not new code)
- The existing test suite (if any) doesn't cover the changed path
- The change introduces a new failure mode for existing callers

When uncertain whether a change is a regression, err on the side of writing the test.${mode !== 'plan' ? '\n\nFormat: commit as `test: regression test for {what broke}`' : ''}`);

  // ── ASCII coverage diagram (shared) ──
  sections.push(`
**${mode === 'ship' ? '4' : 'Step 4'}. Output ASCII coverage diagram:**

Include BOTH code paths and user flows in the same diagram. Mark E2E-worthy and eval-worthy paths:

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

For each GAP identified in the diagram, add a test requirement to the plan. Be specific:
- What test file to create (match existing naming conventions)
- What the test should assert (specific inputs → expected outputs/behavior)
- Whether it's a unit test, E2E test, or eval (use the decision matrix)
- For regressions: flag as **CRITICAL** and explain what broke

The plan should be complete enough that when implementation begins, every test is written alongside the feature code — not deferred to a follow-up.`);

    // ── Test plan artifact (plan + ship) ──
    sections.push(`
### Test Plan Artifact

After producing the coverage diagram, write a test plan artifact to the project directory so \`/qa\` and \`/qa-only\` can consume it as primary test input:

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

This file is consumed by \`/qa\` and \`/qa-only\` as primary test input. Include only the information that helps a QA tester know **what to test and where** — not implementation details.`);
  } else if (mode === 'ship') {
    sections.push(`
**5. Generate tests for uncovered paths:**

If test framework detected (or bootstrapped in Step 2.5):
- Prioritize error handlers and edge cases first (happy paths are more likely already tested)
- Read 2-3 existing test files to match conventions exactly
- Generate unit tests. Mock all external dependencies (DB, API, Redis).
- For paths marked [→E2E]: generate integration/E2E tests using the project's E2E framework (Playwright, Cypress, Capybara, etc.)
- For paths marked [→EVAL]: generate eval tests using the project's eval framework, or flag for manual eval if none exists
- Write tests that exercise the specific uncovered path with real assertions
- Run each test. Passes → commit as \`test: coverage for {feature}\`
- Fails → fix once. Still fails → revert, note gap in diagram.

Caps: 30 code paths max, 20 tests generated max (code + user flow combined), 2-min per-test exploration cap.

If no test framework AND user declined bootstrap → diagram only, no generation. Note: "Test generation skipped — no test framework configured."

**Diff is test-only changes:** Skip Step 3.4 entirely: "No new application code paths to audit."

**6. After-count and coverage summary:**

\`\`\`bash
# Count test files after generation
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
\`\`\`

For PR body: \`Tests: {before} → {after} (+{delta} new)\`
Coverage line: \`Test Coverage Audit: N new code paths. M covered (X%). K tests generated, J committed.\`

**7. Coverage gate:**

Before proceeding, check CLAUDE.md for a \`## Test Coverage\` section with \`Minimum:\` and \`Target:\` fields. If found, use those percentages. Otherwise use defaults: Minimum = 60%, Target = 80%.

Using the coverage percentage from the diagram in substep 4 (the \`COVERAGE: X/Y (Z%)\` line):

- **>= target:** Pass. "Coverage gate: PASS ({X}%)." Continue.
- **>= minimum, < target:** Use AskUserQuestion:
  - "AI-assessed coverage is {X}%. {N} code paths are untested. Target is {target}%."
  - RECOMMENDATION: Choose A because untested code paths are where production bugs hide.
  - Options:
    A) Generate more tests for remaining gaps (recommended)
    B) Ship anyway — I accept the coverage risk
    C) These paths don't need tests — mark as intentionally uncovered
  - If A: Loop back to substep 5 (generate tests) targeting the remaining gaps. After second pass, if still below target, present AskUserQuestion again with updated numbers. Maximum 2 generation passes total.
  - If B: Continue. Include in PR body: "Coverage gate: {X}% — user accepted risk."
  - If C: Continue. Include in PR body: "Coverage gate: {X}% — {N} paths intentionally uncovered."

- **< minimum:** Use AskUserQuestion:
  - "AI-assessed coverage is critically low ({X}%). {N} of {M} code paths have no tests. Minimum threshold is {minimum}%."
  - RECOMMENDATION: Choose A because less than {minimum}% means more code is untested than tested.
  - Options:
    A) Generate tests for remaining gaps (recommended)
    B) Override — ship with low coverage (I understand the risk)
  - If A: Loop back to substep 5. Maximum 2 passes. If still below minimum after 2 passes, present the override choice again.
  - If B: Continue. Include in PR body: "Coverage gate: OVERRIDDEN at {X}%."

**Coverage percentage undetermined:** If the coverage diagram doesn't produce a clear numeric percentage (ambiguous output, parse error), **skip the gate** with: "Coverage gate: could not determine percentage — skipping." Do not default to 0% or block.

**Test-only diffs:** Skip the gate (same as the existing fast-path).

**100% coverage:** "Coverage gate: PASS (100%)." Continue.`);

    // ── Test plan artifact (ship mode) ──
    sections.push(`
### Test Plan Artifact

After producing the coverage diagram, write a test plan artifact so \`/qa\` and \`/qa-only\` can consume it:

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

If test framework is detected and gaps were identified:
- Classify each gap as AUTO-FIX or ASK per the Fix-First Heuristic:
  - **AUTO-FIX:** Simple unit tests for pure functions, edge cases of existing tested functions
  - **ASK:** E2E tests, tests requiring new test infrastructure, tests for ambiguous behavior
- For AUTO-FIX gaps: generate the test, run it, commit as \`test: coverage for {feature}\`
- For ASK gaps: include in the Fix-First batch question with the other review findings
- For paths marked [→E2E]: always ASK (E2E tests are higher-effort and need user confirmation)
- For paths marked [→EVAL]: always ASK (eval tests need user confirmation on quality criteria)

If no test framework detected → include gaps as INFORMATIONAL findings only, no generation.

**Diff is test-only changes:** Skip Step 4.75 entirely: "No new application code paths to audit."

### Coverage Warning

After producing the coverage diagram, check the coverage percentage. Read CLAUDE.md for a \`## Test Coverage\` section with a \`Minimum:\` field. If not found, use default: 60%.

If coverage is below the minimum threshold, output a prominent warning **before** the regular review findings:

\`\`\`
⚠️ COVERAGE WARNING: AI-assessed coverage is {X}%. {N} code paths untested.
Consider writing tests before running /ship.
\`\`\`

This is INFORMATIONAL — does not block /review. But it makes low coverage visible early so the developer can address it before reaching the /ship coverage gate.

If coverage percentage cannot be determined, skip the warning silently.`);
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

/**
 * Emit stack-aware "Run tests" content for /ship.
 *
 * Detection happens at skill-run time (not generator time) so a single
 * generated SKILL.md works across every host/project. The emitted bash
 * sniffs Gemfile / package.json to decide which branch to show the user,
 * then tells the skill-runner which instructions to follow.
 *
 * Current branches:
 *   - Rails (Gemfile contains "rails"): preserves the original block
 *     (bin/test-lane, db:test:prepare, app/services eval suites, etc.)
 *   - Generic fallback (anything else): run the project's test command,
 *     ask the user if none is obvious.
 *
 * Next.js gets a dedicated branch in a follow-up PR. Until then it lands
 * on the generic fallback, which fixes the pre-change behavior where
 * non-Rails projects followed Rails-only instructions.
 */
export function generateShipTestExecution(_ctx: TemplateContext): string {
  return `## Step 3: Run tests (on merged code)

**Detect the project stack** so you emit the right test instructions:

\`\`\`bash
_STACK="generic"
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && _STACK="rails"
echo "SHIP_STACK: $_STACK"
\`\`\`

Follow the section below that matches \`SHIP_STACK\`.

---

### If \`SHIP_STACK: rails\`

**Do NOT run \`RAILS_ENV=test bin/rails db:migrate\`** — \`bin/test-lane\` already calls
\`db:test:prepare\` internally, which loads the schema into the correct lane database.
Running bare test migrations without INSTANCE hits an orphan DB and corrupts structure.sql.

Run both test suites in parallel:

\`\`\`bash
bin/test-lane 2>&1 | tee /tmp/ship_tests.txt &
npm run test 2>&1 | tee /tmp/ship_vitest.txt &
wait
\`\`\`

After both complete, read the output files and check pass/fail.

**If any test fails:** Do NOT immediately stop. Apply the **Test Failure Ownership Triage** (section after the generic branch below).

**After triage:** If any in-branch failures remain unfixed, **STOP**. Do not proceed. If all failures were pre-existing and handled (fixed, TODOed, assigned, or skipped), continue to Step 3.25.

**If all pass:** Continue silently — just note the counts briefly.

---

#### Step 3.25: Eval Suites (conditional, Rails only)

Evals are mandatory when prompt-related files change. Skip this step entirely if no prompt files are in the diff.

**1. Check if the diff touches prompt-related files:**

\`\`\`bash
git diff origin/<base> --name-only
\`\`\`

Match against these patterns (from CLAUDE.md):
- \`app/services/*_prompt_builder.rb\`
- \`app/services/*_generation_service.rb\`, \`*_writer_service.rb\`, \`*_designer_service.rb\`
- \`app/services/*_evaluator.rb\`, \`*_scorer.rb\`, \`*_classifier_service.rb\`, \`*_analyzer.rb\`
- \`app/services/concerns/*voice*.rb\`, \`*writing*.rb\`, \`*prompt*.rb\`, \`*token*.rb\`
- \`app/services/chat_tools/*.rb\`, \`app/services/x_thread_tools/*.rb\`
- \`config/system_prompts/*.txt\`
- \`test/evals/**/*\` (eval infrastructure changes affect all suites)

**If no matches:** Print "No prompt-related files changed — skipping evals." and continue to Step 3.5.

**2. Identify affected eval suites:**

Each eval runner (\`test/evals/*_eval_runner.rb\`) declares \`PROMPT_SOURCE_FILES\` listing which source files affect it. Grep these to find which suites match the changed files:

\`\`\`bash
grep -l "changed_file_basename" test/evals/*_eval_runner.rb
\`\`\`

Map runner → test file: \`post_generation_eval_runner.rb\` → \`post_generation_eval_test.rb\`.

**Special cases:**
- Changes to \`test/evals/judges/*.rb\`, \`test/evals/support/*.rb\`, or \`test/evals/fixtures/\` affect ALL suites that use those judges/support files. Check imports in the eval test files to determine which.
- Changes to \`config/system_prompts/*.txt\` — grep eval runners for the prompt filename to find affected suites.
- If unsure which suites are affected, run ALL suites that could plausibly be impacted. Over-testing is better than missing a regression.

**3. Run affected suites at \`EVAL_JUDGE_TIER=full\`:**

\`/ship\` is a pre-merge gate, so always use full tier (Sonnet structural + Opus persona judges).

\`\`\`bash
EVAL_JUDGE_TIER=full EVAL_VERBOSE=1 bin/test-lane --eval test/evals/<suite>_eval_test.rb 2>&1 | tee /tmp/ship_evals.txt
\`\`\`

If multiple suites need to run, run them sequentially (each needs a test lane). If the first suite fails, stop immediately — don't burn API cost on remaining suites.

**4. Check results:**

- **If any eval fails:** Show the failures, the cost dashboard, and **STOP**. Do not proceed.
- **If all pass:** Note pass counts and cost. Continue to Step 3.5.

**5. Save eval output** — include eval results and cost dashboard in the PR body (Step 8).

**Tier reference (for context — /ship always uses \`full\`):**
| Tier | When | Speed (cached) | Cost |
|------|------|----------------|------|
| \`fast\` (Haiku) | Dev iteration, smoke tests | ~5s (14x faster) | ~$0.07/run |
| \`standard\` (Sonnet) | Default dev, \`bin/test-lane --eval\` | ~17s (4x faster) | ~$0.37/run |
| \`full\` (Opus persona) | **\`/ship\` and pre-merge** | ~72s (baseline) | ~$1.27/run |

---

### If \`SHIP_STACK: generic\` (default)

Run the project's test command. Detection order:

1. **Explicit scripts in \`package.json\`.** Prefer \`test\`, \`test:ci\`, or \`test:all\` if defined.
   \`\`\`bash
   [ -f package.json ] && node -e "const s=require('./package.json').scripts||{}; console.log(s['test:ci']||s['test:all']||s.test||'')" 2>/dev/null
   \`\`\`
2. **Makefile target.** Use if a \`test\` or \`check\` target exists.
   \`\`\`bash
   [ -f Makefile ] && grep -E '^(test|check):' Makefile 2>/dev/null
   \`\`\`
3. **Language default.** \`go test ./...\`, \`cargo test\`, \`pytest\`, \`bundle exec rspec\`, etc. Fall back here only when steps 1 and 2 find nothing.

Run the detected command and capture output:

\`\`\`bash
{detected command} 2>&1 | tee /tmp/ship_tests.txt
\`\`\`

**If no test command can be detected:** Use \`AskUserQuestion\`:
- Question: "I couldn't find a test command for this project. How should \`/ship\` run tests?"
- Options: ["Run \`<guess>\`", "Skip tests this ship", "Let me type the command"]

If the user picks "Skip tests this ship", print a loud warning in the PR body: *"Ship ran with \`--skip-tests\` per user choice. Verify manually before merge."*

**After the command finishes, read \`/tmp/ship_tests.txt\`:**

- **Any failure:** Apply the **Test Failure Ownership Triage** section below. If any in-branch failures remain after triage, **STOP**. Do not proceed.
- **All pass:** Continue silently, note counts briefly.

---

${generateTestFailureTriage()}
`;
}
