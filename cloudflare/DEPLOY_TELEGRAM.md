# Cloudflare Worker (Free) — Telegram Webhook Deployment

This deploys the Telegram bot as a Cloudflare Worker (no always-on server, no polling).

## Prerequisites
- A Cloudflare account
- A Telegram bot token from @BotFather

## Deploy

From the repo root:

```bash
cd cloudflare
npx wrangler@latest deploy
```

This prints a `workers.dev` URL like:
`https://gstack-telegram-webhook.<your-subdomain>.workers.dev`

## Configure secrets

```bash
cd cloudflare
npx wrangler@latest secret put TELEGRAM_TOKEN
npx wrangler@latest secret put WEBHOOK_SECRET
```

Optional (restrict who can use the bot):

```bash
npx wrangler@latest secret put TELEGRAM_ALLOWED_CHAT_IDS
```

Enter your Telegram chat id (or comma-separated list).


Alternative (recommended, from repo root; avoids the “Required Worker name missing” error):

```bash
bun run telegram:whitelist --ids 6611272032,8714377309
```
Optional (enable `/portfolio` in the Worker):


```bash
npx wrangler@latest secret put PORTFOLIO
```

Enter a comma-separated ticker list, for example:
`GOOGL,NVDA,TSM,MSFT,MSTR,TCOM,0700.HK,7226.HK,9988.HK,1810.HK`

## Important note (secrets vs vars)

If you define `TELEGRAM_ALLOWED_CHAT_IDS` or `PORTFOLIO` as plain environment variables in `wrangler.toml`, they can override your remote secrets. This project uses secrets for these values.

## Set the Telegram webhook

Replace:
- `<TOKEN>` with your Telegram bot token
- `<WORKER_URL>` with the URL printed by `wrangler deploy`
- `<WEBHOOK_SECRET>` with the value you set in `WEBHOOK_SECRET`

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/telegram/<WEBHOOK_SECRET>"
```

To verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Test in Telegram

- `NVDA`
- `/summary NVDA`
- `/full NVDA`
- `/watch NVDA,AAPL,TSLA`
- `/portfolio`

## Calendar configuration

The Worker can show a small economic calendar via `/calendar`.

Environment variables:
- `CALENDAR_TZ` (optional): time zone used to interpret and display the input times (default: `America/New_York`)
- `DAILY_CRON_CMD` (optional): command to run for the daily cron push (default `/morning`, set to `halo` or `/halo` to push the HALO monitor)
- `ECON_CALENDAR_SOURCE` (optional): set to `yahoo_viz` (preferred) to fetch from Yahoo Finance economic calendar via internal API; or `yahoo` (HTML fallback) for same-day only
- `ECON_CALENDAR_DAYS` (optional): number of days to fetch when `ECON_CALENDAR_SOURCE=yahoo` (default 7, min 1, max 30)
- `ECON_CALENDAR_YAHOO_MODE` (optional): `important` (default) or `all`
- `ECON_CALENDAR_URL` (optional): HTTPS URL to a plain text file containing events
- `ECON_CALENDAR_CACHE_TTL` (optional): cache seconds for `ECON_CALENDAR_SOURCE=yahoo` or `ECON_CALENDAR_URL` (default 900, min 60, max 86400)
- `ECON_CALENDAR` (optional): inline multi-line fallback (used when URL is not set or fetch fails)

## HALO configuration

The Worker can show a small HALO monitor via `/halo`.

- `/halo` shows: VIX regime + S7/T12 entry signals + stop triggers + near-miss list (S7 xor T12)
- `/halo --all` shows more near-miss lines
- `/halo --table` shows a full per-ticker table (PASS / S7-only / T12-only / both-fail)

Environment variables:
- `PORTFOLIO_POSITIONS` (optional): positions with quantity and cost basis (enables stop trigger checks)
  - Format: `TICKER:QTY@COST,TICKER:QTY@COST`
- `HALO_CORE` (optional): core monitor list (with labels)
  - Format: `TICKER=Label,TICKER=Label`
- `HALO_WATCHLIST` (optional): watchlist (with labels)
  - Format: `TICKER=Label,TICKER=Label`
- `HALO_STOP_PCTS` (optional): per-ticker stop percent
  - Format: `TICKER:0.08,TICKER:0.06` (0.08 means -8% from cost)
- `HALO_EMA_WINDOW` (optional): default 20
- `HALO_VOLUME_WINDOW` (optional): default 20
- `HALO_VOLUME_SURGE` (optional): default 1.5
- `HALO_VIX_AMBER` (optional): default 18
- `HALO_VIX_RED` (optional): default 25
- `HALO_NEARMISS_PEMA_TARGET` (optional): P/EMA target hint for near-miss watch (default 1.01)
- `HALO_MILKSHAKE_RISK` (optional): `TICKER:high` flags
- `HALO_OBSOLESCENCE` (optional): `TICKER:high` flags

Notes:
- If `ECON_CALENDAR_SOURCE=yahoo_viz` cannot acquire a cookie/crumb (blocked network / rate limit), switch to a reliable “next N days” calendar by generating a plain-text feed via `browse` and setting `ECON_CALENDAR_URL` to that file.

Generate a feed file (example):
```bash
bun run build
bun run calendar:feed -- --days 7 --mode important --tz America/New_York --countries us --out cloudflare/econ_calendar.txt
```

Then publish `cloudflare/econ_calendar.txt` (e.g. GitHub raw / any HTTPS host) and set:
- `ECON_CALENDAR_SOURCE=` (unset)
- `ECON_CALENDAR_URL=https://.../econ_calendar.txt`

Plain text format (one per line):
`YYYY-MM-DD HH:mm Event name`

## Notes / Limitations (Worker version)
- This Worker returns a “Trading Brief” summary. It does not run Bun/Playwright, so it does not scrape news.
- If you need the full report and news scraping, run the local bot (`bun run telegram:bot`) on your PC/VPS.
