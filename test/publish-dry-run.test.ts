/**
 * gstack-publish end-to-end tests via --dry-run.
 *
 * Verifies manifest parsing, schema validation, marketplace auth checks, per-skill
 * error isolation, and command building — all without touching real marketplaces.
 *
 * --dry-run does NOT run execSync on publish commands. Auth checks still run
 * against real binaries; we use fake marketplaces whose `auth_check` commands
 * are always-succeed (`true`) or always-fail (`false`) so the test is hermetic.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin', 'gstack-publish');

let sandbox: string;
let binCopy: string;

beforeEach(() => {
  // gstack-publish reads skills.json relative to the binary's dir (import.meta.dir/..).
  // To isolate each test's manifest, we create a sandbox repo that mirrors the real
  // structure: copy the bin into sandbox/bin/, write a controlled skills.json at the root.
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-sandbox-'));
  fs.mkdirSync(path.join(sandbox, 'bin'));
  binCopy = path.join(sandbox, 'bin', 'gstack-publish');
  fs.copyFileSync(BIN, binCopy);
  fs.chmodSync(binCopy, 0o755);
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function writeManifest(manifest: object): void {
  fs.writeFileSync(path.join(sandbox, 'skills.json'), JSON.stringify(manifest, null, 2));
}

function writeSkillFile(relPath: string, content = '# Test Skill\n'): void {
  const full = path.join(sandbox, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('bun', ['run', binCopy, ...args], {
    cwd: sandbox,
    encoding: 'utf-8',
    timeout: 15000,
  });
  return {
    status: result.status,
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
  };
}

const VALID_MARKETPLACES = {
  fakestore_ok: {
    cli: 'true', // binary that always succeeds
    login_cmd: 'fakestore_ok login',
    publish_cmd_template: 'echo publish {slug} {version}',
    docs: 'https://fakestore.example',
    auth_check: 'true', // always-authenticated
  },
  fakestore_noauth: {
    cli: 'true',
    login_cmd: 'fakestore_noauth login',
    publish_cmd_template: 'echo publish {slug} {version}',
    docs: 'https://fakestore.example',
    auth_check: 'false', // always-fails auth
  },
  fakestore_missing: {
    cli: 'nonexistent-binary-xyz',
    login_cmd: 'fakestore_missing login',
    publish_cmd_template: 'echo publish {slug} {version}',
    docs: 'https://fakestore.example',
    auth_check: 'nonexistent-binary-xyz whoami',
  },
};

function validSkill(slug: string, sourceRel: string, marketplaces: string[] = ['fakestore_ok']) {
  const m: Record<string, { slug: string; publish: boolean }> = {};
  for (const name of marketplaces) m[name] = { slug, publish: true };
  return {
    slug,
    source: sourceRel,
    name: `Skill ${slug}`,
    version: '1.0.0',
    category: 'test',
    description: 'A test skill',
    marketplaces: m,
    standalone: true,
    compatible_hosts: ['claude-code'],
  };
}

describe('gstack-publish: manifest loading', () => {
  test('--list prints every skill and marketplace', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeSkillFile('skills/beta/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md'), validSkill('beta', 'skills/beta/SKILL.md')],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--list']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('alpha');
    expect(r.stdout).toContain('beta');
    expect(r.stdout).toContain('fakestore_ok');
  });

  test('missing manifest exits non-zero', () => {
    // Delete any manifest
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('skills.json');
  });

  test('malformed JSON exits non-zero', () => {
    fs.writeFileSync(path.join(sandbox, 'skills.json'), '{ not json');
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('parse');
  });
});

describe('gstack-publish: validation', () => {
  test('missing source file reports validation error and exits 1', () => {
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('ghost', 'skills/ghost/DOES_NOT_EXIST.md')],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('source file missing');
    expect(r.stderr).toContain('ghost');
  });

  test('missing slug reports validation error', () => {
    writeSkillFile('skills/x/SKILL.md');
    const s = validSkill('temp', 'skills/x/SKILL.md');
    delete (s as Partial<typeof s>).slug;
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [s],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('missing slug');
  });

  test('missing version reports validation error', () => {
    writeSkillFile('skills/x/SKILL.md');
    const s = validSkill('x', 'skills/x/SKILL.md');
    delete (s as Partial<typeof s>).version;
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [s],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('missing version');
  });

  test('no marketplaces configured reports validation error', () => {
    writeSkillFile('skills/x/SKILL.md');
    const s = { ...validSkill('x', 'skills/x/SKILL.md'), marketplaces: {} };
    writeManifest({ version: '1.0.0', description: 't', skills: [s], marketplaces: VALID_MARKETPLACES });
    const r = run(['--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('no marketplaces configured');
  });
});

describe('gstack-publish: dry-run execution', () => {
  test('happy path reports DRY-RUN tag and templated command', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md')],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('DRY-RUN');
    expect(r.stdout).toContain('alpha');
    expect(r.stdout).toContain('Published: 1');
    expect(r.stdout).toContain('Failed:    0');
  });

  test('per-skill filter publishes only the requested slug', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeSkillFile('skills/beta/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md'), validSkill('beta', 'skills/beta/SKILL.md')],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['alpha', '--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Publishing alpha');
    expect(r.stdout).not.toContain('Publishing beta');
    expect(r.stdout).toContain('Published: 1');
  });

  test('unknown skill filter exits non-zero', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md')],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['nonexistent', '--dry-run']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('skill not found');
  });
});

describe('gstack-publish: auth check isolation', () => {
  test('failing auth for one marketplace does NOT abort the batch in dry-run', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md', ['fakestore_ok', 'fakestore_noauth'])],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    // In dry-run, auth failures are reported but don't block dispatch
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('fakestore_ok: OK');
    expect(r.stdout).toContain('fakestore_noauth: NOT READY');
  });

  test('missing binary reported as not-ready with docs link', () => {
    writeSkillFile('skills/alpha/SKILL.md');
    writeManifest({
      version: '1.0.0',
      description: 't',
      skills: [validSkill('alpha', 'skills/alpha/SKILL.md', ['fakestore_missing'])],
      marketplaces: VALID_MARKETPLACES,
    });
    const r = run(['--dry-run']);
    expect(r.stdout).toContain('fakestore_missing: NOT READY');
    expect(r.stdout).toContain('not on PATH');
  });
});

describe('gstack-publish: real manifest sanity', () => {
  test('the real repo skills.json passes --dry-run validation', () => {
    // This uses the actual bin against the actual manifest (ROOT/skills.json).
    // If auth to any real marketplace isn't set up it just reports NOT READY;
    // --dry-run still exits 0 because it doesn't require auth to pass.
    const real = spawnSync('bun', ['run', path.join(ROOT, 'bin', 'gstack-publish'), '--dry-run'], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 20000,
    });
    expect(real.status).toBe(0);
    expect(real.stdout).toContain('Validating manifest');
    // Every skill in the real manifest should pass validation
    expect(real.stderr).not.toContain('Manifest validation failed');
  });
});
