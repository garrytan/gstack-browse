import { describe, test, expect } from 'bun:test';
import { IS_WINDOWS, IS_MACOS, TEMP_DIR, getSafeDirectories, isPathWithin } from '../src/platform';
import * as os from 'os';
import * as path from 'path';

describe('platform', () => {
  describe('constants', () => {
    test('IS_WINDOWS matches process.platform', () => {
      expect(IS_WINDOWS).toBe(process.platform === 'win32');
    });

    test('IS_MACOS matches process.platform', () => {
      expect(IS_MACOS).toBe(process.platform === 'darwin');
    });

    test('TEMP_DIR matches os.tmpdir()', () => {
      expect(TEMP_DIR).toBe(os.tmpdir());
    });
  });

  describe('getSafeDirectories', () => {
    test('includes temp dir', () => {
      const dirs = getSafeDirectories();
      expect(dirs).toContain(os.tmpdir());
    });

    test('includes cwd', () => {
      const dirs = getSafeDirectories();
      expect(dirs).toContain(process.cwd());
    });

    test('returns exactly 2 directories', () => {
      const dirs = getSafeDirectories();
      expect(dirs).toHaveLength(2);
    });
  });

  describe('isPathWithin', () => {
    // Use resolved paths so tests work on both Windows and Unix
    const tmpDir = os.tmpdir();

    test('returns true for exact match', () => {
      expect(isPathWithin(tmpDir, tmpDir)).toBe(true);
    });

    test('returns true for child path', () => {
      const child = path.join(tmpDir, 'subdir', 'file.txt');
      expect(isPathWithin(child, tmpDir)).toBe(true);
    });

    test('returns false for unrelated path', () => {
      const home = os.homedir();
      // Only test if tmpdir and homedir are actually different
      if (home !== tmpDir && !home.startsWith(tmpDir + path.sep)) {
        expect(isPathWithin(home, tmpDir)).toBe(false);
      }
    });

    test('returns false for prefix-but-not-child path', () => {
      expect(isPathWithin(tmpDir + '-evil', tmpDir)).toBe(false);
    });

    test('uses OS-appropriate separator', () => {
      const parent = path.resolve(tmpDir, 'test-parent');
      const child = parent + path.sep + 'subdir';
      expect(isPathWithin(child, parent)).toBe(true);
    });

    test('rejects partial directory name match', () => {
      const parent = path.resolve(tmpDir, 'user');
      const notChild = path.resolve(tmpDir, 'username');
      expect(isPathWithin(notChild, parent)).toBe(false);
    });
  });
});
