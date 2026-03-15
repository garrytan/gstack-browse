/**
 * gstack CLI — thin wrapper that talks to the persistent server
 *
 * Flow:
 *   1. Read .gstack/browse.json for port + token
 *   2. If missing or stale PID → start server in background
 *   3. Health check + version mismatch detection
 *   4. Send command via HTTP POST
 *   5. Print response to stdout (or stderr for errors)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveConfig, ensureStateDir, readVersionHash } from './config';

const config = resolveConfig();
const IS_WINDOWS = process.platform === 'win32';
const MAX_START_WAIT = IS_WINDOWS ? 20000 : 8000; // Windows needs more time (Node.js + tsx startup)
const TMPDIR = IS_WINDOWS ? (os.tmpdir() || process.env.TEMP || 'C:\\Temp') : '/tmp';

export function resolveServerScript(
  env: Record<string, string | undefined> = process.env,
  metaDir: string = import.meta.dir,
  execPath: string = process.execPath
): string {
  if (env.BROWSE_SERVER_SCRIPT) {
    return env.BROWSE_SERVER_SCRIPT;
  }

  // Dev mode: cli.ts runs directly from browse/src
  const isRealPath = IS_WINDOWS
    ? /^[A-Za-z]:[\\/]/.test(metaDir) && !metaDir.includes('$bunfs')
    : metaDir.startsWith('/') && !metaDir.includes('$bunfs');
  if (isRealPath) {
    const direct = path.resolve(metaDir, 'server.ts');
    if (fs.existsSync(direct)) {
      return direct;
    }
  }

  // Compiled binary: derive the source tree from browse/dist/browse
  if (execPath) {
    const adjacent = path.resolve(path.dirname(execPath), '..', 'src', 'server.ts');
    if (fs.existsSync(adjacent)) {
      return adjacent;
    }
  }

  throw new Error(
    'Cannot find server.ts. Set BROWSE_SERVER_SCRIPT env or run from the browse source tree.'
  );
}

const SERVER_SCRIPT = resolveServerScript();

interface ServerState {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
  serverPath: string;
  binaryVersion?: string;
}

// ─── State File ────────────────────────────────────────────────
function readState(): ServerState | null {
  try {
    const data = fs.readFileSync(config.stateFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─── Process Management ─────────────────────────────────────────
async function killServer(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) return;

  try { process.kill(pid, 'SIGTERM'); } catch { return; }

  // Wait up to 2s for graceful shutdown
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && isProcessAlive(pid)) {
    await Bun.sleep(100);
  }

  // Force kill if still alive
  if (isProcessAlive(pid)) {
    if (IS_WINDOWS) {
      try { Bun.spawnSync(['taskkill', '/F', '/PID', String(pid)], { stdout: 'pipe', stderr: 'pipe' }); } catch {}
    } else {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }
}

/**
 * Clean up legacy /tmp/browse-server*.json files from before project-local state.
 * Verifies PID ownership before sending signals.
 */
function cleanupLegacyState(): void {
  try {
    const files = fs.readdirSync(TMPDIR).filter(f => f.startsWith('browse-server') && f.endsWith('.json'));
    for (const file of files) {
      const fullPath = path.join(TMPDIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        if (data.pid && isProcessAlive(data.pid)) {
          if (IS_WINDOWS) {
            // On Windows, use wmic to check process command line
            const check = Bun.spawnSync(['wmic', 'process', 'where', `ProcessId=${data.pid}`, 'get', 'CommandLine'], {
              stdout: 'pipe', stderr: 'pipe', timeout: 2000,
            });
            const cmd = check.stdout.toString().trim();
            if (cmd.includes('bun') || cmd.includes('server.ts')) {
              try { process.kill(data.pid, 'SIGTERM'); } catch {}
            }
          } else {
            // Verify this is actually a browse server before killing
            const check = Bun.spawnSync(['ps', '-p', String(data.pid), '-o', 'command='], {
              stdout: 'pipe', stderr: 'pipe', timeout: 2000,
            });
            const cmd = check.stdout.toString().trim();
            if (cmd.includes('bun') || cmd.includes('server.ts')) {
              try { process.kill(data.pid, 'SIGTERM'); } catch {}
            }
          }
        }
        fs.unlinkSync(fullPath);
      } catch {
        // Best effort — skip files we can't parse or clean up
      }
    }
    // Clean up legacy log files too
    const logFiles = fs.readdirSync(TMPDIR).filter(f =>
      f.startsWith('browse-console') || f.startsWith('browse-network') || f.startsWith('browse-dialog')
    );
    for (const file of logFiles) {
      try { fs.unlinkSync(path.join(TMPDIR, file)); } catch {}
    }
  } catch {
    // tmp read failed — skip legacy cleanup
  }
}

