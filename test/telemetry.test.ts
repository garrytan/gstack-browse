import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

// Each test gets a fresh temp directory for CAVESTACK_STATE_DIR
let tmpDir: string;

function run(cmd: string, env: Record<string, string> = {}): string {
  return execSync(cmd, {
    cwd: ROOT,
    env: { ...process.env, CAVESTACK_STATE_DIR: tmpDir, CAVESTACK_DIR: ROOT, ...env },
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
}

function seedJsonl(events: Array<Record<string, unknown>>) {
  const analyticsDir = path.join(tmpDir, 'analytics');
  fs.mkdirSync(analyticsDir, { recursive: true });
  const file = path.join(analyticsDir, 'skill-usage.jsonl');
  const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(file, lines);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cavestack-tel-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cavestack-analytics', () => {
  test('shows "no data" for empty JSONL', () => {
    const output = run(`bash "${BIN}/cavestack-analytics"`);
    expect(output).toContain('no data');
  });

  test('renders usage dashboard with events', () => {
    seedJsonl([
      { skill: 'qa', duration_s: 120, outcome: 'success', session_id: 'a-1', ts: new Date().toISOString() },
      { skill: 'qa', duration_s: 60, outcome: 'success', session_id: 'a-2', ts: new Date().toISOString() },
      { skill: 'ship', duration_s: 30, outcome: 'error', error_class: 'timeout', session_id: 'a-3', ts: new Date().toISOString() },
    ]);

    const output = run(`bash "${BIN}/cavestack-analytics" all`);
    expect(output).toContain('/qa');
    expect(output).toContain('/ship');
    expect(output).toContain('2 runs');
    expect(output).toContain('1 runs');
    expect(output).toContain('Success rate: 66%');
    expect(output).toContain('Errors: 1');
  });

  test('filters by time window', () => {
    seedJsonl([
      { skill: 'qa', duration_s: 60, outcome: 'success', session_id: 't-1', ts: new Date().toISOString() },
    ]);

    const output7d = run(`bash "${BIN}/cavestack-analytics" 7d`);
    expect(output7d).toContain('/qa');
    expect(output7d).toContain('last 7 days');
  });
});

describe('preamble local analytics', () => {
  test('preamble writes JSONL unconditionally (no _TEL gate)', () => {
    const preamble = fs.readFileSync(path.join(ROOT, 'scripts', 'resolvers', 'preamble.ts'), 'utf-8');
    const lines = preamble.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('skill-usage.jsonl') && lines[i].includes('>>')) {
        // JSONL writes must NOT be inside a _TEL conditional
        let foundConditional = false;
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          if (lines[j].includes('_TEL') && lines[j].includes('off')) {
            foundConditional = true;
            break;
          }
        }
        if (foundConditional) {
          throw new Error(`JSONL write at preamble.ts line ${i + 1} is inside a _TEL conditional — should be unconditional`);
        }
      }
    }
  });

  test('proactive prompt gates on LAKE_INTRO, not TEL_PROMPTED', () => {
    const preamble = fs.readFileSync(path.join(ROOT, 'scripts', 'resolvers', 'preamble.ts'), 'utf-8');
    // generateProactivePrompt should NOT reference TEL_PROMPTED
    const proactiveStart = preamble.indexOf('function generateProactivePrompt');
    const proactiveEnd = preamble.indexOf('\n}', proactiveStart);
    const proactiveBody = preamble.slice(proactiveStart, proactiveEnd);
    expect(proactiveBody).not.toContain('TEL_PROMPTED');
    expect(proactiveBody).toContain('LAKE_INTRO');
  });
});
