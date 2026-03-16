/**
 * LLM-as-Judge evals for new gstack skills.
 *
 * Evaluates whether each new SKILL.md is clear, complete, and actionable
 * enough for an AI agent to follow as a workflow methodology.
 *
 * Requires: ANTHROPIC_API_KEY + EVALS=1
 * Cost: ~$0.02 per test (~$0.10 total for 5 skills)
 * Run: EVALS=1 bun test test/new-skills-llm-eval.test.ts
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { callJudge } from './helpers/llm-judge';
import type { JudgeScore } from './helpers/llm-judge';
import { EvalCollector } from './helpers/eval-store';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const evalsEnabled = !!process.env.EVALS;
const describeEval = evalsEnabled ? describe : describe.skip;
const evalCollector = evalsEnabled ? new EvalCollector('llm-judge') : null;

interface SkillEvalSpec {
  dir: string;
  name: string;
  section: string;  // Section name to extract for focused eval
  sectionStart: string;  // Text marker for section start
  sectionEnd?: string;  // Text marker for section end (default: end of file)
  minClarity: number;
  minCompleteness: number;
  minActionability: number;
  context: string;  // Extra context for the judge about what this skill does
}

const SKILL_EVALS: SkillEvalSpec[] = [
  {
    dir: 'conflicts', name: 'conflicts',
    section: 'conflict detection workflow',
    sectionStart: '# /conflicts',
    context: 'This skill detects semantic conflicts between open PRs — not just textual merge conflicts, but business logic collisions where two PRs change the same state machine or API contract.',
    minClarity: 4, minCompleteness: 3, minActionability: 4,
  },
  {
    dir: 'cso', name: 'cso',
    section: 'security audit methodology',
    sectionStart: '# /cso',
    context: 'This skill performs OWASP Top 10 security audits and STRIDE threat modeling on a codebase. The agent reads code, runs grep commands, and produces a security findings report.',
    minClarity: 4, minCompleteness: 4, minActionability: 4,
  },
  {
    dir: 'risk', name: 'risk',
    section: 'risk assessment methodology',
    sectionStart: '# /risk',
    context: 'This skill produces a risk register with likelihood × impact scoring across categories like SPOFs, tech debt, compliance, and scalability.',
    minClarity: 4, minCompleteness: 3, minActionability: 4,
  },
  {
    dir: 'escalation', name: 'escalation',
    section: 'incident response workflow',
    sectionStart: '# /escalation',
    context: 'This skill manages incident response: severity classification, escalation paths, war room coordination, and post-incident reviews with 5 Whys analysis.',
    minClarity: 4, minCompleteness: 4, minActionability: 4,
  },
  {
    dir: 'ai-hybrid', name: 'ai-hybrid',
    section: 'AI-human collaboration workflow',
    sectionStart: '# /ai-hybrid',
    context: 'This skill analyzes how a team uses AI tools, classifies tasks by optimal human-AI split, audits AI-generated code quality, and designs optimized workflows.',
    minClarity: 4, minCompleteness: 3, minActionability: 4,
  },
];

function extractSkillSection(dir: string, startMarker: string, endMarker?: string): string {
  const content = fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
  const start = content.indexOf(startMarker);
  if (start === -1) return content.slice(content.indexOf('---', 10) + 3); // fallback: after frontmatter
  if (endMarker) {
    const end = content.indexOf(endMarker, start + startMarker.length);
    return end === -1 ? content.slice(start) : content.slice(start, end);
  }
  return content.slice(start);
}

describeEval('New skills quality evals', () => {
  for (const spec of SKILL_EVALS) {
    test(`${spec.name}/SKILL.md ${spec.section} scores >= thresholds`, async () => {
      const t0 = Date.now();
      const section = extractSkillSection(spec.dir, spec.sectionStart, spec.sectionEnd);

      const scores = await callJudge<JudgeScore>(`You are evaluating the quality of a workflow document for an AI coding agent.

${spec.context}

The agent reads this document to learn its methodology and follow it step-by-step.
It needs to:
1. Understand its persona and cognitive mode
2. Know what commands to run and in what order
3. Know what output formats to produce
4. Handle edge cases and conditional logic
5. Produce actionable, structured deliverables

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Can an agent follow the phases without ambiguity?
- **completeness** (1-5): Are all phases, outputs, and edge cases defined?
- **actionability** (1-5): Can an agent execute this and produce the expected deliverables?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief explanation"}

Here is the ${spec.section} to evaluate:

${section}`);

      console.log(`${spec.name} scores:`, JSON.stringify(scores, null, 2));

      evalCollector?.addTest({
        name: `${spec.name}/SKILL.md quality`,
        suite: 'New skills quality evals',
        tier: 'llm-judge',
        passed: scores.clarity >= spec.minClarity
          && scores.completeness >= spec.minCompleteness
          && scores.actionability >= spec.minActionability,
        duration_ms: Date.now() - t0,
        cost_usd: 0.02,
        judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
        judge_reasoning: scores.reasoning,
      });

      expect(scores.clarity).toBeGreaterThanOrEqual(spec.minClarity);
      expect(scores.completeness).toBeGreaterThanOrEqual(spec.minCompleteness);
      expect(scores.actionability).toBeGreaterThanOrEqual(spec.minActionability);
    }, 30_000);
  }
});

describeEval('New skills cross-consistency eval', () => {
  test('read-only skills produce consistent output format patterns', async () => {
    const t0 = Date.now();
    const sections: string[] = [];
    for (const spec of SKILL_EVALS) {
      const content = fs.readFileSync(path.join(ROOT, spec.dir, 'SKILL.md'), 'utf-8');
      const rulesStart = content.indexOf('## Important Rules');
      if (rulesStart !== -1) {
        sections.push(`--- ${spec.name} ---\n${content.slice(rulesStart, rulesStart + 500)}`);
      }
    }

    const result = await callJudge<{ consistent: boolean; score: number; issues: string[]; reasoning: string }>(
      `You are evaluating whether multiple AI agent skill documents follow consistent patterns.

All of these skills are read-only analysis tools that:
1. Gather data from the codebase (git commands, grep, file reads)
2. Produce structured reports with findings
3. Save reports to .gstack/ directories
4. Present findings via AskUserQuestion

EXPECTED CONSISTENCY:
- All should explicitly state they are read-only
- All should have structured output formats
- All should save reports to .gstack/ directories
- All should use AskUserQuestion for recommendations

Below are the "Important Rules" sections from each skill:

${sections.join('\n\n')}

Evaluate consistency. Respond with ONLY valid JSON:
{"consistent": true/false, "score": N, "issues": ["issue1"], "reasoning": "brief"}

score (1-5): 5 = perfectly consistent, 1 = contradictory`
    );

    console.log('Cross-consistency:', JSON.stringify(result, null, 2));

    evalCollector?.addTest({
      name: 'cross-skill consistency',
      suite: 'New skills cross-consistency eval',
      tier: 'llm-judge',
      passed: result.score >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { consistency: result.score },
      judge_reasoning: result.reasoning,
    });

    expect(result.score).toBeGreaterThanOrEqual(4);
  }, 30_000);
});

afterAll(async () => {
  if (evalCollector) {
    try { await evalCollector.finalize(); } catch (err) { console.error('Eval save failed:', err); }
  }
});
