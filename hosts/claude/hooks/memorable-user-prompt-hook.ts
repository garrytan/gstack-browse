#!/usr/bin/env bun
/**
 * memorable-user-prompt-hook — gstack-mediated bridge from Claude Code's
 * UserPromptSubmit event to the third-party `memorable` CLI (memorable.sh).
 *
 * The vendor's own installer registers `memorable hook user-prompt` directly.
 * Registering it THROUGH gstack instead buys the user what gstack gives every
 * other off-machine sink: an explicit consent key, a receipt per attempted
 * send, a secret pre-scan, a trust envelope around what comes back, healing
 * and clean removal. This file is that mediation.
 *
 *   stdin JSON -> cap 1 MiB -> parse -> MEMORABLE=0? -> gate memorable_recall == on?
 *      -> win32? -> trust policy (deny / read-only veto, by session cwd)
 *      -> HIGH-tier secret scan (raw bytes AND decoded string leaves)
 *      -> resolve vendor -> budget >= 500 ms? -> gate re-check
 *      -> receipt (fail-closed: no receipt, no send)
 *      -> VENDOR SPAWN (own process group, allowlisted env, group-killed on timeout)
 *      -> parse vendor JSON -> additionalContext only -> control-strip
 *      -> 8 KiB cap (UTF-8 boundary) -> trust envelope -> stdout (awaited)
 *      -> outcome (bounded by the same clock) -> exit 0
 *   every early exit above is: one rate-limited line in hook-errors.log, empty stdout, exit 0.
 *
 * CONTRACT
 *   - ALWAYS exits 0 with either one hookSpecificOutput JSON or nothing. The
 *     vendor can never block a prompt or speak as gstack: only a string
 *     `hookSpecificOutput.additionalContext` is accepted from its output.
 *   - One deadline clock (BUDGET_MS) undercuts Claude Code's 5 s hook kill;
 *     every stage, the two ledger writes included, gets min(cap, remaining).
 *     A receipt with no outcome means the host killed us or the clock ran out
 *     (reported as `unknown`), never success.
 *   - Fail-closed on the receipt: if the ledger cannot be written, recall is
 *     skipped for that prompt. What the receipt attests is the bytes handed to
 *     a LOCAL binary running with the user's privileges (host `local:<path>`);
 *     what that binary sends is the vendor's claim.
 *   - The vendor sees an allowlisted environment (PATH, HOME, locale, TMP,
 *     MEMORABLE*), never Claude Code's full env (which can carry API keys).
 *   - Windows is refused here (no process groups to contain the vendor);
 *     bin/gstack-memorable enable refuses there too. TODOS.md D21.
 *
 * Pure helpers are exported for unit tests; main() runs only under import.meta.main.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runBin, runExternal } from './spawn-bin';
import { sha256Hex, writeOutcome, writeReceipt } from '../../../lib/egress-receipt';
import { wrapUntrustedTrackerContent } from '../../../lib/tracker-guard';
import { scan } from '../../../lib/redact-engine';
import { hasRepoPolicyStore, repoPolicyTier } from '../../../lib/gbrain-repo-policy-client';

export const BUDGET_MS = 4500;
export const STDIN_CAP_BYTES = 1024 * 1024;
export const OUTPUT_CAP_BYTES = 8192;
export const RESERVE_MS = 300;
export const MIN_SPAWN_MS = 500;
/** Below this many ms left, the outcome append is skipped (the receipt stands, outcome reads as unknown). */
export const OUTCOME_MIN_MS = 80;
export const LOG_RATE_LIMIT_MS = 10 * 60 * 1000;
export const ENVELOPE_SOURCE = 'memorable recall (third-party)';
export const SINK = 'memorable-recall';
export const CONSENT = 'memorable_recall=on';
const HOOK_NAME = 'memorable-user-prompt-hook';

/** Milliseconds left on a deadline that started at startMs. Pure; unit-tested. */
export function budgetFor(startMs: number, nowMs: number, cap: number = BUDGET_MS): number {
  return Math.max(0, startMs + cap - nowMs);
}

