import { spawnSync } from "child_process";

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(1);
}

function parseIds(raw: string): string {
  const v = raw.trim();
  if (!v) fail("Missing ids. Example: bun run telegram:whitelist --ids 6611272032,8714377309");
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) fail("No ids found.");
  for (const p of parts) {
    if (!/^\d+$/.test(p)) fail(`Invalid chat id: ${p}`);
  }
  return parts.join(",");
}

function readArg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1] || "";
  return null;
}

function run(cmd: string, args: string[], input?: string) {
  const r = spawnSync(cmd, args, { stdio: ["pipe", "inherit", "inherit"], input: input ?? undefined });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}

async function main() {
  const idsRaw = readArg("--ids") ?? process.argv[2] ?? "";
  const ids = parseIds(idsRaw);
  const config = "cloudflare/wrangler.toml";

  run("bunx", ["wrangler", "secret", "put", "TELEGRAM_ALLOWED_CHAT_IDS", "--config", config], ids);
  run("bunx", ["wrangler", "deploy", "--config", config]);

  process.stdout.write(`Updated TELEGRAM_ALLOWED_CHAT_IDS=${ids}\n`);
}

main().catch((e) => fail(String(e?.message || e)));
