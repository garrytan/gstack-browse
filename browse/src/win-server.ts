/**
 * Windows server entry point
 *
 * On Windows, Bun's subprocess pipes and WebSocket client break Playwright.
 * This entry point runs the server via Node.js with Bun API polyfills.
 *
 * Usage: node --import ./browse/src/win-register.mjs browse/src/win-server.ts
 *   or:  npx tsx browse/src/win-server.ts (if bun: imports are resolved)
 */

// Polyfill Bun globals before importing server
import http from 'http';
import fs from 'fs';
import childProcess from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill import.meta.dir for all modules (Bun-specific)
// @ts-ignore
if (!import.meta.dir) {
  // @ts-ignore
  import.meta.dir = __dirname;
}

// Polyfill Bun global
if (typeof globalThis.Bun === 'undefined') {
  (globalThis as any).Bun = {
    sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    spawn(cmd: string[], opts?: any): any {
      const [command, ...args] = cmd;
      const stdio = opts?.stdio || ['pipe', 'pipe', 'pipe'];
      const child = childProcess.spawn(command, args, {
        stdio,
        env: opts?.env || process.env,
        windowsHide: true,
      });

      const result: any = {
        pid: child.pid,
        stdin: child.stdin,
        stdout: child.stdout,
        stderr: child.stderr,
        exitCode: null as number | null,
        kill: (signal?: string) => child.kill(signal as any),
        unref: () => child.unref(),
        exited: new Promise<number>((resolve) => {
          child.on('exit', (code) => {
            result.exitCode = code;
            resolve(code ?? 1);
          });
        }),
      };

      return result;
    },

    spawnSync(cmd: string[], opts?: any): any {
      const [command, ...args] = cmd;
      const result = childProcess.spawnSync(command, args, {
        stdio: opts?.stdio,
        timeout: opts?.timeout,
        env: opts?.env,
        windowsHide: true,
      });

      return {
        exitCode: result.status,
        stdout: {
          toString: () => (result.stdout ? result.stdout.toString() : ''),
        },
        stderr: {
          toString: () => (result.stderr ? result.stderr.toString() : ''),
        },
      };
    },

    serve(opts: any): any {
      const server = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        const url = `http://${opts.hostname || '127.0.0.1'}:${actualPort}${req.url}`;
        const headers = new Headers();
        for (const [key, val] of Object.entries(req.headers)) {
          if (val) headers.set(key, Array.isArray(val) ? val[0] : val);
        }

        const request = new Request(url, {
          method: req.method,
          headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
        });

        try {
          const response = await opts.fetch(request);
          const responseBody = await response.text();
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((val: string, key: string) => {
            responseHeaders[key] = val;
          });
          res.writeHead(response.status, responseHeaders);
          res.end(responseBody);
        } catch (err: any) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      let actualPort = opts.port;
      server.listen(opts.port, opts.hostname || '127.0.0.1');

      return {
        get port() { return actualPort; },
        hostname: opts.hostname || '127.0.0.1',
        stop: () => { server.close(); },
      };
    },

    file(filePath: string): any {
      return {
        text: async () => {
          try {
            return fs.readFileSync(filePath, 'utf-8');
          } catch {
            throw new Error(`File not found: ${filePath}`);
          }
        },
      };
    },

    async write(filePath: string, content: string): Promise<void> {
      fs.writeFileSync(filePath, content, 'utf-8');
    },

    stdin: {
      async text(): Promise<string> {
        return new Promise((resolve) => {
          let data = '';
          process.stdin.on('data', (chunk: any) => data += chunk);
          process.stdin.on('end', () => resolve(data));
        });
      },
    },
  };
}

// Now import the server — it will use our polyfilled Bun globals
await import('./server.ts');
