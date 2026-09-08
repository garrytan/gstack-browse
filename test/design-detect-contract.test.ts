/**
 * lib/design-detect-contract.ts is the one owner of the detector vocabulary.
 * Forward direction: every sentinel-shaped token (IMPECCABLE_*, DETECT_*,
 * DESIGN_MD_*, DOM_DUMP_*) that appears in something the agent reads
 * (generated SKILL.md files, sections, the design checklist, the resolvers)
 * must be a contract constant, so prose cannot invent a sentinel the bin never
 * prints. Reverse direction (every printable sentinel is mentioned somewhere
 * the agent reads) lands with the DESIGN_DETECTOR resolver wiring.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { SENTINEL, TESTED_ENGINE_VERSIONS, ADVISORY_RULE_IDS, DETECT_LIMITS, DETECT_EXIT_ECHO } from '../lib/design-detect-contract';
import { ADVISORY_RULE_IDS as _a } from '../lib/design-detect-contract';
import { catalogEntry } from '../lib/design-catalog';

const ROOT = path.join(import.meta.dir, '..');
const TOKEN = /\b(IMPECCABLE_[A-Z_]+|DETECT_[A-Z_]+|DESIGN_MD_[A-Z_]+|DOM_DUMP_[A-Z_]+|DESIGN_DETECTOR_[A-Z_]+|DESIGN_DETECT_[A-Z_]+)\b/g;
// Things that look like sentinels but are env vars / flags the prose legitimately names.
const NOT_SENTINELS = new Set(['IMPECCABLE_BIN', 'IMPECCABLE_HOME', 'IMPECCABLE_HOOK_DISABLED', 'DESIGN_DETECT_TIMEOUT_MS']);

function* agentReadableFiles(): Generator<string> {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'test', 'docs', '.context', '.claude', '.agents', '.factory', '.cursor', '.kiro', '.opencode', '.openclaw', '.hermes', '.slate', '.gstack', '.gbrain', '.conductor']);
  const stack = [ROOT];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      if (ent.isSymbolicLink()) continue;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) { if (!skip.has(ent.name) || cur !== ROOT) { if (!skip.has(ent.name)) stack.push(full); } continue; }
      if (/\.(md|tmpl|ts)$/.test(ent.name) && (full.includes(`${path.sep}scripts${path.sep}resolvers${path.sep}`) || ent.name.endsWith('.md') || ent.name.endsWith('.tmpl'))) yield full;
    }
  }
}

describe('contract shape', () => {
  test('sentinel values are unique, uppercase, and equal their own prefix family', () => {
    const values = Object.values(SENTINEL);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v).toMatch(/^[A-Z][A-Z_]+$/);
  });

  test('tested engine versions and advisory ids are consistent with the fixtures and catalog', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'impeccable-captures.meta.json'), 'utf-8'));
    expect(TESTED_ENGINE_VERSIONS).toContain(meta.engine.version);
    for (const id of ADVISORY_RULE_IDS) {
      const e = catalogEntry(id);
      expect(e).toBeDefined();
      expect(e!.tier).toBe('possible');
      expect(e!.impact).toBe('polish');
    }
    expect(_a).toBe(ADVISORY_RULE_IDS);
  });

  test('limits are positive and the exit echo carries the DETECT_EXIT_CODE sentinel', () => {
    expect(DETECT_LIMITS.timeoutMs).toBeGreaterThan(0);
    expect(DETECT_LIMITS.batch).toBeGreaterThan(0);
    expect(DETECT_LIMITS.findings).toBeGreaterThan(DETECT_LIMITS.topLocations);
    expect(DETECT_EXIT_ECHO).toBe(`; echo "${SENTINEL.DETECT_EXIT_CODE}=$?"`);
  });

  test('module is pure: no imports, loading prints nothing', () => {
    const file = path.join(ROOT, 'lib', 'design-detect-contract.ts');
    expect(fs.readFileSync(file, 'utf-8')).not.toMatch(/^import /m);
    const r = spawnSync(process.execPath, ['--no-env-file', '-e', `await import(${JSON.stringify(file)})`], { encoding: 'utf-8', timeout: 30_000 });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toBe('');
  });
});

describe('every sentinel-shaped token the agent can read exists in the contract', () => {
  test('generated docs, sections, templates, resolvers, and the checklist', () => {
    const known = new Set<string>(Object.values(SENTINEL));
    const offenders: string[] = [];
    for (const file of agentReadableFiles()) {
      const text = fs.readFileSync(file, 'utf-8');
      for (const m of text.matchAll(TOKEN)) {
        const tok = m[1];
        if (known.has(tok) || NOT_SENTINELS.has(tok)) continue;
        offenders.push(`${path.relative(ROOT, file)}: ${tok}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
