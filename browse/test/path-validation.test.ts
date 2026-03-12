import { describe, it, expect } from 'bun:test';
import { validateOutputPath, validateInputPath } from '../src/path-validation';

describe('validateOutputPath', () => {
  it('allows /tmp paths', () => {
    expect(validateOutputPath('/tmp/screenshot.png')).toBe('/tmp/screenshot.png');
    expect(validateOutputPath('/tmp/nested/dir/file.pdf')).toBe('/tmp/nested/dir/file.pdf');
  });

  it('allows cwd paths', () => {
    const cwd = process.cwd();
    expect(validateOutputPath('./output.png')).toBe(`${cwd}/output.png`);
  });

  it('rejects paths outside allowed directories', () => {
    expect(() => validateOutputPath('/etc/cron.d/backdoor.png')).toThrow('resolves outside allowed directories');
    expect(() => validateOutputPath('/var/log/evil.pdf')).toThrow('resolves outside allowed directories');
    expect(() => validateOutputPath('/home/user/.ssh/key')).toThrow('resolves outside allowed directories');
  });

  it('rejects path traversal via ..', () => {
    expect(() => validateOutputPath('/tmp/../../etc/passwd')).toThrow('resolves outside allowed directories');
  });
});

describe('validateInputPath', () => {
  it('allows cwd paths', () => {
    const cwd = process.cwd();
    expect(validateInputPath('./test.js')).toBe(`${cwd}/test.js`);
  });

  it('rejects /tmp paths', () => {
    expect(() => validateInputPath('/tmp/evil.js')).toThrow('resolves outside allowed directories');
  });

  it('rejects absolute paths outside cwd', () => {
    expect(() => validateInputPath('/etc/passwd')).toThrow('resolves outside allowed directories');
    expect(() => validateInputPath('/home/user/.ssh/id_rsa')).toThrow('resolves outside allowed directories');
  });

  it('rejects path traversal via ..', () => {
    expect(() => validateInputPath('../../../etc/passwd')).toThrow('resolves outside allowed directories');
  });
});
