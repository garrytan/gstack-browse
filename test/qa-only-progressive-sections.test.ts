import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-qa-only-icm-'));
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

describe('qa-only Codex progressive context', () => {
  test('keeps report-only safety hot and defers the full QA methodology', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-qa-only');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const sectionPath = path.join(root, 'sections', 'methodology.md');
      expect(fs.existsSync(sectionPath)).toBe(true);
      const section = fs.readFileSync(sectionPath, 'utf-8');

      expect(skill).toContain('## Setup');
      expect(skill).toContain('NEVER fix anything');
      expect(skill).toContain('## Output');
      expect(skill).toContain('sections/methodology.md');
      expect(skill).not.toContain('## Health Score Rubric');
      expect(section).toContain('## Health Score Rubric');
      expect(section).toContain('Diff-aware');
      expect(skill).toContain('Never fix bugs');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
