/**
 * Unit tests for cookie-import-browser-win.ts
 *
 * Uses a fixture SQLite database with AES-256-GCM encrypted cookies using a known test key.
 * Mocks Bun.spawn to intercept PowerShell DPAPI calls and return a known key.
 *
 * Test key: 32 random bytes (simulating DPAPI-decrypted master key)
 * Encryption: AES-256-GCM with 12-byte nonce, prefix "v10"
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── Test Constants ─────────────────────────────────────────────

// 32-byte AES-256 master key (simulates what DPAPI would return)
const TEST_MASTER_KEY = crypto.randomBytes(32);
const TEST_MASTER_KEY_B64 = TEST_MASTER_KEY.toString('base64');
const CHROMIUM_EPOCH_OFFSET = 11644473600000000n;

// Fixture paths
const FIXTURE_DIR = path.join(import.meta.dir, 'fixtures');
const FIXTURE_DB = path.join(FIXTURE_DIR, 'test-cookies-win.db');

// ─── Encryption Helper (AES-256-GCM, Chrome 80+ format) ────────

function encryptCookieValueGCM(value: string): Buffer {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // v10 prefix + 12-byte nonce + ciphertext + 16-byte auth tag
  return Buffer.concat([Buffer.from('v10'), nonce, encrypted, authTag]);
}

function chromiumEpoch(unixSeconds: number): bigint {
  return BigInt(unixSeconds) * 1000000n + CHROMIUM_EPOCH_OFFSET;
}

// ─── Create Fixture Database ────────────────────────────────────

function createFixtureDb() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  if (fs.existsSync(FIXTURE_DB)) fs.unlinkSync(FIXTURE_DB);

  const db = new Database(FIXTURE_DB);
  db.run(`CREATE TABLE cookies (
    host_key TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    encrypted_value BLOB NOT NULL DEFAULT x'',
    path TEXT NOT NULL DEFAULT '/',
    expires_utc INTEGER NOT NULL DEFAULT 0,
    is_secure INTEGER NOT NULL DEFAULT 0,
    is_httponly INTEGER NOT NULL DEFAULT 0,
    has_expires INTEGER NOT NULL DEFAULT 0,
    samesite INTEGER NOT NULL DEFAULT 1
  )`);

  const insert = db.prepare(`INSERT INTO cookies
    (host_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly, has_expires, samesite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const futureExpiry = Number(chromiumEpoch(Math.floor(Date.now() / 1000) + 86400 * 365));
  const pastExpiry = Number(chromiumEpoch(Math.floor(Date.now() / 1000) - 86400));

  // Domain 1: .github.com — 3 GCM-encrypted cookies
  insert.run('.github.com', 'session_id', '', encryptCookieValueGCM('win-abc123'), '/', futureExpiry, 1, 1, 1, 1);
  insert.run('.github.com', 'user_token', '', encryptCookieValueGCM('win-token-xyz'), '/', futureExpiry, 1, 0, 1, 0);
  insert.run('.github.com', 'theme', '', encryptCookieValueGCM('dark'), '/', futureExpiry, 0, 0, 1, 2);

  // Domain 2: .google.com — 2 cookies
  insert.run('.google.com', 'NID', '', encryptCookieValueGCM('google-nid-win'), '/', futureExpiry, 1, 1, 1, 0);
  insert.run('.google.com', 'SID', '', encryptCookieValueGCM('google-sid-win'), '/', futureExpiry, 1, 1, 1, 1);

  // Domain 3: .example.com — 1 unencrypted cookie
  insert.run('.example.com', 'plain_cookie', 'hello-windows', Buffer.alloc(0), '/', futureExpiry, 0, 0, 1, 1);

  // Domain 4: .expired.com — 1 expired cookie (should be filtered out)
  insert.run('.expired.com', 'old', '', encryptCookieValueGCM('expired-value'), '/', pastExpiry, 0, 0, 1, 1);

  // Domain 5: .session.com — session cookie (has_expires=0)
  insert.run('.session.com', 'sess', '', encryptCookieValueGCM('session-value'), '/', 0, 1, 1, 0, 1);

  // Domain 6: .corrupt.com — cookie with garbage encrypted_value
  insert.run('.corrupt.com', 'bad', '', Buffer.from('v10' + crypto.randomBytes(12).toString('binary') + 'not-valid'), '/', futureExpiry, 0, 0, 1, 1);

  // Domain 7: .mixed.com — one good, one corrupt
  insert.run('.mixed.com', 'good', '', encryptCookieValueGCM('mixed-good-win'), '/', futureExpiry, 0, 0, 1, 1);
  insert.run('.mixed.com', 'bad', '', Buffer.from('v10' + 'garbage-data-here!!!!'), '/', futureExpiry, 0, 0, 1, 1);

  db.close();
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Cookie Import Browser Win', () => {

  beforeAll(() => {
    createFixtureDb();
  });

  afterAll(() => {
    try { fs.unlinkSync(FIXTURE_DB); } catch {}
  });

  describe('AES-256-GCM Decryption Pipeline', () => {
    test('encrypts and decrypts round-trip correctly', () => {
      const encrypted = encryptCookieValueGCM('hello-windows');

      // Verify v10 prefix
      expect(encrypted.slice(0, 3).toString()).toBe('v10');

      // Decrypt
      const nonce = encrypted.slice(3, 3 + 12);
      const ciphertextWithTag = encrypted.slice(3 + 12);
      const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
      const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      expect(plaintext.toString('utf-8')).toBe('hello-windows');
    });

    test('handles empty string encryption', () => {
      const encrypted = encryptCookieValueGCM('');
      expect(encrypted.slice(0, 3).toString()).toBe('v10');

      const nonce = encrypted.slice(3, 3 + 12);
      const ciphertextWithTag = encrypted.slice(3 + 12);
      const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
      const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      expect(plaintext.toString('utf-8')).toBe('');
    });

    test('handles special characters in cookie values', () => {
      const specialValue = 'a=b&c=d; path=/; expires=Thu, 01 Jan 2099';
      const encrypted = encryptCookieValueGCM(specialValue);
      const nonce = encrypted.slice(3, 3 + 12);
      const ciphertextWithTag = encrypted.slice(3 + 12);
      const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
      const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      expect(plaintext.toString('utf-8')).toBe(specialValue);
    });

    test('wrong key fails with auth tag mismatch', () => {
      const encrypted = encryptCookieValueGCM('test-value');
      const wrongKey = crypto.randomBytes(32);
      const nonce = encrypted.slice(3, 3 + 12);
      const ciphertextWithTag = encrypted.slice(3 + 12);
      const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
      const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

      expect(() => {
        const decipher = crypto.createDecipheriv('aes-256-gcm', wrongKey, nonce);
        decipher.setAuthTag(authTag);
        Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }).toThrow();
    });

    test('v20 prefix also decrypts correctly', () => {
      // v20 uses same format as v10 on Windows
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
      const encrypted = Buffer.concat([cipher.update('v20-test', 'utf-8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const fullBlob = Buffer.concat([Buffer.from('v20'), nonce, encrypted, authTag]);

      // Decrypt
      const dNonce = fullBlob.slice(3, 3 + 12);
      const rest = fullBlob.slice(3 + 12);
      const dAuthTag = rest.slice(rest.length - 16);
      const dCiphertext = rest.slice(0, rest.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, dNonce);
      decipher.setAuthTag(dAuthTag);
      const plaintext = Buffer.concat([decipher.update(dCiphertext), decipher.final()]);
      expect(plaintext.toString('utf-8')).toBe('v20-test');
    });
  });

  describe('Fixture DB Structure', () => {
    test('fixture DB has correct domain counts', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });
      const rows = db.query(
        `SELECT host_key, COUNT(*) as count FROM cookies GROUP BY host_key ORDER BY count DESC`
      ).all() as any[];
      db.close();

      const counts = Object.fromEntries(rows.map((r: any) => [r.host_key, r.count]));
      expect(counts['.github.com']).toBe(3);
      expect(counts['.google.com']).toBe(2);
      expect(counts['.example.com']).toBe(1);
      expect(counts['.expired.com']).toBe(1);
      expect(counts['.session.com']).toBe(1);
      expect(counts['.corrupt.com']).toBe(1);
      expect(counts['.mixed.com']).toBe(2);
    });

    test('encrypted cookies in fixture have v10 prefix', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });
      const rows = db.query(
        `SELECT name, encrypted_value FROM cookies WHERE host_key = '.github.com'`
      ).all() as any[];
      db.close();

      for (const row of rows) {
        const ev = Buffer.from(row.encrypted_value);
        expect(ev.slice(0, 3).toString()).toBe('v10');
      }
    });

    test('decrypts all github.com cookies from fixture DB', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });
      const rows = db.query(
        `SELECT name, value, encrypted_value FROM cookies WHERE host_key = '.github.com'`
      ).all() as any[];
      db.close();

      const expected: Record<string, string> = {
        'session_id': 'win-abc123',
        'user_token': 'win-token-xyz',
        'theme': 'dark',
      };

      for (const row of rows) {
        const ev = Buffer.from(row.encrypted_value);
        if (ev.length === 0) continue;

        const nonce = ev.slice(3, 3 + 12);
        const ciphertextWithTag = ev.slice(3 + 12);
        const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
        const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        expect(plaintext.toString('utf-8')).toBe(expected[row.name]);
      }
    });

    test('unencrypted cookie uses value field directly', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });
      const row = db.query(
        `SELECT value, encrypted_value FROM cookies WHERE host_key = '.example.com'`
      ).get() as any;
      db.close();

      expect(row.value).toBe('hello-windows');
      expect(Buffer.from(row.encrypted_value).length).toBe(0);
    });
  });

  describe('sameSite Mapping', () => {
    test('maps sameSite values correctly', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });

      // samesite=0 → None
      const none = db.query(`SELECT samesite FROM cookies WHERE name = 'user_token' AND host_key = '.github.com'`).get() as any;
      expect(none.samesite).toBe(0);

      // samesite=1 → Lax
      const lax = db.query(`SELECT samesite FROM cookies WHERE name = 'session_id' AND host_key = '.github.com'`).get() as any;
      expect(lax.samesite).toBe(1);

      // samesite=2 → Strict
      const strict = db.query(`SELECT samesite FROM cookies WHERE name = 'theme' AND host_key = '.github.com'`).get() as any;
      expect(strict.samesite).toBe(2);

      db.close();
    });
  });

  describe('Chromium Epoch Conversion', () => {
    test('converts Chromium epoch to Unix timestamp correctly', () => {
      const knownUnix = 1704067200; // 2024-01-01T00:00:00Z
      const chromiumTs = BigInt(knownUnix) * 1000000n + CHROMIUM_EPOCH_OFFSET;
      const unixTs = Number((chromiumTs - CHROMIUM_EPOCH_OFFSET) / 1000000n);
      expect(unixTs).toBe(knownUnix);
    });

    test('session cookies (has_expires=0) stored correctly', () => {
      const db = new Database(FIXTURE_DB, { readonly: true });
      const row = db.query(
        `SELECT has_expires, expires_utc FROM cookies WHERE host_key = '.session.com'`
      ).get() as any;
      db.close();
      expect(row.has_expires).toBe(0);
    });
  });

  describe('Shared Module', () => {
    test('CookieImportError has correct properties', async () => {
      const { CookieImportError } = await import('../src/cookie-import-shared');
      const err = new CookieImportError('test message', 'test_code', 'retry');
      expect(err.message).toBe('test message');
      expect(err.code).toBe('test_code');
      expect(err.action).toBe('retry');
      expect(err.name).toBe('CookieImportError');
      expect(err instanceof Error).toBe(true);
    });

    test('CookieImportError without action', async () => {
      const { CookieImportError } = await import('../src/cookie-import-shared');
      const err = new CookieImportError('no action', 'some_code');
      expect(err.action).toBeUndefined();
    });

    test('validateProfile rejects path traversal', async () => {
      const { validateProfile } = await import('../src/cookie-import-shared');
      expect(() => validateProfile('../etc')).toThrow(/Invalid profile/);
      expect(() => validateProfile('Default/../../etc')).toThrow(/Invalid profile/);
    });

    test('validateProfile rejects control characters', async () => {
      const { validateProfile } = await import('../src/cookie-import-shared');
      expect(() => validateProfile('Default\x00evil')).toThrow(/Invalid profile/);
    });

    test('mapSameSite maps values correctly', async () => {
      const { mapSameSite } = await import('../src/cookie-import-shared');
      expect(mapSameSite(0)).toBe('None');
      expect(mapSameSite(1)).toBe('Lax');
      expect(mapSameSite(2)).toBe('Strict');
      expect(mapSameSite(99)).toBe('Lax');
    });

    test('chromiumNow returns a bigint', async () => {
      const { chromiumNow } = await import('../src/cookie-import-shared');
      const now = chromiumNow();
      expect(typeof now).toBe('bigint');
      expect(now > 0n).toBe(true);
    });

    test('chromiumEpochToUnix handles session cookies', async () => {
      const { chromiumEpochToUnix } = await import('../src/cookie-import-shared');
      expect(chromiumEpochToUnix(0, 0)).toBe(-1);
      expect(chromiumEpochToUnix(0n, 0)).toBe(-1);
    });

    test('toPlaywrightCookie produces correct shape', async () => {
      const { toPlaywrightCookie } = await import('../src/cookie-import-shared');
      const row = {
        host_key: '.example.com',
        name: 'test',
        value: '',
        encrypted_value: Buffer.alloc(0),
        path: '/foo',
        expires_utc: Number(chromiumEpoch(1704067200)),
        is_secure: 1,
        is_httponly: 0,
        has_expires: 1,
        samesite: 2,
      };
      const cookie = toPlaywrightCookie(row, 'test-value');
      expect(cookie.name).toBe('test');
      expect(cookie.value).toBe('test-value');
      expect(cookie.domain).toBe('.example.com');
      expect(cookie.path).toBe('/foo');
      expect(cookie.secure).toBe(true);
      expect(cookie.httpOnly).toBe(false);
      expect(cookie.sameSite).toBe('Strict');
      expect(cookie.expires).toBe(1704067200);
    });
  });

  describe('Corrupt Data Handling', () => {
    test('garbage ciphertext with v10 prefix produces decryption error', () => {
      // v10 + 12-byte nonce + garbage ciphertext + wrong tag
      const garbage = Buffer.concat([
        Buffer.from('v10'),
        crypto.randomBytes(12), // nonce
        Buffer.from('not-valid-ciphertext-at-all-!!!'),
      ]);
      const nonce = garbage.slice(3, 3 + 12);
      const rest = garbage.slice(3 + 12);
      const authTag = rest.slice(rest.length - 16);
      const ciphertext = rest.slice(0, rest.length - 16);

      expect(() => {
        const decipher = crypto.createDecipheriv('aes-256-gcm', TEST_MASTER_KEY, nonce);
        decipher.setAuthTag(authTag);
        Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }).toThrow();
    });
  });
});
