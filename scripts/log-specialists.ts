import { appendFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const ANALYTICS_PATH = join(homedir(), ".gstack", "analytics", "skill-usage.jsonl");

async function logSpecialists() {
  const now = new Date().toISOString();
  
  const qaEntry = JSON.stringify({
    skill: "qa",
    ts: now,
    repo: "gstack",
    event: "Verify NVDA support levels"
  }) + "\n";
  
  const shipEntry = JSON.stringify({
    skill: "ship",
    ts: now,
    repo: "gstack",
    event: "Finalize Pro Stock Checker"
  }) + "\n";

  await appendFile(ANALYTICS_PATH, qaEntry);
  await appendFile(ANALYTICS_PATH, shipEntry);
  
  console.log("Logged QA and Ship actions to analytics.");
}

logSpecialists().catch(console.error);
