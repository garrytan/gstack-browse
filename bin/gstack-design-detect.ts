#!/usr/bin/env bun
/**
 * gstack-design-detect — find, and run, an impeccable engine the USER installed.
 *
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-detect.ts probe [--host <h>] [--verbose]
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-detect.ts scan [--format gstack|raw] [--changed <base>] [--host <h>] <paths...>
 *   bun --no-env-file run ~/.claude/skills/gstack/bin/gstack-design-detect.ts rules
 *
 * Rule zero: gstack never installs, downloads, or executes anything that could
 * download. The probe touches the filesystem and the environment only: file
 * existence, a first-bytes sniff, JSON parsing. It never runs impeccable's
 * launcher (`scripts/impeccable`) or its npm shim, because both fall through to a
 * GitHub download when the engine is not cached.
 *
 * Probe order (first hit wins; every step is a read):
 *
 *   design_detector config ── off ──► IMPECCABLE_DISABLED
 *          │ auto
 *   $IMPECCABLE_BIN (absolute, realpath outside repo/cwd, executable, not a script) ──► READY
 *          │
 *   PATH walk (absolute entries only, none inside repo/cwd; `impeccable[.exe]`) ─┬─ binary ──► READY
 *          │                                                                     └─ #! shim ──► launcher-present
 *   $IMPECCABLE_HOME|~/.impeccable/bin/<newest semver>/impeccable[.exe] ──► READY
 *          │
 *   <repo|cwd|~>/{.claude,.agents,.cursor,.gemini,.github,.opencode}/skills/impeccable/scripts/
 *          ├─ bin/<os>-<arch>/impeccable[.exe] (engine installed beside the launcher) ──► READY
 *          └─ impeccable (launcher only) ──► IMPECCABLE_NOT_CACHED: <launcher>
 *          │
 *   nothing ──► IMPECCABLE_NOT_AVAILABLE
 *
 * Never probed: project-local node_modules (executing a binary that lives inside
 * the repository under review is not something gstack does anywhere).
 *
 * Sentinel contract: lib/design-detect-contract.ts (one owner, imported here and
 * by the gen-time resolvers). Scan output: stdout is one JSON document
 * (--format gstack) or the engine's own bytes (--format raw); everything else
 * goes to stderr, matching impeccable's own split. Exit code passes through
 * (1 over 2 over 0); exit 3 is a gstack bug (DESIGN_DETECT_INTERNAL_ERROR).
 *
 * Scan hardening: targets must be existing files under the repo root (or cwd)
 * or under ${GSTACK_HOME:-~/.gstack}/projects/<slug>/designs/ (where design-review
 * keeps rendered-DOM dumps); URLs are refused (the one engine path that talks to
 * the network); the engine runs with stdin ignored (its ">50 files, continue?"
 * prompt is gated on a TTY), a wall-clock timeout with SIGKILL on the direct
 * child, a 50 MB stdout cap, and every string field sanitized and length-capped.
 * The engine's file scan is a single process; if a future engine forks helpers
 * they could outlive the kill (known limit).
 *
 * Env trust: Bun auto-loads a cwd `.env`, so every rendered invocation passes
 * `--no-env-file`, and independently IMPECCABLE_BIN / IMPECCABLE_HOME values
 * whose realpath lies inside the repo or cwd are ignored (IMPECCABLE_ENV_IGNORED).
 *
 * Observability: one content-free JSON line per probe/scan appended to
 * ${GSTACK_HOME:-~/.gstack}/analytics/design-detector.jsonl (local file, no egress).
 *
 * Non-sink: this spawns a third-party binary the user installed over local
 * paths; gstack does not audit that engine's network behavior (NOTICE.md).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import {
  SENTINEL, TESTED_ENGINE_VERSIONS, ADVISORY_RULE_IDS, DETECT_LIMITS,
  UNTRUSTED_BEGIN, UNTRUSTED_END,
  type NormalizedFinding, type ScanResult,
} from '../lib/design-detect-contract';
import { DESIGN_SLOP_CATALOG, entryForImpeccableId } from '../lib/design-catalog';
import { isFrontendPath } from '../lib/frontend-scope';

// ── Environment ──────────────────────────────────────────────────────────────

const WIN = process.platform === 'win32';
const HOME = os.homedir();
const ENV = process.env;

function gstackHome(): string {
  return ENV.GSTACK_STATE_ROOT || ENV.GSTACK_HOME || ENV.GSTACK_STATE_DIR || path.join(HOME, '.gstack');
}

function realpathOrNull(p: string): string | null {
  try { return fs.realpathSync(p); } catch { return null; }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function gitTopLevel(cwd: string): string | null {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8', timeout: 10_000 });
  if (r.status !== 0) return null;
  const top = r.stdout.trim();
  return top ? realpathOrNull(top) : null;
}

/** design_detector, read the way bin/gstack-config resolves it (same STATE_DIR precedence, same default). */
function configDesignDetector(): 'auto' | 'off' {
  const file = path.join(gstackHome(), 'config.yaml');
  try {
    const text = fs.readFileSync(file, 'utf-8');
    let value = '';
    for (const line of text.split('\n')) {
      const m = line.match(/^design_detector:\s*(.*?)\s*$/);
      if (m) value = m[1];
    }
    return value === 'off' ? 'off' : 'auto';
  } catch {
    return 'auto';
  }
}

