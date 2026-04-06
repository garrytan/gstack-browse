/**
 * Unit tests for diff-based test selection.
 * Free (no API calls), runs with `bun test`.
 */

import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  matchGlob,
  selectTests,
  detectBaseBranch,
  E2E_TOUCHFILES,
  E2E_TIERS,
  LLM_JUDGE_TOUCHFILES,
  GLOBAL_TOUCHFILES,
} from './helpers/touchfiles';

const ROOT = path.resolve(import.meta.dir, '..');

// --- matchGlob ---

describe('matchGlob', () => {
  test('** matches any depth of path segments', () => {
    expect(matchGlob('browse/src/commands.ts', 'browse/src/**')).toBe(true);
    expect(matchGlob('browse/src/deep/nested/file.ts', 'browse/src/**')).toBe(true);
    expect(matchGlob('browse/src/cli.ts', 'browse/src/**')).toBe(true);
  });

  test('** does not match unrelated paths', () => {
    expect(matchGlob('browse/src/commands.ts', 'qa/**')).toBe(false);
    expect(matchGlob('review/SKILL.md', 'qa/**')).toBe(false);
  });

  test('exact match works', () => {
    expect(matchGlob('SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchGlob('SKILL.md.tmpl', 'SKILL.md')).toBe(false);
    expect(matchGlob('qa/SKILL.md', 'SKILL.md')).toBe(false);
  });

  test('* matches within a single segment', () => {
    expect(matchGlob('test/fixtures/review-eval-enum.rb', 'test/fixtures/review-eval-enum*.rb')).toBe(true);
    expect(matchGlob('test/fixtures/review-eval-enum-diff.rb', 'test/fixtures/review-eval-enum*.rb')).toBe(true);
    expect(matchGlob('test/fixtures/review-eval-vuln.rb', 'test/fixtures/review-eval-enum*.rb')).toBe(false);
  });

  test('dots in patterns are escaped correctly', () => {
    expect(matchGlob('SKILL.md', 'SKILL.md')).toBe(true);
    expect(matchGlob('SKILLxmd', 'SKILL.md')).toBe(false);
  });

  test('** at end matches files in the directory', () => {
    expect(matchGlob('qa/SKILL.md', 'qa/**')).toBe(true);
    expect(matchGlob('qa/SKILL.md.tmpl', 'qa/**')).toBe(true);
    expect(matchGlob('qa/templates/report.md', 'qa/**')).toBe(true);
  });
});

// --- selectTests ---

describe('selectTests', () => {
  test('browse/src change selects browse and qa tests', () => {
    const result = selectTests(['browse/src/commands.ts'], E2E_TOUCHFILES);
    expect(result.selected).toContain('browse-basic');
    expect(result.selected).toContain('browse-snapshot');
    expect(result.selected).toContain('qa-quick');
    expect(result.selected).toContain('qa-fix-loop');
    expect(result.selected).toContain('design-review-fix');
    expect(result.reason).toBe('diff');
    // Should NOT include unrelated tests
    expect(result.selected).not.toContain('plan-ceo-review');
    expect(result.selected).not.toContain('retro');
    expect(result.selected).not.toContain('document-release');
  });

  test('skill-specific change selects only that skill and related tests', () => {
    const result = selectTests(['plan-ceo-review/SKILL.md'], E2E_TOUCHFILES);
    expect(result.selected).toContain('plan-ceo-review');
    expect(result.selected).toContain('plan-ceo-review-selective');
    expect(result.selected).toContain('plan-ceo-review-benefits');
    expect(result.selected).toContain('autoplan-core');
    expect(result.selected).toContain('codex-offered-ceo-review');
    expect(result.selected.length).toBe(5);
    expect(result.skipped.length).toBe(Object.keys(E2E_TOUCHFILES).length - 5);
  });

  test('global touchfile triggers ALL tests', () => {
    const result = selectTests(['test/helpers/session-runner.ts'], E2E_TOUCHFILES);
    expect(result.selected.length).toBe(Object.keys(E2E_TOUCHFILES).length);
    expect(result.skipped.length).toBe(0);
    expect(result.reason).toContain('global');
  });

  test('gen-skill-docs.ts is a scoped touchfile, not global', () => {
    const result = selectTests(['scripts/gen-skill-docs.ts'], E2E_TOUCHFILES);
    // Should select tests that list gen-skill-docs.ts in their touchfiles, not ALL tests
    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected.length).toBeLessThan(Object.keys(E2E_TOUCHFILES).length);
    expect(result.reason).toBe('diff');
    // Should include tests that depend on gen-skill-docs.ts
    expect(result.selected).toContain('skillmd-setup-discovery');
    expect(result.selected).toContain('session-awareness');
    expect(result.selected).toContain('journey-ideation');
    // Should NOT include tests that don't depend on it
    expect(result.selected).not.toContain('retro');
    expect(result.selected).not.toContain('cso-full-audit');
  });

  test('unrelated file selects nothing', () => {
    const result = selectTests(['README.md'], E2E_TOUCHFILES);
    expect(result.selected).toEqual([]);
    expect(result.skipped.length).toBe(Object.keys(E2E_TOUCHFILES).length);
  });

  test('empty changed files selects nothing', () => {
    const result = selectTests([], E2E_TOUCHFILES);
    expect(result.selected).toEqual([]);
  });

  test('multiple changed files union their selections', () => {
    const result = selectTests(
      ['plan-ceo-review/SKILL.md', 'retro/SKILL.md.tmpl'],
      E2E_TOUCHFILES,
    );
    expect(result.selected).toContain('plan-ceo-review');
    expect(result.selected).toContain('plan-ceo-review-selective');
    expect(result.selected).toContain('retro');
    expect(result.selected).toContain('retro-base-branch');
    // Also selects journey routing tests (*/SKILL.md.tmpl matches retro/SKILL.md.tmpl)
    expect(result.selected.length).toBeGreaterThanOrEqual(4);
  });

  test('works with LLM_JUDGE_TOUCHFILES', () => {
    const result = selectTests(['qa/SKILL.md'], LLM_JUDGE_TOUCHFILES);
    expect(result.selected).toContain('qa/SKILL.md workflow');
    expect(result.selected).toContain('qa/SKILL.md health rubric');
    expect(result.selected).toContain('qa/SKILL.md anti-refusal');
    expect(result.selected.length).toBe(3);
  });

  test('SKILL.md.tmpl root template selects root-dependent tests and routing tests', () => {
    const result = selectTests(['SKILL.md.tmpl'], E2E_TOUCHFILES);
    // Should select the 7 tests that depend on root SKILL.md
    expect(result.selected).toContain('skillmd-setup-discovery');
    expect(result.selected).toContain('session-awareness');
    expect(result.selected).toContain('session-awareness');
    // Also selects journey routing tests (SKILL.md.tmpl in their touchfiles)
    expect(result.selected).toContain('journey-ideation');
    // Should NOT select unrelated non-routing tests
    expect(result.selected).not.toContain('plan-ceo-review');
    expect(result.selected).not.toContain('retro');
  });

  test('global touchfiles work for LLM-judge tests too', () => {
    const result = selectTests(['test/helpers/session-runner.ts'], LLM_JUDGE_TOUCHFILES);
    expect(result.selected.length).toBe(Object.keys(LLM_JUDGE_TOUCHFILES).length);
  });
});

// --- detectBaseBranch ---

describe('detectBaseBranch', () => {
  test('detects local main branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchfiles-test-'));
    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: dir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    run('git', ['config', 'user.email', 'test@test.com']);
    run('git', ['config', 'user.name', 'Test']);
    fs.writeFileSync(path.join(dir, 'test.txt'), 'hello\n');
    run('git', ['add', '.']);
    run('git', ['commit', '-m', 'init']);

    const result = detectBaseBranch(dir);
    // Should find 'main' (or 'master' depending on git default)
    expect(result).toMatch(/^(main|master)$/);

    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  test('returns null for empty repo with no branches', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchfiles-test-'));
    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: dir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    // No commits = no branches
    const result = detectBaseBranch(dir);
    expect(result).toBeNull();

    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  test('returns null for non-git directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchfiles-test-'));
    const result = detectBaseBranch(dir);
    expect(result).toBeNull();

    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });
});

// E2E/LLM-eval TOUCHFILES completeness tests removed — E2E tests deleted from Alpaca fork.
