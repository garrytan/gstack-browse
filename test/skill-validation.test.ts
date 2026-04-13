import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

describe('Research skill validation', () => {
  const skills = ['SKILL.md', 'hypothesis/SKILL.md', 'run-experiment/SKILL.md', 'report/SKILL.md', 'discuss/SKILL.md', 'peer-review/SKILL.md'];

  for (const skill of skills) {
    const skillPath = path.join(ROOT, skill);

    test(`${skill} exists`, () => {
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    test(`${skill} has no unresolved placeholders`, () => {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const placeholders = content.match(/\{\{[A-Z_]+\}\}/g);
      expect(placeholders).toBeNull();
    });

    test(`${skill} has valid frontmatter`, () => {
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('\n---\n');
      expect(content).toMatch(/^name:\s+\S+/m);
      expect(content).toMatch(/^description:\s/m);
    });

    test(`${skill} has AUTO-GENERATED header`, () => {
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(content).toContain('AUTO-GENERATED from');
    });
  }

  test('hypothesis/SKILL.md contains key workflow steps', () => {
    const content = fs.readFileSync(path.join(ROOT, 'hypothesis', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Step 1: Capture the idea');
    expect(content).toContain('spec.yaml');
    expect(content).toContain('AskUserQuestion');
    expect(content).toContain('learnings');
  });

  test('run-experiment/SKILL.md has approval gate', () => {
    const content = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    expect(content).toContain('APPROVAL GATE');
    expect(content).toContain('Phase A');
    expect(content).toContain('Phase B');
    expect(content).toContain('provenance');
  });

  test('report/SKILL.md references baselines and plots', () => {
    const content = fs.readFileSync(path.join(ROOT, 'report', 'SKILL.md'), 'utf-8');
    expect(content).toContain('baseline');
    expect(content).toContain('matplotlib');
    expect(content).toContain('metrics.json');
    expect(content).toContain('provenance.json');
  });

  test('root SKILL.md has routing rules for all 5 skills', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('/hypothesis');
    expect(content).toContain('/run-experiment');
    expect(content).toContain('/report');
    expect(content).toContain('/discuss');
    expect(content).toContain('/peer-review');
  });

  test('all skills reference provenance spec', () => {
    const runExp = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    expect(runExp).toContain('git_sha');
    expect(runExp).toContain('wall_clock_seconds');
    expect(runExp).toContain('random_seeds');
  });

  test('research conventions resolver outputs convention reading instructions', () => {
    const root = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(root).toContain('Research conventions');
    expect(root).toContain('CLAUDE.md');
  });

  test('experiment structure resolver outputs directory layout', () => {
    const root = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(root).toContain('research/');
    expect(root).toContain('hypotheses/');
    expect(root).toContain('experiments/');
    expect(root).toContain('results/');
    expect(root).toContain('baselines/');
    expect(root).toContain('reports/');
    expect(root).toContain('discussions/');
    expect(root).toContain('reviews/');
  });

  test('discuss/SKILL.md contains discussion workflow', () => {
    const content = fs.readFileSync(path.join(ROOT, 'discuss', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Discussion loop');
    expect(content).toContain('AskUserQuestion');
    expect(content).toContain('research/discussions/');
    expect(content).toContain('Data ref');
    expect(content).toContain('annotation');
    expect(content).toContain('/hypothesis');
  });

  test('peer-review/SKILL.md contains review checklist', () => {
    const content = fs.readFileSync(path.join(ROOT, 'peer-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Methodology');
    expect(content).toContain('Statistics');
    expect(content).toContain('Code quality');
    expect(content).toContain('Reproducibility');
    expect(content).toContain('Conclusions');
    expect(content).toContain('critical');
    expect(content).toContain('major');
    expect(content).toContain('minor');
    expect(content).toContain('ACCEPT');
    expect(content).toContain('REVISE');
    expect(content).toContain('REJECT');
    expect(content).toContain('AskUserQuestion');
    expect(content).toContain('research/reviews/');
  });
});

describe('Cross-skill data chain', () => {
  const skillDirs = ['hypothesis', 'run-experiment', 'report', 'discuss', 'peer-review'];

  test('all 5 skills use AskUserQuestion (human-in-the-loop)', () => {
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
      expect(content).toContain('AskUserQuestion');
    }
  });

  test('all 5 skills include learnings-log for knowledge capture', () => {
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
      expect(content).toContain('learnings-log');
    }
  });

  test('run-experiment has mandatory approval gate before execution', () => {
    const content = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    expect(content).toContain('APPROVAL GATE');
    expect(content).toContain('AskUserQuestion');
    // Approval must appear before Phase B (execution)
    const approvalIdx = content.indexOf('APPROVAL GATE');
    const phaseBIdx = content.indexOf('Phase B');
    expect(approvalIdx).toBeLessThan(phaseBIdx);
  });

  test('provenance fields in run-experiment match report references', () => {
    const runExp = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    const report = fs.readFileSync(path.join(ROOT, 'report', 'SKILL.md'), 'utf-8');
    // Both skills reference the same artifact files
    for (const artifact of ['metrics.json', 'provenance.json']) {
      expect(runExp).toContain(artifact);
      expect(report).toContain(artifact);
    }
  });

  test('hypothesis output connects to run-experiment input (spec.yaml)', () => {
    const hypothesis = fs.readFileSync(path.join(ROOT, 'hypothesis', 'SKILL.md'), 'utf-8');
    const runExp = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    expect(hypothesis).toContain('spec.yaml');
    expect(runExp).toContain('spec.yaml');
  });

  test('discuss references experiment data for grounded analysis', () => {
    const discuss = fs.readFileSync(path.join(ROOT, 'discuss', 'SKILL.md'), 'utf-8');
    expect(discuss).toContain('Data ref');
    expect(discuss).toContain('metrics');
  });

  test('peer-review checks reproducibility via provenance', () => {
    const review = fs.readFileSync(path.join(ROOT, 'peer-review', 'SKILL.md'), 'utf-8');
    expect(review).toContain('Reproducibility');
    expect(review).toContain('provenance');
  });

  test('run-experiment creates latest symlink for reliable handoff', () => {
    const content = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    expect(content).toContain('ln -sfn');
    expect(content).toContain('latest');
  });

  test('report uses latest symlink with ls -t fallback', () => {
    const content = fs.readFileSync(path.join(ROOT, 'report', 'SKILL.md'), 'utf-8');
    expect(content).toContain('latest');
    expect(content).toContain('ls -t');
  });

  test('all skills guide to the next workflow step', () => {
    const hypothesis = fs.readFileSync(path.join(ROOT, 'hypothesis', 'SKILL.md'), 'utf-8');
    const runExp = fs.readFileSync(path.join(ROOT, 'run-experiment', 'SKILL.md'), 'utf-8');
    const report = fs.readFileSync(path.join(ROOT, 'report', 'SKILL.md'), 'utf-8');
    const discuss = fs.readFileSync(path.join(ROOT, 'discuss', 'SKILL.md'), 'utf-8');
    const review = fs.readFileSync(path.join(ROOT, 'peer-review', 'SKILL.md'), 'utf-8');

    expect(hypothesis).toContain('/run-experiment');
    expect(runExp).toContain('/report');
    expect(report).toContain('/discuss');
    expect(discuss).toContain('/peer-review');
    expect(review).toContain('/hypothesis');
  });

  test('discuss includes learnings search for context', () => {
    const content = fs.readFileSync(path.join(ROOT, 'discuss', 'SKILL.md'), 'utf-8');
    expect(content).toContain('gstack-learnings-search');
  });

  test('hypothesis has interactive dead-end detection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'hypothesis', 'SKILL.md'), 'utf-8');
    expect(content).toContain('dead-end');
    expect(content).toContain('AskUserQuestion');
    expect(content).toContain('Skip this hypothesis');
  });

  test('root SKILL.md has skill decision tree', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('Which Skill Do I Need?');
    expect(content).toContain('Starting fresh');
    expect(content).toContain('Starting a new cycle');
  });
});

describe('Template freshness', () => {
  const templates = [
    'SKILL.md.tmpl',
    'hypothesis/SKILL.md.tmpl',
    'run-experiment/SKILL.md.tmpl',
    'report/SKILL.md.tmpl',
    'discuss/SKILL.md.tmpl',
    'peer-review/SKILL.md.tmpl',
  ];

  for (const tmpl of templates) {
    test(`${tmpl} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, tmpl))).toBe(true);
    });
  }
});
