import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-pair-agent-icm-'));
  const result = spawnSync('bun', ['run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', outDir], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  if (result.status !== 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(result.stderr || result.stdout);
  }
  return outDir;
}

describe('pair-agent Codex progressive context', () => {
  test('keeps local routing and destructive consent hot while deferring remote-only detail', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-pair-agent');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const remote = fs.readFileSync(path.join(root, 'sections', 'remote-pairing.md'), 'utf-8');
      const reference = fs.readFileSync(path.join(root, 'sections', 'remote-reference.md'), 'utf-8');

      expect(skill).toContain('## Step 3: Local or remote?');
      expect(skill).toContain('Live-daemon consent (one-way door)');
      expect(skill).toContain('### If same machine (option A):');
      expect(skill).toContain('## Step 5: Verify connection');
      expect(skill).toContain('sections/remote-pairing.md');
      expect(skill).not.toContain('Consent gate (once per machine)');
      expect(skill).not.toContain('## Troubleshooting');
      expect(skill).not.toContain('## Revoking access');

      expect(remote).toContain('Consent gate (once per machine)');
      expect(remote).toContain('NGROK_INSTALLED');
      expect(remote).toContain('CRITICAL: You MUST output the full instruction block');
      expect(reference).toContain('## What the remote agent can do');
      expect(reference).toContain('## Troubleshooting');
      expect(reference).toContain('## Revoking access');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
