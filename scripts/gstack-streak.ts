import { file } from "bun";
import { join } from "path";
import { homedir } from "os";

interface AnalyticsEntry {
  skill: string;
  ts: string;
  repo: string;
}

const ANALYTICS_PATH = join(homedir(), ".gstack", "analytics", "skill-usage.jsonl");

async function run() {
  const analyticsFile = file(ANALYTICS_PATH);
  if (!(await analyticsFile.exists())) {
    console.log("No analytics data found. Start shipping to build a streak! 🔥");
    process.exit(0);
  }

  const text = await analyticsFile.text();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  const dailyActivity = new Map<string, Set<string>>();

  for (const line of lines) {
    try {
      const entry: AnalyticsEntry = JSON.parse(line);
      const date = new Date(entry.ts).toISOString().split("T")[0];
      const skills = dailyActivity.get(date) || new Set<string>();
      skills.add(entry.skill);
      dailyActivity.set(date, skills);
    } catch (e) {
      // Skip malformed lines
    }
  }

  const sortedDates = Array.from(dailyActivity.keys()).sort((a, b) => b.localeCompare(a));
  
  if (sortedDates.length === 0) {
    console.log("No activity recorded yet. Time to ship! 🚀");
    process.exit(0);
  }

  // Calculate streak
  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  
  // Start from the most recent date
  let checkDateStr = sortedDates[0];
  
  // If the last activity wasn't today or yesterday, streak is 0
  if (checkDateStr !== today && checkDateStr !== yesterday) {
    streak = 0;
  } else {
    // Count backwards
    let current = new Date(checkDateStr);
    while (dailyActivity.has(current.toISOString().split("T")[0])) {
      streak++;
      current.setDate(current.getDate() - 1);
    }
  }

  console.log("\n🔥 GSTACK SHIPPING STREAK 🔥");
  console.log("============================");
  console.log(`Current Streak: ${streak} day${streak === 1 ? "" : "s"}`);
  console.log("");
  console.log("Last 7 Days of Activity:");
  
  const last7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const dStr = d.toISOString().split("T")[0];
    const skills = dailyActivity.get(dStr);
    last7Days.push({
      date: dStr,
      active: !!skills,
      skills: skills ? Array.from(skills).join(", ") : "-",
    });
  }

  console.table(last7Days.map(d => ({
    Date: d.date,
    Status: d.active ? "✅ ACTIVE" : "💤 idle",
    Skills: d.skills
  })));

  if (streak > 0) {
    console.log(`Keep it up! You're on fire! ⚡`);
  } else {
    console.log("Start a new streak today! 🚀");
  }
}

run().catch(console.error);
