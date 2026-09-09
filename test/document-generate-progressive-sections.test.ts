import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-document-generate-icm-'));
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

describe('document-generate Codex progressive context', () => {
  test('keeps shared workflow hot and defers quadrant-specific writing playbooks', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-document-generate');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const reference = fs.readFileSync(path.join(root, 'sections', 'reference-docs.md'), 'utf-8');
      const explanation = fs.readFileSync(path.join(root, 'sections', 'explanation-docs.md'), 'utf-8');
      const howto = fs.readFileSync(path.join(root, 'sections', 'how-to-docs.md'), 'utf-8');
      const tutorial = fs.readFileSync(path.join(root, 'sections', 'tutorial-docs.md'), 'utf-8');

      expect(skill).toContain('## Step 1: Codebase Archaeology (Research Phase)');
      expect(skill).toContain('## Step 2: Diataxis Partitioning');
      expect(skill).toContain('## Step 8: Quality Self-Review');
      expect(skill).toContain('Redaction scan before commit');
      expect(skill).toContain('sections/reference-docs.md');
      expect(skill).not.toContain('## Step 3: Write Reference Documentation First\n');
      expect(skill).not.toContain('## Step 4: Write Explanation Documentation\n');
      expect(skill).not.toContain('## Step 5: Write How-To Guides\n');
      expect(skill).not.toContain('## Step 6: Write Tutorials\n');

      expect(reference).toContain('## Step 3: Write Reference Documentation First');
      expect(reference).toContain('Reference doc template:');
      expect(explanation).toContain('## Step 4: Write Explanation Documentation');
      expect(howto).toContain('## Step 5: Write How-To Guides');
      expect(tutorial).toContain('## Step 6: Write Tutorials');
      expect(tutorial).toContain('Time to first result < 3 steps');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
