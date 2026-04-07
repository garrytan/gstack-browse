/**
 * Parent-process watchdog regression tests.
 *
 * Verifies that the watchdog in server.ts:
 * 1. Skips shutdown in headed mode (fixes #867)
 * 2. Skips shutdown in tunnel mode
 * 3. Skips shutdown when recent activity exists (grace period)
 * 4. Calls shutdown when parent is dead AND server is idle
 * 5. Only treats ESRCH as "parent gone" (not EPERM or other codes)
 *
 * Two layers:
 *   - Source-level checks (guard presence and ordering)
 *   - Behavioral tests (extracted predicate logic)
 */

import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_SRC = fs.readFileSync(
  path.join(import.meta.dir, '../src/server.ts'),
  'utf-8',
);

// Extract the watchdog block (from the comment header to the closing brace)
function getWatchdogBlock(): string {
  const start = SERVER_SRC.indexOf('// ─── Parent-Process Watchdog');
  const searchFrom = SERVER_SRC.indexOf('setInterval(', start);
  // Find the matching closing of the if block
  let depth = 0;
  let end = SERVER_SRC.indexOf('{', searchFrom);
  for (let i = end; i < SERVER_SRC.length; i++) {
    if (SERVER_SRC[i] === '{') depth++;
    if (SERVER_SRC[i] === '}') depth--;
    if (depth === 0) {
      // Find the next closing brace (the outer `if` block)
      const outerEnd = SERVER_SRC.indexOf('}', i + 1);
      return SERVER_SRC.slice(start, outerEnd + 1);
    }
  }
  return SERVER_SRC.slice(start, start + 800);
}

