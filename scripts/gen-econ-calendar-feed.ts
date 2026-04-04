import { spawnSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i++;
  }
  return out;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function resolveBrowseBin(): string {
  const candidates = [
    process.env.GSTOCK_BROWSE_BIN,
    join(REPO_ROOT, "browse", "dist", "browse.exe"),
    join(REPO_ROOT, "browse", "dist", "browse"),
    join(homedir(), ".claude", "skills", "gstack", "browse", "dist", "browse.exe"),
    join(homedir(), ".claude", "skills", "gstack", "browse", "dist", "browse"),
    join(homedir(), ".agents", "skills", "gstack", "browse", "dist", "browse.exe"),
    join(homedir(), ".agents", "skills", "gstack", "browse", "dist", "browse"),
    join(homedir(), ".codex", "skills", "gstack", "browse", "dist", "browse.exe"),
    join(homedir(), ".codex", "skills", "gstack", "browse", "dist", "browse"),
  ].filter((p): p is string => Boolean(p && p.trim()));

  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {}
  }
  return join(REPO_ROOT, "browse", "dist", process.platform === "win32" ? "browse.exe" : "browse");
}

function extractChainSection(stdout: string, command: string): string {
  const prefix = `[${command}] `;
  const start = stdout.indexOf(prefix);
  if (start < 0) return "";
  const rest = stdout.slice(start + prefix.length);
  const next = rest.indexOf("\n\n[");
  return next >= 0 ? rest.slice(0, next).trim() : rest.trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripHtml(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function parseYahooUtcMs(dayIso: string, timeCell: string): number | null {
  const t = stripHtml(timeCell);
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*UTC$/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (ap === "PM" && hh !== 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;
  const iso = `${dayIso}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function formatInTimeZone(utcMs: number, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return dtf.format(new Date(utcMs)).replace(",", "");
}

function addDaysIso(dateIso: string, days: number): string {
  const m = String(dateIso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const base = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Date.now();
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type EconEvent = { utcMs: number; country: string; name: string };

function parseYahooEconomicTable(tableHtml: string, dayIso: string): EconEvent[] {
  const out: EconEvent[] = [];
  const rows = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const r of rows) {
    const row = r[1] || "";
    if (row.toLowerCase().includes("<th")) continue;
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1] || "");
    if (cells.length < 3) continue;
    const eventName = stripHtml(cells[0]);
    const country = stripHtml(cells[1]);
    const utcMs = parseYahooUtcMs(dayIso, cells[2]);
    if (!eventName || !country || utcMs == null) continue;
    out.push({ utcMs, country, name: eventName });
  }
  return out;
}

function isImportantEvent(name: string, country: string): boolean {
  const c = country.trim().toUpperCase();
  if (c !== "US") return false;
  const n = name.toLowerCase();
  const keys = [
    "non-farm payroll",
    "cpi",
    "core cpi",
    "pce",
    "core pce",
    "fomc",
    "interest rate",
    "gdp",
    "unemployment rate",
    "retail sales",
    "ism",
    "ppi",
  ];
  return keys.some((k) => n.includes(k));
}

function compactIsmEvents(lines: string[]): string[] {
  const byKey = new Map<string, { base: string; parts: string[] }>();
  const passthrough: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(US ISM)\s+(.+)$/);
    if (!m) {
      passthrough.push(line);
      continue;
    }
    const ts = m[1];
    const base = `${m[2]}`;
    const rest = m[3].trim();
    const key = `${ts}|${base}`;
    const cur = byKey.get(key) || { base, parts: [] };
    cur.parts.push(rest);
    byKey.set(key, cur);
  }
  const out: string[] = [];
  for (const [key, v] of byKey) {
    const [ts] = key.split("|");
    const uniq = Array.from(new Set(v.parts)).filter(Boolean);
    const shown = uniq.slice(0, 6);
    const more = uniq.length - shown.length;
    const suffix = more > 0 ? ` +${more}` : "";
    out.push(`${ts} ${v.base}: ${shown.join(", ")}${suffix}`);
  }
  return [...passthrough, ...out].sort();
}

function runBrowseChain(browseBin: string, chain: any[]): string {
  const input = JSON.stringify(chain);
  const result = spawnSync(browseBin, ["chain"], { input, encoding: "utf8", timeout: 60_000 });
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  if ((result.status ?? 1) !== 0) {
    throw new Error(`browse chain failed (exit ${(result.status ?? 1)}): ${stderr || stdout}`.slice(0, 1200));
  }
  return stdout;
}

async function main() {
  const args = parseArgs(process.argv);
  const days = clampInt(Number(args.days ?? 7), 1, 30);
  const tz = String(args.tz ?? "America/New_York");
  const mode = String(args.mode ?? "important").toLowerCase() === "all" ? "all" : "important";
  const countries = String(args.countries ?? "us").trim();
  const outPathRaw = args.out ? String(args.out) : "";
  const outPath = outPathRaw ? (outPathRaw.startsWith(".") || outPathRaw.includes(":") ? outPathRaw : join(REPO_ROOT, outPathRaw)) : "";

  const browseBin = resolveBrowseBin();
  if (!existsSync(browseBin)) {
    throw new Error(`browse binary not found: ${browseBin}\nRun: bun run build`);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const dayIso = addDaysIso(todayIso, i);
    const url = `https://finance.yahoo.com/calendar/economic?day=${encodeURIComponent(dayIso)}${countries ? `&countries=${encodeURIComponent(countries)}` : ""}`;
    const stdout = runBrowseChain(browseBin, [
      ["goto", url],
      ["wait", "--load"],
      ["html", "table"],
    ]);
    const tableHtml = extractChainSection(stdout, "html");
    if (!tableHtml) continue;
    const rows = parseYahooEconomicTable(tableHtml, dayIso);
    for (const r of rows) {
      if (mode === "important" && !isImportantEvent(r.name, r.country)) continue;
      const t = formatInTimeZone(r.utcMs, tz);
      lines.push(`${t} ${r.country.toUpperCase()} ${r.name}`.trim());
    }
  }

  const deduped = Array.from(new Set(lines)).sort();
  const compacted = compactIsmEvents(deduped);
  const output = compacted.join("\n") + "\n";

  if (outPath) {
    const dir = dirname(outPath);
    if (!existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, output, "utf8");
  }

  process.stdout.write(output);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err || "error") + "\n");
  process.exitCode = 1;
});