/** Truncate to maxBytes of UTF-8 without splitting a multibyte character. */
export function capUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return { text, truncated: false };
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--; // back off to a UTF-8 boundary
  return { text: buf.subarray(0, end).toString('utf8'), truncated: true };
}

// C0 controls minus tab (9) and newline (10), plus DEL. Built from char codes
// so the source file itself carries no control bytes.
const cc = (n: number): string => String.fromCharCode(n);
const CONTROL_RE = new RegExp(`[${cc(0)}-${cc(8)}${cc(11)}${cc(12)}${cc(14)}-${cc(31)}${cc(127)}]`, 'g');

/** Strip control characters except newline and tab (the envelope handles the rest). */
export function stripControl(text: string): string {
  return text.replace(CONTROL_RE, '');
}

/** Every string leaf of a parsed JSON value, bounded so a hostile payload cannot monopolize the clock. */
export function stringLeaves(value: unknown, maxNodes = 10_000, maxDepth = 32): string[] {
  const out: string[] = [];
  let nodes = 0;
  const walk = (v: unknown, depth: number): void => {
    if (nodes++ > maxNodes || depth > maxDepth) return;
    if (typeof v === 'string') { out.push(v); return; }
    if (Array.isArray(v)) { for (const item of v) walk(item, depth + 1); return; }
    if (v && typeof v === 'object') { for (const item of Object.values(v as Record<string, unknown>)) walk(item, depth + 1); }
  };
  walk(value, 0);
  return out;
}

const ENV_ALLOW = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'TERM', 'TMPDIR', 'TEMP', 'TMP']);

/** The vendor's environment: an allowlist, never Claude Code's full env. */
export function vendorEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v == null) continue;
    if (ENV_ALLOW.has(k) || k.startsWith('LC_') || k.startsWith('MEMORABLE')) out[k] = v;
  }
  return out;
}

/** Only a string hookSpecificOutput.additionalContext survives; decision/continue/systemMessage are dropped. */
export function pickAdditionalContext(raw: string): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const hso = (parsed as { hookSpecificOutput?: { additionalContext?: unknown } } | null)?.hookSpecificOutput;
  const ctx = hso?.additionalContext;
  return typeof ctx === 'string' && ctx.length > 0 ? ctx : null;
}

/** Cap + envelope: the text Claude will see. */
export function renderContext(vendorText: string): string {
  const { text, truncated } = capUtf8(stripControl(vendorText), OUTPUT_CAP_BYTES);
  const body = truncated ? `${text}\n[truncated by gstack at 8 KiB]` : text;
  return wrapUntrustedTrackerContent(body, ENVELOPE_SOURCE);
}

function stripQuotes(v: string): string {
  return v.trim().replace(/^"(.*)"$/, '$1');
}

