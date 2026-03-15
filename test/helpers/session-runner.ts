/**
 * Agent SDK wrapper for skill E2E testing.
 *
 * Spawns a Claude Code session, runs a prompt, collects messages,
 * scans tool_result messages for browse errors.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as path from 'path';

export interface SkillTestResult {
  messages: any[];
  toolCalls: Array<{ tool: string; input: any; output: string }>;
  browseErrors: string[];
  exitReason: string;
  duration: number;
}

const BROWSE_ERROR_PATTERNS = [
  /Unknown command: \w+/,
  /Unknown snapshot flag: .+/,
  /Exit code 1/,
  /ERROR: browse binary not found/,
  /Server failed to start/,
  /no such file or directory.*browse/i,
];

export async function runSkillTest(options: {
  prompt: string;
  workingDirectory: string;
  maxTurns?: number;
  allowedTools?: string[];
  timeout?: number;
}): Promise<SkillTestResult> {
  // Fail fast if running inside an Agent SDK session — nested sessions hang
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) {
    throw new Error(
      'Cannot run E2E skill tests inside a Claude Code session. ' +
      'Run from a plain terminal: SKILL_E2E=1 bun test test/skill-e2e.test.ts'
    );
  }

  const {
    prompt,
    workingDirectory,
    maxTurns = 15,
    allowedTools = ['Bash', 'Read', 'Write'],
    timeout = 120_000,
  } = options;

  const messages: any[] = [];
  const toolCalls: SkillTestResult['toolCalls'] = [];
  const browseErrors: string[] = [];
  let exitReason = 'unknown';

  const startTime = Date.now();

  // Strip all Claude-related env vars to allow nested sessions.
  // Without this, the child claude process thinks it's an SDK child
  // and hangs waiting for parent IPC instead of running independently.
  const env: Record<string, string | undefined> = {};
  for (const [key] of Object.entries(process.env)) {
    if (key.startsWith('CLAUDE') || key.startsWith('CLAUDECODE')) {
      env[key] = undefined;
    }
  }

  const q = query({
    prompt,
    options: {
      cwd: workingDirectory,
      allowedTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns,
      env,
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Skill test timed out after ${timeout}ms`)), timeout);
  });

  try {
    const runner = (async () => {
      for await (const msg of q) {
        messages.push(msg);

        // Extract tool calls from assistant messages
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'tool_use') {
              toolCalls.push({
                tool: block.name,
                input: block.input,
                output: '', // will be filled from tool_result
              });
            }
            // Scan tool_result blocks for browse errors
            if (block.type === 'tool_result' || (typeof block === 'object' && 'text' in block)) {
              const text = typeof block === 'string' ? block : (block as any).text || '';
              for (const pattern of BROWSE_ERROR_PATTERNS) {
                if (pattern.test(text)) {
                  browseErrors.push(text.slice(0, 200));
                }
              }
            }
          }
        }

        // Also scan user messages (which contain tool results)
        if (msg.type === 'user' && msg.message?.content) {
          const content = Array.isArray(msg.message.content) ? msg.message.content : [msg.message.content];
          for (const block of content) {
            const text = typeof block === 'string' ? block : (block as any)?.text || (block as any)?.content || '';
            if (typeof text === 'string') {
              for (const pattern of BROWSE_ERROR_PATTERNS) {
                if (pattern.test(text)) {
                  browseErrors.push(text.slice(0, 200));
                }
              }
            }
          }
        }

        // Capture result
        if (msg.type === 'result') {
          exitReason = msg.subtype || 'success';
        }
      }
    })();

    await Promise.race([runner, timeoutPromise]);
  } catch (err: any) {
    exitReason = err.message?.includes('timed out') ? 'timeout' : `error: ${err.message}`;
  }

  const duration = Date.now() - startTime;

  // Save transcript on failure
  if (browseErrors.length > 0 || exitReason !== 'success') {
    try {
      const transcriptDir = path.join(workingDirectory, '.gstack', 'test-transcripts');
      fs.mkdirSync(transcriptDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const transcriptPath = path.join(transcriptDir, `e2e-${timestamp}.json`);
      fs.writeFileSync(transcriptPath, JSON.stringify({
        prompt,
        exitReason,
        browseErrors,
        duration,
        messages: messages.map(m => ({ type: m.type, subtype: m.subtype })),
      }, null, 2));
    } catch {
      // Transcript save failures are non-fatal
    }
  }

  return { messages, toolCalls, browseErrors, exitReason, duration };
}
