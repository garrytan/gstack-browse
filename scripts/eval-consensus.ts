#!/usr/bin/env bun
/**
 * Multi-agent consensus eval for SKILL.md changes.
 *
 * Runs N agents (5 specialized reviewers) that each review the diff of changed
 * SKILL.md files against their ground truth source. Agents vote YES/NO/REWRITE
 * with risk scores. Reputation persists across runs — agents that align with
 * consensus earn trust, those that don't get slashed.
 *
 * Usage:
 *   bun run eval:consensus                     # auto-detect changed SKILL.md files
 *   bun run eval:consensus --skill qa          # eval specific skill
 *   bun run eval:consensus --runs 10           # number of eval runs (default: 5)
 *   bun run eval:consensus --threshold 3       # min YES votes to pass (default: 3)
 *   bun run eval:consensus --reset-reputation  # reset reputation to 100
 *
 * Requires: ANTHROPIC_API_KEY env var
 *
 * Results saved to: .data/consensus-evals/
 * Reputation saved to: .data/reputation.json
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───

interface Agent {
  id: string;
  name: string;
  focus: string;
  reputation: number;
}

interface Vote {
  agentId: string;
  agentName: string;
  vote: "YES" | "NO" | "REWRITE";
  risk: number;
  reason: string;
}

interface RunResult {
  run: number;
  votes: Vote[];
  yesCount: number;
  passed: boolean;
}

interface EvalResult {
  skill: string;
  timestamp: string;
  branch: string;
  runs: RunResult[];
  passRate: number;
  agents: { id: string; reputation: number }[];
  threshold: number;
}

// ─── Agents ───

const AGENT_DEFS: Omit<Agent, "reputation">[] = [
  {
    id: "doc-architect",
    name: "Doc Architect",
    focus: "document structure, heading hierarchy, progressive disclosure, section ordering",
  },
  {
    id: "api-accuracy",
    name: "API Accuracy Checker",
    focus: "command names, flags, arguments, return values match ground truth exactly",
  },
  {
    id: "agent-usability",
    name: "Agent Usability Tester",
    focus: "can an AI agent execute the full task from this doc alone? zero-guess invocations?",
  },
  {
    id: "completeness-auditor",
    name: "Completeness Auditor",
    focus: "missing commands, undocumented edge cases, gaps in scoring rubrics or decision criteria",
  },
  {
    id: "style-guardian",
    name: "Style Guardian",
    focus: "consistent markdown formatting, table alignment, code block tags, cross-skill template compliance",
  },
];

// ─── Reputation ───

const REP_FILE = path.join(process.cwd(), ".data", "reputation.json");
const REP_FLOOR = 10;
const REP_CEILING = 200;

function loadReputation(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(REP_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveReputation(reps: Record<string, number>): void {
  fs.mkdirSync(path.dirname(REP_FILE), { recursive: true });
  fs.writeFileSync(REP_FILE, JSON.stringify(reps, null, 2));
}

function settleRun(agents: Agent[], votes: Vote[], passed: boolean): void {
  for (const v of votes) {
    const agent = agents.find((a) => a.id === v.agentId)!;
    if (v.vote === "YES" && passed) {
      agent.reputation = Math.min(REP_CEILING, agent.reputation + 3);
    } else if (v.vote === "YES" && !passed) {
      agent.reputation = Math.max(REP_FLOOR, agent.reputation - 2);
    } else if (v.vote !== "YES" && !passed) {
      agent.reputation = Math.min(REP_CEILING, agent.reputation + 3);
    } else {
      agent.reputation = Math.max(REP_FLOOR, agent.reputation - 2);
    }
  }
}

// ─── LLM ───

function buildPrompt(agent: Agent, diff: string, groundTruth: string, skillName: string): string {
  return `You are ${agent.name}, reviewing a SKILL.md diff for "${skillName}".

Your focus: ${agent.focus}

Check that the diff is FACTUALLY ACCURATE against the ground truth source file. The SKILL.md should correctly describe commands, flags, workflows, scoring rubrics, and behavior that actually exist in the ground truth.

DIFF (+ = additions, - = removals):
${diff.slice(0, 8000)}

GROUND TRUTH (${skillName}/SKILL.md or relevant source — the authoritative reference):
${groundTruth.slice(0, 8000)}

Rules:
- YES: diff is factually accurate and well-structured
- REWRITE: minor inaccuracies (wrong flags, incorrect descriptions, misleading examples)
- NO: serious inaccuracies (fabricated commands, completely wrong behavior, dangerous misinformation)
- Do NOT flag style preferences — only factual issues
- A SKILL.md can summarize — that's fine. But what it DOES say must be correct.

Respond with exactly one line:
VOTE: <YES|NO|REWRITE> | RISK: <0.0-1.0> | REASON: <brief, cite specific inaccuracies if found>`;
}

function parseVote(text: string, agent: Agent): Vote {
  const voteMatch = /VOTE:\s*(YES|NO|REWRITE)/i.exec(text);
  const riskMatch = /RISK:\s*([\d.]+)/i.exec(text);
  const reasonMatch = /REASON:\s*(.+)/i.exec(text);
  return {
    agentId: agent.id,
    agentName: agent.name,
    vote: (voteMatch?.[1]?.toUpperCase() as "YES" | "NO" | "REWRITE") || "YES",
    risk: Math.min(1, Math.max(0, parseFloat(riskMatch?.[1] || "0.5"))),
    reason: reasonMatch?.[1]?.trim() || "No issues detected",
  };
}

// ─── Skill detection ───

function getChangedSkills(): string[] {
  const result = spawnSync("git", ["diff", "main", "--name-only"], { encoding: "utf-8" });
  const files = (result.stdout || "").trim().split("\n").filter(Boolean);
  const skills = new Set<string>();
  for (const f of files) {
    const match = f.match(/^(\w[\w-]*)\/SKILL\.md/);
    if (match) skills.add(match[1]);
    // Also catch template changes
    const tmplMatch = f.match(/^(\w[\w-]*)\/SKILL\.md\.tmpl/);
    if (tmplMatch) skills.add(tmplMatch[1]);
    // Generator changes affect qa and qa-only
    if (f === "scripts/gen-skill-docs.ts") {
      skills.add("qa");
      skills.add("qa-only");
    }
  }
  return [...skills];
}

function getSkillDiff(skill: string): string {
  const result = spawnSync("git", ["diff", "main", "--", `${skill}/SKILL.md`, `${skill}/SKILL.md.tmpl`], {
    encoding: "utf-8",
  });
  return result.stdout || "";
}

function getGroundTruth(skill: string): string {
  // For QA skills, ground truth is browse/SKILL.md (the CLI reference they document)
  if (skill === "qa" || skill === "qa-only") {
    try {
      return fs.readFileSync("browse/SKILL.md", "utf-8");
    } catch {
      return "";
    }
  }
  // For other skills, ground truth is the skill's own SKILL.md on main
  const result = spawnSync("git", ["show", `main:${skill}/SKILL.md`], { encoding: "utf-8" });
  return result.stdout || "";
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const skillArg = args.includes("--skill") ? args[args.indexOf("--skill") + 1] : null;
  const runs = args.includes("--runs") ? parseInt(args[args.indexOf("--runs") + 1]) : 5;
  const threshold = args.includes("--threshold") ? parseInt(args[args.indexOf("--threshold") + 1]) : 3;
  const resetRep = args.includes("--reset-reputation");

  // Load or reset reputation
  const savedRep = resetRep ? {} : loadReputation();
  const agents: Agent[] = AGENT_DEFS.map((d) => ({
    ...d,
    reputation: savedRep[d.id] ?? 100,
  }));

  // Detect skills to eval
  const skills = skillArg ? [skillArg] : getChangedSkills();
  if (skills.length === 0) {
    console.log("No SKILL.md changes detected on this branch.");
    process.exit(0);
  }

  const client = new Anthropic();
  const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf-8" }).stdout.trim();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Consensus Eval — ${skills.length} skill(s) — ${runs} runs — threshold ${threshold}/5`);
  console.log(`  Branch: ${branch}`);
  console.log(`  Reputation: ${agents.map((a) => `${a.id.slice(0, 8)}:${a.reputation}`).join("  ")}`);
  console.log(`${"=".repeat(60)}`);

  const allResults: EvalResult[] = [];

  for (const skill of skills) {
    const diff = getSkillDiff(skill);
    if (!diff.trim()) {
      console.log(`\n  Skipping ${skill} (no diff)`);
      continue;
    }
    const groundTruth = getGroundTruth(skill);

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  ${skill}/SKILL.md`);
    console.log(`${"─".repeat(60)}`);

    const runResults: RunResult[] = [];

    for (let run = 1; run <= runs; run++) {
      const votes: Vote[] = [];

      for (const agent of agents) {
        try {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            temperature: 0.3,
            messages: [{ role: "user", content: buildPrompt(agent, diff, groundTruth, skill) }],
          });
          const text = response.content[0]?.type === "text" ? response.content[0].text : "";
          votes.push(parseVote(text, agent));
        } catch (err: any) {
          if (err.status === 429) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              const response = await client.messages.create({
                model: "claude-sonnet-4-6",
                max_tokens: 300,
                temperature: 0.3,
                messages: [{ role: "user", content: buildPrompt(agent, diff, groundTruth, skill) }],
              });
              const text = response.content[0]?.type === "text" ? response.content[0].text : "";
              votes.push(parseVote(text, agent));
            } catch {
              votes.push({ agentId: agent.id, agentName: agent.name, vote: "REWRITE", risk: 0.5, reason: `Rate limited` });
            }
          } else {
            votes.push({ agentId: agent.id, agentName: agent.name, vote: "REWRITE", risk: 0.5, reason: `Error: ${err.message}` });
          }
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      const yesCount = votes.filter((v) => v.vote === "YES").length;
      const passed = yesCount >= threshold;

      // Settle reputation
      settleRun(agents, votes, passed);

      const icon = passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`  Run ${run}/${runs}: ${icon} ${yesCount}/5 YES`);
      for (const v of votes) {
        const tag = v.vote === "YES" ? "\x1b[32mYES\x1b[0m" : v.vote === "NO" ? "\x1b[31mNO\x1b[0m" : "\x1b[33mREWR\x1b[0m";
        console.log(`    ${v.agentName.padEnd(24)} ${tag}  ${v.risk.toFixed(2)}  ${v.reason.slice(0, 70)}`);
      }

      runResults.push({ run, votes, yesCount, passed });
      if (run < runs) await new Promise((r) => setTimeout(r, 3000));
    }

    const passRate = runResults.filter((r) => r.passed).length / runs;
    console.log(`\n  Result: ${runResults.filter((r) => r.passed).length}/${runs} runs passed`);

    if (passRate < 1) {
      const issues = runResults
        .flatMap((r) => r.votes)
        .filter((v) => v.vote !== "YES")
        .map((v) => `[${v.agentId}] ${v.reason}`);
      const unique = [...new Set(issues)];
      console.log(`  Issues (${unique.length} unique):`);
      for (const issue of unique.slice(0, 5)) {
        console.log(`    - ${issue.slice(0, 120)}`);
      }
    }

    allResults.push({
      skill,
      timestamp: new Date().toISOString(),
      branch,
      runs: runResults,
      passRate,
      agents: agents.map((a) => ({ id: a.id, reputation: a.reputation })),
      threshold,
    });
  }

  // Save reputation
  const repState: Record<string, number> = {};
  for (const a of agents) repState[a.id] = a.reputation;
  saveReputation(repState);

  // Save results
  const resultsDir = path.join(process.cwd(), ".data", "consensus-evals");
  fs.mkdirSync(resultsDir, { recursive: true });
  const filename = `${branch.replace(/\//g, "-")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify(allResults, null, 2));

  // Final summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("  SUMMARY");
  console.log(`${"=".repeat(60)}`);
  for (const r of allResults) {
    const status = r.passRate >= 0.6 ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    console.log(`  ${r.skill.padEnd(20)} ${status}  ${(r.passRate * 100).toFixed(0)}% pass rate`);
  }
  console.log(`\n  Reputation:`);
  for (const a of agents) {
    console.log(`    ${a.name.padEnd(24)} ${a.reputation}`);
  }
  console.log(`\n  Results: .data/consensus-evals/${filename}`);
  console.log(`  Reputation: .data/reputation.json`);

  // Exit with failure if any skill failed
  const allPassed = allResults.every((r) => r.passRate >= 0.6);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
