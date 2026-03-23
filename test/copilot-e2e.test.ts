/**
 * Copilot CLI E2E tests — verify skills work when invoked by GitHub Copilot CLI.
 *
 * Spawns `gh copilot suggest` with skills installed in a temp HOME, captures
 * output, and validates results. Follows the same pattern as codex-e2e.test.ts
 * but adapted for the GitHub Copilot CLI (gh extension).
 *
 * Prerequisites:
 * - `gh` CLI installed with the copilot extension (`gh extension install github/gh-copilot`)
 * - Copilot authenticated via GitHub CLI
 * - EVALS=1 env var set (same gate as Claude/Codex E2E tests)
 *
 * Skips gracefully when prerequisites are not met.
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { runCopilotSkill, installSkillToTempHome } from './helpers/copilot-session-runner';
import type { CopilotResult } from './helpers/copilot-session-runner';
import { EvalCollector } from './helpers/eval-store';
import type { EvalTestEntry } from './helpers/eval-store';
import { selectTests, detectBaseBranch, getChangedFiles, E2E_TOUCHFILES, GLOBAL_TOUCHFILES } from './helpers/touchfiles';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');

// --- Prerequisites check ---

const COPILOT_AVAILABLE = (() => {
  try {
    const result = Bun.spawnSync(['gh', 'copilot', '--version']);
    return result.exitCode === 0;
  } catch { return false; }
})();

const evalsEnabled = !!process.env.EVALS;

// Skip all tests if gh copilot is not available or EVALS is not set.
const SKIP = !COPILOT_AVAILABLE || !evalsEnabled;

const describeCopilot = SKIP ? describe.skip : describe;

// Log why we're skipping (helpful for debugging CI)
if (!evalsEnabled) {
  // Silent — same as Claude/Codex E2E tests, EVALS=1 required
} else if (!COPILOT_AVAILABLE) {
  process.stderr.write('\nCopilot E2E: SKIPPED — gh copilot not found (install: gh extension install github/gh-copilot)\n');
}

// --- Diff-based test selection ---

// Copilot E2E touchfiles — keyed by test name, same pattern as Codex E2E_TOUCHFILES
const COPILOT_E2E_TOUCHFILES: Record<string, string[]> = {
  'copilot-discover-skill':    ['codex/**', '.agents/skills/**', 'test/helpers/copilot-session-runner.ts'],
};

let selectedTests: string[] | null = null; // null = run all

// --- Eval collector ---

const evalCollector = new EvalCollector('copilot-e2e');

afterAll(async () => {
  if (!SKIP) {
    await evalCollector.flush();
  }
});

// --- Tests ---

describeCopilot('Copilot CLI E2E', () => {
  test('copilot-discover-skill: gh copilot can suggest with gstack skill context', async () => {
    // Diff-based test selection
    if (selectedTests !== null && !selectedTests.includes('copilot-discover-skill')) {
      return; // skip — not affected by current diff
    }

    const agentsDir = path.join(ROOT, '.agents', 'skills');
    if (!fs.existsSync(agentsDir)) {
      process.stderr.write('  Copilot E2E: .agents/skills/ not found — skipping\n');
      return;
    }

    // Use the generated root gstack skill
    const skillDir = path.join(agentsDir, 'gstack');
    if (!fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
      process.stderr.write('  Copilot E2E: gstack SKILL.md not found in .agents/skills/ — skipping\n');
      return;
    }

    const result = await runCopilotSkill({
      skillDir,
      prompt: 'list available gstack skills',
      timeoutMs: 120_000,
      cwd: ROOT,
      skillName: 'gstack',
    });

    // Record eval
    const entry: EvalTestEntry = {
      test_name: 'copilot-discover-skill',
      skill_name: 'gstack',
      host: 'copilot',
      prompt: 'list available gstack skills',
      expected_behavior: 'Copilot acknowledges gstack skill context',
      actual_output: result.output.slice(0, 1000),
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
      pass: result.exitCode === 0 && result.output.length > 0,
    };
    evalCollector.add(entry);

    // Basic validation — copilot ran and produced output
    expect(result.exitCode).toBe(0);
    expect(result.output.length).toBeGreaterThan(0);
  }, 180_000);
});