describe('Parent-process watchdog', () => {
  const block = getWatchdogBlock();

  // ─── Source-level guard checks ──────────────────────────────

  it('uses shouldSuppressAutoShutdown() guard before killing', () => {
    // The watchdog must call the shared guard function
    expect(block).toContain('shouldSuppressAutoShutdown()');
    // The guard call must come before the process.kill call
    const guardIdx = block.indexOf('shouldSuppressAutoShutdown()');
    const killIdx = block.indexOf('process.kill(BROWSE_PARENT_PID');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(killIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(killIdx);
  });

  it('checks lastActivity grace period before shutdown', () => {
    // Must check activity recency in the catch block (parent dead path)
    expect(block).toContain('lastActivity');
    expect(block).toContain('WATCHDOG_GRACE_MS');
    // shutdown() should only appear inside the grace period condition
    const graceIdx = block.indexOf('WATCHDOG_GRACE_MS');
    const shutdownIdx = block.indexOf('shutdown()', graceIdx);
    expect(shutdownIdx).toBeGreaterThan(graceIdx);
  });

  it('defines WATCHDOG_GRACE_MS as a positive value >= poll interval', () => {
    const match = SERVER_SRC.match(/const WATCHDOG_GRACE_MS\s*=\s*(\d[\d_]*)/);
    expect(match).not.toBeNull();
    const value = parseInt(match![1].replace(/_/g, ''), 10);
    expect(value).toBeGreaterThanOrEqual(15_000); // at least one watchdog interval
  });

  it('uses signal 0 for existence check (not a real signal)', () => {
    expect(block).toContain('process.kill(BROWSE_PARENT_PID, 0)');
  });

  it('only treats ESRCH as parent-gone (not EPERM or other codes)', () => {
    // The catch block should check for ESRCH specifically
    expect(block).toContain("err?.code !== 'ESRCH'");
    // Must NOT have the old inverted logic (only checking EPERM)
    expect(block).not.toContain("err?.code === 'EPERM'");
  });

  // ─── Shared guard function checks ──────────────────────────

  it('defines shouldSuppressAutoShutdown() with headed and tunnel guards', () => {
    const guardMatch = SERVER_SRC.match(
      /function shouldSuppressAutoShutdown\(\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/
    );
    expect(guardMatch).not.toBeNull();
    const guardBody = guardMatch![1];
    expect(guardBody).toContain("getConnectionMode() === 'headed'");
    expect(guardBody).toContain('tunnelActive');
  });

  it('idle timer and watchdog both use shouldSuppressAutoShutdown()', () => {
    const idleBlock = SERVER_SRC.slice(
      SERVER_SRC.indexOf('// ─── Idle Timer'),
      SERVER_SRC.indexOf('// ─── Parent-Process Watchdog'),
    );
    expect(idleBlock).toContain('shouldSuppressAutoShutdown()');
    expect(block).toContain('shouldSuppressAutoShutdown()');
  });

  // ─── Behavioral tests (extracted logic) ─────────────────────

  describe('shouldSuppressAutoShutdown logic', () => {
    // Extract and evaluate the guard conditions directly
    // by simulating the state the guard checks

    it('returns true when connection mode is headed', () => {
      // The guard checks getConnectionMode() === 'headed'.
      // If 'headed' is returned, auto-shutdown should be suppressed.
      const guardFn = SERVER_SRC.match(
        /function shouldSuppressAutoShutdown\(\)[^{]*\{([\s\S]*?)\n\}/
      );
      expect(guardFn).not.toBeNull();
      const body = guardFn![1];
      // Verify the headed check returns true (suppresses shutdown)
      expect(body).toMatch(/getConnectionMode\(\)\s*===\s*'headed'.*return true/s);
    });

    it('returns true when tunnel is active', () => {
      const guardFn = SERVER_SRC.match(
        /function shouldSuppressAutoShutdown\(\)[^{]*\{([\s\S]*?)\n\}/
      );
      expect(guardFn).not.toBeNull();
      const body = guardFn![1];
      // Verify the tunnel check returns true (suppresses shutdown)
      expect(body).toMatch(/tunnelActive.*return true/s);
    });

    it('returns false when neither headed nor tunnel (allows shutdown)', () => {
      const guardFn = SERVER_SRC.match(
        /function shouldSuppressAutoShutdown\(\)[^{]*\{([\s\S]*?)\n\}/
      );
      expect(guardFn).not.toBeNull();
      const body = guardFn![1];
      // The function ends with return false
      expect(body.trim()).toMatch(/return false;\s*$/);
    });
  });

  describe('watchdog catch block logic', () => {
    it('only proceeds to shutdown check on ESRCH (parent truly gone)', () => {
      // Extract the catch block from the watchdog
      const catchStart = block.indexOf('} catch');
      const catchBlock = block.slice(catchStart);
      // The first check should filter out non-ESRCH codes
      expect(catchBlock).toContain("err?.code !== 'ESRCH'");
      // The grace period check should come AFTER the ESRCH filter
      const esrchIdx = catchBlock.indexOf("'ESRCH'");
      const graceIdx = catchBlock.indexOf('WATCHDOG_GRACE_MS');
      expect(esrchIdx).toBeLessThan(graceIdx);
    });

    it('grace period compares Date.now() - lastActivity > threshold', () => {
      const catchStart = block.indexOf('} catch');
      const catchBlock = block.slice(catchStart);
      // Must use > (greater than), not >= or <
      expect(catchBlock).toMatch(/Date\.now\(\)\s*-\s*lastActivity\s*>\s*WATCHDOG_GRACE_MS/);
    });
  });

  // ─── Shutdown cleanup ──────────────────────────────────────

  it('clears watchdog interval during shutdown', () => {
    const shutdownStart = SERVER_SRC.indexOf('async function shutdown()');
    // Grab enough of the shutdown function to include interval cleanup
    const shutdownBlock = SERVER_SRC.slice(shutdownStart, shutdownStart + 1500);
    expect(shutdownBlock).toContain('clearInterval(watchdogInterval)');
  });

  it('shutdown is idempotent (has re-entry guard)', () => {
    const shutdownBlock = SERVER_SRC.slice(
      SERVER_SRC.indexOf('async function shutdown()'),
      SERVER_SRC.indexOf('async function shutdown()') + 200,
    );
    expect(shutdownBlock).toContain('isShuttingDown');
  });
});
