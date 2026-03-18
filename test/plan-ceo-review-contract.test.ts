import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function read(...parts: string[]) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf-8');
}

describe('plan-ceo-review write and handoff contract', () => {
  test('template and generated skill allow CEO plan persistence and markdown export', () => {
    const tmpl = read('plan-ceo-review', 'SKILL.md.tmpl');
    const generated = read('plan-ceo-review', 'SKILL.md');

    for (const content of [tmpl, generated]) {
      expect(content).toContain('  - Write');
      expect(content).toContain('~/.gstack/projects/$SLUG/ceo-plans');
      expect(content).toContain('If the user explicitly asks for a markdown copy in the project root or another path');
      expect(content).toContain('For HOLD SCOPE and SCOPE REDUCTION modes, if the user asks to save the review/plan');
    }
  });

  test('generated skill has an explicit graceful-exit and no-implementation contract', () => {
    const generated = read('plan-ceo-review', 'SKILL.md');

    expect(generated).toContain('Never invent slash commands, shell commands, or pseudo-commands to "exit plan mode."');
    expect(generated).toContain('If the user says to stop, exit, or gracefully interrupt planning, provide a concise handoff and then stop after that response.');
    expect(generated).toContain('If the user asks this skill to implement, do not write code.');
    expect(generated).toContain('Never silently drift from plan review into implementation.');
  });
});
