/**
 * Session isolation tests for browse
 *
 * Verifies that sessions have independent cookies, tabs, refs, and state.
 * Each test cleans up after itself to ensure no cross-test pollution.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer } from './test-server';
import { BrowserManager } from '../src/browser-manager';
import { handleReadCommand } from '../src/read-commands';
import { handleWriteCommand } from '../src/write-commands';
import { handleMetaCommand } from '../src/meta-commands';

let testServer: ReturnType<typeof startTestServer>;
let bm: BrowserManager;
let baseUrl: string;
const shutdown = async () => {};

beforeAll(async () => {
  testServer = startTestServer(0);
  baseUrl = testServer.url;

  bm = new BrowserManager();
  await bm.launch();
});

afterAll(() => {
  try { testServer.server.stop(); } catch {}
  setTimeout(() => process.exit(0), 500);
});

// ─── Session Isolation ──────────────────────────────────────────

describe('session isolation', () => {
  test('session list shows default on startup', () => {
    const sessions = bm.getSessionList();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe('default');
    expect(sessions[0].active).toBe(true);
    expect(sessions[0].tabCount).toBeGreaterThanOrEqual(1);
  });

  test('session new creates isolated context', async () => {
    await bm.newSession('test-a');
    const sessions = bm.getSessionList();
    expect(sessions).toHaveLength(2);
    expect(bm.getActiveSessionName()).toBe('test-a');

    bm.switchSession('default');
    await bm.deleteSession('test-a');
  });

  test('cookies isolated between sessions', async () => {
    // Set cookie in default session
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    await handleWriteCommand('cookie', ['test_cookie=default_value'], bm);
    const defaultCookies = await handleReadCommand('cookies', [], bm);
    expect(defaultCookies).toContain('test_cookie');

    // Create new session — cookie should NOT be visible
    await bm.newSession('cookie-test');
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    const newCookies = await handleReadCommand('cookies', [], bm);
    expect(newCookies).not.toContain('test_cookie');

    // Switch back — cookie should still be there
    bm.switchSession('default');
    const backCookies = await handleReadCommand('cookies', [], bm);
    expect(backCookies).toContain('test_cookie');

    await bm.deleteSession('cookie-test');
  });

  test('tabs isolated between sessions', async () => {
    const defaultTabCount = bm.getTabCount();

    await bm.newSession('tab-test');
    expect(bm.getTabCount()).toBe(1);

    bm.switchSession('default');
    expect(bm.getTabCount()).toBe(defaultTabCount);

    await bm.deleteSession('tab-test');
  });

  test('refs isolated between sessions', async () => {
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    await handleMetaCommand('snapshot', ['-i'], bm, shutdown);
    const defaultRefCount = bm.getRefCount();
    expect(defaultRefCount).toBeGreaterThan(0);

    await bm.newSession('ref-test');
    expect(bm.getRefCount()).toBe(0);

    bm.switchSession('default');
    expect(bm.getRefCount()).toBe(defaultRefCount);

    await bm.deleteSession('ref-test');
  });

  test('session switch preserves state', async () => {
    await bm.newSession('state-test');
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    await handleWriteCommand('cookie', ['state_cookie=preserved'], bm);

    bm.switchSession('default');
    bm.switchSession('state-test');

    const cookies = await handleReadCommand('cookies', [], bm);
    expect(cookies).toContain('state_cookie');
    expect(bm.getCurrentUrl()).toContain('basic.html');

    bm.switchSession('default');
    await bm.deleteSession('state-test');
  });

  test('session delete removes session', async () => {
    await bm.newSession('delete-me');
    expect(bm.getSessionList()).toHaveLength(2);

    bm.switchSession('default');
    await bm.deleteSession('delete-me');
    expect(bm.getSessionList()).toHaveLength(1);
  });

  test('session delete default throws', async () => {
    await expect(bm.deleteSession('default')).rejects.toThrow('Cannot delete the default session');
  });

  test('session delete active throws', async () => {
    await bm.newSession('active-test');
    await expect(bm.deleteSession('active-test')).rejects.toThrow('Cannot delete the active session');

    bm.switchSession('default');
    await bm.deleteSession('active-test');
  });

  test('session new duplicate name throws', async () => {
    await bm.newSession('dup-test');
    await expect(bm.newSession('dup-test')).rejects.toThrow('already exists');

    bm.switchSession('default');
    await bm.deleteSession('dup-test');
  });

  test('session new with invalid name throws', async () => {
    await expect(bm.newSession('')).rejects.toThrow();
    await expect(bm.newSession('has spaces')).rejects.toThrow();
    await expect(bm.newSession('a'.repeat(33))).rejects.toThrow();
    await expect(bm.newSession('special!chars')).rejects.toThrow();
  });

  test('session name reuse after delete works', async () => {
    await bm.newSession('reuse-me');
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    await handleWriteCommand('cookie', ['old_cookie=old_value'], bm);

    bm.switchSession('default');
    await bm.deleteSession('reuse-me');

    await bm.newSession('reuse-me');
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    const cookies = await handleReadCommand('cookies', [], bm);
    expect(cookies).not.toContain('old_cookie');

    bm.switchSession('default');
    await bm.deleteSession('reuse-me');
  });

  test('navigate in inactive session does not clear active session refs', async () => {
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);
    await handleMetaCommand('snapshot', ['-i'], bm, shutdown);
    const refCount = bm.getRefCount();
    expect(refCount).toBeGreaterThan(0);

    await bm.newSession('nav-test');
    await handleWriteCommand('goto', [baseUrl + '/basic.html'], bm);

    bm.switchSession('default');
    expect(bm.getRefCount()).toBe(refCount);

    await bm.deleteSession('nav-test');
  });

  test('session list via meta command', async () => {
    const result = await handleMetaCommand('session', ['list'], bm, shutdown);
    expect(result).toContain('default');
    expect(result).toContain('→');
  });

  test('session new/switch/delete via meta command', async () => {
    let result = await handleMetaCommand('session', ['new', 'cmd-test'], bm, shutdown);
    expect(result).toContain('Created');

    result = await handleMetaCommand('session', ['switch', 'default'], bm, shutdown);
    expect(result).toContain('Switched');

    result = await handleMetaCommand('session', ['delete', 'cmd-test'], bm, shutdown);
    expect(result).toContain('Deleted');
  });

  test('status includes session info', async () => {
    const result = await handleMetaCommand('status', [], bm, shutdown);
    expect(result).toContain('Session:');
    expect(result).toContain('default');
  });

  test('setExtraHeader before launch does not throw', async () => {
    const fresh = new BrowserManager();
    // Should not throw — no session exists yet, header is stored globally
    await fresh.setExtraHeader('X-Test', 'value');
    // If the getter was used instead of sessions.get(), this would throw:
    // "No active session "default" — this is a bug"
  });
});
