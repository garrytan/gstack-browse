type Env = {
  TELEGRAM_TOKEN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ALLOWED_CHAT_IDS?: string;
  TELEGRAM_CHAT_ID?: string;
  WEBHOOK_SECRET?: string;
  ECON_CALENDAR?: string;
  ECON_CALENDAR_SOURCE?: string;
  ECON_CALENDAR_URL?: string;
  ECON_CALENDAR_CACHE_TTL?: string;
  ECON_CALENDAR_DAYS?: string;
  ECON_CALENDAR_YAHOO_MODE?: string;
  CALENDAR_TZ?: string;
  DAILY_CRON_CMD?: string;
  HALO_CORE?: string;
  HALO_WATCHLIST?: string;
  HALO_STOP_PCTS?: string;
  HALO_MILKSHAKE_RISK?: string;
  HALO_OBSOLESCENCE?: string;
  HALO_EMA_WINDOW?: string;
  HALO_VOLUME_WINDOW?: string;
  HALO_VOLUME_SURGE?: string;
  HALO_VIX_AMBER?: string;
  HALO_VIX_RED?: string;
  HALO_NEARMISS_PEMA_TARGET?: string;
  PORTFOLIO?: string;
  PORTFOLIO_POSITIONS?: string;
  POSITION_UNIT_USD?: string;
  POSITION_UNIT_HKD?: string;
  MAX_DAILY_ADDS?: string;
  MAX_DAILY_TRIMS?: string;
  MAX_PER_TICKER_U?: string;
  RISK?: string;
  HORIZON?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
  edited_message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
    };
  };
};

function getToken(env: Env): string {
  return env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN || "";
}

function parseAllowedChatIds(env: Env): number[] {
  const raw = (env.TELEGRAM_ALLOWED_CHAT_IDS || env.TELEGRAM_CHAT_ID || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function isAllowed(chatId: number, allowed: number[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.includes(chatId);
}

function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase();
  const aliases: Record<string, string> = {
    DXY: "DX-Y.NYB",
    SPX: "^GSPC",
    SP500: "^GSPC",
  };
  const aliased = aliases[t] || t;

  if (/^\d+$/.test(aliased)) {
    const n = aliased.replace(/^0+/, "");
    if (n.length > 0 && n.length <= 4) return n.padStart(4, "0") + ".HK";
    return aliased + ".HK";
  }
  return aliased;
}

function getSector(ticker: string): string {
  const t = ticker.toUpperCase();
  const map: Record<string, string> = {
    SPY: "ETF - US Equity",
    TSM: "Semiconductors",
    NVDA: "Semiconductors",
    AAPL: "Technology - Hardware",
    MSFT: "Technology - Software",
    GOOGL: "Technology - Internet",
    TCOM: "Consumer - Travel",
    MSTR: "Crypto Proxy",
    "0700.HK": "Technology - Internet",
    "9988.HK": "Technology - E-commerce",
    "1810.HK": "Technology - Hardware",
    "7226.HK": "ETF/Derivative",
  };
  return map[t] || (t.endsWith(".HK") ? "HK - Other" : "Other");
}

function parseCommand(text: string): { cmd: string; arg?: string } {
  const t = text.trim();
  if (!t.startsWith("/")) return { cmd: "ticker", arg: t };
  const parts = t.split(/\s+/);
  const cmd = parts[0].slice(1).toLowerCase();
  const arg = parts.slice(1).join(" ").trim() || undefined;
  return { cmd, arg };
}

function escapeText(s: string): string {
  return s.replace(/\u0000/g, "");
}

function tzOffsetMinutes(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || "0");
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  const localAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  return (localAsUtc - utcMs) / 60000;
}

function zonedTimeToUtcMs(params: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string): number {
  let guess = Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, 0);
  for (let i = 0; i < 3; i++) {
    const offMin = tzOffsetMinutes(timeZone, guess);
    const next = Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, 0) - offMin * 60000;
    if (Math.abs(next - guess) < 1000) {
      guess = next;
      break;
    }
    guess = next;
  }
  return guess;
}

function formatTMinus(msFromNow: number): string {
  if (msFromNow <= 0) return "已發生";
  const totalMin = Math.floor(msFromNow / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin - d * 60 * 24) / 60);
  const m = totalMin - d * 60 * 24 - h * 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
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

function parseCalendarLines(spec: string, timeZone: string): Array<{ utcMs: number; date: string; time: string; name: string }> {
  const out: Array<{ utcMs: number; date: string; time: string; name: string }> = [];
  const lines = spec.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/);
    if (!m) continue;
    const date = m[1];
    const time = m[2];
    const name = m[3].trim();
    const [yy, mm, dd] = date.split("-").map((x) => Number(x));
    const [hh, mi] = time.split(":").map((x) => Number(x));
    if (![yy, mm, dd, hh, mi].every((n) => Number.isFinite(n))) continue;
    const utcMs = zonedTimeToUtcMs({ year: yy, month: mm, day: dd, hour: hh, minute: mi }, timeZone);
    out.push({ utcMs, date, time, name });
  }
  return out;
}

type CalendarEvent = { utcMs: number; name: string };

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function compactCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const byKey = new Map<string, { utcMs: number; base: string; parts: string[]; other: CalendarEvent[] }>();
  const passthrough: CalendarEvent[] = [];

  for (const e of events) {
    const name = e.name.trim();
    if (!name.startsWith("US ISM ")) {
      passthrough.push(e);
      continue;
    }
    const tokens = name.split(/\s+/);
    if (tokens.length < 4) {
      passthrough.push(e);
      continue;
    }
    const base = `${tokens[0]} ${tokens[1]} ${tokens[2]}`;
    const part = tokens.slice(3).join(" ").trim();
    const key = `${e.utcMs}|${base}`;
    const cur = byKey.get(key) || { utcMs: e.utcMs, base, parts: [], other: [] };
    if (part) cur.parts.push(part);
    byKey.set(key, cur);
  }

  const out: CalendarEvent[] = [];
  for (const v of byKey.values()) {
    const uniq = Array.from(new Set(v.parts)).filter(Boolean);
    if (uniq.length <= 1) {
      out.push({ utcMs: v.utcMs, name: uniq.length === 1 ? `${v.base} ${uniq[0]}` : v.base });
      continue;
    }
    const shown = uniq.slice(0, 6);
    const more = uniq.length - shown.length;
    const suffix = more > 0 ? ` +${more}` : "";
    out.push({ utcMs: v.utcMs, name: `${v.base}: ${shown.join(", ")}${suffix}` });
  }

  return [...passthrough, ...out].sort((a, b) => a.utcMs - b.utcMs);
}

function addDaysIso(date: string, days: number): string {
  const m = String(date || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const base = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Date.now();
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

function isImportantYahooEvent(name: string, country: string): boolean {
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

function parseYahooCalendarHeaderDayIso(html: string, requestedDayIso: string): string | null {
  const m0 = String(requestedDayIso || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m0) return null;
  const year = Number(m0[1]);
  if (!Number.isFinite(year)) return null;
  const m = html.match(/Economic Events On\s+\w{3},\s+([A-Za-z]{3})\s+(\d{1,2})/i);
  if (!m) return null;
  const mon = m[1].toLowerCase();
  const day = Number(m[2]);
  const monthMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const mm = monthMap[mon];
  if (!mm || !Number.isFinite(day)) return null;
  return `${String(year).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type YahooAuth = { cookie: string; crumb: string };

function parseFirstCookie(setCookie: string): { name: string; value: string } | null {
  const m = String(setCookie || "").match(/^\s*([A-Za-z0-9_]+)=([^;]+);/);
  if (!m) return null;
  return { name: m[1], value: m[2] };
}

async function fetchYahooAuth(cacheTtlSec: number): Promise<YahooAuth | null> {
  const cacheKey = new Request("https://cache.local/yahoo-auth/v1");
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<any>();
      const cookie = typeof json?.cookie === "string" ? json.cookie : "";
      const crumb = typeof json?.crumb === "string" ? json.crumb : "";
      if (cookie && crumb) return { cookie, crumb };
    } catch {}
  }

  try {
    const res = await fetch("https://fc.yahoo.com", {
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html,*/*;q=0.9" },
      redirect: "follow",
    });
    const setCookies: string[] =
      typeof (res.headers as any).getSetCookie === "function"
        ? (res.headers as any).getSetCookie()
        : (res.headers.get("set-cookie") ? [String(res.headers.get("set-cookie"))] : []);
    const parsed = setCookies.map(parseFirstCookie).find((c) => c && (c.name === "A1" || c.name === "A3")) || setCookies.map(parseFirstCookie).find(Boolean);
    if (!parsed) return null;
    const cookie = `${parsed.name}=${parsed.value}`;

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "user-agent": "Mozilla/5.0", cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;
    const auth = { cookie, crumb };
    await caches.default.put(cacheKey, new Response(JSON.stringify(auth), { headers: { "cache-control": `max-age=${cacheTtlSec}` } }));
    return auth;
  } catch {
    return null;
  }
}

function parseVizRows(payload: any): Array<Record<string, any>> {
  const doc = payload?.finance?.result?.[0]?.documents?.[0];
  const rows = Array.isArray(doc?.rows) ? doc.rows : [];
  const cols = Array.isArray(doc?.columns) ? doc.columns : [];
  const ids = cols.map((c: any) => String(c?.id || ""));
  const out: Array<Record<string, any>> = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const o: Record<string, any> = {};
    for (let i = 0; i < Math.min(ids.length, r.length); i++) {
      const id = ids[i];
      if (id) o[id] = r[i];
    }
    out.push(o);
  }
  return out;
}

function parseStartdatetimeMs(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{13}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function formatOffset(minutes: number): string {
  const sign = minutes <= 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function dayBoundsWithOffset(dayIso: string, timeZone: string): { start: string; end: string } | null {
  const m = String(dayIso || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (![yy, mm, dd].every((n) => Number.isFinite(n))) return null;
  const startUtc = zonedTimeToUtcMs({ year: yy, month: mm, day: dd, hour: 0, minute: 0 }, timeZone);
  const localAsUtc = Date.UTC(yy, mm - 1, dd, 0, 0, 0, 0);
  const offsetMin = Math.trunc((localAsUtc - startUtc) / 60000);
  const off = formatOffset(offsetMin);
  return {
    start: `${String(dayIso)}T00:00:00.000${off}`,
    end: `${addDaysIso(dayIso, 1)}T00:00:00.000${off}`,
  };
}

async function fetchYahooEconomicCalendarViz(params: {
  dayIso: string;
  mode: "important" | "all";
  cacheTtlSec: number;
  authTtlSec: number;
  timeZone: string;
}): Promise<CalendarEvent[]> {
  const { dayIso, mode, cacheTtlSec, authTtlSec, timeZone } = params;
  const cacheKey = new Request(`https://cache.local/yahoo-economic-viz/v4/${encodeURIComponent(dayIso)}/${mode}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<CalendarEvent[]>();
      if (Array.isArray(json)) return json;
    } catch {}
  }

  const auth = await fetchYahooAuth(authTtlSec);
  if (!auth) return [];

  const bounds = dayBoundsWithOffset(dayIso, timeZone);
  if (!bounds) return [];
  const includeFields = [
    "econ_release",
    "country_code",
    "startdatetime",
    "period",
    "after_release_actual",
    "consensus_estimate",
    "prior_release_actual",
    "originally_reported_actual",
  ];
  const body = {
    offset: 0,
    size: 250,
    sortField: "startdatetime",
    sortType: "ASC",
    entityIdType: "ECONOMIC_EVENT",
    includeFields,
    query: {
      operator: "and",
      operands: [
        { operator: "gte", operands: ["startdatetime", bounds.start] },
        { operator: "lt", operands: ["startdatetime", bounds.end] },
      ],
    },
  };

  try {
    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/visualization?lang=en-US&region=US&crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
        cookie: auth.cookie,
        "x-crumb": auth.crumb,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return [];
    }
    const rows = parseVizRows(json);
    const out: CalendarEvent[] = [];
    for (const r of rows) {
      const name = String(r?.econ_release ?? "").trim();
      const country = String(r?.country_code ?? "").trim().toUpperCase();
      const utcMs = parseStartdatetimeMs(r?.startdatetime);
      if (!name || !country || utcMs == null) continue;
      if (mode === "important" && !isImportantYahooEvent(name, country)) continue;
      out.push({ utcMs, name: `${country} ${name}`.trim() });
    }
    await caches.default.put(cacheKey, new Response(JSON.stringify(out), { headers: { "cache-control": `max-age=${cacheTtlSec}` } }));
    return out;
  } catch {
    return [];
  }
}

async function fetchYahooEconomicCalendar(params: {
  dayIso: string;
  mode: "important" | "all";
  cacheTtlSec: number;
}): Promise<{ observedDayIso: string | null; events: CalendarEvent[] }> {
  const { dayIso, mode, cacheTtlSec } = params;
  const url = `https://finance.yahoo.com/calendar/economic?day=${encodeURIComponent(dayIso)}`;
  const cacheKey = new Request(`https://cache.local/yahoo-economic/v2/${encodeURIComponent(dayIso)}/${mode}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<any>();
      if (json && Array.isArray(json.events)) {
        return { observedDayIso: typeof json.observedDayIso === "string" ? json.observedDayIso : null, events: json.events };
      }
    } catch {}
  }
  try {
    const res = await fetch(url, {
      headers: {
        accept: "text/html,*/*;q=0.9",
        "user-agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) return { observedDayIso: null, events: [] };
    const html = await res.text();
    const observedDayIso = parseYahooCalendarHeaderDayIso(html, dayIso);
    const effectiveDayIso = observedDayIso || dayIso;
    const tableIdx = html.indexOf("<table");
    if (tableIdx < 0) return { observedDayIso: observedDayIso || null, events: [] };
    const table = html.slice(tableIdx, tableIdx + 200_000);
    const rowMatches = table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const out: CalendarEvent[] = [];
    for (const rm of rowMatches) {
      const row = rm[1] || "";
      if (row.toLowerCase().includes("<th")) continue;
      const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1] || "");
      if (cells.length < 3) continue;
      const eventName = stripHtml(cells[0]);
      const country = stripHtml(cells[1]);
      const utcMs = parseYahooUtcMs(effectiveDayIso, cells[2]);
      if (!eventName || !country || utcMs == null) continue;
      if (mode === "important" && !isImportantYahooEvent(eventName, country)) continue;
      out.push({ utcMs, name: `${country} ${eventName}`.trim() });
    }
    const payload = { observedDayIso: observedDayIso || null, events: out };
    await caches.default.put(cacheKey, new Response(JSON.stringify(payload), { headers: { "cache-control": `max-age=${cacheTtlSec}` } }));
    return payload;
  } catch {
    return { observedDayIso: null, events: [] };
  }
}

async function fetchCalendarEvents(env: Env, timeZone: string): Promise<CalendarEvent[]> {
  const ttl = clampInt(Number((env.ECON_CALENDAR_CACHE_TTL || "").trim()) || 900, 60, 86400);
  const source = (env.ECON_CALENDAR_SOURCE || "").trim().toLowerCase();
  if (source === "yahoo_viz") {
    const mode = (env.ECON_CALENDAR_YAHOO_MODE || "").trim().toLowerCase() === "all" ? "all" : "important";
    const days = clampInt(Number((env.ECON_CALENDAR_DAYS || "").trim()) || 7, 1, 30);
    const authTtl = clampInt(Math.floor(ttl * 6), 600, 43200);
    const todayIso = formatInTimeZone(Date.now(), timeZone).slice(0, 10);
    const all: CalendarEvent[] = [];
    for (let i = 0; i < days; i++) {
      const dayIso = addDaysIso(todayIso, i);
      const events = await fetchYahooEconomicCalendarViz({ dayIso, mode, cacheTtlSec: ttl, authTtlSec: authTtl, timeZone });
      all.push(...events);
    }
    const seen = new Set<string>();
    const deduped: CalendarEvent[] = [];
    for (const e of all) {
      const key = `${e.utcMs}|${e.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }
    return deduped.sort((a, b) => a.utcMs - b.utcMs);
  }
  if (source === "yahoo") {
    const mode = (env.ECON_CALENDAR_YAHOO_MODE || "").trim().toLowerCase() === "all" ? "all" : "important";
    const todayIso = formatInTimeZone(Date.now(), timeZone).slice(0, 10);
    const r = await fetchYahooEconomicCalendar({ dayIso: todayIso, mode, cacheTtlSec: ttl });
    const seen = new Set<string>();
    const deduped: CalendarEvent[] = [];
    for (const e of r.events) {
      const key = `${e.utcMs}|${e.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }
    return deduped.sort((a, b) => a.utcMs - b.utcMs);
  }

  const url = (env.ECON_CALENDAR_URL || "").trim();
  if (url) {
    const cacheKey = new Request(`https://cache.local/econ-calendar/${encodeURIComponent(url)}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const t = (await cached.text()).trim();
      if (t) return parseCalendarLines(t, timeZone).map((e) => ({ utcMs: e.utcMs, name: e.name }));
    }
    try {
      const res = await fetch(url, { headers: { accept: "text/plain,application/json;q=0.9,*/*;q=0.8", "user-agent": "Mozilla/5.0" } });
      if (res.ok) {
        const text = (await res.text()).slice(0, 20000).trim();
        if (text) {
          await caches.default.put(cacheKey, new Response(text, { headers: { "cache-control": `max-age=${ttl}` } }));
          return parseCalendarLines(text, timeZone).map((e) => ({ utcMs: e.utcMs, name: e.name }));
        }
      }
    } catch {}
  }

  const spec =
    (env.ECON_CALENDAR || "").trim() ||
    [
      "2026-03-29 08:30 US CPI (YoY)",
      "2026-03-31 14:00 FOMC Interest Rate Decision",
      "2026-04-02 08:30 US Non-Farm Payrolls",
    ].join("\n");
  return parseCalendarLines(spec, timeZone).map((e) => ({ utcMs: e.utcMs, name: e.name }));
}


async function telegramApi(token: string, method: string, payload: any): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json<any>();
  if (!json.ok) throw new Error(json.description || "Telegram API error");
  return json.result;
}

type SendMessageOptions = { replyMarkup?: any };

function buildInlineActions(ticker: string) {
  const t = ticker.trim().toUpperCase();
  const summaryData = `S|${t}`.slice(0, 64);
  const fullData = `F|${t}`.slice(0, 64);
  const heatmapData = `HM|${t}`.slice(0, 64);
  return {
    inline_keyboard: [
      [
        { text: "🎯 重點", callback_data: summaryData },
        { text: "📈 完整", callback_data: fullData },
      ],
      [{ text: "📋 熱力圖", callback_data: heatmapData }],
      [{ text: "❓ 說明", callback_data: "HELP" }],
    ],
  };
}