// ── Probe ────────────────────────────────────────────────────────────────────

const HOSTS_WITH_HOOKS: Record<string, string[]> = {
  claude: ['.claude/settings.local.json', '.claude/settings.json'],
  codex: ['.codex/hooks.json'],
  cursor: ['.cursor/hooks.json'],
  github: ['.github/hooks/impeccable.json'],
  grok: ['.grok/hooks/impeccable.json'],
};
const SKILL_ROOTS = ['.claude', '.agents', '.cursor', '.gemini', '.github', '.opencode'];

interface Probe {
  sentinel: string;            // first line
  engine?: string;             // resolved binary
  engineVersion?: string;      // semver, or sha256:<12>
  launcher?: string;
  skillPresent: boolean;
  hook: 'present' | 'absent' | 'unknown';
  hookOther: string[];
  ignoredRules: string[];
  ignoredFiles: string[];
  notes: string[];             // extra sentinel lines (CONFIG_UNREADABLE, ENV_IGNORED, ENGINE_UNTESTED, HINT)
  steps: string[];             // --verbose trail
  repoRoot: string;
  cwd: string;
}

function isScript(file: string): boolean {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(2);
    const n = fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return n === 2 && buf[0] === 0x23 && buf[1] === 0x21; // "#!"
  } catch {
    return false;
  }
}

