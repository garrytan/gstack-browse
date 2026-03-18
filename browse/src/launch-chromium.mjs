/**
 * Node-based Chromium launcher for Windows.
 *
 * Bun's subprocess pipe handling breaks Playwright's CDP connection on Windows.
 * This tiny Node script launches Chromium via Playwright and prints the WebSocket
 * endpoint to stdout. The Bun server then connects via `chromium.connect(wsEndpoint)`.
 *
 * Usage: node launch-chromium.mjs
 * Output: ws://127.0.0.1:<port>/<id>
 */

import { chromium } from 'playwright';

const server = await chromium.launchServer({ headless: true });
const ws = server.wsEndpoint();

// Print endpoint for parent process to read
process.stdout.write(ws + '\n');

// Keep alive until parent kills us
process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// On Windows, handle parent disconnect
process.on('disconnect', async () => {
  await server.close();
  process.exit(0);
});
