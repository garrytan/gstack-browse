import { describe, test, expect } from 'bun:test';
import { generateHelpText, wrapError, dispatchCommand } from '../src/server-shared';

describe('server-shared', () => {
  describe('generateHelpText', () => {
    test('returns a non-empty string', () => {
      const text = generateHelpText();
      expect(text.length).toBeGreaterThan(0);
    });

    test('includes header', () => {
      const text = generateHelpText();
      expect(text).toContain('gstack browse');
    });

    test('includes command categories', () => {
      const text = generateHelpText();
      expect(text).toContain('Navigation:');
      expect(text).toContain('Reading:');
      expect(text).toContain('Snapshot:');
    });

    test('includes snapshot flags section', () => {
      const text = generateHelpText();
      expect(text).toContain('Snapshot flags:');
    });
  });

  describe('wrapError', () => {
    test('wraps timeout errors with locator context', () => {
      const err = new Error('locator.click: Timeout 30000ms exceeded');
      err.name = 'TimeoutError';
      const msg = wrapError(err);
      expect(msg).toContain('not found or not interactable');
      expect(msg).toContain('snapshot');
    });

    test('wraps navigation timeout errors', () => {
      const err = new Error('page.goto: Navigation timeout 30000ms exceeded');
      err.name = 'TimeoutError';
      const msg = wrapError(err);
      expect(msg).toContain('navigation timed out');
    });

    test('wraps generic timeout errors', () => {
      const err = new Error('Timeout exceeded while waiting');
      err.name = 'TimeoutError';
      const msg = wrapError(err);
      expect(msg).toContain('Operation timed out');
    });

    test('wraps multiple-element errors', () => {
      const err = new Error('locator resolved to 5 elements');
      const msg = wrapError(err);
      expect(msg).toContain('multiple elements');
    });

    test('passes through unknown errors', () => {
      const err = new Error('Something went wrong');
      const msg = wrapError(err);
      expect(msg).toBe('Something went wrong');
    });

    test('handles errors without message property', () => {
      const msg = wrapError({ name: 'Error' });
      expect(msg).toBe('[object Object]');
    });
  });

  describe('dispatchCommand', () => {
    test('returns 400 for missing command', async () => {
      const mockBm = {} as any;
      const result = await dispatchCommand({}, mockBm, () => {});
      expect(result.status).toBe(400);
      expect(result.contentType).toBe('application/json');
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing');
    });

    test('returns 400 for unknown command', async () => {
      const mockBm = {} as any;
      const result = await dispatchCommand({ command: 'nonexistent_xyz' }, mockBm, () => {});
      expect(result.status).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unknown command');
      expect(body.hint).toBeDefined();
    });

    test('returns help text for help command', async () => {
      const mockBm = {} as any;
      const result = await dispatchCommand({ command: 'help' }, mockBm, () => {});
      expect(result.status).toBe(200);
      expect(result.contentType).toBe('text/plain');
      expect(result.body).toContain('gstack browse');
    });
  });
});
