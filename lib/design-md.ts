// lib/design-md.ts — read and write DESIGN.md in the open DESIGN.md format.
//
// Implements the DESIGN.md specification (google-labs-code/design.md, Google LLC,
// Apache-2.0): YAML front matter carrying the design tokens, a markdown body in
// eight canonical `##` sections. See NOTICE.md. Pure module: no I/O, no imports
// from scripts/; bin/gstack-design-md.ts and design/src/memory.ts do the file work.
//
//   text ──► parseDesignMd ──► DesignMdDoc { frontmatterText (bytes preserved), frontmatter, marker,
//                                             preamble, sections[] }
//        ──► detectFormat   ──► spec | legacy | unknown | missing (+ reason)
//        ──► convertLegacy  ──► gstack's pre-spec DESIGN.md (Product Context, Aesthetic Direction,
//                               Typography, Color, Spacing, Layout, Motion, Decisions Log) becomes
//                               tokens + canonical sections; Motion and Decisions Log survive as extras
//        ──► upsertSection  ──► body-only splice; front matter bytes are never re-emitted
//        ──► renderDesignMd ──► marker, front matter, preamble, canonical sections in order, extras
//        ──► tokensFlat     ──► "colors.primary" → "#F59E0B"; {path} refs resolved to primitives
//
// Format marker (the user's one-time conversion answer, persisted in the file):
//   spec files:   line 1 `---`, line 2 `# gstack: design-md-format=spec` (a YAML comment, so
//                 parsers that require `---` on line 1 keep working)
//   legacy files: line 1 `<!-- gstack: design-md-format=legacy-keep -->`

import { SENTINEL } from './design-detect-contract';

export const CANONICAL_SECTIONS = [
  'Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts",
] as const;
export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number];

/** Spec aliases (and a few punctuation variants) → canonical heading. */
export const SECTION_ALIASES: Record<string, CanonicalSection> = {
  'brand & style': 'Overview',
  'brand and style': 'Overview',
  'layout & spacing': 'Layout',
  'layout and spacing': 'Layout',
  'elevation': 'Elevation & Depth',
  'elevation and depth': 'Elevation & Depth',
  "do's and don'ts": "Do's and Don'ts",
  'dos and donts': "Do's and Don'ts",
  "do’s and don’ts": "Do's and Don'ts",
};

export const TOKEN_GROUPS = ['colors', 'typography', 'rounded', 'spacing', 'components'] as const;
export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export const FORMAT_MARKER_PREFIX = 'gstack: design-md-format=';
export type FormatChoice = 'spec' | 'legacy-keep';
export type DesignMdFormat = 'spec' | 'legacy' | 'unknown' | 'missing';

/** Headings that identify gstack's pre-spec DESIGN.md. */
export const LEGACY_HEADINGS = ['Product Context', 'Aesthetic Direction', 'Color', 'Spacing', 'Decisions Log'];

export interface Section {
  heading: string;
  /** canonical name when the heading (or an alias) is one of the eight */
  canonical?: CanonicalSection;
  /** body text between this heading and the next `##`, without the trailing blank run */
  body: string;
}

