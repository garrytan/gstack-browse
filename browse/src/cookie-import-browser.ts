/**
 * Chromium browser cookie import — read and decrypt cookies from real browsers
 *
 * Supports macOS and Windows Chromium-based browsers: Comet, Chrome, Arc, Brave, Edge.
 *
 * Decryption:
 *   macOS: Keychain + PBKDF2 + AES-128-CBC (v10 cookies)
 *   Windows: DPAPI + AES-256-GCM (v10 cookies)
 *   Windows v20 (App-Bound Encryption): NOT supported — use the console-script
 *   fallback in the picker UI instead.
 *
 * listDomains() reads host_key from SQLite (not encrypted, always works).
 * importCookies() decrypts cookie values; returns failed count for v20 cookies.
 */

import { Database } from 'bun:sqlite';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IS_WINDOWS, TEMP_DIR } from './platform';

// ─── Types ──────────────────────────────────────────────────────

export interface BrowserInfo {
  name: string;
  dataDir: string;          // relative to ~/Library/Application Support/
  windowsDataDir?: string;  // relative to %LOCALAPPDATA%/
  keychainService: string;
  aliases: string[];
}

export interface DomainEntry {
  domain: string;
  count: number;
}

export interface ImportResult {
  cookies: PlaywrightCookie[];
  count: number;
  failed: number;
  domainCounts: Record<string, number>;
}

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export class CookieImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public action?: 'retry',
  ) {
    super(message);
    this.name = 'CookieImportError';
  }
}

// ─── Browser Registry ───────────────────────────────────────────
// Hardcoded — NEVER interpolate user input into shell commands.

const BROWSER_REGISTRY: BrowserInfo[] = [
  { name: 'Comet',  dataDir: 'Comet/',                       windowsDataDir: 'Comet/User Data/',                       keychainService: 'Comet Safe Storage',          aliases: ['comet', 'perplexity'] },
  { name: 'Chrome', dataDir: 'Google/Chrome/',                windowsDataDir: 'Google/Chrome/User Data/',               keychainService: 'Chrome Safe Storage',         aliases: ['chrome', 'google-chrome'] },
  { name: 'Arc',    dataDir: 'Arc/User Data/',                windowsDataDir: 'Arc/User Data/',                         keychainService: 'Arc Safe Storage',            aliases: ['arc'] },
  { name: 'Brave',  dataDir: 'BraveSoftware/Brave-Browser/',  windowsDataDir: 'BraveSoftware/Brave-Browser/User Data/', keychainService: 'Brave Safe Storage',          aliases: ['brave'] },
  { name: 'Edge',   dataDir: 'Microsoft Edge/',               windowsDataDir: 'Microsoft/Edge/User Data/',              keychainService: 'Microsoft Edge Safe Storage', aliases: ['edge'] },
];

// ─── Key Cache ──────────────────────────────────────────────────
// Cache derived AES keys per browser. First import per browser does
// Keychain + PBKDF2. Subsequent imports reuse the cached key.

const keyCache = new Map<string, Buffer>();

// ─── Public API ─────────────────────────────────────────────────

/**
 * Resolve the User Data directory for a browser on the current platform.
 */
function getUserDataDir(browser: BrowserInfo): string {
  if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, browser.windowsDataDir || browser.dataDir);
  }
  return path.join(os.homedir(), 'Library', 'Application Support', browser.dataDir);
}

/**
 * Find which browsers are installed (have a cookie DB on disk).
 * Checks Default profile and any "Profile N" directories.
 */
export function findInstalledBrowsers(): BrowserInfo[] {
  return BROWSER_REGISTRY.filter(b => {
    const userDataDir = getUserDataDir(b);
    if (!fs.existsSync(userDataDir)) return false;
    // Check Default and any Profile directories
    const profiles = ['Default'];
    try {
      const entries = fs.readdirSync(userDataDir);
      for (const e of entries) {
        if (e.startsWith('Profile ')) profiles.push(e);
      }
    } catch { /* ignore */ }
    return profiles.some(profile => {
      const dbPath = path.join(userDataDir, profile, 'Cookies');
      const networkDbPath = path.join(userDataDir, profile, 'Network', 'Cookies');
      try { return fs.existsSync(dbPath) || fs.existsSync(networkDbPath); } catch { return false; }
    });
  });
}

/**
 * List unique cookie domains + counts from a browser's DB. No decryption.
 */
