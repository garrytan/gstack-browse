/**
 * find-browse — locate the gstack browse binary.
 *
 * Compiled to browse/dist/find-browse (standalone binary, no bun runtime needed).
 * Outputs the absolute path to the browse binary on stdout, or exits 1 if not found.
 */

import { accessSync, constants } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Binary Discovery ───────────────────────────────────────────

function getGitRoot(): string | null {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) return null;
    return proc.stdout.toString().trim();
  } catch {
    return null;
  }
}

const SKILL_ROOT_MARKERS = [
  ['.codex', 'skills', 'gstack'],
  ['.claude', 'skills', 'gstack'],
] as const;

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function locateBinary(options: { root?: string | null; home?: string } = {}): string | null {
  const root = options.root ?? getGitRoot();
  const home = options.home ?? homedir();

  if (root) {
    for (const marker of SKILL_ROOT_MARKERS) {
      const local = join(root, ...marker, 'browse', 'dist', 'browse');
      if (isExecutable(local)) return local;
    }
  }

  for (const marker of SKILL_ROOT_MARKERS) {
    const global = join(home, ...marker, 'browse', 'dist', 'browse');
    if (isExecutable(global)) return global;
  }

  return null;
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  const bin = locateBinary();
  if (!bin) {
    process.stderr.write('ERROR: browse binary not found. Run: cd <skill-dir> && ./setup\n');
    process.exit(1);
  }

  console.log(bin);
}

main();
