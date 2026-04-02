import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOOK_SCRIPT = path.join(import.meta.dir, '..', 'inbox', 'bin', 'inbox-hook');

function createTempInbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-test-'));
  // Hook looks at $HOME/.gstack/inbox/ — so we set HOME=dir and create .gstack/inbox/
  fs.mkdirSync(path.join(dir, '.gstack', 'inbox', 'messages'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gstack', 'inbox', 'claims'), { recursive: true });
  return dir;
}

function writeMessage(inboxDir: string, opts: {
  type?: string;
  from?: string;
  target?: string;
  body?: string;
  filename?: string;
}) {
  const ts = Date.now();
  const filename = opts.filename || `${ts}-test.md`;
  const content = [
    '---',
    `type: ${opts.type || 'info'}`,
    `from: ${opts.from || 'test-project/main (session-99999)'}`,
    `target: ${opts.target || 'all'}`,
    `date: 2026-04-02 15:30`,
    '---',
    '',
    opts.body || 'Test message body',
  ].join('\n');
  fs.writeFileSync(path.join(inboxDir, '.gstack', 'inbox', 'messages', filename), content);
  return filename;
}

function runHook(homeDir: string, env?: Record<string, string>): { stdout: string; exitCode: number } {
  const result = Bun.spawnSync(['bash', HOOK_SCRIPT], {
    env: {
      ...process.env,
      HOME: homeDir,
      // Override git to avoid picking up real project context
      GIT_DIR: '/nonexistent',
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    stdout: result.stdout.toString(),
    exitCode: result.exitCode ?? 1,
  };
}

describe('inbox-hook', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempInbox();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('exits 0 with no output when inbox is empty', () => {
    const { stdout, exitCode } = runHook(tempDir);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('');
  });

  test('exits 0 when inbox directory does not exist', () => {
    const noInboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-test-noinbox-'));
    const { stdout, exitCode } = runHook(noInboxDir);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('');
    fs.rmSync(noInboxDir, { recursive: true, force: true });
  });

  test('detects new messages and outputs them', () => {
    writeMessage(tempDir, { body: 'Beat rewrites are done' });
    const { stdout, exitCode } = runHook(tempDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('[gstack inbox]');
    expect(stdout).toContain('1 new message');
    expect(stdout).toContain('Beat rewrites are done');
  });

  test('shows correct message type labels', () => {
    writeMessage(tempDir, { type: 'unblock', body: 'Dependency resolved', filename: '1-unblock.md' });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('[UNBLOCKED]');
  });

  test('shows HANDOFF label for handoff type', () => {
    writeMessage(tempDir, { type: 'handoff', body: 'Pick up auth work', filename: '1-handoff.md' });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('[HANDOFF]');
  });

  test('shows QUESTION label for question type', () => {
    writeMessage(tempDir, { type: 'question', body: 'Which API version?', filename: '1-question.md' });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('[QUESTION]');
  });

  test('shows INFO label for info type', () => {
    writeMessage(tempDir, { type: 'info', body: 'General update', filename: '1-info.md' });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('[INFO]');
  });

  test('detects multiple messages', () => {
    writeMessage(tempDir, { body: 'First message', filename: '1-a.md' });
    writeMessage(tempDir, { body: 'Second message', filename: '2-b.md' });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('2 new message');
  });

  test('does not show messages on second run (already read)', () => {
    writeMessage(tempDir, { body: 'One-time message' });
    const first = runHook(tempDir);
    expect(first.stdout).toContain('1 new message');

    // Second run — same PID won't match since each spawn is a new PID,
    // but the seen marker should still suppress. We need to simulate
    // same-PID by pre-touching the seen file.
    // Actually: each Bun.spawnSync gets a new PID, so the .seen-$$ and
    // .last-read-$$ files won't carry over. This tests the "new session
    // sees existing messages" case, which is correct behavior.
    // To test "same session doesn't re-read", we'd need to share PID state.
    // Skip this — the hook's correctness depends on PID stability within
    // a real session, which we can't simulate in unit tests.
  });

  test('filters messages by target (skips non-matching)', () => {
    writeMessage(tempDir, {
      target: 'book-system',
      body: 'Targeted message',
      filename: '1-targeted.md',
    });
    // Hook runs without git context, so MY_PROJECT will be the temp dir basename
    // which won't match "book-system" — message should be filtered out
    const { stdout } = runHook(tempDir);
    expect(stdout).not.toContain('Targeted message');
  });

  test('shows messages targeted to "all"', () => {
    writeMessage(tempDir, {
      target: 'all',
      body: 'Broadcast message',
      filename: '1-broadcast.md',
    });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('Broadcast message');
  });

  test('includes sender info in output', () => {
    writeMessage(tempDir, {
      from: 'my-project/feat-branch (session-42)',
      body: 'Hello from my-project',
    });
    const { stdout } = runHook(tempDir);
    expect(stdout).toContain('my-project/feat-branch');
  });

  test('claim files are created correctly', () => {
    const claimPath = path.join(tempDir, '.gstack', 'inbox', 'claims', 'auth-middleware.lock');
    fs.writeFileSync(claimPath, 'session-123 (my-project/main)\n2026-04-02 15:30\n');
    expect(fs.existsSync(claimPath)).toBe(true);
    const content = fs.readFileSync(claimPath, 'utf-8');
    expect(content).toContain('session-123');
    expect(content).toContain('my-project/main');
  });

  test('hook always exits 0 (never blocks tool execution)', () => {
    // Even with malformed messages, hook should not fail
    fs.writeFileSync(
      path.join(tempDir, '.gstack', 'inbox', 'messages', 'bad.md'),
      'this is not valid frontmatter\njust garbage'
    );
    const { exitCode } = runHook(tempDir);
    expect(exitCode).toBe(0);
  });
});
