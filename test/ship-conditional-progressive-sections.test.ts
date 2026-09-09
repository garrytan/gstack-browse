import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-ship-conditional-'));
  const result = spawnSync('bun', ['run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', outDir], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return outDir;
}

describe('ship Codex conditional progressive context', () => {
  test('keeps predicates hot and defers uncommon branch bodies', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-ship');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');

      expect(skill).toContain('## Step 2: Distribution Pipeline Check');
      expect(skill).toContain('### Step 15.0: WIP Commit Squash');
      expect(skill).toContain('Credential pre-push guard (#1946) — detect before the push');
      expect(skill).toContain('## Step 21: Plan-tune discoverability nudge');
      expect(skill).toContain('sections/distribution-pipeline.md');
      expect(skill).toContain('sections/wip-squash.md');
      expect(skill).toContain('sections/prepush-credential-setup.md');
      expect(skill).toContain('sections/plan-tune-nudge.md');

      expect(skill).not.toContain('This PR adds a new binary/tool but there\'s no CI/CD pipeline');
      expect(skill).not.toContain('Non-destructive squash strategy');
      expect(skill).not.toContain('gstack can install a per-repo git pre-push hook');
      expect(skill).not.toContain('gstack can learn from your AskUserQuestion answers');

      expect(fs.readFileSync(path.join(root, 'sections', 'distribution-pipeline.md'), 'utf-8')).toContain('This PR adds a new binary/tool');
      expect(fs.readFileSync(path.join(root, 'sections', 'wip-squash.md'), 'utf-8')).toContain('Non-destructive squash strategy');
      expect(fs.readFileSync(path.join(root, 'sections', 'prepush-credential-setup.md'), 'utf-8')).toContain('gstack can install a per-repo git pre-push hook');
      expect(fs.readFileSync(path.join(root, 'sections', 'plan-tune-nudge.md'), 'utf-8')).toContain('gstack can learn from your AskUserQuestion answers');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