// ─── Bun Resolution ────────────────────────────────────────────
/**
 * Find the bun executable. On Windows, the browser-manager handles
 * Playwright's pipe issue by launching Chromium via Node.js separately.
 * The Bun server itself works fine on all platforms.
 */
function findBunExecutable(): string {
  const whichCmd = IS_WINDOWS ? 'where' : 'which';
  const check = Bun.spawnSync([whichCmd, 'bun'], { stdout: 'pipe', stderr: 'pipe', timeout: 3000 });
  if (check.exitCode === 0) {
    const found = check.stdout.toString().trim().split(/\r?\n/)[0];
    if (found) return found;
  }

  const homedir = os.homedir();
  const candidates = IS_WINDOWS
    ? [
        path.join(homedir, '.bun', 'bin', 'bun.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe'),
        path.join(process.env.APPDATA || '', 'bun', 'bun.exe'),
      ]
    : [
        path.join(homedir, '.bun', 'bin', 'bun'),
        '/usr/local/bin/bun',
        '/opt/homebrew/bin/bun',
      ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `[browse] Cannot find bun executable. Install bun (https://bun.sh) and ensure it is in PATH.`
  );
}

// ─── Server Lifecycle ──────────────────────────────────────────
async function startServer(): Promise<ServerState> {
  ensureStateDir(config);

  // Clean up stale state file
  try { fs.unlinkSync(config.stateFile); } catch {}

  // On Windows, use Node.js + tsx to run the server (Bun's pipes break Playwright).
  // On macOS/Linux, use bun directly.
  let proc: any;
  if (IS_WINDOWS) {
    // Resolve win-server.ts path relative to SERVER_SCRIPT
    const winServerScript = path.resolve(path.dirname(SERVER_SCRIPT), 'win-server.ts');
    // Find npx or tsx
    // tsx binary: bun installs as .exe, npm installs as .cmd
    let tsxPath = path.resolve(path.dirname(SERVER_SCRIPT), '..', 'node_modules', '.bin', 'tsx.exe');
    let tsxExists = fs.existsSync(tsxPath);
    if (!tsxExists) {
      tsxPath = path.resolve(path.dirname(SERVER_SCRIPT), '..', 'node_modules', '.bin', 'tsx.cmd');
      tsxExists = fs.existsSync(tsxPath);
    }

    if (tsxExists && fs.existsSync(winServerScript)) {
      proc = Bun.spawn([tsxPath, winServerScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, BROWSE_STATE_FILE: config.stateFile },
      });
    } else {
      // Fallback: try npx tsx
      proc = Bun.spawn(['npx', 'tsx', winServerScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, BROWSE_STATE_FILE: config.stateFile },
      });
    }
  } else {
    const bunPath = findBunExecutable();
    proc = Bun.spawn([bunPath, 'run', SERVER_SCRIPT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSE_STATE_FILE: config.stateFile },
    });
  }

  // Don't hold the CLI open
  proc.unref();

  // Wait for state file to appear
  const start = Date.now();
  while (Date.now() - start < MAX_START_WAIT) {
    const state = readState();
    if (state && isProcessAlive(state.pid)) {
      return state;
    }
    await Bun.sleep(100);
  }

  // If we get here, server didn't start in time
  // Try to read stderr for error message
  const stderr = proc.stderr;
  if (stderr) {
    const reader = stderr.getReader();
    const { value } = await reader.read();
    if (value) {
      const errText = new TextDecoder().decode(value);
      throw new Error(`Server failed to start:\n${errText}`);
    }
  }
  throw new Error(`Server failed to start within ${MAX_START_WAIT / 1000}s`);
}

