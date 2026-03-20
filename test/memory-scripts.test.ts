import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const INIT_SCRIPT = path.join(ROOT, 'scripts', 'init-memory.sh');
const STATUS_SCRIPT = path.join(ROOT, 'scripts', 'gstack-status.sh');
const RESET_SCRIPT = path.join(ROOT, 'scripts', 'gstack-reset.sh');

function runScript(scriptPath: string, cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('bash', [scriptPath], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    timeout: 5000,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-memory-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// init-memory.sh tests
// ============================================================
describe('init-memory.sh', () => {

  test('creates .gstack directory structure from scratch', () => {
    const { exitCode, stdout } = runScript(INIT_SCRIPT, tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('gstack memory initialized');

    expect(fs.existsSync(path.join(tmpDir, '.gstack'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gstack', 'checkpoints'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gstack', 'session.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gstack', 'findings.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gstack', 'decisions.log'))).toBe(true);
  });

  test('session.json contains valid JSON with expected schema', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.gstack', 'session.json'), 'utf-8');
    const session = JSON.parse(content);
    expect(session.skill).toBeNull();
    expect(session.phase).toBe('idle');
    expect(session.turn_count).toBe(0);
    expect(session.critical_findings).toEqual([]);
    expect(session.decisions).toEqual([]);
    expect(session.completed_checks).toEqual([]);
    expect(session.pending_checks).toEqual([]);
    expect(session.context_warnings).toEqual([]);
  });

  test('findings.md contains expected header', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.gstack', 'findings.md'), 'utf-8');
    expect(content).toContain('# Findings Registry');
    expect(content).toContain('source of truth');
  });

  test('decisions.log is created empty', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.gstack', 'decisions.log'), 'utf-8');
    expect(content).toBe('');
  });

  test('idempotent: running twice does not overwrite existing files', () => {
    runScript(INIT_SCRIPT, tmpDir);

    // Modify session.json
    const sessionPath = path.join(tmpDir, '.gstack', 'session.json');
    const modified = JSON.stringify({ skill: 'review', phase: 'testing', turn_count: 5 });
    fs.writeFileSync(sessionPath, modified);

    // Run again
    runScript(INIT_SCRIPT, tmpDir);

    // Should NOT be overwritten
    const content = fs.readFileSync(sessionPath, 'utf-8');
    expect(content).toBe(modified);
  });
});

// ============================================================
// gstack-status.sh tests
// ============================================================
describe('gstack-status.sh', () => {

  test('no .gstack directory: prints "No active session" and exits 0', () => {
    const { exitCode, stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No .gstack directory found');
  });

  test('empty session shows defaults', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const { exitCode, stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Phase: idle');
    expect(stdout).toContain('Turns: 0');
  });

  test('populated session shows correct skill/phase/turns', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const session = {
      skill: 'review',
      started_at: '2026-03-20T14:30:00Z',
      phase: 'security_scan',
      turn_count: 12,
      critical_findings: [],
      decisions: [],
      completed_checks: [],
      pending_checks: [],
      context_warnings: [],
    };
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'session.json'), JSON.stringify(session, null, 2));
    const { stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(stdout).toContain('/review');
    expect(stdout).toContain('security_scan');
    expect(stdout).toContain('12');
  });

  test('correctly distinguishes UNRESOLVED vs RESOLVED findings', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const findings = `# Findings Registry

---

### F001 — [P0] SQL injection
- **Status:** UNRESOLVED
- **File:** auth.py:42

### F002 — [P1] Missing null check
- **Status:** RESOLVED
- **File:** user.py:23

### F003 — [P1] Race condition
- **Status:** UNRESOLVED
- **File:** payment.py:187
`;
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'findings.md'), findings);
    const { stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(stdout).toContain('2 unresolved');
    expect(stdout).toContain('1 resolved');
  });

  test('counts decisions correctly', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const decisions = `[2026-03-20T14:35:00Z] DECISION: Skip CSS linting
CONTEXT: User confirmed backend-only review
SKILL: /review

[2026-03-20T14:40:00Z] DECISION: Auth module in scope
CONTEXT: User confirmed
SKILL: /review
`;
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'decisions.log'), decisions);
    const { stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(stdout).toContain('2 logged');
  });

  test('detects handoff presence', () => {
    runScript(INIT_SCRIPT, tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'handoff.md'), '# Handoff');
    const { stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(stdout).toContain('Handoff: present');
  });

  test('detects handoff absence', () => {
    runScript(INIT_SCRIPT, tmpDir);
    const { stdout } = runScript(STATUS_SCRIPT, tmpDir);
    expect(stdout).toContain('Handoff: none');
  });
});

// ============================================================
// gstack-reset.sh tests
// ============================================================
describe('gstack-reset.sh', () => {

  test('no .gstack directory: prints "Nothing to reset" and exits 0', () => {
    const { exitCode, stdout } = runScript(RESET_SCRIPT, tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Nothing to reset');
  });

  test('archives all files before deleting', () => {
    runScript(INIT_SCRIPT, tmpDir);

    // Populate with data
    const sessionData = JSON.stringify({ skill: 'review', phase: 'done', turn_count: 10 });
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'session.json'), sessionData);
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'findings.md'), '# Test findings');
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'decisions.log'), 'DECISION: test');
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'handoff.md'), '# Handoff');

    // Reset
    const { exitCode, stdout } = runScript(RESET_SCRIPT, tmpDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Archived current state');
    expect(stdout).toContain('Memory reset complete');

    // Check archive exists
    const checkpointsDir = path.join(tmpDir, '.gstack', 'checkpoints');
    const archives = fs.readdirSync(checkpointsDir).filter(f => f.startsWith('archive-'));
    expect(archives.length).toBe(1);

    // Check archive contains the files
    const archiveDir = path.join(checkpointsDir, archives[0]);
    expect(fs.existsSync(path.join(archiveDir, 'session.json'))).toBe(true);
    expect(fs.existsSync(path.join(archiveDir, 'findings.md'))).toBe(true);
    expect(fs.existsSync(path.join(archiveDir, 'decisions.log'))).toBe(true);
    expect(fs.existsSync(path.join(archiveDir, 'handoff.md'))).toBe(true);

    // Check archived content matches original
    const archivedSession = fs.readFileSync(path.join(archiveDir, 'session.json'), 'utf-8');
    expect(archivedSession).toBe(sessionData);
  });

  test('re-initializes after reset', () => {
    runScript(INIT_SCRIPT, tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.gstack', 'session.json'), '{"skill":"review"}');

    runScript(RESET_SCRIPT, tmpDir);

    // session.json should be fresh (re-initialized)
    const content = fs.readFileSync(path.join(tmpDir, '.gstack', 'session.json'), 'utf-8');
    const session = JSON.parse(content);
    expect(session.skill).toBeNull();
    expect(session.phase).toBe('idle');
  });
});
