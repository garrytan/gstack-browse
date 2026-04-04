import { describe, test, expect } from 'bun:test';
import { TEMP_DIR, isPathWithin, IS_WINDOWS } from '../src/platform';
import * as path from 'path';

describe('platform constants', () => {
  test('TEMP_DIR is /tmp on non-Windows', () => {
    if (!IS_WINDOWS) {
      expect(TEMP_DIR).toBe('/tmp');
    }
  });

  test('IS_WINDOWS reflects process.platform', () => {
    expect(IS_WINDOWS).toBe(process.platform === 'win32');
  });
});

describe('isPathWithin', () => {
  test('path inside directory returns true', () => {
    expect(isPathWithin(path.join(TEMP_DIR, 'foo'), TEMP_DIR)).toBe(true);
  });

  test('path outside directory returns false', () => {
    const other = IS_WINDOWS ? path.join('C:\\', 'Windows', 'System32') : '/etc';
    expect(isPathWithin(path.join(other, 'foo'), TEMP_DIR)).toBe(false);
  });

  test('exact match returns true', () => {
    expect(isPathWithin(TEMP_DIR, TEMP_DIR)).toBe(true);
  });

  test('partial prefix does not match (path traversal)', () => {
    // /tmp-evil should NOT match /tmp
    expect(isPathWithin(`${TEMP_DIR}-evil${path.sep}foo`, TEMP_DIR)).toBe(false);
  });

  test('nested path returns true', () => {
    expect(isPathWithin(path.join(TEMP_DIR, 'a', 'b', 'c'), TEMP_DIR)).toBe(true);
  });
});