function executable(p: string): boolean {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * GSTACK_MEMORABLE_BIN -> MEMORABLE_BIN -> ~/.memorable/bin/memorable -> PATH.
 * An explicit override that does not resolve is an error (null), never a
 * fall-through to something else (lib/claude-bin.ts contract).
 */
export function resolveVendor(env: Record<string, string | undefined>, homeDir: string): string | null {
  const override = env.GSTACK_MEMORABLE_BIN ?? env.MEMORABLE_BIN;
  if (override && override.trim()) {
    const o = stripQuotes(override);
    const resolved = path.isAbsolute(o) ? o : (Bun.which(o) ?? null);
    return resolved && executable(resolved) ? resolved : null;
  }
  const pinned = path.join(homeDir, '.memorable', 'bin', 'memorable');
  if (executable(pinned)) return pinned;
  const onPath = Bun.which('memorable');
  return onPath && executable(onPath) ? onPath : null;
}

function stateRoot(): string {
  return process.env.GSTACK_STATE_ROOT || process.env.GSTACK_HOME || process.env.GSTACK_STATE_DIR
    || path.join(os.homedir(), '.gstack');
}

/**
 * Best-effort, rate-limited: an identical message within LOG_RATE_LIMIT_MS is
 * not re-logged (a vendor removed after `enable` would otherwise append on
 * every prompt). The marker is per hook so hooks never contend.
 */
export function logHookError(msg: string, nowMs: number = Date.now()): void {
  try {
    const root = stateRoot();
    fs.mkdirSync(root, { recursive: true });
    const marker = path.join(root, `hook-errors.${HOOK_NAME}.last`);
    const digest = sha256Hex(msg).slice(0, 16);
    try {
      const [prevDigest, prevTs] = fs.readFileSync(marker, 'utf8').trim().split(':');
      if (prevDigest === digest && nowMs - Number(prevTs) < LOG_RATE_LIMIT_MS) return;
    } catch { /* no marker yet */ }
    fs.writeFileSync(marker, `${digest}:${nowMs}\n`);
    fs.appendFileSync(path.join(root, 'hook-errors.log'), `${new Date(nowMs).toISOString()} ${HOOK_NAME}: ${msg}\n`);
  } catch {
    // best-effort; never block the session because logging failed
  }
}

function readStdin(maxBytes: number, timeoutMs: number): Promise<{ buf: Buffer; oversize: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    let oversize = false;
    const finish = (timedOut: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { process.stdin.destroy(); } catch { /* already closed */ }
      resolve({ buf: Buffer.concat(chunks), oversize, timedOut });
    };
    const timer = setTimeout(() => finish(true), Math.max(1, timeoutMs));
    process.stdin.on('data', (d: Buffer | string) => {
      if (done) return;
      const chunk = typeof d === 'string' ? Buffer.from(d, 'utf8') : d;
      total += chunk.length;
      if (total > maxBytes) { oversize = true; finish(false); return; }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => finish(false));
    process.stdin.on('error', () => finish(false));
  });
}

function gateIsOn(timeoutMs: number): 'on' | 'off' | 'error' {
  const r = runBin('gstack-config', ['get', 'memorable_recall'], { encoding: 'utf8', timeout: Math.max(1, timeoutMs), env: process.env });
  if (r.status !== 0) return 'error';
  return String(r.stdout ?? '').trim() === 'on' ? 'on' : 'off';
}

async function policyVeto(cwd: string, timeoutMs: number): Promise<'ok' | 'skip' | 'error'> {
  if (!hasRepoPolicyStore()) return 'ok';
  const git = await runExternal('git', ['remote', 'get-url', 'origin'], {
    cwd, timeoutMs: Math.max(1, timeoutMs), maxBuffer: 64 * 1024, env: process.env,
  });
  if (git.status !== 0) return 'ok'; // no remote: the policy (keyed by remote) has nothing set for this repo
  const url = git.stdout.toString('utf8').trim();
  if (!url) return 'ok';
  const res = repoPolicyTier(url);
  if (res.error) return 'error';
  // `deny` and `read-only` are the tiers a user picks so a repo's content
  // never lands in a shared store; a third-party memory service is one.
  return res.tier === 'deny' || res.tier === 'read-only' ? 'skip' : 'ok';
}

function writeStdout(text: string): Promise<void> {
  return new Promise((resolve) => { process.stdout.write(text, () => resolve()); });
}

