import { describe, it, expect } from 'bun:test';
import { validateNavigationUrl } from '../src/url-validation';

describe('validateNavigationUrl', () => {
  it('allows http URLs', () => {
    expect(() => validateNavigationUrl('http://example.com')).not.toThrow();
  });

  it('allows https URLs', () => {
    expect(() => validateNavigationUrl('https://example.com/path?q=1')).not.toThrow();
  });

  it('allows localhost', () => {
    expect(() => validateNavigationUrl('http://localhost:3000')).not.toThrow();
  });

  it('allows 127.0.0.1', () => {
    expect(() => validateNavigationUrl('http://127.0.0.1:8080')).not.toThrow();
  });

  it('allows private IPs', () => {
    expect(() => validateNavigationUrl('http://192.168.1.1')).not.toThrow();
  });

  it('blocks file:// scheme', () => {
    expect(() => validateNavigationUrl('file:///etc/passwd')).toThrow(/scheme.*not allowed/i);
  });

  it('blocks javascript: scheme', () => {
    expect(() => validateNavigationUrl('javascript:alert(1)')).toThrow(/scheme.*not allowed/i);
  });

  it('blocks data: scheme', () => {
    expect(() => validateNavigationUrl('data:text/html,<h1>hi</h1>')).toThrow(/scheme.*not allowed/i);
  });

  it('blocks AWS/GCP metadata endpoint', () => {
    expect(() => validateNavigationUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/cloud metadata/i);
  });

  it('blocks GCP metadata hostname', () => {
    expect(() => validateNavigationUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrow(/cloud metadata/i);
  });

  it('blocks metadata hostname with trailing dot', () => {
    expect(() => validateNavigationUrl('http://metadata.google.internal./computeMetadata/v1/')).toThrow(/cloud metadata/i);
  });

  it('blocks metadata IP in hex form', () => {
    expect(() => validateNavigationUrl('http://0xA9FEA9FE/')).toThrow(/cloud metadata/i);
  });

  it('blocks metadata IP in decimal form', () => {
    expect(() => validateNavigationUrl('http://2852039166/')).toThrow(/cloud metadata/i);
  });

  it('blocks metadata IP in octal form', () => {
    expect(() => validateNavigationUrl('http://0251.0376.0251.0376/')).toThrow(/cloud metadata/i);
  });

  it('blocks IPv6 metadata with brackets', () => {
    expect(() => validateNavigationUrl('http://[fd00::]/')).toThrow(/cloud metadata/i);
  });

  it('throws on malformed URLs', () => {
    expect(() => validateNavigationUrl('not-a-url')).toThrow(/Invalid URL/i);
  });
});
