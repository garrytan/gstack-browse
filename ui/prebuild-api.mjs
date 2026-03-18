#!/usr/bin/env node
// Pre-renders gstack API data as static JSON files for Vercel deployment.
// Reads directly from the gstack repo and generates /public/api/*.json files.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';

const UI_DIR = dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = resolve(UI_DIR, '..');
const OUT = join(UI_DIR, 'public', 'api');

mkdirSync(join(OUT, 'qa'), { recursive: true });
mkdirSync(join(OUT, 'evals'), { recursive: true });
mkdirSync(join(OUT, 'browse'), { recursive: true });

// --- Version ---
let version = 'unknown';
try { version = readFileSync(join(REPO_ROOT, 'VERSION'), 'utf-8').trim(); } catch {}

// --- Git branch ---
let branch = 'main';
try { branch = execSync('git branch --show-current', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim() || 'main'; } catch {}

// --- Skills ---
const SKILL_DIRS = [
  'browse', 'qa', 'qa-only', 'qa-design-review',
  'ship', 'review', 'retro',
  'plan-ceo-review', 'plan-eng-review', 'plan-design-review',
  'setup-browser-cookies', 'gstack-upgrade', 'document-release',
  'design-consultation',
];

function analyzeSkill(name, filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const cmdCount = (content.match(/\$B\s+\S/g) || []).length;
  const hasTmpl = existsSync(filePath + '.tmpl');
  return {
    name,
    path: name === 'gstack' ? 'SKILL.md' : `${name}/SKILL.md`,
    hasTemplate: hasTmpl,
    commandCount: cmdCount,
    invalidCount: 0,
    status: 'ok',
  };
}

const skills = [];
const rootSkill = join(REPO_ROOT, 'SKILL.md');
if (existsSync(rootSkill)) skills.push(analyzeSkill('gstack', rootSkill));
for (const dir of SKILL_DIRS) {
  const p = join(REPO_ROOT, dir, 'SKILL.md');
  if (existsSync(p)) skills.push(analyzeSkill(dir, p));
}

writeFileSync(join(OUT, 'skills.json'), JSON.stringify(skills));
writeFileSync(join(OUT, 'system.json'), JSON.stringify({
  version, projectDir: REPO_ROOT, branch, browseServer: null, sessions: 0, skills,
}));

// --- QA Reports ---
const qaDir = join(REPO_ROOT, '.gstack', 'qa-reports');
const qaReports = [];
if (existsSync(qaDir)) {
  for (const f of readdirSync(qaDir).sort().reverse()) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    const content = readFileSync(join(qaDir, f), 'utf-8');
    const extract = (field) => {
      const m = content.match(new RegExp(`\\*\\*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*\\s*\\|\\s*(.+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const scoreM = content.match(/Health Score:\s*(\d+)/);
    const issues = (content.match(/### ISSUE-\d+/g) || []).length;
    let pv = 0;
    try { pv = parseInt(extract('Pages visited') || '0', 10); } catch {}
    qaReports.push({
      file: f, date: extract('Date'), url: extract('URL'),
      branch: extract('Branch'), tier: extract('Tier'),
      healthScore: scoreM ? parseInt(scoreM[1], 10) : 0,
      issueCount: issues, pagesVisited: pv,
      duration: extract('Duration'), framework: extract('Framework') || 'Unknown',
    });
  }
}
writeFileSync(join(OUT, 'qa', 'reports.json'), JSON.stringify(qaReports));

// --- Evals ---
const evalDir = join(REPO_ROOT, '.gstack-dev', 'evals');
const evalRuns = [];
if (existsSync(evalDir)) {
  for (const f of readdirSync(evalDir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    try {
      const data = JSON.parse(readFileSync(join(evalDir, f), 'utf-8'));
      const tests = (data.tests || []).map(t => {
        const e = { name: t.name || '', passed: !!t.passed, cost_usd: +(t.cost_usd || 0), duration_ms: +(t.duration_ms || 0) };
        if ('turns_used' in t) e.turns_used = +t.turns_used;
        if ('exit_reason' in t) e.exit_reason = String(t.exit_reason);
        if ('detection_rate' in t) e.detection_rate = +t.detection_rate;
        return e;
      });
      evalRuns.push({
        file: f, timestamp: data.timestamp || '', branch: data.branch || 'unknown',
        tier: data.tier || 'unknown', version: data.version || '?',
        passed: data.passed || 0, total: data.total_tests || 0,
        cost: data.total_cost_usd || 0, duration: data.total_duration_ms || 0,
        turns: tests.reduce((s, t) => s + (t.turns_used || 0), 0), tests,
      });
    } catch {}
  }
}
evalRuns.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

// Summary
const e2e = evalRuns.filter(r => r.tier === 'e2e');
const judge = evalRuns.filter(r => r.tier === 'llm-judge');
const totalCost = evalRuns.reduce((s, r) => s + r.cost, 0);
const detRates = [];
for (const r of e2e) for (const t of r.tests) if ('detection_rate' in t) detRates.push(t.detection_rate);
const testResults = {};
for (const r of evalRuns) for (const t of r.tests) {
  const k = `${r.tier}:${t.name}`;
  (testResults[k] = testResults[k] || []).push(t.passed);
}
const flaky = Object.entries(testResults).filter(([, o]) => o.length >= 2 && o.some(Boolean) && !o.every(Boolean)).map(([n]) => n);

writeFileSync(join(OUT, 'evals', 'runs.json'), JSON.stringify(evalRuns));
writeFileSync(join(OUT, 'evals', 'summary.json'), JSON.stringify({
  totalRuns: evalRuns.length, e2eRuns: e2e.length, judgeRuns: judge.length,
  totalCost, avgE2ECost: e2e.length ? e2e.reduce((s, r) => s + r.cost, 0) / e2e.length : 0,
  avgJudgeCost: judge.length ? judge.reduce((s, r) => s + r.cost, 0) / judge.length : 0,
  avgE2EDuration: e2e.length ? e2e.reduce((s, r) => s + r.duration, 0) / e2e.length : 0,
  avgDetection: detRates.length ? detRates.reduce((s, r) => s + r, 0) / detRates.length : null,
  flakyTests: flaky,
}));

// --- Browse ---
writeFileSync(join(OUT, 'browse', 'status.json'), 'null');

console.log(`Pre-built API data: ${skills.length} skills, ${qaReports.length} QA reports, ${evalRuns.length} eval runs`);
