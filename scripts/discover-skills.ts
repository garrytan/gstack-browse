// Shared discovery for SKILL.md and .tmpl files.
// Template discovery scans root + one level of subdirs.
// SKILL.md discovery walks nested directories so maintenance checks also cover
// host-specific trees such as openclaw/skills/*/SKILL.md.

import * as fs from 'fs';
import * as path from 'path';

const SKIP = new Set(['node_modules', '.git', 'dist']);

function subdirs(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !SKIP.has(d.name))
    .map(d => d.name);
}

export function discoverTemplates(root: string): Array<{ tmpl: string; output: string }> {
  const dirs = ['', ...subdirs(root)];
  const results: Array<{ tmpl: string; output: string }> = [];
  for (const dir of dirs) {
    const rel = dir ? `${dir}/SKILL.md.tmpl` : 'SKILL.md.tmpl';
    if (fs.existsSync(path.join(root, rel))) {
      results.push({ tmpl: rel, output: rel.replace(/\.tmpl$/, '') });
    }
  }
  return results;
}

export function discoverSkillFiles(root: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string, relativeDir = ''): void {
    const skillRel = relativeDir ? `${relativeDir}/SKILL.md` : 'SKILL.md';
    if (fs.existsSync(path.join(currentDir, 'SKILL.md'))) {
      results.push(skillRel);
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (SKIP.has(entry.name)) continue;

      const nextDir = path.join(currentDir, entry.name);
      const nextRel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      walk(nextDir, nextRel);
    }
  }

  walk(root);
  return results.sort();
}
