import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const DOCTRINE_MARKER = "Don't make me think";

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-review-icm-'));
  const result = spawnSync(
    'bun',
    ['run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', outDir],
    { cwd: ROOT, encoding: 'utf-8', timeout: 120_000 },
  );
  if (result.status !== 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(result.stderr || result.stdout);
  }
  return outDir;
}

describe('design-review Codex progressive context', () => {
  test('keeps baseline doctrine out of eager SKILL.md and generates it as a section', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-design-review');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const sectionPath = path.join(root, 'sections', 'baseline-methodology.md');
      expect(fs.existsSync(sectionPath)).toBe(true);
      const section = fs.readFileSync(sectionPath, 'utf-8');

      expect(skill).toContain('sections/baseline-methodology.md');
      expect(skill).not.toContain(DOCTRINE_MARKER);
      expect(section).toContain(DOCTRINE_MARKER);
      expect(skill).toContain('Check for clean working tree');
      expect(skill).toContain('## Phase 8: Fix Loop');
      expect(skill).toContain('One commit per fix');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
