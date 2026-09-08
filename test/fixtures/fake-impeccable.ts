#!/usr/bin/env bun
/**
 * fake-impeccable — a stand-in for the impeccable engine binary in tests.
 *
 * Behaves like `impeccable detect --json <targets>`: prints a findings JSON
 * array on stdout and exits with the engine's code. Everything is driven by env
 * so tests never edit this file:
 *   FAKE_IMPECCABLE_OUTPUT   path of the JSON (default: impeccable-detect-sample.json beside this file)
 *   FAKE_IMPECCABLE_EXIT     exit code (default 2 = findings)
 *   FAKE_IMPECCABLE_LOG      append one JSON line per invocation: {argv, cwd, stdinIsTTY}
 *   FAKE_IMPECCABLE_SLEEP_MS sleep before printing (timeout tests)
 *   FAKE_IMPECCABLE_STDERR   text to print on stderr (diagnostics tests)
 *   FAKE_IMPECCABLE_RAW      print this exact text instead of the JSON file (parse-error tests)
 *   FAKE_IMPECCABLE_REPEAT   repeat the sample findings N times (display-cap tests)
 * Spawned directly (shebang), so the spawn-based tests are POSIX-only.
 */
import * as fs from 'fs';
import * as path from 'path';

const env = process.env;
if (env.FAKE_IMPECCABLE_LOG) {
  fs.appendFileSync(env.FAKE_IMPECCABLE_LOG, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), stdinIsTTY: Boolean(process.stdin.isTTY) }) + '\n');
}
const sleep = Number(env.FAKE_IMPECCABLE_SLEEP_MS ?? 0);
if (sleep > 0) Bun.sleepSync(sleep);
if (env.FAKE_IMPECCABLE_STDERR) process.stderr.write(env.FAKE_IMPECCABLE_STDERR + '\n');

if (env.FAKE_IMPECCABLE_RAW !== undefined) {
  process.stdout.write(env.FAKE_IMPECCABLE_RAW);
} else {
  const file = env.FAKE_IMPECCABLE_OUTPUT ?? path.join(import.meta.dir, 'impeccable-detect-sample.json');
  const text = fs.readFileSync(file, 'utf-8');
  const repeat = Number(env.FAKE_IMPECCABLE_REPEAT ?? 1);
  if (repeat > 1) {
    const arr = JSON.parse(text) as unknown[];
    const out: unknown[] = [];
    for (let i = 0; i < repeat; i++) for (const f of arr) out.push({ ...(f as object), line: i });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stdout.write(text);
  }
}
// exitCode, not process.exit(): large outputs must flush through the pipe first.
process.exitCode = Number(env.FAKE_IMPECCABLE_EXIT ?? 2);
