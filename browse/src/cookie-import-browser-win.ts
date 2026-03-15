/**
 * Chromium browser cookie import — Windows
 *
 * Supports Windows Chromium-based browsers: Chrome, Edge, Brave.
 * Pure logic module — no Playwright dependency, no HTTP concerns.
 *
 * Decryption pipeline (Windows AES-256-GCM, Chrome 80+):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ 1. Read Local State JSON → os_crypt.encrypted_key (base64)      │
 *   │ 2. Base64 decode → strip "DPAPI" prefix (5 bytes)               │
 *   │ 3. PowerShell ProtectedData.Unprotect() → 32-byte AES key       │
 *   │ 4. Cache key in Map<browser, Buffer>                             │
 *   │ 5. For each cookie:                                              │
 *   │    - v10/v20 prefix: nonce=bytes[3:15], cipher=rest, GCM tag     │
 *   │      AES-256-GCM(masterKey, nonce, ciphertext) → plaintext       │
 *   │    - no prefix: DPAPI direct decrypt (pre-Chrome 80)             │
 *   │    - empty encrypted + value: use plaintext                      │
 *   │                                                                  │
 *   │ 6. Chromium epoch: microseconds since 1601-01-01                 │
 *   │    Unix seconds = (epoch - 11644473600000000) / 1000000          │
 *   │                                                                  │
 *   │ 7. sameSite: 0→"None", 1→"Lax", 2→"Strict", else→"Lax"         │
 *   └──────────────────────────────────────────────────────────────────┘
 */

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

// ─── Types ──────────────────────────────────────────────────────

export interface BrowserInfoWin extends BrowserInfoBase {
  dataDir: string; // relative to %LOCALAPPDATA%
}

// ─── Browser Registry ───────────────────────────────────────────

const BROWSER_REGISTRY_WIN: BrowserInfoWin[] = [
  { name: 'Chrome', dataDir: 'Google\\Chrome\\User Data',            aliases: ['chrome', 'google-chrome'] },
  { name: 'Edge',   dataDir: 'Microsoft\\Edge\\User Data',           aliases: ['edge'] },
  { name: 'Brave',  dataDir: 'BraveSoftware\\Brave-Browser\\User Data', aliases: ['brave'] },
];

// ─── Key Cache ──────────────────────────────────────────────────

interface BrowserKeys {
  v10Key: Buffer;       // Regular DPAPI-derived key (Chrome < 127)
  v20Key: Buffer | null; // App-Bound key (Chrome 127+), null if unavailable
}

const keyCache = new Map<string, BrowserKeys>();

// ─── SQLite (better-sqlite3) ────────────────────────────────────

let Database: any;

async function getDatabase(): Promise<any> {
  if (Database) return Database;
  try {
    // Dynamic import works in both Bun and Node.js ESM
    const mod = await import('better-sqlite3');
    Database = mod.default || mod;
  } catch {
    throw new CookieImportError(
      'Cookie import requires the better-sqlite3 package. Run: npm install better-sqlite3',
      'missing_dependency',
    );
  }
  return Database;
}

// ─── Public API ─────────────────────────────────────────────────

export function findInstalledBrowsersWin(): BrowserInfoWin[] {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];
  return BROWSER_REGISTRY_WIN.filter(b => {
    const cookiesPath = path.join(localAppData, b.dataDir, 'Default', 'Network', 'Cookies');
    const legacyPath = path.join(localAppData, b.dataDir, 'Default', 'Cookies');
    try { return fs.existsSync(cookiesPath) || fs.existsSync(legacyPath); } catch { return false; }
  });
}

export async function listDomainsWin(browserName: string, profile = 'Default'): Promise<{ domains: DomainEntry[]; browser: string }> {
  const Db = await getDatabase();
  const browser = resolveBrowser(browserName);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDbWithCopy(dbPath, browser.name, Db, { readonly: true, fileMustExist: true });
  try {
    const now = chromiumNow();
    const rows = db.prepare(
      `SELECT host_key AS domain, COUNT(*) AS count
       FROM cookies
       WHERE has_expires = 0 OR expires_utc > ?
       GROUP BY host_key
       ORDER BY count DESC`
    ).all(now.toString()) as DomainEntry[];
    return { domains: rows, browser: browser.name };
  } finally {
    db.close();
  }
}

