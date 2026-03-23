/**
 * Copilot CLI subprocess runner for skill E2E testing.
 *
 * Spawns `gh copilot suggest` as a completely independent process and returns
 * structured results. Follows the same pattern as codex-session-runner.ts but
 * adapted for the GitHub Copilot CLI (gh copilot extension).
 *
 * Key differences from Codex session-runner:
 * - Uses `gh copilot suggest` instead of `codex exec`
 * - Copilot CLI is a gh extension, not a standalone binary
 * - Needs temp HOME with skill installed at ~/.copilot/skills/{skillName}/SKILL.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Interfaces ---

export interface CopilotResult {
  output: string;           // Full agent message text
  exitCode: number;         // Process exit code
  durationMs: number;       // Wall clock time
  rawOutput: string;        // Raw stdout for debugging
}

// --- Skill installation helper ---

/**
 * Install a SKILL.md into a temp HOME directory for Copilot to discover.
 * Creates ~/.copilot/skills/{skillName}/SKILL.md in the temp HOME.
 *
 * Returns the temp HOME path. Caller is responsible for cleanup.
 */
export function installSkillToTempHome(
  skillDir: string,
  skillName: string,
  tempHome?: string,
): string {
  const home = tempHome || fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-e2e-'));
  const destDir = path.join(home, '.copilot', 'skills', skillName);
  fs.mkdirSync(destDir, { recursive: true });

  const srcSkill = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(srcSkill)) {
    fs.copyFileSync(srcSkill, path.join(destDir, 'SKILL.md'));
  }

  return home;
}

// --- Main runner ---

/**
 * Run a Copilot skill via `gh copilot suggest` and return structured results.
 *
 * Spawns gh copilot in a temp HOME with the skill installed, captures output,
 * and returns a CopilotResult. Skips gracefully if gh copilot is not found.
 */
export async function runCopilotSkill(opts: {
  skillDir: string;         // Path to skill directory containing SKILL.md
  prompt: string;           // What to ask Copilot to suggest
  timeoutMs?: number;       // Default 300000 (5 min)
  cwd?: string;             // Working directory
  skillName?: string;       // Skill name for installation (default: dirname)
}): Promise<CopilotResult> {
  const {
    skillDir,
    prompt,
    timeoutMs = 300_000,
    cwd,
    skillName,
  } = opts;

  const startTime = Date.now();
  const name = skillName || path.basename(skillDir) || 'gstack';

  // Check if gh copilot is available
  const whichResult = Bun.spawnSync(['gh', 'copilot', '--version']);
  if (whichResult.exitCode !== 0) {
    return {
      output: 'SKIP: gh copilot not found',
      exitCode: -1,
      durationMs: Date.now() - startTime,
      rawOutput: '',
    };
  }

  // Set up temp HOME with skill installed
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-e2e-'));

  try {
    installSkillToTempHome(skillDir, name, tempHome);

    // Build gh copilot suggest command
    const args = ['copilot', 'suggest', '-t', 'shell', prompt];

    // Spawn gh copilot with temp HOME
    const proc = Bun.spawn(['gh', ...args], {
      cwd: cwd || skillDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        HOME: tempHome,
      },
    });

    // Race against timeout
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;

    // Log stderr if non-empty
    if (stderrText.trim()) {
      process.stderr.write(`  [copilot stderr] ${stderrText.trim().slice(0, 200)}\n`);
    }

    return {
      output: stdoutText.trim(),
      exitCode: timedOut ? 124 : exitCode,
      durationMs,
      rawOutput: stdoutText,
    };
  } finally {
    // Clean up temp HOME
    try { fs.rmSync(tempHome, { recursive: true, force: true }); } catch { /* non-fatal */ }
  }
}
