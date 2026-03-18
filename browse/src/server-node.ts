/**
 * Node runtime variant of browse server.
 * Used on platforms where Bun+Playwright transport is unreliable.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { BrowserManager } from './browser-manager';
import { handleReadCommand } from './read-commands';
import { handleWriteCommand } from './write-commands';
import { handleMetaCommand } from './meta-commands';
import { READ_COMMANDS, WRITE_COMMANDS, META_COMMANDS } from './commands';
import { resolveConfig, ensureStateDir, readVersionHash } from './config';
import { consoleBuffer, networkBuffer, dialogBuffer, addConsoleEntry, addNetworkEntry, addDialogEntry, type LogEntry, type NetworkEntry, type DialogEntry } from './buffers';

export { consoleBuffer, networkBuffer, dialogBuffer, addConsoleEntry, addNetworkEntry, addDialogEntry, type LogEntry, type NetworkEntry, type DialogEntry };

const config = resolveConfig();
ensureStateDir(config);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const AUTH_TOKEN = crypto.randomUUID();
const BROWSE_PORT = parseInt(process.env.BROWSE_PORT || '0', 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.BROWSE_IDLE_TIMEOUT || '1800000', 10);

const browserManager = new BrowserManager();
let isShuttingDown = false;
let httpServer: ReturnType<typeof createServer> | null = null;

const CONSOLE_LOG_PATH = config.consoleLog;
const NETWORK_LOG_PATH = config.networkLog;
const DIALOG_LOG_PATH = config.dialogLog;
let lastConsoleFlushed = 0;
let lastNetworkFlushed = 0;
let lastDialogFlushed = 0;
let flushInProgress = false;
let lastActivity = Date.now();

function resetIdleTimer() {
  lastActivity = Date.now();
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(text);
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain');
  res.end(body);
}

function readReqBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function validateAuth(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  return header === `Bearer ${AUTH_TOKEN}`;
}

async function flushBuffers() {
  if (flushInProgress) return;
  flushInProgress = true;
  try {
    const newConsoleCount = consoleBuffer.totalAdded - lastConsoleFlushed;
    if (newConsoleCount > 0) {
      const entries = consoleBuffer.last(Math.min(newConsoleCount, consoleBuffer.length));
      const lines = entries.map(e => `[${new Date(e.timestamp).toISOString()}] [${e.level}] ${e.text}`).join('\n') + '\n';
      fs.appendFileSync(CONSOLE_LOG_PATH, lines);
      lastConsoleFlushed = consoleBuffer.totalAdded;
    }

    const newNetworkCount = networkBuffer.totalAdded - lastNetworkFlushed;
    if (newNetworkCount > 0) {
      const entries = networkBuffer.last(Math.min(newNetworkCount, networkBuffer.length));
      const lines = entries.map(e => `[${new Date(e.timestamp).toISOString()}] ${e.method} ${e.url} -> ${e.status || 'pending'} (${e.duration || '?'}ms, ${e.size || '?'}B)`).join('\n') + '\n';
      fs.appendFileSync(NETWORK_LOG_PATH, lines);
      lastNetworkFlushed = networkBuffer.totalAdded;
    }

    const newDialogCount = dialogBuffer.totalAdded - lastDialogFlushed;
    if (newDialogCount > 0) {
      const entries = dialogBuffer.last(Math.min(newDialogCount, dialogBuffer.length));
      const lines = entries.map(e => `[${new Date(e.timestamp).toISOString()}] [${e.type}] "${e.message}" -> ${e.action}${e.response ? ` "${e.response}"` : ''}`).join('\n') + '\n';
      fs.appendFileSync(DIALOG_LOG_PATH, lines);
      lastDialogFlushed = dialogBuffer.totalAdded;
    }
  } catch {
    // non-fatal
  } finally {
    flushInProgress = false;
  }
}

function findPortNode(): Promise<number> {
  if (BROWSE_PORT) return Promise.resolve(BROWSE_PORT);
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      server.close();
      if (addr && typeof addr !== 'string') {
        resolve(addr.port);
      } else {
        reject(new Error('Could not determine a free port'));
      }
    });
    server.on('error', reject);
  });
}

async function handleCommand(body: any): Promise<{ status: number; text: string; isJson?: boolean }> {
  const { command, args = [] } = body || {};
  if (!command) return { status: 400, text: JSON.stringify({ error: 'Missing command' }), isJson: true };

  try {
    let result: string;
    if (WRITE_COMMANDS.has(command)) {
      result = await handleWriteCommand(command, args, browserManager);
    } else if (READ_COMMANDS.has(command)) {
      result = await handleReadCommand(command, args, browserManager);
    } else if (META_COMMANDS.has(command)) {
      result = await handleMetaCommand(command, args, browserManager, shutdown);
    } else {
      return { status: 400, text: JSON.stringify({ error: `Unknown command: ${command}` }), isJson: true };
    }
    return { status: 200, text: result };
  } catch (err: any) {
    return { status: 500, text: JSON.stringify({ error: err?.message || String(err) }), isJson: true };
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearInterval(flushInterval);
  clearInterval(idleCheckInterval);
  await flushBuffers();
  await browserManager.close();
  if (httpServer) {
    try { httpServer.close(); } catch {}
  }
  try { fs.unlinkSync(config.stateFile); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });

const flushInterval = setInterval(() => { void flushBuffers(); }, 1000);
const idleCheckInterval = setInterval(() => {
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    void shutdown();
  }
}, 60000);

async function start() {
  try { fs.unlinkSync(CONSOLE_LOG_PATH); } catch {}
  try { fs.unlinkSync(NETWORK_LOG_PATH); } catch {}
  try { fs.unlinkSync(DIALOG_LOG_PATH); } catch {}

  const port = await findPortNode();
  await browserManager.launch();

  httpServer = createServer(async (req, res) => {
    resetIdleTimer();
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (reqUrl.pathname === '/health') {
      const healthy = await browserManager.isHealthy();
      sendJson(res, 200, {
        status: healthy ? 'healthy' : 'unhealthy',
        tabs: browserManager.getTabCount(),
        currentUrl: browserManager.getCurrentUrl(),
      });
      return;
    }

    if (!validateAuth(req)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (reqUrl.pathname === '/command' && req.method === 'POST') {
      try {
        const body = await readReqBody(req);
        const out = await handleCommand(body);
        if (out.isJson) sendJson(res, out.status, JSON.parse(out.text));
        else sendText(res, out.status, out.text);
      } catch (err: any) {
        sendJson(res, 500, { error: err?.message || String(err) });
      }
      return;
    }

    sendText(res, 404, 'Not found');
  });

  await new Promise<void>((resolve, reject) => {
    httpServer!.once('error', reject);
    httpServer!.listen(port, '127.0.0.1', () => resolve());
  });

  const state = {
    pid: process.pid,
    port,
    token: AUTH_TOKEN,
    startedAt: new Date().toISOString(),
    serverPath: path.resolve(moduleDir, 'server-node.ts'),
    binaryVersion: readVersionHash() || undefined,
  };
  const tmpFile = config.stateFile + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmpFile, config.stateFile);

  browserManager.serverPort = port;
}

start().catch((err) => {
  console.error(`[browse-node] Failed to start: ${err?.message || String(err)}`);
  process.exit(1);
});
