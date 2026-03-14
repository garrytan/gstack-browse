/**
 * Tests for bin/gstack-update-check bash script.
 *
 * Uses Bun.spawnSync to invoke the script with temp dirs and
 * GSTACK_DIR / GSTACK_STATE_DIR / GSTACK_REMOTE_URL env overrides
 * for full isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'gstack-update-check');

let gstackDir: string;
let stateDir: string;

function run(extraEnv: Record<string, string> = {}) {
  const result = Bun.spawnSync(['bash', SCRIPT], {
    env: {
      ...process.env,
      GSTACK_DIR: gstackDir,
      GSTACK_STATE_DIR: stateDir,
      GSTACK_REMOTE_URL: `file://${join(gstackDir, 'REMOTE_VERSION')}`,
      ...extraEnv,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

beforeEach(() => {
  gstackDir = mkdtempSync(join(tmpdir(), 'gstack-upd-test-'));
  stateDir = mkdtempSync(join(tmpdir(), 'gstack-state-test-'));
});

afterEach(() => {
  rmSync(gstackDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

describe('gstack-update-check', () => {
  // ─── Path A: No VERSION file ────────────────────────────────
  test('exits 0 with no output when VERSION file is missing', () => {
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  // ─── Path B: Empty VERSION file ─────────────────────────────
  test('exits 0 with no output when VERSION file is empty', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '');
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  // ─── Path C: Just-upgraded marker ───────────────────────────
  test('outputs JUST_UPGRADED and deletes marker', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.4.0\n');
    writeFileSync(join(stateDir, 'just-upgraded-from'), '0.3.3\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('JUST_UPGRADED 0.3.3 0.4.0');
    // Marker should be deleted
    expect(existsSync(join(stateDir, 'just-upgraded-from'))).toBe(false);
    // Cache should be written
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── Path D1: Fresh cache, UP_TO_DATE ───────────────────────
  test('exits silently when cache says UP_TO_DATE and is fresh', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(stateDir, 'last-update-check'), 'UP_TO_DATE 0.3.3');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  // ─── Path D2: Fresh cache, UPGRADE_AVAILABLE ────────────────
  test('echoes cached UPGRADE_AVAILABLE when cache is fresh', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(stateDir, 'last-update-check'), 'UPGRADE_AVAILABLE 0.3.3 0.4.0');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 0.3.3 0.4.0');
  });

  // ─── Path D3: Fresh cache, but local version changed ────────
  test('re-checks when local version does not match cached old version', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.4.0\n');
    // Cache says 0.3.3 → 0.4.0 but we're already on 0.4.0
    writeFileSync(join(stateDir, 'last-update-check'), 'UPGRADE_AVAILABLE 0.3.3 0.4.0');
    // Remote also says 0.4.0 — should be up to date
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '0.4.0\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe(''); // Up to date after re-check
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── Path E: Versions match (remote fetch) ─────────────────
  test('writes UP_TO_DATE cache when versions match', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '0.3.3\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── Path F: Versions differ (remote fetch) ─────────────────
  test('outputs UPGRADE_AVAILABLE when versions differ', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '0.4.0\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 0.3.3 0.4.0');
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UPGRADE_AVAILABLE 0.3.3 0.4.0');
  });

  // ─── Path G: Invalid remote response ────────────────────────
  test('treats invalid remote response as up to date', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '<html>404 Not Found</html>\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── Path H: Curl fails (bad URL) ──────────────────────────
  test('exits silently when remote URL is unreachable', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');

    const { exitCode, stdout } = run({
      GSTACK_REMOTE_URL: 'file:///nonexistent/path/VERSION',
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── Path I: Corrupt cache file ─────────────────────────────
  test('falls through to remote fetch when cache is corrupt', () => {
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(stateDir, 'last-update-check'), 'garbage data here');
    // Remote says same version — should end up UP_TO_DATE
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '0.3.3\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    // Cache should be overwritten with valid content
    const cache = readFileSync(join(stateDir, 'last-update-check'), 'utf-8');
    expect(cache).toContain('UP_TO_DATE');
  });

  // ─── State dir creation ─────────────────────────────────────
  test('creates state dir if it does not exist', () => {
    const newStateDir = join(stateDir, 'nested', 'dir');
    writeFileSync(join(gstackDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(gstackDir, 'REMOTE_VERSION'), '0.3.3\n');

    const { exitCode } = run({ GSTACK_STATE_DIR: newStateDir });
    expect(exitCode).toBe(0);
    expect(existsSync(join(newStateDir, 'last-update-check'))).toBe(true);
  });
});
