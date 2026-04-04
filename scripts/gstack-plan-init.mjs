import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) return null;
  if (r.status !== 0) return null;
  return (r.stdout || "").trim();
}

function repoRoot() {
  const root = sh("git", ["rev-parse", "--show-toplevel"]);
  return root || process.cwd();
}

function currentBranch() {
  return sh("git", ["branch", "--show-current"]) || "unknown";
}

function remoteSlug() {
  const url = sh("git", ["remote", "get-url", "origin"]) || "";
  const m = url.match(/[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/);
  if (!m?.groups) return "unknown";
  return `${m.groups.owner}-${m.groups.repo}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function template({ branch, slug, nowIso }) {
  return [
    "---",
    `title: Plan`,
    `generated: ${nowIso}`,
    `repo: ${slug}`,
    `branch: ${branch}`,
    "---",
    "",
    "# 1) Problem",
    "",
    "# 2) User + Job-to-be-done",
    "",
    "# 3) Goal (success metric)",
    "",
    "# 4) Non-goals",
    "",
    "# 5) Constraints",
    "",
    "# 6) Proposed solution (high level)",
    "",
    "# 7) User flows",
    "",
    "# 8) System design (data flow + key components)",
    "",
    "# 9) Risks + failure modes",
    "",
    "# 10) Rollout plan",
    "",
    "# 11) Open questions",
    "",
  ].join("\n");
}

function run() {
  const root = repoRoot();
  const planPath = join(root, "plan.md");
  const branch = currentBranch();
  const slug = remoteSlug();
  const nowIso = new Date().toISOString();

  if (!existsSync(planPath)) {
    writeFileSync(planPath, template({ branch, slug, nowIso }), "utf8");
  }

  process.stdout.write(`Plan: ${planPath}\n`);
  process.stdout.write(`Next: open plan.md and run /plan-ceo-review\n`);
}

run();
