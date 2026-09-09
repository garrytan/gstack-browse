import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const MARKER = 'These are non-negotiable. They shape every response in this mode.';

function renderHost(host: 'codex' | 'factory'): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `gstack-${host}-sections-`));
  const result = spawnSync('bun', ['run', 'scripts/gen-skill-docs.ts', '--host', host, '--out-dir', outDir], {
    cwd: ROOT, encoding: 'utf-8', timeout: 120_000,
  });
  if (result.status !== 0) throw new Error(`${host} generation failed:\n${result.stderr || result.stdout}`);
  return outDir;
}

describe('Codex progressive section loading', () => {
  test('Codex defers Office Hours payload to a generated section', () => {
    const outDir = renderHost('codex');
    try {
      const base = path.join(outDir, '.agents', 'skills', 'gstack-office-hours');
      const skill = fs.readFileSync(path.join(base, 'SKILL.md'), 'utf-8');
      const section = fs.readFileSync(path.join(base, 'sections', 'phase-2a-startup-diagnostic.md'), 'utf-8');
      expect(skill).toContain('cat "$HOME/.codex/skills/gstack-office-hours/sections/phase-2a-startup-diagnostic.md"');
      expect(skill).toContain('cat ".agents/skills/gstack-office-hours/sections/phase-2a-startup-diagnostic.md"');
      expect(skill).not.toContain(MARKER);
      expect(section).toContain(MARKER);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  test('Factory preserves current inline behavior', () => {
    const outDir = renderHost('factory');
    try {
      const base = path.join(outDir, '.factory', 'skills', 'gstack-office-hours');
      expect(fs.readFileSync(path.join(base, 'SKILL.md'), 'utf-8')).toContain(MARKER);
      expect(fs.existsSync(path.join(base, 'sections', 'phase-2a-startup-diagnostic.md'))).toBe(false);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
