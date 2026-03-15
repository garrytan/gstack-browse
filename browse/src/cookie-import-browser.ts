/**
 * Chromium browser cookie import — macOS
 *
 * Supports macOS Chromium-based browsers: Comet, Chrome, Arc, Brave, Edge.
 * Pure logic module — no Playwright dependency, no HTTP concerns.
 *
 * Decryption pipeline (Chromium macOS "v10" format):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ 1. Keychain: `security find-generic-password -s "<svc>" -w`     │
 *   │    → base64 password string                                     │
 *   │                                                                  │
 *   │ 2. Key derivation:                                               │
 *   │    PBKDF2(password, salt="saltysalt", iter=1003, len=16, sha1)  │
 *   │    → 16-byte AES key                                            │
 *   │                                                                  │
 *   │ 3. For each cookie with encrypted_value starting with "v10":    │
 *   │    - Ciphertext = encrypted_value[3:]                           │
 *   │    - IV = 16 bytes of 0x20 (space character)                    │
 *   │    - Plaintext = AES-128-CBC-decrypt(key, iv, ciphertext)       │
 *   │    - Remove PKCS7 padding                                       │
 *   │    - Skip first 32 bytes (HMAC-SHA256 authentication tag)       │
 *   │    - Remaining bytes = cookie value (UTF-8)                     │
 *   │                                                                  │
 *   │ 4. If encrypted_value is empty but `value` field is set,        │
 *   │    use value directly (unencrypted cookie)                      │
 *   │                                                                  │
 *   │ 5. Chromium epoch: microseconds since 1601-01-01                │
 *   │    Unix seconds = (epoch - 11644473600000000) / 1000000         │
 *   │                                                                  │
 *   │ 6. sameSite: 0→"None", 1→"Lax", 2→"Strict", else→"Lax"        │
 *   └──────────────────────────────────────────────────────────────────┘
 */

// Dynamic import to support Node.js on Windows (bun:sqlite unavailable)
let Database: any;
try {
  Database = (await import('bun:sqlite')).Database;
} catch {
  // On Node.js, bun:sqlite is unavailable — cookie import from browser DBs disabled
  Database = null;
}
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  type BrowserInfoBase,
  type DomainEntry,
  type ImportResult,
  type PlaywrightCookie,
  type RawCookie,
  CookieImportError,
  chromiumNow,
  toPlaywrightCookie,
  validateProfile,
  openDbWithCopy,
} from './cookie-import-shared';

// Re-export shared types for backwards compatibility
export { CookieImportError, type DomainEntry, type ImportResult, type PlaywrightCookie };

// ─── Types ──────────────────────────────────────────────────────

export interface BrowserInfo extends BrowserInfoBase {
  dataDir: string;        // relative to ~/Library/Application Support/
  keychainService: string;
}

// ─── Browser Registry ───────────────────────────────────────────
// Hardcoded — NEVER interpolate user input into shell commands.

const BROWSER_REGISTRY: BrowserInfo[] = [
  { name: 'Comet',  dataDir: 'Comet/',                       keychainService: 'Comet Safe Storage',          aliases: ['comet', 'perplexity'] },
  { name: 'Chrome', dataDir: 'Google/Chrome/',                keychainService: 'Chrome Safe Storage',         aliases: ['chrome', 'google-chrome'] },
  { name: 'Arc',    dataDir: 'Arc/User Data/',                keychainService: 'Arc Safe Storage',            aliases: ['arc'] },
  { name: 'Brave',  dataDir: 'BraveSoftware/Brave-Browser/',  keychainService: 'Brave Safe Storage',          aliases: ['brave'] },
  { name: 'Edge',   dataDir: 'Microsoft Edge/',               keychainService: 'Microsoft Edge Safe Storage', aliases: ['edge'] },
];

// ─── Key Cache ──────────────────────────────────────────────────

const keyCache = new Map<string, Buffer>();

// ─── Public API ─────────────────────────────────────────────────

export function findInstalledBrowsers(): BrowserInfo[] {
  const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
  return BROWSER_REGISTRY.filter(b => {
    const cookiesPath = path.join(appSupport, b.dataDir, 'Default', 'Cookies');
    const networkCookiesPath = path.join(appSupport, b.dataDir, 'Default', 'Network', 'Cookies');
    try { return fs.existsSync(networkCookiesPath) || fs.existsSync(cookiesPath); } catch { return false; }
  });
}

export function listDomains(browserName: string, profile = 'Default'): { domains: DomainEntry[]; browser: string } {
  if (!Database) throw new CookieImportError('Cookie import from browser databases requires Bun runtime (bun:sqlite). This feature is not available when running under Node.js on Windows.', 'unsupported_platform');
  const browser = resolveBrowser(browserName);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDbWithCopy(dbPath, browser.name, Database);
  try {
    const now = chromiumNow();
    const rows = db.query(
      `SELECT host_key AS domain, COUNT(*) AS count
       FROM cookies
       WHERE has_expires = 0 OR expires_utc > ?
       GROUP BY host_key
       ORDER BY count DESC`
    ).all(now) as DomainEntry[];
    return { domains: rows, browser: browser.name };
  } finally {
    db.close();
  }
}

