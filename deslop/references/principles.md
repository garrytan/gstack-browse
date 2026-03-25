# Deslop Principles Reference

This is the compact gstack reference used by `/deslop`.

Use it as a checklist, not dogma:

1. Start with the quick guide and priority matrix.
2. Load only the sections that match the smells you actually see.
3. Prefer a few high-confidence findings over a long list of style nits.

## Quick Diagnostic Guide

| Symptom | Likely principle | Default move |
| --- | --- | --- |
| Function is hard to hold in your head | Cognitive Load, Small Functions | Split by responsibility |
| Deep nesting | Guard Clauses | Exit early and flatten flow |
| Duplicate code in 3+ places | DRY | Extract shared behavior |
| Repeated data in multiple places | Single Source of Truth | Pick one authoritative owner |
| Magic numbers or unclear names | Self-Documenting Code | Name the concept |
| A type or module does too many jobs | Separation of Concerns | Split by responsibility |
| Long method chains | Law of Demeter | Delegate through a local seam |
| Constructor creates its own collaborators | Dependency Injection | Pass dependencies in |
| Command both mutates and returns rich data | Command-Query Separation | Separate mutation from query |
| Invalid data handled late | Parse, Don't Validate | Normalize at the boundary |
| Same request can be safely repeated | Idempotency | Preserve that property |
| Failure is swallowed or vague | Fail Fast, Observability | Raise clearly and log context |
| Cleanup never happens | Boy Scout Rule | Leave touched code cleaner |

## Priority Matrix

| Priority | Type | Examples | Default action |
| --- | --- | --- | --- |
| P0 | Security or correctness | Trust-boundary bugs, unsafe mutation, data loss | Fix now |
| P1 | High-risk maintainability | Silent failures, undefined ownership, brittle branches | Fix in this change |
| P2 | Medium maintainability | Duplication, wrong abstraction, over-coupling | Fix when touching the area |
| P3 | Low-impact polish | Naming, constants, light cleanup | Fix if cheap |

Bias upward for quick wins. Bias downward if the fix is risky and untested.

## Principle Tensions

- DRY vs Wrong Abstraction: Duplication is often cheaper than a premature abstraction. Extract only when the repeated behavior is truly the same concept.
- YAGNI vs Flexibility: Small seams are good; speculative frameworks are not.
- DAMP Tests vs DRY Tests: Tests should read like intent, even if that means repeating setup.
- Postel vs Security: Be generous only inside trusted boundaries. At external boundaries, parse strictly and fail closed.

## Part I: Clean Code

### KISS

- Prefer the most direct design that solves the real problem.
- Smells: helper pyramids, unnecessary indirection, configurable behavior for one caller.
- Default fix: inline, delete, or simplify until the code path is obvious.

### YAGNI

- Do not build extension points before there is evidence they are needed.
- Smells: dead flags, unused hooks, generic abstractions with one implementation.
- Default fix: remove speculative flexibility and keep the present use case explicit.

### Small Functions

- A function should do one thing at one level of abstraction.
- Smells: 50-line methods, mixed parsing and orchestration, boolean parameters that fork behavior.
- Default fix: extract helpers with names that explain the step.

### Guard Clauses

- Handle invalid or exceptional cases first, then keep the happy path straight.
- Smells: 3+ nesting levels, inverted flow, deeply nested conditionals.
- Default fix: early return for invalid states, then let the main path read top to bottom.

### Cognitive Load

- Optimize for how hard code is to understand, not how clever it is.
- Smells: heavy branching, mutable shared state, context that must be remembered across many lines.
- Default fix: shorten scopes, reduce branching, and give intermediate concepts names.

### Single Level of Abstraction

- Keep one function at one conceptual altitude.
- Smells: a method that mixes HTTP parsing, business rules, and SQL details.
- Default fix: move low-level details into helpers or move orchestration into a higher-level function.

### Self-Documenting Code

- Names should carry intent so comments do not need to explain basic behavior.
- Smells: `tmp`, `data2`, `process()`, magic constants, comments that merely translate syntax to English.
- Default fix: rename values and extract named constants for important domain concepts.

### Documentation Discipline

- Code explains how; comments explain why, invariants, or surprising tradeoffs.
- Smells: stale comments, comments narrating obvious code, missing explanation for non-obvious constraints.
- Default fix: delete misleading comments and keep only the context future readers truly need.

### Least Surprise

- APIs and behavior should match what a reasonable caller expects.
- Smells: inconsistent return shapes, hidden mutation, helpers with surprising side effects.
- Default fix: align naming, return values, and side effects with common expectations.

## Part II: Architecture

### DRY

- Keep one authoritative implementation per concept.
- Smells: same validation, mapping, or policy logic repeated in multiple places.
- Default fix: extract shared behavior only when the rule is actually shared and stable.

### Single Source of Truth

- Every important fact should have one owner.
- Smells: duplicated configuration, mirrored state, derived data stored in multiple places.
- Default fix: choose the owner and derive everything else from it.

### Separation of Concerns

- Give each module one primary reason to change.
- Smells: route handlers doing parsing, business logic, persistence, and presentation.
- Default fix: separate orchestration from domain rules from IO details.

### Modularity

- Modules should hide internals and expose small interfaces.
- Smells: callers reaching through multiple layers, broad imports, internal structures leaking out.
- Default fix: collapse hidden details behind a narrower public seam.

### Encapsulation

