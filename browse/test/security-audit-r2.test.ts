/**
 * Security audit round-2 tests — static source checks + behavioral verification.
 *
 * These tests verify that security fixes are present at the source level and
 * behave correctly at runtime. Source-level checks guard against regressions
 * that could silently remove a fix without breaking compilation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Shared source reads (used across multiple test sections) ───────────────
const META_SRC = fs.readFileSync(path.join(import.meta.dir, '../src/meta-commands.ts'), 'utf-8');
const WRITE_SRC = fs.readFileSync(path.join(import.meta.dir, '../src/write-commands.ts'), 'utf-8');
const SERVER_SRC = fs.readFileSync(path.join(import.meta.dir, '../src/server.ts'), 'utf-8');
const AGENT_SRC = fs.readFileSync(path.join(import.meta.dir, '../src/sidebar-agent.ts'), 'utf-8');

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extract the source text between two string markers.
 */
function sliceBetween(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  if (start === -1) return '';
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return src.slice(start);
  return src.slice(start, end + endMarker.length);
}

/**
 * Extract a function body by name — finds `function name(` or `export function name(`
 * and returns the full balanced-brace block.
 */
function extractFunction(src: string, name: string): string {
  const pattern = new RegExp(`(?:export\\s+)?function\\s+${name}\\s*\\(`);
  const match = pattern.exec(src);
  if (!match) return '';
  let depth = 0;
  let inBody = false;
  const start = match.index;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { depth++; inBody = true; }
    else if (src[i] === '}') { depth--; }
    if (inBody && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

// ─── Task 1: Harden validateOutputPath to use realpathSync ──────────────────

describe('Task 1: validateOutputPath uses realpathSync', () => {
  describe('source-level checks', () => {
    it('meta-commands.ts validateOutputPath contains realpathSync', () => {
      const fn = extractFunction(META_SRC, 'validateOutputPath');
      expect(fn).toBeTruthy();
      expect(fn).toContain('realpathSync');
    });

    it('write-commands.ts validateOutputPath contains realpathSync', () => {
      const fn = extractFunction(WRITE_SRC, 'validateOutputPath');
      expect(fn).toBeTruthy();
      expect(fn).toContain('realpathSync');
    });

    it('meta-commands.ts SAFE_DIRECTORIES resolves with realpathSync', () => {
      const safeBlock = sliceBetween(META_SRC, 'const SAFE_DIRECTORIES', ';');
      expect(safeBlock).toContain('realpathSync');
    });

    it('write-commands.ts SAFE_DIRECTORIES resolves with realpathSync', () => {
      const safeBlock = sliceBetween(WRITE_SRC, 'const SAFE_DIRECTORIES', ';');
      expect(safeBlock).toContain('realpathSync');
    });
  });

  describe('behavioral checks', () => {
    let tmpDir: string;
    let symlinkPath: string;

    beforeAll(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-sec-test-'));
      symlinkPath = path.join(tmpDir, 'evil-link');
      try {
        fs.symlinkSync('/etc', symlinkPath);
      } catch {
        symlinkPath = '';
      }
    });

    afterAll(() => {
      try {
        if (symlinkPath) fs.unlinkSync(symlinkPath);
        fs.rmdirSync(tmpDir);
      } catch {
        // best-effort cleanup
      }
    });

    it('meta-commands validateOutputPath rejects path through /etc symlink', async () => {
      if (!symlinkPath) {
        console.warn('Skipping: symlink creation failed');
        return;
      }
      const mod = await import('../src/meta-commands.ts');
      const attackPath = path.join(symlinkPath, 'passwd');
      expect(() => mod.validateOutputPath(attackPath)).toThrow();
    });

    it('realpathSync on symlink-to-/etc resolves to /etc (out of safe dirs)', () => {
      if (!symlinkPath) {
        console.warn('Skipping: symlink creation failed');
        return;
      }
      const resolvedLink = fs.realpathSync(symlinkPath);
      expect(resolvedLink).toBe('/etc');
      const TEMP_DIR_VAL = process.platform === 'win32' ? os.tmpdir() : '/tmp';
      const safeDirs = [TEMP_DIR_VAL, process.cwd()].map(d => {
        try { return fs.realpathSync(d); } catch { return d; }
      });
      const passwdReal = path.join(resolvedLink, 'passwd');
      const isSafe = safeDirs.some(d => passwdReal === d || passwdReal.startsWith(d + path.sep));
      expect(isSafe).toBe(false);
    });

    it('meta-commands validateOutputPath accepts legitimate tmpdir paths', async () => {
      const mod = await import('../src/meta-commands.ts');
      const legitimatePath = path.join(os.tmpdir(), 'gstack-screenshot.png');
      expect(() => mod.validateOutputPath(legitimatePath)).not.toThrow();
    });

    it('meta-commands validateOutputPath accepts paths in cwd', async () => {
      const mod = await import('../src/meta-commands.ts');
      const cwdPath = path.join(process.cwd(), 'output.png');
      expect(() => mod.validateOutputPath(cwdPath)).not.toThrow();
    });

    it('meta-commands validateOutputPath rejects paths outside safe dirs', async () => {
      const mod = await import('../src/meta-commands.ts');
      expect(() => mod.validateOutputPath('/home/user/secret.png')).toThrow(/Path must be within/);
      expect(() => mod.validateOutputPath('/var/log/access.log')).toThrow(/Path must be within/);
    });
  });
});
