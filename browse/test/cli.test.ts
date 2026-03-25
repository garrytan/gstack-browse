import { afterEach, describe, expect, test } from 'bun:test';
import { acquireLockFile, getServerStartStrategy, isWsl, requestLoopback } from '../src/cli';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROXY_ENV_KEYS = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy'] as const;
const ORIGINAL_PROXY_ENV = Object.fromEntries(
  PROXY_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof PROXY_ENV_KEYS)[number], string | undefined>;

function restoreProxyEnv() {
  for (const key of PROXY_ENV_KEYS) {
    const value = ORIGINAL_PROXY_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('cli runtime helpers', () => {
  afterEach(() => {
    restoreProxyEnv();
  });

  describe('isWsl', () => {
    test('detects WSL from Linux kernel release', () => {
      expect(isWsl({}, 'linux', '6.6.87.2-microsoft-standard-WSL2')).toBe(true);
    });

    test('detects WSL from environment markers', () => {
      expect(isWsl({ WSL_DISTRO_NAME: 'Ubuntu' }, 'linux', '6.8.0')).toBe(true);
      expect(isWsl({ WSL_INTEROP: '/run/WSL/123_interop' }, 'linux', '6.8.0')).toBe(true);
    });

    test('does not treat non-Linux platforms as WSL', () => {
      expect(isWsl({ WSL_DISTRO_NAME: 'Ubuntu' }, 'darwin', '23.0.0')).toBe(false);
      expect(isWsl({}, 'linux', '6.8.0')).toBe(false);
    });
  });

  describe('getServerStartStrategy', () => {
    test('uses Node server bundle on Windows when available', () => {
      expect(getServerStartStrategy('/tmp/server-node.mjs', {}, 'win32', '10.0.26100')).toBe('node');
    });

    test('uses detached bun launch on WSL', () => {
      expect(
        getServerStartStrategy(null, { WSL_DISTRO_NAME: 'Ubuntu' }, 'linux', '6.6.87.2-microsoft-standard-WSL2')
      ).toBe('detached-bun');
    });

    test('uses Bun directly on normal Unix hosts', () => {
      expect(getServerStartStrategy(null, {}, 'linux', '6.8.0')).toBe('bun');
      expect(getServerStartStrategy(null, {}, 'darwin', '23.4.0')).toBe('bun');
    });
  });

  describe('requestLoopback', () => {
    test('bypasses proxy environment variables for localhost health checks', async () => {
      const server = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        fetch() {
          return new Response(JSON.stringify({ status: 'healthy' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      process.env.HTTP_PROXY = 'http://127.0.0.1:9';
      process.env.http_proxy = 'http://127.0.0.1:9';
      process.env.HTTPS_PROXY = 'http://127.0.0.1:9';
      process.env.https_proxy = 'http://127.0.0.1:9';

      try {
        const resp = await requestLoopback(server.port, '/health', { timeoutMs: 1000 });
        expect(resp.status).toBe(200);
        expect(JSON.parse(resp.text)).toEqual({ status: 'healthy' });
      } finally {
        server.stop();
      }
    });

    test('posts command payloads and returns the raw response body', async () => {
      const server = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        async fetch(req) {
          return new Response(await req.text(), { status: 201 });
        },
      });

      try {
        const payload = JSON.stringify({ command: 'status', args: [] });
        const resp = await requestLoopback(server.port, '/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          timeoutMs: 1000,
        });
        expect(resp.status).toBe(201);
        expect(resp.text).toBe(payload);
      } finally {
        server.stop();
      }
    });
  });

  describe('acquireLockFile', () => {
    test('creates the parent directory on first run and releases cleanly', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browse-lock-test-'));
      const lockPath = path.join(tmpDir, '.gstack', 'browse.json.lock');

      try {
        const release = acquireLockFile(lockPath);
        expect(release).not.toBeNull();
        expect(fs.existsSync(lockPath)).toBe(true);
        release?.();
        expect(fs.existsSync(lockPath)).toBe(false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('returns null when a live process already holds the lock', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browse-lock-test-'));
      const lockPath = path.join(tmpDir, '.gstack', 'browse.json.lock');
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      fs.writeFileSync(lockPath, `${process.pid}\n`);

      try {
        expect(acquireLockFile(lockPath)).toBeNull();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