function buildHelpMenu() {
  return {
    inline_keyboard: [
      [
        { text: "1️⃣ 完整報告", callback_data: "M|FULL" },
        { text: "2️⃣ 重點", callback_data: "M|SUMMARY" },
      ],
      [
        { text: "3️⃣ 觀察清單", callback_data: "M|WATCH" },
        { text: "4️⃣ 熱力圖", callback_data: "M|HEATMAP" },
      ],
      [
        { text: "🔎 一鍵觀察(自選)", callback_data: "M|WATCHPORT" },
        { text: "📋 一鍵熱力圖(自選)", callback_data: "M|HEATMAPPORT" },
      ],
      [
        { text: "👤 我的觀察", callback_data: "M|WATCHME" },
        { text: "👤 我的熱力圖", callback_data: "M|HEATMAPME" },
      ],
      [
        { text: "5️⃣ 投資組合", callback_data: "M|PORTFOLIO" },
        { text: "6️⃣ 六合彩", callback_data: "M|MARKSIX" },
      ],
      [
        { text: "7️⃣ 宏觀 (Macro)", callback_data: "M|MACRO" },
        { text: "8️⃣ 操作建議", callback_data: "M|ACTION" },
      ],
      [
        { text: "9️⃣ 早晨簡報", callback_data: "M|MORNING" },
        { text: "🗓️ 行事曆", callback_data: "M|CALENDAR" },
      ],
      [{ text: "🛡️ HALO 監控", callback_data: "M|HALO" }],
      [{ text: "🆔 /whoami 取得 Chat ID", callback_data: "M|WHOAMI" }],
      [{ text: "✖️ 取消/清除等待", callback_data: "M|CANCEL" }],
    ],
  };
}

type PendingAction = "full" | "summary" | "watch" | "heatmap" | "portfolio";

function decodeCallbackData(data: string): string {
  const raw = (data || "").trim();
  if (!raw) return "/help";
  if (raw === "HELP") return "/help";
  if (raw === "HM") return "/heatmap";
  if (!raw.includes("|")) return raw;
  const [kind, rest] = raw.split("|");
  const payload = (rest || "").trim();
  if (kind === "S" && payload) return `/summary ${payload}`;
  if (kind === "F" && payload) return `/full ${payload}`;
  if (kind === "HM") return payload ? `/heatmap ${payload}` : "/heatmap";
  return raw;
}

async function sendMessage(token: string, chatId: number, text: string, options?: SendMessageOptions): Promise<void> {
  const chunkSize = 3900;
  for (let i = 0; i < text.length; i += chunkSize) {
    await telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: text.slice(i, i + chunkSize),
      disable_web_page_preview: true,
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    });
  }
}

async function sendDocument(token: string, chatId: number, params: { filename: string; content: string; caption?: string }): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (params.caption) form.set("caption", params.caption);
  form.set("document", new Blob([params.content], { type: "text/plain; charset=utf-8" }), params.filename);
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json<any>();
  if (!json.ok) throw new Error(json.description || "Telegram sendDocument error");
}

async function fetchFredLatest(seriesId: string): Promise<number | null> {
  const cacheKey = new Request(`https://cache.local/fred/${encodeURIComponent(seriesId)}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    const t = await cached.text();
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].split(",");
    if (parts.length < 2) continue;
    const v = parts[1].trim();
    if (!v || v === ".") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    await caches.default.put(cacheKey, new Response(String(n), { headers: { "cache-control": "max-age=300" } }));
    return n;
  }
  return null;
}

async function fetchFredLastTwo(seriesId: string): Promise<{ latest: number; prev: number | null } | null> {
  const cacheKey = new Request(`https://cache.local/fred2/${encodeURIComponent(seriesId)}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<any>();
      const latest = Number(json?.latest);
      const prev = json?.prev != null ? Number(json.prev) : null;
      if (!Number.isFinite(latest)) return null;
      if (prev != null && !Number.isFinite(prev)) return null;
      return { latest, prev };
    } catch {
      // ignore
    }
  }

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const values: number[] = [];
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].split(",");
    if (parts.length < 2) continue;
    const v = parts[1].trim();
    if (!v || v === ".") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    values.push(n);
    if (values.length >= 2) break;
  }
  if (values.length === 0) return null;
  const latest = values[0];
  const prev = values.length > 1 ? values[1] : null;
  const payload = JSON.stringify({ latest, prev });
  await caches.default.put(cacheKey, new Response(payload, { headers: { "cache-control": "max-age=300" } }));
  return { latest, prev };
}