export async function importCookies(
  browserName: string,
  domains: string[],
  profile = 'Default',
): Promise<ImportResult> {
  if (domains.length === 0) return { cookies: [], count: 0, failed: 0, domainCounts: {} };

  const browser = resolveBrowser(browserName);
  const derivedKey = await getDerivedKey(browser);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDbWithCopy(dbPath, browser.name, Database);

  try {
    const now = chromiumNow();
    const placeholders = domains.map(() => '?').join(',');
    const rows = db.query(
      `SELECT host_key, name, value, encrypted_value, path, expires_utc,
              is_secure, is_httponly, has_expires, samesite
       FROM cookies
       WHERE host_key IN (${placeholders})
         AND (has_expires = 0 OR expires_utc > ?)
       ORDER BY host_key, name`
    ).all(...domains, now) as RawCookie[];

    const cookies: PlaywrightCookie[] = [];
    let failed = 0;
    const domainCounts: Record<string, number> = {};

    for (const row of rows) {
      try {
        const value = decryptCookieValue(row, derivedKey);
        const cookie = toPlaywrightCookie(row, value);
        cookies.push(cookie);
        domainCounts[row.host_key] = (domainCounts[row.host_key] || 0) + 1;
      } catch {
        failed++;
      }
    }

    return { cookies, count: cookies.length, failed, domainCounts };
  } finally {
    db.close();
  }
}

// ─── Internal: Browser Resolution ───────────────────────────────

function resolveBrowser(nameOrAlias: string): BrowserInfo {
  const needle = nameOrAlias.toLowerCase().trim();
  const found = BROWSER_REGISTRY.find(b =>
    b.aliases.includes(needle) || b.name.toLowerCase() === needle
  );
  if (!found) {
    const supported = BROWSER_REGISTRY.flatMap(b => b.aliases).join(', ');
    throw new CookieImportError(
      `Unknown browser '${nameOrAlias}'. Supported: ${supported}`,
      'unknown_browser',
    );
  }
  return found;
}

function getCookieDbPath(browser: BrowserInfo, profile: string): string {
  validateProfile(profile);
  const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
  // Chrome 96+ moved cookies to Network/Cookies
  const networkPath = path.join(appSupport, browser.dataDir, profile, 'Network', 'Cookies');
  if (fs.existsSync(networkPath)) return networkPath;
  const dbPath = path.join(appSupport, browser.dataDir, profile, 'Cookies');
  if (!fs.existsSync(dbPath)) {
    throw new CookieImportError(
      `${browser.name} is not installed (no cookie database at ${dbPath})`,
      'not_installed',
    );
  }
  return dbPath;
}

// ─── Internal: Keychain Access (async, 10s timeout) ─────────────

async function getDerivedKey(browser: BrowserInfo): Promise<Buffer> {
  const cached = keyCache.get(browser.keychainService);
  if (cached) return cached;

  const password = await getKeychainPassword(browser.keychainService);
  const derived = crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  keyCache.set(browser.keychainService, derived);
  return derived;
}

async function getKeychainPassword(service: string): Promise<string> {
  const proc = Bun.spawn(
    ['security', 'find-generic-password', '-s', service, '-w'],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      proc.kill();
      reject(new CookieImportError(
        `macOS is waiting for Keychain permission. Look for a dialog asking to allow access to "${service}".`,
        'keychain_timeout',
        'retry',
      ));
    }, 10_000),
  );

  try {
    const exitCode = await Promise.race([proc.exited, timeout]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      const errText = stderr.trim().toLowerCase();
      if (errText.includes('user canceled') || errText.includes('denied') || errText.includes('interaction not allowed')) {
        throw new CookieImportError(
          `Keychain access denied. Click "Allow" in the macOS dialog for "${service}".`,
          'keychain_denied',
          'retry',
        );
      }
      if (errText.includes('could not be found') || errText.includes('not found')) {
        throw new CookieImportError(
          `No Keychain entry for "${service}". Is this a Chromium-based browser?`,
          'keychain_not_found',
        );
      }
      throw new CookieImportError(
        `Could not read Keychain: ${stderr.trim()}`,
        'keychain_error',
        'retry',
      );
    }

    return stdout.trim();
  } catch (err) {
    if (err instanceof CookieImportError) throw err;
    throw new CookieImportError(
      `Could not read Keychain: ${(err as Error).message}`,
      'keychain_error',
      'retry',
    );
  }
}

// ─── Internal: Cookie Decryption ────────────────────────────────

function decryptCookieValue(row: RawCookie, key: Buffer): string {
  if (row.value && row.value.length > 0) return row.value;

  const ev = Buffer.from(row.encrypted_value);
  if (ev.length === 0) return '';

  const prefix = ev.slice(0, 3).toString('utf-8');
  if (prefix !== 'v10') {
    throw new Error(`Unknown encryption prefix: ${prefix}`);
  }

  const ciphertext = ev.slice(3);
  const iv = Buffer.alloc(16, 0x20);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  if (plaintext.length <= 32) return '';
  return plaintext.slice(32).toString('utf-8');
}