export async function main(): Promise<void> {
  const start = Date.now();
  const remaining = (): number => budgetFor(start, Date.now());

  const stdin = await readStdin(STDIN_CAP_BYTES, Math.min(1000, remaining()));
  if (stdin.oversize) { logHookError('oversize: stdin exceeded 1 MiB, recall skipped'); return; }
  const raw = stdin.buf;
  if (raw.length === 0) return;
  let payload: unknown;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { logHookError('stdin was not JSON, recall skipped'); return; }
  if (!payload || typeof payload !== 'object') return;

  if (process.env.MEMORABLE === '0') return; // the vendor's own kill switch

  const gate = gateIsOn(Math.min(1000, remaining()));
  if (gate === 'error') { logHookError('gstack-config get memorable_recall failed, recall skipped (fail-closed)'); return; }
  if (gate !== 'on') return;

  if (process.platform === 'win32') { logHookError('Windows is not supported by this bridge yet (TODOS.md D21), recall skipped'); return; }

  const payloadCwd = (payload as { cwd?: unknown }).cwd;
  const cwd = typeof payloadCwd === 'string' && fs.existsSync(payloadCwd) ? payloadCwd : process.cwd();
  const veto = await policyVeto(cwd, Math.min(1000, remaining()));
  if (veto === 'skip') { logHookError(`trust policy for ${cwd} is deny or read-only, recall skipped`); return; }
  if (veto === 'error') { logHookError('trust policy store unreadable, recall skipped (fail-closed)'); return; }

  const rawText = raw.toString('utf8');
  const leaves = stringLeaves(payload).join('\n');
  for (const text of [rawText, leaves]) {
    const result = scan(text, { repoVisibility: 'unknown' });
    if (result.oversize || result.counts.HIGH > 0) {
      logHookError('refused:redaction-high: the prompt carries a HIGH-tier credential shape, nothing handed to the vendor');
      return;
    }
  }

  const vendor = resolveVendor(process.env, os.homedir());
  if (!vendor) { logHookError('memorable CLI not found (checked GSTACK_MEMORABLE_BIN, MEMORABLE_BIN, ~/.memorable/bin/memorable, PATH), recall skipped'); return; }

  if (remaining() < MIN_SPAWN_MS) { logHookError('budget-exhausted before the vendor spawn, recall skipped'); return; }
  if (gateIsOn(Math.min(500, remaining())) !== 'on') return; // a disable that landed while we worked wins

  let receiptId: string;
  try {
    const { id } = writeReceipt({
      sink: SINK,
      host: `local:${vendor}`,
      payloadClass: 'claude-user-prompt-json handed to the local vendor CLI; network destination unknown to gstack (vendor states: memorable.sh embed API on a local recall miss)',
      bytes: raw.length,
      sha256: sha256Hex(raw),
      consent: CONSENT,
      lockBudgetMs: Math.max(0, remaining() - RESERVE_MS),
    });
    receiptId = id;
  } catch (err) {
    // fail-closed: no receipt, no send
    const why = err instanceof Error ? err.message : String(err);
    logHookError(`refused:receipt-unwritable: ${why}`);
    process.stderr.write(`gstack: memorable recall skipped, the egress receipt could not be written (${why}). See gstack-egress.\n`);
    return;
  }
  if (remaining() < MIN_SPAWN_MS) {
    logHookError('budget-exhausted after the receipt, recall skipped');
    try { writeOutcome({ receipt: receiptId, status: 'budget-exhausted', lockBudgetMs: Math.max(0, remaining() - 100) }); } catch { /* bookkeeping */ }
    return;
  }

  const gstackMs = Date.now() - start;
  // VENDOR SPAWN: everything above is gstack's own boundary; from here the bytes are the vendor's.
  const r = await runExternal(vendor, ['hook', 'user-prompt'], {
    input: raw,
    timeoutMs: Math.max(1, remaining() - RESERVE_MS),
    maxBuffer: 1024 * 1024,
    env: vendorEnv(process.env),
    cwd,
  });

  let status: string;
  if (r.timedOut) status = 'timeout';
  else if (r.error) status = `spawn-error:${r.error}`;
  else if (r.status !== 0) status = `exit:${r.status} injected=no`;
  else {
    const ctx = pickAdditionalContext(r.stdout.toString('utf8'));
    if (!ctx) status = 'exit:0 injected=no';
    else {
      const rendered = renderContext(ctx);
      const out = JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: rendered } });
      await writeStdout(out);
      status = `exit:0 output-written bytes=${Buffer.byteLength(rendered, 'utf8')} gstack_ms=${gstackMs}`;
    }
  }
  if (r.stderrTail && (r.timedOut || r.error || r.status !== 0)) {
    logHookError(`vendor ${status}: ${r.stderrTail.replace(/\s+/g, ' ').slice(-300)}`);
  }
  // The vendor's timeout already left RESERVE_MS on the clock for exactly
  // this: the stdout write above and one bounded ledger append.
  if (remaining() > OUTCOME_MIN_MS) {
    try { writeOutcome({ receipt: receiptId, status, lockBudgetMs: Math.max(0, remaining() - 50) }); } catch { /* the receipt is the invariant; the outcome is bookkeeping */ }
  }
}

if (import.meta.main) {
  main()
    .catch((err) => logHookError(`unexpected: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`))
    .finally(() => { process.exitCode = 0; });
}
