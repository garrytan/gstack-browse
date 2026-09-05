/**
 * lib/aside-render.ts — the local-HTML renderer for make-pdf, diagrams, and
 * design previews: Aside first, gstack's own browse daemon as the fallback.
 *
 * Pure pins run everywhere; the live Aside render runs only where Aside is
 * installed and open (macOS dev machines); the live fallback render runs
 * wherever a browse binary resolves (Linux CI builds one via build:gates).
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildRenderScript, lengthToInches, paperInches, renderWithAside, RENDER_SENTINEL,
  resolveBrowseBin, browsePdfPayload, browseScreenshotArgs, renderWithBrowse, NO_BROWSER,
} from '../lib/aside-render';
import { asideAvailable } from './helpers/aside-available';

const LIVE_HTML = '<!doctype html><title>Live Probe</title><h1>Hello</h1><div id="done"></div><script>window.__v = "x".repeat(200000)</script>';

describe('aside-render: option mapping', () => {
  test('lengths convert to inches (CDP unit)', () => {
    expect(lengthToInches('1in')).toBe(1);
    expect(lengthToInches('25.4mm')).toBeCloseTo(1, 6);
    expect(lengthToInches('2.54cm')).toBeCloseTo(1, 6);
    expect(lengthToInches('72pt')).toBe(1);
    expect(lengthToInches('96px')).toBe(1);
    expect(lengthToInches(48)).toBe(0.5);
    expect(lengthToInches(undefined)).toBeUndefined();
    expect(() => lengthToInches('1 furlong')).toThrow();
  });

  test('paper formats resolve case-insensitively', () => {
    expect(paperInches('Letter')).toEqual([8.5, 11]);
    expect(paperInches('a4')![0]).toBeCloseTo(8.27, 2);
    expect(paperInches('tabloid')).toEqual([11, 17]);
    expect(paperInches('napkin')).toBeUndefined();
  });
});

describe('aside-render: generated script follows the Aside contract', () => {
  const script = buildRenderScript('http://127.0.0.1:1/x.html', {
    file: '/x.html',
    waitFor: { selector: '#done', expression: 'window.ready' },
    steps: [
      { kind: 'pdf', out: '/tmp/a.pdf', options: { paperWidth: 8.5, paperHeight: 11, generateTaggedPDF: true, headerTemplate: '<b>h</b>', displayHeaderFooter: true, waitForPagedJs: true } },
      { kind: 'screenshot', out: '/tmp/m.jpg', width: 375, type: 'jpeg', quality: 60 },
      { kind: 'screenshot', out: '/tmp/el.png', selector: '#hero' },
      { kind: 'eval', expression: 'window.__svg', out: '/tmp/d.svg' },
      { kind: 'eval', expression: 'document.title' },
    ],
  });

  test('opens about:blank, installs the console hook, then loads with waitUntil load', () => {
    expect(script).toContain('openTab("about:blank")');
    expect(script.indexOf('Page.addScriptToEvaluateOnNewDocument')).toBeLessThan(script.indexOf('pg.goto('));
    expect(script).toContain('waitUntil: "load"');
    expect(script).toContain('waitForSelector("#done", { state: "attached"');
    expect(script).toContain('waitFor expression never became truthy');
  });

  test('pdf goes through CDP printToPDF with the full option set and the Paged.js wait', () => {
    expect(script).toContain('Page.printToPDF');
    expect(script).toContain('"generateTaggedPDF":true');
    expect(script).toContain('"headerTemplate":"<b>h</b>"');
    expect(script).toContain('__pagedjsAfterFired');
    expect(script).not.toContain('pg.pdf(');
  });

  test('sized screenshots emulate device metrics and clear them; element shots use the locator', () => {
    expect(script).toContain('Emulation.setDeviceMetricsOverride');
    expect(script).toContain('"width":375');
    expect(script).toContain('"mobile":true');
    expect(script).toContain('Emulation.clearDeviceMetricsOverride');
    expect(script).toContain('pg.locator("#hero").screenshot(');
    expect(script).not.toContain('setViewportSize');
  });

  test('evals run in-page via eval, data URLs decode to bytes, inline results are fenced', () => {
    expect(script).toContain('(0, eval)(src)');
    expect(script).toContain('/^data:[^;]+;base64,/');
    expect(script).toContain('EVAL_START 4');
    expect(script).toContain('EVAL_END 4');
  });

  test('every artifact stays inside the sandbox dir and the script ends with close + sentinel', () => {
    expect(script).toContain('path.join(pwd, "gstack-render-0.pdf")');
    expect(script).toContain('"gstack-render-3.svg"');
    expect(script).toContain('console.log("ASIDE_DIR=" + pwd)');
    const tail = script.trim().split('\n').slice(-2);
    expect(tail[0]).toBe('await closeTab(pg);');
    expect(tail[1]).toBe(`console.log(${JSON.stringify(RENDER_SENTINEL)});`);
  });
});

/** The same spec both engines must satisfy: PDF, sized JPEG, eval-to-file (200KB string + data URL), inline eval. */
async function liveRoundTrip(engine: 'aside' | 'browse', renderFn: typeof renderWithAside): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${engine}-render-live-`));
  fs.writeFileSync(path.join(dir, 'doc.html'), LIVE_HTML);
  try {
    const out = await renderFn({
      file: path.join(dir, 'doc.html'),
      waitFor: { selector: '#done', expression: 'window.__v.length === 200000' },
      steps: [
        { kind: 'pdf', out: path.join(dir, 'out.pdf'), options: { paperWidth: 8.5, paperHeight: 11, generateTaggedPDF: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: '<div style="font-size:8pt">f</div>' } },
        { kind: 'screenshot', out: path.join(dir, 'm.jpg'), width: 375, type: 'jpeg', quality: 50 },
        { kind: 'eval', expression: 'window.__v', out: path.join(dir, 'v.txt') },
        { kind: 'eval', expression: 'document.title' },
        { kind: 'eval', expression: '"data:application/octet-stream;base64," + btoa("hello")', out: path.join(dir, 'bytes.bin') },
      ],
      timeoutMs: 90_000,
    });
    expect(out.error).toBeUndefined();
    expect(out.ok).toBe(true);
    expect(out.engine).toBe(engine);
    expect(out.outputs).toEqual([path.join(dir, 'out.pdf'), path.join(dir, 'm.jpg'), path.join(dir, 'v.txt'), path.join(dir, 'bytes.bin')]);
    expect(fs.readFileSync(path.join(dir, 'out.pdf')).subarray(0, 4).toString()).toBe('%PDF');
    expect(fs.readFileSync(path.join(dir, 'm.jpg')).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // JPEG SOI
    expect(fs.statSync(path.join(dir, 'v.txt')).size).toBe(200000);
    expect(fs.readFileSync(path.join(dir, 'bytes.bin'), 'utf8')).toBe('hello'); // data URL decoded to bytes
    expect(out.evals[3]).toBe('Live Probe');
    expect(out.stdout).toMatch(/^PAGE_ERRORS=\[\]$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** `--wait-expr` is poll-until-truthy: an expression that THROWS until its object exists must not fail the render. */
async function lateReadiness(engine: 'aside' | 'browse', renderFn: typeof renderWithAside): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${engine}-render-late-`));
  fs.writeFileSync(path.join(dir, 'late.html'), '<!doctype html><title>Late</title><body><script>setTimeout(() => { window.later = { ok: true }; }, 800);</script></body>');
  try {
    const out = await renderFn({ file: path.join(dir, 'late.html'), waitFor: { expression: 'window.later.ok', timeoutMs: 10_000 }, steps: [{ kind: 'eval', expression: 'document.title' }], timeoutMs: 60_000 });
    expect(out.error).toBeUndefined();
    expect(out.ok).toBe(true);
    expect(out.engine).toBe(engine);
    expect(out.evals[0]).toBe('Late');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('aside-render: live render (needs the Aside app)', () => {
  test.skipIf(!asideAvailable())('renders a served HTML file to PDF, screenshot, and eval outputs', () => liveRoundTrip('aside', renderWithAside), 120_000);
  test.skipIf(!asideAvailable())('--wait-expr polls through a throwing expression until it becomes truthy', () => lateReadiness('aside', renderWithAside), 60_000);
});

describe('aside-render: browse fallback — binary resolution', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'browse-resolve-'));
  const fakeBin = (root: string, rel: string): string => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '#!/bin/sh\necho fake\n', { mode: 0o755 });
    return p;
  };
  const rootA = path.join(home, 'a');
  const rootB = path.join(home, 'b');
  const builtA = fakeBin(rootA, 'browse/dist/browse');
  const builtB = fakeBin(rootB, 'browse/dist/browse');
  const override = fakeBin(home, 'elsewhere/browse');
  const legacy = fakeBin(home, 'legacy/browse');
  const empty = path.join(home, 'empty');
  fs.mkdirSync(empty);
  const noPath = { PATH: '' };

  test('GSTACK_BROWSE_BIN wins, then BROWSE_BIN, then the first root with browse/dist/browse', () => {
    expect(resolveBrowseBin({ ...noPath, GSTACK_BROWSE_BIN: override, BROWSE_BIN: legacy }, [rootA])).toBe(override);
    expect(resolveBrowseBin({ ...noPath, BROWSE_BIN: legacy }, [rootA])).toBe(legacy);
    expect(resolveBrowseBin(noPath, [rootA, rootB])).toBe(builtA);
    expect(resolveBrowseBin(noPath, [empty, rootB])).toBe(builtB);
  });

  test('an override that does not exist falls through (main parity); nothing anywhere is null, never a throw', () => {
    expect(resolveBrowseBin({ ...noPath, GSTACK_BROWSE_BIN: path.join(home, 'nope') }, [rootA])).toBe(builtA);
    expect(resolveBrowseBin(noPath, [empty])).toBeNull();
    expect(resolveBrowseBin({ ...noPath, GSTACK_BROWSE_BIN: '   ' }, [empty])).toBeNull();
  });

  test('the find-browse shim is consulted when a root has no built binary', () => {
    const rootC = path.join(home, 'c');
    const shim = path.join(rootC, 'browse/bin/find-browse');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.writeFileSync(shim, `#!/bin/sh\necho ${builtB}\n`, { mode: 0o755 });
    expect(resolveBrowseBin(noPath, [rootC])).toBe(builtB);
  });

  test('directories are never "executables"', () => {
    const rootD = path.join(home, 'd');
    fs.mkdirSync(path.join(rootD, 'browse/dist/browse'), { recursive: true });
    expect(resolveBrowseBin(noPath, [rootD])).toBeNull();
  });
});

