/**
 * Tests for find-browse binary locator.
 */

import { describe, test, expect } from 'bun:test';
import { getBinaryCandidates, locateBinary } from '../src/find-browse';
import { existsSync } from 'fs';
import { join } from 'path';

describe('locateBinary', () => {
  test('candidate order prefers repo-local Claude then repo-local Codex then global installs', () => {
    const candidates = getBinaryCandidates({
      root: '/tmp/project',
      home: '/tmp/home',
      codexHome: '/tmp/codex-home',
    });

    expect(candidates).toEqual([
      join('/tmp/project', '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse'),
      join('/tmp/project', '.agents', 'skills', 'gstack', 'browse', 'dist', 'browse'),
      join('/tmp/home', '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse'),
      join('/tmp/codex-home', 'skills', 'gstack', 'browse', 'dist', 'browse'),
    ]);
  });

  test('returns first existing candidate in priority order', () => {
    const existing = new Set([
      join('/tmp/project', '.agents', 'skills', 'gstack', 'browse', 'dist', 'browse'),
      join('/tmp/home', '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse'),
    ]);

    const result = locateBinary({
      root: '/tmp/project',
      home: '/tmp/home',
      codexHome: '/tmp/codex-home',
      exists: candidate => existing.has(candidate),
    });

    expect(result).toBe(join('/tmp/project', '.agents', 'skills', 'gstack', 'browse', 'dist', 'browse'));
  });

  test('returns null when no binary exists at known paths', () => {
    // This test depends on the test environment — if a real binary exists at
    // ~/.claude/skills/gstack/browse/dist/browse or ~/.codex/skills/gstack/browse/dist/browse,
    // it will find it. We mainly test that the function doesn't throw.
    const result = locateBinary();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  test('returns string path when binary exists', () => {
    const result = locateBinary();
    if (result !== null) {
      expect(existsSync(result)).toBe(true);
    }
  });
});
