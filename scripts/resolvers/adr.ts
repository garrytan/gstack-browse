/**
 * ADR (Architectural Decision Records) resolver
 *
 * Generates the {{ADR_DISCOVERY}} placeholder used by consuming skills
 * (/plan-eng-review, /review, /plan-ceo-review, /investigate) to discover
 * and surface existing ADRs.
 *
 * ADR files live in docs/adr/ (repo, not ~/.gstack/).
 * Config lives in docs/adr/.config (repo-local, not gstack-config).
 */
import type { TemplateContext } from './types';

export function generateADRDiscovery(_ctx: TemplateContext): string {
  return `### ADR Discovery

\`\`\`bash
ADR_DIR="docs/adr"
if [ -d "$ADR_DIR" ]; then
  ADR_COUNT=$(ls "$ADR_DIR"/[0-9]*.md 2>/dev/null | wc -l | tr -d ' ')
  ADR_ACCEPTED=$(grep -l 'status:.*accepted' "$ADR_DIR"/[0-9]*.md 2>/dev/null | wc -l | tr -d ' ')
  ADR_PROPOSED=$(grep -l 'status:.*proposed' "$ADR_DIR"/[0-9]*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "ADR: $ADR_COUNT total ($ADR_ACCEPTED accepted, $ADR_PROPOSED proposed)"
else
  echo "ADR: none (no docs/adr/ directory)"
fi
\`\`\`

If ADRs exist (count > 0), read the accepted ADRs relevant to the current work.
Check whether the current plan or changes contradict any accepted ADR decisions.
Surface proposed ADRs as "pending decisions" context — they inform but do not constrain.
If a contradiction is found, flag it with the specific ADR number and the conflict.
`;
}

export function generateADRGate(ctx: TemplateContext): string {
  // Self-exclusion: don't inject the gate into the /adr skill itself
  if (ctx.skillName === 'adr') return '';

  return `### ADR Decision Gate

\`\`\`bash
_ADR_GATE=""
if [ -d "docs/adr" ] && [ -f "docs/adr/.config" ]; then
  _ADR_SENSITIVITY=$(grep 'sensitivity:' docs/adr/.config 2>/dev/null | sed 's/.*sensitivity:[[:space:]]*//' | tr -d '[:space:]')
  [ -n "$_ADR_SENSITIVITY" ] && _ADR_GATE="active" && echo "ADR_GATE: active (sensitivity: $_ADR_SENSITIVITY)"
fi
\`\`\`

If \`ADR_GATE\` is active, follow these rules during this session:

**Before implementing** any of these changes, pause and ask the user:
- Adding a new external dependency, service, or infrastructure component
- Choosing or changing a database, message queue, cache layer, or storage engine
- Designing or modifying a public API signature (REST, GraphQL, SDK, webhook)
- Modifying a data schema in ways that require migration
- Selecting a framework, language, or architectural pattern that will propagate
- Making a build-vs-buy decision
- Introducing a new auth, authorization, or security mechanism
- Committing to a third-party vendor or SaaS integration
- Choosing a deployment architecture or hosting platform
- Setting a caching, consistency, or replication strategy

When a trigger fires:
1. **Do not write code yet.** Pause before implementing.
2. Explain in 2-3 sentences what you are about to do and why it is an architectural decision.
3. The user responds:
   - **"Skip"** or **"Go ahead"**: Log to \`docs/adr/.skipped.jsonl\` and continue:
     \`\`\`bash
     echo '{"date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","description":"DESCRIPTION","trigger":"TRIGGER_PATTERN"}' >> docs/adr/.skipped.jsonl
     \`\`\`
   - **"ADR this"**: Transition to \`/adr\` creation (Mode 1) with current context. Write the ADR before the code.
   - **"Tell me more"**: Run litmus-test questions (reversibility, blast radius, future constraint, explanation test) to help decide.

If sensitivity is \`liberal\`, only fire for high-confidence architectural decisions (new infrastructure, schema changes, public API changes). If \`conservative\` (default), fire for anything that matches the trigger list above.
`;
}
