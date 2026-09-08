#!/usr/bin/env bun
/**
 * gstack-design-md — inspect, convert, and read DESIGN.md in the open format.
 *
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-md.ts check [DESIGN.md]
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-md.ts convert [DESIGN.md] [--write]
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-md.ts tokens [DESIGN.md]
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-md.ts mark <spec|legacy-keep> [DESIGN.md]
 *
 * check    DESIGN_MD_FORMAT: spec | legacy | unknown | missing (+ DESIGN_MD_REASON for unknown),
 *          DESIGN_MD_MARKER: spec | legacy-keep | none. Exit 0.
 * convert  Legacy → spec (lib/design-md.ts convertLegacy). Prints the result; with --write,
 *          backs the original up to DESIGN.md.legacy.bak and writes temp+rename. Refuses an
 *          ambiguous file (DESIGN_MD_CONVERT_REFUSED, exit 2) and a non-legacy one (exit 1).
 * tokens   Flat token map as JSON ({"colors.primary": "#F59E0B", ...}); {path} refs resolved;
 *          invalid refs listed under "errors" (DESIGN_MD_TOKEN_REF_INVALID). Exit 0.
 * mark     Persist the user's one-time format choice inside the file: spec files get a YAML
 *          comment on line 2, legacy files an HTML comment on line 1. Body bytes untouched.
 *
 * Exit 3 + DESIGN_MD_INTERNAL_ERROR is a gstack bug. YAML errors never propagate: a file whose
 * front matter does not parse is `unknown` with a reason.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SENTINEL } from '../lib/design-detect-contract';
import {
  parseDesignMd, detectFormat, convertLegacy, renderDesignMd, tokensFlat, setMarker,
  type DesignMdDoc, type FormatChoice,
} from '../lib/design-md';

function resolveFile(arg?: string): string {
  return path.resolve(arg && !arg.startsWith('--') ? arg : 'DESIGN.md');
}

function load(file: string): { text: string; doc: DesignMdDoc } | null {
  try { const text = fs.readFileSync(file, 'utf-8'); return { text, doc: parseDesignMd(text) }; } catch { return null; }
}

function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function main(argv = process.argv.slice(2)): number {
  const verb = argv[0] ?? '';
  const flags = new Set(argv.filter(a => a.startsWith('--')));
  const positional = argv.slice(1).filter(a => !a.startsWith('--'));

  switch (verb) {
    case 'check': {
      const file = resolveFile(positional[0]);
      const loaded = load(file);
      const { format, reason } = detectFormat(loaded?.doc ?? null);
      process.stdout.write(`${SENTINEL.DESIGN_MD_FORMAT}: ${format}\n`);
      if (reason) process.stdout.write(`DESIGN_MD_REASON: ${reason}\n`);
      process.stdout.write(`DESIGN_MD_MARKER: ${loaded?.doc.marker ?? 'none'}\n`);
      return 0;
    }
    case 'convert': {
      const file = resolveFile(positional[0]);
      const loaded = load(file);
      const { format, reason } = detectFormat(loaded?.doc ?? null);
      if (format === 'unknown' && reason?.startsWith('ambiguous')) {
        process.stderr.write(`${SENTINEL.DESIGN_MD_CONVERT_REFUSED}: ${reason}\n`);
        return 2;
      }
      if (format !== 'legacy' || !loaded) {
        process.stderr.write(`${SENTINEL.DESIGN_MD_FORMAT}: ${format}${reason ? ` (${reason})` : ''}; convert only accepts a legacy gstack DESIGN.md\n`);
        return 1;
      }
      const out = renderDesignMd(convertLegacy(loaded.doc), { emitFrontmatter: true });
      if (flags.has('--write')) {
        fs.writeFileSync(`${file}.legacy.bak`, loaded.text);
        writeAtomic(file, out);
        process.stdout.write(`${SENTINEL.DESIGN_MD_FORMAT}: spec\nDESIGN_MD_WRITTEN: ${file}\nDESIGN_MD_BACKUP: ${file}.legacy.bak\n`);
      } else {
        process.stdout.write(out);
      }
      return 0;
    }
    case 'tokens': {
      const file = resolveFile(positional[0]);
      const loaded = load(file);
      const flat = tokensFlat(loaded?.doc.frontmatter ?? null);
      process.stdout.write(JSON.stringify({ file, format: detectFormat(loaded?.doc ?? null).format, ...flat }, null, 2) + '\n');
      for (const e of flat.errors) process.stderr.write(e + '\n');
      return 0;
    }
    case 'mark': {
      const choice = positional[0] as FormatChoice | undefined;
      if (choice !== 'spec' && choice !== 'legacy-keep') {
        process.stderr.write('usage: gstack-design-md.ts mark <spec|legacy-keep> [DESIGN.md]\n');
        return 2;
      }
      const file = resolveFile(positional[1]);
      const loaded = load(file);
      if (!loaded) { process.stdout.write(`${SENTINEL.DESIGN_MD_FORMAT}: missing\n`); return 1; }
      writeAtomic(file, renderDesignMd(setMarker(loaded.doc, choice)));
      process.stdout.write(`DESIGN_MD_MARKER: ${choice}\n`);
      return 0;
    }
    default:
      process.stderr.write('usage: gstack-design-md.ts check [file] | convert [file] [--write] | tokens [file] | mark <spec|legacy-keep> [file]\n');
      return 2;
  }
}

if (import.meta.main) {
  try {
    process.exitCode = main();
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`${SENTINEL.DESIGN_MD_INTERNAL_ERROR}: ${e?.name ?? 'Error'}: ${String(e?.message ?? e).slice(0, 300)}\n`);
    process.exitCode = 3;
  }
}
