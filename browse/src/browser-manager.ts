/**
 * Browser lifecycle manager
 *
 * Chromium crash handling:
 *   browser.on('disconnected') → log error → process.exit(1)
 *   CLI detects dead server → auto-restarts on next command
 *   We do NOT try to self-heal — don't hide failure.
 */

import { chromium, type Browser, type BrowserContext, type Page, type Locator } from 'playwright';
import { spawn, execSync, execFileSync, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { addConsoleEntry, addNetworkEntry, networkBuffer, type LogEntry, type NetworkEntry } from './buffers';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<number, Page> = new Map();
  private activeTabId: number = 0;
  private nextTabId: number = 1;
  private extraHeaders: Record<string, string> = {};
  private customUserAgent: string | null = null;
  private connectedExternally: boolean = false;
  private managedProcess: ChildProcess | null = null;

  // ─── Ref Map (snapshot → @e1, @e2, ...) ────────────────────
  private refMap: Map<string, Locator> = new Map();

  async launch() {
    const backend = process.env.BROWSE_BACKEND;
    let cdpEndpoint = process.env.BROWSE_CDP_ENDPOINT;

    if (backend === 'lightpanda') {
      cdpEndpoint = await this.startLightpanda();
    }

    if (cdpEndpoint) {
      this.browser = await chromium.connectOverCDP(cdpEndpoint);
      this.connectedExternally = true;
      console.log(`[browse] Connected to external CDP browser at ${cdpEndpoint}`);
    } else {
      this.browser = await chromium.launch({ headless: true });
    }

    this.browser.on('disconnected', () => {
      console.error('[browse] FATAL: Browser disconnected. Server exiting.');
      process.exit(1);
    });

    // CDP connections may already have a context
    const existingContexts = this.browser.contexts();
    if (existingContexts.length > 0) {
      this.context = existingContexts[0];
    } else {
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
    }

    await this.newTab();
  }

  async close() {
    if (this.browser) {
      this.browser.removeAllListeners('disconnected');
      if (this.connectedExternally) {
        console.log('[browse] Disconnecting from external CDP browser');
      }
      await this.browser.close();
      this.browser = null;
    }
    if (this.managedProcess) {
      this.managedProcess.kill();
      this.managedProcess = null;
    }
  }

  private ensureLightpanda(bin: string): string {
    // Explicit path provided — trust it
    if (process.env.BROWSE_LIGHTPANDA_PATH) return bin;

    // Already in PATH?
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {}

    // Check default install location (~/.local/bin)
    const installedBin = join(homedir(), '.local', 'bin', 'lightpanda');
    if (existsSync(installedBin)) return installedBin;

    // Auto-install via official installer
    console.log('[browse] Lightpanda not found — installing via pkg.lightpanda.io/install.sh');
    try {
      execSync('curl -fsSL https://pkg.lightpanda.io/install.sh | bash', {
        stdio: 'inherit',
      });
    } catch (e) {
      throw new Error('Lightpanda installation failed. Install manually: curl -fsSL https://pkg.lightpanda.io/install.sh | bash');
    }

    if (!existsSync(installedBin)) {
      throw new Error(`Lightpanda installer ran but binary not found at ${installedBin}`);
    }

    return installedBin;
  }

  private async startLightpanda(): Promise<string> {
    const requestedBin = process.env.BROWSE_LIGHTPANDA_PATH || 'lightpanda';
    const bin = this.ensureLightpanda(requestedBin);
    const host = '127.0.0.1';
    const port = process.env.BROWSE_LIGHTPANDA_PORT || '9222';
    const wsUrl = `ws://${host}:${port}`;

    this.managedProcess = spawn(bin, ['serve', '--host', host, '--port', port], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.managedProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[lightpanda] ${data.toString().trimEnd()}`);
    });

    this.managedProcess.on('exit', (code) => {
      if (this.browser) {
        console.error(`[browse] Lightpanda exited unexpectedly (code ${code})`);
      }
      this.managedProcess = null;
    });

    // Wait for CDP endpoint to be ready
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://${host}:${port}/json/version`);
        if (res.ok) {
          console.log(`[browse] Lightpanda ready at ${wsUrl}`);
          return wsUrl;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }

    this.managedProcess.kill();
    this.managedProcess = null;
    throw new Error(`Lightpanda failed to start within 10s — is '${bin}' installed?`);
  }

  isHealthy(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  // ─── Tab Management ────────────────────────────────────────
  async newTab(url?: string): Promise<number> {
    if (!this.context) throw new Error('Browser not launched');

    const page = await this.context.newPage();
    const id = this.nextTabId++;
    this.pages.set(id, page);
    this.activeTabId = id;

    // Wire up console/network capture
    this.wirePageEvents(page);

    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }

    return id;
  }

  async closeTab(id?: number): Promise<void> {
    const tabId = id ?? this.activeTabId;
    const page = this.pages.get(tabId);
    if (!page) throw new Error(`Tab ${tabId} not found`);

    await page.close();
    this.pages.delete(tabId);

    // Switch to another tab if we closed the active one
    if (tabId === this.activeTabId) {
      const remaining = [...this.pages.keys()];
      if (remaining.length > 0) {
        this.activeTabId = remaining[remaining.length - 1];
      } else {
        // No tabs left — create a new blank one
        await this.newTab();
      }
    }
  }

  switchTab(id: number): void {
    if (!this.pages.has(id)) throw new Error(`Tab ${id} not found`);
    this.activeTabId = id;
  }

  getTabCount(): number {
    return this.pages.size;
  }

  getTabList(): Array<{ id: number; url: string; title: string; active: boolean }> {
    const tabs: Array<{ id: number; url: string; title: string; active: boolean }> = [];
    for (const [id, page] of this.pages) {
      tabs.push({
        id,
        url: page.url(),
        title: '', // title requires await, populated by caller
        active: id === this.activeTabId,
      });
    }
    return tabs;
  }

  async getTabListWithTitles(): Promise<Array<{ id: number; url: string; title: string; active: boolean }>> {
    const tabs: Array<{ id: number; url: string; title: string; active: boolean }> = [];
    for (const [id, page] of this.pages) {
      tabs.push({
        id,
        url: page.url(),
        title: await page.title().catch(() => ''),
        active: id === this.activeTabId,
      });
    }
    return tabs;
  }

  // ─── Page Access ───────────────────────────────────────────
  getPage(): Page {
    const page = this.pages.get(this.activeTabId);
    if (!page) throw new Error('No active page. Use "browse goto <url>" first.');
    return page;
  }

  getCurrentUrl(): string {
    try {
      return this.getPage().url();
    } catch {
      return 'about:blank';
    }
  }

  // ─── Ref Map ──────────────────────────────────────────────
  setRefMap(refs: Map<string, Locator>) {
    this.refMap = refs;
  }

  clearRefs() {
    this.refMap.clear();
  }

  /**
   * Resolve a selector that may be a @ref (e.g., "@e3") or a CSS selector.
   * Returns { locator } for refs or { selector } for CSS selectors.
   */
  resolveRef(selector: string): { locator: Locator } | { selector: string } {
    if (selector.startsWith('@e')) {
      const ref = selector.slice(1); // "e3"
      const locator = this.refMap.get(ref);
      if (!locator) {
        throw new Error(
          `Ref ${selector} not found. Page may have changed — run 'snapshot' to get fresh refs.`
        );
      }
      return { locator };
    }
    return { selector };
  }

  getRefCount(): number {
    return this.refMap.size;
  }

  // ─── Viewport ──────────────────────────────────────────────
  async setViewport(width: number, height: number) {
    await this.getPage().setViewportSize({ width, height });
  }

  // ─── Extra Headers ─────────────────────────────────────────
  async setExtraHeader(name: string, value: string) {
    this.extraHeaders[name] = value;
    if (this.context) {
      await this.context.setExtraHTTPHeaders(this.extraHeaders);
    }
  }

  // ─── User Agent ────────────────────────────────────────────
  // Note: user agent changes require a new context in Playwright
  // For simplicity, we just store it and apply on next "restart"
  setUserAgent(ua: string) {
    this.customUserAgent = ua;
  }

  // ─── Console/Network/Ref Wiring ────────────────────────────
  private wirePageEvents(page: Page) {
    // Clear ref map on navigation — refs point to stale elements after page change
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        this.clearRefs();
      }
    });

    page.on('console', (msg) => {
      addConsoleEntry({
        timestamp: Date.now(),
        level: msg.type(),
        text: msg.text(),
      });
    });

    page.on('request', (req) => {
      addNetworkEntry({
        timestamp: Date.now(),
        method: req.method(),
        url: req.url(),
      });
    });

    page.on('response', (res) => {
      // Find matching request entry and update it
      const url = res.url();
      const status = res.status();
      for (let i = networkBuffer.length - 1; i >= 0; i--) {
        if (networkBuffer[i].url === url && !networkBuffer[i].status) {
          networkBuffer[i].status = status;
          networkBuffer[i].duration = Date.now() - networkBuffer[i].timestamp;
          break;
        }
      }
    });

    // Capture response sizes via response finished
    page.on('requestfinished', async (req) => {
      try {
        const res = await req.response();
        if (res) {
          const url = req.url();
          const body = await res.body().catch(() => null);
          const size = body ? body.length : 0;
          for (let i = networkBuffer.length - 1; i >= 0; i--) {
            if (networkBuffer[i].url === url && !networkBuffer[i].size) {
              networkBuffer[i].size = size;
              break;
            }
          }
        }
      } catch {}
    });
  }
}

