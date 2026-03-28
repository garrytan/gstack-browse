import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { readFile } from "fs/promises";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || "";
const TELEGRAM_ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isFinite(n));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const REPORTS_DIR = join(REPO_ROOT, "reports");

type CacheEntry = { ts: number; outPath: string; brief: string };
const CACHE_TTL_MS = 90_000;
const cache = new Map<string, CacheEntry>();

function isAllowedChat(chatId: number): boolean {
  if (TELEGRAM_ALLOWED_CHAT_IDS.length === 0) return true;
  return TELEGRAM_ALLOWED_CHAT_IDS.includes(chatId);
}

function normalizeTickerAlias(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  const aliases: Record<string, string> = {
    DXY: "DX-Y.NYB",
    SPX: "^GSPC",
    SP500: "^GSPC",
  };
  return aliases[t] || t;
}

function normalizeUserInputToTicker(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  if (t.startsWith("/")) {
    const cmd = t.slice(1).trim();
    if (!cmd) return null;
    const parts = cmd.split(/\s+/);
    const first = parts[0].toLowerCase();
    if (first === "portfolio" || first === "help" || first === "start" || first === "watch" || first === "full" || first === "summary") return null;
    return normalizeTickerAlias(parts[0]);
  }

  if (/^[A-Za-z0-9.^-]{1,15}$/.test(t)) return normalizeTickerAlias(t);
  return null;
}

async function apiCall(method: string, payload: any): Promise<any> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "Telegram API error");
  return json.result;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  const chunkSize = 3800;
  for (let i = 0; i < text.length; i += chunkSize) {
    const part = text.slice(i, i + chunkSize);
    await apiCall("sendMessage", {
      chat_id: chatId,
      text: part,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  }
}

async function sendDocument(chatId: number, filePath: string, caption?: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
  const data = await readFile(filePath);
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) form.set("caption", caption);
  form.set("document", new Blob([data]), filePath.split(/[\\/]/).pop() || "report.txt");
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "Telegram sendDocument error");
}

