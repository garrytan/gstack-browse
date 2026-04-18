import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from '../types';

function loadJargonList(): string[] {
  const jargonPath = path.join(__dirname, '..', '..', 'jargon-list.json');
  try {
    const raw = fs.readFileSync(jargonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data?.terms)) return data.terms.filter((t: unknown): t is string => typeof t === 'string');
  } catch {
    // Missing or malformed: fall back to empty list. Writing Style block still fires,
    // but with no terms to gloss — graceful degradation.
  }
  return [];
}

export function generateWritingStyle(_ctx: TemplateContext): string {
  const terms = loadJargonList();
  const jargonBlock = terms.length > 0
    ? `**Jargon list** (gloss each on first use per skill invocation, if the term appears in your output):\n\n${terms.map(t => `- ${t}`).join('\n')}\n\nTerms not on this list are assumed plain-English enough.`
    : `**Jargon list:** (not loaded — \`scripts/jargon-list.json\` missing or malformed). Skip the jargon-gloss rule until the list is restored.`;

  return `## Writing Style (skip entirely if \`EXPLAIN_LEVEL: terse\` appears in the preamble echo OR the user's current message explicitly requests terse / no-explanations output)

These rules apply to every AskUserQuestion, every response you write to the user, and every review finding. They compose with the AskUserQuestion Format section above: Format = *how* a question is structured; Writing Style = *the prose quality of the content inside it*.

1. **Jargon gets a one-sentence gloss on first use per skill invocation.** Even if the user's own prompt already contained the term — users often paste jargon from someone else's plan. Gloss unconditionally on first use. No cross-invocation memory: a new skill fire is a new first-use opportunity. Example: "race condition (two things happen at the same time and step on each other)".
2. **Frame questions in outcome terms, not implementation terms.** Bad: "Is this endpoint idempotent?" Good: "If someone double-clicks the button, is it OK for the action to run twice?" Ask the question the user would actually want to answer.
3. **Short sentences. Concrete nouns. Active voice.** Standard advice from any good writing guide. Prefer "the cache stores the result for 60s" over "results will have been cached for a period of 60s."
4. **Close every decision with user impact.** Connect the technical call back to who's affected. "If we skip this, your users will see a 3-second spinner on every page load." Make the user's user real.
5. **User-turn override.** If the user's current message says "be terse" / "no explanations" / "brutally honest, just the answer" / similar, skip this entire Writing Style block for your next response, regardless of config. User's in-turn request wins.
6. **Glossary boundary is the curated list.** Terms below get glossed. Terms not on the list are assumed plain-English enough. If you see a term that genuinely needs glossing but isn't listed, note it (once) in your response so it can be added via PR.

${jargonBlock}

Terse mode (EXPLAIN_LEVEL: terse): skip this entire section. Emit output in V0 prose style — no glosses, no outcome-framing layer, shorter responses. Power users who know the terms get tighter output this way.`;
}
