# Stack Health Harness

`stack-health` is a config-driven health scanner for agent-heavy repositories.

It has two jobs:
- run hard integrity checks that should fail fast now,
- report softer policy debt that you can ratchet from warning to error as cleanup lands.

## Run It

```bash
bun run stack:health
bun run stack:health --json
bun run stack:health --strict-warnings
bun run stack:health --only generated-output-freshness,touchfile-consistency
```

## Check Types

### Command checks

Use these for invariants that already have a test or a dry-run mode.
Examples:
- generated-file freshness
- touchfile completeness
- audit compliance

### Pattern checks

Use these for source scans that are easier to express as policy patterns.
Examples:
- outbound telemetry surfaces
- funnel or authority-conversion copy
- mania-adjacent productivity framing

## Config Model

The harness reads `stack-health.config.json`.

Each check has:
- `id`: stable handle for `--only`
- `type`: `command` or `pattern`
- `description`: human-readable purpose
- `severity`: `error` or `warn`

Pattern checks also define:
- `include`: globs to scan
- `exclude`: optional globs to skip
- `matchers`: list of forbidden literals or regexes with finding messages

Manipulation-policy rules should also have fixture coverage in
`test/fixtures/stack-health-policy-fixtures.json` so the scanner is tested
against deliberate positive and negative examples, not only live repo text.

Command checks also define:
- `command`
- `args`
- optional `cwd`
- optional `timeoutMs`

## Reuse In Other Repos

The portable part is the pair:
- `scripts/stack-health.ts`
- `stack-health.config.json`

For runtime hardening, pair the harness with the repo's one-switch no-egress setting:

- `gstack-config set network_egress off`

That disables hosted telemetry sync, remote update checks, and community dashboard network calls while keeping local-only analytics and local checks available.

To apply this in another repo:
1. copy the script and config,
2. replace the command checks with that repo's existing fast integrity commands,
3. replace the pattern rules with that repo's own dark-pattern, telemetry, and autonomy-risk signatures,
4. start with `warn` for known debt and ratchet to `error` as the codebase is cleaned.

## Ratchet Strategy

A practical rollout looks like this:
1. hard-fail existing integrity checks immediately,
2. report policy debt as warnings,
3. fix one category at a time,
4. promote a warning rule to `error` once the repo is clean enough to enforce it.

That keeps the harness useful on day one without pretending the repo is already healthy.

## Manipulation Coverage

The current policy fixture corpus covers these families:
- founder and authority funneling
- mania-adjacent productivity hype
- coercive urgency and shame framing
- surveillance and hidden-consent language
- dependency and compliance-building copy

If you add a new manipulation family, add both:
- a config rule in `stack-health.config.json`
- positive and negative examples in `test/fixtures/stack-health-policy-fixtures.json`
