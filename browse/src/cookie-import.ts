/**
 * Platform dispatcher for cookie import.
 *
 * Routes to macOS (bun:sqlite + Keychain) or Windows (better-sqlite3 + DPAPI)
 * based on process.platform.
 */

import { CookieImportError } from './cookie-import-shared';
import type { DomainEntry, ImportResult, PlaywrightCookie } from './cookie-import-shared';

export { CookieImportError, type DomainEntry, type ImportResult, type PlaywrightCookie };

const IS_WINDOWS = process.platform === 'win32';

export async function findInstalledBrowsers() {
  if (IS_WINDOWS) {
    return (await import('./cookie-import-browser-win')).findInstalledBrowsersWin();
  }
  return (await import('./cookie-import-browser')).findInstalledBrowsers();
}

export async function listDomains(browserName: string, profile?: string) {
  if (IS_WINDOWS) {
    return (await import('./cookie-import-browser-win')).listDomainsWin(browserName, profile);
  }
  return (await import('./cookie-import-browser')).listDomains(browserName, profile);
}

export async function importCookies(browserName: string, domains: string[], profile?: string) {
  if (IS_WINDOWS) {
    return (await import('./cookie-import-browser-win')).importCookiesWin(browserName, domains, profile);
  }
  return (await import('./cookie-import-browser')).importCookies(browserName, domains, profile);
}
