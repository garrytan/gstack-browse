import { describe, test, expect } from 'bun:test';
import { execSync } from 'child_process';
import * as path from 'path';
import { discoverTemplates, discoverSkillFiles } from '../scripts/discover-skills';

const ROOT = path.resolve(import.meta.dir, '..');

const EXPECTED_SKILLS = [
  'SKILL.md.tmpl',
  'hypothesis/SKILL.md.tmpl',
  'run-experiment/SKILL.md.tmpl',
  'report/SKILL.md.tmpl',
  'discuss/SKILL.md.tmpl',
  'peer-review/SKILL.md.tmpl',
];

describe('Template discovery', () => {
  const templates = discoverTemplates(ROOT);

  test('discovers all 6 templates', () => {
    expect(templates.length).toBe(6);
  });

  test('finds each expected template', () => {
    const tmplPaths = templates.map(t => t.tmpl);
    for (const expected of EXPECTED_SKILLS) {
      expect(tmplPaths).toContain(expected);
    }
  });

  test('each template maps to SKILL.md output', () => {
    for (const t of templates) {
      expect(t.output).toBe(t.tmpl.replace(/\.tmpl$/, ''));
    }
  });
});

describe('Skill file discovery', () => {
  const skillFiles = discoverSkillFiles(ROOT);

  test('discovers same count as templates', () => {
    const templates = discoverTemplates(ROOT);
    expect(skillFiles.length).toBe(templates.length);
  });

  test('every template has a corresponding SKILL.md', () => {
    const templates = discoverTemplates(ROOT);
    for (const t of templates) {
      expect(skillFiles).toContain(t.output);
    }
  });
});

describe('gen-skill-docs --dry-run', () => {
  test('all generated files are fresh', () => {
    const output = execSync('bun run gen:skill-docs -- --dry-run', {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    expect(output).not.toContain('STALE:');
    const freshCount = (output.match(/FRESH:/g) || []).length;
    expect(freshCount).toBe(6);
  });
});
