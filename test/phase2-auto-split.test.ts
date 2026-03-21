import { describe, test, expect } from 'bun:test';
import { autoSplit, validateSize } from '../scripts/gen-skill-docs';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── autoSplit tests ────────────────────────────────────────

describe('autoSplit', () => {
  test('no-op when content has no ref markers', () => {
    const input = '# Hello\n\nSome content\n\n## Section\n\nMore content';
    const result = autoSplit(input, 'test.tmpl');
    expect(result.content).toBe(input);
    expect(result.references).toHaveLength(0);
  });

  test('extracts single ref block', () => {
    const input = [
      '# Main',
      'Intro text',
      '<!-- ref:details.md -->',
      '## Details',
      'Detail content line 1',
      'Detail content line 2',
      '<!-- /ref -->',
      'After text',
    ].join('\n');

    const result = autoSplit(input, 'test.tmpl');

    expect(result.references).toHaveLength(1);
    expect(result.references[0].filename).toBe('details.md');
    expect(result.references[0].content).toBe('## Details\nDetail content line 1\nDetail content line 2');

    expect(result.content).toContain('# Main');
    expect(result.content).toContain('Intro text');
    expect(result.content).toContain('references/details.md');
    expect(result.content).toContain('After text');
    expect(result.content).not.toContain('Detail content line 1');
  });

  test('extracts multiple ref blocks', () => {
    const input = [
      '# Main',
      '<!-- ref:a.md -->',
      'Content A',
      '<!-- /ref -->',
      'Middle',
      '<!-- ref:b.md -->',
      'Content B',
      '<!-- /ref -->',
      'End',
    ].join('\n');

    const result = autoSplit(input, 'test.tmpl');

    expect(result.references).toHaveLength(2);
    expect(result.references[0].filename).toBe('a.md');
    expect(result.references[0].content).toBe('Content A');
    expect(result.references[1].filename).toBe('b.md');
    expect(result.references[1].content).toBe('Content B');

    expect(result.content).toContain('references/a.md');
    expect(result.content).toContain('references/b.md');
    expect(result.content).toContain('Middle');
    expect(result.content).toContain('End');
  });

  test('throws on missing closing tag', () => {
    const input = [
      '# Main',
      '<!-- ref:orphan.md -->',
      'Content without closing',
    ].join('\n');

    expect(() => autoSplit(input, 'test.tmpl')).toThrow('Missing <!-- /ref -->');
  });

  test('throws on orphan closing tag', () => {
    const input = [
      '# Main',
      '<!-- /ref -->',
    ].join('\n');

    expect(() => autoSplit(input, 'test.tmpl')).toThrow('Orphan <!-- /ref -->');
  });

  test('throws on nested ref markers', () => {
    const input = [
      '<!-- ref:outer.md -->',
      'Outer content',
      '<!-- ref:inner.md -->',
      'Inner content',
      '<!-- /ref -->',
      '<!-- /ref -->',
    ].join('\n');

    expect(() => autoSplit(input, 'test.tmpl')).toThrow('Nested ref marker');
  });

  test('ignores ref markers inside fenced code blocks', () => {
    const input = [
      '# Main',
      '```',
      '<!-- ref:fake.md -->',
      'This is code, not a marker',
      '<!-- /ref -->',
      '```',
      'After code block',
    ].join('\n');

    const result = autoSplit(input, 'test.tmpl');

    expect(result.references).toHaveLength(0);
    expect(result.content).toContain('<!-- ref:fake.md -->');
    expect(result.content).toContain('This is code, not a marker');
  });

  test('handles ref marker after code block correctly', () => {
    const input = [
      '```',
      'code',
      '```',
      '<!-- ref:real.md -->',
      'Real content',
      '<!-- /ref -->',
    ].join('\n');

    const result = autoSplit(input, 'test.tmpl');

    expect(result.references).toHaveLength(1);
    expect(result.references[0].filename).toBe('real.md');
    expect(result.references[0].content).toBe('Real content');
  });

  test('replaces extracted block with markdown link', () => {
    const input = [
      'Before',
      '<!-- ref:toolkit.md -->',
      '## Toolkit',
      '<!-- /ref -->',
      'After',
    ].join('\n');

    const result = autoSplit(input, 'test.tmpl');
    const lines = result.content.split('\n');
    const linkLine = lines.find(l => l.includes('references/toolkit.md'));
    expect(linkLine).toBeDefined();
    expect(linkLine).toContain('[references/toolkit.md]');
  });
});

