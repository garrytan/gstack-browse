/**
 * Chromium browser cookie import — read and decrypt cookies from real browsers
 *
 * Cross-platform support for macOS and Linux Chromium-based browsers.
 * Pure logic module — no Playwright dependency, no HTTP concerns.
 *
 * Decryption pipeline:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ macOS:                                                          │
 *   │   Password: `security find-generic-password -s "<svc>" -w`     │
 *   │   PBKDF2: iter=1003, salt="saltysalt", len=16, sha1            │
 *   │   Prefix: "v10" only                                           │
 *   │                                                                  │
 *   │ Linux:                                                          │
 *   │   Password (v11): GNOME Keyring via python3 gi.repository       │
 *   │   Password (v10): hardcoded "peanuts"                           │
 *   │   PBKDF2: iter=1, salt="saltysalt", len=16, sha1               │
 *   │                                                                  │
 *   │ Common:                                                         │
 *   │   AES-128-CBC, IV = 16 × 0x20 (space)                          │
 *   │   Skip first 32 bytes of plaintext (auth tag)                   │
 *   │   Chromium epoch: µs since 1601-01-01                           │
 *   │   sameSite: 0→"None", 1→"Lax", 2→"Strict", else→"Lax"        │
 *   └──────────────────────────────────────────────────────────────────┘
 */

import { Database } from 'bun:sqlite';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Platform Detection ─────────────────────────────────────────

const IS_MACOS = os.platform() === 'darwin';
const IS_LINUX = os.platform() === 'linux';

// ─── Types ──────────────────────────────────────────────────────