async function fetchTreasuryYieldCurveLastTwo(year: number): Promise<{
  asOfDate: string;
  latest: { y2: number; y10: number; y30: number };
  prev: { y2: number; y10: number; y30: number };
} | null> {
  const cacheKey = new Request(`https://cache.local/ustyc/${year}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<any>();
      const asOfDate = String(json?.asOfDate || "");
      const y2 = Number(json?.latest?.y2);
      const y10 = Number(json?.latest?.y10);
      const y30 = Number(json?.latest?.y30);
      const p2 = Number(json?.prev?.y2);
      const p10 = Number(json?.prev?.y10);
      const p30 = Number(json?.prev?.y30);
      if (!asOfDate) return null;
      if (![y2, y10, y30, p2, p10, p30].every((n) => Number.isFinite(n))) return null;
      return { asOfDate, latest: { y2, y10, y30 }, prev: { y2: p2, y10: p10, y30: p30 } };
    } catch {
      // ignore
    }
  }

  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${encodeURIComponent(String(year))}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const xml = await res.text();

  const pull = (tag: string) => {
    const re = new RegExp(`<d:${tag}\\b[^>]*>([^<]*)</d:${tag}>`, "g");
    const out: string[] = [];
    for (const m of xml.matchAll(re)) out.push((m[1] || "").trim());
    return out;
  };

  const dates = pull("NEW_DATE");
  const y2s = pull("BC_2YEAR");
  const y10s = pull("BC_10YEAR");
  const y30s = pull("BC_30YEAR");
  const n = Math.min(dates.length, y2s.length, y10s.length, y30s.length);
  if (n < 2) return null;

  const asOfDate = dates[n - 1];
  const latest = { y2: Number(y2s[n - 1]), y10: Number(y10s[n - 1]), y30: Number(y30s[n - 1]) };
  const prev = { y2: Number(y2s[n - 2]), y10: Number(y10s[n - 2]), y30: Number(y30s[n - 2]) };
  if (![latest.y2, latest.y10, latest.y30, prev.y2, prev.y10, prev.y30].every((x) => Number.isFinite(x))) return null;

  const payload = JSON.stringify({ asOfDate, latest, prev });
  await caches.default.put(cacheKey, new Response(payload, { headers: { "cache-control": "max-age=300" } }));
  return { asOfDate, latest, prev };
}

function weeklyCloses(timestamps: number[], closes: number[]): number[] {
  const n = Math.min(timestamps.length, closes.length);
  const out: number[] = [];
  let lastKey = "";
  for (let i = 0; i < n; i++) {
    const ts = timestamps[i] * 1000;
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const week = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000 / 7);
    const key = `${y}-W${week}`;
    if (key !== lastKey) {
      out.push(closes[i]);
      lastKey = key;
    } else {
      out[out.length - 1] = closes[i];
    }
  }
  return out;
}

function sharpe30d(closes: number[]): number {
  if (closes.length < 35) return 0;
  const rs: number[] = [];
  for (let i = closes.length - 31; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (!prev || !cur) continue;
    rs.push((cur - prev) / prev);
  }
  if (rs.length < 10) return 0;
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const variance = rs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / Math.max(1, rs.length - 1);
  const sd = Math.sqrt(variance);
  if (!sd) return 0;
  return (mean / sd) * Math.sqrt(252);
}

function fmtPct(x: number): string {
  const s = `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
  return s;
}

async function buildMorningContext(profile: { risk: RiskTolerance; horizon: Horizon }): Promise<{
  isoDate: string;
  asOfUnix: number;
  lines: string[];
  btcPrice: number;
  btcSignal: string;
  btcPos: string;
  btcMet: number;
  rsiD: number;
  rsiW: number;
  s30: number;
  vix: ChartData;
  spx: ChartData;
  dxy: ChartData;
  pVix: number;
  pSpx: number;
  pDxy: number;
  vixChgPct: number;
  spxChgPct: number;
  dxyChgPct: number;
  hyOas: number | null;
  yc: { asOfDate: string; latest: { y2: number; y10: number; y30: number }; prev: { y2: number; y10: number; y30: number } } | null;
  us10y: number | null;
  us10yChgBps: number | null;
  regime: "RISK-OFF" | "RISK-ON";
  mood: { sentiment: "PANIC" | "FEAR" | "NORMAL"; advice: string; stance: "DEFENSIVE" | "CAUTIOUS" | "NEUTRAL" };
}> {
  const isoDate = new Date().toISOString().slice(0, 10);

  const [btc, vix, spx, dxy] = await Promise.all([
    fetchYahooChart("BTC-USD"),
    fetchYahooChart("^VIX"),
    fetchYahooChart("^GSPC"),
    fetchYahooChart("DX-Y.NYB"),
  ]);

  const btcPrice = btc.closes[btc.closes.length - 1] || 0;
  const rsiD = rsi14(btc.closes);
  const rsiW = rsi14(weeklyCloses(btc.timestamps, btc.closes));
  const s30 = sharpe30d(btc.closes);
  const d20 = sma(btc.closes, 20);
  const d200 = sma(btc.closes, 200);
  const atr = atr14(btc.highs, btc.lows, btc.closes);
  const atrPct = btcPrice ? (atr / btcPrice) * 100 : 0;
  const hi60 = Math.max(...btc.closes.slice(-60));

  const btcMet = [
    rsiD <= 40,
    rsiW >= 45,
    btcPrice >= d20,
    btcPrice >= d200,
    s30 > 0,
    hi60 ? btcPrice / hi60 - 1 > -0.2 : true,
    atrPct < 6,
  ].filter(Boolean).length;
  const btcSignal = btcMet >= 5 ? "買入" : btcMet >= 4 ? "偏買" : btcMet >= 3 ? "觀望" : "避險";
  const btcPos = btcMet >= 5 ? "5–10%" : btcMet >= 4 ? "2–5%" : "0–2%";

  const pVix = vix.closes[vix.closes.length - 1] || 0;
  const pSpx = spx.closes[spx.closes.length - 1] || 0;
  const pDxy = dxy.closes[dxy.closes.length - 1] || 0;

  const chg = (series: ChartData) => {
    const last = series.closes[series.closes.length - 1] || 0;
    const prev = pickBack(series.closes, 1);
    return computePctChange(last, prev);
  };
  const vixChgPct = chg(vix);
  const spxChgPct = chg(spx);
  const dxyChgPct = chg(dxy);

  const year = new Date().getUTCFullYear();
  const [hyOas, yc] = await Promise.all([
    fetchFredLatest("BAMLH0A0HYM2"),
    (async () => (await fetchTreasuryYieldCurveLastTwo(year)) || (await fetchTreasuryYieldCurveLastTwo(year - 1)))(),
  ]);

  const us10y = yc ? yc.latest.y10 : null;
  const us10yChgBps = yc ? (yc.latest.y10 - yc.prev.y10) * 100 : null;
  const regime = pVix >= 20 || (hyOas != null && hyOas >= 4.0) ? "RISK-OFF" : "RISK-ON";
  const mood = sentimentFromVix(pVix);

  const lines = formatMorningLines({
    isoDate,
    sentiment: mood.sentiment,
    advice: mood.advice,
    stance: mood.stance,
    regime,
    vix: pVix,
    vixChgPct,
    spx: pSpx,
    spxChgPct,
    dxy: pDxy,
    dxyChgPct,
    hyOas,
    us10y,
    us10yChgBps,
    btcSignal,
    btcPos,
    btcPrice,
    btcScore: `${btcMet}/7`,
  });

  const asOfUnix = Math.max(btc.asOfUnix || 0, vix.asOfUnix || 0, spx.asOfUnix || 0, dxy.asOfUnix || 0);

  return {
    isoDate,
    asOfUnix,
    lines,
    btcPrice,
    btcSignal,
    btcPos,
    btcMet,
    rsiD,
    rsiW,
    s30,
    vix,
    spx,
    dxy,
    pVix,
    pSpx,
    pDxy,
    vixChgPct,
    spxChgPct,
    dxyChgPct,
    hyOas,
    yc,
    us10y,
    us10yChgBps,
    regime,
    mood,
  };
}

async function formatMacroDashboard(profile: { risk: RiskTolerance; horizon: Horizon }): Promise<string> {
  const morningCtx = await buildMorningContext(profile);

  const [gold, wti, igOas, sofr] = await Promise.all([
    fetchYahooChart("GC=F"),
    fetchYahooChart("CL=F"),
    fetchFredLatest("BAMLC0A0CM"),
    fetchFredLatest("SOFR"),
  ]);

  const pGold = gold.closes[gold.closes.length - 1] || 0;
  const pWti = wti.closes[wti.closes.length - 1] || 0;

  const chg = (series: ChartData) => {
    const last = series.closes[series.closes.length - 1] || 0;
    const prev = pickBack(series.closes, 1);
    return computePctChange(last, prev);
  };

  const walcl = await fetchFredLatest("WALCL");
  const rrp = await fetchFredLatest("RRPONTSYD");
  const tga = await fetchFredLatest("WTREGEN");
  const netLiquidity =
    walcl != null && rrp != null && tga != null ? walcl - rrp - tga : null;

  const regime = morningCtx.regime;
  const liquidityStatus =
    netLiquidity != null && sofr != null && sofr < 6 ? "正常" : "偏緊";

  const parts: string[] = [];
  parts.push(...morningCtx.lines);
  parts.push("");
  parts.push("🌍 全球宏觀儀表板 (Macro)");
  parts.push("");
  parts.push("🧡 比特幣 (BTC) 分析");
  parts.push(`- 訊號: ${morningCtx.btcSignal}`);
  parts.push(`- 建議倉位: ${morningCtx.btcPos}`);
  parts.push(`- 現價: ${morningCtx.btcPrice.toFixed(0)} USD`);
  parts.push(`- RSI(日): ${morningCtx.rsiD.toFixed(1)} | RSI(週): ${morningCtx.rsiW.toFixed(1)}`);
  parts.push(`- 30D Sharpe: ${morningCtx.s30.toFixed(2)}`);
  parts.push(`- 分數: ${morningCtx.btcMet}/7`);
  parts.push("");
  parts.push("🌐 全球 Macro 看板");
  parts.push(`- Regime: ${regime}`);
  parts.push(`- VIX: ${morningCtx.pVix.toFixed(2)} (${fmtPct(morningCtx.vixChgPct)})`);
  parts.push(`- S&P 500: ${morningCtx.pSpx.toFixed(0)} (${fmtPct(morningCtx.spxChgPct)})`);
  parts.push(`- Gold (GC=F): ${pGold.toFixed(2)} (${fmtPct(chg(gold))})`);
  parts.push(`- WTI (CL=F): ${pWti.toFixed(2)} (${fmtPct(chg(wti))})`);
  if (morningCtx.hyOas != null) parts.push(`- HY OAS: ${morningCtx.hyOas.toFixed(2)}% (${Math.round(morningCtx.hyOas * 100)} bps)`);
  if (igOas != null) parts.push(`- IG OAS: ${igOas.toFixed(2)}% (${Math.round(igOas * 100)} bps)`);
  parts.push(`- DXY: ${morningCtx.pDxy.toFixed(2)} (${fmtPct(morningCtx.dxyChgPct)})`);
  if (morningCtx.yc) {
    const d2 = (morningCtx.yc.latest.y2 - morningCtx.yc.prev.y2) * 100;
    const d10 = (morningCtx.yc.latest.y10 - morningCtx.yc.prev.y10) * 100;
    const d30 = (morningCtx.yc.latest.y30 - morningCtx.yc.prev.y30) * 100;
    parts.push(`- US 2Y: ${morningCtx.yc.latest.y2.toFixed(2)}% (${d2 >= 0 ? "+" : ""}${d2.toFixed(0)} bps)`);
    parts.push(`- US 10Y: ${morningCtx.yc.latest.y10.toFixed(2)}% (${d10 >= 0 ? "+" : ""}${d10.toFixed(0)} bps)`);
    parts.push(`- US 30Y: ${morningCtx.yc.latest.y30.toFixed(2)}% (${d30 >= 0 ? "+" : ""}${d30.toFixed(0)} bps)`);
  } else {
    const us2y = await fetchFredLastTwo("DGS2");
    const us10y = await fetchFredLastTwo("DGS10");
    const us30y = await fetchFredLastTwo("DGS30");
    if (us2y) {
      const d = us2y.prev != null ? (us2y.latest - us2y.prev) * 100 : null;
      parts.push(`- US 2Y: ${us2y.latest.toFixed(2)}% (${d != null ? `${d >= 0 ? "+" : ""}${d.toFixed(0)} bps` : "Δ N/A"})`);
    }
    if (us10y) {
      const d = us10y.prev != null ? (us10y.latest - us10y.prev) * 100 : null;
      parts.push(`- US 10Y: ${us10y.latest.toFixed(2)}% (${d != null ? `${d >= 0 ? "+" : ""}${d.toFixed(0)} bps` : "Δ N/A"})`);
    }
    if (us30y) {
      const d = us30y.prev != null ? (us30y.latest - us30y.prev) * 100 : null;
      parts.push(`- US 30Y: ${us30y.latest.toFixed(2)}% (${d != null ? `${d >= 0 ? "+" : ""}${d.toFixed(0)} bps` : "Δ N/A"})`);
    }
  }
  parts.push("");
  parts.push("💧 流動性狀態");
  if (netLiquidity != null) parts.push(`- Net Liquidity (WALCL-RRP-TGA): ${netLiquidity.toFixed(2)}B`);
  if (sofr != null) parts.push(`- SOFR: ${sofr.toFixed(2)}%`);
  parts.push(`- 狀態: ${liquidityStatus}`);
  parts.push("");
  parts.push(`Generated: ${new Date().toISOString()} | 偏好: 風險=${riskLabelZh(profile.risk)} 週期=${horizonLabelZh(profile.horizon)}`);
  return parts.join("\n");
}

async function fetchYahooQuoteSummary(symbol: string): Promise<{
  trailingPE: number | null;
  forwardPE: number | null;
  epsForward: number | null;
  epsTrailing12Months: number | null;
  growthPct: number | null;
  sources: { pe?: string; fpe?: string; epsTtm?: string; epsFwd?: string; growth?: string };
}> {
  const cacheKey = new Request(`https://cache.local/yahoo/val/${encodeURIComponent(symbol)}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    try {
      const json = await cached.json<any>();
      const trailingPE = json?.trailingPE != null ? Number(json.trailingPE) : null;
      const forwardPE = json?.forwardPE != null ? Number(json.forwardPE) : null;
      const epsForward = json?.epsForward != null ? Number(json.epsForward) : null;
      const epsTrailing12Months = json?.epsTrailing12Months != null ? Number(json.epsTrailing12Months) : null;
      const growthPct = json?.growthPct != null ? Number(json.growthPct) : null;
      const sources = (json?.sources && typeof json.sources === "object") ? json.sources : {};
      return {
        trailingPE: Number.isFinite(trailingPE as number) ? trailingPE : null,
        forwardPE: Number.isFinite(forwardPE as number) ? forwardPE : null,
        epsForward: Number.isFinite(epsForward as number) ? epsForward : null,
        epsTrailing12Months: Number.isFinite(epsTrailing12Months as number) ? epsTrailing12Months : null,
        growthPct: Number.isFinite(growthPct as number) ? growthPct : null,
        sources,
      };
    } catch {
      // ignore
    }
  }

  const headers = { "user-agent": "Mozilla/5.0", accept: "application/json,text/plain,*/*" };

  let trailingPE: number | null = null;
  let forwardPE: number | null = null;
  let epsForward: number | null = null;
  let epsTTM: number | null = null;
  let growthPct: number | null = null;
  const sources: { pe?: string; fpe?: string; epsTtm?: string; epsFwd?: string; growth?: string } = {};
  const hkSlugs: Record<string, string> = {
    "0700.HK": "tencent",
    "9988.HK": "alibaba",
    "1810.HK": "xiaomi",
    "3690.HK": "meituan-dianping",
  };
  const hkAdrSlugs: Record<string, string> = {
    "0700.HK": "tcehy",
    "9988.HK": "baba",
    "1810.HK": "xiacy",
  };

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,defaultKeyStatistics,financialData`;
  try {
    const res = await fetch(url, { headers });
    const json = await res.json<any>();
    const r = json?.quoteSummary?.result?.[0] || {};
    const sd = r.summaryDetail || {};
    const ks = r.defaultKeyStatistics || {};
    const fd = r.financialData || {};
  const getNum = (obj: any, path: string[]): number | null => {
    try {
      let v: any = obj;
      for (const k of path) v = v?.[k];
      const n = v?.raw ?? v;
      return Number.isFinite(Number(n)) ? Number(n) : null;
    } catch {
      return null;
    }
  };
    const tpe = getNum(sd, ["trailingPE"]) ?? getNum(ks, ["trailingPE"]) ?? getNum(ks, ["trailingPE", "raw"]) ?? null;
    const fpe = getNum(sd, ["forwardPE"]) ?? getNum(ks, ["forwardPE"]) ?? getNum(fd, ["forwardPE"]) ?? null;
    const ef = getNum(fd, ["epsForward"]) ?? null;
    const et = getNum(ks, ["trailingEps"]) ?? getNum(fd, ["epsTrailingTwelveMonths"]) ?? null;
    const growthRaw = getNum(fd, ["earningsGrowth"]) ?? getNum(fd, ["revenueGrowth"]) ?? null;
    const gp = growthRaw != null ? growthRaw * 100 : null;

    if (tpe != null) {
      trailingPE = tpe;
      sources.pe = sources.pe || "Yahoo";
    }
    if (fpe != null) {
      forwardPE = fpe;
      sources.fpe = sources.fpe || "Yahoo";
    }
    if (ef != null) {
      epsForward = ef;
      sources.epsFwd = sources.epsFwd || "Yahoo";
    }
    if (et != null) {
      epsTTM = et;
      sources.epsTtm = sources.epsTtm || "Yahoo";
    }
    if (gp != null) {
      growthPct = gp;
      sources.growth = sources.growth || "Yahoo";
    }
  } catch {
    // ignore
  }

  if (trailingPE == null && forwardPE == null) {
    try {
      const url2 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const res2 = await fetch(url2, { headers });
      const json2 = await res2.json<any>();
      const q = json2?.quoteResponse?.result?.[0] || {};
      const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
      const tpe = toNum(q.trailingPE);
      const fpe = toNum(q.forwardPE);
      const ef = toNum(q.epsForward);
      const et = toNum(q.epsTrailingEps) ?? toNum(q.epsTrailingTwelveMonths);
      if (tpe != null) {
        trailingPE = tpe;
        sources.pe = sources.pe || "Yahoo(quote)";
      }
      if (fpe != null) {
        forwardPE = fpe;
        sources.fpe = sources.fpe || "Yahoo(quote)";
      }
      if (ef != null) {
        epsForward = ef;
        sources.epsFwd = sources.epsFwd || "Yahoo(quote)";
      }
      if (et != null) {
        epsTTM = et;
        sources.epsTtm = sources.epsTtm || "Yahoo(quote)";
      }
    } catch {
      // ignore
    }
  }

  if (
    trailingPE == null &&
    forwardPE == null &&
    epsForward == null &&
    epsTTM == null &&
    growthPct == null &&
    /^[A-Z]{1,6}$/.test(symbol)
  ) {
    try {
      const url3 = `https://stockanalysis.com/stocks/${encodeURIComponent(symbol.toLowerCase())}/`;
      const res3 = await fetch(url3, { headers: { "user-agent": "Mozilla/5.0" } });
      const html = await res3.text();
      const extractMetric = (label: string): number | null => {
        const re = new RegExp(`>${label}<\\/td><td[^>]*>([0-9.,-]+)`, "i");
        const m = html.match(re);
        if (!m) return null;
        const n = Number(String(m[1]).replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      trailingPE = extractMetric("PE Ratio") ?? trailingPE;
      forwardPE = extractMetric("Forward PE") ?? forwardPE;
      if (trailingPE != null) sources.pe = sources.pe || "StockAnalysis";
      if (forwardPE != null) sources.fpe = sources.fpe || "StockAnalysis";

      if (growthPct == null) {
        const re = new RegExp(`>EPS<\\/td><td[^>]*>([0-9.,-]+)[\\s\\S]*?([+-]?[0-9.]+)%`, "i");
        const m = html.match(re);
        if (m) {
          const n = Number(m[2]);
          if (Number.isFinite(n)) {
            growthPct = n;
            sources.growth = sources.growth || "StockAnalysis";
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (
    trailingPE == null &&
    forwardPE == null &&
    epsForward == null &&
    epsTTM == null &&
    growthPct == null &&
    symbol.endsWith(".HK")
  ) {
    const slug = hkSlugs[symbol.toUpperCase()] || "";
    if (slug) {
      try {
        const cmcKey = new Request(`https://cache.local/cmc/pe/${encodeURIComponent(slug)}`);
        const cachedCmc = await caches.default.match(cmcKey);
        if (cachedCmc) {
          const n = Number(await cachedCmc.text());
          if (Number.isFinite(n)) trailingPE = n;
        } else {
          const url3 = `https://companiesmarketcap.com/${encodeURIComponent(slug)}/pe-ratio/`;
          const res3 = await fetch(url3, { headers: { "user-agent": "Mozilla/5.0" } });
          const html = await res3.text();
          const m =
            html.match(/P\/?E ratio[^<]*<[^>]*>\s*([0-9.,-]+)/i) ||
            html.match(/P\/?E ratio[^:]*:\s*([0-9.,-]+)/i);
          const pe = m ? Number(String(m[1]).replace(/,/g, "")) : NaN;
          if (Number.isFinite(pe)) {
            trailingPE = pe;
            sources.pe = sources.pe || "CompaniesMarketCap";
            await caches.default.put(cmcKey, new Response(String(pe), { headers: { "cache-control": "max-age=3600" } }));
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (symbol.endsWith(".HK") && (forwardPE == null || growthPct == null)) {
    const adr = hkAdrSlugs[symbol.toUpperCase()] || "";
    if (adr) {
      try {
        const urlAdr = `https://stockanalysis.com/stocks/${encodeURIComponent(adr)}/`;
        const resAdr = await fetch(urlAdr, { headers: { "user-agent": "Mozilla/5.0" } });
        const html = await resAdr.text();
        const extractMetric = (label: string): number | null => {
          const re = new RegExp(`>${label}<\\/td><td[^>]*>([0-9.,-]+)`, "i");
          const m = html.match(re);
          if (!m) return null;
          const n = Number(String(m[1]).replace(/,/g, ""));
          return Number.isFinite(n) ? n : null;
        };
        const fpe = extractMetric("Forward PE");
        if (forwardPE == null && fpe != null) {
          forwardPE = fpe;
          sources.fpe = sources.fpe || `StockAnalysis(ADR:${adr.toUpperCase()})`;
        }

        if (growthPct == null) {
          const re = new RegExp(`>EPS<\\/td><td[^>]*>([0-9.,-]+)[\\s\\S]*?([+-]?[0-9.]+)%`, "i");
          const m = html.match(re);
          if (m) {
            const n = Number(m[2]);
            if (Number.isFinite(n)) {
              growthPct = n;
              sources.growth = sources.growth || `StockAnalysis(ADR:${adr.toUpperCase()})`;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const out = { trailingPE, forwardPE, epsForward, epsTrailing12Months: epsTTM, growthPct, sources };
  const hasAny =
    out.trailingPE != null ||
    out.forwardPE != null ||
    out.epsForward != null ||
    out.epsTrailing12Months != null ||
    out.growthPct != null;
  await caches.default.put(
    cacheKey,
    new Response(JSON.stringify(out), { headers: { "cache-control": `max-age=${hasAny ? 300 : 30}` } }),
  );
  return out;
}

function parseUnit(envValue: string | undefined, fallback: number): number {
  const n = envValue != null ? Number(String(envValue).trim()) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sentimentFromVix(vix: number): { sentiment: "PANIC" | "FEAR" | "NORMAL"; advice: string; stance: "DEFENSIVE" | "CAUTIOUS" | "NEUTRAL" } {
  if (vix >= 30) return { sentiment: "PANIC", advice: "恐慌偏高：避免追單/避免加槓桿，嚴控風險，等待波動回落。", stance: "DEFENSIVE" };
  if (vix >= 20) return { sentiment: "FEAR", advice: "恐懼偏高：分批、控槓桿，優先持有高品質資產。", stance: "CAUTIOUS" };
  return { sentiment: "NORMAL", advice: "情緒正常：按計畫執行，避免過度頻繁交易。", stance: "NEUTRAL" };
}

function formatMorningLines(params: {
  isoDate: string;
  sentiment: "PANIC" | "FEAR" | "NORMAL";
  advice: string;
  stance: "DEFENSIVE" | "CAUTIOUS" | "NEUTRAL";
  regime: "RISK-OFF" | "RISK-ON";
  vix: number;
  vixChgPct: number;
  spx: number;
  spxChgPct: number;
  dxy: number;
  dxyChgPct: number;
  hyOas: number | null;
  us10y: number | null;
  us10yChgBps: number | null;
  btcSignal: string;
  btcPos: string;
  btcPrice: number;
  btcScore: string;
}): string[] {
  const fmtBps = (d: number | null) => (d == null ? "Δ N/A" : `${d >= 0 ? "+" : ""}${d.toFixed(0)} bps`);
  const triggers: string[] = [];
  if (params.vix >= 30) triggers.push("VIX>30");
  if (params.hyOas != null && params.hyOas >= 6.0) triggers.push("HY OAS>6%");
  if (params.dxy >= 105) triggers.push("DXY>105");
  if (params.us10yChgBps != null && params.us10yChgBps >= 10) triggers.push("10Y ↑(>=10bps)");

  const expert =
    params.regime === "RISK-OFF"
      ? `目前偏風險趨避（VIX ${params.vix.toFixed(2)}）。若 VIX 持續高於 30，代表市場壓力偏大；BTC 訊號 ${params.btcSignal}（${params.btcScore}，建議倉位 ${params.btcPos}）與風險趨避不一致時，避免過度加槓桿。`
      : `目前偏風險偏好（VIX ${params.vix.toFixed(2)}）。BTC 訊號 ${params.btcSignal}（${params.btcScore}，建議倉位 ${params.btcPos}），留意利率與信用利差是否同步改善。`;

  const snapshot: string[] = [];
  snapshot.push(`VIX ${params.vix.toFixed(2)} (${fmtPct(params.vixChgPct)}) | S&P 500 ${params.spx.toFixed(0)} (${fmtPct(params.spxChgPct)})`);
  snapshot.push(`DXY ${params.dxy.toFixed(2)} (${fmtPct(params.dxyChgPct)})${params.hyOas != null ? ` | HY OAS ${params.hyOas.toFixed(2)}%` : ""}`);
  if (params.us10y != null) snapshot.push(`US 10Y ${params.us10y.toFixed(2)}% (${fmtBps(params.us10yChgBps)})`);

  return [
    `🌅 早晨市場簡報 (Morning) — ${params.isoDate}`,
    "",
    `🧠 觀察重點: ${expert}`,
    "",
    `📉 市場情緒: ${params.sentiment}`,
    `建議: ${params.advice}`,
    "",
    `🛡️ 投資組合立場: ${params.stance} | Regime: ${params.regime}`,
    `觸發條件: ${triggers.length ? triggers.join(", ") : "無"}`,
    "",
    `📌 快照: ${snapshot.join(" | ")}`,
  ];
}

async function formatActionPlan(env: Env, profile: { risk: RiskTolerance; horizon: Horizon }): Promise<string> {
  const unitUSD = parseUnit(env.POSITION_UNIT_USD, 250);
  const unitHKD = parseUnit(env.POSITION_UNIT_HKD, 2000);
  const maxAdds = Math.max(0, Math.min(5, Math.floor(parseUnit(env.MAX_DAILY_ADDS, 2))));
  const maxTrims = Math.max(0, Math.min(5, Math.floor(parseUnit(env.MAX_DAILY_TRIMS, 2))));
  const maxPerTickerU = Math.max(0.5, Math.min(5, parseUnit(env.MAX_PER_TICKER_U, 1)));

  const vix = await fetchYahooChart("^VIX");
  const dxy = await fetchYahooChart("DX-Y.NYB");
  const hyOas = await fetchFredLatest("BAMLH0A0HYM2");
  const year = new Date().getUTCFullYear();
  const yc = (await fetchTreasuryYieldCurveLastTwo(year)) || (await fetchTreasuryYieldCurveLastTwo(year - 1));

  const pVix = vix.closes[vix.closes.length - 1] || 0;
  const pDxy = dxy.closes[dxy.closes.length - 1] || 0;
  const us10y = yc ? yc.latest.y10 : null;
  const us10yChgBps = yc ? (yc.latest.y10 - yc.prev.y10) * 100 : null;

  const sentiment = pVix >= 30 ? "PANIC" : pVix >= 20 ? "FEAR" : "NORMAL";
  const regime = pVix >= 25 || (hyOas != null && hyOas >= 4.0) ? "RISK-OFF" : "RISK-ON";
  const stance = sentiment === "PANIC" ? "DEFENSIVE" : sentiment === "FEAR" ? "CAUTIOUS" : "NEUTRAL";

  const triggers: string[] = [];
  if (pVix >= 30) triggers.push("VIX>30");
  if (hyOas != null && hyOas >= 6.0) triggers.push("HY OAS>6%");
  if (pDxy >= 105) triggers.push("DXY>105");
  if (us10yChgBps != null && us10yChgBps >= 10) triggers.push("10Y ↑(>=10bps)");

  const spec = (env.PORTFOLIO_POSITIONS || "").trim() || (env.PORTFOLIO || "").trim();
  if (!spec) {
    return [
      "📌 今日操作建議 (Action Plan)",
      "",
      `市場情緒: ${sentiment} | Regime: ${regime}`,
      `投資組合立場: ${stance}`,
      "",
      "尚未設定投資組合。",
      "請設定 Worker env：PORTFOLIO_POSITIONS=NVDA:15@167.52,0700.HK:100@493.4",
      "或輸入：/portfolio NVDA:15@167.52,0700.HK:100@493.4",
      "",
      `觸發條件: ${triggers.length ? triggers.join(", ") : "無"}`,
      `Generated: ${new Date().toISOString()} | 偏好: 風險=${riskLabelZh(profile.risk)} 週期=${horizonLabelZh(profile.horizon)}`,
    ].join("\n");
  }

  const hasQty = spec.includes(":");
  if (!hasQty) {
    return [
      "📌 今日操作建議 (Action Plan)",
      "",
      `市場情緒: ${sentiment} | Regime: ${regime}`,
      `投資組合立場: ${stance}`,
      "",
      "目前只設定了清單（沒有數量/成本），無法計算權重與單位調整。",
      "建議改用：PORTFOLIO_POSITIONS（含數量/成本）",
      "格式：NVDA:15@167.52,0700.HK:100@493.4",
      "",
      `觸發條件: ${triggers.length ? triggers.join(", ") : "無"}`,
      `Generated: ${new Date().toISOString()} | 偏好: 風險=${riskLabelZh(profile.risk)} 週期=${horizonLabelZh(profile.horizon)}`,
    ].join("\n");
  }

  const positions = parsePositionsSpec(spec).slice(0, 30);
  if (positions.length === 0) {
    return [
      "📌 今日操作建議 (Action Plan)",
      "",
      "投資組合格式錯誤。",
      "範例：/portfolio NVDA:15@167.52,0700.HK:100@493.4",
    ].join("\n");
  }

  const rows: Array<{ ticker: string; ccy: string; mv: number; weight: number; bias: Bias; conf: number }> = [];
  const mvByCcy = new Map<string, number>();
  const maxAsOfArr: number[] = [];

  for (const p of positions) {
    const data = await fetchYahooChart(p.ticker);
    maxAsOfArr.push(data.asOfUnix || 0);
    const price = data.closes[data.closes.length - 1] || 0;
    const mv = price * p.quantity;
    const ccy = data.currency;
    mvByCcy.set(ccy, (mvByCcy.get(ccy) || 0) + mv);

    const d20 = sma(data.closes, 20);
    const d200 = sma(data.closes, 200);
    const rsi = rsi14(data.closes);
    const hist = macdHistogram(data.closes);
    const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
    rows.push({ ticker: p.ticker, ccy, mv, weight: 0, bias, conf: confidence });
  }

  for (const r of rows) {
    const total = mvByCcy.get(r.ccy) || 1;
    r.weight = total ? (r.mv / total) * 100 : 0;
  }

  const byRisk = rows
    .slice()
    .sort((a, b) => b.weight - a.weight);

  const trim: Array<{ ticker: string; ccy: string; units: number; amount: number }> = [];
  const add: Array<{ ticker: string; ccy: string; units: number; amount: number }> = [];

  const unitFor = (ccy: string) => (ccy === "HKD" ? unitHKD : unitUSD);

  if (regime === "RISK-OFF") {
    const cands = byRisk.filter((r) => r.weight >= 20 || r.bias === "Bearish" || r.conf < 40).slice(0, maxTrims);
    for (const r of cands) {
      const amt = unitFor(r.ccy);
      trim.push({ ticker: r.ticker, ccy: r.ccy, units: -maxPerTickerU, amount: -amt * maxPerTickerU });
    }
  } else if (regime === "RISK-ON") {
    const cands = byRisk.filter((r) => r.bias === "Bullish" && r.conf >= 60 && r.weight < 20).slice(0, maxAdds);
    for (const r of cands) {
      const amt = unitFor(r.ccy);
      add.push({ ticker: r.ticker, ccy: r.ccy, units: maxPerTickerU, amount: amt * maxPerTickerU });
    }
  }

  const holds = rows
    .filter((r) => !trim.some((t) => t.ticker === r.ticker) && !add.some((a) => a.ticker === r.ticker))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const fmtUnits = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}u`;
  const fmtAmt = (ccy: string, amt: number) => `${amt >= 0 ? "+" : ""}${amt.toFixed(0)} ${ccy}`;

  const lines: string[] = [];
  lines.push(`📌 今日操作建議 (Action Plan) — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`市場情緒: ${sentiment}`);
  lines.push(`投資組合立場: ${stance} | Regime: ${regime}`);
  lines.push("");
  lines.push("操作單位 (Unit)");
  lines.push(`- 1.00u = ${unitUSD.toFixed(0)} USD（USD 持倉）`);
  lines.push(`- 1.00u = ${unitHKD.toFixed(0)} HKD（HKD 持倉）`);
  lines.push("");
  lines.push("風險限制 (Limits)");
  lines.push(`- 每日最多加碼: ${maxAdds} 筆 | 每日最多減碼: ${maxTrims} 筆 | 每檔最多: ${maxPerTickerU.toFixed(2)}u`);
  lines.push("");
  lines.push("觸發條件 (Triggers)");
  lines.push(`- ${triggers.length ? triggers.join(", ") : "無"}`);
  lines.push("");
  lines.push("宏觀摘要 (Macro)");
  lines.push(`- VIX: ${pVix.toFixed(2)}`);
  if (hyOas != null) lines.push(`- HY OAS: ${hyOas.toFixed(2)}%`);
  lines.push(`- DXY: ${pDxy.toFixed(2)}`);
  if (us10y != null) lines.push(`- US 10Y: ${us10y.toFixed(2)}% (${us10yChgBps != null ? `${us10yChgBps >= 0 ? "+" : ""}${us10yChgBps.toFixed(0)} bps` : "Δ N/A"})`);
  lines.push("");
  lines.push("行動建議 (Actions)");
  lines.push(`- 加碼 (Add): ${add.length ? "" : "無"}`);
  for (const a of add) lines.push(`  - ${a.ticker} ${fmtUnits(a.units)} (${fmtAmt(a.ccy, a.amount)})`);
  lines.push(`- 減碼/避免 (Trim/Avoid): ${trim.length ? "" : "無"}`);
  for (const t of trim) lines.push(`  - ${t.ticker} ${fmtUnits(t.units)} (${fmtAmt(t.ccy, t.amount)})`);
  lines.push(`- 持有/觀察 (Hold/Watch): ${holds.length ? "" : "無"}`);
  for (const h of holds) lines.push(`  - ${h.ticker} | ${h.ccy} | 權重 ${h.weight.toFixed(1)}% | ${biasLabelZh(h.bias)} ${h.conf}%`);

  lines.push("");
  lines.push("持倉概覽 (By currency, not FX-converted)");
  for (const [ccy, mv] of Array.from(mvByCcy.entries()).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${ccy}: ${mv.toFixed(2)}`);
  }

  lines.push("");
  lines.push(formatFooter(profile, Math.max(0, ...maxAsOfArr)));
  return lines.join("\n");
}

function stateKey(chatId: number) {
  return new Request(`https://state.local/pending/${chatId}`);
}

async function getPending(chatId: number): Promise<PendingAction | null> {
  const res = await caches.default.match(stateKey(chatId));
  if (!res) return null;
  try {
    const json = await res.json<any>();
    const v = String(json?.pending || "");
    if (v === "full" || v === "summary" || v === "watch" || v === "heatmap" || v === "portfolio") return v;
    return null;
  } catch {
    return null;
  }
}

async function setPending(chatId: number, pending: PendingAction | null): Promise<void> {
  if (!pending) {
    await caches.default.delete(stateKey(chatId));
    return;
  }
  await caches.default.put(
    stateKey(chatId),
    new Response(JSON.stringify({ pending }), {
      headers: { "content-type": "application/json", "cache-control": "max-age=300" },
    }),
  );
}

type MarkSixDraw = { id: string; date: string; numbers: number[]; special: number };

function markSixColor(n: number): "R" | "B" | "G" {
  const red = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]);
  const blue = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]);
  return red.has(n) ? "R" : blue.has(n) ? "B" : "G";
}

function markSixBall(n: number): string {
  const c = markSixColor(n);
  const dot = c === "R" ? "🔴" : c === "B" ? "🔵" : "🟢";
  return `${dot}${String(n).padStart(2, "0")}`;
}

function extractMarkSixDrawsFromHtml(html: string, limit: number): MarkSixDraw[] {
  const draws: MarkSixDraw[] = [];
  const seen = new Set<string>();
  const idRe = /\b(\d{2}\/\d{3})\b/g;
  for (const m of html.matchAll(idRe)) {
    if (draws.length >= limit) break;
    const id = m[1];
    if (!id || seen.has(id)) continue;
    const start = m.index ?? 0;
    const windowText = html.slice(start, start + 2500);
    const dateMatch = windowText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    const date = dateMatch?.[1] || "";
    const nums: number[] = [];
    for (const nm of windowText.matchAll(/>\s*(\d{1,2})\s*</g)) {
      const n = Number(nm[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 49) nums.push(n);
      if (nums.length >= 7) break;
    }
    if (!date || nums.length < 7) continue;
    const numbers = nums.slice(0, 6).sort((a, b) => a - b);
    const special = nums[6];
    if (numbers.length !== 6 || !Number.isFinite(special)) continue;
    draws.push({ id, date, numbers, special });
    seen.add(id);
  }
  return draws;
}

function formatMarkSixReport(draws: MarkSixDraw[], windowSize: number): string {
  const url = "https://lottery.hk/en/mark-six/results/";
  const window = draws.slice(0, Math.max(1, windowSize));
  const recent = draws.slice(0, 8);

  const counts = new Map<number, number>();
  for (let i = 1; i <= 49; i++) counts.set(i, 0);
  for (const d of window) {
    for (const n of d.numbers) counts.set(n, (counts.get(n) || 0) + 1);
  }

  const hot = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 8);

  const cold = Array.from(counts.entries())
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .slice(0, 8);

  const lastSeen = new Map<number, number>();
  window.forEach((d, idx) => {
    for (const n of d.numbers) {
      if (!lastSeen.has(n)) lastSeen.set(n, idx);
    }
  });
  const overdue = Array.from({ length: 49 }, (_, i) => i + 1)
    .map((n) => ({ n, miss: lastSeen.has(n) ? (lastSeen.get(n) as number) : window.length }))
    .sort((a, b) => b.miss - a.miss || a.n - b.n)
    .slice(0, 10);

  let odd = 0;
  let even = 0;
  let small = 0;
  let big = 0;
  for (const d of window) {
    for (const n of d.numbers) {
      if (n % 2 === 0) even += 1;
      else odd += 1;
      if (n >= 25) big += 1;
      else small += 1;
    }
  }
  const totalBalls = Math.max(1, odd + even);

  const pairCounts = new Map<string, number>();
  for (const d of window) {
    const ns = [...d.numbers].sort((a, b) => a - b);
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const key = `${ns[i]}-${ns[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }
  const hotPairs = Array.from(pairCounts.entries())
    .map(([k, c]) => {
      const [a, b] = k.split("-").map((x) => Number(x));
      return { a, b, c };
    })
    .sort((x, y) => y.c - x.c || x.a - y.a || x.b - y.b)
    .slice(0, 10);

  const lines: string[] = [];
  lines.push("香港六合彩 (Mark Six) 數據分析");
  lines.push(`數據來源: ${url}`);
  lines.push(`統計期數: 最近 ${window.length} 期`);
  lines.push("");
  lines.push("最新 8 期結果:");
  for (const d of recent) {
    lines.push(
      `${d.id} (${d.date}): ${d.numbers.map((n) => String(n).padStart(2, "0")).join(", ")} + ${String(d.special).padStart(2, "0")}`,
    );
  }
  lines.push("");
  lines.push("熱門開獎碼 (Top 8):");
  for (const [n, c] of hot) lines.push(`${markSixBall(n)} - 出現 ${c} 次`);
  lines.push("");
  lines.push("冷門開獎碼 (Top 8):");
  for (const [n, c] of cold) lines.push(`${markSixBall(n)} - 出現 ${c} 次`);
  lines.push("");
  lines.push("遺漏值 (最久未出 Top 10):");
  for (const r of overdue) lines.push(`${markSixBall(r.n)} - 未出 ${r.miss} 期`);
  lines.push("");
  lines.push(`奇偶 / 大小 比例 (最近 ${window.length} 期):`);
  lines.push(
    `奇: ${odd} (${((odd / totalBalls) * 100).toFixed(1)}%) | 偶: ${even} (${((even / totalBalls) * 100).toFixed(1)}%)`,
  );
  lines.push(
    `小(01-24): ${small} (${((small / totalBalls) * 100).toFixed(1)}%) | 大(25-49): ${big} (${((big / totalBalls) * 100).toFixed(1)}%)`,
  );
  lines.push("");
  lines.push("波膽 (熱門組合 Top 10):");
  for (const p of hotPairs) lines.push(`${markSixBall(p.a)} ${markSixBall(p.b)} - 出現 ${p.c} 次`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  return lines.join("\n");
}

async function fetchMarkSixReport(windowSize: number): Promise<string> {
  const url = "https://lottery.hk/en/mark-six/results/";
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await res.text();
  const draws = extractMarkSixDrawsFromHtml(html, Math.max(60, windowSize));
  return formatMarkSixReport(draws, windowSize);
}

type ChartData = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  currency: string;
  timestamps: number[];
  asOfUnix: number;
};

async function fetchYahooChart(symbol: string): Promise<ChartData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const json = await res.json<any>();
  if (json.chart?.error) throw new Error(json.chart.error.description || "chart error");
  const r = json.chart.result[0];
  const q = r.indicators.quote[0];
  const rawTimestamps: number[] = (r.timestamp || []).map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x));
  const rawCloses: Array<number | null> = (q.close || []).map((x: any) => (x == null ? null : Number(x)));
  const rawHighs: Array<number | null> = (q.high || []).map((x: any) => (x == null ? null : Number(x)));
  const rawLows: Array<number | null> = (q.low || []).map((x: any) => (x == null ? null : Number(x)));
  const rawVolumes: Array<number | null> = (q.volume || []).map((x: any) => (x == null ? null : Number(x)));

  const n = Math.min(rawTimestamps.length, rawCloses.length, rawHighs.length, rawLows.length, rawVolumes.length);
  const timestamps: number[] = [];
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < n; i++) {
    const ts = rawTimestamps[i];
    const c = rawCloses[i];
    const h = rawHighs[i];
    const l = rawLows[i];
    const v = rawVolumes[i];
    if (!Number.isFinite(ts)) continue;
    if (!Number.isFinite(c as number) || !Number.isFinite(h as number) || !Number.isFinite(l as number)) continue;
    timestamps.push(ts);
    closes.push(Number(c));
    highs.push(Number(h));
    lows.push(Number(l));
    volumes.push(Number.isFinite(v as number) ? Number(v) : 0);
  }
  const asOfUnix =
    (r.meta?.regularMarketTime != null ? Number(r.meta.regularMarketTime) : 0) ||
    (timestamps.length ? timestamps[timestamps.length - 1] : 0) ||
    Math.floor(Date.now() / 1000);
  return { closes, highs, lows, volumes, timestamps, asOfUnix, currency: r.meta?.currency || "USD" };
}

function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values[values.length - 1];
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computePctChange(latest: number, earlier: number): number {
  if (!Number.isFinite(latest) || !Number.isFinite(earlier) || earlier === 0) return 0;
  return ((latest - earlier) / earlier) * 100;
}

function pickBack(values: number[], back: number): number {
  const idx = values.length - 1 - back;
  if (idx < 0) return values[0] ?? 0;
  return values[idx] ?? 0;
}

function ytdPct(timestamps: number[], closes: number[]): number | null {
  const n = Math.min(timestamps.length, closes.length);
  if (n < 2) return null;
  const year = new Date().getUTCFullYear();
  let start: number | null = null;
  for (let i = 0; i < n; i++) {
    const d = new Date(timestamps[i] * 1000);
    if (d.getUTCFullYear() === year) {
      const v = closes[i];
      if (Number.isFinite(v) && v > 0) start = v;
      break;
    }
  }
  if (start == null) return null;
  const last = closes[n - 1];
  if (!Number.isFinite(last) || last <= 0) return null;
  return ((last - start) / start) * 100;
}

function heatColor(bias: Bias, confidence: number, change1d: number): string {
  if (bias === "Bullish" && confidence >= 70) return "🟩";
  if (bias === "Bullish") return change1d >= 0 ? "🟢" : "🟨";
  if (bias === "Bearish" && confidence <= 30) return "🟥";
  if (bias === "Bearish") return change1d <= 0 ? "🟧" : "🟨";
  return "🟨";
}

function bollingerLower(values: number[], period: number, mult: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values[values.length - 1];
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, x) => acc + (x - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return mean - mult * sd;
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return sma(values, period);
  const k = 2 / (period + 1);
  let e = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function rsi14(values: number[]): number {
  const period = 14;
  if (values.length <= period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr14(highs: number[], lows: number[], closes: number[]): number {
  const period = 14;
  if (closes.length <= period) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return sma(trs, period);
}

function haloRegime(vix: number, amber: number, red: number): "🔴 RED" | "🟡 AMBER" | "🟢 GREEN" {
  if (!Number.isFinite(vix)) return "🟡 AMBER";
  if (vix > red) return "🔴 RED";
  if (vix > amber) return "🟡 AMBER";
  return "🟢 GREEN";
}

async function fetchVix(): Promise<number | null> {
  try {
    const data = await fetchYahooChart("^VIX");
    const v = data.closes[data.closes.length - 1];
    return Number.isFinite(v) ? Number(v) : null;
  } catch {
    return null;
  }
}

function buildHaloConfig(env: Env) {
  const emaWindow = clampInt(Number((env.HALO_EMA_WINDOW || "").trim()) || 20, 5, 120);
  const volWindow = clampInt(Number((env.HALO_VOLUME_WINDOW || "").trim()) || 20, 5, 120);
  const volSurge = Number((env.HALO_VOLUME_SURGE || "").trim()) || 1.5;
  const vixAmber = Number((env.HALO_VIX_AMBER || "").trim()) || 18;
  const vixRed = Number((env.HALO_VIX_RED || "").trim()) || 25;
  const nearMissPemaTarget = Number((env.HALO_NEARMISS_PEMA_TARGET || "").trim()) || 1.01;
  const coreSpec =
    (env.HALO_CORE || "").trim() || "EPD=Energy Infrastructure,KMI=Energy Infrastructure,LMT=Defence,RTX=Defence";
  const watchSpec =
    (env.HALO_WATCHLIST || "").trim() ||
    "NVDA=AI Chip,TSM=Foundry,AVGO=Custom Chip,MU=Memory,GOOGL=Double-edged,MSFT=Double-edged,TCOM=High Risk (Milkshake)";
  const stopSpec = (env.HALO_STOP_PCTS || "").trim() || "EPD:0.08,KMI:0.09,LMT:0.06,RTX:0.057";
  const milkshakeSpec = (env.HALO_MILKSHAKE_RISK || "").trim() || "TCOM:high";
  const obsolescenceSpec = (env.HALO_OBSOLESCENCE || "").trim() || "EPD:safe,KMI:safe,LMT:safe,RTX:safe,TCOM:high";
  return {
    emaWindow,
    volWindow,
    volSurge,
    vixAmber,
    vixRed,
    nearMissPemaTarget,
    core: parseTickerLabelSpec(coreSpec),
    watch: parseTickerLabelSpec(watchSpec),
    stopPcts: parseStopPctSpec(stopSpec),
    milkshakeRisk: parseStringMapSpec(milkshakeSpec),
    obsolescence: parseStringMapSpec(obsolescenceSpec),
  };
}

async function formatHaloMonitor(env: Env, positions: Position[], options?: { showAll?: boolean; showTable?: boolean }): Promise<string> {
  const cfg = buildHaloConfig(env);
  const vix = await fetchVix();
  const regime = haloRegime(vix ?? NaN, cfg.vixAmber, cfg.vixRed);
  const showAll = Boolean(options?.showAll);
  const showTable = Boolean(options?.showTable);

  const all = [...cfg.core, ...cfg.watch];
  const uniqTickers = Array.from(new Set(all.map((x) => x.ticker).filter(Boolean)));
  const posByTicker = new Map(positions.map((p) => [p.ticker, p]));
  const labelByTicker = new Map(all.map((x) => [x.ticker, x.label]));
  const coreSet = new Set(cfg.core.map((x) => x.ticker));
  const watchSet = new Set(cfg.watch.map((x) => x.ticker));
  const positionSet = new Set(positions.map((p) => p.ticker));
  const groupRank = (ticker: string): number => {
    if (positionSet.has(ticker) || coreSet.has(ticker)) return 0;
    if (watchSet.has(ticker)) return 1;
    return 2;
  };

  const results = await Promise.all(
    uniqTickers.map(async (ticker) => {
      try {
        const data = await fetchYahooChart(ticker);
        return { ticker, ok: true as const, data };
      } catch (e: any) {
        return { ticker, ok: false as const, error: String(e?.message || e) };
      }
    }),
  );

  const entrySignals: Array<{ ticker: string; reason: string; rank: number }> = [];
  const nearMisses: Array<{ ticker: string; metric: number; line: string; rank: number }> = [];
  const stopTriggers: Array<{ ticker: string; msg: string; rank: number }> = [];
  const warnings: string[] = [];
  const tableRows: Array<{ rank: number; bucket: number; line: string }> = [];
  const infoRows: Array<{
    ticker: string;
    rank: number;
    bucket: number;
    s7: boolean;
    t12: boolean;
    pOverEma: number | null;
    volX: number | null;
    stopPrice: number | null;
    milkshakeHigh: boolean;
    obsolescenceHigh: boolean;
  }> = [];
  let dataOk = 0;
  let bothPass = 0;
  let bothFail = 0;
  let s7Only = 0;
  let t12Only = 0;
  const s7OnlyTickers: string[] = [];
  const t12OnlyTickers: string[] = [];

  for (const r of results) {
    if (!r.ok) {
      warnings.push(`${r.ticker} 資料取得失敗`);
      continue;
    }
    dataOk++;
    const data = r.data;
    const n = data.closes.length;
    if (n < Math.max(cfg.emaWindow, cfg.volWindow) + 1) {
      warnings.push(`${r.ticker} 資料不足`);
      continue;
    }

    const price = data.closes[n - 1];
    const emaRef = avgLast(data.closes, cfg.emaWindow);
    const vol = data.volumes[data.volumes.length - 1];
    const avgVol = avgLast(data.volumes, cfg.volWindow);

    const s7 = emaRef != null && Number.isFinite(price) ? price > emaRef : false;
    const t12 = avgVol != null && Number.isFinite(vol) ? vol >= cfg.volSurge * avgVol : false;
    const reason = `Price ${fmtNumber(price, 2)} / EMA${cfg.emaWindow} ${emaRef != null ? fmtNumber(emaRef, 2) : "N/A"} | Vol ${Number.isFinite(vol) ? Math.trunc(vol).toString() : "N/A"} / AvgVol ${avgVol != null ? Math.trunc(avgVol).toString() : "N/A"}`;
    const pOverEma = emaRef != null && Number.isFinite(price) && emaRef > 0 ? price / emaRef : null;
    const volX = avgVol != null && Number.isFinite(vol) && avgVol > 0 ? vol / avgVol : null;
    const bucket = s7 && t12 ? 0 : s7 ? 1 : t12 ? 2 : 3;
    const bucketLabel = s7 && t12 ? "PASS" : s7 ? "S7" : t12 ? "T12" : "--";

    if (s7 && t12) {
      bothPass++;
      if (regime === "🔴 RED") warnings.push(`${r.ticker} 滿足 S7+T12 但 VIX>${cfg.vixRed} → 不可入場`);
      else entrySignals.push({ ticker: r.ticker, reason, rank: groupRank(r.ticker) });
    }
    if (s7 !== t12) {
      if (s7) s7Only++;
      else t12Only++;
      if (s7) s7OnlyTickers.push(r.ticker);
      else t12OnlyTickers.push(r.ticker);
      const metric = s7 ? (volX ?? 0) : (pOverEma ?? 0);
      const line = `${r.ticker} (${s7 ? "S7✅" : "S7❌"} ${t12 ? "T12✅" : "T12❌"}) | P/EMA ${pOverEma != null ? pOverEma.toFixed(3) : "N/A"} | Vol× ${volX != null ? volX.toFixed(2) : "N/A"}`;
      nearMisses.push({ ticker: r.ticker, metric, line, rank: groupRank(r.ticker) });
    } else if (!s7 && !t12) {
      bothFail++;
    }

    const pos = posByTicker.get(r.ticker);
    const stopPct = pos && pos.costBasis != null && Number.isFinite(pos.costBasis) && pos.costBasis > 0 ? cfg.stopPcts.get(r.ticker) ?? 0.1 : null;
    const stopPrice =
      pos && pos.costBasis != null && Number.isFinite(pos.costBasis) && pos.costBasis > 0 && stopPct != null ? pos.costBasis * (1 - stopPct) : null;
    if (pos && pos.costBasis != null && Number.isFinite(pos.costBasis) && pos.costBasis > 0) {
      if (Number.isFinite(price) && price <= stopPrice) {
        stopTriggers.push({
          ticker: r.ticker,
          msg: `觸發止損 @ ${stopPrice.toFixed(2)} (入場 ${pos.costBasis.toFixed(2)}, 現價 ${price.toFixed(2)})`,
          rank: groupRank(r.ticker),
        });
      }
    }

    if (showTable) {
      const obs = (cfg.obsolescence.get(r.ticker) || "").trim().toLowerCase();
      const ms = (cfg.milkshakeRisk.get(r.ticker) || "").trim().toLowerCase();
      const flags = [
        ms === "high" ? "MS:HIGH" : null,
        obs === "high" ? "OBS:HIGH" : null,
        stopPrice != null ? `STOP ${stopPrice.toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const label = labelByTicker.get(r.ticker);
      const line = `${r.ticker}${label ? ` (${label})` : ""} ${bucketLabel} | P/EMA ${pOverEma != null ? pOverEma.toFixed(3) : "N/A"} | Vol× ${volX != null ? volX.toFixed(2) : "N/A"}${flags ? ` | ${flags}` : ""}`;
      tableRows.push({ rank: groupRank(r.ticker), bucket, line });
    }

    {
      const obs = (cfg.obsolescence.get(r.ticker) || "").trim().toLowerCase();
      const ms = (cfg.milkshakeRisk.get(r.ticker) || "").trim().toLowerCase();
      infoRows.push({
        ticker: r.ticker,
        rank: groupRank(r.ticker),
        bucket,
        s7,
        t12,
        pOverEma,
        volX,
        stopPrice,
        milkshakeHigh: ms === "high",
        obsolescenceHigh: obs === "high",
      });
    }

    if (r.ticker === "TCOM") {
      if (Number.isFinite(price)) warnings.push(`TCOM (Milkshake High Risk) 現價 ${price.toFixed(2)} — 建議減倉或清倉`);
      else warnings.push("TCOM (Milkshake High Risk) — 建議減倉或清倉");
    }
  }

  const hasMstr = uniqTickers.includes("MSTR") || positions.some((p) => p.ticker === "MSTR");
  if (hasMstr) warnings.push("MSTR → PRIORITY REVIEW (Munger inversion): Would you buy fresh today at this price? If NO → sell/reduce.");

  for (const t of uniqTickers) {
    const ms = (cfg.milkshakeRisk.get(t) || "").trim().toLowerCase();
    if (ms === "high") warnings.push(`${t} Milkshake Risk: HIGH`);
    const obs = (cfg.obsolescence.get(t) || "").trim().toLowerCase();
    if (obs === "high") warnings.push(`${t} Obsolescence: HIGH`);
  }

  const lines: string[] = [];
  lines.push(`HALO Monitor — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
  lines.push(`VIX: ${vix != null ? vix.toFixed(2) : "N/A"} → Regime: ${regime}`);
  if (regime === "🔴 RED") lines.push("SIT ON HANDS. Manage stops only.");
  else if (regime === "🟡 AMBER") lines.push("Reduce new entries by 50%.");
  else lines.push("Full risk-on allowed.");
  lines.push(`Coverage: ${dataOk}/${uniqTickers.length} ok | S7+T12 ${bothPass} | S7-only ${s7Only} | T12-only ${t12Only} | both-fail ${bothFail}`);

  lines.push("");
  lines.push("🧪 系統健康狀況評估");
  lines.push(`- Coverage ${dataOk}/${uniqTickers.length}: ${dataOk === uniqTickers.length ? "✅" : "⚠️"}`);
  lines.push(`- S7+T12=${bothPass}: ✅`);
  lines.push(`- S7-only=${s7Only}${s7OnlyTickers.length ? ` (${s7OnlyTickers.join(",")})` : ""}: ✅`);
  lines.push(`- T12-only=${t12Only}${t12OnlyTickers.length ? ` (${t12OnlyTickers.join(",")})` : ""}: ✅`);
  const highBoth = infoRows.filter((r) => r.milkshakeHigh && r.obsolescenceHigh).map((r) => r.ticker);
  if (highBoth.length) lines.push(`- Milkshake+Obsolescence 雙高: ${highBoth.join(",")} ✅`);
  lines.push(`- Regime 判斷: ${regime} ✅`);

  const actions: Array<{ pr: number; line: string }> = [];
  for (const s of stopTriggers) actions.push({ pr: 0, line: `🔴 立即 ${s.ticker} 觸發止損` });
  for (const t of highBoth) actions.push({ pr: 1, line: `🔴 立即 ${t} 減倉/清倉（Milkshake+Obsolescence 雙高）` });
  if (hasMstr) actions.push({ pr: 1, line: "🔴 立即 MSTR PRIORITY REVIEW（Munger inversion）" });

  const targetVolX = cfg.volSurge;
  const targetPema = cfg.nearMissPemaTarget;
  const s7Near = infoRows
    .filter((r) => r.rank <= 1 && r.s7 && !r.t12 && r.volX != null)
    .sort((a, b) => (b.volX ?? 0) - (a.volX ?? 0))
    .slice(0, 3);
  for (const r of s7Near) actions.push({ pr: 2, line: `🟡 監控 ${r.ticker} 量能追蹤（Vol× ${r.volX!.toFixed(2)} → 需要 ≥ ${targetVolX}）` });
  const pNear = infoRows
    .filter((r) => r.rank <= 1 && !r.s7 && r.t12 && r.pOverEma != null)
    .sort((a, b) => (b.pOverEma ?? 0) - (a.pOverEma ?? 0))
    .slice(0, 3);
  for (const r of pNear) actions.push({ pr: 2, line: `🟡 監控 ${r.ticker} 價格回 EMA（P/EMA ${r.pOverEma!.toFixed(3)} → 需要 ≥ 1.000）` });
  const emaNear = infoRows
    .filter((r) => r.rank <= 1 && r.s7 && !r.t12 && r.pOverEma != null)
    .sort((a, b) => (b.pOverEma ?? 0) - (a.pOverEma ?? 0))
    .slice(0, 2);
  for (const r of emaNear) actions.push({ pr: 3, line: `🟡 監控 ${r.ticker} 續航（P/EMA ${r.pOverEma!.toFixed(3)} → 目標 ≥ ${targetPema}）` });
  if (regime === "🔴 RED") actions.unshift({ pr: 0, line: "🔴 立即 SIT ON HANDS（VIX > 25）" });

  const uniqActions = Array.from(new Map(actions.map((a) => [a.line, a])).values())
    .sort((a, b) => a.pr - b.pr || a.line.localeCompare(b.line))
    .slice(0, 8);
  lines.push("");
  lines.push("📌 今日操作建議");
  for (const a of uniqActions) lines.push(`- ${a.line}`);

  lines.push("");
  if (entrySignals.length) {
    lines.push("📈 Entry Signals (S7+T12)");
    const sorted = entrySignals.slice().sort((a, b) => a.rank - b.rank || a.ticker.localeCompare(b.ticker));
    for (const s of sorted) lines.push(`- ${s.ticker}: ${s.reason}`);
  } else {
    lines.push("📉 No qualified entry signals");
  }
  if (showTable && tableRows.length) {
    const sorted = tableRows.slice().sort((a, b) => a.rank - b.rank || a.bucket - b.bucket || a.line.localeCompare(b.line));
    lines.push("");
    lines.push("📋 Table (all tickers)");
    for (const r of sorted) lines.push(`- ${r.line}`);
  }
  if (nearMisses.length) {
    const top = nearMisses.slice().sort((a, b) => a.rank - b.rank || b.metric - a.metric).slice(0, showAll ? 12 : 6);
    lines.push("");
    lines.push("🟦 Near-miss (S7 xor T12)");
    for (const x of top) lines.push(`- ${x.line}`);
    if (!showAll && nearMisses.length > top.length) lines.push(`- (+${nearMisses.length - top.length} more)`);
  }

  if (stopTriggers.length) {
    lines.push("");
    lines.push("⚠️ Stop Loss Triggers");
    const sorted = stopTriggers.slice().sort((a, b) => a.rank - b.rank || a.ticker.localeCompare(b.ticker));
    for (const s of sorted) lines.push(`- ${s.ticker}: ${s.msg}`);
  }

  if (warnings.length) {
    lines.push("");
    lines.push("⚠️ Warnings");
    for (const w of warnings) lines.push(`- ${w}`);
  }

  return lines.join("\n");
}

function macdHistogram(values: number[]): number {
  if (values.length < 30) return 0;
  const macdLine: number[] = [];
  for (let i = 26; i <= values.length; i++) {
    const v = values.slice(0, i);
    macdLine.push(ema(v, 12) - ema(v, 26));
  }
  const signal = ema(macdLine, 9);
  const macd = ema(values, 12) - ema(values, 26);
  return macd - signal;
}

type Bias = "Bullish" | "Neutral" | "Bearish";

type RiskTolerance = "low" | "medium" | "high";
type Horizon = "day" | "swing" | "invest";

type Position = { ticker: string; quantity: number; costBasis?: number };

function biasLabelZh(b: Bias): string {
  if (b === "Bullish") return "偏多";
  if (b === "Bearish") return "偏空";
  return "中性";
}

function riskLabelZh(r: RiskTolerance): string {
  if (r === "low") return "低";
  if (r === "high") return "高";
  return "中";
}

function horizonLabelZh(h: Horizon): string {
  if (h === "day") return "當沖";
  if (h === "invest") return "投資";
  return "波段";
}

function parsePositionsSpec(spec: string): Position[] {
  const raw = spec.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [lhs, rhsRaw] = part.split(":");
      const rawTicker = (lhs || "").trim();
      if (!rawTicker) return null;
      const rhs = (rhsRaw || "").trim();
      const m = rhs.match(/^(\d+(?:\.\d+)?)(?:@(\d+(?:\.\d+)?))?$/);
      if (!m) return null;
      const quantity = Number(m[1]);
      const costBasis = m[2] != null ? Number(m[2]) : undefined;
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      if (costBasis != null && (!Number.isFinite(costBasis) || costBasis <= 0)) return null;
      return { ticker: normalizeTicker(rawTicker), quantity, costBasis };
    })
    .filter((x): x is Position => Boolean(x));
}

function parseTickerLabelSpec(spec: string): Array<{ ticker: string; label: string }> {
  const raw = (spec || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [a, b] = p.split("=");
      const ticker = normalizeTicker(String(a || "").trim());
      if (!ticker) return null;
      const label = String(b || "").trim();
      return { ticker, label };
    })
    .filter((x): x is { ticker: string; label: string } => Boolean(x));
}

function parseStopPctSpec(spec: string): Map<string, number> {
  const raw = (spec || "").trim();
  const out = new Map<string, number>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const [lhs, rhs] = p.split(":");
    const ticker = normalizeTicker(String(lhs || "").trim());
    const v = Number(String(rhs || "").trim());
    if (!ticker || !Number.isFinite(v) || v <= 0 || v >= 1) continue;
    out.set(ticker, v);
  }
  return out;
}

function parseStringMapSpec(spec: string): Map<string, string> {
  const raw = (spec || "").trim();
  const out = new Map<string, string>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const [lhs, rhs] = p.split(":");
    const ticker = normalizeTicker(String(lhs || "").trim());
    const v = String(rhs || "").trim();
    if (!ticker || !v) continue;
    out.set(ticker, v);
  }
  return out;
}

function avgLast(values: number[], window: number): number | null {
  if (window <= 0) return null;
  if (!Array.isArray(values) || values.length < window) return null;
  const slice = values.slice(values.length - window);
  const good = slice.filter((x) => Number.isFinite(x));
  if (good.length < window) return null;
  const sum = good.reduce((a, b) => a + b, 0);
  return sum / window;
}

function fmtNumber(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return n.toFixed(digits);
}

function defaultTickersFromEnv(env: Env): string[] {
  const spec = ((env.PORTFOLIO_POSITIONS || "").trim() || (env.PORTFOLIO || "").trim()).trim();
  if (!spec) return [];
  if (spec.includes(":")) return parsePositionsSpec(spec).map((p) => p.ticker).filter(Boolean);
  return spec
    .split(",")
    .map((s) => normalizeTicker(s))
    .filter(Boolean);
}

function watchlistKey(chatId: number) {
  return new Request(`https://state.local/watchlist/${chatId}`);
}

async function getWatchlist(chatId: number): Promise<string[] | null> {
  const res = await caches.default.match(watchlistKey(chatId));
  if (!res) return null;
  try {
    const json = await res.json<any>();
    const tickers = Array.isArray(json?.tickers) ? json.tickers : [];
    const out = tickers.map((s: any) => normalizeTicker(String(s || ""))).filter(Boolean);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function setWatchlist(chatId: number, tickers: string[]): Promise<void> {
  const uniq = Array.from(new Set(tickers.map((t) => normalizeTicker(t)).filter(Boolean))).slice(0, 40);
  await caches.default.put(
    watchlistKey(chatId),
    new Response(JSON.stringify({ tickers: uniq }), {
      headers: { "content-type": "application/json", "cache-control": "max-age=31536000" },
    }),
  );
}

async function clearWatchlist(chatId: number): Promise<void> {
  await caches.default.delete(watchlistKey(chatId));
}

function normalizeRisk(raw: string | undefined): RiskTolerance {
  const v = (raw || "").trim().toLowerCase();
  if (v === "low" || v === "l") return "low";
  if (v === "high" || v === "h") return "high";
  return "medium";
}

function normalizeHorizon(raw: string | undefined): Horizon {
  const v = (raw || "").trim().toLowerCase();
  if (v === "day" || v === "d" || v === "intraday") return "day";
  if (v === "invest" || v === "i" || v === "long") return "invest";
  return "swing";
}

function getProfile(env: Env): { risk: RiskTolerance; horizon: Horizon } {
  return { risk: normalizeRisk(env.RISK), horizon: normalizeHorizon(env.HORIZON) };
}

function formatFooter(profile: { risk: RiskTolerance; horizon: Horizon }, asOfUnix: number): string {
  const asOfIso = asOfUnix ? new Date(asOfUnix * 1000).toISOString() : "-";
  const generatedIso = new Date().toISOString();
  return [
    "資料: Yahoo Finance chart v8",
    "日線: 1d/1y",
    `資料時間: ${asOfIso}`,
    `產生時間: ${generatedIso}`,
    `偏好: 風險=${riskLabelZh(profile.risk)} 週期=${horizonLabelZh(profile.horizon)}`,
  ].join(" | ");
}

function computeBias(
  price: number,
  d20: number,
  d200: number,
  hist: number,
  rsi: number,
  profile: { risk: RiskTolerance; horizon: Horizon },
): { bias: Bias; confidence: number } {
  const above20 = price > d20;
  const above200 = price > d200;
  const macdBull = hist > 0;
  const macdBear = hist < 0;

  const horizonWeights =
    profile.horizon === "day"
      ? { above20: 15, above200: 5, macd: 15, rsi: 5 }
      : profile.horizon === "invest"
        ? { above20: 5, above200: 20, macd: 5, rsi: 5 }
        : { above20: 10, above200: 10, macd: 10, rsi: 10 };

  let confidence = 50;
  if (above20) confidence += horizonWeights.above20;
  else confidence -= horizonWeights.above20;
  if (above200) confidence += horizonWeights.above200;
  else confidence -= horizonWeights.above200;
  if (macdBull) confidence += horizonWeights.macd;
  if (macdBear) confidence -= horizonWeights.macd;
  if (rsi >= 40 && rsi <= 70) confidence += horizonWeights.rsi;
  if (rsi < 30 || rsi > 70) confidence -= horizonWeights.rsi;
  if (profile.risk === "low") confidence -= 10;
  if (profile.risk === "high") confidence += 5;
  confidence = Math.max(0, Math.min(100, confidence));

  const bullish =
    profile.risk === "low"
      ? above200 && above20 && macdBull && rsi >= 45 && rsi <= 70
      : profile.risk === "high"
        ? above20 && macdBull && rsi >= 35
        : above20 && above200 && macdBull;

  const bearish =
    profile.risk === "low"
      ? !above200 && !above20 && macdBear && rsi <= 55
      : profile.risk === "high"
        ? !above20 && macdBear
        : !above20 && !above200 && macdBear;

  if (bullish) return { bias: "Bullish", confidence };
  if (bearish) return { bias: "Bearish", confidence };
  return { bias: "Neutral", confidence };
}

function pivotsFromPreviousDay(highs: number[], lows: number[], closes: number[]): { p: number; r1: number; s1: number } {
  if (highs.length < 2 || lows.length < 2 || closes.length < 2) return { p: 0, r1: 0, s1: 0 };
  const h = highs[highs.length - 2] || 0;
  const l = lows[lows.length - 2] || 0;
  const c = closes[closes.length - 2] || 0;
  const p = (h + l + c) / 3;
  const r1 = 2 * p - l;
  const s1 = 2 * p - h;
  return { p, r1, s1 };
}

function obvTrend(closes: number[], volumes: number[]): string {
  const n = Math.min(closes.length, volumes.length);
  if (n < 3) return "Neutral";
  let obv = 0;
  const series: number[] = [0];
  for (let i = 1; i < n; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i] || 0;
    else if (closes[i] < closes[i - 1]) obv -= volumes[i] || 0;
    series.push(obv);
  }
  const lookback = Math.min(20, series.length - 1);
  const delta = series[series.length - 1] - series[series.length - 1 - lookback];
  if (delta > 0) return "Accumulation";
  if (delta < 0) return "Distribution";
  return "Neutral";
}

function computeInvalidation(bias: Bias, d20: number, r1: number, s1: number): number {
  if (bias === "Bullish") return Math.min(d20 || Infinity, s1 || Infinity);
  if (bias === "Bearish") return Math.max(d20 || -Infinity, r1 || -Infinity);
  return d20;
}

function formatBrief(symbol: string, data: ChartData, profile: { risk: RiskTolerance; horizon: Horizon }): string {
  const price = data.closes[data.closes.length - 1] || 0;
  const d20 = sma(data.closes, 20);
  const d200 = sma(data.closes, 200);
  const rsi = rsi14(data.closes);
  const atr = atr14(data.highs, data.lows, data.closes);
  const hist = macdHistogram(data.closes);
  const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
  const { r1, s1 } = pivotsFromPreviousDay(data.highs, data.lows, data.closes);
  const invalidation = computeInvalidation(bias, d20, r1, s1);
  const ytd = ytdPct(data.timestamps, data.closes);

  const lines = [
    `交易簡報: ${symbol}`,
    `趨勢偏向: ${biasLabelZh(bias)} | 信心度: ${confidence}%`,
    `現價: ${price.toFixed(2)} ${data.currency} | RSI(14): ${rsi.toFixed(1)} | MACD(H): ${hist.toFixed(2)}${ytd != null ? ` | YTD ${fmtPct(ytd)}` : ""}`,
    `日線20MA: ${d20.toFixed(2)} | 日線200MA: ${d200.toFixed(2)}`,
    `ATR(14): ${atr.toFixed(2)} | 失效點(Inval): ${invalidation.toFixed(2)}`,
  ];
  return lines.join("\n");
}

function formatFull(symbol: string, data: ChartData, profile: { risk: RiskTolerance; horizon: Horizon }): string {
  const price = data.closes[data.closes.length - 1] || 0;
  const d20 = sma(data.closes, 20);
  const d50 = sma(data.closes, 50);
  const d200 = sma(data.closes, 200);
  const dBBLower = bollingerLower(data.closes, 20, 2);
  const rsi = rsi14(data.closes);
  const atr = atr14(data.highs, data.lows, data.closes);
  const hist = macdHistogram(data.closes);
  const { p, r1, s1 } = pivotsFromPreviousDay(data.highs, data.lows, data.closes);
  const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
  const invalidation = computeInvalidation(bias, d20, r1, s1);

  const distToSupport = Math.abs(price - s1);
  const rrRatio = atr / (distToSupport || 1);
  const obv = obvTrend(data.closes, data.volumes);

  const prev = pickBack(data.closes, 1);
  const back5 = pickBack(data.closes, 5);
  const back21 = pickBack(data.closes, 21);
  const change1d = computePctChange(price, prev);
  const change5d = computePctChange(price, back5);
  const change1m = computePctChange(price, back21);
  const ytd = ytdPct(data.timestamps, data.closes);

  const above20 = price > d20;
  const above200 = price > d200;
  const macdBull = hist > 0;

  const rsiState =
    rsi >= 70 ? "Overbought" : rsi >= 60 ? "Near-overbought" : rsi <= 30 ? "Oversold" : rsi <= 40 ? "Near-oversold" : "Neutral";
  const atrPct = price > 0 ? (atr / price) * 100 : 0;

  const fmtPct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
  const verdict =
    bias === "Bullish" && confidence >= 70
      ? "偏多（順勢）"
      : bias === "Bearish" && confidence <= 30
        ? "偏空／防守"
        : "等待確認";

  const suggestedAction =
    bias === "Bullish"
      ? profile.risk === "low"
        ? "觀望/持有；站回20MA後再考慮加碼"
        : "持有/逢回加碼；以失效點作停損"
      : bias === "Bearish"
        ? profile.risk === "high"
          ? "避免加碼；可考慮戰術性避險/短打（嚴格停損）"
          : "避免加碼；等待趨勢收復"
        : "持有觀望；等待突破/確認";

  const driverLines = [
    `短線趨勢: ${above20 ? "站上20MA ✅" : "跌破20MA ❌"} | 20MA ${d20.toFixed(2)}`,
    `長線結構: ${above200 ? "站上200MA ✅" : "跌破200MA ❌"} | 200MA ${d200.toFixed(2)}`,
    `動能: MACD(H) ${hist > 0 ? "+" : ""}${hist.toFixed(2)} (${macdBull ? "偏多" : "偏空"})`,
    `資金流: OBV ${obv}`,
    `均值狀態: RSI(14) ${rsi.toFixed(1)} (${rsiState})`,
  ];

  const planLines =
    bias === "Bearish"
      ? [
          "交易計劃（下一步）:",
          `- 防守為主：先看能否收復並站穩20MA（${d20.toFixed(2)}）`,
          `- 下方觀察：S1 ${s1.toFixed(2)}；ATR(14) ${atr.toFixed(2)}（約${atrPct.toFixed(1)}%）`,
          `- 失效點（風控停損參考）: ${invalidation.toFixed(2)} ${data.currency}`,
        ]
      : bias === "Bullish"
        ? [
            "交易計劃（下一步）:",
            `- 優先策略：站上20MA（${d20.toFixed(2)}）後回踩不破再布局`,
            `- 上方觀察：R1 ${r1.toFixed(2)}；1-ATR 目標 ${(price + atr).toFixed(2)}`,
            `- 失效點（風控停損參考）: ${invalidation.toFixed(2)} ${data.currency}`,
          ]
        : [
            "交易計劃（下一步）:",
            `- 中性：等突破站穩20MA（${d20.toFixed(2)}）或回測S1（${s1.toFixed(2)}）止跌`,
            `- 失效點參考: ${invalidation.toFixed(2)} ${data.currency}`,
          ];

  return [
    `交易簡報: ${symbol}`,
    `趨勢偏向: ${biasLabelZh(bias)} | 信心度: ${confidence}% | 結論: ${verdict}`,
    `現價: ${price.toFixed(2)} ${data.currency} | 1日 ${fmtPct(change1d)} | 5日 ${fmtPct(change5d)} | 1月 ${fmtPct(change1m)}${ytd != null ? ` | YTD ${fmtPct(ytd)}` : ""}`,
    `失效點(Inval): ${invalidation.toFixed(2)} ${data.currency} | ATR(14): ${atr.toFixed(2)}（${atrPct.toFixed(1)}%） | R/R: ${rrRatio.toFixed(2)}x`,
    `建議: ${suggestedAction}`,
    "",
    "訊號驅動（為何如此判斷）",
    ...driverLines.map((l) => `- ${l}`),
    "",
    ...planLines,
    "",
    "關鍵價位",
    "",
    `上方壓力`,
    `  - 樞軸 R1:   ${r1.toFixed(2)}`,
    `  - 日線 20MA: ${d20.toFixed(2)}`,
    `  - 日線 50MA: ${d50.toFixed(2)}`,
    "",
    `下方支撐`,
    `  - 布林下軌(BB20,2): ${dBBLower.toFixed(2)}`,
    `  - 樞軸 S1:           ${s1.toFixed(2)}`,
    `  - 日線 200MA:        ${d200.toFixed(2)}`,
    "",
    `GOLDMAN SACHS 證券分析: ${symbol}`,
    `================================================`,
    `現價: ${price.toFixed(2)} ${data.currency} | RSI(14): ${rsi.toFixed(1)}（${rsiState}）`,
    `趨勢信心: ${confidence}% | 偏好: 風險=${riskLabelZh(profile.risk)} 週期=${horizonLabelZh(profile.horizon)}`,
    "",
    `動能 (MACD)`,
    `  - 柱狀圖: ${hist > 0 ? "+" : ""}${hist.toFixed(2)}（${hist > 0 ? "偏多" : "偏空"}）`,
    "",
    `波動推演 (1-ATR)`,
    `  - 上方目標: ${(price + atr).toFixed(2)} ${data.currency}`,
    `  - 下方支撐: ${(price - atr).toFixed(2)} ${data.currency}`,
    "",
    `機構風險報告: ${symbol}`,
    `================================================`,
    `現價: ${price.toFixed(2)} ${data.currency} | RSI: ${rsi.toFixed(1)}（${rsiState}） | ATR%: ${atrPct.toFixed(1)}%`,
    "",
    `資金流 (OBV)`,
    `  - 狀態: ${obv}`,
    "",
    `樞軸位 (Floor Pivot)`,
    `  - 壓力 (R1): ${r1.toFixed(2)}`,
    `  - 樞軸 (P):  ${p.toFixed(2)}`,
    `  - 支撐 (S1): ${s1.toFixed(2)}`,
    "",
    `風險報酬模型`,
    `  - R/R: ${rrRatio.toFixed(2)}x ${rrRatio > 2 ? "具吸引力" : "不理想"}`,
    "",
    `長短線結構`,
    `  - 日線 200MA: ${d200.toFixed(2)}（${price > d200 ? "多頭區" : "空頭區"}）`,
    `  - 日線 20MA:  ${d20.toFixed(2)}（${price > d20 ? "短線轉強" : "短線偏弱"}）`,
    `================================================`,
  ].join("\n");
}

async function handle(chatId: number, text: string, env: Env): Promise<string> {
  const profile = getProfile(env);
  const decoded = decodeCallbackData(text);
  const { cmd, arg } = parseCommand(decoded);
  if (cmd === "start" || cmd === "help") {
    return [
      "指令（Commands）:",
      "- 直接輸入 `NVDA`（預設回覆：完整報告、無新聞）",
      "- `/full NVDA`（完整）",
      "- `/summary NVDA`（重點）",
      "- `/watch NVDA,AAPL,TSLA`（觀察清單掃描）",
      "- `/watch NVDA,AAPL,TSLA --valuation`（<=5 檔時顯示估值）",
      "- `/heatmap NVDA,AAPL,TSLA`（熱力圖）",
      "- `/setwatch TSM,TCOM,NVDA,0700.HK`（設定「我的觀察」清單）",
      "- `/setwatch`（用 PORTFOLIO / PORTFOLIO_POSITIONS 覆蓋「我的觀察」）",
      "- `/watchme`（一鍵觀察：使用「我的觀察」，沒有就用 PORTFOLIO）",
      "- `/heatmapme`（一鍵熱力圖：使用「我的觀察」，沒有就用 PORTFOLIO）",
      "- `/clearwatch`（清除「我的觀察」）",
      "- `/halo`（HALO 監控：VIX 制度 + S7/T12 + 停損；`--all` 更多 near-miss；`--table` 顯示全表）",
      "- `/calendar`（未來重大事件行事曆）",
      "- `/morning`（早晨簡報）",
      "- `/macro`（宏觀儀表板）",
      "- `/action`（今日操作建議）",
      "- `/marksix`（預設 30 期）",
      "- `/marksix 60`",
      "- `/portfolio NVDA,AAPL,0700.HK`（臨時投資組合）",
      "- `/portfolio NVDA:15@167.52,0700.HK:100@493.4`（含數量/成本）",
      "- `/portfolio`（使用 Worker env：PORTFOLIO_POSITIONS 或 PORTFOLIO）",
      "- `/whoami`（取得你的 Chat ID，用於白名單）",
      "",
      "快捷選單：直接回覆 1/2/3/4/5/6/7/8/9 也可以",
      "一鍵功能：🔎 一鍵觀察(自選)、📋 一鍵熱力圖(自選) 會使用 PORTFOLIO / PORTFOLIO_POSITIONS",
      "",
      "偏好設定（env vars）: RISK=low|medium|high, HORIZON=day|swing|invest",
      "投資組合（env vars）: PORTFOLIO_POSITIONS=NVDA:15@167.52,0700.HK:100@493.4 或 PORTFOLIO=NVDA,AAPL,0700.HK",
      "操作單位（env vars）: POSITION_UNIT_USD=250, POSITION_UNIT_HKD=2000",
      "操作限制（env vars）: MAX_DAILY_ADDS=2, MAX_DAILY_TRIMS=2, MAX_PER_TICKER_U=1",
      "行事曆（env vars）: ECON_CALENDAR=多行(YYYY-MM-DD HH:mm Event), CALENDAR_TZ=America/New_York",
      "HALO（env vars）: HALO_CORE / HALO_WATCHLIST / HALO_STOP_PCTS / HALO_EMA_WINDOW / HALO_VOLUME_WINDOW / HALO_VOLUME_SURGE / HALO_VIX_AMBER / HALO_VIX_RED / HALO_MILKSHAKE_RISK / HALO_OBSOLESCENCE",
    ].join("\n");
  }

  if (cmd === "whoami") {
    return `你的 Chat ID: ${chatId}\n請把這串數字傳給 bot 管理員，讓他把你加入 TELEGRAM_ALLOWED_CHAT_IDS 白名單。`;
  }

  if (cmd === "setwatch") {
    const fromEnv = defaultTickersFromEnv(env);
    const tickers = arg ? arg.split(",").map((s) => normalizeTicker(s)).filter(Boolean) : fromEnv;
    if (tickers.length === 0) {
      return "尚未提供清單。\n用法：/setwatch TSM,TCOM,NVDA,0700.HK\n或先設定 PORTFOLIO / PORTFOLIO_POSITIONS，再輸入 /setwatch";
    }
    await setWatchlist(chatId, tickers);
    const saved = (await getWatchlist(chatId)) || [];
    return `✅ 已設定「我的觀察」清單（${saved.length} 檔）:\n${saved.join(", ")}\n\n你可以直接點 👤 我的觀察 / 👤 我的熱力圖。`;
  }

  if (cmd === "clearwatch") {
    await clearWatchlist(chatId);
    return "✅ 已清除「我的觀察」清單。";
  }

  if (cmd === "watchme" || cmd === "heatmapme") {
    const mine = await getWatchlist(chatId);
    const tickers = (mine && mine.length ? mine : defaultTickersFromEnv(env)).slice(0, 20);
    if (tickers.length === 0) {
      return "尚未設定清單。\n請用 /setwatch 設定「我的觀察」，或在 Worker env 設定 PORTFOLIO / PORTFOLIO_POSITIONS。";
    }
    const inner = cmd === "watchme" ? `/watch ${tickers.join(",")}` : `/heatmap ${tickers.join(",")}`;
    return await handle(chatId, inner, env);
  }

  if (cmd === "halo") {
    const raw = ((arg || "").trim() || (env.PORTFOLIO_POSITIONS || "").trim()).trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const showAll = tokens.includes("--all");
    const showTable = tokens.includes("--table");
    const spec = tokens.filter((t) => !t.startsWith("--")).join(" ").trim();
    const positions = spec.includes(":") ? parsePositionsSpec(spec) : [];
    return await formatHaloMonitor(env, positions, { showAll, showTable });
  }

  if (cmd === "calendar") {
    const tz = (env.CALENDAR_TZ || "").trim() || "America/New_York";
    const events = compactCalendarEvents(
      (await fetchCalendarEvents(env, tz)).filter((e) => Number.isFinite(e.utcMs)).sort((a, b) => a.utcMs - b.utcMs),
    );
    const now = Date.now();
    const upcoming = events.filter((e) => e.utcMs >= now - 6 * 60 * 60 * 1000).slice(0, 12);

    const lines: string[] = [];
    lines.push(`🗓️ 行事曆 (Calendar) — ${new Date().toISOString().slice(0, 10)}`);
    lines.push("");
    lines.push(`時區: ${tz}（顯示: ${tz} + HK）`);
    lines.push("");

    if (upcoming.length === 0) {
      lines.push("未來事件: 無");
      lines.push("");
      lines.push("設定方式：");
      lines.push("- Worker env 設定 ECON_CALENDAR_SOURCE=yahoo_viz（抓 Yahoo Finance economic calendar）");
      lines.push("- 或 ECON_CALENDAR_URL（線上純文字）");
      lines.push("- 或 ECON_CALENDAR（多行）");
      lines.push("格式：YYYY-MM-DD HH:mm Event name");
      return lines.join("\n");
    }

    for (const e of upcoming) {
      const t1 = formatInTimeZone(e.utcMs, tz);
      const t2 = formatInTimeZone(e.utcMs, "Asia/Hong_Kong");
      const delta = e.utcMs - now;
      lines.push(`- ${t1} (${t2} HK) | ${formatTMinus(delta)} | ${e.name}`);
    }
    lines.push("");
    lines.push("提示：CPI/FOMC/NFP 前後波動通常較大，建議減少新倉/槓桿，等數據落地再動作。");
    lines.push("");
    lines.push(formatFooter(profile, Math.floor(now / 1000)));
    return lines.join("\n");
  }

  if (cmd === "morning") {
    const morningCtx = await buildMorningContext(profile);
    return [...morningCtx.lines, "", formatFooter(profile, morningCtx.asOfUnix)].join("\n");
  }

  if (cmd === "action") {
    return await formatActionPlan(env, profile);
  }

  if (cmd === "macro") {
    return await formatMacroDashboard(profile);
  }

  if (cmd === "marksix") {
    const rawN = arg ? Number(arg.trim()) : 30;
    const windowSize = Number.isFinite(rawN) ? Math.max(10, Math.min(120, rawN)) : 30;
    return await fetchMarkSixReport(windowSize);
  }

  if (cmd === "portfolio") {
    const spec = (arg || (env.PORTFOLIO_POSITIONS || env.PORTFOLIO || "").trim()).trim();
    if (!spec) {
      return "尚未設定投資組合。\n請輸入：/portfolio NVDA,AAPL,0700.HK\n或含數量成本：/portfolio NVDA:15@167.52,0700.HK:100@493.4\n（或在 Worker env 設定 PORTFOLIO）";
    }

    if (spec.includes(":")) {
      const positions = parsePositionsSpec(spec).slice(0, 25);
      if (positions.length === 0) {
        return "格式錯誤。範例：/portfolio NVDA:15@167.52,0700.HK:100@493.4";
      }

      const rows: Array<{
        ticker: string;
        qty: number;
        cost?: number;
        price: number;
        mv: number;
        ccy: string;
        pnlPct?: number;
        ytdPct?: number;
        bias: Bias;
        conf: number;
        rsi: number;
        inval: number;
        asOfUnix: number;
      }> = [];

      let maxAsOf = 0;
      for (const p of positions) {
        const data = await fetchYahooChart(p.ticker);
        maxAsOf = Math.max(maxAsOf, data.asOfUnix || 0);
        const price = data.closes[data.closes.length - 1] || 0;
        const mv = price * p.quantity;
        const d20 = sma(data.closes, 20);
        const d200 = sma(data.closes, 200);
        const rsi = rsi14(data.closes);
        const hist = macdHistogram(data.closes);
        const { r1, s1 } = pivotsFromPreviousDay(data.highs, data.lows, data.closes);
        const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
        const inval = computeInvalidation(bias, d20, r1, s1);
        const pnlPct =
          p.costBasis != null && p.costBasis > 0 ? ((price - p.costBasis) / p.costBasis) * 100 : undefined;
        const ytd = ytdPct(data.timestamps, data.closes);
        rows.push({
          ticker: p.ticker,
          qty: p.quantity,
          cost: p.costBasis,
          price,
          mv,
          ccy: data.currency,
          pnlPct,
          ytdPct: ytd ?? undefined,
          bias,
          conf: confidence,
          rsi,
          inval,
          asOfUnix: data.asOfUnix,
        });
      }

      const totalsByCcy = new Map<string, number>();
      for (const r of rows) totalsByCcy.set(r.ccy, (totalsByCcy.get(r.ccy) || 0) + r.mv);

      const fmtPct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
      const lines: string[] = [];
      lines.push("📌 投資組合摘要（含持倉/成本）");
      lines.push("");
      lines.push("🧾 PORTFOLIO SUMMARY（按幣別，不換匯）");
      for (const [ccy, mv] of Array.from(totalsByCcy.entries()).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${ccy}: ${mv.toFixed(2)}`);
      }
      lines.push("");
      lines.push("📋 PORTFOLIO POSITIONS");

      const rowsByCcy = new Map<string, typeof rows>();
      for (const r of rows) {
        const arr = rowsByCcy.get(r.ccy) || [];
        arr.push(r);
        rowsByCcy.set(r.ccy, arr);
      }

      for (const ccy of Array.from(rowsByCcy.keys()).sort((a, b) => a.localeCompare(b))) {
        const group = (rowsByCcy.get(ccy) || []).sort((a, b) => b.mv - a.mv);
        const totalMv = totalsByCcy.get(ccy) || 1;
        lines.push("");
        lines.push(`幣別: ${ccy}`);
        lines.push("Ticker | Qty | Cost | Price | MV | Weight | PnL% | YTD | Bias | Conf | RSI | Inval");
        for (const r of group) {
          const w = (r.mv / totalMv) * 100;
          const cost = r.cost != null ? r.cost.toFixed(2) : "-";
          const pnl = r.pnlPct != null ? fmtPct(r.pnlPct) : "-";
          const ytd = r.ytdPct != null ? fmtPct(r.ytdPct) : "-";
          lines.push(
            `${r.ticker} | ${r.qty} | ${cost} | ${r.price.toFixed(2)} | ${r.mv.toFixed(2)} | ${w.toFixed(1)}% | ${pnl} | ${ytd} | ${biasLabelZh(r.bias)} | ${r.conf}% | ${r.rsi.toFixed(1)} | ${r.inval.toFixed(2)}`,
          );
        }
      }

      lines.push("");
      lines.push(formatFooter(profile, maxAsOf));
      return lines.join("\n");
    }

    const tickers = spec.split(",").map((s) => normalizeTicker(s)).filter(Boolean);
    const briefs: string[] = [];
    let maxAsOf = 0;
    for (const t of tickers.slice(0, 12)) {
      const data = await fetchYahooChart(t);
      maxAsOf = Math.max(maxAsOf, data.asOfUnix || 0);
      briefs.push(formatBrief(t, data, profile));
      briefs.push("");
    }
    briefs.push(formatFooter(profile, maxAsOf));
    return briefs.join("\n");
  }

  if (cmd === "watch") {
    if (!arg) return "用法: /watch NVDA,AAPL,TSLA";
    const wantVal = /\s--valuation\b|\s--val\b/.test(` ${arg} `);
    const cleaned = arg.replace(/\s--valuation\b/g, "").replace(/\s--val\b/g, "").trim();
    const tickers = cleaned.split(",").map((s) => normalizeTicker(s)).filter(Boolean).slice(0, 20);
    const rows: Array<{ t: string; bias: Bias; conf: number; price: number; rsi: number; pe?: number | null; fpe?: number | null; ey?: number | null }> = [];
    let maxAsOf = 0;
    const year = new Date().getUTCFullYear();
    const yc = wantVal ? ((await fetchTreasuryYieldCurveLastTwo(year)) || (await fetchTreasuryYieldCurveLastTwo(year - 1))) : null;
    const us10y = yc ? yc.latest.y10 : null;
    for (const t of tickers) {
      const data = await fetchYahooChart(t);
      maxAsOf = Math.max(maxAsOf, data.asOfUnix || 0);
      const price = data.closes[data.closes.length - 1] || 0;
      const d20 = sma(data.closes, 20);
      const d200 = sma(data.closes, 200);
      const rsi = rsi14(data.closes);
      const hist = macdHistogram(data.closes);
      const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
      let pe: number | null | undefined;
      let fpe: number | null | undefined;
      let ey: number | null | undefined;
      if (wantVal && tickers.length <= 5) {
        const f = await fetchYahooQuoteSummary(t);
        const peCalc = f.epsTrailing12Months != null && f.epsTrailing12Months > 0 ? price / f.epsTrailing12Months : null;
        const fpeCalc = f.epsForward != null && f.epsForward > 0 ? price / f.epsForward : null;
        pe = f.trailingPE ?? peCalc;
        fpe = f.forwardPE ?? fpeCalc;
        const usedForward = fpe != null && fpe > 0;
        ey = usedForward ? (100 / (fpe as number)) : pe != null && pe > 0 ? (100 / pe) : null;
      }
      rows.push({ t, bias, conf: confidence, price, rsi, pe, fpe, ey });
    }
    rows.sort((a, b) => b.conf - a.conf);
    const lines = ["觀察清單（按信心度排序）:"];
    for (const r of rows) {
      const val =
        wantVal && tickers.length <= 5
          ? ` | PE ${r.pe != null ? r.pe.toFixed(1) : "N/A"} | FPE ${r.fpe != null ? r.fpe.toFixed(1) : "N/A"} | EY ${r.ey != null ? r.ey.toFixed(2) + "%" : "N/A"}${us10y != null && r.ey != null ? ` | Spread ${(r.ey - us10y).toFixed(2)}%` : ""}`
          : "";
      lines.push(`${r.t}: ${biasLabelZh(r.bias)} ${r.conf}% | ${r.price.toFixed(2)} | RSI ${r.rsi.toFixed(1)}${val}`);
    }
    lines.push("");
    lines.push(formatFooter(profile, maxAsOf));
    return lines.join("\n");
  }

  if (cmd === "heatmap") {
    const raw = (arg || (env.PORTFOLIO || "").trim()).trim();
    if (!raw) return "用法: /heatmap NVDA,AAPL,TSLA（或設定 PORTFOLIO env）";
    const tickers = raw.split(",").map((s) => normalizeTicker(s)).filter(Boolean).slice(0, 30);
    const rows: Array<{
      t: string;
      sector: string;
      price: number;
      ccy: string;
      c1: number;
      c5: number;
      cM: number;
      bias: Bias;
      conf: number;
      asOfUnix: number;
    }> = [];
    let maxAsOf = 0;
    for (const t of tickers) {
      const data = await fetchYahooChart(t);
      maxAsOf = Math.max(maxAsOf, data.asOfUnix || 0);
      const price = data.closes[data.closes.length - 1] || 0;
      const prev = pickBack(data.closes, 1);
      const back5 = pickBack(data.closes, 5);
      const back21 = pickBack(data.closes, 21);
      const c1 = computePctChange(price, prev);
      const c5 = computePctChange(price, back5);
      const cM = computePctChange(price, back21);
      const d20 = sma(data.closes, 20);
      const d200 = sma(data.closes, 200);
      const rsi = rsi14(data.closes);
      const hist = macdHistogram(data.closes);
      const { bias, confidence } = computeBias(price, d20, d200, hist, rsi, profile);
      rows.push({ t, sector: getSector(t), price, ccy: data.currency, c1, c5, cM, bias, conf: confidence, asOfUnix: data.asOfUnix });
    }

    const bySector = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.sector || "Other";
      const arr = bySector.get(key) || [];
      arr.push(r);
      bySector.set(key, arr);
    }
    const sectors = Array.from(bySector.keys()).sort((a, b) => a.localeCompare(b));
    const lines = ["股票熱力圖（按產業分組）— 1日/5日/1月 + 趨勢強度", ""];
    for (const s of sectors) {
      lines.push(`🏷️ ${s}`);
      const group = (bySector.get(s) || []).sort((a, b) => b.conf - a.conf);
      for (const r of group) {
        const block = heatColor(r.bias, r.conf, r.c1);
        const c1s = `${r.c1 >= 0 ? "+" : ""}${r.c1.toFixed(2)}%`;
        const c5s = `${r.c5 >= 0 ? "+" : ""}${r.c5.toFixed(2)}%`;
        const cMs = `${r.cM >= 0 ? "+" : ""}${r.cM.toFixed(2)}%`;
        lines.push(`${block} ${r.t}  ${c1s}（5日 ${c5s}，1月 ${cMs}）  ${biasLabelZh(r.bias)} ${r.conf}%  ${r.price.toFixed(2)} ${r.ccy}`);
      }
      lines.push("");
    }
    lines.push(formatFooter(profile, maxAsOf));
    return lines.join("\n");
  }

  const target = cmd === "full" || cmd === "summary" ? arg : arg;
  if (!target) return "Send a ticker like NVDA, or /help";
  const ticker = normalizeTicker(target);
  const data = await fetchYahooChart(ticker);
  let body = cmd === "summary" ? formatBrief(ticker, data, profile) : formatFull(ticker, data, profile);

  if (cmd === "full") {
    try {
      const f = await fetchYahooQuoteSummary(ticker);
      const year = new Date().getUTCFullYear();
      const yc = (await fetchTreasuryYieldCurveLastTwo(year)) || (await fetchTreasuryYieldCurveLastTwo(year - 1));
      const us10y = yc ? yc.latest.y10 : null;
      const lastPrice = data.closes[data.closes.length - 1] || 0;
      const peCalc = f.epsTrailing12Months != null && f.epsTrailing12Months > 0 ? lastPrice / f.epsTrailing12Months : null;
      const fpeCalc = f.epsForward != null && f.epsForward > 0 ? lastPrice / f.epsForward : null;
      const pe = f.trailingPE ?? peCalc;
      const fpe = f.forwardPE ?? fpeCalc;
      const usedForward = fpe != null && fpe > 0;
      const ey = usedForward ? (100 / (fpe as number)) : pe != null && pe > 0 ? (100 / pe) : null;
      const spread = ey != null && us10y != null ? ey - us10y : null;
      const growthPct = f.growthPct != null && Number.isFinite(f.growthPct) ? f.growthPct : null;
      const peg = growthPct != null && growthPct > 0 && fpe != null && fpe > 0 ? fpe / growthPct : null;
      const fairPE =
        growthPct != null && Number.isFinite(growthPct) ? Math.max(8, Math.min(30, growthPct * 0.4)) : null;
      const epsForFair = f.epsForward != null && f.epsForward > 0 ? f.epsForward : f.epsTrailing12Months;
      const fairPrice = fairPE != null && epsForFair != null && epsForFair > 0 ? fairPE * epsForFair : null;
      const gapPct = fairPrice != null && fairPrice > 0 ? ((lastPrice - fairPrice) / fairPrice) * 100 : null;
      const lines: string[] = [];
      lines.push("");
      lines.push("估值 (Valuation)");
      lines.push(`- Source: PE=${f.sources?.pe || "N/A"} | FPE=${f.sources?.fpe || "N/A"} | Growth=${f.sources?.growth || "N/A"}`);
      const isFallback = [f.sources?.pe, f.sources?.fpe, f.sources?.growth]
        .filter(Boolean)
        .some((s) => !String(s).startsWith("Yahoo"));
      const missingCore = pe == null && fpe == null && growthPct == null;
      if (missingCore) {
        lines.push("- 注意: 估值資料缺失，上游資料源可能被擋或暫時不可用（已嘗試 fallback）。");
      } else if (isFallback) {
        lines.push("- 注意: 估值使用 fallback 資料源（可能與券商/一致預期略有差異）。");
      }
      lines.push(`- EPS (TTM): ${f.epsTrailing12Months != null ? f.epsTrailing12Months.toFixed(2) : "N/A"} | EPS (Fwd): ${f.epsForward != null ? f.epsForward.toFixed(2) : "N/A"}`);
      lines.push(`- P/E (TTM): ${pe != null ? pe.toFixed(2) : "N/A"}${f.trailingPE == null && peCalc != null ? " (calc)" : ""}`);
      lines.push(`- Forward P/E: ${fpe != null ? fpe.toFixed(2) : "N/A"}${f.forwardPE == null && fpeCalc != null ? " (calc)" : ""}`);
      if (growthPct != null) lines.push(`- Growth (YoY): ${growthPct.toFixed(1)}%`);
      if (peg != null) lines.push(`- PEG (Fwd): ${peg.toFixed(2)}`);
      if (fairPE != null) lines.push(`- Fair P/E (heuristic): ${fairPE.toFixed(1)}`);
      if (fairPrice != null && gapPct != null) {
        lines.push(`- Fair Price (heuristic): ${fairPrice.toFixed(2)} | Gap: ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}%`);
      }
      if (ey != null) {
        lines.push(`- Earnings Yield (${usedForward ? "Fwd" : "TTM"}): ${ey.toFixed(2)}%${us10y != null ? ` | US 10Y: ${us10y.toFixed(2)}% | Spread: ${spread!.toFixed(2)}%` : ""}`);
      } else if (us10y != null) {
        lines.push(`- US 10Y: ${us10y.toFixed(2)}%`);
      }
      body = body + "\n" + lines.join("\n");
    } catch {
      // ignore valuation errors
    }
  }

  return body + "\n\n" + formatFooter(profile, data.asOfUnix);
}


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") {
      const token = getToken(env);
      const secret = (env.WEBHOOK_SECRET || "").trim();
      const allowed = parseAllowedChatIds(env);
      const payload = {
        ok: true,
        hasTelegramToken: Boolean(token),
        hasWebhookSecret: Boolean(secret),
        allowedChatIdsConfigured: allowed.length > 0,
        allowedChatIdsCount: allowed.length,
        calendar: {
          source: (env.ECON_CALENDAR_SOURCE || "").trim() || "inline",
          tz: (env.CALENDAR_TZ || "").trim() || "America/New_York",
          days: (env.ECON_CALENDAR_DAYS || "").trim() || "7",
          mode: (env.ECON_CALENDAR_YAHOO_MODE || "").trim() || "important",
        },
      };
      return new Response(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
    }

    if (path === "/yahoo-auth-debug") {
      const secret = (env.WEBHOOK_SECRET || "").trim();
      const key = (url.searchParams.get("key") || "").trim();
      if (secret && key !== secret) return new Response("Not found", { status: 404 });
      try {
        const res = await fetch("https://fc.yahoo.com", {
          headers: { "user-agent": "Mozilla/5.0", accept: "text/html,*/*;q=0.9" },
          redirect: "follow",
        });
        const setCookies: string[] =
          typeof (res.headers as any).getSetCookie === "function"
            ? (res.headers as any).getSetCookie()
            : (res.headers.get("set-cookie") ? [String(res.headers.get("set-cookie"))] : []);
        const parsed = setCookies.map(parseFirstCookie).filter(Boolean) as Array<{ name: string; value: string }>;
        const cookie = parsed.length > 0 ? `${parsed[0].name}=${parsed[0].value}` : "";
        const crumbRes = cookie
          ? await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { "user-agent": "Mozilla/5.0", cookie } })
          : null;
        const crumbText = crumbRes ? (await crumbRes.text()).trim() : "";
        const payload = {
          ok: true,
          fcStatus: res.status,
          hasSetCookie: setCookies.length > 0,
          cookieNames: parsed.map((c) => c.name),
          a1orA3Present: parsed.some((c) => c.name === "A1" || c.name === "A3"),
          crumbStatus: crumbRes ? crumbRes.status : null,
          hasCrumb: Boolean(crumbText),
          crumbLen: crumbText.length,
        };
        return new Response(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2), {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        });
      }
    }

    if (path === "/yahoo-viz-debug") {
      const secret = (env.WEBHOOK_SECRET || "").trim();
      const key = (url.searchParams.get("key") || "").trim();
      if (secret && key !== secret) return new Response("Not found", { status: 404 });
      const tz = (url.searchParams.get("tz") || (env.CALENDAR_TZ || "").trim() || "America/New_York").trim() || "America/New_York";
      const dayIso = (url.searchParams.get("day") || formatInTimeZone(Date.now(), tz).slice(0, 10)).trim();
      const mode = (url.searchParams.get("mode") || (env.ECON_CALENDAR_YAHOO_MODE || "").trim() || "important").trim().toLowerCase() === "all" ? "all" : "important";
      const ttl = clampInt(Number((env.ECON_CALENDAR_CACHE_TTL || "").trim()) || 900, 60, 86400);
      const auth = await fetchYahooAuth(clampInt(Math.floor(ttl * 6), 600, 43200));
      if (!auth) {
        return new Response(JSON.stringify({ ok: false, error: "no_auth" }, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      const bounds = dayBoundsWithOffset(dayIso, tz);
      if (!bounds) {
        return new Response(JSON.stringify({ ok: false, error: "bad_day" }, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      const eventsViaFn = await fetchYahooEconomicCalendarViz({
        dayIso,
        mode,
        cacheTtlSec: ttl,
        authTtlSec: clampInt(Math.floor(ttl * 6), 600, 43200),
        timeZone: tz,
      });
      const body = {
        offset: 0,
        size: 25,
        sortField: "startdatetime",
        sortType: "ASC",
        entityIdType: "ECONOMIC_EVENT",
        includeFields: ["econ_release", "country_code", "startdatetime", "period", "after_release_actual", "consensus_estimate", "prior_release_actual", "originally_reported_actual"],
        query: {
          operator: "and",
          operands: [
            { operator: "gte", operands: ["startdatetime", bounds.start] },
            { operator: "lt", operands: ["startdatetime", bounds.end] },
          ],
        },
      };
      const apiUrl = `https://query1.finance.yahoo.com/v1/finance/visualization?lang=en-US&region=US&crumb=${encodeURIComponent(auth.crumb)}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0",
          cookie: auth.cookie,
          "x-crumb": auth.crumb,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}
      const rows = json ? parseVizRows(json) : [];
      const sample = rows.slice(0, 3);
      const usSample = rows.filter((r) => String(r?.country_code || "").trim().toUpperCase() === "US").slice(0, 5);
      const payload = {
        ok: true,
        dayIso,
        tz,
        mode,
        status: res.status,
        bodyLen: text.length,
        hasFinance: Boolean(json?.finance),
        error: json?.finance?.error || null,
        rawHead: text.slice(0, 300),
        sample,
        usSample,
        fnCount: eventsViaFn.length,
        fnSample: eventsViaFn.slice(0, 5),
      };
      return new Response(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
    }

    if (path === "/calendar-debug") {
      const debugEnv: Env = {
        ...env,
        ECON_CALENDAR_SOURCE: url.searchParams.get("source") ?? env.ECON_CALENDAR_SOURCE,
        ECON_CALENDAR_URL: url.searchParams.get("url") ?? env.ECON_CALENDAR_URL,
        ECON_CALENDAR_CACHE_TTL: url.searchParams.get("ttl") ?? env.ECON_CALENDAR_CACHE_TTL,
        ECON_CALENDAR_DAYS: url.searchParams.get("days") ?? env.ECON_CALENDAR_DAYS,
        ECON_CALENDAR_YAHOO_MODE: url.searchParams.get("mode") ?? env.ECON_CALENDAR_YAHOO_MODE,
        CALENDAR_TZ: url.searchParams.get("tz") ?? env.CALENDAR_TZ,
      };
      const tz = (debugEnv.CALENDAR_TZ || "").trim() || "America/New_York";
      const events = (await fetchCalendarEvents(debugEnv, tz)).filter((e) => Number.isFinite(e.utcMs)).sort((a, b) => a.utcMs - b.utcMs);
      const now = Date.now();
      const upcoming = events.filter((e) => e.utcMs >= now - 6 * 60 * 60 * 1000).slice(0, 30);

      const format = (url.searchParams.get("format") || "").trim().toLowerCase();
      if (format === "json") {
        const source = (debugEnv.ECON_CALENDAR_SOURCE || "").trim() || "inline";
        const yahooRaw =
          source.toLowerCase() === "yahoo"
            ? await fetchYahooEconomicCalendar({
                dayIso: formatInTimeZone(Date.now(), tz).slice(0, 10),
                mode: (debugEnv.ECON_CALENDAR_YAHOO_MODE || "").trim().toLowerCase() === "all" ? "all" : "important",
                cacheTtlSec: clampInt(Number((debugEnv.ECON_CALENDAR_CACHE_TTL || "").trim()) || 900, 60, 86400),
              })
            : null;
        return new Response(
          JSON.stringify(
            {
              asOf: new Date(now).toISOString(),
              tz,
              source,
              yahooObservedDayIso: yahooRaw?.observedDayIso ?? null,
              days: debugEnv.ECON_CALENDAR_DAYS,
              mode: debugEnv.ECON_CALENDAR_YAHOO_MODE,
              count: upcoming.length,
              upcoming: upcoming.map((e) => ({
                utcMs: e.utcMs,
                utc: new Date(e.utcMs).toISOString(),
                inTz: formatInTimeZone(e.utcMs, tz),
                inHK: formatInTimeZone(e.utcMs, "Asia/Hong_Kong"),
                name: e.name,
              })),
            },
            null,
            2,
          ),
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      }

      const lines: string[] = [];
      lines.push("calendar-debug");
      lines.push(`asOf: ${new Date(now).toISOString()}`);
      lines.push(`tz: ${tz}`);
      lines.push(`source: ${(debugEnv.ECON_CALENDAR_SOURCE || "").trim() || "inline"}`);
      if (debugEnv.ECON_CALENDAR_SOURCE) {
        if ((debugEnv.ECON_CALENDAR_SOURCE || "").trim().toLowerCase() === "yahoo") {
          lines.push(`days: ${debugEnv.ECON_CALENDAR_DAYS || "7"}`);
          lines.push(`mode: ${(debugEnv.ECON_CALENDAR_YAHOO_MODE || "").trim() || "important"}`);
        }
      }
      lines.push("");
      for (const e of upcoming) {
        const t1 = formatInTimeZone(e.utcMs, tz);
        const t2 = formatInTimeZone(e.utcMs, "Asia/Hong_Kong");
        lines.push(`- ${t1} (${t2} HK) | ${formatTMinus(e.utcMs - now)} | ${e.name}`);
      }
      if (upcoming.length === 0) {
        lines.push("(no upcoming events)");
      }
      lines.push("");
      lines.push("Try:");
      lines.push("- /calendar-debug?format=json");
      lines.push("- /calendar-debug?source=yahoo&days=7&mode=important&tz=America/New_York");
      return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    const token = getToken(env);
    if (!token) return new Response("Missing TELEGRAM_TOKEN", { status: 500 });

    const allowed = parseAllowedChatIds(env);
    const secret = (env.WEBHOOK_SECRET || "").trim();

    const expectedPrefix = secret ? `/telegram/${secret}` : "/telegram";
    if (!path.startsWith(expectedPrefix)) return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    let update: TelegramUpdate;
    try {
      update = await request.json<TelegramUpdate>();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const msg = update.message || update.edited_message;
    const cb = update.callback_query;
    const chatId = cb?.message?.chat?.id || msg?.chat?.id;
    const rawText = cb?.data || msg?.text;
    if (!rawText || !chatId) return new Response("OK", { status: 200 });

    if (cb?.id) {
      ctx.waitUntil(telegramApi(token, "answerCallbackQuery", { callback_query_id: cb.id }));
    }

    const raw = String(rawText).trim();
    const decodedQuick = decodeCallbackData(raw);
    if (decodedQuick === "/whoami") {
      const body = `你的 Chat ID: ${chatId}\n請把這串數字傳給 bot 管理員，讓他把你加入 TELEGRAM_ALLOWED_CHAT_IDS 白名單。`;
      ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
      return new Response("OK", { status: 200 });
    }

    if (!isAllowed(chatId, allowed)) return new Response("OK", { status: 200 });

    if (raw.startsWith("M|")) {
      const sel = raw.slice(2).trim().toUpperCase();
      if (sel === "CANCEL") {
        await setPending(chatId, null);
        ctx.waitUntil(sendMessage(token, chatId, "✅ 已清除等待狀態。", { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "FULL" || sel === "SUMMARY") {
        await setPending(chatId, sel === "FULL" ? "full" : "summary");
        ctx.waitUntil(sendMessage(token, chatId, "請輸入股票代號（例如：NVDA 或 0700.HK）。", { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "WATCHPORT" || sel === "HEATMAPPORT") {
        await setPending(chatId, null);
        const tickers = defaultTickersFromEnv(env).slice(0, 20);
        if (tickers.length === 0) {
          const prompt =
            "尚未設定自選清單。\n請在 Worker env 設定 PORTFOLIO（或 PORTFOLIO_POSITIONS），或用 `/portfolio ...` 先建立清單。";
          ctx.waitUntil(sendMessage(token, chatId, prompt, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        const cmdText = sel === "WATCHPORT" ? `/watch ${tickers.join(",")}` : `/heatmap ${tickers.join(",")}`;
        const body = await handle(chatId, cmdText, env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "WATCHME" || sel === "HEATMAPME") {
        await setPending(chatId, null);
        const mine = await getWatchlist(chatId);
        const tickers = (mine && mine.length ? mine : defaultTickersFromEnv(env)).slice(0, 20);
        if (tickers.length === 0) {
          const prompt =
            "尚未設定「我的觀察」清單。\n請用 /setwatch 設定（例如：/setwatch TSM,TCOM,NVDA,0700.HK），或先在 Worker env 設定 PORTFOLIO。";
          ctx.waitUntil(sendMessage(token, chatId, prompt, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        const cmdText = sel === "WATCHME" ? `/watch ${tickers.join(",")}` : `/heatmap ${tickers.join(",")}`;
        const body = await handle(chatId, cmdText, env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "WATCH" || sel === "HEATMAP") {
        await setPending(chatId, sel === "WATCH" ? "watch" : "heatmap");
        ctx.waitUntil(sendMessage(token, chatId, "請輸入清單（例如：NVDA,AAPL,TSLA）。", { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "PORTFOLIO") {
        const spec = (env.PORTFOLIO_POSITIONS || env.PORTFOLIO || "").trim();
        if (!spec) {
          await setPending(chatId, "portfolio");
          ctx.waitUntil(sendMessage(token, chatId, "尚未設定 PORTFOLIO。請輸入投資組合清單（例如：NVDA,AAPL,0700.HK）。", { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        await setPending(chatId, null);
        const body = await handle(chatId, "/portfolio", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "MARKSIX") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/marksix", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "MACRO") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/macro", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "CALENDAR") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/calendar", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "HALO") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/halo", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "ACTION") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/action", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "WHOAMI") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/whoami", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }

      if (sel === "MORNING") {
        await setPending(chatId, null);
        const body = await handle(chatId, "/morning", env);
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
        return new Response("OK", { status: 200 });
      }
    }

    const pending = await getPending(chatId);
    let text = decodeCallbackData(raw);

    const numeric = text.trim();
    if (!numeric.startsWith("/") && /^[1-9]$/.test(numeric)) {
      const map: Record<string, string> = {
        "1": "M|FULL",
        "2": "M|SUMMARY",
        "3": "M|WATCH",
        "4": "M|HEATMAP",
        "5": "M|PORTFOLIO",
        "6": "M|MARKSIX",
        "7": "M|MACRO",
        "8": "M|ACTION",
        "9": "M|MORNING",
      };
      const cmd = map[numeric];
      if (cmd) {
        const fake = cmd;
        const sel = fake.slice(2).trim().toUpperCase();
        if (sel === "FULL" || sel === "SUMMARY") {
          await setPending(chatId, sel === "FULL" ? "full" : "summary");
          ctx.waitUntil(sendMessage(token, chatId, "請輸入股票代號（例如：NVDA 或 0700.HK）。", { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "WATCH" || sel === "HEATMAP") {
          await setPending(chatId, sel === "WATCH" ? "watch" : "heatmap");
          ctx.waitUntil(sendMessage(token, chatId, "請輸入清單（例如：NVDA,AAPL,TSLA）。", { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "PORTFOLIO") {
          const spec = (env.PORTFOLIO_POSITIONS || env.PORTFOLIO || "").trim();
          if (!spec) {
            await setPending(chatId, "portfolio");
            ctx.waitUntil(sendMessage(token, chatId, "尚未設定 PORTFOLIO。請輸入投資組合清單（例如：NVDA,AAPL,0700.HK）。", { replyMarkup: buildHelpMenu() }));
            return new Response("OK", { status: 200 });
          }
          await setPending(chatId, null);
          const body = await handle(chatId, "/portfolio", env);
          ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "MARKSIX") {
          await setPending(chatId, null);
          const body = await handle(chatId, "/marksix", env);
          ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "MACRO") {
          await setPending(chatId, null);
          const body = await handle(chatId, "/macro", env);
          ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "ACTION") {
          await setPending(chatId, null);
          const body = await handle(chatId, "/action", env);
          ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
        if (sel === "MORNING") {
          await setPending(chatId, null);
          const body = await handle(chatId, "/morning", env);
          ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
          return new Response("OK", { status: 200 });
        }
      }
    }

    if (pending && !text.trim().startsWith("/")) {
      const payload = text.trim();
      if (pending === "full") text = `/full ${payload}`;
      else if (pending === "summary") text = `/summary ${payload}`;
      else if (pending === "watch") text = `/watch ${payload}`;
      else if (pending === "heatmap") text = `/heatmap ${payload}`;
      else if (pending === "portfolio") text = `/portfolio ${payload}`;
      await setPending(chatId, null);
    }

    const cacheKey = new Request(`https://cache.local/${encodeURIComponent(chatId)}/${encodeURIComponent(text.trim())}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      const tickerForButtonsRaw = text.startsWith("/summary ") || text.startsWith("/full ")
        ? text.split(/\s+/)[1] || ""
        : !text.startsWith("/") ? text : "";
      const tickerForButtons = tickerForButtonsRaw.includes(",") ? tickerForButtonsRaw.split(",")[0] : tickerForButtonsRaw;
      const replyMarkup = tickerForButtons ? buildInlineActions(normalizeTicker(tickerForButtons)) : undefined;
      if (text.startsWith("/portfolio")) {
        const preview = body.split("\n").slice(0, 26).join("\n") + "\n\n（完整報告已輸出附件檔）";
        ctx.waitUntil(sendMessage(token, chatId, preview, { replyMarkup: buildHelpMenu() }));
        const filename = `portfolio_${new Date().toISOString().slice(0, 10)}.txt`;
        ctx.waitUntil(sendDocument(token, chatId, { filename, content: body, caption: "Portfolio report" }));
      } else if (text === "/help" || text === "/start") {
        ctx.waitUntil(sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() }));
      } else {
        ctx.waitUntil(sendMessage(token, chatId, body, replyMarkup ? { replyMarkup } : undefined));
      }
      return new Response("OK", { status: 200 });
    }

    if (text === "/portfolio" && !(env.PORTFOLIO_POSITIONS || env.PORTFOLIO || "").trim()) {
      await setPending(chatId, "portfolio");
      const prompt =
        "尚未設定 PORTFOLIO。\n請直接輸入投資組合清單（例如：NVDA,AAPL,0700.HK），或用 `/portfolio NVDA,AAPL,0700.HK`。";
      ctx.waitUntil(sendMessage(token, chatId, prompt, { replyMarkup: buildHelpMenu() }));
      return new Response("OK", { status: 200 });
    }

    let reply = "";
    try {
      reply = await handle(chatId, text, env);
    } catch (e: any) {
      reply = `Error: ${e?.message || String(e)}`;
    }

    reply = escapeText(reply).slice(0, 3900 * 3);
    const tickerForButtonsRaw = text.startsWith("/summary ") || text.startsWith("/full ")
      ? text.split(/\s+/)[1] || ""
      : !text.startsWith("/") ? text : "";
    const tickerForButtons = tickerForButtonsRaw.includes(",") ? tickerForButtonsRaw.split(",")[0] : tickerForButtonsRaw;
    const replyMarkup = tickerForButtons ? buildInlineActions(normalizeTicker(tickerForButtons)) : undefined;
    if (text.startsWith("/portfolio")) {
      const preview = reply.split("\n").slice(0, 26).join("\n") + "\n\n（完整報告已輸出附件檔）";
      ctx.waitUntil(sendMessage(token, chatId, preview, { replyMarkup: buildHelpMenu() }));
      const filename = `portfolio_${new Date().toISOString().slice(0, 10)}.txt`;
      ctx.waitUntil(sendDocument(token, chatId, { filename, content: reply, caption: "Portfolio report" }));
    } else if (text === "/help" || text === "/start") {
      ctx.waitUntil(sendMessage(token, chatId, reply, { replyMarkup: buildHelpMenu() }));
    } else {
      ctx.waitUntil(sendMessage(token, chatId, reply, replyMarkup ? { replyMarkup } : undefined));
    }
    ctx.waitUntil(
      caches.default.put(cacheKey, new Response(reply, { headers: { "cache-control": "max-age=90" } })),
    );

    return new Response("OK", { status: 200 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const token = getToken(env);
    if (!token) return;
    const allowed = parseAllowedChatIds(env);
    if (allowed.length === 0) return;
    const rawCmd = (env.DAILY_CRON_CMD || "").trim();
    const cmd = rawCmd ? (rawCmd.startsWith("/") ? rawCmd : `/${rawCmd}`) : "/morning";

    ctx.waitUntil(
      (async () => {
        for (const chatId of allowed) {
          try {
            const body = await handle(chatId, cmd, env);
            await sendMessage(token, chatId, body, { replyMarkup: buildHelpMenu() });
          } catch {
            // ignore
          }
        }
      })(),
    );
  },
};