function isExecutableFile(file: string): boolean {
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return false;
    if (WIN) return /\.exe$/i.test(file);
    return (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

/**
 * On the PATH walk only: an executable that is not a `#!` script. A node shim
 * named `impeccable` is launcher-present, never READY (running it downloads).
 * Explicit install locations (IMPECCABLE_BIN, the ~/.impeccable/bin cache, the
 * engine beside a skill install's launcher) accept any executable regular file.
 */
function isEngineBinary(file: string): boolean {
  return isExecutableFile(file) && !isScript(file);
}

function semverKey(v: string): number[] | null {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function newestSemverDir(dir: string): string | null {
  let entries: string[];
  try { entries = fs.readdirSync(dir); } catch { return null; }
  const versions = entries.map(e => ({ e, k: semverKey(e) })).filter(x => x.k) as { e: string; k: number[] }[];
  versions.sort((a, b) => (b.k[0] - a.k[0]) || (b.k[1] - a.k[1]) || (b.k[2] - a.k[2]));
  return versions[0]?.e ?? null;
}

function readJsonFile(file: string): { ok: true; value: unknown } | { ok: false; missing: boolean } {
  let text: string;
  try { text = fs.readFileSync(file, 'utf-8'); } catch (e) {
    return { ok: false, missing: (e as NodeJS.ErrnoException).code === 'ENOENT' };
  }
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false, missing: false }; }
}

function trustedEnvPath(name: string, repoRoot: string, cwd: string, notes: string[], steps: string[]): string | null {
  const raw = ENV[name];
  if (!raw) return null;
  if (!path.isAbsolute(raw)) {
    notes.push(`${SENTINEL.ENV_IGNORED}: ${name} is not an absolute path`);
    return null;
  }
  const real = realpathOrNull(raw);
  if (!real) {
    steps.push(`${name}=${raw} does not exist`);
    return null;
  }
  if (isInside(real, repoRoot) || isInside(real, cwd)) {
    notes.push(`${SENTINEL.ENV_IGNORED}: ${name} resolves inside the repository`);
    return null;
  }
  return real;
}

function engineSiblings(launcherDir: string): string[] {
  const arch = process.arch;
  const tags = new Set([
    `${process.platform}-${arch}`,
    `${WIN ? 'windows' : process.platform}-${arch}`,
    `${process.platform}-x64`, `${process.platform}-arm64`,
  ]);
  const name = WIN ? 'impeccable.exe' : 'impeccable';
  return [...tags].map(t => path.join(launcherDir, 'bin', t, name));
}

function probe(host: string, verbose = false): Probe {
  const cwd = realpathOrNull(process.cwd()) ?? process.cwd();
  const repoRoot = gitTopLevel(cwd) ?? cwd;
  const p: Probe = {
    sentinel: SENTINEL.NOT_AVAILABLE, skillPresent: false, hook: 'absent', hookOther: [],
    ignoredRules: [], ignoredFiles: [], notes: [], steps: [], repoRoot, cwd,
  };
  const step = (s: string) => { if (verbose) p.steps.push(s); };

  // 0. config
  const cfg = configDesignDetector();
  step(`design_detector=${cfg}`);

  // Always computed: skill / launcher / hook / ignores (informational even when disabled).
  const roots = [...new Set([repoRoot, cwd, HOME])];
  let siblingEngine: string | null = null;
  let siblingVersion: string | null = null;
  for (const root of roots) {
    for (const sub of SKILL_ROOTS) {
      const skillDir = path.join(root, sub, 'skills', 'impeccable');
      if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) p.skillPresent = true;
      const launcher = path.join(skillDir, 'scripts', 'impeccable');
      if (fs.existsSync(launcher)) {
        p.launcher ??= launcher;
        for (const cand of engineSiblings(path.dirname(launcher))) {
          if (!siblingEngine && isExecutableFile(cand)) {
            siblingEngine = cand;
            try { siblingVersion = fs.readFileSync(path.join(path.dirname(launcher), 'VERSION'), 'utf-8').trim() || null; } catch { /* no VERSION file */ }
          }
        }
      }
    }
  }
  step(`skill=${p.skillPresent} launcher=${p.launcher ?? 'none'} sibling=${siblingEngine ?? 'none'}`);

  // Hook manifests, host-aware.
  const mine = HOSTS_WITH_HOOKS[host] ?? [];
  let hookEnabled = true;
  for (const cfgName of ['config.json', 'config.local.json']) {
    const file = path.join(repoRoot, '.impeccable', cfgName);
    const r = readJsonFile(file);
    if (!r.ok) {
      if (!r.missing) p.notes.push(`${SENTINEL.CONFIG_UNREADABLE}: ${file}`);
      continue;
    }
    const v = r.value as { hook?: { enabled?: unknown }; detector?: { ignoreRules?: unknown; ignoreFiles?: unknown } };
    if (v && typeof v === 'object') {
      if (v.hook && typeof v.hook === 'object' && 'enabled' in v.hook) hookEnabled = v.hook.enabled !== false;
      const rules = Array.isArray(v.detector?.ignoreRules) ? v.detector!.ignoreRules : [];
      const files = Array.isArray(v.detector?.ignoreFiles) ? v.detector!.ignoreFiles : [];
      for (const x of rules) if (typeof x === 'string') p.ignoredRules.push(sanitizeId(x) ?? 'unmapped');
      for (const x of files) if (typeof x === 'string') p.ignoredFiles.push(clip(stripControl(x), DETECT_LIMITS.field.file));
    }
  }
  p.ignoredRules = [...new Set(p.ignoredRules)];
  p.ignoredFiles = [...new Set(p.ignoredFiles)];
  let unknown = false;
  for (const [h, manifests] of Object.entries(HOSTS_WITH_HOOKS)) {
    for (const rel of manifests) {
      const file = path.join(repoRoot, rel);
      const r = readJsonFile(file);
      if (!r.ok) { if (!r.missing && mine.includes(rel)) unknown = true; continue; }
      const text = JSON.stringify(r.value);
      if (!/impeccable\s+hook/.test(text) && !/skills\/impeccable\/scripts\/impeccable/.test(text)) continue;
      if (mine.includes(rel)) p.hook = 'present'; else if (!p.hookOther.includes(h)) p.hookOther.push(h);
    }
  }
  if (p.hook !== 'present' && unknown) p.hook = 'unknown';
  if (!hookEnabled) { p.hook = 'absent'; step('hook.enabled=false in .impeccable config'); }

  if (cfg === 'off') {
    p.sentinel = SENTINEL.DISABLED;
    return p;
  }

  // 2. IMPECCABLE_BIN
  const envBin = trustedEnvPath('IMPECCABLE_BIN', repoRoot, cwd, p.notes, p.steps);
  if (envBin && isExecutableFile(envBin)) {
    p.sentinel = `${SENTINEL.READY}: ${envBin}`;
    p.engine = envBin;
  } else if (envBin) {
    step(`IMPECCABLE_BIN=${envBin} is not an executable file`);
  }

  // 3. PATH walk
  let launcherOnPath: string | null = null;
  if (!p.engine) {
    const exts = WIN ? (ENV.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(e => e.toLowerCase()) : [''];
    for (const entry of (ENV.PATH || '').split(path.delimiter)) {
      if (!entry || !path.isAbsolute(entry)) continue;
      const real = realpathOrNull(entry);
      if (!real || isInside(real, repoRoot) || isInside(real, cwd)) continue;
      for (const ext of exts) {
        const cand = path.join(real, `impeccable${ext}`);
        if (!fs.existsSync(cand)) continue;
        if (isEngineBinary(cand)) { p.engine = cand; p.sentinel = `${SENTINEL.READY}: ${cand}`; break; }
        launcherOnPath ??= cand; // node shim or .cmd wrapper: launcher present, engine not proven
      }
      if (p.engine) break;
    }
    step(`PATH walk: engine=${p.engine ?? 'none'} shim=${launcherOnPath ?? 'none'}`);
  }

  // 4. cache
  if (!p.engine) {
    const homeOverride = trustedEnvPath('IMPECCABLE_HOME', repoRoot, cwd, p.notes, p.steps);
    const cacheRoot = homeOverride ?? path.join(HOME, '.impeccable');
    const binDir = path.join(cacheRoot, 'bin');
    const newest = newestSemverDir(binDir);
    if (newest) {
      const cand = path.join(binDir, newest, WIN ? 'impeccable.exe' : 'impeccable');
      if (isExecutableFile(cand)) { p.engine = cand; p.engineVersion = newest.replace(/^v/, ''); p.sentinel = `${SENTINEL.READY}: ${cand}`; }
    }
    step(`cache ${binDir}: newest=${newest ?? 'none'} engine=${p.engine ?? 'none'}`);
  }

  // 6. engine beside the launcher
  if (!p.engine && siblingEngine) {
    p.engine = siblingEngine;
    p.engineVersion = siblingVersion ?? undefined;
    p.sentinel = `${SENTINEL.READY}: ${siblingEngine}`;
  }

  if (p.engine) {
    if (!p.engineVersion) {
      // Version sources, in order: the ~/.impeccable/bin/<version>/ cache layout;
      // the skill-install layout (<skill>/scripts/bin/<os>-<arch>/impeccable next
      // to <skill>/scripts/VERSION); else a content hash. Never a filesystem path.
      const m = p.engine.match(/[\\/]bin[\\/](v?\d+\.\d+\.\d+)[\\/]/);
      if (m) p.engineVersion = m[1].replace(/^v/, '');
      else {
        try {
          const v = fs.readFileSync(path.join(path.dirname(p.engine), '..', '..', 'VERSION'), 'utf-8').trim();
          if (semverKey(v)) p.engineVersion = v.replace(/^v/, '');
        } catch { /* no VERSION beside the binary */ }
      }
      p.engineVersion ??= `sha256:${sha256File(p.engine).slice(0, 12)}`;
    }
    if (!TESTED_ENGINE_VERSIONS.includes(p.engineVersion)) p.notes.push(`${SENTINEL.ENGINE_UNTESTED}: ${p.engineVersion}`);
    return p;
  }

  // 6b/7. launcher present but no engine
  const launcher = p.launcher ?? launcherOnPath;
  if (launcher) {
    p.sentinel = `${SENTINEL.NOT_CACHED}: ${launcher}`;
    const how = p.launcher
      ? `run \`${p.launcher} detect --help\` once; it fetches the engine version pinned by your install`
      : 'run `npx impeccable detect --help` once; it fetches the engine';
    p.notes.push(`${SENTINEL.HINT}: impeccable is installed but its engine is not cached; ${how} (gstack never downloads it). Silence this: \`gstack-config set design_detector off\`.`);
    return p;
  }

  p.sentinel = SENTINEL.NOT_AVAILABLE;
  return p;
}

function sha256File(file: string): string {
  try { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return 'unreadable'; }
}

function probeLines(p: Probe): string[] {
  const lines = [p.sentinel, `${SENTINEL.SKILL}: ${p.skillPresent ? 'present' : 'absent'}`, `${SENTINEL.HOOK}: ${p.hook}`];
  if (p.hookOther.length) lines.push(`${SENTINEL.HOOK_OTHER}: ${p.hookOther.join(',')}`);
  lines.push(`${SENTINEL.IGNORED_RULES}: ${p.ignoredRules.join(',')}`);
  lines.push(`${SENTINEL.IGNORED_FILES}: ${p.ignoredFiles.join(',')}`);
  lines.push(...p.notes);
  if (p.steps.length) lines.push(...p.steps.map(s => `PROBE_STEP: ${s}`));
  return lines;
}

// ── Sanitization ─────────────────────────────────────────────────────────────

function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/[\r\n\t]+/g, ' ');
}
function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function sanitizeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^[a-z0-9-]{1,64}$/.test(s) ? s : null;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

