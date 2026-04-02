#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvents, parseEventsFile, parseAgentEventsFile, parseAgentEvents } from './lib/parser.js';
import { generateFlowchart, generateGantt } from './lib/mermaid.js';
import { generateOrgChart } from './lib/org-gen.js';
import { createWatcher } from './lib/watcher.js';
import { SSEManager } from './lib/sse.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');

// Config
const DEFAULT_PORT = 3333;
const MAX_PORT = 3343;

// Resolve .crew directories
function findCrewDir(subdir) {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const target = join(dir, '.crew', 'artifacts', subdir);
    if (existsSync(target)) return target;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: create in cwd
  const fallback = join(process.cwd(), '.crew', 'artifacts', subdir);
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

// Find jojikdo.json
function findJojikdo() {
  const paths = [
    join(__dirname, '..', '..', 'references', 'jojikdo.json'),
    join(__dirname, 'references', 'jojikdo.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const portArg = args.indexOf('--port');
  let preferredPort = portArg >= 0 ? parseInt(args[portArg + 1]) : DEFAULT_PORT;

  const pipelineDir = findCrewDir('pipeline');
  const agentsDir = findCrewDir('agents');
  const sse = new SSEManager();
  const allEvents = [];

  // Watch both pipeline and agents directories
  const pipelineWatcher = await createWatcher(pipelineDir, '*-events.jsonl', (event, filePath) => {
    allEvents.push(event);
    sse.broadcast('pipeline_event', event);
  });

  const agentsWatcher = await createWatcher(agentsDir, '*.jsonl', (event, filePath) => {
    sse.broadcast('agent_event', event);
  });

  // MIME types
  const MIME = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Routes
    if (url.pathname === '/sse' || url.pathname === '/events') {
      return sse.connect(req, res, allEvents);
    }

    // ── Pipeline routes ──
    if (url.pathname === '/api/pipelines') {
      const pipelines = listPipelines(pipelineDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(pipelines));
    }

    if (url.pathname.startsWith('/api/events/')) {
      const slug = url.pathname.split('/').pop();
      const file = join(pipelineDir, `${slug}-events.jsonl`);
      if (existsSync(file)) {
        const pipeline = parseEventsFile(file);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(pipeline));
      }
      res.writeHead(404);
      return res.end('Not found');
    }

    if (url.pathname.startsWith('/api/mermaid/')) {
      const slug = url.pathname.split('/').pop();
      const file = join(pipelineDir, `${slug}-events.jsonl`);
      if (existsSync(file)) {
        const pipeline = parseEventsFile(file);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          flowchart: generateFlowchart(pipeline),
          gantt: generateGantt(pipeline),
        }));
      }
      res.writeHead(404);
      return res.end('Not found');
    }

    if (url.pathname === '/api/org') {
      const jojikdoPath = findJojikdo();
      if (jojikdoPath) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ mermaid: generateOrgChart(jojikdoPath) }));
      }
      res.writeHead(404);
      return res.end('jojikdo.json not found');
    }

    // ── Agent routes ──
    if (url.pathname === '/api/agents') {
      const date = url.searchParams.get('date'); // YYYY-MM-DD or 'all'
      const agentData = loadAgentData(agentsDir, date);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(agentData));
    }

    if (url.pathname === '/api/agents/dates') {
      const dates = listAgentDates(agentsDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(dates));
    }

    // Static files
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = join(PUBLIC_DIR, filePath);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  // Find available port
  const port = await findPort(preferredPort);
  server.listen(port, '127.0.0.1', () => {
    console.log(`
╔══════════════════════════════════════╗
║  bams-viz — Agent Execution Viewer   ║
╠══════════════════════════════════════╣
║  http://localhost:${port}               ║
║  Pipeline: ${pipelineDir.replace(process.env.HOME, '~')}
║  Agents:   ${agentsDir.replace(process.env.HOME, '~')}
║  Ctrl+C to stop                      ║
╚══════════════════════════════════════╝
`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[bams-viz] Shutting down...');
    sse.close();
    pipelineWatcher.close();
    agentsWatcher.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function listPipelines(dir) {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('-events.jsonl'))
      .map(f => {
        const slug = f.replace('-events.jsonl', '');
        try {
          const pipeline = parseEventsFile(join(dir, f));
          return { slug, type: pipeline.type, status: pipeline.status, startedAt: pipeline.startedAt };
        } catch {
          return { slug, type: 'unknown', status: 'unknown', startedAt: null };
        }
      })
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  } catch {
    return [];
  }
}

function listAgentDates(dir) {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function loadAgentData(dir, date) {
  try {
    if (!date || date === 'all') {
      // Load all agent files, concatenated
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().reverse();
      let content = '';
      for (const f of files.slice(0, 30)) { // max 30 days
        try { content += readFileSync(join(dir, f), 'utf-8') + '\n'; } catch {}
      }
      if (!content.trim()) return { calls: [], stats: [], collaborations: [], totalCalls: 0, totalErrors: 0, runningCount: 0 };
      return parseAgentEventsFile_fromContent(content);
    } else {
      const file = join(dir, `${date}.jsonl`);
      if (existsSync(file)) {
        return parseAgentEventsFile(file);
      }
      return { calls: [], stats: [], collaborations: [], totalCalls: 0, totalErrors: 0, runningCount: 0 };
    }
  } catch {
    return { calls: [], stats: [], collaborations: [], totalCalls: 0, totalErrors: 0, runningCount: 0 };
  }
}

function parseAgentEventsFile_fromContent(content) {
  return parseAgentEvents(content);
}

async function findPort(start) {
  const { createServer: cs } = await import('node:net');
  for (let port = start; port <= MAX_PORT; port++) {
    try {
      await new Promise((resolve, reject) => {
        const s = cs();
        s.once('error', reject);
        s.listen(port, '127.0.0.1', () => { s.close(resolve); });
      });
      return port;
    } catch { continue; }
  }
  throw new Error(`No available port in range ${start}-${MAX_PORT}`);
}

main().catch(console.error);
