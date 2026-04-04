import { describe, it, expect } from 'bun:test';
import { validateOutputPath } from '../src/meta-commands';
import { validateReadPath } from '../src/read-commands';
import { TEMP_DIR } from '../src/platform';
import * as path from 'path';

describe('validateOutputPath', () => {
  it('allows paths within temp dir', () => {
    expect(() => validateOutputPath(path.join(TEMP_DIR, 'screenshot.png'))).not.toThrow();
  });

  it('allows paths in subdirectories of temp dir', () => {
    expect(() => validateOutputPath(path.join(TEMP_DIR, 'browse', 'output.png'))).not.toThrow();
  });

  it('allows paths within cwd', () => {
    expect(() => validateOutputPath(`${process.cwd()}/output.png`)).not.toThrow();
  });

  it('blocks paths outside safe directories', () => {
    expect(() => validateOutputPath('/etc/cron.d/backdoor.png')).toThrow(/Path must be within/);
  });

  it('blocks /tmpevil prefix collision', () => {
    expect(() => validateOutputPath(path.join(`${TEMP_DIR}-evil`, 'file.png'))).toThrow(/Path must be within/);
  });

  it('blocks home directory paths', () => {
    expect(() => validateOutputPath('/Users/someone/file.png')).toThrow(/Path must be within/);
  });

  it('blocks path traversal via ..', () => {
    expect(() => validateOutputPath(path.join(TEMP_DIR, '..', 'etc', 'passwd'))).toThrow(/Path must be within/);
  });
});

describe('validateReadPath', () => {
  it('allows absolute paths within temp dir', () => {
    expect(() => validateReadPath(path.join(TEMP_DIR, 'script.js'))).not.toThrow();
  });

  it('allows absolute paths within cwd', () => {
    expect(() => validateReadPath(`${process.cwd()}/test.js`)).not.toThrow();
  });

  it('allows relative paths without traversal', () => {
    expect(() => validateReadPath('src/index.js')).not.toThrow();
  });

  it('blocks absolute paths outside safe directories', () => {
    expect(() => validateReadPath('/etc/passwd')).toThrow(/Absolute path must be within/);
  });

  it('blocks /tmpevil prefix collision', () => {
    expect(() => validateReadPath(path.join(`${TEMP_DIR}-evil`, 'file.js'))).toThrow(/Absolute path must be within/);
  });

  it('blocks path traversal sequences', () => {
    expect(() => validateReadPath('../../../etc/passwd')).toThrow(/Path traversal/);
  });

  it('blocks nested path traversal', () => {
    expect(() => validateReadPath('src/../../etc/passwd')).toThrow(/Path traversal/);
  });
});