export function listDomains(browserName: string, profile = 'Default'): { domains: DomainEntry[]; browser: string } {
  const browser = resolveBrowser(browserName);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDb(dbPath, browser.name);
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

/**
 * Decrypt and return Playwright-compatible cookies for specific domains.
 */
export async function importCookies(
  browserName: string,
  domains: string[],
  profile = 'Default',
): Promise<ImportResult> {
  if (domains.length === 0) return { cookies: [], count: 0, failed: 0, domainCounts: {} };

  const browser = resolveBrowser(browserName);
  const derivedKey = await getDerivedKey(browser);
  const dbPath = getCookieDbPath(browser, profile);
  const db = openDb(dbPath, browser.name);

  try {
    const now = chromiumNow();
    // Parameterized query — no SQL injection
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

function validateProfile(profile: string): void {
  if (/[/\\]|\.\./.test(profile) || /[\x00-\x1f]/.test(profile)) {
    throw new CookieImportError(
      `Invalid profile name: '${profile}'`,
      'bad_request',
    );
  }
}

function getCookieDbPath(browser: BrowserInfo, profile: string): string {
  validateProfile(profile);
  const userDataDir = getUserDataDir(browser);
  // On newer Chromium (Windows), cookies live in <profile>/Network/Cookies
  const networkDbPath = path.join(userDataDir, profile, 'Network', 'Cookies');
  if (fs.existsSync(networkDbPath)) return networkDbPath;
  const dbPath = path.join(userDataDir, profile, 'Cookies');
  if (!fs.existsSync(dbPath)) {
    throw new CookieImportError(
      `${browser.name} is not installed (no cookie database at ${dbPath})`,
      'not_installed',
    );
  }
  return dbPath;
}

// ─── Internal: SQLite Access ────────────────────────────────────

function openDb(dbPath: string, browserName: string): Database {
  try {
    return new Database(dbPath, { readonly: true });
  } catch (err: any) {
    if (err.message?.includes('SQLITE_BUSY') || err.message?.includes('database is locked') || err.code === 'SQLITE_CANTOPEN') {
      return openDbFromCopy(dbPath, browserName);
    }
    if (err.message?.includes('SQLITE_CORRUPT') || err.message?.includes('malformed')) {
      throw new CookieImportError(
        `Cookie database for ${browserName} is corrupt`,
        'db_corrupt',
      );
    }
    throw err;
  }
}

function openDbFromCopy(dbPath: string, browserName: string): Database {
  const tmpPath = path.join(TEMP_DIR, `browse-cookies-${browserName.toLowerCase()}-${crypto.randomUUID()}.db`);
  try {
    fs.copyFileSync(dbPath, tmpPath);
    // Also copy WAL and SHM if they exist (for consistent reads)
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, tmpPath + '-wal');
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, tmpPath + '-shm');

    const db = new Database(tmpPath, { readonly: true });
    // Schedule cleanup after the DB is closed
    const origClose = db.close.bind(db);
    db.close = () => {
      origClose();
      try { fs.unlinkSync(tmpPath); } catch {}
      try { fs.unlinkSync(tmpPath + '-wal'); } catch {}
      try { fs.unlinkSync(tmpPath + '-shm'); } catch {}
    };
    return db;
  } catch {
    // Clean up on failure
    try { fs.unlinkSync(tmpPath); } catch {}
    throw new CookieImportError(
      `Cookie database is locked (${browserName} may be running). Try closing ${browserName} first.`,
      'db_locked',
      'retry',
    );
  }
}

// ─── Internal: Encryption Key Retrieval ──────────────────────────

async function getDerivedKey(browser: BrowserInfo): Promise<Buffer> {
  if (IS_WINDOWS) {
    const cacheKey = browser.windowsDataDir || browser.dataDir;
    const cached = keyCache.get(cacheKey);
    if (cached) return cached;
    const key = await getWindowsEncryptionKey(browser);
    keyCache.set(cacheKey, key);
    return key;
  }

  const cached = keyCache.get(browser.keychainService);
  if (cached) return cached;

  const password = await getKeychainPassword(browser.keychainService);
  const derived = crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  keyCache.set(browser.keychainService, derived);
  return derived;
}

// ─── Internal: Windows DPAPI Key Extraction ──────────────────────

async function getWindowsEncryptionKey(browser: BrowserInfo): Promise<Buffer> {
  const userDataDir = getUserDataDir(browser);
  const localStatePath = path.join(userDataDir, 'Local State');

  if (!fs.existsSync(localStatePath)) {
    throw new CookieImportError(
      `${browser.name} Local State not found at ${localStatePath}`,
      'not_installed',
    );
  }

  const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'));
  const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) {
    throw new CookieImportError(
      `No encryption key found in ${browser.name} Local State`,
      'key_not_found',
    );
  }

  // Base64 decode → strip 5-byte "DPAPI" prefix
  const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');
  const prefix = encryptedKey.slice(0, 5).toString('utf-8');
  if (prefix !== 'DPAPI') {
    throw new CookieImportError(
      `Unexpected key prefix "${prefix}" (expected "DPAPI")`,
      'key_format_error',
    );
  }
  const dpapiBlob = encryptedKey.slice(5);

  // Decrypt via PowerShell DPAPI (runs as current user — same user who encrypted)
  const b64Blob = dpapiBlob.toString('base64');
  const psScript = `
    Add-Type -AssemblyName System.Security
    $blob = [Convert]::FromBase64String('${b64Blob}')
    $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($blob, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Convert]::ToBase64String($decrypted)
  `.trim();

  const proc = Bun.spawn(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', psScript],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) =>
    timer = setTimeout(() => {
      proc.kill();
      reject(new CookieImportError(
        `DPAPI decryption timed out for ${browser.name}`,
        'dpapi_timeout',
        'retry',
      ));
    }, 10_000),
  );

  try {
    const exitCode = await Promise.race([proc.exited, timeout]);
    clearTimeout(timer!);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new CookieImportError(
        `DPAPI decryption failed for ${browser.name}: ${stderr.trim()}`,
        'dpapi_error',
        'retry',
      );
    }

    const decryptedKey = Buffer.from(stdout.trim(), 'base64');
    if (decryptedKey.length !== 32) {
      throw new CookieImportError(
        `Unexpected key length ${decryptedKey.length} (expected 32) for ${browser.name}`,
        'key_format_error',
      );
    }
    return decryptedKey;
  } catch (err) {
    if (err instanceof CookieImportError) throw err;
    throw new CookieImportError(
      `DPAPI decryption failed: ${(err as Error).message}`,
      'dpapi_error',
      'retry',
    );
  }
}

