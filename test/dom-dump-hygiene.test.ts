/**
 * lib/dom-dump.js hygiene, exercised in a real browser through gstack's own
 * browse binary (`$B eval <file> --out <path> --raw`, the same fallback path
 * /design-review renders). Self-skips when no browse binary is built
 * (`bun run build:gates`), like the other render gates.
 *
 * Pins the rules the DOM dump promises before a page leaves the browser:
 * input values dropped, long data: URLs replaced (attributes, inlined CSS, and
 * existing <style> nodes), <meta content> emptied (viewport kept), query
 * strings cut from every URL attribute, script bodies emptied, linked
 * stylesheets inlined with author hex restored, cross-origin sheets named in
 * the trailing note and removed from the markup, inlined <link> nodes removed,
 * <template> and <noscript> subtrees dropped, inline on* handlers dropped.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { DOM_DUMP_STYLE_ATTR, DOM_DUMP_NOTE_PREFIX } from '../lib/dom-dump-script';

const ROOT = path.join(import.meta.dir, '..');
const CANDIDATES = [path.join(ROOT, 'browse', 'dist', 'browse'), path.join(os.homedir(), '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse')];
const BROWSE = CANDIDATES.find(p => fs.existsSync(p));
const POSIX = process.platform !== 'win32';
// Launching Chromium is load-sensitive (a cold daemon can miss the CLI's health
// window on a busy dev box). Runs in CI and on explicit opt-in; skips otherwise.
const OPTED_IN = Boolean(process.env.CI || process.env.GSTACK_DOM_DUMP_HYGIENE);

describe.skipIf(!BROWSE || !POSIX || !OPTED_IN)('lib/dom-dump.js in a real DOM (CI or GSTACK_DOM_DUMP_HYGIENE=1)', () => {
  test('applies every hygiene rule and inlines the linked stylesheet', async () => {
    const site = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-dom-dump-site-'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-dom-dump-out-'));
    const server = Bun.serve({
      hostname: '127.0.0.1', port: 0,
      fetch(req) {
        const p = new URL(req.url).pathname.replace(/^\//, '') || 'index.html';
        const f = path.join(site, p);
        return fs.existsSync(f) ? new Response(Bun.file(f)) : new Response('nope', { status: 404 });
      },
    });
    const big = 'data:image/png;base64,' + 'A'.repeat(1500);
    fs.writeFileSync(path.join(site, 'styles.css'), '.hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); } .x { background-image: url("' + big + '"); } .y { background: url("/y.png?token=SECRETCSS") }\n');
    fs.writeFileSync(path.join(site, 'index.html'), `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="description" content="SECRET DESCRIPTION">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="http://127.0.0.1:1/cross-origin.css">
<script>window.__x = "SCRIPT BODY";</script></head><body>
<input value="SECRET INPUT"><textarea>SECRET TEXT</textarea>
<a href="/page?token=SECRET">link</a>
<img src="/img.png?sig=SECRETSIG" srcset="/a.png?s=SECRETSET 1x, /b.png?s=SECRETSET2 2x">
<form action="/submit?csrf=SECRETCSRF"><button formaction="/alt?f=SECRETFORM" onclick="track('SECRETHANDLER')">go</button></form>
<template><input value="SECRET TEMPLATE"><a href="/t?x=SECRETTPL">t</a></template><noscript><img src="/px.gif?id=SECRETNOSCRIPT"></noscript>
<div style="background-image:url(https://cdn.example/x.png?X-Amz-Signature=SECRETSIG2)">s</div><iframe srcdoc="<input value='SECRETSRCDOC'>"></iframe><svg><use xlink:href="/s.svg?v=SECRETXLINK"></use></svg>
<style>.inline { background: url("${big}") }</style>
<div data-long="${'L'.repeat(40)}" data-short="ok" title="${big}">x</div>
<img src="${big}">
</body></html>`);
    const url = `http://127.0.0.1:${server.port}/index.html`;
    // Own daemon: BROWSE_STATE_FILE scopes the state dir, lock, port file, and
    // profile to this test, so it never shares (or stops) another session's daemon.
    fs.mkdirSync(path.join(tmp, '.gstack'), { recursive: true });
    const env = { ...process.env, BROWSE_STATE_FILE: path.join(tmp, '.gstack', 'browse.json') };
    const browse = (args: string[]) => spawnSync(BROWSE!, args, { encoding: 'utf-8', timeout: 90_000, env });
    try {
      // A cold daemon start can miss the CLI's ~8 s health window on a loaded
      // machine (CI shards, a concurrent eval run). Bounded retries, then fail loud.
      let go = browse(['goto', url]);
      for (let attempt = 0; attempt < 6 && go.status !== 0; attempt++) {
        Bun.sleepSync(10_000);
        go = browse(['goto', url]);
      }
      expect(go.status, go.stderr + go.stdout).toBe(0);
      // The same invocation the skill renders for the fallback engine: the arrow
      // function spliced from lib/dom-dump.js and called in the page.
      const dump = fs.readFileSync(path.join(ROOT, 'lib', 'dom-dump.js'), 'utf-8');
      const out = path.join(tmp, 'index.dom.html');
      const ev = browse(['js', `(${dump})()`, '--out', out, '--raw']);
      expect(ev.status, ev.stderr + ev.stdout).toBe(0);
      const html = fs.readFileSync(out, 'utf-8');
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain(`<style ${DOM_DUMP_STYLE_ATTR}=""`);
      expect(html).toContain('#6366f1');
      expect(html).not.toMatch(/<link[^>]*href="styles\.css"/);
      expect(html).not.toMatch(/<link[^>]*cross-origin\.css/); // named in the note, removed from the markup: the engine never sees a remote stylesheet
      expect(html).toContain(`<!-- ${DOM_DUMP_NOTE_PREFIX} `);
      expect(html).toContain('cross-origin stylesheets not resolved');
      expect(html).toContain('scripts stripped: 1');
      expect(html).not.toContain('SCRIPT BODY');
      expect(html).not.toContain('SECRET INPUT');
      expect(html).not.toContain('SECRET TEXT');
      expect(html).not.toContain('SECRET DESCRIPTION');
      expect(html).toContain('content="width=device-width"');
      expect(html).toContain('href="/page"');
      expect(html).not.toContain('token=SECRET');
      expect(html).not.toContain('SECRETSIG');
      expect(html).not.toContain('SECRETSET');
      expect(html).not.toContain('SECRETCSRF');
      expect(html).not.toContain('SECRETFORM');
      expect(html).not.toContain('SECRETHANDLER');
      expect(html).not.toMatch(/ onclick=/);
      expect(html).not.toContain('SECRET TEMPLATE');
      expect(html).not.toContain('SECRETTPL');
      expect(html).not.toContain('SECRETNOSCRIPT');
      expect(html).not.toMatch(/<template|<noscript/);
      expect(html).not.toContain('SECRETSIG2');
      expect(html).toContain('url(https://cdn.example/x.png)');
      expect(html).not.toContain('SECRETCSS');
      expect(html).toContain('url("/y.png")');
      expect(html).not.toContain('SECRETSRCDOC');
      expect(html).not.toContain('SECRETXLINK');
      expect(html).toContain('srcset="/a.png 1x, /b.png 2x"');
      expect(html).not.toContain('L'.repeat(40));
      expect(html).toContain('data-short="ok"');
      expect(html).not.toContain('A'.repeat(1500));
      expect(html).toContain('data:,gstack-stripped');
    } finally {
      server.stop(true);
      try { browse(['stop']); } catch {}
      fs.rmSync(site, { recursive: true, force: true });
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 180_000);
});
