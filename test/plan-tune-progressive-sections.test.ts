import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-plan-tune-icm-'));
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

describe('plan-tune Codex progressive context', () => {
  test('keeps intent routing hot and defers mutually exclusive flows', () => {
    const outDir = renderCodex();
    try {
      const root = path.join(outDir, '.agents', 'skills', 'gstack-plan-tune');
      const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf-8');
      const onboarding = fs.readFileSync(path.join(root, 'sections', 'onboarding.md'), 'utf-8');
      const profile = fs.readFileSync(path.join(root, 'sections', 'profile-preferences.md'), 'utf-8');
      const analytics = fs.readFileSync(path.join(root, 'sections', 'analytics.md'), 'utf-8');
      const dream = fs.readFileSync(path.join(root, 'sections', 'dream-cycle.md'), 'utf-8');

      expect(skill).toContain('## Step 0: Detect what the user wants');
      expect(skill).toContain('Consent gate');
      expect(skill).toContain('One-way doors override never-ask');
      expect(skill).toContain('sections/profile-preferences.md');
      expect(skill).not.toContain('\n## Consent + opt-in\n');
      expect(skill).not.toContain('\n## Inspect profile\n');
      expect(skill).not.toContain('\n## Stats\n');
      expect(skill).not.toContain('\n## Dream cycle review\n');

      expect(onboarding).toContain('## Consent + opt-in');
      expect(onboarding).toContain('## 5-Q setup');
      expect(profile).toContain('## Inspect profile');
      expect(profile).toContain('## Set a preference');
      expect(analytics).toContain('## Stats');
      expect(analytics).toContain('## Audit unmarked questions');
      expect(dream).toContain('## Dream cycle review');
      expect(dream).toContain('## Dream cycle distill');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