export async function importCookiesWin(
  browserName: string,
  domains: string[],
  profile = 'Default',
): Promise<ImportResult> {
  if (domains.length === 0) return { cookies: [], count: 0, failed: 0, domainCounts: {} };

  const Db = await getDatabase();
  const browser = resolveBrowser(browserName);
  const keys = await getBrowserKeys(browser);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDbWithCopy(dbPath, browser.name, Db, { readonly: true, fileMustExist: true });

  try {
    const now = chromiumNow();
    const placeholders = domains.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT host_key, name, value, encrypted_value, path, expires_utc,
              is_secure, is_httponly, has_expires, samesite
       FROM cookies
       WHERE host_key IN (${placeholders})
         AND (has_expires = 0 OR expires_utc > ?)
       ORDER BY host_key, name`
    ).all(...domains, now.toString()) as RawCookie[];

    const cookies: PlaywrightCookie[] = [];
    let failed = 0;
    const domainCounts: Record<string, number> = {};

    for (const row of rows) {
      try {
        const value = decryptCookieValue(row, keys);
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

function resolveBrowser(nameOrAlias: string): BrowserInfoWin {
  const needle = nameOrAlias.toLowerCase().trim();
  const found = BROWSER_REGISTRY_WIN.find(b =>
    b.aliases.includes(needle) || b.name.toLowerCase() === needle
  );
  if (!found) {
    const supported = BROWSER_REGISTRY_WIN.flatMap(b => b.aliases).join(', ');
    throw new CookieImportError(
      `Unknown browser '${nameOrAlias}'. Supported on Windows: ${supported}`,
      'unknown_browser',
    );
  }
  return found;
}

function getCookieDbPath(browser: BrowserInfoWin, profile: string): string {
  validateProfile(profile);
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new CookieImportError(
      'LOCALAPPDATA environment variable not set',
      'env_error',
    );
  }
  // Chrome 96+ moved cookies to Network/Cookies
  const networkPath = path.join(localAppData, browser.dataDir, profile, 'Network', 'Cookies');
  if (fs.existsSync(networkPath)) return networkPath;
  const dbPath = path.join(localAppData, browser.dataDir, profile, 'Cookies');
  if (!fs.existsSync(dbPath)) {
    throw new CookieImportError(
      `${browser.name} is not installed (no cookie database at ${dbPath})`,
      'not_installed',
    );
  }
  return dbPath;
}

// ─── Internal: DPAPI Master Key ─────────────────────────────────

async function getBrowserKeys(browser: BrowserInfoWin): Promise<BrowserKeys> {
  const cacheKey = browser.name;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new CookieImportError('LOCALAPPDATA environment variable not set', 'env_error');
  }

  const localStatePath = path.join(localAppData, browser.dataDir, 'Local State');
  if (!fs.existsSync(localStatePath)) {
    throw new CookieImportError(
      `${browser.name} Local State file not found at ${localStatePath}`,
      'not_installed',
    );
  }

  let localState: any;
  try {
    localState = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'));
  } catch (err: any) {
    throw new CookieImportError(
      `Failed to read ${browser.name} Local State: ${err.message}`,
      'local_state_error',
    );
  }

  // v10 key: DPAPI-encrypted key from os_crypt.encrypted_key
  const encryptedKeyB64 = localState.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) {
    throw new CookieImportError(
      `os_crypt.encrypted_key not found in ${browser.name} Local State`,
      'local_state_error',
    );
  }

  const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');
  if (encryptedKey.slice(0, 5).toString('utf-8') !== 'DPAPI') {
    throw new CookieImportError(
      `Unexpected key prefix in encrypted_key`,
      'key_format_error',
    );
  }
  const v10Key = dpapiDecrypt(encryptedKey.slice(5));

  // v20 key: App-Bound Encryption (Chrome/Edge 127+)
  // The app_bound_encrypted_key is DPAPI-encrypted with LocalMachine scope + browser-specific
  // entropy, making it inaccessible to third-party tools. v20 cookies cannot be decrypted
  // without the browser's own IElevator COM service. v20Key stays null.
  const v20Key: Buffer | null = null;

  const keys: BrowserKeys = { v10Key, v20Key };
  keyCache.set(cacheKey, keys);
  return keys;
}

function dpapiDecrypt(encryptedData: Buffer): Buffer {
  const b64Input = encryptedData.toString('base64');

  // PowerShell one-liner: decode base64, DPAPI unprotect, output base64
  const psScript = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${b64Input}')
$decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($decrypted)
`.trim();

  const result = Bun.spawnSync(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', psScript],
    { timeout: 10_000 },
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr?.toString().trim() || 'unknown error';
    throw new CookieImportError(
      `DPAPI decryption failed: ${stderr}`,
      'dpapi_error',
      'retry',
    );
  }

  const stdout = result.stdout?.toString().trim();
  if (!stdout) {
    throw new CookieImportError('DPAPI decryption returned empty output', 'dpapi_error', 'retry');
  }

  return Buffer.from(stdout, 'base64');
}

// ─── Internal: Cookie Decryption ────────────────────────────────

function decryptCookieValue(row: RawCookie, keys: BrowserKeys): string {
  // Prefer unencrypted value if present
  if (row.value && row.value.length > 0) return row.value;

  const ev = Buffer.from(row.encrypted_value);
  if (ev.length === 0) return '';

  const prefix = ev.slice(0, 3).toString('utf-8');

  // v10/v20 prefix → AES-256-GCM (Chrome 80+)
  if (prefix === 'v10' || prefix === 'v20') {
    // v20 uses App-Bound Encryption (Chrome/Edge 127+) — not decryptable by third-party tools
    if (prefix === 'v20' && !keys.v20Key) {
      throw new Error('v20 cookies use App-Bound Encryption and cannot be decrypted externally');
    }
    const key = prefix === 'v20' ? keys.v20Key! : keys.v10Key;
    const nonce = ev.slice(3, 3 + 12); // 12-byte nonce
    const ciphertextWithTag = ev.slice(3 + 12);
    // Last 16 bytes are the GCM auth tag
    const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
    const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf-8');
  }

  // No recognized prefix → try DPAPI direct decrypt (pre-Chrome 80)
  return dpapiDecryptDirect(ev);
}

function dpapiDecryptDirect(encryptedData: Buffer): string {
  const b64Input = encryptedData.toString('base64');
  const psScript = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${b64Input}')
$decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.Text.Encoding]::UTF8.GetString($decrypted)
`.trim();

  const result = Bun.spawnSync(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', psScript],
    { timeout: 10_000 },
  );

  if (result.exitCode !== 0) {
    throw new Error('DPAPI direct decryption failed');
  }

  return result.stdout?.toString().trim() || '';
}
