/**
 * find-browse — locate the gstack browse binary.
 *
 * Compiled to browse/dist/find-browse (standalone binary, no bun runtime needed).
 * Outputs the absolute path to the browse binary on stdout, or exits 1 if not found.
 */

import { existsSync } from 'fs';
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

function resolveBinary(basePath: string): string | null {
  const candidates = [basePath, `${basePath}.exe`];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function locateBinary(): string | null {
  const root = getGitRoot();
  const home = homedir();
  const markers = ['.codex', '.agents', '.claude'];

  // Workspace-local takes priority (for development)
  if (root) {
    for (const m of markers) {
      const local = join(root, m, 'skills', 'gstack', 'browse', 'dist', 'browse');
      const localBinary = resolveBinary(local);
      if (localBinary) return localBinary;
    }
  }

  // Global fallback
  for (const m of markers) {
    const global = join(home, m, 'skills', 'gstack', 'browse', 'dist', 'browse');
    const globalBinary = resolveBinary(global);
    if (globalBinary) return globalBinary;
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