export interface BrowserInfo {
  name: string;
  dataDir: string;   // relative to platform config dir
  secretId: string;  // macOS: Keychain service name, Linux: keyring app name
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

const MACOS_BROWSERS: BrowserInfo[] = [
  { name: 'Comet',  dataDir: 'Comet/',                       secretId: 'Comet Safe Storage',          aliases: ['comet', 'perplexity'] },
  { name: 'Chrome', dataDir: 'Google/Chrome/',                secretId: 'Chrome Safe Storage',         aliases: ['chrome', 'google-chrome'] },
  { name: 'Arc',    dataDir: 'Arc/User Data/',                secretId: 'Arc Safe Storage',            aliases: ['arc'] },
  { name: 'Brave',  dataDir: 'BraveSoftware/Brave-Browser/',  secretId: 'Brave Safe Storage',          aliases: ['brave'] },
  { name: 'Edge',   dataDir: 'Microsoft Edge/',               secretId: 'Microsoft Edge Safe Storage', aliases: ['edge'] },
];

const LINUX_BROWSERS: BrowserInfo[] = [
  { name: 'Chrome',   dataDir: 'google-chrome/',                secretId: 'chrome',   aliases: ['chrome', 'google-chrome'] },
  { name: 'Chromium', dataDir: 'chromium/',                     secretId: 'chromium', aliases: ['chromium'] },
  { name: 'Brave',    dataDir: 'BraveSoftware/Brave-Browser/',  secretId: 'brave',    aliases: ['brave'] },
  { name: 'Edge',     dataDir: 'microsoft-edge/',               secretId: 'edge',     aliases: ['edge'] },
];

const BROWSER_REGISTRY: BrowserInfo[] = IS_MACOS ? MACOS_BROWSERS : LINUX_BROWSERS;

// ─── Platform Helpers ───────────────────────────────────────────

function getConfigBaseDir(): string {
  if (IS_MACOS) return path.join(os.homedir(), 'Library', 'Application Support');
  return path.join(os.homedir(), '.config');
}

/** macOS uses 1003 iterations; Linux uses 1 */
function getPbkdf2Iterations(): number {
  return IS_MACOS ? 1003 : 1;
}

/** Command to open a URL in the user's default browser */
export function getOpenCommand(): string {
  return IS_MACOS ? 'open' : 'xdg-open';
}

/** Sensible default browser name per platform */
export function getDefaultBrowser(): string {
  return IS_MACOS ? 'comet' : 'chrome';
}

// ─── Key Cache ──────────────────────────────────────────────────

interface DerivedKeys {
  v10: Buffer;         // macOS: Keychain key; Linux: hardcoded "peanuts" key
  v11: Buffer | null;  // Linux only: keyring key; null on macOS
}

const keyCache = new Map<string, DerivedKeys>();

// ─── Public API ─────────────────────────────────────────────────

/**
 * Find which browsers are installed (have a cookie DB on disk).
 */
export function findInstalledBrowsers(): BrowserInfo[] {
  const baseDir = getConfigBaseDir();
  return BROWSER_REGISTRY.filter(b => {
    const dbPath = path.join(baseDir, b.dataDir, 'Default', 'Cookies');
    try { return fs.existsSync(dbPath); } catch { return false; }
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
  const keys = await getDerivedKeys(browser);
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

function resolveBrowser(nameOrAlias: string): BrowserInfo {
  const needle = nameOrAlias.toLowerCase().trim();
  const found = BROWSER_REGISTRY.find(b =>
    b.aliases.includes(needle) || b.name.toLowerCase() === needle
  );
  if (!found) {
    const supported = BROWSER_REGISTRY.map(b => b.name).join(', ');
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
  const baseDir = getConfigBaseDir();
  const dbPath = path.join(baseDir, browser.dataDir, profile, 'Cookies');
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
    if (err.message?.includes('SQLITE_BUSY') || err.message?.includes('database is locked')) {
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
  const tmpPath = `/tmp/browse-cookies-${browserName.toLowerCase()}-${crypto.randomUUID()}.db`;
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

// ─── Internal: Secret Retrieval ─────────────────────────────────

function deriveKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, 'saltysalt', getPbkdf2Iterations(), 16, 'sha1');
}

async function getDerivedKeys(browser: BrowserInfo): Promise<DerivedKeys> {
  const cached = keyCache.get(browser.secretId);
  if (cached) return cached;

  if (IS_MACOS) {
    // macOS: single key from Keychain (used for v10 prefix)
    const password = await getMacOSKeychainPassword(browser.secretId);
    const keys: DerivedKeys = { v10: deriveKey(password), v11: null };
    keyCache.set(browser.secretId, keys);
    return keys;
  }

  // Linux: v10 from hardcoded password, v11 from GNOME Keyring
  const v10 = deriveKey('peanuts');
  let v11: Buffer | null = null;
  try {
    const keyringPassword = await getLinuxKeyringPassword(browser.secretId);
    if (keyringPassword) {
      v11 = deriveKey(keyringPassword);
    }
  } catch {
    // No keyring available — v11 cookies will fail individually
  }

  const keys: DerivedKeys = { v10, v11 };
  keyCache.set(browser.secretId, keys);
  return keys;
}

// ─── macOS: Keychain Access ─────────────────────────────────────

async function getMacOSKeychainPassword(service: string): Promise<string> {
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

// ─── Linux: GNOME Keyring Access ────────────────────────────────

async function getLinuxKeyringPassword(appName: string): Promise<string | null> {
  // Use python3 + gi (GObject Introspection) to read from GNOME Keyring.
  // gir1.2-secret-1 is pre-installed on GNOME desktops (provides libsecret bindings).
  // appName comes from BROWSER_REGISTRY, not user input — safe to interpolate.
  const script = [
    'import gi',
    "gi.require_version('Secret','1')",
    'from gi.repository import Secret',
    "s=Secret.Schema.new('chrome_libsecret_os_crypt_password_v2',Secret.SchemaFlags.NONE,{'application':Secret.SchemaAttributeType.STRING})",
    `p=Secret.password_lookup_sync(s,{'application':'${appName}'},None)`,
    'print(p or "")',
  ].join(';');

  const proc = Bun.spawn(
    ['python3', '-c', script],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      proc.kill();
      reject(new CookieImportError(
        `Timed out reading keyring for "${appName}". Is gnome-keyring-daemon running?`,
        'keyring_timeout',
        'retry',
      ));
    }, 10_000),
  );

  try {
    const exitCode = await Promise.race([proc.exited, timeout]);
    const stdout = await new Response(proc.stdout).text();

    if (exitCode !== 0) {
      return null;
    }

    const password = stdout.trim();
    return password.length > 0 ? password : null;
  } catch (err) {
    if (err instanceof CookieImportError) throw err;
    return null;
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

function decryptCookieValue(row: RawCookie, keys: DerivedKeys): string {
  // Prefer unencrypted value if present
  if (row.value && row.value.length > 0) return row.value;

  const ev = Buffer.from(row.encrypted_value);
  if (ev.length === 0) return '';

  const prefix = ev.slice(0, 3).toString('utf-8');

  let key: Buffer;
  if (prefix === 'v11') {
    // Linux keyring-encrypted cookie
    if (!keys.v11) {
      throw new Error('v11 cookie but no keyring password available');
    }
    key = keys.v11;
  } else if (prefix === 'v10') {
    // macOS Keychain or Linux hardcoded "peanuts"
    key = keys.v10;
  } else {
    throw new Error(`Unknown encryption prefix: ${prefix}`);
  }

  const ciphertext = ev.slice(3);
  const iv = Buffer.alloc(16, 0x20); // 16 space characters
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // First 32 bytes are an authentication tag; actual value follows
  if (plaintext.length <= 32) return '';
  return plaintext.slice(32).toString('utf-8');
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
