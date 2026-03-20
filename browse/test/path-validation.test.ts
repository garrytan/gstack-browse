import { describe, it, expect } from 'bun:test';
import { validateOutputPath } from '../src/meta-commands';
import { validateReadPath } from '../src/read-commands';

describe('validateOutputPath', () => {
  it('allows paths within /tmp', () => {
    expect(() => validateOutputPath('/tmp/screenshot.png')).not.toThrow();
  });

  it('allows paths in subdirectories of /tmp', () => {
    expect(() => validateOutputPath('/tmp/browse/output.png')).not.toThrow();
  });

  it('allows paths within cwd', () => {
    expect(() => validateOutputPath(`${process.cwd()}/output.png`)).not.toThrow();
  });

  it('blocks paths outside safe directories', () => {
    expect(() => validateOutputPath('/etc/cron.d/backdoor.png')).toThrow(/Path must be within/);
  });

  it('blocks /tmpevil prefix collision', () => {
    expect(() => validateOutputPath('/tmpevil/file.png')).toThrow(/Path must be within/);
  });

  it('blocks home directory paths', () => {
    expect(() => validateOutputPath('/Users/someone/file.png')).toThrow(/Path must be within/);
  });

  it('blocks path traversal via ..', () => {
    expect(() => validateOutputPath('/tmp/../etc/passwd')).toThrow(/Path must be within/);
  });
});

describe('validateReadPath', () => {
  it('allows absolute paths within /tmp', () => {
    expect(() => validateReadPath('/tmp/script.js')).not.toThrow();
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
    expect(() => validateReadPath('/tmpevil/file.js')).toThrow(/Absolute path must be within/);
  });

  it('blocks path traversal sequences', () => {
    expect(() => validateReadPath('../../../etc/passwd')).toThrow(/Path traversal/);
  });

  it('blocks nested path traversal', () => {
    expect(() => validateReadPath('src/../../etc/passwd')).toThrow(/Path traversal/);
  });
});