async function ensureServer(): Promise<ServerState> {
  const state = readState();

  if (state && isProcessAlive(state.pid)) {
    // Check for binary version mismatch (auto-restart on update)
    const currentVersion = readVersionHash();
    if (currentVersion && state.binaryVersion && currentVersion !== state.binaryVersion) {
      console.error('[browse] Binary updated, restarting server...');
      await killServer(state.pid);
      return startServer();
    }

    // Server appears alive — do a health check
    try {
      const resp = await fetch(`http://127.0.0.1:${state.port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const health = await resp.json() as any;
        if (health.status === 'healthy') {
          return state;
        }
      }
    } catch {
      // Health check failed — server is dead or unhealthy
    }
  }

  // Need to (re)start
  console.error('[browse] Starting server...');
  return startServer();
}

// ─── Command Dispatch ──────────────────────────────────────────
async function sendCommand(state: ServerState, command: string, args: string[], retries = 0): Promise<void> {
  const body = JSON.stringify({ command, args });

  try {
    const resp = await fetch(`http://127.0.0.1:${state.port}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });

    if (resp.status === 401) {
      // Token mismatch — server may have restarted
      console.error('[browse] Auth failed — server may have restarted. Retrying...');
      const newState = readState();
      if (newState && newState.token !== state.token) {
        return sendCommand(newState, command, args);
      }
      throw new Error('Authentication failed');
    }

    const text = await resp.text();

    if (resp.ok) {
      process.stdout.write(text);
      if (!text.endsWith('\n')) process.stdout.write('\n');
    } else {
      // Try to parse as JSON error
      try {
        const err = JSON.parse(text);
        console.error(err.error || text);
        if (err.hint) console.error(err.hint);
      } catch {
        console.error(text);
      }
      process.exit(1);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[browse] Command timed out after 30s');
      process.exit(1);
    }
    // Connection error — server may have crashed
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.message?.includes('fetch failed')) {
      if (retries >= 1) throw new Error('[browse] Server crashed twice in a row — aborting');
      console.error('[browse] Server connection lost. Restarting...');
      const newState = await startServer();
      return sendCommand(newState, command, args, retries + 1);
    }
    throw err;
  }
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`gstack browse — Fast headless browser for AI coding agents

Usage: browse <command> [args...]

Navigation:     goto <url> | back | forward | reload | url
Content:        text | html [sel] | links | forms | accessibility
Interaction:    click <sel> | fill <sel> <val> | select <sel> <val>
                hover <sel> | type <text> | press <key>
                scroll [sel] | wait <sel|--networkidle|--load> | viewport <WxH>
                upload <sel> <file1> [file2...]
                cookie-import <json-file>
                cookie-import-browser [browser] [--domain <d>]
Inspection:     js <expr> | eval <file> | css <sel> <prop> | attrs <sel>
                console [--clear|--errors] | network [--clear] | dialog [--clear]
                cookies | storage [set <k> <v>] | perf
                is <prop> <sel> (visible|hidden|enabled|disabled|checked|editable|focused)
Visual:         screenshot [--viewport] [--clip x,y,w,h] [@ref|sel] [path]
                pdf [path] | responsive [prefix]
Snapshot:       snapshot [-i] [-c] [-d N] [-s sel] [-D] [-a] [-o path] [-C]
                -D/--diff: diff against previous snapshot
                -a/--annotate: annotated screenshot with ref labels
                -C/--cursor-interactive: find non-ARIA clickable elements
Compare:        diff <url1> <url2>
Multi-step:     chain (reads JSON from stdin)
Tabs:           tabs | tab <id> | newtab [url] | closetab [id]
Server:         status | cookie <n>=<v> | header <n>:<v>
                useragent <str> | stop | restart
Dialogs:        dialog-accept [text] | dialog-dismiss

Refs:           After 'snapshot', use @e1, @e2... as selectors:
                click @e3 | fill @e4 "value" | hover @e1
                @c refs from -C: click @c1`);
    process.exit(0);
  }

  // One-time cleanup of legacy /tmp state files
  cleanupLegacyState();

  const command = args[0];
  const commandArgs = args.slice(1);

  // Special case: chain reads from stdin
  if (command === 'chain' && commandArgs.length === 0) {
    const stdin = await Bun.stdin.text();
    commandArgs.push(stdin.trim());
  }

  const state = await ensureServer();
  await sendCommand(state, command, commandArgs);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[browse] ${err.message}`);
    process.exit(1);
  });
}
