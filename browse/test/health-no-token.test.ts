/**
 * Verify the /health endpoint does not leak the auth token.
 *
 * This is a static analysis test: it reads the server source to confirm the
 * /health JSON response object does not include a `token` property.  A runtime
 * test would require spinning up the full Playwright stack, which is covered by
 * E2E tests — this gate-tier check catches regressions cheaply.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

describe('health endpoint security', () => {
  test('/health response does not contain auth token', () => {
    const serverSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/server.ts'),
      'utf-8',
    );

    // Extract the /health handler block — starts at `if (url.pathname === '/health')`
    // and ends at the next top-level `if (url.pathname` or route handler.
    const healthStart = serverSrc.indexOf("if (url.pathname === '/health')");
    expect(healthStart).toBeGreaterThan(-1);

    // Find the closing of the health response (next route handler)
    const nextRoute = serverSrc.indexOf('if (url.pathname', healthStart + 1);
    const healthBlock = serverSrc.slice(healthStart, nextRoute > -1 ? nextRoute : undefined);

    // The JSON.stringify object inside the health handler must NOT reference
    // AUTH_TOKEN or include a `token:` property.
    expect(healthBlock).not.toContain('AUTH_TOKEN');
    expect(healthBlock).not.toMatch(/\btoken\s*:/);
  });

  test('auth token is written to state file (0o600) for trusted clients', () => {
    const serverSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/server.ts'),
      'utf-8',
    );

    // The state file write block should still include the token
    const stateFileBlock = serverSrc.indexOf('// Write state file');
    expect(stateFileBlock).toBeGreaterThan(-1);

    const stateSection = serverSrc.slice(stateFileBlock, stateFileBlock + 500);
    expect(stateSection).toContain('token: AUTH_TOKEN');
    expect(stateSection).toContain('mode: 0o600');
  });

  test('sidebar-agent reads token from state file, not /health', () => {
    const agentSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/sidebar-agent.ts'),
      'utf-8',
    );

    // refreshToken should read from BROWSE_STATE_FILE, not fetch /health
    const refreshStart = agentSrc.indexOf('async function refreshToken');
    expect(refreshStart).toBeGreaterThan(-1);

    const refreshBlock = agentSrc.slice(refreshStart, refreshStart + 500);
    expect(refreshBlock).toContain('BROWSE_STATE_FILE');
    expect(refreshBlock).not.toContain('/health');
  });

  test('extension reads token from auth-token.json, not /health response', () => {
    const bgSrc = fs.readFileSync(
      path.resolve(__dirname, '../../extension/background.js'),
      'utf-8',
    );

    // checkHealth should NOT extract token from health response data
    expect(bgSrc).not.toContain('data.token');

    // Should read from auth-token.json via chrome.runtime.getURL
    expect(bgSrc).toContain('auth-token.json');
    expect(bgSrc).toContain('chrome.runtime.getURL');
  });
});
