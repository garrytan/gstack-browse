/**
 * Write commands — navigate and interact with pages (side effects)
 *
 * goto, back, forward, reload, click, fill, select, hover, type,
 * press, scroll, wait, viewport, cookie, header, useragent
 */

import type { BrowserManager } from './browser-manager';
import { findInstalledBrowsers, importCookies } from './cookie-import-browser';
import * as fs from 'fs';
import * as path from 'path';

export async function handleWriteCommand(
  command: string,
  args: string[],
  bm: BrowserManager
): Promise<string> {
  const page = bm.getPage();

  switch (command) {
    case 'goto': {
      const url = args[0];
      if (!url) throw new Error('使い方: browse goto <url>');
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const status = response?.status() || '不明';
      return `${url} に移動しました (${status})`;
    }

    case 'back': {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
      return `戻る → ${page.url()}`;
    }

    case 'forward': {
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 15000 });
      return `進む → ${page.url()}`;
    }

    case 'reload': {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      return `${page.url()} を再読み込みしました`;
    }

    case 'click': {
      const selector = args[0];
      if (!selector) throw new Error('使い方: browse click <selector>');
      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.click({ timeout: 5000 });
      } else {
        await page.click(resolved.selector, { timeout: 5000 });
      }
      // Wait briefly for any navigation/DOM update
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return `${selector} をクリックしました → 現在 ${page.url()}`;
    }

    case 'fill': {
      const [selector, ...valueParts] = args;
      const value = valueParts.join(' ');
      if (!selector || !value) throw new Error('使い方: browse fill <selector> <value>');
      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.fill(value, { timeout: 5000 });
      } else {
        await page.fill(resolved.selector, value, { timeout: 5000 });
      }
      return `${selector} に入力しました`;
    }

    case 'select': {
      const [selector, ...valueParts] = args;
      const value = valueParts.join(' ');
      if (!selector || !value) throw new Error('使い方: browse select <selector> <value>');
      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.selectOption(value, { timeout: 5000 });
      } else {
        await page.selectOption(resolved.selector, value, { timeout: 5000 });
      }
      return `${selector} で "${value}" を選択しました`;
    }

    case 'hover': {
      const selector = args[0];
      if (!selector) throw new Error('使い方: browse hover <selector>');
      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.hover({ timeout: 5000 });
      } else {
        await page.hover(resolved.selector, { timeout: 5000 });
      }
      return `${selector} にホバーしました`;
    }

    case 'type': {
      const text = args.join(' ');
      if (!text) throw new Error('使い方: browse type <text>');
      await page.keyboard.type(text);
      return `${text.length} 文字入力しました`;
    }

    case 'press': {
      const key = args[0];
      if (!key) throw new Error('使い方: browse press <key> (例: Enter, Tab, Escape)');
      await page.keyboard.press(key);
      return `${key} を押しました`;
    }

    case 'scroll': {
      const selector = args[0];
      if (selector) {
        const resolved = bm.resolveRef(selector);
        if ('locator' in resolved) {
          await resolved.locator.scrollIntoViewIfNeeded({ timeout: 5000 });
        } else {
          await page.locator(resolved.selector).scrollIntoViewIfNeeded({ timeout: 5000 });
        }
        return `${selector} が見える位置までスクロールしました`;
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return 'ページ最下部までスクロールしました';
    }

    case 'wait': {
      const selector = args[0];
      if (!selector) throw new Error('使い方: browse wait <selector|--networkidle|--load|--domcontentloaded>');
      if (selector === '--networkidle') {
        const timeout = args[1] ? parseInt(args[1], 10) : 15000;
        await page.waitForLoadState('networkidle', { timeout });
        return 'ネットワークが idle 状態になりました';
      }
      if (selector === '--load') {
        await page.waitForLoadState('load');
        return 'ページ読み込みが完了しました';
      }
      if (selector === '--domcontentloaded') {
        await page.waitForLoadState('domcontentloaded');
        return 'DOM コンテンツの読み込みが完了しました';
      }
      const timeout = args[1] ? parseInt(args[1], 10) : 15000;
      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.waitFor({ state: 'visible', timeout });
      } else {
        await page.waitForSelector(resolved.selector, { timeout });
      }
      return `要素 ${selector} が表示されました`;
    }

    case 'viewport': {
      const size = args[0];
      if (!size || !size.includes('x')) throw new Error('使い方: browse viewport <WxH> (例: 375x812)');
      const [w, h] = size.split('x').map(Number);
      await bm.setViewport(w, h);
      return `ビューポートを ${w}x${h} に設定しました`;
    }

    case 'cookie': {
      const cookieStr = args[0];
      if (!cookieStr || !cookieStr.includes('=')) throw new Error('使い方: browse cookie <name>=<value>');
      const eq = cookieStr.indexOf('=');
      const name = cookieStr.slice(0, eq);
      const value = cookieStr.slice(eq + 1);
      const url = new URL(page.url());
      await page.context().addCookies([{
        name,
        value,
        domain: url.hostname,
        path: '/',
      }]);
      return `cookie を設定しました: ${name}=****`;
    }

    case 'header': {
      const headerStr = args[0];
      if (!headerStr || !headerStr.includes(':')) throw new Error('使い方: browse header <name>:<value>');
      const sep = headerStr.indexOf(':');
      const name = headerStr.slice(0, sep).trim();
      const value = headerStr.slice(sep + 1).trim();
      await bm.setExtraHeader(name, value);
      const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'];
      const redactedValue = sensitiveHeaders.includes(name.toLowerCase()) ? '****' : value;
      return `ヘッダーを設定しました: ${name}: ${redactedValue}`;
    }

    case 'useragent': {
      const ua = args.join(' ');
      if (!ua) throw new Error('使い方: browse useragent <string>');
      bm.setUserAgent(ua);
      const error = await bm.recreateContext();
      if (error) {
        return `User-Agent を "${ua}" に設定しましたが、次の問題がありました: ${error}`;
      }
      return `User-Agent を設定しました: ${ua}`;
    }

    case 'upload': {
      const [selector, ...filePaths] = args;
      if (!selector || filePaths.length === 0) throw new Error('使い方: browse upload <selector> <file1> [file2...]');

      // Validate all files exist before upload
      for (const fp of filePaths) {
        if (!fs.existsSync(fp)) throw new Error(`ファイルが見つかりません: ${fp}`);
      }

      const resolved = bm.resolveRef(selector);
      if ('locator' in resolved) {
        await resolved.locator.setInputFiles(filePaths);
      } else {
        await page.locator(resolved.selector).setInputFiles(filePaths);
      }

      const fileInfo = filePaths.map(fp => {
        const stat = fs.statSync(fp);
        return `${path.basename(fp)} (${stat.size}B)`;
      }).join(', ');
      return `アップロードしました: ${fileInfo}`;
    }

    case 'dialog-accept': {
      const text = args.length > 0 ? args.join(' ') : null;
      bm.setDialogAutoAccept(true);
      bm.setDialogPromptText(text);
      return text
        ? `ダイアログを自動 accept し、応答テキストに "${text}" を使用します`
        : 'ダイアログを自動 accept します';
    }

    case 'dialog-dismiss': {
      bm.setDialogAutoAccept(false);
      bm.setDialogPromptText(null);
      return 'ダイアログを自動 dismiss します';
    }

    case 'cookie-import': {
      const filePath = args[0];
      if (!filePath) throw new Error('使い方: browse cookie-import <json-file>');
      // Path validation — prevent reading arbitrary files
      if (path.isAbsolute(filePath)) {
        const safeDirs = ['/tmp', process.cwd()];
        const resolved = path.resolve(filePath);
        if (!safeDirs.some(dir => resolved === dir || resolved.startsWith(dir + '/'))) {
          throw new Error(`パスは次の範囲内である必要があります: ${safeDirs.join(', ')}`);
        }
      }
      if (path.normalize(filePath).includes('..')) {
        throw new Error('パストラバーサル (..) は許可されていません');
      }
      if (!fs.existsSync(filePath)) throw new Error(`ファイルが見つかりません: ${filePath}`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      let cookies: any[];
      try { cookies = JSON.parse(raw); } catch { throw new Error(`${filePath} の JSON が不正です`); }
      if (!Array.isArray(cookies)) throw new Error('cookie ファイルは JSON 配列である必要があります');

      // Auto-fill domain from current page URL when missing (consistent with cookie command)
      const pageUrl = new URL(page.url());
      const defaultDomain = pageUrl.hostname;

      for (const c of cookies) {
        if (!c.name || c.value === undefined) throw new Error('各 cookie には "name" と "value" フィールドが必要です');
        if (!c.domain) c.domain = defaultDomain;
        if (!c.path) c.path = '/';
      }

      await page.context().addCookies(cookies);
      return `${filePath} から ${cookies.length} 件の cookie を読み込みました`;
    }

    case 'cookie-import-browser': {
      // Two modes:
      // 1. Direct CLI import: cookie-import-browser <browser> --domain <domain>
      // 2. Open picker UI: cookie-import-browser [browser]
      const browserArg = args[0];
      const domainIdx = args.indexOf('--domain');

      if (domainIdx !== -1 && domainIdx + 1 < args.length) {
        // Direct import mode — no UI
        const domain = args[domainIdx + 1];
        const browser = browserArg || 'comet';
        const result = await importCookies(browser, [domain]);
        if (result.cookies.length > 0) {
          await page.context().addCookies(result.cookies);
        }
        const msg = [`${browser} から ${domain} 向けに ${result.count} 件の cookie を取り込みました`];
        if (result.failed > 0) msg.push(`（${result.failed} 件は復号に失敗）`);
        return msg.join(' ');
      }

      // Picker UI mode — open in user's browser
      const port = bm.serverPort;
      if (!port) throw new Error('サーバーポートを取得できません');

      const browsers = findInstalledBrowsers();
      if (browsers.length === 0) {
        throw new Error('Chromium ブラウザが見つかりません。対応: Comet, Chrome, Arc, Brave, Edge');
      }

      const pickerUrl = `http://127.0.0.1:${port}/cookie-picker`;
      try {
        Bun.spawn(['open', pickerUrl], { stdout: 'ignore', stderr: 'ignore' });
      } catch {
        // open may fail silently — URL is in the message below
      }

      return `Cookie picker を開きました: ${pickerUrl}\n検出されたブラウザ: ${browsers.map(b => b.name).join(', ')}\n取り込むドメインを選択し、完了後に picker を閉じてください。`;
    }

    default:
      throw new Error(`未知の write コマンドです: ${command}`);
  }
}
