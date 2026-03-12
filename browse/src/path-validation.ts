/**
 * Path validation utilities to prevent path traversal attacks.
 *
 * Output paths (screenshot, pdf, responsive) are restricted to /tmp or
 * the current working directory tree.
 *
 * Input paths (eval) are restricted to the current working directory tree.
 */

import * as path from 'path';

const ALLOWED_OUTPUT_ROOTS = ['/tmp'];

function resolveAndCheck(filePath: string, allowedRoots: string[]): string {
  const resolved = path.resolve(filePath);
  for (const root of allowedRoots) {
    if (resolved.startsWith(root + '/') || resolved === root) {
      return resolved;
    }
  }
  const allowed = allowedRoots.map(r => `"${r}"`).join(', ');
  throw new Error(
    `Path "${filePath}" resolves outside allowed directories (${allowed}). ` +
    `Use a path under one of these directories.`
  );
}

/**
 * Validate an output file path (screenshot, pdf, responsive).
 * Allowed: /tmp/*, cwd/*
 */
export function validateOutputPath(filePath: string): string {
  const cwd = process.cwd();
  return resolveAndCheck(filePath, [...ALLOWED_OUTPUT_ROOTS, cwd]);
}

/**
 * Validate an input file path (eval).
 * Allowed: cwd/* only — prevents reading arbitrary files like /etc/passwd.
 */
export function validateInputPath(filePath: string): string {
  const cwd = process.cwd();
  return resolveAndCheck(filePath, [cwd]);
}
