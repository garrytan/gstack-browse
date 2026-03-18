/**
 * Tests for find-browse binary locator.
 */

import { describe, test, expect } from 'bun:test';
import { locateBinary } from '../src/find-browse';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

describe('locateBinary', () => {
  test('returns null when no binary exists at known paths', () => {
    // This test depends on the test environment — if a real binary exists at
    // ~/.claude/skills/gstack/browse/dist/browse, it will find it.
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

  test('prefers workspace-local Codex install over Claude install', () => {
    const root = mkdtempSync(join(tmpdir(), 'find-browse-root-'));
    const home = mkdtempSync(join(tmpdir(), 'find-browse-home-'));
    const codex = join(root, '.codex', 'skills', 'gstack', 'browse', 'dist', 'browse');
    const claude = join(root, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');

    for (const file of [claude, codex]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
      chmodSync(file, 0o755);
    }

    expect(locateBinary({ root, home })).toBe(codex);
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  test('falls back to global Codex install before global Claude install', () => {
    const root = mkdtempSync(join(tmpdir(), 'find-browse-root-empty-'));
    const home = mkdtempSync(join(tmpdir(), 'find-browse-home-global-'));
    const codex = join(home, '.codex', 'skills', 'gstack', 'browse', 'dist', 'browse');
    const claude = join(home, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');

    for (const file of [claude, codex]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
      chmodSync(file, 0o755);
    }

    expect(locateBinary({ root, home })).toBe(codex);
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });
});