- Bind data with the behavior that preserves its invariants.
- Smells: callers pulling internal state out, modifying it, and pushing it back later.
- Default fix: move operations to the owner of the data.

### Law of Demeter

- Talk to your collaborators, not your collaborators' collaborators.
- Smells: `a.b().c().d()` chains and remote knowledge of internal structure.
- Default fix: add a local method on the nearer object and call that instead.

### Orthogonality

- Changes in one concept should not force edits in unrelated areas.
- Smells: adding a mode requires touching routing, rendering, storage, and logging in parallel.
- Default fix: decouple the shared concept from unrelated concerns.

### Dependency Injection

- Pass dependencies in; do not construct hidden globals inside business logic.
- Smells: hard-coded clients, time sources, random generators, or service constructors inside methods.
- Default fix: inject collaborators so tests and alternate environments remain simple.

### Composition Over Inheritance

- Prefer assembling small behaviors over extending deep class hierarchies.
- Smells: deep inheritance trees, fragile overrides, parent classes with broad responsibilities.
- Default fix: extract shared behavior into collaborators or small composable helpers.

### SOLID

- Use SRP to find oversized modules.
- Use OCP carefully: extend through small seams, not speculative frameworks.
- Use LSP and ISP to keep interfaces honest and small.
- Use DIP when high-level logic depends on concrete IO details.

### Convention Over Configuration

- Sensible defaults beat repetitive setup.
- Smells: the same configuration copied across every caller.
- Default fix: make the common path automatic and keep escape hatches explicit.

### Command-Query Separation

- A function should either change state or answer a question, not both in a surprising way.
- Smells: "getter" methods with mutation, writes that also return expensive computed state.
- Default fix: split mutation from query unless the combined API is clearly intentional.

### Code Reusability

- Reuse is earned after repetition, not designed in advance.
- Smells: abstract base types with one implementation, utility packages with no real callers.
- Default fix: keep concrete code until reuse becomes obvious.

## Part III: Data and State

### Parse, Don't Validate

- Turn untrusted inputs into trusted domain values at the boundary.
- Smells: raw dictionaries and loosely typed maps flowing deep into business logic.
- Default fix: parse once, then operate on values that prove their own validity.

### Immutability

- Limit mutation to well-defined ownership boundaries.
- Smells: objects modified in place across many scopes, hidden shared state, temporal coupling.
- Default fix: return new values when practical and isolate the few places that mutate.

### Idempotency

- Repeating the same action should not create unintended side effects when the operation is meant to be retry-safe.
- Smells: duplicate jobs, duplicate writes, repeated side effects on retry.
- Default fix: add idempotency keys, existence checks, or safe upsert behavior.

## Part IV: Reliability and Operations

### Fail Fast

- Detect invalid state early and loudly.
- Smells: swallowed exceptions, broad fallback paths, errors discovered far downstream.
- Default fix: validate at entry points, raise precise errors, and stop on impossible state.

### Design by Contract

- Make preconditions, invariants, and postconditions explicit.
- Smells: hidden assumptions about inputs, missing shape checks, unclear return guarantees.
- Default fix: define the contract at the seam and enforce it near the boundary.

### Postel's Law

- Inside trusted systems, accept slightly varied input if that improves compatibility.
- At external trust boundaries, do not be liberal; parse strictly.
- Default fix: be conservative in what you emit, but do not weaken security or invariants for convenience.

### Resilience

- Systems should fail clearly and degrade deliberately under partial failure.
- Smells: retries without limits, silent fallback behavior, missing timeout handling.
- Default fix: set clear timeout, retry, and fallback policies with visible error paths.

### Least Privilege

- Give code and users only the permissions they need.
- Smells: overbroad access tokens, wide write surfaces, admin-by-default behavior.
- Default fix: narrow scopes, enforce ownership, and fail closed on unauthorized access.

### Boy Scout Rule

- Leave touched code cleaner than you found it.
- Smells: obvious dead code, stale names, unaddressed local mess in files you are already editing.
- Default fix: pay down small debt while in the file, but do not turn a focused change into a giant rewrite.

### Observability

- Production behavior should be understandable from logs, metrics, traces, and structured metadata.
- Smells: silent failures, generic errors, missing request context, logs without identifiers.
- Default fix: emit structured events with enough context to explain what happened without leaking secrets.

## Default Recommendations by Smell

- Duplicate logic in 2 places: note it, but do not force extraction unless the concept is stable.
- Duplicate logic in 3+ places: DRY issue. Recommend consolidation.
- Boolean flag changing behavior: consider splitting into named functions or strategies.
- Long parameter list: consider a value object only if the parameters form a real concept.
- Large class or module: split by responsibility, not by arbitrary file size.
- Giant cleanup opportunity with no tests: recommend staging the work instead of doing it blindly.

## Context-Specific Exceptions

- Prototypes and spikes: optimize for learning, then delete or harden before shipping.
- Test code: descriptive setup is often better than abstract helpers.
- Very small scripts: structure matters less than clarity.
- Hot paths: measure before abstracting or de-abstracting for performance.
- Generated code: fix the generator, not the generated output.

## What `/deslop` Should Not Do

- Do not turn a clean concrete implementation into a generic framework.
- Do not flag every stylistic preference as a principle violation.
- Do not recommend a rewrite when a local cleanup solves the real risk.
- Do not ignore trust boundaries, concurrency, or operational failure modes while nitpicking formatting.