describe('aside-render: browse fallback — command builders (pure)', () => {
  test('pdf payload: CDP inches → browse string lengths, empty header/footer slots filled, flags mapped by name', () => {
    const p = browsePdfPayload({
      paperWidth: 8.5, paperHeight: 11, marginTop: 1, marginRight: 0, marginBottom: 0.5, marginLeft: 0,
      displayHeaderFooter: true, footerTemplate: '<i>f</i>',
      generateTaggedPDF: true, generateDocumentOutline: true, printBackground: true, preferCSSPageSize: true, waitForPagedJs: true,
    }, '/tmp/x/out.pdf');
    expect(p).toEqual({
      output: '/tmp/x/out.pdf', width: '8.5in', height: '11in',
      marginTop: '1in', marginRight: '0in', marginBottom: '0.5in', marginLeft: '0in',
      headerTemplate: '<div></div>', footerTemplate: '<i>f</i>',
      tagged: true, outline: true, printBackground: true, preferCSSPageSize: true, toc: true,
    });
  });

  test('pdf payload: no header/footer unless displayHeaderFooter; landscape swaps width/height (Letter when unset)', () => {
    expect(browsePdfPayload({ paperWidth: 8.5, paperHeight: 11, headerTemplate: '<b>h</b>' }, 'o.pdf')).toEqual({ output: 'o.pdf', width: '8.5in', height: '11in' });
    expect(browsePdfPayload({ paperWidth: 8.5, paperHeight: 11, landscape: true }, 'o.pdf')).toEqual({ output: 'o.pdf', width: '11in', height: '8.5in' });
    expect(browsePdfPayload({ landscape: true }, 'o.pdf')).toEqual({ output: 'o.pdf', width: '11in', height: '8.5in' });
    expect(browsePdfPayload({}, 'o.pdf')).toEqual({ output: 'o.pdf' });
  });

  test('screenshot args: full page by default, --viewport for viewport-only, --selector for element shots, path last', () => {
    expect(browseScreenshotArgs({ kind: 'screenshot', out: '/x/a.png' }, '/tmp/w/gstack-render-0.png')).toEqual(['screenshot', '/tmp/w/gstack-render-0.png']);
    expect(browseScreenshotArgs({ kind: 'screenshot', out: '/x/a.png', fullPage: false }, '/tmp/w/s.png')).toEqual(['screenshot', '--viewport', '/tmp/w/s.png']);
    expect(browseScreenshotArgs({ kind: 'screenshot', out: '/x/a.png', selector: '#hero' }, '/tmp/w/s.png')).toEqual(['screenshot', '--selector', '#hero', '/tmp/w/s.png']);
  });

  test('renderWithBrowse with no binary reports the no-browser error without touching the filesystem', async () => {
    const r = await renderWithBrowse({ file: '/nonexistent/x.html', steps: [] }, null);
    expect(r.ok).toBe(false);
    expect(r.engine).toBe('browse');
    expect(r.error?.startsWith(NO_BROWSER)).toBe(true);
    expect(r.error).toContain('./setup');
  });
});

describe('aside-render: live fallback render (needs a browse binary)', () => {
  const bin = resolveBrowseBin();
  test.skipIf(!bin)("renders the same spec through gstack's own browser", () => liveRoundTrip('browse', (spec) => renderWithBrowse(spec, bin)), 180_000);
  test.skipIf(!bin)('--wait-expr polls through a throwing expression until it becomes truthy (Aside parity)', () => lateReadiness('browse', (spec) => renderWithBrowse(spec, bin)), 60_000);
});