export interface DesignMdDoc {
  /** raw YAML between the fences, bytes preserved (null when no front matter) */
  frontmatterText: string | null;
  /** parsed YAML (null when absent or unparsable) */
  frontmatter: Record<string, unknown> | null;
  frontmatterError?: string;
  marker: FormatChoice | null;
  /** text between the front matter (or file start) and the first `##` heading, trimmed */
  preamble: string;
  sections: Section[];
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function canonicalFor(heading: string): CanonicalSection | undefined {
  const key = heading.trim().toLowerCase();
  const direct = CANONICAL_SECTIONS.find(c => c.toLowerCase() === key);
  return direct ?? SECTION_ALIASES[key];
}

function parseYaml(text: string): { value: Record<string, unknown> | null; error?: string } {
  try {
    const v = (Bun as unknown as { YAML: { parse(s: string): unknown } }).YAML.parse(text);
    if (v === null || v === undefined) return { value: {} };
    if (typeof v !== 'object' || Array.isArray(v)) return { value: null, error: 'front matter is not a mapping' };
    return { value: v as Record<string, unknown> };
  } catch (e) {
    return { value: null, error: (e as Error).message.split('\n')[0].slice(0, 200) };
  }
}

export function parseDesignMd(text: string): DesignMdDoc {
  const src = text.replace(/\r\n/g, '\n');
  let rest = src;
  let marker: FormatChoice | null = null;
  let frontmatterText: string | null = null;
  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterError: string | undefined;

  const legacyMarker = rest.match(/^<!--\s*gstack: design-md-format=(spec|legacy-keep)\s*-->\n?/);
  if (legacyMarker) {
    marker = legacyMarker[1] as FormatChoice;
    rest = rest.slice(legacyMarker[0].length);
  }
  if (rest.startsWith('---\n')) {
    const end = rest.indexOf('\n---', 4);
    if (end !== -1 && (rest[end + 4] === '\n' || end + 4 === rest.length)) {
      frontmatterText = rest.slice(4, end + 1);
      const m = frontmatterText.match(/^# gstack: design-md-format=(spec|legacy-keep)\s*$/m);
      if (m) marker = m[1] as FormatChoice;
      const parsed = parseYaml(frontmatterText);
      frontmatter = parsed.value;
      frontmatterError = parsed.error;
      rest = rest.slice(end + 5);
    }
  }

  const lines = rest.split('\n');
  const sections: Section[] = [];
  const preambleLines: string[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    const h = !inFence ? line.match(/^## (.+?)\s*$/) : null;
    if (h) {
      if (cur) sections.push(finish(cur));
      cur = { heading: h[1], lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  if (cur) sections.push(finish(cur));
  return { frontmatterText, frontmatter, frontmatterError, marker, preamble: preambleLines.join('\n').trim(), sections };

  function finish(c: { heading: string; lines: string[] }): Section {
    const canonical = canonicalFor(c.heading);
    return { heading: c.heading, ...(canonical ? { canonical } : {}), body: c.lines.join('\n').replace(/\s+$/, '') };
  }
}

// ── Format detection ─────────────────────────────────────────────────────────

export function isLegacyGstackFormat(doc: DesignMdDoc): boolean {
  const headings = new Set(doc.sections.map(s => s.heading.trim().toLowerCase()));
  const hits = LEGACY_HEADINGS.filter(h => headings.has(h.toLowerCase())).length;
  return doc.frontmatterText === null && hits >= 2;
}

export function hasSpecFrontmatter(doc: DesignMdDoc): boolean {
  if (!doc.frontmatter) return false;
  return TOKEN_GROUPS.some(g => g in doc.frontmatter!) || 'name' in doc.frontmatter;
}

export function detectFormat(doc: DesignMdDoc | null): { format: DesignMdFormat; reason?: string } {
  if (!doc) return { format: 'missing' };
  if (doc.frontmatterText !== null && doc.frontmatter === null) {
    return { format: 'unknown', reason: `front matter does not parse: ${doc.frontmatterError ?? 'unknown error'}` };
  }
  const spec = hasSpecFrontmatter(doc);
  const legacyHeadings = doc.sections.filter(s => ['product context', 'aesthetic direction'].includes(s.heading.trim().toLowerCase())).length > 0;
  if (spec && legacyHeadings) return { format: 'unknown', reason: 'ambiguous (legacy headings and front matter both present)' };
  if (spec) return { format: 'spec' };
  if (isLegacyGstackFormat(doc)) return { format: 'legacy' };
  if (doc.frontmatterText !== null) return { format: 'unknown', reason: 'front matter carries none of the five token groups' };
  return { format: 'unknown', reason: 'no front matter and no gstack legacy headings' };
}

// ── YAML block emitter ───────────────────────────────────────────────────────

function needsQuotes(s: string): boolean {
  return s === '' || /^[\s#&*!|>'"%@`{[\]},:?-]|[:#]\s|\s$|^(true|false|null|yes|no|on|off|~)$|^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/i.test(s);
}

function yamlScalar(v: unknown): string {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null || v === undefined) return '""';
  const s = String(v);
  return needsQuotes(s) ? JSON.stringify(s) : s;
}

/** Block-style YAML for nested mappings of scalars (Bun.YAML.stringify emits flow style). */
export function emitYamlBlock(obj: Record<string, unknown>, indent = 0): string {
  const pad = ' '.repeat(indent);
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = needsQuotes(k) ? JSON.stringify(k) : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(`${pad}${key}:`);
      out.push(emitYamlBlock(v as Record<string, unknown>, indent + 2));
    } else if (Array.isArray(v)) {
      out.push(`${pad}${key}:`);
      for (const item of v) out.push(`${pad}  - ${yamlScalar(item)}`);
    } else {
      out.push(`${pad}${key}: ${yamlScalar(v)}`);
    }
  }
  return out.join('\n');
}

// ── Rendering ────────────────────────────────────────────────────────────────

export interface RenderOptions {
  /** emit fresh front matter from `frontmatter` instead of the preserved bytes (convert only) */
  emitFrontmatter?: boolean;
}

export function renderDesignMd(doc: DesignMdDoc, opts: RenderOptions = {}): string {
  const parts: string[] = [];
  const fm = opts.emitFrontmatter && doc.frontmatter ? emitYamlBlock(doc.frontmatter) + '\n' : doc.frontmatterText;
  if (fm !== null) {
    const body = fm.replace(/^# gstack: design-md-format=(spec|legacy-keep)\s*\n/m, '');
    parts.push('---');
    if (doc.marker) parts.push(`# ${FORMAT_MARKER_PREFIX}${doc.marker}`);
    parts.push(body.replace(/\n$/, ''));
    parts.push('---');
    if (doc.preamble) parts.push('', doc.preamble);
  } else {
    if (doc.marker) parts.push(`<!-- ${FORMAT_MARKER_PREFIX}${doc.marker} -->`);
    if (doc.preamble) parts.push(doc.preamble);
  }
  const canonical = CANONICAL_SECTIONS
    .map(c => doc.sections.find(s => s.canonical === c))
    .filter((s): s is Section => Boolean(s));
  const extras = doc.sections.filter(s => !s.canonical);
  for (const s of [...canonical, ...extras]) {
    parts.push('', `## ${s.canonical ?? s.heading}`);
    if (s.body.trim()) parts.push('', s.body.trim());
  }
  return parts.join('\n').replace(/^\n+/, '') + '\n';
}

/** Replace or add a section; canonical names slot into spec order, extras append. Body-only: front matter bytes untouched. */
export function upsertSection(doc: DesignMdDoc, heading: string, body: string): DesignMdDoc {
  const canonical = canonicalFor(heading);
  const sections = doc.sections.map(s => ({ ...s }));
  const idx = sections.findIndex(s => (canonical ? s.canonical === canonical : s.heading.trim().toLowerCase() === heading.trim().toLowerCase()));
  const next: Section = { heading: canonical ?? heading, ...(canonical ? { canonical } : {}), body: body.replace(/\s+$/, '') };
  if (idx >= 0) sections[idx] = next; else sections.push(next);
  return { ...doc, sections };
}

export function setMarker(doc: DesignMdDoc, marker: FormatChoice): DesignMdDoc {
  return { ...doc, marker };
}

// ── Tokens ───────────────────────────────────────────────────────────────────

export interface FlatTokens {
  tokens: Record<string, string>;
  errors: string[];
}

/** Flatten the five token groups to dotted paths; resolve `{path}` references to primitives. */
export function tokensFlat(frontmatter: Record<string, unknown> | null): FlatTokens {
  const tokens: Record<string, string> = {};
  const errors: string[] = [];
  if (!frontmatter) return { tokens, errors };
  const raw: Record<string, unknown> = {};
  const walk = (prefix: string, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(prefix ? `${prefix}.${k}` : k, x);
    } else if (v !== null && v !== undefined && !Array.isArray(v)) {
      raw[prefix] = v;
    }
  };
  for (const g of TOKEN_GROUPS) if (g in frontmatter) walk(g, frontmatter[g]);
  const groups = new Set(Object.keys(raw).map(k => k.split('.').slice(0, -1).join('.')).filter(Boolean));
  for (const [k, v] of Object.entries(raw)) {
    const s = String(v);
    const ref = s.match(/^\{([a-zA-Z0-9_.-]+)\}$/);
    if (!ref) { tokens[k] = s; continue; }
    const target = ref[1];
    if (target === k) { errors.push(`${SENTINEL.DESIGN_MD_TOKEN_REF_INVALID}: {${target}} (self-reference)`); continue; }
    if (groups.has(target) || TOKEN_GROUPS.includes(target as TokenGroup)) { errors.push(`${SENTINEL.DESIGN_MD_TOKEN_REF_INVALID}: {${target}} (refers to a group, not a primitive)`); continue; }
    let seen = 0;
    let cur: unknown = raw[target];
    let curKey = target;
    while (typeof cur === 'string' && /^\{[a-zA-Z0-9_.-]+\}$/.test(cur) && seen < 8) {
      curKey = cur.slice(1, -1);
      cur = raw[curKey];
      seen++;
    }
    if (cur === undefined) { errors.push(`${SENTINEL.DESIGN_MD_TOKEN_REF_INVALID}: {${target}} (no such token)`); continue; }
    if (typeof cur === 'string' && /^\{/.test(cur)) { errors.push(`${SENTINEL.DESIGN_MD_TOKEN_REF_INVALID}: {${target}} (reference cycle)`); continue; }
    tokens[k] = String(cur);
  }
  return { tokens, errors };
}

// ── Legacy conversion ────────────────────────────────────────────────────────

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'token';
}

/** Legacy Color bullets whose label names a strategy or a mode, not a color. */
const NOT_COLOR_LABELS = new Set(['approach', 'semantic', 'dark mode', 'light mode', 'neutrals', 'contrast', 'strategy']);

function bullets(body: string): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s+\*\*(.+?):?\*\*:?\s*(.*)$/);
    if (m) out.push({ key: m[1].trim().replace(/:$/, ''), value: m[2].trim() });
  }
  return out;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function sectionBody(doc: DesignMdDoc, heading: string): string | undefined {
  return doc.sections.find(s => s.heading.trim().toLowerCase() === heading.toLowerCase())?.body;
}

function firstFontName(value: string): string | undefined {
  const m = value.match(/^([A-Z][A-Za-z0-9 ]+?)(?:\s*\(|\s+—|\s+-\s|,|$)/);
  return m ? m[1].trim() : undefined;
}

/**
 * Convert gstack's pre-spec DESIGN.md into the open format. Product Context and
 * Aesthetic Direction fold into Overview; Typography roles become
 * typography.display/body/label/mono; Color hexes become colors; the Spacing
 * scale becomes spacing; the Layout border radii become rounded; everything else
 * (Motion, Decisions Log, Grain Texture, ...) survives as an extra section in
 * its original order. Idempotent: converting the render again changes nothing.
 */
export function convertLegacy(doc: DesignMdDoc, opts: { name?: string } = {}): DesignMdDoc {
  const title = doc.preamble.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const name = opts.name ?? (title ? title.replace(/^Design System\s*[—–-]\s*/i, '').trim() : 'Design System');
  const fm: Record<string, unknown> = { name };

  const overview: string[] = [];
  const product = sectionBody(doc, 'Product Context');
  const aesthetic = sectionBody(doc, 'Aesthetic Direction');
  if (product) overview.push(product.trim());
  if (aesthetic) overview.push(aesthetic.trim());

  // Typography
  const typo = sectionBody(doc, 'Typography');
  const typography: Record<string, Record<string, string>> = {};
  if (typo) {
    const roleMap: Array<[RegExp, string]> = [
      [/^display/i, 'display'], [/^hero/i, 'display'], [/^body/i, 'body'], [/^ui/i, 'label'], [/^label/i, 'label'],
      [/^data/i, 'mono'], [/^code/i, 'mono'], [/^mono/i, 'mono'],
    ];
    for (const b of bullets(typo)) {
      const role = roleMap.find(([re]) => re.test(b.key))?.[1];
      if (!role || typography[role]) continue;
      if (/same as/i.test(b.value)) { const src = b.value.match(/same as (\w+)/i)?.[1]?.toLowerCase(); if (src && typography[src]) typography[role] = { ...typography[src] }; continue; }
      const family = firstFontName(b.value);
      if (!family) continue;
      const t: Record<string, string> = { fontFamily: family };
      if (role === 'mono') t.fontFeature = 'tnum';
      typography[role] = t;
    }
  }
  if (Object.keys(typography).length) fm.typography = typography;

  // Colors
  const color = sectionBody(doc, 'Color') ?? sectionBody(doc, 'Colors');
  const colors: Record<string, string> = {};
  if (color) {
    for (const line of color.split('\n')) {
      const hex = line.match(HEX)?.[0];
      if (!hex) continue;
      const label = (line.match(/\*\*(.+?):?\*\*/)?.[1] ?? line.match(/^\s*-\s*([^:]+):/)?.[1])?.replace(/:$/, '').trim();
      if (!label || NOT_COLOR_LABELS.has(label.toLowerCase())) continue;
      const key = slug(label);
      if (!(key in colors)) colors[key] = hex;
    }
    // semantic line: "success #22C55E, warning #F59E0B, ..."
    const semantic = color.match(/\*\*Semantic:\*\*\s*(.+)$/m)?.[1];
    if (semantic) for (const m of semantic.matchAll(/([a-z]+)\s+(#[0-9a-fA-F]{3,8})/g)) if (!(m[1] in colors)) colors[m[1]] = m[2];
  }
  if (Object.keys(colors).length) fm.colors = colors;

  // Spacing scale "2xs(2px) xs(4px) ..."
  const spacingBody = sectionBody(doc, 'Spacing');
  const spacing: Record<string, string> = {};
  if (spacingBody) {
    const scale = spacingBody.match(/\*\*Scale:\*\*\s*(.+)$/m)?.[1];
    if (scale) for (const m of scale.matchAll(/([0-9a-z]+)\(([^)]+)\)/g)) spacing[m[1]] = /px|rem|em$/.test(m[2]) ? m[2] : `${m[2]}px`;
  }
  if (Object.keys(spacing).length) fm.spacing = spacing;

  // Border radius "sm:4px, md:8px, lg:12px, full:9999px"
  const layoutBody = sectionBody(doc, 'Layout');
  const rounded: Record<string, string> = {};
  if (layoutBody) {
    const radius = layoutBody.match(/\*\*Border radius:\*\*\s*(.+)$/m)?.[1];
    if (radius) for (const m of radius.matchAll(/([a-z0-9]+):\s*([0-9.]+(?:px|rem|em))/g)) rounded[m[1]] = m[2];
  }
  if (Object.keys(rounded).length) fm.rounded = rounded;

  const consumed = new Set(['product context', 'aesthetic direction', 'typography', 'color', 'colors', 'spacing', 'layout']);
  const sections: Section[] = [];
  sections.push({ heading: 'Overview', canonical: 'Overview', body: overview.join('\n\n') || '(no product context recorded)' });
  if (color) sections.push({ heading: 'Colors', canonical: 'Colors', body: color.trim() });
  if (typo) sections.push({ heading: 'Typography', canonical: 'Typography', body: typo.trim() });
  const layoutParts = [layoutBody?.trim(), spacingBody ? `### Spacing\n${spacingBody.trim()}` : undefined].filter(Boolean) as string[];
  if (layoutParts.length) sections.push({ heading: 'Layout', canonical: 'Layout', body: layoutParts.join('\n\n') });
  for (const s of doc.sections) {
    if (consumed.has(s.heading.trim().toLowerCase())) continue;
    sections.push(s.canonical ? { ...s } : { heading: s.heading, body: s.body });
  }
  return {
    frontmatterText: emitYamlBlock(fm) + '\n',
    frontmatter: fm,
    marker: 'spec',
    preamble: title ? `# ${title}` : doc.preamble,
    sections,
  };
}

/** A minimal spec-format document (used when a tool must create DESIGN.md from scratch). */
export function specSkeleton(name: string, frontmatter: Record<string, unknown>, sections: Array<{ heading: string; body: string }>): DesignMdDoc {
  const fm = { name, ...frontmatter };
  const doc: DesignMdDoc = { frontmatterText: emitYamlBlock(fm) + '\n', frontmatter: fm, marker: 'spec', preamble: `# ${name}`, sections: [] };
  return sections.reduce((d, s) => upsertSection(d, s.heading, s.body), doc);
}
