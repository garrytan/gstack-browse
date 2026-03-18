/**
 * Cross-platform helpers — shared by all modules that need OS-aware paths or checks.
 */

import * as os from 'os';
import * as path from 'path';

export const IS_WINDOWS = process.platform === 'win32';
export const IS_MACOS = process.platform === 'darwin';
export const TEMP_DIR = os.tmpdir();

/**
 * Directories where browse is allowed to write/read user-specified files.
 */
export function getSafeDirectories(): string[] {
  return [TEMP_DIR, process.cwd()];
}

/**
 * Check if `resolved` is equal to or inside `dir`, using OS-aware separators.
 */
export function isPathWithin(resolved: string, dir: string): boolean {
  return resolved === dir || resolved.startsWith(dir + path.sep);
}
