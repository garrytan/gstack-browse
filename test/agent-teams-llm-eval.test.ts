/**
 * LLM-as-Judge evals for Agent Teams infrastructure.
 *
 * Evaluates whether the /team skill, TEAMS.md, and preamble teammate
 * awareness are clear and actionable enough for Claude Code to orchestrate
 * multi-agent workflows.
 *
 * Requires: ANTHROPIC_API_KEY + EVALS=1
 * Cost: ~$0.08/run (4 tests)
 * Run: EVALS=1 bun test test/agent-teams-llm-eval.test.ts
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

describeEval('Agent Teams quality evals', () => {
  test('/team SKILL.md orchestration quality >= 4', async () => {
    const t0 = Date.now();
    const content = fs.readFileSync(path.join(ROOT, 'team', 'SKILL.md'), 'utf-8');
    const start = content.indexOf('# /team');
    const section = content.slice(start);

    const scores = await callJudge<JudgeScore>(`You are evaluating a team orchestration document for Claude Code Agent Teams.

This document teaches a Claude Code lead session how to:
1. Spawn teammate sessions with specific gstack skill personas
2. Configure task dependencies between teammates
3. Define spawn prompts that tell each teammate what to do
4. Coordinate inter-teammate communication

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Can the lead agent understand what teams to spawn and how?
- **completeness** (1-5): Are spawn prompts, task dependencies, and team patterns well-defined?
- **actionability** (1-5): Can the lead actually create functional agent teams from this doc?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief"}

${section}`);

    console.log('Team skill scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'team/SKILL.md orchestration',
      suite: 'Agent Teams quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 4 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('TEAMS.md coordination reference >= 4', async () => {
    const t0 = Date.now();
    const content = fs.readFileSync(path.join(ROOT, 'team', 'TEAMS.md'), 'utf-8');

    const scores = await callJudge<JudgeScore>(`You are evaluating a coordination reference document for AI agent teammates.

Each teammate in a Claude Code Agent Team reads this document to understand:
1. How to message other teammates (format, urgency rules)
2. Who to message with what (dependency graph)
3. Where shared state lives (.gstack/ directories)
4. What anti-patterns to avoid

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Can a teammate understand the communication protocol?
- **completeness** (1-5): Are message formats, state locations, and anti-patterns defined?
- **actionability** (1-5): Can a teammate coordinate with others using only this doc?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief"}

${content}`);

    console.log('TEAMS.md scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'TEAMS.md coordination',
      suite: 'Agent Teams quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 3 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(3);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('preamble teammate awareness is actionable', async () => {
    const t0 = Date.now();
    // Extract the teammate awareness section from any generated skill
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    const start = content.indexOf('## Agent Team Awareness');
    const end = content.indexOf('\n# ', start);
    const section = end > start ? content.slice(start, end) : content.slice(start);

    const scores = await callJudge<JudgeScore>(`You are evaluating a preamble section that teaches an AI agent how to behave as a teammate in a Claude Code Agent Team.

This section is injected into EVERY gstack skill via a shared template. When the agent
detects it's running as a teammate (_IS_TEAMMATE=true), it should:
1. Message findings to other teammates instead of just outputting
2. Wait for upstream dependencies
3. Claim and complete tasks from the shared task list
4. Broadcast urgent findings immediately

When NOT a teammate, it should ignore all of this and work normally.

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Can an agent understand when to activate teammate mode?
- **completeness** (1-5): Are communication, output, task, and discovery protocols defined?
- **actionability** (1-5): Can an agent switch between standalone and teammate mode correctly?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief"}

${section}`);

    console.log('Preamble teammate awareness scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'preamble teammate awareness',
      suite: 'Agent Teams quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('spawn prompts contain enough context for teammates', async () => {
    const t0 = Date.now();
    const content = fs.readFileSync(path.join(ROOT, 'team', 'SKILL.md'), 'utf-8');
    // Extract the Due Diligence spawn prompt (most complex)
    const ddStart = content.indexOf('### 5. Due Diligence Team');
    const ddEnd = content.indexOf('### 6.', ddStart);
    const section = content.slice(ddStart, ddEnd > ddStart ? ddEnd : undefined);

    const result = await callJudge<{ sufficient: boolean; score: number; missing: string[]; reasoning: string }>(
      `You are evaluating whether a spawn prompt gives enough context for Claude Code Agent Team teammates.

When the lead spawns a teammate, the teammate gets:
- The spawn prompt (what you see below)
- Project CLAUDE.md
- Access to MCP servers and skills

The teammate does NOT get:
- The lead's conversation history
- Other teammates' context (they message each other)

Evaluate whether this spawn prompt gives each teammate enough information to:
1. Know what skill/persona they should adopt
2. Know what analysis to perform
3. Know who to message findings to
4. Know what to wait for (dependencies)

Respond with ONLY valid JSON:
{"sufficient": true/false, "score": N, "missing": ["item1"], "reasoning": "brief"}

score (1-5): 5 = teammate can work autonomously, 1 = would be lost

${section}`
    );

    console.log('Spawn prompt scores:', JSON.stringify(result, null, 2));

    evalCollector?.addTest({
      name: 'spawn prompt context sufficiency',
      suite: 'Agent Teams quality evals',
      tier: 'llm-judge',
      passed: result.sufficient && result.score >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { sufficiency: result.score },
      judge_reasoning: result.reasoning,
    });

    expect(result.sufficient).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(4);
  }, 30_000);
});

afterAll(async () => {
  if (evalCollector) {
    try { await evalCollector.finalize(); } catch (err) { console.error('Eval save failed:', err); }
  }
});
