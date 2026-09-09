import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-plan-ceo-'));
  const result = spawnSync('bun', ['run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', outDir], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return outDir;
}

describe('plan-ceo-review Codex progressive context', () => {
  test('keeps scope choice hot and defers posture-specific analysis', () => {
    const outDir = renderCodex();
    try {
      const skillRoot = path.join(outDir, '.agents', 'skills', 'gstack-plan-ceo-review');
      const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf-8');

      expect(skill).toContain('### 0A. Premise Challenge');
      expect(skill).toContain('### 0F. Mode Selection');
      expect(skill).toContain('sections/hold-scope.md');
      expect(skill).toContain('sections/scope-expansion.md');
      expect(skill).not.toContain('### 0D-prelude. Expansion Framing');
      expect(skill).not.toContain('### 0D-POST. Persist CEO Plan');

      const hold = fs.readFileSync(path.join(skillRoot, 'sections', 'hold-scope.md'), 'utf-8');
      const expansion = fs.readFileSync(path.join(skillRoot, 'sections', 'scope-expansion.md'), 'utf-8');
      const selective = fs.readFileSync(path.join(skillRoot, 'sections', 'selective-expansion.md'), 'utf-8');
      const reduction = fs.readFileSync(path.join(skillRoot, 'sections', 'scope-reduction.md'), 'utf-8');

      expect(hold).toContain('**For HOLD SCOPE**');
      expect(hold).toContain('### 0E. Temporal Interrogation');
      expect(expansion).toContain('**For SCOPE EXPANSION**');
      expect(expansion).toContain('### 0D-POST. Persist CEO Plan');
      expect(selective).toContain('**For SELECTIVE EXPANSION**');
      expect(reduction).toContain('**For SCOPE REDUCTION**');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
