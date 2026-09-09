import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import { armJudge, callJudge } from './helpers/llm-judge';

describe('frontier Claude judge compatibility', () => {
  let originalKey: string | undefined;
  let create: ReturnType<typeof spyOn>;

  beforeEach(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-only-key';
    create = spyOn(Anthropic.Messages.prototype, 'create');
  });

  afterEach(() => {
    create.mockRestore();
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('parses JSON text after an omitted-thinking block', async () => {
    create.mockResolvedValue({ content: [
      { type: 'thinking', thinking: '', signature: 'fixture' },
      { type: 'text', text: '{"score":4}' },
    ] } as never);
    expect(await callJudge('score this', 'claude-fable-5-1')).toEqual({ score: 4 });
  });

  test('keeps text-only responses and explicit model options working', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '{"score":5}' }] } as never);
    expect(await callJudge('score this', 'claude-sonnet-4-6', { temperature: 0 })).toEqual({ score: 5 });
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'claude-sonnet-4-6', temperature: 0 });
  });

  test('rejects responses without JSON text', async () => {
    create.mockResolvedValue({ content: [{ type: 'thinking', thinking: '', signature: 'fixture' }] } as never);
    await expect(callJudge('score this', 'claude-fable-5-1')).rejects.toThrow('Judge returned non-JSON');
  });

  test('arm judge sends no unsupported temperature to Fable', async () => {
    create.mockResolvedValue({ content: [
      { type: 'thinking', thinking: '', signature: 'fixture' },
      { type: 'text', text: '{"over_engineering":0,"construct":"none","reasoning":"Scoped change"}' },
    ] } as never);
    expect((await armJudge('ticket', '+ requested change')).over_engineering).toBe(0);
    const request = create.mock.calls[0][0];
    expect(request.model).toBe('claude-fable-5-1');
    expect(request).not.toHaveProperty('temperature');
  });
});