// ─── validateSize tests ─────────────────────────────────────

describe('validateSize', () => {
  test('returns ok for content under 500 lines', () => {
    const content = Array(200).fill('line').join('\n');
    const result = validateSize(content, 'test.md');
    expect(result.level).toBe('ok');
    expect(result.lineCount).toBe(200);
  });

  test('returns warn for content at 500+ lines', () => {
    const content = Array(550).fill('line').join('\n');
    const result = validateSize(content, 'test.md');
    expect(result.level).toBe('warn');
    expect(result.lineCount).toBe(550);
  });

  test('returns error for content at 800+ lines', () => {
    const content = Array(850).fill('line').join('\n');
    const result = validateSize(content, 'test.md');
    expect(result.level).toBe('error');
    expect(result.lineCount).toBe(850);
  });

  test('boundary: 499 lines is ok', () => {
    const content = Array(499).fill('line').join('\n');
    expect(validateSize(content, 'test.md').level).toBe('ok');
  });

  test('boundary: 500 lines is warn', () => {
    const content = Array(500).fill('line').join('\n');
    expect(validateSize(content, 'test.md').level).toBe('warn');
  });

  test('boundary: 799 lines is warn', () => {
    const content = Array(799).fill('line').join('\n');
    expect(validateSize(content, 'test.md').level).toBe('warn');
  });

  test('boundary: 800 lines is error', () => {
    const content = Array(800).fill('line').join('\n');
    expect(validateSize(content, 'test.md').level).toBe('error');
  });
});

// ─── Skeleton generator tests ───────────────────────────────

describe('gstack-init-skill', () => {
  const INIT_SCRIPT = path.join(ROOT, 'bin', 'gstack-init-skill');

  test('creates skill directory with correct structure', () => {
    const name = `test-init-${Date.now()}`;
    const result = Bun.spawnSync([INIT_SCRIPT, name, '--description', 'Test description'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    try {
      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(ROOT, name, 'SKILL.md.tmpl'))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, name, 'references'))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, name, 'scripts'))).toBe(true);

      const tmpl = fs.readFileSync(path.join(ROOT, name, 'SKILL.md.tmpl'), 'utf-8');
      expect(tmpl).toContain(`name: ${name}`);
      expect(tmpl).toContain('Test description');
      expect(tmpl).toContain('{{PREAMBLE}}');
    } finally {
      fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
    }
  });

  test('rejects non-kebab-case names', () => {
    const result = Bun.spawnSync([INIT_SCRIPT, 'BadName'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('kebab-case');
  });

  test('rejects existing directory', () => {
    // 'ship' already exists
    const result = Bun.spawnSync([INIT_SCRIPT, 'ship'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('already exists');
  });

  test('requires a name argument', () => {
    const result = Bun.spawnSync([INIT_SCRIPT], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).not.toBe(0);
  });
});

// ─── Integration: size reporting in dry-run ─────────────────

describe('gen-skill-docs size reporting', () => {
  test('dry-run output includes line counts', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Should include line counts in parentheses
    expect(output).toMatch(/\(\d+ lines\)/);
  });

  test('dry-run reports size warnings to stderr', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stderr = result.stderr.toString();
    // We know qa/SKILL.md is >800 lines, should produce ERROR
    expect(stderr).toContain('ERROR');
    // We know several skills are 500-800 lines, should produce WARN
    expect(stderr).toContain('WARN');
  });
});
