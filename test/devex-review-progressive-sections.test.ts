import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const PLAYBOOK_MARKER = '## Step 1: Getting Started Audit';
const DOCTRINE_MARKER = '## DX First Principles';

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-devex-review-icm-'));
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

describe('devex-review Codex progressive context', () => {
  test('keeps target discovery hot and defers the live audit playbook', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-devex-review');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const sectionPath = path.join(root, 'sections', 'audit-playbook.md');
      expect(fs.existsSync(sectionPath)).toBe(true);
      const section = fs.readFileSync(sectionPath, 'utf-8');

      expect(skill).toContain('sections/audit-playbook.md');
      expect(skill).not.toContain(PLAYBOOK_MARKER);
      expect(skill).not.toContain(DOCTRINE_MARKER);
      expect(section).toContain(PLAYBOOK_MARKER);
      expect(section).toContain(DOCTRINE_MARKER);
      expect(skill).toContain('## Step 0: Target Discovery');
      expect(skill).toContain('### Boomerang Baseline');
      expect(skill).toContain('## Review Log');
      expect(skill).toContain('Rate every dimension with evidence source.');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
