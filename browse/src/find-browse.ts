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

export function locateBinary(): string | null {
  const root = getGitRoot();
  const home = homedir();
  const codexHome = process.env.CODEX_HOME || join(home, '.codex');

  // Workspace-local takes priority (for development)
  if (root) {
    const localClaude = join(root, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');
    if (existsSync(localClaude)) return localClaude;
    if (existsSync(`${localClaude}.exe`)) return `${localClaude}.exe`;

    const localCodex = join(root, '.codex', 'skills', 'gstack', 'browse', 'dist', 'browse');
    if (existsSync(localCodex)) return localCodex;
    if (existsSync(`${localCodex}.exe`)) return `${localCodex}.exe`;
  }

  // Global fallback
  const globalClaude = join(home, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');
  if (existsSync(globalClaude)) return globalClaude;
  if (existsSync(`${globalClaude}.exe`)) return `${globalClaude}.exe`;

  const globalCodex = join(codexHome, 'skills', 'gstack', 'browse', 'dist', 'browse');
  if (existsSync(globalCodex)) return globalCodex;
  if (existsSync(`${globalCodex}.exe`)) return `${globalCodex}.exe`;

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
