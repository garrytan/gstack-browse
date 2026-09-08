import { afterEach, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '..');
const COMMAND = join(ROOT, 'bin', 'gstack-memorable');
const HOOK = join(ROOT, 'hosts', 'claude', 'hooks', 'memorable-user-prompt-hook');
const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'gstack-memorable-'));
  homes.push(home);
  const claude = join(home, '.claude');
  mkdirSync(claude, { recursive: true });
  const settings = join(claude, 'settings.json');
  const log = join(home, 'calls.log');
  const fake = join(home, 'memorable');
  writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\nif [ "$1" = hook ]; then printf '%s' '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"remembered"}}'; fi\n`);
  chmodSync(fake, 0o700);
  return { home, settings, log, fake };
}

function envFor(f: ReturnType<typeof fixture>) {
  return {
    ...process.env,
    HOME: f.home,
    GSTACK_SETTINGS_FILE: f.settings,
    MEMORABLE_BIN: f.fake,
  };
}

describe('gstack-memorable', () => {
  test('enable registers the hook; disable removes it without deleting foreign hooks', () => {
    const f = fixture();
    writeFileSync(f.settings, JSON.stringify({
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: '/foreign/hook' }] }] },
    }));

    const enabled = spawnSync(COMMAND, ['enable'], { env: envFor(f), encoding: 'utf8' });
    expect(enabled.status).toBe(0);
    expect(readFileSync(f.log, 'utf8')).toContain('enable');
    let settings = JSON.parse(readFileSync(f.settings, 'utf8'));
    const commands = settings.hooks.UserPromptSubmit.flatMap((e: any) => e.hooks.map((h: any) => h.command));
    expect(commands).toContain('/foreign/hook');
    expect(commands).toContain(HOOK);

    const disabled = spawnSync(COMMAND, ['disable'], { env: envFor(f), encoding: 'utf8' });
    expect(disabled.status).toBe(0);
    expect(readFileSync(f.log, 'utf8')).toContain('disable');
    settings = JSON.parse(readFileSync(f.settings, 'utf8'));
    const remaining = settings.hooks.UserPromptSubmit.flatMap((e: any) => e.hooks.map((h: any) => h.command));
    expect(remaining).toEqual(['/foreign/hook']);
  });

  test('hook delegates stdin/stdout and fails open when Memorable is unavailable', () => {
    const f = fixture();
    const payload = '{"session_id":"s1","prompt":"repeat the task"}';
    const delegated = spawnSync(HOOK, [], { env: envFor(f), input: payload, encoding: 'utf8' });
    expect(delegated.status).toBe(0);
    expect(delegated.stdout).toContain('"additionalContext":"remembered"');
    expect(readFileSync(f.log, 'utf8')).toContain('hook user-prompt');

    const missingEnv = { ...process.env, HOME: f.home, MEMORABLE_BIN: join(f.home, 'missing') };
    const missing = spawnSync(HOOK, [], { env: missingEnv, input: payload, encoding: 'utf8' });
    expect(missing.status).toBe(0);
    expect(missing.stdout).toBe('');
    expect(missing.stderr).toBe('');
  });

  test('enable refuses when Memorable already registered the hook itself', () => {
    // Memorable's own installer (`memorable start`, `setup`, `install-hooks`)
    // writes this same UserPromptSubmit hook under its own name, and that is
    // the documented way to install the CLI. Registering ours beside it runs
    // the command twice per prompt: injected twice, captured twice against the
    // user's own allowance.
    const f = fixture();
    const theirs = `"${join(f.home, '.memorable', 'bin', 'memorable')}" hook user-prompt`;
    writeFileSync(f.settings, JSON.stringify({
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: theirs }] }] },
    }));

    const enabled = spawnSync(COMMAND, ['enable'], { env: envFor(f), encoding: 'utf8' });
    expect(enabled.status).not.toBe(0);
    expect(enabled.stderr).toContain('already registers this hook itself');
    // It refused before doing anything: no consent recorded, settings untouched.
    expect(existsSync(f.log)).toBe(false);
    const after = JSON.parse(readFileSync(f.settings, 'utf8'));
    const commands = after.hooks.UserPromptSubmit.flatMap((e: any) => e.hooks.map((h: any) => h.command));
    expect(commands).toEqual([theirs]);
  });

  test('status names Memorable\'s own registration rather than reporting none', () => {
    const f = fixture();
    const theirs = `"${join(f.home, '.memorable', 'bin', 'memorable')}" hook user-prompt`;
    writeFileSync(f.settings, JSON.stringify({
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: theirs }] }] },
    }));

    const status = spawnSync(COMMAND, ['status'], { env: envFor(f), encoding: 'utf8' });
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('registered by Memorable itself');
    expect(status.stdout).not.toContain('not registered');
  });

  test('a foreign UserPromptSubmit hook is not mistaken for Memorable\'s', () => {
    const f = fixture();
    writeFileSync(f.settings, JSON.stringify({
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: '/foreign/hook' }] }] },
    }));
    const enabled = spawnSync(COMMAND, ['enable'], { env: envFor(f), encoding: 'utf8' });
    expect(enabled.status).toBe(0);
  });

  test('status is read-only and reports both dependencies', () => {
    const f = fixture();
    const status = spawnSync(COMMAND, ['status'], { env: envFor(f), encoding: 'utf8' });
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('Memorable CLI: available');
    expect(status.stdout).toContain('Claude UserPromptSubmit hook: not registered');
    expect(existsSync(f.log)).toBe(false);
  });
});