// ── Scan ─────────────────────────────────────────────────────────────────────

interface ScanArgs { format: 'gstack' | 'raw'; changed?: string; targets: string[]; host: string }

function refuse(target: string, why: string) {
  process.stderr.write(`${SENTINEL.DETECT_REFUSED}: ${clip(stripControl(target), 200)} (${why})\n`);
}

function designsRoot(): string {
  return path.join(gstackHome(), 'projects');
}

/** realpath under the repo root / cwd, or under <gstack home>/projects/<slug>/designs/. */
function allowedTarget(real: string, p: Probe): boolean {
  if (isInside(real, p.repoRoot) || isInside(real, p.cwd)) return true;
  const projects = realpathOrNull(designsRoot());
  if (!projects || !isInside(real, projects)) return false;
  const rel = path.relative(projects, real).split(path.sep);
  return rel.length >= 3 && rel[1] === 'designs';
}

function resolveTargets(args: ScanArgs, p: Probe): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(file|data|javascript):/i.test(raw)) { refuse(raw, 'URL targets are never scanned'); return; }
    const abs = path.isAbsolute(raw) ? raw : path.join(p.cwd, raw);
    const real = realpathOrNull(abs);
    if (!real) { refuse(raw, 'does not exist'); return; }
    if (!allowedTarget(real, p)) { refuse(raw, 'outside the repository and the design-report allow-list'); return; }
    if (seen.has(real)) return;
    seen.add(real);
    out.push(real);
  };
  for (const t of args.targets) push(t);
  if (args.changed !== undefined) {
    const top = gitTopLevel(p.cwd);
    if (!top) { refuse(args.changed, 'not a repository'); return out; }
    const base = args.changed;
    const files = new Set<string>();
    const runZ = (argv: string[]) => {
      const r = spawnSync('git', argv, { cwd: top, encoding: 'buffer', timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) return;
      for (const rel of r.stdout.toString('utf-8').split('\0')) if (rel) files.add(rel);
    };
    runZ(['diff', '-z', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
    runZ(['diff', '-z', '--name-only', '--diff-filter=ACMR', 'HEAD']);
    runZ(['ls-files', '-z', '--others', '--exclude-standard']);
    for (const rel of [...files].sort()) {
      if (!isFrontendPath(rel)) continue;
      const real = realpathOrNull(path.join(top, rel));
      if (!real) continue; // deleted or unreadable
      try { if (!fs.statSync(real).isFile()) continue; } catch { continue; }
      if (!seen.has(real)) { seen.add(real); out.push(real); }
    }
  }
  return out;
}

interface EngineRun { exit: number; stdout: string; stderr: string; timedOut: boolean; tooLarge: boolean }

function runEngine(engine: string, batch: string[], cwd: string, timeoutMs: number): EngineRun {
  const r = Bun.spawnSync([engine, 'detect', '--json', ...batch], {
    cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: ENV as Record<string, string>,
    timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: DETECT_LIMITS.stdoutBytes + 1024,
  });
  const out = r.stdout ?? new Uint8Array();
  const tooLarge = out.byteLength > DETECT_LIMITS.stdoutBytes;
  return {
    exit: r.exitCode ?? 1,
    stdout: tooLarge ? '' : Buffer.from(out).toString('utf-8'),
    stderr: Buffer.from(r.stderr ?? new Uint8Array()).toString('utf-8'),
    timedOut: Boolean((r as { exitedDueToTimeout?: boolean }).exitedDueToTimeout),
    tooLarge,
  };
}

function normalize(raw: unknown): NormalizedFinding {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const idRaw = f.antipattern ?? f.rule ?? f.id ?? f.ruleId;
  const id = sanitizeId(idRaw);
  const entry = id ? entryForImpeccableId(id) : undefined;
  const lim = DETECT_LIMITS.field;
  const advisory = (id ? ADVISORY_RULE_IDS.includes(id) : false) || f.advisory === true || str(f.severity).toLowerCase() === 'advisory';
  const rawKind = str(f.category);
  const base: NormalizedFinding = {
    id: entry?.id ?? id ?? 'unmapped',
    impeccableId: id ?? (clip(stripControl(str(idRaw)), lim.id) || 'unmapped'),
    file: clip(stripControl(str(f.file ?? f.path)), lim.file),
    line: Number.isFinite(Number(f.line)) ? Number(f.line) : 0,
    snippet: clip(stripControl(str(f.snippet)), lim.snippet),
    message: clip(stripControl(str(f.description ?? f.message)), lim.message),
    category: entry?.category ?? 'unknown',
    kind: entry?.kind ?? (rawKind === 'slop' || rawKind === 'quality' ? rawKind : 'unknown'),
    impact: entry?.impact ?? 'medium',
    tier: entry?.tier ?? 'ask',
    advisory,
  };
  if (entry?.handoff) base.handoff = entry.handoff;
  if (typeof f.value === 'string' && f.value) base.value = clip(stripControl(f.value), lim.value);
  if (!entry) base.unmapped = true;
  return base;
}

function scan(args: ScanArgs): number {
  const p = probe(args.host);
  if (!p.engine) {
    process.stdout.write(probeLines(p).join('\n') + '\n');
    analytics({ verb: 'scan', sentinel: p.sentinel.split(':')[0], exit: 0 });
    return 0;
  }
  for (const line of probeLines(p)) process.stderr.write(line + '\n');

  const targets = resolveTargets(args, p);
  if (!targets.length) {
    process.stderr.write(`${SENTINEL.DETECT_NO_TARGETS}\n`);
    analytics({ verb: 'scan', sentinel: 'READY', engine: p.engineVersion, targets: 0, exit: 0 });
    return 0;
  }

  const timeoutMs = Number(ENV.GSTACK_DESIGN_DETECT_TIMEOUT_MS) > 0 ? Number(ENV.GSTACK_DESIGN_DETECT_TIMEOUT_MS) : DETECT_LIMITS.timeoutMs;
  const rawFindings: unknown[] = [];
  const rawChunks: string[] = [];
  const diagnostics: string[] = [];
  let exit = 0;
  const started = Date.now();
  for (let i = 0; i < targets.length; i += DETECT_LIMITS.batch) {
    const batch = targets.slice(i, i + DETECT_LIMITS.batch);
    const run = runEngine(p.engine, batch, p.repoRoot, timeoutMs);
    for (const line of run.stderr.split('\n')) if (line.trim()) diagnostics.push(clip(stripControl(line), DETECT_LIMITS.field.diagnostic));
    if (run.timedOut) { process.stderr.write(`${SENTINEL.DETECT_TIMEOUT}: ${timeoutMs}ms\n`); exit = 1; continue; }
    if (run.tooLarge) { process.stderr.write(`${SENTINEL.DETECT_OUTPUT_TOO_LARGE}: engine stdout exceeded ${DETECT_LIMITS.stdoutBytes} bytes\n`); exit = 1; continue; }
    let parsed: unknown;
    try { parsed = JSON.parse(run.stdout.trim() || 'null'); } catch { parsed = undefined; }
    if (!Array.isArray(parsed)) {
      process.stderr.write(`${SENTINEL.DETECT_PARSE_ERROR}: ${clip(stripControl(run.stdout), 80)}\n`);
      exit = 1;
      continue;
    }
    rawChunks.push(run.stdout);
    rawFindings.push(...parsed);
    if (run.exit === 1) exit = 1;
    else if (run.exit === 2 && exit !== 1) exit = 2;
    else if (run.exit !== 0 && run.exit !== 2 && exit !== 1) exit = 1;
  }

  if (args.format === 'raw') {
    process.stdout.write(rawChunks.length === 1 ? rawChunks[0] : JSON.stringify(rawFindings, null, 2) + '\n');
  } else {
    const all = rawFindings.map(normalize);
    const truncated = all.length > DETECT_LIMITS.findings;
    const findings = truncated ? all.slice(0, DETECT_LIMITS.findings) : all;
    const byRule: Record<string, number> = {};
    let advisory = 0, high = 0, medium = 0, polish = 0, slop = 0, quality = 0;
    for (const f of all) {
      byRule[f.impeccableId] = (byRule[f.impeccableId] ?? 0) + 1;
      if (f.advisory) { advisory++; continue; }
      if (f.kind === 'slop') slop++; else if (f.kind === 'quality') quality++;
      if (f.impact === 'high') high++; else if (f.impact === 'medium') medium++; else polish++;
    }
    const result: ScanResult = {
      schemaVersion: 1, engine: p.engine, engineVersion: p.engineVersion ?? 'unknown', targets: targets.length,
      exit, total: all.length, counted: all.length - advisory, advisory, ignoredRules: p.ignoredRules, byRule, findings, truncated, diagnostics,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    writeTop(all, truncated);
    process.stderr.write(`${SENTINEL.DETECT_SUMMARY}: total=${all.length} slop=${slop} quality=${quality} advisory=${advisory} ignored=${p.ignoredRules.length} high=${high} medium=${medium} polish=${polish}${truncated ? ' truncated=true' : ''}\n`);
  }
  for (const d of diagnostics.slice(0, 20)) process.stderr.write(`ENGINE_STDERR: ${d}\n`);
  process.stderr.write(`${SENTINEL.DETECT_EXIT}: ${exit}\n`);
  analytics({ verb: 'scan', sentinel: 'READY', engine: p.engineVersion, targets: targets.length, total: rawFindings.length, ignored: p.ignoredRules.length, exit, ms: Date.now() - started });
  return exit;
}

const IMPACT_ORDER = { high: 0, medium: 1, polish: 2 } as const;

function writeTop(findings: NormalizedFinding[], truncated: boolean) {
  const groups = new Map<string, NormalizedFinding[]>();
  for (const f of findings) {
    if (f.advisory) continue;
    const g = groups.get(f.impeccableId) ?? [];
    g.push(f);
    groups.set(f.impeccableId, g);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    (IMPACT_ORDER[a[1][0].impact] - IMPACT_ORDER[b[1][0].impact]) || (b[1].length - a[1].length) || a[0].localeCompare(b[0]));
  const lines = [UNTRUSTED_BEGIN, `${SENTINEL.DETECT_TOP} total=${findings.length} rules=${groups.size}${truncated ? ' truncated=true' : ''}`];
  let shown = 0;
  for (const [id, group] of ordered) {
    const f0 = group[0];
    lines.push(`[${id}] impact=${f0.impact} tier=${f0.tier} count=${group.length}${f0.handoff ? ` handoff=/impeccable ${f0.handoff}` : ''}${f0.unmapped ? ' unmapped' : ''}`);
    for (const f of group) {
      if (shown >= DETECT_LIMITS.topLocations) break;
      lines.push(`  ${f.file}:${f.line}  ${f.snippet}`);
      shown++;
    }
  }
  if (shown >= DETECT_LIMITS.topLocations && findings.length > shown) lines.push(`  … ${findings.length - shown} more locations in the JSON`);
  lines.push(UNTRUSTED_END);
  process.stderr.write(lines.join('\n') + '\n');
}

// ── rules ────────────────────────────────────────────────────────────────────

function rules(): number {
  const mapped = DESIGN_SLOP_CATALOG.filter(e => e.impeccableId);
  process.stdout.write(`# ${mapped.length} detector rules mapped in lib/design-catalog.ts; tested engine versions: ${TESTED_ENGINE_VERSIONS.join(', ')}\n`);
  process.stdout.write('id\tkind\timpact\ttier\thandoff\tname\n');
  for (const e of mapped) process.stdout.write(`${e.impeccableId}\t${e.kind}\t${e.impact}\t${e.tier}\t${e.handoff ?? '-'}\t${e.name}\n`);
  return 0;
}

// ── Analytics (local, best-effort) ───────────────────────────────────────────

function analytics(rec: Record<string, unknown>) {
  try {
    const dir = path.join(gstackHome(), 'analytics');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'design-detector.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...rec }) + '\n');
  } catch { /* never throws */ }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parse(argv: string[]): { verb: string; host: string; verbose: boolean; scan: ScanArgs } {
  const verb = argv[0] ?? '';
  let host = 'claude';
  let verbose = false;
  let format: 'gstack' | 'raw' = 'gstack';
  let changed: string | undefined;
  const targets: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--host') host = argv[++i] ?? host;
    else if (a === '--verbose') verbose = true;
    else if (a === '--format') { const v = argv[++i]; format = v === 'raw' ? 'raw' : 'gstack'; }
    else if (a === '--changed') changed = argv[++i] ?? 'main';
    else if (a === '--') { targets.push(...argv.slice(i + 1)); break; }
    else if (a.startsWith('--')) process.stderr.write(`ignoring unknown flag ${a}\n`);
    else targets.push(a);
  }
  return { verb, host, verbose, scan: { format, changed, targets, host } };
}

export function main(argv = process.argv.slice(2)): number {
  const { verb, host, verbose, scan: scanArgs } = parse(argv);
  switch (verb) {
    case 'probe': {
      const p = probe(host, verbose);
      process.stdout.write(probeLines(p).join('\n') + '\n');
      analytics({ verb: 'probe', sentinel: p.sentinel.split(':')[0], engine: p.engineVersion, hook: p.hook, ignored: p.ignoredRules.length, exit: 0 });
      return 0;
    }
    case 'scan':
      return scan(scanArgs);
    case 'rules':
      return rules();
    default:
      process.stderr.write('usage: gstack-design-detect.ts probe [--host <h>] [--verbose] | scan [--format gstack|raw] [--changed <base>] [--host <h>] <paths...> | rules\n');
      return 2;
  }
}

if (import.meta.main) {
  // exitCode, not process.exit(): a pipe write over 64 KB (a big scan) is still
  // in flight when process.exit() runs and would be truncated mid-JSON.
  try {
    process.exitCode = main();
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`${SENTINEL.INTERNAL_ERROR}: ${e?.name ?? 'Error'}: ${clip(stripControl(String(e?.message ?? e)), 300)}\n`);
    analytics({ verb: process.argv[2] ?? '', sentinel: 'INTERNAL_ERROR', exit: 3 });
    process.exitCode = 3;
  }
}
