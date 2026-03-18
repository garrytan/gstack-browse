/**
 * Shared server logic — used by both server.ts (Bun) and server-node.mjs (Node).
 *
 * Extracts pure functions with no Bun/Node runtime dependencies so that
 * changes to command dispatch, error handling, and help text only need
 * to be made in one place.
 */

import { COMMAND_DESCRIPTIONS, READ_COMMANDS, WRITE_COMMANDS, META_COMMANDS } from './commands';
import { SNAPSHOT_FLAGS } from './snapshot';
import { handleReadCommand } from './read-commands';
import { handleWriteCommand } from './write-commands';
import { handleMetaCommand } from './meta-commands';
import type { BrowserManager } from './browser-manager';

// ─── Help Text ──────────────────────────────────────────────────

export function generateHelpText(): string {
  const groups = new Map<string, string[]>();
  for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
    const display = meta.usage || cmd;
    const list = groups.get(meta.category) || [];
    list.push(display);
    groups.set(meta.category, list);
  }

  const categoryOrder = [
    'Navigation', 'Reading', 'Interaction', 'Inspection',
    'Visual', 'Snapshot', 'Meta', 'Tabs', 'Server',
  ];

  const lines = ['gstack browse — headless browser for AI agents', '', 'Commands:'];
  for (const cat of categoryOrder) {
    const cmds = groups.get(cat);
    if (!cmds) continue;
    lines.push(`  ${(cat + ':').padEnd(15)}${cmds.join(', ')}`);
  }

  lines.push('');
  lines.push('Snapshot flags:');
  const flagPairs: string[] = [];
  for (const flag of SNAPSHOT_FLAGS) {
    const label = flag.valueHint ? `${flag.short} ${flag.valueHint}` : flag.short;
    flagPairs.push(`${label}  ${flag.long}`);
  }
  for (let i = 0; i < flagPairs.length; i += 2) {
    const left = flagPairs[i].padEnd(28);
    const right = flagPairs[i + 1] || '';
    lines.push(`  ${left}${right}`);
  }

  return lines.join('\n');
}

// ─── Error Wrapping ─────────────────────────────────────────────

/**
 * Translate Playwright errors into actionable messages for AI agents.
 */
export function wrapError(err: any): string {
  const msg = err.message || String(err);
  if (err.name === 'TimeoutError' || msg.includes('Timeout') || msg.includes('timeout')) {
    if (msg.includes('locator.click') || msg.includes('locator.fill') || msg.includes('locator.hover')) {
      return `Element not found or not interactable within timeout. Check your selector or run 'snapshot' for fresh refs.`;
    }
    if (msg.includes('page.goto') || msg.includes('Navigation')) {
      return `Page navigation timed out. The URL may be unreachable or the page may be loading slowly.`;
    }
    return `Operation timed out: ${msg.split('\n')[0]}`;
  }
  if (msg.includes('resolved to') && msg.includes('elements')) {
    return `Selector matched multiple elements. Be more specific or use @refs from 'snapshot'.`;
  }
  return msg;
}

// ─── Command Dispatch ───────────────────────────────────────────

export interface CommandResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Dispatch a parsed command body to the appropriate handler.
 * Returns a runtime-agnostic result that callers convert to their
 * HTTP response type (Bun Response or Node ServerResponse).
 */
export async function dispatchCommand(
  body: any,
  browserManager: BrowserManager,
  shutdownFn: () => void | Promise<void>,
): Promise<CommandResult> {
  const { command, args = [] } = body;

  if (!command) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Missing "command" field' }),
      contentType: 'application/json',
    };
  }

  try {
    let result: string;

    if (READ_COMMANDS.has(command)) {
      result = await handleReadCommand(command, args, browserManager);
    } else if (WRITE_COMMANDS.has(command)) {
      result = await handleWriteCommand(command, args, browserManager);
    } else if (META_COMMANDS.has(command)) {
      result = await handleMetaCommand(command, args, browserManager, shutdownFn);
    } else if (command === 'help') {
      return { status: 200, body: generateHelpText(), contentType: 'text/plain' };
    } else {
      return {
        status: 400,
        body: JSON.stringify({
          error: `Unknown command: ${command}`,
          hint: `Available: ${[...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS].sort().join(', ')}`,
        }),
        contentType: 'application/json',
      };
    }

    return { status: 200, body: result, contentType: 'text/plain' };
  } catch (err: any) {
    return {
      status: 500,
      body: JSON.stringify({ error: wrapError(err) }),
      contentType: 'application/json',
    };
  }
}