async function getKeychainPassword(service: string): Promise<string> {
  // Use async Bun.spawn with timeout to avoid blocking the event loop.
  // macOS may show an Allow/Deny dialog that blocks until the user responds.
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
      // Distinguish denied vs not found vs other
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

interface RawCookie {
  host_key: string;
  name: string;
  value: string;
  encrypted_value: Buffer | Uint8Array;
  path: string;
  expires_utc: number | bigint;
  is_secure: number;
  is_httponly: number;
  has_expires: number;
  samesite: number;
}

function decryptCookieValue(row: RawCookie, key: Buffer): string {
  // Prefer unencrypted value if present
  if (row.value && row.value.length > 0) return row.value;

  const ev = Buffer.from(row.encrypted_value);
  if (ev.length === 0) return '';

  const prefix = ev.slice(0, 3).toString('utf-8');

  if (IS_WINDOWS) {
    // Windows Chromium uses "v10" prefix + AES-256-GCM
    if (prefix !== 'v10') {
      throw new Error(prefix === 'v20'
        ? 'v20 App-Bound Encryption — use the console-script fallback in the picker UI'
        : `Unknown encryption prefix: ${prefix}`);
    }
    return decryptWindows(ev, key);
  }

  // macOS Chromium uses "v10" prefix + AES-128-CBC
  if (prefix !== 'v10') {
    throw new Error(`Unknown encryption prefix: ${prefix}`);
  }
  return decryptMacOS(ev, key);
}

function decryptMacOS(ev: Buffer, key: Buffer): string {
  const ciphertext = ev.slice(3);
  const iv = Buffer.alloc(16, 0x20); // 16 space characters
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // First 32 bytes are HMAC-SHA256 authentication tag; actual value follows
  if (plaintext.length <= 32) return '';
  return plaintext.slice(32).toString('utf-8');
}

function decryptWindows(ev: Buffer, key: Buffer): string {
  // Windows AES-256-GCM layout:
  // [0..2]   = "v10" prefix (3 bytes)
  // [3..14]  = nonce/IV (12 bytes)
  // [15..-17] = ciphertext
  // [-16..]  = GCM auth tag (16 bytes)
  // Minimum: 3 (prefix) + 12 (nonce) + 0 (empty ciphertext) + 16 (tag) = 31 bytes
  if (ev.length < 31) {
    throw new Error(`Encrypted value too short (${ev.length} bytes, need at least 31)`);
  }
  const nonce = ev.slice(3, 15);          // 12 bytes
  const authTag = ev.slice(ev.length - 16); // last 16 bytes
  const ciphertext = ev.slice(15, ev.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf-8');
}

function toPlaywrightCookie(row: RawCookie, value: string): PlaywrightCookie {
  return {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path || '/',
    expires: chromiumEpochToUnix(row.expires_utc, row.has_expires),
    secure: row.is_secure === 1,
    httpOnly: row.is_httponly === 1,
    sameSite: mapSameSite(row.samesite),
  };
}

// ─── Internal: Chromium Epoch Conversion ────────────────────────

const CHROMIUM_EPOCH_OFFSET = 11644473600000000n;

function chromiumNow(): bigint {
  // Current time in Chromium epoch (microseconds since 1601-01-01)
  return BigInt(Date.now()) * 1000n + CHROMIUM_EPOCH_OFFSET;
}

function chromiumEpochToUnix(epoch: number | bigint, hasExpires: number): number {
  if (hasExpires === 0 || epoch === 0 || epoch === 0n) return -1; // session cookie
  const epochBig = BigInt(epoch);
  const unixMicro = epochBig - CHROMIUM_EPOCH_OFFSET;
  return Number(unixMicro / 1000000n);
}

function mapSameSite(value: number): 'Strict' | 'Lax' | 'None' {
  switch (value) {
    case 0: return 'None';
    case 1: return 'Lax';
    case 2: return 'Strict';
    default: return 'Lax';
  }
}
