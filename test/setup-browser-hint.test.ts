/**
 * setup: the browser lines of the final summary. Aside (aside.com, macOS 15+)
 * is the primary driver; the compiled browse binary is the fallback.
 *
 * Since the Chromium bootstrap became best-effort (#2802, _PW_FAIL_REASON),
 * two places must consult that reason so they never promise a bundled browser
 * that cannot launch, and never tell an Aside user their browser skills are
 * gone when only the fallback is missing:
 *   - _browser_hint, the one-line "browser:" hint under every host's
 *     "gstack ready" block;
 *   - the Chromium bootstrap summary printed last.
 * Behavior fixture: extract the code from setup and run it with the Aside
 * probe stubbed and the reason set or empty.
 */
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const SETUP_SRC = fs.readFileSync(path.join(ROOT, 'setup'), 'utf-8');

function extractFn(name: string): string {
  const start = SETUP_SRC.indexOf(`${name}() {`);
  const end = SETUP_SRC.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name}() in setup`);
  return SETUP_SRC.slice(start, end + 2);
}

// The reason branch of the final summary, up to (not including) the
// foreign-entries report that follows it.
function summaryReasonBlock(): string {
  const start = SETUP_SRC.indexOf('# ─── Chromium bootstrap summary');
  const end = SETUP_SRC.indexOf('if [ ${#_FOREIGN_SKIPPED_ENTRIES[@]}', start);
  if (start < 0 || end < 0) throw new Error('Could not locate the Chromium bootstrap summary block in setup');
  return SETUP_SRC.slice(start, end);
}

// `command -v aside` is the only probe either site makes; shadow the builtin
// so the test never depends on whether the machine running it has Aside.
const COMMAND_SHADOW = 'command() { if [ "$1" = "-v" ] && [ "$2" = "aside" ]; then [ "$ASIDE_PRESENT" = "1" ]; else builtin command "$@"; fi; }';

function runBash(lines: string[]): string {
  const r = spawnSync('bash', ['-c', lines.join('\n')], { encoding: 'utf-8', timeout: 30_000 });
  expect(r.stderr).toBe('');
  expect(r.status).toBe(0);
  return r.stdout;
}

function runHint(opts: { aside: boolean; reason: string }): string {
  return runBash([
    'set -e',
    'log() { echo "$@"; }',
    `ASIDE_PRESENT=${opts.aside ? 1 : 0}`,
    COMMAND_SHADOW,
    `_PW_FAIL_REASON=${JSON.stringify(opts.reason)}`,
    extractFn('_browser_hint'),
    '_browser_hint',
  ]);
}

function runSummary(opts: { aside: boolean; reason: string }): string {
  return runBash([
    'set -e',
    'log() { echo "$@"; }',
    `ASIDE_PRESENT=${opts.aside ? 1 : 0}`,
    COMMAND_SHADOW,
    'SOURCE_GSTACK_DIR=/nonexistent-gstack-dir', // no telemetry binary → the event is skipped
    `_PW_FAIL_REASON=${JSON.stringify(opts.reason)}`,
    summaryReasonBlock(),
    'echo REACHED_END=1',
  ]);
}

describe('setup: _browser_hint', () => {
  test('static pin: the hint reads _PW_FAIL_REASON', () => {
    expect(extractFn('_browser_hint')).toContain('_PW_FAIL_REASON');
  });

  test('Aside present, bootstrap fine → Aside primary with the bundled fallback', () => {
    const out = runHint({ aside: true, reason: '' });
    expect(out).toContain('browser: Aside (primary) — gstack browser is the fallback');
  });

  test('Aside present, bootstrap failed → Aside primary, fallback named unavailable with the reason', () => {
    const out = runHint({ aside: true, reason: 'chromium-install-timeout' });
    expect(out).toContain('Aside (primary)');
    expect(out).toContain('fallback unavailable');
    expect(out).toContain('chromium-install-timeout');
    expect(out).not.toContain('gstack browser is the fallback');
  });

  test('Aside absent, bootstrap fine → bundled browser is the fallback, Aside suggested', () => {
    const out = runHint({ aside: false, reason: '' });
    expect(out).toContain('browser: gstack browser (fallback). Install Aside for the primary path: aside.com (macOS 15+)');
  });

  test('Aside absent, bootstrap failed → no browser promised; reason and both remedies named', () => {
    const out = runHint({ aside: false, reason: 'chromium-install,post-install-launch' });
    expect(out).toContain('browser: none available');
    expect(out).toContain('chromium-install,post-install-launch');
    expect(out).toContain('install Aside');
    expect(out).toContain('re-run ./setup');
    expect(out).not.toContain('gstack browser (fallback)');
  });
});

describe('setup: Chromium bootstrap summary is Aside-aware', () => {
  test('Aside present → skills keep running in Aside, only the fallback is missing, /pair-agent excepted', () => {
    const out = runSummary({ aside: true, reason: 'chromium-install' });
    expect(out).toContain('Browser unavailable: Chromium bootstrap did not complete (chromium-install)');
    expect(out).toContain('Aside is installed');
    expect(out).toContain('only their bundled fallback is missing');
    expect(out).toContain('/pair-agent needs the bundled browser itself');
    expect(out).not.toContain('Skills that need it:');
    expect(out).toContain('REACHED_END=1');
  });

  test('Aside absent → the pre-Aside wording: the skills need the bundled browser', () => {
    const out = runSummary({ aside: false, reason: 'chromium-install' });
    expect(out).toContain('Browser unavailable: Chromium bootstrap did not complete (chromium-install)');
    expect(out).toContain('Skills that need it:');
    for (const skill of ['/qa', '/qa-only', '/design-review', '/browse', 'make-pdf', '/pair-agent']) {
      expect(out).toContain(skill);
    }
    expect(out).not.toContain('Aside is installed');
    expect(out).toContain('REACHED_END=1');
  });

  test('no failure → the reason branch prints nothing', () => {
    const out = runSummary({ aside: true, reason: '' });
    expect(out).not.toContain('Browser unavailable');
    expect(out).toContain('REACHED_END=1');
  });
});
