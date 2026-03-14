/**
 * LLM-as-a-Judge evals for generated SKILL.md quality.
 *
 * Uses the Anthropic API directly (not Agent SDK) to evaluate whether
 * generated command docs are clear, complete, and actionable for an AI agent.
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Run: ANTHROPIC_API_KEY=sk-... bun test test/skill-llm-eval.test.ts
 *
 * Cost: ~$0.05-0.15 per run (sonnet)
 */

import { describe, test, expect } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const describeEval = hasApiKey ? describe : describe.skip;

interface JudgeScore {
  clarity: number;       // 1-5: can an agent understand what each command does?
  completeness: number;  // 1-5: are all args, flags, valid values documented?
  actionability: number; // 1-5: can an agent use this to construct correct commands?
  reasoning: string;     // why the scores were given
}

async function judge(section: string, prompt: string): Promise<JudgeScore> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are evaluating documentation quality for an AI coding agent's CLI tool reference.

The agent reads this documentation to learn how to use a headless browser CLI. It needs to:
1. Understand what each command does
2. Know what arguments to pass
3. Know valid values for enum-like parameters
4. Construct correct command invocations without guessing

Rate the following ${section} on three dimensions (1-5 scale):

- **clarity** (1-5): Can an agent understand what each command/flag does from the description alone?
- **completeness** (1-5): Are arguments, valid values, and important behaviors documented? Would an agent need to guess anything?
- **actionability** (1-5): Can an agent construct correct command invocations from this reference alone?

Scoring guide:
- 5: Excellent — no ambiguity, all info present
- 4: Good — minor gaps an experienced agent could infer
- 3: Adequate — some guessing required
- 2: Poor — significant info missing
- 1: Unusable — agent would fail without external help

Respond with ONLY valid JSON in this exact format:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief explanation"}

Here is the ${section} to evaluate:

${prompt}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Judge returned non-JSON: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as JudgeScore;
}

describeEval('LLM-as-judge quality evals', () => {
  test('command reference table scores >= 4 on all dimensions', async () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    // Extract just the command reference section
    const start = content.indexOf('## Command Reference');
    const end = content.indexOf('## Tips');
    const section = content.slice(start, end);

    const scores = await judge('command reference table', section);
    console.log('Command reference scores:', JSON.stringify(scores, null, 2));

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('snapshot flags section scores >= 4 on all dimensions', async () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const start = content.indexOf('## Snapshot System');
    const end = content.indexOf('## Command Reference');
    const section = content.slice(start, end);

    const scores = await judge('snapshot flags reference', section);
    console.log('Snapshot flags scores:', JSON.stringify(scores, null, 2));

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('browse/SKILL.md overall scores >= 4', async () => {
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    // Just the reference sections (skip examples/patterns)
    const start = content.indexOf('## Snapshot Flags');
    const section = content.slice(start);

    const scores = await judge('browse skill reference (flags + commands)', section);
    console.log('Browse SKILL.md scores:', JSON.stringify(scores, null, 2));

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('setup block scores >= 4 on actionability and clarity', async () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const setupStart = content.indexOf('## SETUP');
    const setupEnd = content.indexOf('## IMPORTANT');
    const section = content.slice(setupStart, setupEnd);

    const scores = await judge('setup/binary discovery instructions', section);
    console.log('Setup block scores:', JSON.stringify(scores, null, 2));

    expect(scores.actionability).toBeGreaterThanOrEqual(4);
    expect(scores.clarity).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('regression check: compare branch vs baseline quality', async () => {
    // This test compares the generated output against the hand-maintained
    // baseline from main. The generated version should score equal or higher.
    const generated = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const genStart = generated.indexOf('## Command Reference');
    const genEnd = generated.indexOf('## Tips');
    const genSection = generated.slice(genStart, genEnd);

    const baseline = `## Command Reference

### Navigation
| Command | Description |
|---------|-------------|
| \`goto <url>\` | Navigate to URL |
| \`back\` / \`forward\` | History navigation |
| \`reload\` | Reload page |
| \`url\` | Print current URL |

### Interaction
| Command | Description |
|---------|-------------|
| \`click <sel>\` | Click element |
| \`fill <sel> <val>\` | Fill input |
| \`select <sel> <val>\` | Select dropdown |
| \`hover <sel>\` | Hover element |
| \`type <text>\` | Type into focused element |
| \`press <key>\` | Press key (Enter, Tab, Escape) |
| \`scroll [sel]\` | Scroll element into view |
| \`wait <sel>\` | Wait for element (max 10s) |
| \`wait --networkidle\` | Wait for network to be idle |
| \`wait --load\` | Wait for page load event |

### Inspection
| Command | Description |
|---------|-------------|
| \`js <expr>\` | Run JavaScript |
| \`css <sel> <prop>\` | Computed CSS |
| \`attrs <sel>\` | Element attributes |
| \`is <prop> <sel>\` | State check (visible/hidden/enabled/disabled/checked/editable/focused) |
| \`console [--clear\\|--errors]\` | Console messages (--errors filters to error/warning) |`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are comparing two versions of CLI documentation for an AI coding agent.

VERSION A (baseline — hand-maintained):
${baseline}

VERSION B (auto-generated from source):
${genSection}

Which version is better for an AI agent trying to use these commands? Consider:
- Completeness (more commands documented? all args shown?)
- Clarity (descriptions helpful?)
- Coverage (missing commands in either version?)

Respond with ONLY valid JSON:
{"winner": "A" or "B" or "tie", "reasoning": "brief explanation", "a_score": N, "b_score": N}

Scores are 1-5 overall quality.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Judge returned non-JSON: ${text.slice(0, 200)}`);
    const result = JSON.parse(jsonMatch[0]);
    console.log('Regression comparison:', JSON.stringify(result, null, 2));

    // Generated version should be at least as good as hand-maintained
    expect(result.b_score).toBeGreaterThanOrEqual(result.a_score);
  }, 30_000);
});
