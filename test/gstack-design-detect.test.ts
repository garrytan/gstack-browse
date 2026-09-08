/**
 * bin/gstack-design-detect.ts — hermetic tests against the fake engine.
 *
 * Every case runs the wrapper in a temp git repo with a scrubbed env (temp
 * GSTACK_HOME, temp IMPECCABLE_HOME, PATH reduced to bun + system dirs, no
 * IMPECCABLE_BIN unless the case sets it). The fake engine
 * (test/fixtures/fake-impeccable.ts) is spawned directly through its shebang,
 * so spawn-backed cases are POSIX-only; the pure-function cases run everywhere.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { SENTINEL, DETECT_LIMITS, UNTRUSTED_BEGIN } from '../lib/design-detect-contract';

const ROOT = path.join(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin', 'gstack-design-detect.ts');
const FAKE_SRC = path.join(ROOT, 'test', 'fixtures', 'fake-impeccable.ts');
const SAMPLE = path.join(ROOT, 'test', 'fixtures', 'impeccable-detect-sample.json');
const POSIX = process.platform !== 'win32';
const BUN_DIR = path.dirname(process.execPath);

let SANDBOX: string;     // holds everything the tests create
let REPO: string;        // temp git repo (cwd for the wrapper)
let FAKE: string;        // executable copy of the fake engine OUTSIDE the repo
let GSTACK_HOME: string; // temp gstack home (config.yaml, analytics)
let IMPECCABLE_HOME: string;

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 30_000 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

beforeAll(() => {
  SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-detect-'));
  REPO = path.join(SANDBOX, 'repo');
  fs.mkdirSync(REPO);
  git(REPO, 'init', '-q', '-b', 'main');
  git(REPO, 'config', 'user.email', 't@example.com');
  git(REPO, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(REPO, 'src', 'components'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'src', 'components', 'Card.tsx'), 'export const Card = () => <div style={{ borderLeft: "3px solid red" }} />;\n');
  fs.writeFileSync(path.join(REPO, 'src', 'styles.css'), '.hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); }\n');
  fs.writeFileSync(path.join(REPO, 'src', 'server.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(REPO, 'README.md'), '# t\n');
  git(REPO, 'add', '-A');
  git(REPO, 'commit', '-q', '-m', 'base');
  FAKE = path.join(SANDBOX, 'engines', 'fake-impeccable');
  fs.mkdirSync(path.dirname(FAKE), { recursive: true });
  fs.copyFileSync(FAKE_SRC, FAKE);
  fs.chmodSync(FAKE, 0o755);
  GSTACK_HOME = path.join(SANDBOX, 'gstack-home');
  IMPECCABLE_HOME = path.join(SANDBOX, 'impeccable-home');
  fs.mkdirSync(GSTACK_HOME);
  fs.mkdirSync(IMPECCABLE_HOME);
});

afterAll(() => {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
});

interface RunOpts { env?: Record<string, string | undefined>; cwd?: string }
function run(args: string[], opts: RunOpts = {}) {
  const env: Record<string, string> = {
    PATH: [BUN_DIR, '/usr/bin', '/bin', '/usr/local/bin'].join(path.delimiter),
    HOME: path.join(SANDBOX, 'fake-home'),
    GSTACK_HOME,
    IMPECCABLE_HOME,
    FAKE_IMPECCABLE_OUTPUT: SAMPLE,
  };
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    if (v === undefined) delete env[k]; else env[k] = v;
  }
  const r = spawnSync(process.execPath, ['--no-env-file', 'run', BIN, ...args], {
    cwd: opts.cwd ?? REPO, encoding: 'utf-8', timeout: 60_000, env,
  });
  return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function lines(s: string) { return s.split('\n').filter(Boolean); }

describe('probe', () => {
  test('empty environment → NOT_AVAILABLE, skill/hook absent, no hint', () => {
    const r = run(['probe', '--host', 'claude']);
    expect(r.code).toBe(0);
    const l = lines(r.out);
    expect(l[0]).toBe(SENTINEL.NOT_AVAILABLE);
    expect(l).toContain(`${SENTINEL.SKILL}: absent`);
    expect(l).toContain(`${SENTINEL.HOOK}: absent`);
    expect(r.out).not.toContain(SENTINEL.HINT);
    expect(r.out).not.toContain('npx impeccable');
  });

  test.skipIf(!POSIX)('IMPECCABLE_BIN pointing at an executable outside the repo → READY', () => {
    const r = run(['probe'], { env: { IMPECCABLE_BIN: FAKE } });
    expect(lines(r.out)[0]).toBe(`${SENTINEL.READY}: ${fs.realpathSync(FAKE)}`);
    // the fake has no version source, so it is reported untested by content hash
    expect(r.out).toMatch(new RegExp(`${SENTINEL.ENGINE_UNTESTED}: sha256:[0-9a-f]{12}`));
  });

  test('IMPECCABLE_BIN inside the repository is ignored', () => {
    const inRepo = path.join(REPO, 'tools', 'impeccable');
    fs.mkdirSync(path.dirname(inRepo), { recursive: true });
    fs.writeFileSync(inRepo, '#!/bin/sh\necho MARKER > marker.txt\n');
    fs.chmodSync(inRepo, 0o755);
    const r = run(['probe'], { env: { IMPECCABLE_BIN: inRepo } });
    expect(r.out).toContain(`${SENTINEL.ENV_IGNORED}: IMPECCABLE_BIN resolves inside the repository`);
    expect(lines(r.out)[0]).toBe(SENTINEL.NOT_AVAILABLE);
    expect(fs.existsSync(path.join(REPO, 'marker.txt'))).toBe(false);
    fs.rmSync(path.join(REPO, 'tools'), { recursive: true, force: true });
  });

  test('a cwd .env naming IMPECCABLE_BIN is never loaded (--no-env-file) and never executed', () => {
    const marker = path.join(SANDBOX, 'env-marker.txt');
    const evil = path.join(SANDBOX, 'evil-engine');
    fs.writeFileSync(evil, `#!/bin/sh\necho MARKER > ${JSON.stringify(marker)}\n`);
    fs.chmodSync(evil, 0o755);
    fs.writeFileSync(path.join(REPO, '.env'), `IMPECCABLE_BIN=${evil}\n`);
    try {
      const r = run(['probe']);
      expect(lines(r.out)[0]).toBe(SENTINEL.NOT_AVAILABLE);
      expect(fs.existsSync(marker)).toBe(false);
    } finally {
      fs.rmSync(path.join(REPO, '.env'), { force: true });
    }
  });

  test('relative IMPECCABLE_BIN is ignored', () => {
    const r = run(['probe'], { env: { IMPECCABLE_BIN: 'engines/fake-impeccable' } });
    expect(r.out).toContain(`${SENTINEL.ENV_IGNORED}: IMPECCABLE_BIN is not an absolute path`);
  });

  test.skipIf(!POSIX)('cache under IMPECCABLE_HOME picks the newest semver, skipping non-semver dirs', () => {
    for (const v of ['0.1.3', '0.1.10', 'latest', '0.2.0-rc1']) {
      const dir = path.join(IMPECCABLE_HOME, 'bin', v);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(FAKE, path.join(dir, 'impeccable'));
      fs.chmodSync(path.join(dir, 'impeccable'), 0o755);
    }
    try {
      const r = run(['probe']);
      expect(lines(r.out)[0]).toBe(`${SENTINEL.READY}: ${path.join(fs.realpathSync(IMPECCABLE_HOME), 'bin', '0.2.0-rc1', 'impeccable')}`);
      expect(r.out).toContain(`${SENTINEL.ENGINE_UNTESTED}: 0.2.0-rc1`);
      fs.rmSync(path.join(IMPECCABLE_HOME, 'bin', '0.2.0-rc1'), { recursive: true });
      const r2 = run(['probe']);
      expect(lines(r2.out)[0]).toContain(path.join('bin', '0.1.10', 'impeccable'));
      fs.rmSync(path.join(IMPECCABLE_HOME, 'bin', '0.1.10'), { recursive: true });
      const r3 = run(['probe']);
      expect(lines(r3.out)[0]).toContain(path.join('bin', '0.1.3', 'impeccable'));
      expect(r3.out).not.toContain(SENTINEL.ENGINE_UNTESTED);
    } finally {
      fs.rmSync(path.join(IMPECCABLE_HOME, 'bin'), { recursive: true, force: true });
    }
  });

  test('a #! shim named impeccable on PATH is launcher-present, not READY → NOT_CACHED with the npx hint', () => {
    const shimDir = path.join(SANDBOX, 'shim-bin');
    fs.mkdirSync(shimDir, { recursive: true });
    const shim = path.join(shimDir, 'impeccable');
    fs.writeFileSync(shim, '#!/usr/bin/env node\nconsole.log("would download");\n');
    fs.chmodSync(shim, 0o755);
    const r = run(['probe'], { env: { PATH: [BUN_DIR, shimDir, '/usr/bin', '/bin'].join(path.delimiter) } });
    expect(lines(r.out)[0]).toBe(`${SENTINEL.NOT_CACHED}: ${path.join(fs.realpathSync(shimDir), 'impeccable')}`);
    expect(r.out).toContain(`${SENTINEL.HINT}: impeccable is installed but its engine is not cached`);
    expect(r.out).toContain('npx impeccable detect --help');
    expect(r.out).toContain('gstack-config set design_detector off');
    expect(r.out).not.toContain('would download');
  });

  test.skipIf(!POSIX)('skill install: launcher without engine → NOT_CACHED naming the launcher; with sibling engine → READY + VERSION', () => {
    const scripts = path.join(REPO, '.claude', 'skills', 'impeccable', 'scripts');
    fs.mkdirSync(scripts, { recursive: true });
    fs.writeFileSync(path.join(REPO, '.claude', 'skills', 'impeccable', 'SKILL.md'), '# impeccable\n');
    fs.writeFileSync(path.join(scripts, 'impeccable'), '#!/bin/sh\necho "would download"\n');
    fs.chmodSync(path.join(scripts, 'impeccable'), 0o755);
    fs.writeFileSync(path.join(scripts, 'VERSION'), '0.1.3\n');
    try {
      const r = run(['probe']);
      expect(lines(r.out)[0]).toBe(`${SENTINEL.NOT_CACHED}: ${path.join(scripts, 'impeccable')}`);
      expect(r.out).toContain(`${SENTINEL.SKILL}: present`);
      expect(r.out).toContain(`run \`${path.join(scripts, 'impeccable')} detect --help\` once`);
      expect(r.out).not.toContain('npx impeccable');
      expect(r.out).not.toContain('would download');

      const sib = path.join(scripts, 'bin', `${process.platform}-${process.arch}`);
      fs.mkdirSync(sib, { recursive: true });
      fs.copyFileSync(FAKE, path.join(sib, 'impeccable'));
      fs.chmodSync(path.join(sib, 'impeccable'), 0o755);
      const r2 = run(['probe']);
      expect(lines(r2.out)[0]).toBe(`${SENTINEL.READY}: ${path.join(sib, 'impeccable')}`);
      expect(r2.out).not.toContain(SENTINEL.ENGINE_UNTESTED);
      expect(r2.out).not.toContain(SENTINEL.HINT);
    } finally {
      fs.rmSync(path.join(REPO, '.claude'), { recursive: true, force: true });
    }
  });

  test('design_detector: off → DISABLED and nothing else is probed', () => {
    fs.writeFileSync(path.join(GSTACK_HOME, 'config.yaml'), 'proactive: true\ndesign_detector: off\n');
    try {
      const r = run(['probe'], { env: { IMPECCABLE_BIN: FAKE } });
      expect(lines(r.out)[0]).toBe(SENTINEL.DISABLED);
      expect(r.out).not.toContain(SENTINEL.READY);
    } finally {
      fs.rmSync(path.join(GSTACK_HOME, 'config.yaml'));
    }
  });

  test('hook detection is host-aware; hook.enabled=false turns it off; malformed settings → unknown', () => {
    const claudeDir = path.join(REPO, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.local.json'), JSON.stringify({
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '.claude/skills/impeccable/scripts/impeccable hook' }] }] },
    }));
    fs.mkdirSync(path.join(REPO, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(REPO, '.cursor', 'hooks.json'), JSON.stringify({ hooks: { afterFileEdit: [{ command: '.cursor/skills/impeccable/scripts/impeccable hook' }] } }));
    try {
      const claude = run(['probe', '--host', 'claude']);
      expect(claude.out).toContain(`${SENTINEL.HOOK}: present`);
      expect(claude.out).toContain(`${SENTINEL.HOOK_OTHER}: cursor`);
      const codex = run(['probe', '--host', 'codex']);
      expect(codex.out).toContain(`${SENTINEL.HOOK}: absent`);
      expect(codex.out).toContain(`${SENTINEL.HOOK_OTHER}: claude,cursor`);

      fs.mkdirSync(path.join(REPO, '.impeccable'), { recursive: true });
      fs.writeFileSync(path.join(REPO, '.impeccable', 'config.json'), JSON.stringify({ hook: { enabled: false } }));
      const off = run(['probe', '--host', 'claude']);
      expect(off.out).toContain(`${SENTINEL.HOOK}: absent`);
      fs.rmSync(path.join(REPO, '.impeccable'), { recursive: true });

      fs.writeFileSync(path.join(claudeDir, 'settings.local.json'), '{ not json');
      const bad = run(['probe', '--host', 'claude']);
      expect(bad.out).toContain(`${SENTINEL.HOOK}: unknown`);
    } finally {
      fs.rmSync(claudeDir, { recursive: true, force: true });
      fs.rmSync(path.join(REPO, '.cursor'), { recursive: true, force: true });
    }
  });

  test('ignored rules and files are the union of config.json and config.local.json; malformed config is reported', () => {
    const dir = path.join(REPO, '.impeccable');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ detector: { ignoreRules: ['overused-font'], ignoreFiles: ['src/legacy/**'] } }));
    fs.writeFileSync(path.join(dir, 'config.local.json'), JSON.stringify({ detector: { ignoreRules: ['em-dash-overuse', 'overused-font'] } }));
    try {
      const r = run(['probe']);
      expect(r.out).toContain(`${SENTINEL.IGNORED_RULES}: overused-font,em-dash-overuse`);
      expect(r.out).toContain(`${SENTINEL.IGNORED_FILES}: src/legacy/**`);
      fs.writeFileSync(path.join(dir, 'config.local.json'), '{{{');
      const bad = run(['probe']);
      expect(bad.out).toContain(`${SENTINEL.CONFIG_UNREADABLE}: ${path.join(dir, 'config.local.json')}`);
      expect(bad.out).toContain(`${SENTINEL.IGNORED_RULES}: overused-font`);
      expect(bad.code).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('probe and scan append one analytics line each to the gstack home', () => {
    const log = path.join(GSTACK_HOME, 'analytics', 'design-detector.jsonl');
    fs.rmSync(log, { force: true });
    run(['probe']);
    run(['scan', 'src/styles.css']);
    const recs = fs.readFileSync(log, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
    expect(recs.length).toBe(2);
    expect(recs[0].verb).toBe('probe');
    expect(recs[1].verb).toBe('scan');
    for (const r of recs) { expect(typeof r.ts).toBe('string'); expect(JSON.stringify(r)).not.toContain('styles.css'); }
  });

  test('--verbose prints probe steps', () => {
    const r = run(['probe', '--verbose']);
    expect(r.out).toContain('PROBE_STEP: design_detector=auto');
    expect(r.out).toContain('PROBE_STEP: PATH walk');
  });
});

describe('scan', () => {
  test('not READY → prints the probe lines, exit 0, engine never needed', () => {
    const r = run(['scan', 'src/styles.css']);
    expect(r.code).toBe(0);
    expect(lines(r.out)[0]).toBe(SENTINEL.NOT_AVAILABLE);
  });

  test.skipIf(!POSIX)('URL and out-of-root targets are refused and the engine is never spawned', () => {
    const log = path.join(SANDBOX, 'argv.log');
    fs.rmSync(log, { force: true });
    const outside = path.join(SANDBOX, 'outside.html');
    fs.writeFileSync(outside, '<html></html>');
    const r = run(['scan', 'https://example.com', 'file:///etc/passwd', outside, '/etc/hostname'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_LOG: log } });
    expect(r.code).toBe(0);
    expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: https://example.com (URL targets are never scanned)`);
    expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: file:///etc/passwd`);
    expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: ${outside} (outside the repository`);
    expect(r.err).toContain(SENTINEL.DETECT_NO_TARGETS);
    expect(fs.existsSync(log)).toBe(false);
  });

  test.skipIf(!POSIX)('a symlink under designs/ pointing outside is refused; a real file under designs/ is accepted', () => {
    const designs = path.join(GSTACK_HOME, 'projects', 'x', 'designs', 'design-audit-20260908', 'dom');
    fs.mkdirSync(designs, { recursive: true });
    fs.writeFileSync(path.join(designs, 'home.dom.html'), '<html></html>');
    fs.symlinkSync('/etc', path.join(designs, 'etc-link'));
    const notDesigns = path.join(GSTACK_HOME, 'projects', 'x', 'other.html');
    fs.writeFileSync(notDesigns, '<html></html>');
    const log = path.join(SANDBOX, 'argv2.log');
    fs.rmSync(log, { force: true });
    try {
      const r = run(['scan', '--format', 'gstack', path.join(designs, 'home.dom.html'), path.join(designs, 'etc-link'), notDesigns], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_LOG: log } });
      expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: ${path.join(designs, 'etc-link')}`);
      expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: ${notDesigns}`);
      const argv = JSON.parse(fs.readFileSync(log, 'utf-8').trim().split('\n')[0]).argv as string[];
      expect(argv.slice(0, 2)).toEqual(['detect', '--json']);
      expect(argv.slice(2)).toEqual([fs.realpathSync(path.join(designs, 'home.dom.html'))]);
      expect(r.code).toBe(2);
    } finally {
      fs.rmSync(path.join(GSTACK_HOME, 'projects'), { recursive: true, force: true });
    }
  });

  test.skipIf(!POSIX)('engine invoked with stdin ignored, absolute realpaths, repo cwd; exit code passes through', () => {
    const log = path.join(SANDBOX, 'argv3.log');
    fs.rmSync(log, { force: true });
    for (const code of ['0', '1', '2']) {
      const r = run(['scan', 'src/styles.css', './src/components/Card.tsx'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_LOG: log, FAKE_IMPECCABLE_EXIT: code } });
      expect(r.code).toBe(Number(code));
      expect(r.err).toContain(`${SENTINEL.DETECT_EXIT}: ${code}`);
    }
    const rec = JSON.parse(fs.readFileSync(log, 'utf-8').trim().split('\n')[0]);
    expect(rec.stdinIsTTY).toBe(false);
    expect(rec.cwd).toBe(fs.realpathSync(REPO));
    expect(rec.argv.slice(2).every((a: string) => path.isAbsolute(a))).toBe(true);
    expect(rec.argv.slice(2)).toEqual([fs.realpathSync(path.join(REPO, 'src', 'styles.css')), fs.realpathSync(path.join(REPO, 'src', 'components', 'Card.tsx'))]);
  });

  test.skipIf(!POSIX)('--format raw is a byte-for-byte passthrough of the engine stdout', () => {
    const r = run(['scan', '--format', 'raw', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE } });
    expect(r.out).toBe(fs.readFileSync(SAMPLE, 'utf-8'));
    expect(r.code).toBe(2);
  });

  test.skipIf(!POSIX)('--format gstack normalizes by catalog: tiers, impacts, handoffs, advisory, unmapped; stdout is one JSON document', () => {
    const custom = path.join(SANDBOX, 'custom.json');
    fs.writeFileSync(custom, JSON.stringify([
      { antipattern: 'overused-font', name: 'Overused font', description: 'x', severity: 'warning', category: 'slop', file: 'a.css', line: 3, snippet: 'font-family: Inter' },
      { antipattern: 'em-dash-overuse', name: 'Em dash', description: 'x', severity: 'warning', category: 'slop', file: 'a.html', line: 0, snippet: '— — —' },
      { antipattern: 'brand-new-rule', name: 'New', description: 'x'.repeat(500), severity: 'warning', category: 'slop', file: 'a.html', line: 1, snippet: 'y'.repeat(500) },
      { antipattern: 'Bad Id!!', description: 'x', category: 'weird', file: 'a.html', line: 'nope', snippet: 'ctl\x01chars\x02 here' },
      { antipattern: 'low-contrast', name: 'Low contrast text', description: 'x', severity: 'warning', category: 'quality', file: 'a.html', line: 0, snippet: '3:1' },
    ]));
    const r = run(['scan', '--format', 'gstack', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_OUTPUT: custom } });
    const doc = JSON.parse(r.out);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.total).toBe(5);
    expect(doc.advisory).toBe(1);
    expect(doc.counted).toBe(4);
    const by = Object.fromEntries(doc.findings.map((f: any) => [f.impeccableId, f]));
    expect(by['overused-font']).toMatchObject({ tier: 'ask', impact: 'medium', handoff: 'typeset', kind: 'slop', category: 'type', advisory: false });
    expect(by['em-dash-overuse']).toMatchObject({ advisory: true, tier: 'possible', impact: 'polish' });
    expect(by['brand-new-rule']).toMatchObject({ unmapped: true, impact: 'medium', tier: 'ask', kind: 'slop' });
    expect(by['brand-new-rule'].message.length).toBeLessThanOrEqual(DETECT_LIMITS.field.message);
    expect(by['brand-new-rule'].snippet.length).toBeLessThanOrEqual(DETECT_LIMITS.field.snippet);
    const weird = doc.findings.find((f: any) => f.id === 'unmapped');
    expect(weird.line).toBe(0);
    expect(weird.snippet).toBe('ctlchars here');
    expect(weird.kind).toBe('unknown');
    expect(by['low-contrast']).toMatchObject({ impact: 'high', kind: 'quality' });
    // stderr carries the fenced DETECT_TOP block and the summary; advisory excluded from counts.
    expect(r.err).toContain(UNTRUSTED_BEGIN);
    expect(r.err).toContain(`${SENTINEL.DETECT_TOP} total=5 rules=4`);
    expect(r.err).toMatch(/\[low-contrast\] impact=high tier=ask count=1 handoff=\/impeccable colorize/);
    expect(r.err).toContain(`${SENTINEL.DETECT_SUMMARY}: total=5 slop=2 quality=1 advisory=1 ignored=0 high=1 medium=3 polish=0`);
    expect(r.err).not.toMatch(/\[em-dash-overuse\]/);
  });

  test.skipIf(!POSIX)('display cap: 500+ findings → DETECT_TOP shows 50 locations and the total; JSON keeps all', () => {
    const r = run(['scan', '--format', 'gstack', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_REPEAT: '84' } });
    const doc = JSON.parse(r.out);
    expect(doc.total).toBe(504);
    expect(doc.findings.length).toBe(504);
    expect(doc.truncated).toBe(false);
    const locations = r.err.split('\n').filter(l => /^ {2}\S.*:\d+ {2}/.test(l));
    expect(locations.length).toBe(DETECT_LIMITS.topLocations);
    expect(r.err).toContain(`${SENTINEL.DETECT_TOP} total=504`);
    expect(r.err).toContain('more locations in the JSON');
  });

  test.skipIf(!POSIX)('ignored rules from config are reported in the summary, never re-derived from findings', () => {
    fs.mkdirSync(path.join(REPO, '.impeccable'), { recursive: true });
    fs.writeFileSync(path.join(REPO, '.impeccable', 'config.json'), JSON.stringify({ detector: { ignoreRules: ['marketing-buzzword', 'side-tab'] } }));
    try {
      const r = run(['scan', '--format', 'gstack', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE } });
      const doc = JSON.parse(r.out);
      expect(doc.ignoredRules).toEqual(['marketing-buzzword', 'side-tab']);
      expect(r.err).toContain('ignored=2');
    } finally {
      fs.rmSync(path.join(REPO, '.impeccable'), { recursive: true, force: true });
    }
  });

  test.skipIf(!POSIX)('engine that hangs is killed at the timeout → DETECT_TIMEOUT, exit 1, no orphan', () => {
    const t0 = Date.now();
    const r = run(['scan', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_SLEEP_MS: '20000', GSTACK_DESIGN_DETECT_TIMEOUT_MS: '300' } });
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(r.code).toBe(1);
    expect(r.err).toContain(`${SENTINEL.DETECT_TIMEOUT}: 300ms`);
  });

  test.skipIf(!POSIX)('engine printing half a JSON document → DETECT_PARSE_ERROR, exit 1', () => {
    const r = run(['scan', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_RAW: '[{"antipattern": "side-tab", "fi', FAKE_IMPECCABLE_EXIT: '2' } });
    expect(r.code).toBe(1);
    expect(r.err).toContain(`${SENTINEL.DETECT_PARSE_ERROR}: [{"antipattern": "side-tab", "fi`);
  });

  test.skipIf(!POSIX)('engine stderr diagnostics are forwarded sanitized', () => {
    const r = run(['scan', 'src/styles.css'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_STDERR: 'impeccable detect: could not read linked stylesheet x.css' } });
    expect(r.err).toContain('ENGINE_STDERR: impeccable detect: could not read linked stylesheet x.css');
  });

  test.skipIf(!POSIX)('--changed <base> derives frontend targets from git (committed, staged, untracked), never backend files', () => {
    git(REPO, 'checkout', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(REPO, 'src', 'components', 'Card.tsx'), 'export const Card = () => <div />;\n');
    fs.writeFileSync(path.join(REPO, 'src', 'server.ts'), 'export const x = 2;\n');
    git(REPO, 'add', '-A');
    git(REPO, 'commit', '-q', '-m', 'change');
    fs.mkdirSync(path.join(REPO, 'styles'), { recursive: true });
    fs.writeFileSync(path.join(REPO, 'styles', 'new.css'), 'body { color: red }\n'); // untracked frontend
    fs.writeFileSync(path.join(REPO, 'notes.md'), 'x\n'); // untracked non-frontend
    const log = path.join(SANDBOX, 'argv4.log');
    fs.rmSync(log, { force: true });
    try {
      const r = run(['scan', '--changed', 'main', '--format', 'gstack'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_LOG: log } });
      expect(r.code).toBe(2);
      const argv = JSON.parse(fs.readFileSync(log, 'utf-8').trim().split('\n')[0]).argv as string[];
      const rel = argv.slice(2).map(a => path.relative(fs.realpathSync(REPO), a)).sort();
      expect(rel).toEqual(['src/components/Card.tsx', 'styles/new.css']);
    } finally {
      fs.rmSync(path.join(REPO, 'styles'), { recursive: true, force: true });
      fs.rmSync(path.join(REPO, 'notes.md'), { force: true });
      git(REPO, 'checkout', '-q', 'main');
      git(REPO, 'branch', '-q', '-D', 'feature');
    }
  });

  test.skipIf(!POSIX)('--changed outside a git repository is refused', () => {
    const plain = path.join(SANDBOX, 'plain');
    fs.mkdirSync(plain, { recursive: true });
    const r = run(['scan', '--changed', 'main'], { env: { IMPECCABLE_BIN: FAKE, GIT_CEILING_DIRECTORIES: SANDBOX }, cwd: plain });
    expect(r.err).toContain(`${SENTINEL.DETECT_REFUSED}: main (not a repository)`);
    expect(r.code).toBe(0);
  });
});

describe('design-review REPORT_DIR agrees with the allow-list', () => {
  test.skipIf(!POSIX)('the template expression, evaluated with GSTACK_HOME set, lands under <gstack home>/projects/<slug>/designs/ and a dump there is scanned', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md.tmpl'), 'utf-8');
    const m = tmpl.match(/^REPORT_DIR="(.+)"$/m);
    expect(m).not.toBeNull();
    const expr = m![1];
    expect(expr.startsWith('${GSTACK_HOME:-$HOME/.gstack}/projects/$SLUG/designs/')).toBe(true);
    const r = spawnSync('bash', ['-c', `SLUG=my-repo; echo "${expr}"`], { encoding: 'utf-8', timeout: 30_000, env: { PATH: process.env.PATH!, HOME: path.join(SANDBOX, 'fake-home'), GSTACK_HOME } });
    const reportDir = r.stdout.trim();
    expect(reportDir.startsWith(path.join(GSTACK_HOME, 'projects', 'my-repo', 'designs', 'design-audit-'))).toBe(true);
    const dom = path.join(reportDir, 'dom', '120000-1');
    fs.mkdirSync(dom, { recursive: true });
    fs.writeFileSync(path.join(dom, 'home.dom.html'), '<html></html>');
    const log = path.join(SANDBOX, 'argv-report.log');
    fs.rmSync(log, { force: true });
    try {
      const s = run(['scan', '--format', 'gstack', dom + '/home.dom.html'], { env: { IMPECCABLE_BIN: FAKE, FAKE_IMPECCABLE_LOG: log } });
      expect(s.err).not.toContain(SENTINEL.DETECT_REFUSED);
      const argv = JSON.parse(fs.readFileSync(log, 'utf-8').trim().split('\n')[0]).argv as string[];
      expect(argv.slice(2)).toEqual([fs.realpathSync(path.join(dom, 'home.dom.html'))]);
    } finally {
      fs.rmSync(path.join(GSTACK_HOME, 'projects'), { recursive: true, force: true });
    }
  });
});

describe('rules', () => {
  test('prints every mapped id with kind/impact/tier/handoff and the tested engine versions', () => {
    const r = run(['rules']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('61 detector rules mapped');
    expect(r.out).toContain('tested engine versions: 0.1.3');
    expect(r.out).toMatch(/^side-tab\tslop\tmedium\task\tpolish\t/m);
    expect(r.out).toMatch(/^low-contrast\tquality\thigh\task\tcolorize\t/m);
  });

  test('unknown verb prints usage and exits 2', () => {
    const r = run(['bogus']);
    expect(r.code).toBe(2);
    expect(r.err).toContain('usage:');
  });
});
