import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.join(import.meta.dir, '..');

function writeExecutable(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function createFakeGstackRepo(parentDir: string): string {
  const repoDir = path.join(parentDir, 'gstack');
  fs.mkdirSync(repoDir, { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'setup'), path.join(repoDir, 'setup'));
  fs.chmodSync(path.join(repoDir, 'setup'), 0o755);

  fs.writeFileSync(path.join(repoDir, 'SKILL.md'), '# gstack\n', 'utf8');
  writeExecutable(path.join(repoDir, 'browse', 'dist', 'browse'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(repoDir, 'bin', 'gstack-config'), '#!/bin/sh\nexit 0\n');
  fs.writeFileSync(path.join(repoDir, 'package.json'), '{}\n', 'utf8');

  for (const skill of ['review', 'ship', 'qa']) {
    fs.mkdirSync(path.join(repoDir, skill), { recursive: true });
    fs.writeFileSync(path.join(repoDir, skill, 'SKILL.md'), `# ${skill}\n`, 'utf8');
  }
  for (const doc of ['checklist.md', 'design-checklist.md', 'greptile-triage.md', 'TODOS-format.md']) {
    fs.writeFileSync(path.join(repoDir, 'review', doc), `${doc}\n`, 'utf8');
  }
  fs.writeFileSync(path.join(repoDir, 'VERSION'), '0.0.0-test\n', 'utf8');

  for (const skill of ['gstack', 'gstack-review', 'gstack-ship']) {
    fs.mkdirSync(path.join(repoDir, '.agents', 'skills', skill), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.agents', 'skills', skill, 'SKILL.md'), `# ${skill}\n`, 'utf8');
  }

  return repoDir;
}

function createStubBin(parentDir: string, commands: string[]): string {
  const binDir = path.join(parentDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  for (const command of commands) {
    writeExecutable(path.join(binDir, command), '#!/bin/sh\nexit 0\n');
  }

  return binDir;
}

function runSetup(
  repoDir: string,
  homeDir: string,
  binDir: string,
  args: string[],
) {
  return spawnSync('bash', ['setup', ...args], {
    cwd: repoDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH || ''}`,
      GSTACK_SETUP_SKIP_BUILD: '1',
      GSTACK_SETUP_SKIP_BROWSER: '1',
    },
  });
}

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('setup scope support', () => {
  test('workspace scope installs Claude and Codex assets into a project root', () => {
    const tempRoot = tempDir('gstack-setup-workspace-');
    try {
      const homeDir = path.join(tempRoot, 'home');
      const projectRoot = path.join(tempRoot, 'project');
      fs.mkdirSync(homeDir, { recursive: true });
      fs.mkdirSync(projectRoot, { recursive: true });

      const repoDir = createFakeGstackRepo(tempRoot);
      const binDir = createStubBin(tempRoot, ['bun', 'claude', 'codex']);
      const result = runSetup(repoDir, homeDir, binDir, [
        '--host', 'auto',
        '--scope', 'workspace',
        '--project-root', projectRoot,
      ]);

      expect(result.status).toBe(0);

      const claudeRoot = path.join(projectRoot, '.claude', 'skills', 'gstack');
      const claudeSkill = path.join(projectRoot, '.claude', 'skills', 'review');
      const codexRoot = path.join(projectRoot, '.agents', 'skills', 'gstack');
      const codexSkill = path.join(projectRoot, '.agents', 'skills', 'gstack-review');
      const realRepoDir = fs.realpathSync(repoDir);

      expect(fs.realpathSync(claudeRoot)).toBe(realRepoDir);
      expect(fs.readlinkSync(claudeSkill)).toBe('gstack/review');
      expect(fs.statSync(codexRoot).isDirectory()).toBe(true);
      expect(fs.realpathSync(path.join(codexRoot, 'SKILL.md'))).toBe(fs.realpathSync(path.join(repoDir, '.agents', 'skills', 'gstack', 'SKILL.md')));
      expect(fs.realpathSync(codexSkill)).toBe(fs.realpathSync(path.join(repoDir, '.agents', 'skills', 'gstack-review')));
      expect(fs.realpathSync(path.join(projectRoot, '.agents', 'skills', 'gstack', 'bin'))).toBe(fs.realpathSync(path.join(repoDir, 'bin')));
      expect(fs.realpathSync(path.join(codexRoot, 'VERSION'))).toBe(fs.realpathSync(path.join(repoDir, 'VERSION')));
      expect(fs.realpathSync(path.join(codexRoot, 'review', 'checklist.md'))).toBe(fs.realpathSync(path.join(repoDir, 'review', 'checklist.md')));
      expect(fs.existsSync(path.join(codexRoot, 'review', 'SKILL.md'))).toBe(false);

      expect(fs.existsSync(path.join(homeDir, '.claude', 'skills'))).toBe(false);
      expect(fs.existsSync(path.join(homeDir, '.codex', 'skills'))).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('user scope installs from an arbitrary checkout into home skill dirs', () => {
    const tempRoot = tempDir('gstack-setup-user-');
    try {
      const homeDir = path.join(tempRoot, 'home');
      fs.mkdirSync(homeDir, { recursive: true });

      const repoDir = createFakeGstackRepo(tempRoot);
      const binDir = createStubBin(tempRoot, ['bun']);
      const result = runSetup(repoDir, homeDir, binDir, [
        '--host', 'auto',
        '--scope', 'user',
      ]);

      expect(result.status).toBe(0);

      const claudeRoot = path.join(homeDir, '.claude', 'skills', 'gstack');
      const claudeSkill = path.join(homeDir, '.claude', 'skills', 'ship');
      const codexRoot = path.join(homeDir, '.codex', 'skills', 'gstack');
      const codexSkill = path.join(homeDir, '.codex', 'skills', 'gstack-ship');
      const realRepoDir = fs.realpathSync(repoDir);

      expect(fs.realpathSync(claudeRoot)).toBe(realRepoDir);
      expect(fs.readlinkSync(claudeSkill)).toBe('gstack/ship');
      expect(fs.realpathSync(codexRoot)).toBe(realRepoDir);
      expect(fs.realpathSync(path.join(codexRoot, 'SKILL.md'))).toBe(fs.realpathSync(path.join(repoDir, 'SKILL.md')));
      expect(fs.realpathSync(codexSkill)).toBe(fs.realpathSync(path.join(repoDir, '.agents', 'skills', 'gstack-ship')));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
