import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

let tmpDir: string;
let slugDir: string;

function runLog(input: string, opts: { expectFail?: boolean } = {}): { stdout: string; exitCode: number } {
  const execOpts: ExecSyncOptionsWithStringEncoding = {
    cwd: ROOT,
    env: { ...process.env, RSTACK_HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 15000,
  };
  try {
    const stdout = execSync(`${BIN}/rstack-timeline-log '${input.replace(/'/g, "'\\''")}'`, execOpts).trim();
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    if (opts.expectFail) {
      return { stdout: e.stderr?.toString() || '', exitCode: e.status || 1 };
    }
    throw e;
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rstack-timeline-'));
  slugDir = path.join(tmpDir, 'projects');
  fs.mkdirSync(slugDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function findTimelineFile(): string | null {
  const projectDirs = fs.readdirSync(slugDir);
  if (projectDirs.length === 0) return null;
  const f = path.join(slugDir, projectDirs[0], 'timeline.jsonl');
  return fs.existsSync(f) ? f : null;
}

describe('rstack-timeline-log', () => {
  test('accepts valid JSON and appends to timeline.jsonl', () => {
    const input = '{"skill":"review","event":"started","branch":"main"}';
    const result = runLog(input);
    expect(result.exitCode).toBe(0);

    const f = findTimelineFile();
    expect(f).not.toBeNull();
    const content = fs.readFileSync(f!, 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.skill).toBe('review');
    expect(parsed.event).toBe('started');
    expect(parsed.branch).toBe('main');
  });

  test('rejects invalid JSON with exit 0 (non-blocking)', () => {
    const result = runLog('not json at all');
    expect(result.exitCode).toBe(0);

    // No file should be created
    const f = findTimelineFile();
    expect(f).toBeNull();
  });

  test('injects timestamp when ts field is missing', () => {
    const input = '{"skill":"review","event":"started","branch":"main"}';
    runLog(input);

    const f = findTimelineFile();
    expect(f).not.toBeNull();
    const parsed = JSON.parse(fs.readFileSync(f!, 'utf-8').trim());
    expect(parsed.ts).toBeDefined();
    expect(new Date(parsed.ts).getTime()).toBeGreaterThan(0);
  });

  test('preserves timestamp when ts field is present', () => {
    const input = '{"skill":"review","event":"completed","branch":"main","ts":"2025-06-15T10:00:00Z"}';
    runLog(input);

    const f = findTimelineFile();
    expect(f).not.toBeNull();
    const parsed = JSON.parse(fs.readFileSync(f!, 'utf-8').trim());
    expect(parsed.ts).toBe('2025-06-15T10:00:00Z');
  });

  test('validates required fields (skill, event) - exits 0 if missing skill', () => {
    const result = runLog('{"event":"started","branch":"main"}');
    expect(result.exitCode).toBe(0);

    const f = findTimelineFile();
    expect(f).toBeNull();
  });

  test('validates required fields (skill, event) - exits 0 if missing event', () => {
    const result = runLog('{"skill":"review","branch":"main"}');
    expect(result.exitCode).toBe(0);

    const f = findTimelineFile();
    expect(f).toBeNull();
  });
});
