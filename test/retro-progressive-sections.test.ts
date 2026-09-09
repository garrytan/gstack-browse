import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function renderCodex(): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-retro-codex-'));
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

describe('retro Codex progressive context', () => {
  test('keeps mode routing hot and defers repo/global/compare workflows', () => {
    const outDir = renderCodex();
    try {
      const dir = path.join(outDir, '.agents', 'skills', 'gstack-retro');
      const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf-8');
      const repo = fs.readFileSync(path.join(dir, 'sections', 'repo-retro.md'), 'utf-8');
      const global = fs.readFileSync(path.join(dir, 'sections', 'global-retro.md'), 'utf-8');
      const compare = fs.readFileSync(path.join(dir, 'sections', 'compare-retro.md'), 'utf-8');
      const report = fs.readFileSync(path.join(dir, 'sections', 'report-format.md'), 'utf-8');

      expect(skill).toContain('## Mode dispatch');
      expect(skill).toContain('Midnight-aligned windows');
      expect(skill).toContain('Argument validation');
      expect(skill).toContain('$HOME/.codex/skills/gstack-retro/sections/repo-retro.md');
      expect(skill).toContain('$HOME/.codex/skills/gstack-retro/sections/global-retro.md');
      expect(skill).toContain('$HOME/.codex/skills/gstack-retro/sections/compare-retro.md');

      expect(skill).not.toContain('### Step 0.5: Freshness pre-flight (fetch)');
      expect(skill).not.toContain('### Global Step 7: Aggregate and generate narrative');
      expect(skill).not.toContain('Run `gstack-retro-metrics` a second time');
      expect(skill).not.toContain('## Engineering Retro: [date range]');

      expect(repo).toContain('### Step 0.5: Freshness pre-flight (fetch)');
      expect(repo).toContain('### Step 13: Save Retro History');
      expect(global).toContain('## Global Retrospective Mode');
      expect(global).toContain('### Global Step 7: Aggregate and generate narrative');
      expect(compare).toContain('## Compare Mode');
      expect(compare).toContain('gstack-retro-metrics` a second time');
      expect(report).toContain('## Engineering Retro: [date range]');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
