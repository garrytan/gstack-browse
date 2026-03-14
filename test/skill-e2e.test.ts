import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { runSkillTest } from './helpers/session-runner';
import { startTestServer } from '../browse/test/test-server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Skip if SKILL_E2E not set, or if running inside a Claude Code / Agent SDK session
// (nested Agent SDK sessions hang because the parent intercepts child claude subprocesses)
const isInsideAgentSDK = !!process.env.CLAUDECODE || !!process.env.CLAUDE_CODE_ENTRYPOINT;
const describeE2E = (process.env.SKILL_E2E && !isInsideAgentSDK) ? describe : describe.skip;

let testServer: ReturnType<typeof startTestServer>;
let tmpDir: string;

describeE2E('Skill E2E tests', () => {
  beforeAll(() => {
    testServer = startTestServer();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-e2e-'));

    // Symlink browse binary into tmpdir for the skill to find
    const browseBin = path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse');
    const binDir = path.join(tmpDir, 'browse', 'dist');
    fs.mkdirSync(binDir, { recursive: true });
    if (fs.existsSync(browseBin)) {
      fs.symlinkSync(browseBin, path.join(binDir, 'browse'));
    }

    // Also create browse/bin/find-browse so the SKILL.md setup works
    const findBrowseDir = path.join(tmpDir, 'browse', 'bin');
    fs.mkdirSync(findBrowseDir, { recursive: true });
    fs.writeFileSync(path.join(findBrowseDir, 'find-browse'), `#!/bin/bash\necho "${browseBin}"\n`, { mode: 0o755 });
  });

  afterAll(() => {
    testServer?.server?.stop();
    // Clean up tmpdir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('browse basic commands work without errors', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse')}. Assign it to B variable and run these commands in sequence:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B text
4. $B screenshot /tmp/skill-e2e-test.png
Report the results of each command.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
    });

    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test('browse snapshot flags all work', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse')}. Assign it to B variable and run:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B snapshot -c
4. $B snapshot -D
5. $B snapshot -i -a -o /tmp/skill-e2e-annotated.png
Report what each command returned.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
    });

    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test('agent discovers browse binary via SKILL.md setup block', async () => {
    const ROOT = path.resolve(import.meta.dir, '..');
    const skillMd = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const setupStart = skillMd.indexOf('## SETUP');
    const setupEnd = skillMd.indexOf('## IMPORTANT');
    const setupBlock = skillMd.slice(setupStart, setupEnd);

    // Guard: verify we extracted a valid setup block
    expect(setupBlock).toContain('browse/dist/browse');

    const result = await runSkillTest({
      prompt: `Follow these instructions to find the browse binary and run a basic command.

${setupBlock}

After finding the binary, run: $B goto ${testServer.url}
Then run: $B text
Report whether it worked.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
    });

    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test('SKILL.md setup block shows NEEDS_SETUP when binary missing', async () => {
    // Create a tmpdir with no browse binary
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-e2e-empty-'));

    const ROOT = path.resolve(import.meta.dir, '..');
    const skillMd = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const setupStart = skillMd.indexOf('## SETUP');
    const setupEnd = skillMd.indexOf('## IMPORTANT');
    const setupBlock = skillMd.slice(setupStart, setupEnd);

    const result = await runSkillTest({
      prompt: `Follow these instructions exactly. Run the bash code block below and report what it outputs.

${setupBlock}

Report the exact output. Do NOT try to fix or install anything — just report what you see.`,
      workingDirectory: emptyDir,
      maxTurns: 5,
      timeout: 30_000,
    });

    // Agent should see NEEDS_SETUP (not crash or guess wrong paths)
    const allText = result.messages
      .map((m: any) => JSON.stringify(m))
      .join('\n');
    expect(allText).toContain('NEEDS_SETUP');

    // Clean up
    try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch {}
  }, 60_000);

  test('SKILL.md setup block works outside git repo', async () => {
    // Create a tmpdir outside any git repo
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-e2e-nogit-'));

    const ROOT = path.resolve(import.meta.dir, '..');
    const skillMd = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    const setupStart = skillMd.indexOf('## SETUP');
    const setupEnd = skillMd.indexOf('## IMPORTANT');
    const setupBlock = skillMd.slice(setupStart, setupEnd);

    const result = await runSkillTest({
      prompt: `Follow these instructions exactly. Run the bash code block below and report what it outputs.

${setupBlock}

Report the exact output — either "READY: <path>" or "NEEDS_SETUP".`,
      workingDirectory: nonGitDir,
      maxTurns: 5,
      timeout: 30_000,
    });

    // Should either find global binary (READY) or show NEEDS_SETUP — not crash
    const allText = result.messages
      .map((m: any) => JSON.stringify(m))
      .join('\n');
    expect(allText).toMatch(/READY|NEEDS_SETUP/);

    // Clean up
    try { fs.rmSync(nonGitDir, { recursive: true, force: true }); } catch {}
  }, 60_000);

  test.todo('/qa quick completes without browse errors');
  test.todo('/ship completes without browse errors');
  test.todo('/review completes without browse errors');
});
