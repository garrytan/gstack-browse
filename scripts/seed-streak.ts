import { write } from "bun";
import { join } from "path";
import { homedir } from "os";
import fs from "fs";

const ANALYTICS_DIR = join(homedir(), ".gstack", "analytics");
const ANALYTICS_PATH = join(ANALYTICS_DIR, "skill-usage.jsonl");

async function seed() {
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }

  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  const entries = [
    JSON.stringify({ skill: "office-hours", ts: today, repo: "gstack" }),
    JSON.stringify({ skill: "plan-ceo-review", ts: yesterday, repo: "gstack" }),
    JSON.stringify({ skill: "ship", ts: twoDaysAgo, repo: "gstack" }),
  ].join("\n") + "\n";

  await write(ANALYTICS_PATH, entries);
  console.log("Seeded analytics data at", ANALYTICS_PATH);
}

seed().catch(console.error);
