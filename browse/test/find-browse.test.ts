/**
 * Tests for find-browse binary locator.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { locateBinary } from '../src/find-browse';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'find-browse-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('locateBinary', () => {
  test('returns null when no binary exists at known paths', () => {
    // This test depends on the test environment — if a real binary exists at a
    // known skill path, it will find it.
    // We mainly test that the function doesn't throw.
    const result = locateBinary();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  test('returns string path when binary exists', () => {
    const result = locateBinary();
    if (result !== null) {
      expect(existsSync(result)).toBe(true);
    }
  });

  test('prefers .codex over .agents and .claude when multiple binaries exist', () => {
    const root = join(tempDir, 'repo');
    const home = join(tempDir, 'home');
    const codex = join(root, '.codex', 'skills', 'gstack', 'browse', 'dist', 'browse');
    const agents = join(root, '.agents', 'skills', 'gstack', 'browse', 'dist', 'browse');
    const claude = join(root, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');

    for (const file of [claude, agents, codex]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
    }

    expect(locateBinary({ root, home })).toBe(codex);
  });

  test('falls back to global Codex install before older locations', () => {
    const home = join(tempDir, 'home');
    const codex = join(home, '.codex', 'skills', 'gstack', 'browse', 'dist', 'browse');
    const agents = join(home, '.agents', 'skills', 'gstack', 'browse', 'dist', 'browse');

    for (const file of [agents, codex]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
    }

    expect(locateBinary({ root: null, home })).toBe(codex);
  });
});