function runStockCommand(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("bun", ["run", "stock.ts", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, GSTOCK_NO_OPEN: "1" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").toString(),
    stderr: (result.stderr || "").toString(),
  };
}

function escapeMarkdown(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function extractBrief(stdout: string): string {
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  const idx = lines.findIndex((l) => l.includes("TRADING BRIEF"));
  if (idx >= 0) {
    out.push(lines[idx]);
    if (lines[idx + 1]) out.push(lines[idx + 1]);
    if (lines[idx + 2] && !lines[idx + 2].includes("===")) out.push(lines[idx + 2]);
  }
  const news = lines.find((l) => l.includes("新聞輿情分析"));
  if (news) out.push(news);
  return out.slice(0, 6).join("\n");
}

async function runCached(key: string, run: () => Promise<{ outPath: string; stdout: string; stderr: string; ok: boolean }>): Promise<{ hit: boolean; outPath: string; brief: string; stdout: string; stderr: string; ok: boolean }> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && now - existing.ts <= CACHE_TTL_MS) {
    return { hit: true, outPath: existing.outPath, brief: existing.brief, stdout: "", stderr: "", ok: true };
  }

  const r = await run();
  const brief = r.ok ? extractBrief(r.stdout) : "";
  if (r.ok) cache.set(key, { ts: now, outPath: r.outPath, brief });
  return { hit: false, outPath: r.outPath, brief, stdout: r.stdout, stderr: r.stderr, ok: r.ok };
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === "/start" || trimmed === "/help") {
    await sendMessage(
      chatId,
      [
        "*MyStockBot* commands:",
        "- Send a ticker like `NVDA` or `00700`",
        "- `/full NVDA` (full report)",
        "- `/summary NVDA` (brief only)",
        "- `/watch NVDA,AAPL,TSLA` (watchlist scan)",
        "- `/portfolio` (uses `portfolio.json`)",
      ].join("\n"),
    );
    return;
  }

  if (trimmed.startsWith("/portfolio")) {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const key = `portfolio:summary`;
    const out = join(REPORTS_DIR, `portfolio_${Date.now()}.txt`);
    const cached = await runCached(key, async () => {
      const res = runStockCommand(["--positions", "portfolio.json", "--mode", "summary", "--no-news", "--out", out, "--no-open"]);
      return { ...res, outPath: out };
    });
    if (!cached.ok) {
      await sendMessage(chatId, `❌ Failed:\n\`\`\`\n${escapeMarkdown(cached.stderr || cached.stdout || "unknown error")}\n\`\`\``);
      return;
    }
    await sendDocument(chatId, cached.outPath, cached.hit ? "Portfolio summary (cached)" : "Portfolio summary");
    return;
  }

  const watchMatch = trimmed.match(/^\/watch\s+(.+)$/i);
  if (watchMatch) {
    const list = watchMatch[1].trim();
    if (!list) {
      await sendMessage(chatId, "Usage: `/watch NVDA,AAPL,TSLA`");
      return;
    }
    mkdirSync(REPORTS_DIR, { recursive: true });
    const key = `watch:${list}`;
    const out = join(REPORTS_DIR, `watch_${Date.now()}.txt`);
    const cached = await runCached(key, async () => {
      const res = runStockCommand(["--watch", list, "--mode", "summary", "--no-news", "--out", out, "--no-open"]);
      return { ...res, outPath: out };
    });
    if (!cached.ok) {
      await sendMessage(chatId, `❌ Failed:\n\`\`\`\n${escapeMarkdown(cached.stderr || cached.stdout || "unknown error")}\n\`\`\``);
      return;
    }
    await sendDocument(chatId, cached.outPath, cached.hit ? "Watchlist scan (cached)" : "Watchlist scan");
    return;
  }

  const fullMatch = trimmed.match(/^\/full\s+(\S+)/i);
  const summaryMatch = trimmed.match(/^\/summary\s+(\S+)/i);

  let ticker: string | null = null;
  let mode: "full" | "summary" = "full";

  if (fullMatch) {
    ticker = normalizeTickerAlias(fullMatch[1]);
    mode = "full";
  } else if (summaryMatch) {
    ticker = normalizeTickerAlias(summaryMatch[1]);
    mode = "summary";
  } else {
    ticker = normalizeUserInputToTicker(trimmed);
    mode = "full";
  }

  if (!ticker) {
    await sendMessage(chatId, "Send a ticker like `NVDA` or `/full NVDA` or `/portfolio`.");
    return;
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const out = join(REPORTS_DIR, `${ticker}_${mode}_${Date.now()}.txt`);
  const key = `ticker:${ticker}:${mode}:no-news`;
  const cached = await runCached(key, async () => {
    const res = runStockCommand([ticker!, "--mode", mode, "--no-news", "--out", out, "--no-open"]);
    return { ...res, outPath: out };
  });

  if (!cached.ok) {
    const body = escapeMarkdown(cached.stderr || cached.stdout || "unknown error");
    await sendMessage(chatId, `❌ Failed running ${ticker}:\n\`\`\`\n${body.slice(0, 3500)}\n\`\`\``);
    return;
  }

  if (cached.brief) {
    await sendMessage(chatId, `\`\`\`\n${escapeMarkdown(cached.brief)}\n\`\`\``);
  }
  await sendDocument(chatId, cached.outPath, cached.hit ? `${ticker} report (${mode}, cached)` : `${ticker} report (${mode})`);
}

async function run() {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN env var");
  }

  let offset: number | undefined;

  while (true) {
    try {
      const url = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
      url.searchParams.set("timeout", "30");
      if (offset != null) url.searchParams.set("offset", String(offset));

      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.description || "Telegram getUpdates error");

      const updates: any[] = json.result || [];
      for (const u of updates) {
        offset = (u.update_id || 0) + 1;
        const msg = u.message || u.edited_message;
        const text = msg?.text;
        const chatId = msg?.chat?.id;
        if (!text || !chatId) continue;
        if (!isAllowedChat(chatId)) continue;
        await handleMessage(chatId, text);
      }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

run().catch((e) => {
  process.stderr.write(String(e?.message || e) + "\n");
  process.exit(1);
});
