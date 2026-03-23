import { describe, expect, test } from 'bun:test';
import { rankMentions, scoreMention } from '../hate-driven-development/scoring.ts';

describe('hate-driven-development scoring', () => {
  test('actionable product complaints outrank light mockery', () => {
    const ranked = rankMentions([
      {
        id: '1',
        text: 'gstack install is broken and the docs are confusing',
        public_metrics: { like_count: 2, reply_count: 1, retweet_count: 0, quote_count: 0 },
      },
      {
        id: '2',
        text: 'lol gstack',
        public_metrics: { like_count: 0, reply_count: 0, retweet_count: 0, quote_count: 0 },
      },
    ]);

    expect(ranked[0]?.id).toBe('1');
    expect(ranked[0]?.actionable).toBe(true);
    expect(ranked[0]?.mealTag).toBe('actionable protein');
  });

  test('positive language offsets some negativity', () => {
    const harsh = scoreMention('gstack is trash');
    const mixed = scoreMention('gstack is trash but also useful');

    expect(harsh.score).toBeGreaterThan(mixed.score);
  });

  test('engagement breaks ties deterministically', () => {
    const ranked = rankMentions([
      {
        id: '10',
        text: 'gstack sucks',
        public_metrics: { like_count: 1, reply_count: 0, retweet_count: 0, quote_count: 0 },
        created_at: '2026-03-23T00:00:00.000Z',
      },
      {
        id: '11',
        text: 'gstack sucks',
        public_metrics: { like_count: 20, reply_count: 3, retweet_count: 1, quote_count: 0 },
        created_at: '2026-03-23T00:00:00.000Z',
      },
    ]);

    expect(ranked[0]?.id).toBe('11');
    expect(ranked[1]?.id).toBe('10');
  });
});
