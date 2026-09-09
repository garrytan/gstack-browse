import { describe, expect, test } from 'bun:test';
import { readWorkflowExcerpt } from './helpers/workflow-excerpt';
import { LLM_JUDGE_TOUCHFILES, selectTests } from './helpers/touchfiles';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

describe('workflow judge excerpts', () => {
  test('helper changes select all dependent workflow judges', () => {
    const selected = selectTests(['test/helpers/workflow-excerpt.ts'], LLM_JUDGE_TOUCHFILES, []).selected;
    expect(selected).toHaveLength(14);
    expect(selected).toContain('ship/SKILL.md workflow');
    expect(selected).toContain('plan-design-review/SKILL.md passes');
  });

  test('expands ship sections in execution order, not alphabetical order', () => {
    const text = readWorkflowExcerpt('ship/SKILL.md', '# Ship:', '## Important Rules');
    const headings = ['## Step 3:', '## Step 4:', '## Step 7:', '## Step 8:', '## Step 9:', '## Step 10:', '## Step 11:', '## Step 12:', '## Step 13:', '## Step 14:'];
    const indices = headings.map(heading => text.indexOf(heading));
    expect(indices.every(index => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  test('ship uses project-native commands and never jumps over mandatory gates', () => {
    const text = readWorkflowExcerpt('ship/SKILL.md', '# Ship:', '## Important Rules');
    expect(text).toContain("Use the project's test commands discovered in Step 4");
    expect(text).toContain("Use the project's documented eval selection");
    expect(text).not.toMatch(/skipping evals[^\n]*Step 9/);
    const reviewAndTriage = text.slice(text.indexOf('## Step 9:'), text.indexOf('## Step 11:'));
    expect(reviewAndTriage.match(/continue to Step 12/i)).toBeNull();
    expect(text).not.toContain('Steps 4-6:');
    expect(text).toContain('During pre-flight, read the existing review log');
    expect(text).toContain('Save the JSON `baseVersion` as `BASE_VERSION`');
    expect(text).toContain("GIT_SEQUENCE_EDITOR='cp");
    expect(text).not.toContain("--exec 'true'");
    expect(text).not.toContain('-X ours');
    expect(text).toContain('````text\nYou are running a ship-workflow');
  });

  test('a sliced section is not appended again with its generated header', () => {
    const text = readWorkflowExcerpt('plan-design-review/SKILL.md', '## Review Sections', '## CRITICAL RULE');
    expect(text.match(/## Review Sections/g)).toHaveLength(1);
    expect(text).not.toContain('## CRITICAL RULE');
    expect(text).not.toContain('AUTO-GENERATED');
  });

  test('ship approval gates stay outside the subagent prompts', () => {
    const text = readWorkflowExcerpt('ship/SKILL.md', '# Ship:', '## Important Rules');
    for (const [step, next, gate] of [[7, 8, '**7. Coverage gate:**'], [8, 9, '### Gate Logic']] as const) {
      const section = text.slice(text.indexOf(`## Step ${step}:`), text.indexOf(`## Step ${next}:`));
      const prompt = section.match(/````text\n([\s\S]*?)\n````/)![1];
      expect(prompt).not.toContain(gate);
      expect(prompt).not.toContain('Use AskUserQuestion:');
      expect(prompt).not.toContain('commit as');
      expect(section.indexOf(gate)).toBeGreaterThan(section.indexOf('\n````\n'));
    }
    expect(text).toContain('"partial":N,"not_done":N');
    expect(text).toContain('each Y response\'s evidence and each D response\'s dropped item');
  });

  test('expands a body before the end marker in the skeleton', () => {
    const text = readWorkflowExcerpt('document-release/SKILL.md', '# Document Release:', '## Important Rules');
    expect(text).toContain('## Step 2:');
    expect(text).toContain('## Step 9:');
  });

  test('plan review evidence and design approval rules precede their use', () => {
    const eng = readWorkflowExcerpt('plan-eng-review/SKILL.md', '## Review Sections', '## CRITICAL RULE');
    expect(eng.indexOf('## Confidence Calibration')).toBeLessThan(eng.indexOf('### 1. Architecture review'));
    expect(eng).toContain('quote the motivating plan requirement');
    expect(eng).toContain('including all Claude fallback modes');
    expect(eng).toContain('no in-host substitute is defined here');
    const design = readWorkflowExcerpt('plan-design-review/SKILL.md', '## Review Sections', '## CRITICAL RULE');
    expect(design).toContain('wait for approval, then edit the plan and re-rate');
    const pass4 = design.slice(design.indexOf('### Pass 4:'), design.indexOf('### Pass 5:'));
    expect(pass4.indexOf('### Design Hard Rules')).toBeLessThan(pass4.indexOf('FIX TO 10:'));
    expect(pass4).toContain('caps this pass below 8');
  });

  test('fails closed for missing excerpt markers', () => {
    expect(() => readWorkflowExcerpt('ship/SKILL.md', '# missing', null)).toThrow('Start marker not found');
    expect(() => readWorkflowExcerpt('ship/SKILL.md', '# Ship:', '# missing')).toThrow('End marker not found');
  });

  test('deploy gates and navigation timing formulas are executable as documented', () => {
    const land = readFileSync(join(import.meta.dir, '../land-and-deploy/SKILL.md.tmpl'), 'utf8');
    expect(land).not.toContain('Skip Step 3, go to Step 4');
    expect(land).toContain('continue to Step 3.4, then Step 3.5 before merging');
    const benchmark = readFileSync(join(import.meta.dir, '../benchmark/SKILL.md.tmpl'), 'utf8');
    const timings = { startTime: 0, domInteractive: 600, domComplete: 1200, loadEventEnd: 1400 };
    for (const [label, expected] of [['DOM Interactive', 600], ['DOM Complete', 1200], ['Full Load', 1400]] as const) {
      const formula = benchmark.match(new RegExp(`\\*\\*${label}\\*\\*: \x60([^\x60]+)\x60`))![1];
      const actual = new Function(...Object.keys(timings), `return ${formula}`)(...Object.values(timings));
      expect(actual).toBe(expected);
    }
  });

  test('WIP squash example consumes the prepared todo and preserves file contents', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ship-wip-example-'));
    const env = {
      ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd, env, encoding: 'utf8', timeout: 10_000 });
      if (result.status !== 0) throw new Error(result.stderr || String(result.error));
      return result.stdout.trim();
    };
    try {
      git('init', '-b', 'main');
      writeFileSync(join(cwd, 'file'), 'base\n');
      git('add', 'file');
      git('commit', '-m', 'base');
      git('switch', '-c', 'feature');
      for (const message of ['logical change', 'WIP: finish change', 'other logical change']) {
        writeFileSync(join(cwd, 'file'), message + '\n');
        git('commit', '-am', message);
      }
      const commits = git('rev-list', '--reverse', 'main..HEAD').split('\n');
      const todo = join(cwd, '.git', 'prepared-todo');
      writeFileSync(todo, commits.map((sha, i) => `${i === 1 ? 'fixup' : 'pick'} ${sha}`).join('\n') + '\n');
      const source = readFileSync(join(import.meta.dir, '../ship/SKILL.md.tmpl'), 'utf8');
      const snippet = source.match(/```bash\n(export WIP_TODO=[\s\S]*?)\n```/)![1]
        .replace('<absolute path to prepared todo>', todo).replaceAll('origin/<base>', 'main');
      const originalTree = git('rev-parse', 'HEAD^{tree}');
      const result = spawnSync('bash', ['-c', snippet], { cwd, env, encoding: 'utf8', timeout: 10_000 });
      expect(result.status, result.stderr).toBe(0);
      expect(git('rev-list', '--count', 'main..HEAD')).toBe('2');
      expect(git('rev-parse', 'HEAD^{tree}')).toBe(originalTree);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
