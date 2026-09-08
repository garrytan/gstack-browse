/**
 * lib/design-md.ts + bin/gstack-design-md.ts + design/src/memory.ts (DESIGN.md writer).
 *
 * Pins the open DESIGN.md format rules gstack depends on: eight canonical
 * sections in order, only the five token groups in front matter, `{path}`
 * references resolving to primitives, extras surviving a round trip, the
 * format marker's placement (YAML comment on line 2 for spec files, HTML
 * comment on line 1 for legacy), body-only upserts that never re-emit front
 * matter bytes, and a legacy → spec conversion of gstack's own DESIGN.md.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  parseDesignMd, detectFormat, renderDesignMd, upsertSection, convertLegacy, tokensFlat,
  emitYamlBlock, setMarker, specSkeleton, CANONICAL_SECTIONS, TOKEN_GROUPS, isLegacyGstackFormat,
} from '../lib/design-md';
import { updateDesignMd, readDesignConstraints } from '../design/src/memory';

const ROOT = path.join(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin', 'gstack-design-md.ts');
const LEGACY = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf-8');

const SPEC = `---
# gstack: design-md-format=spec
name: Heritage
colors:
  primary: "#1A1C1E"
  accent: "#B8422E"
  cta: "{colors.accent}"
typography:
  display:
    fontFamily: Public Sans
    fontSize: 3rem
rounded:
  md: 8px
spacing:
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.primary}"
---

# Heritage

## Overview

Architectural minimalism.

## Colors

Ink and clay.

## Typography

Public Sans everywhere.

## Motion

One authored moment.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-08 | spec format | portable |
`;

describe('parse + detect', () => {
  test('spec file: front matter bytes preserved, marker read from line 2, sections classified', () => {
    const doc = parseDesignMd(SPEC);
    expect(doc.marker).toBe('spec');
    expect(doc.frontmatter?.name).toBe('Heritage');
    expect(doc.frontmatterText).toContain('primary: "#1A1C1E"');
    expect(doc.preamble).toBe('# Heritage');
    expect(doc.sections.map(s => s.canonical ?? s.heading)).toEqual(['Overview', 'Colors', 'Typography', 'Motion', 'Decisions Log']);
    expect(detectFormat(doc)).toEqual({ format: 'spec' });
  });

  test("gstack's own DESIGN.md is legacy; a fresh file is unknown; nothing is missing", () => {
    const doc = parseDesignMd(LEGACY);
    expect(isLegacyGstackFormat(doc)).toBe(true);
    expect(detectFormat(doc)).toEqual({ format: 'legacy' });
    expect(detectFormat(parseDesignMd('# Hello\n\nJust prose.\n')).format).toBe('unknown');
    expect(detectFormat(null)).toEqual({ format: 'missing' });
  });

  test('malformed front matter is unknown with a reason, never a throw', () => {
    const doc = parseDesignMd('---\ncolors: [unclosed\n---\n\n## Overview\n\nx\n');
    expect(doc.frontmatter).toBeNull();
    const d = detectFormat(doc);
    expect(d.format).toBe('unknown');
    expect(d.reason).toMatch(/front matter does not parse/);
  });

  test('legacy headings plus front matter is ambiguous', () => {
    const d = detectFormat(parseDesignMd('---\nname: x\ncolors:\n  a: "#fff"\n---\n\n## Product Context\n\nx\n\n## Aesthetic Direction\n\ny\n'));
    expect(d.format).toBe('unknown');
    expect(d.reason).toMatch(/^ambiguous/);
  });

  test('a ## inside a code fence is not a section', () => {
    const doc = parseDesignMd('## Overview\n\n```md\n## Not a section\n```\n\n## Colors\n\nx\n');
    expect(doc.sections.map(s => s.heading)).toEqual(['Overview', 'Colors']);
  });

  test('legacy marker on line 1 is read and survives a render', () => {
    const doc = parseDesignMd('<!-- gstack: design-md-format=legacy-keep -->\n# Design System — X\n\n## Product Context\n\n- a\n\n## Color\n\n- **Primary:** #fff\n');
    expect(doc.marker).toBe('legacy-keep');
    const out = renderDesignMd(doc);
    expect(out.split('\n')[0]).toBe('<!-- gstack: design-md-format=legacy-keep -->');
    expect(out).toContain('# Design System — X');
  });
});

describe('render + upsert', () => {
  test('round trip is stable and keeps canonical order with extras after', () => {
    const once = renderDesignMd(parseDesignMd(SPEC));
    expect(renderDesignMd(parseDesignMd(once))).toBe(once);
    const headings = [...once.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(headings).toEqual(['Overview', 'Colors', 'Typography', 'Motion', 'Decisions Log']);
    expect(once.split('\n')[0]).toBe('---');
    expect(once.split('\n')[1]).toBe('# gstack: design-md-format=spec');
  });

  test('canonical sections re-sort into spec order when the file had them shuffled', () => {
    const shuffled = '---\nname: x\ncolors:\n  a: "#fff"\n---\n\n## Typography\n\nt\n\n## Overview\n\no\n\n## Shapes\n\ns\n\n## Colors\n\nc\n\n## Custom\n\nz\n';
    const out = renderDesignMd(parseDesignMd(shuffled));
    const headings = [...out.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(headings).toEqual(['Overview', 'Colors', 'Typography', 'Shapes', 'Custom']);
    const order = headings.filter(h => (CANONICAL_SECTIONS as readonly string[]).includes(h)).map(h => CANONICAL_SECTIONS.indexOf(h as any));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('aliases map to canonical names (Brand & Style → Overview, Elevation → Elevation & Depth)', () => {
    const doc = parseDesignMd('## Brand & Style\n\nx\n\n## Elevation\n\ny\n');
    expect(doc.sections.map(s => s.canonical)).toEqual(['Overview', 'Elevation & Depth']);
    expect(renderDesignMd(doc)).toContain('## Elevation & Depth');
  });

  test('upsertSection splices the body only: front matter bytes are identical before and after', () => {
    const doc = parseDesignMd(SPEC);
    const next = upsertSection(upsertSection(doc, 'Colors', 'Ink, clay, and one more.'), 'Extracted Design Language', 'from a mockup');
    const out = renderDesignMd(next);
    const fmBefore = SPEC.slice(0, SPEC.indexOf('\n---\n', 4) + 5);
    expect(out.startsWith(fmBefore)).toBe(true);
    expect(out).toContain('## Colors\n\nInk, clay, and one more.');
    const headings = [...out.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(headings).toEqual(['Overview', 'Colors', 'Typography', 'Motion', 'Decisions Log', 'Extracted Design Language']);
  });

  test('setMarker on a spec file writes the YAML comment on line 2 and nothing else moves', () => {
    const noMarker = SPEC.replace('# gstack: design-md-format=spec\n', '');
    const out = renderDesignMd(setMarker(parseDesignMd(noMarker), 'spec'));
    expect(out.split('\n').slice(0, 3)).toEqual(['---', '# gstack: design-md-format=spec', 'name: Heritage']);
  });
});

describe('tokens', () => {
  test('flattens the five groups and resolves {path} references to primitives', () => {
    const { tokens, errors } = tokensFlat(parseDesignMd(SPEC).frontmatter);
    expect(errors).toEqual([]);
    expect(tokens['colors.primary']).toBe('#1A1C1E');
    expect(tokens['colors.cta']).toBe('#B8422E');
    expect(tokens['components.button-primary.backgroundColor']).toBe('#B8422E');
    expect(tokens['components.button-primary.textColor']).toBe('#1A1C1E');
    expect(tokens['typography.display.fontSize']).toBe('3rem');
    expect(Object.keys(tokens).every(k => TOKEN_GROUPS.some(g => k.startsWith(g + '.')))).toBe(true);
    expect('name' in tokens).toBe(false);
  });

  test('group refs, self refs, and dangling refs are DESIGN_MD_TOKEN_REF_INVALID', () => {
    const fm = { colors: { a: '#111', group: '{colors}', self: '{colors.self}', gone: '{colors.nope}' }, components: { btn: { bg: '{colors}' } } };
    const { tokens, errors } = tokensFlat(fm);
    expect(tokens['colors.a']).toBe('#111');
    expect(errors.filter(e => e.startsWith('DESIGN_MD_TOKEN_REF_INVALID: ')).length).toBe(4);
    expect(errors.join('\n')).toContain('{colors} (refers to a group');
    expect(errors.join('\n')).toContain('{colors.self} (self-reference)');
    expect(errors.join('\n')).toContain('{colors.nope} (no such token)');
  });

  test('emitYamlBlock writes block style that Bun.YAML parses back identically', () => {
    const obj = { name: 'X: y', colors: { primary: '#fff', 'on-primary': '#000', weird: 'yes' }, spacing: { '2xs': '2px', md: 16 }, list: ['a', 'b'] };
    const yaml = emitYamlBlock(obj);
    expect(yaml).not.toContain('{');
    expect(yaml).toContain('colors:\n  primary: "#fff"');
    expect((Bun as any).YAML.parse(yaml)).toEqual(obj);
  });
});

describe("convertLegacy on gstack's own DESIGN.md", () => {
  const converted = convertLegacy(parseDesignMd(LEGACY));
  const out = renderDesignMd(converted, { emitFrontmatter: true });

  test('produces a spec file with the marker on line 2 and only the five token groups plus name', () => {
    const doc = parseDesignMd(out);
    expect(detectFormat(doc)).toEqual({ format: 'spec' });
    expect(out.split('\n')[1]).toBe('# gstack: design-md-format=spec');
    for (const k of Object.keys(doc.frontmatter!)) expect(['name', ...TOKEN_GROUPS]).toContain(k);
    expect(doc.frontmatter!.name).toBe('gstack');
  });

  test('maps roles, colors, spacing, and radii into tokens', () => {
    const { tokens, errors } = tokensFlat(parseDesignMd(out).frontmatter);
    expect(errors).toEqual([]);
    expect(tokens['typography.display.fontFamily']).toBe('Satoshi');
    expect(tokens['typography.body.fontFamily']).toBe('DM Sans');
    expect(tokens['typography.label.fontFamily']).toBe('DM Sans');
    expect(tokens['typography.mono.fontFamily']).toBe('JetBrains Mono');
    expect(tokens['typography.mono.fontFeature']).toBe('tnum');
    expect(tokens['colors.primary-dark-mode']).toBe('#F59E0B');
    expect(tokens['colors.primary-light-mode']).toBe('#D97706');
    expect(tokens['colors.success']).toBe('#22C55E');
    expect(tokens['colors.semantic']).toBeUndefined();
    expect(tokens['spacing.md']).toBe('16px');
    expect(tokens['spacing.2xs']).toBe('2px');
    expect(tokens['rounded.lg']).toBe('12px');
    expect(tokens['rounded.full']).toBe('9999px');
  });

  test('folds Product Context and Aesthetic Direction into Overview; Motion, Grain Texture, Decisions Log survive as extras in order', () => {
    const headings = [...out.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(headings).toEqual(['Overview', 'Colors', 'Typography', 'Layout', 'Motion', 'Grain Texture', 'Decisions Log']);
    expect(out).toContain('**What this is:**');
    expect(out).toContain('**Direction:** Industrial/Utilitarian');
    expect(out).toContain('| 2026-03-21 | Grain texture |');
    expect(out).toContain('### Spacing');
  });

  test('re-rendering the converted file is stable (idempotent write)', () => {
    expect(renderDesignMd(parseDesignMd(out))).toBe(out);
  });
});

describe('bin/gstack-design-md.ts', () => {
  const run = (args: string[], cwd: string) => {
    const r = spawnSync(process.execPath, ['--no-env-file', 'run', BIN, ...args], { cwd, encoding: 'utf-8', timeout: 60_000 });
    return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
  };

  test('check reports format + marker for spec, legacy, unknown, missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      expect(run(['check'], dir).out).toContain('DESIGN_MD_FORMAT: missing');
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), SPEC);
      expect(run(['check'], dir).out).toBe('DESIGN_MD_FORMAT: spec\nDESIGN_MD_MARKER: spec\n');
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), LEGACY);
      expect(run(['check'], dir).out).toBe('DESIGN_MD_FORMAT: legacy\nDESIGN_MD_MARKER: none\n');
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), '---\n: bad: [\n---\n');
      const bad = run(['check'], dir);
      expect(bad.out).toContain('DESIGN_MD_FORMAT: unknown');
      expect(bad.out).toContain('DESIGN_MD_REASON: front matter does not parse');
      expect(bad.code).toBe(0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('convert --write backs up, writes atomically, refuses ambiguous and non-legacy input', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), LEGACY);
      const dry = run(['convert'], dir);
      expect(dry.code).toBe(0);
      expect(dry.out.split('\n')[1]).toBe('# gstack: design-md-format=spec');
      expect(fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8')).toBe(LEGACY);
      const wr = run(['convert', '--write'], dir);
      expect(wr.code).toBe(0);
      expect(wr.out).toContain('DESIGN_MD_WRITTEN:');
      expect(fs.readFileSync(path.join(dir, 'DESIGN.md.legacy.bak'), 'utf-8')).toBe(LEGACY);
      expect(run(['check'], dir).out).toContain('DESIGN_MD_FORMAT: spec');
      expect(fs.readdirSync(dir).some(f => f.includes('.tmp-'))).toBe(false);
      // already spec → refused as non-legacy (exit 1), not clobbered
      const again = run(['convert', '--write'], dir);
      expect(again.code).toBe(1);
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), '---\nname: x\ncolors:\n  a: "#fff"\n---\n\n## Product Context\n\nx\n\n## Aesthetic Direction\n\ny\n');
      const amb = run(['convert', '--write'], dir);
      expect(amb.code).toBe(2);
      expect(amb.err).toContain('DESIGN_MD_CONVERT_REFUSED: ambiguous');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('tokens prints the flat map; mark persists the choice', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), SPEC);
      const t = JSON.parse(run(['tokens'], dir).out);
      expect(t.tokens['colors.cta']).toBe('#B8422E');
      expect(t.errors).toEqual([]);
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), LEGACY);
      const m = run(['mark', 'legacy-keep'], dir);
      expect(m.code).toBe(0);
      const text = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8');
      expect(text.split('\n')[0]).toBe('<!-- gstack: design-md-format=legacy-keep -->');
      expect(run(['check'], dir).out).toBe('DESIGN_MD_FORMAT: legacy\nDESIGN_MD_MARKER: legacy-keep\n');
      expect(run(['mark', 'maybe'], dir).code).toBe(2);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('design binary: updateDesignMd is frontmatter-safe', () => {
  const extracted = {
    colors: [{ name: 'Primary', hex: '#F59E0B', usage: 'buttons' }, { name: 'Surface', hex: '#141414', usage: 'cards' }],
    typography: [{ role: 'heading', family: 'Satoshi', size: '48px', weight: '900' }],
    spacing: ['8px base unit'],
    layout: ['max-width 1200px'],
    mood: 'Serious tool built with care.',
  };

  test('spec input: section appended after the canonical ones, front matter bytes untouched, replaces on rerun', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), SPEC);
      updateDesignMd(dir, extracted, '/tmp/mock.png');
      const once = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8');
      expect(once.startsWith(SPEC.slice(0, SPEC.indexOf('\n---\n', 4) + 5))).toBe(true);
      expect([...once.matchAll(/^## (.+)$/gm)].map(m => m[1]).at(-1)).toBe('Extracted Design Language');
      expect(once.split('## Extracted Design Language').length - 1).toBe(1);
      updateDesignMd(dir, { ...extracted, mood: 'second pass' }, '/tmp/mock2.png');
      const twice = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8');
      expect(twice.split('## Extracted Design Language').length - 1).toBe(1);
      expect(twice).toContain('second pass');
      expect(twice).not.toContain('Serious tool built with care.');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('legacy input: sections preserved, extracted section added at the end', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      fs.writeFileSync(path.join(dir, 'DESIGN.md'), LEGACY);
      updateDesignMd(dir, extracted, '/tmp/mock.png');
      const out = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8');
      expect(out.startsWith('# Design System — gstack')).toBe(true);
      expect(out).toContain('## Decisions Log');
      expect([...out.matchAll(/^## (.+)$/gm)].map(m => m[1]).at(-1)).toBe('Extracted Design Language');
      expect(detectFormat(parseDesignMd(out)).format).toBe('legacy');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('absent input: a spec skeleton with tokens from the extraction; readDesignConstraints leads with tokens', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-design-md-'));
    try {
      updateDesignMd(dir, extracted, '/tmp/mock.png');
      const out = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf-8');
      const doc = parseDesignMd(out);
      expect(detectFormat(doc).format).toBe('spec');
      expect(out.split('\n').slice(0, 2)).toEqual(['---', '# gstack: design-md-format=spec']);
      const { tokens } = tokensFlat(doc.frontmatter);
      expect(tokens['colors.primary']).toBe('#F59E0B');
      expect(tokens['typography.heading.fontFamily']).toBe('Satoshi');
      expect([...out.matchAll(/^## (.+)$/gm)].map(m => m[1])).toEqual(['Overview', 'Extracted Design Language']);
      const constraints = readDesignConstraints(dir)!;
      expect(constraints.startsWith('Tokens: colors.primary: #F59E0B')).toBe(true);
      expect(constraints).toContain('Serious tool built with care.');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
