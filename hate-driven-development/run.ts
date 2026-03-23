#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { rankMentions, type PublicMetrics } from './scoring.ts';

const SEARCH_ENDPOINT = 'https://api.x.com/2/tweets/search/recent';
const DEFAULT_QUERY = '(gstack OR "garrytan/gstack" OR "github.com/garrytan/gstack") lang:en -is:retweet -from:garrytan';
const DEFAULT_TOP = 10;
const DEFAULT_MAX_PAGES = 3;
const RECENT_SEARCH_WINDOW_HOURS = 24 * 7;

interface Args {
  all: boolean;
  hours?: number;
  top: number;
  maxPages: number;
  query: string;
  statePath: string;
  jsonPath?: string;
  markdownPath?: string;
}

interface StateFile {
  version: number;
  last_query?: string;
  newest_id?: string;
  last_run_at?: string;
  last_report_json?: string;
  last_report_markdown?: string;
}

interface XUser {
  id: string;
  username: string;
  name?: string;
}

interface XPost {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
  lang?: string;
  public_metrics?: PublicMetrics;
}

interface SearchResponse {
  data?: XPost[];
  includes?: {
    users?: XUser[];
  };
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
    result_count?: number;
  };
}

interface WindowPlan {
  mode: 'since_id' | 'start_time';
  detail: string;
  reason: string;
  sinceId?: string;
  startTime?: string;
}

function usage(): string {
  return [
    'Usage: bun hate-driven-development/run.ts [options]',
    '',
    'Options:',
    '  --all                  Ignore saved state and scan the recent-search window',
    '  --hours <n>            Scan an explicit recent window',
    '  --query <text>         Override the default X search query',
    '  --top <n>              Number of ranked posts to keep (default: 10)',
    '  --max-pages <n>        Pagination cap (default: 3)',
    '  --state <path>         State file path',
    '  --json <path>          JSON report output path',
    '  --markdown <path>      Markdown report output path',
  ].join('\n');
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function expandHome(inputPath: string): string {
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function parseNumber(raw: string | undefined, flag: string): number {
  if (!raw) fail(`${flag} requires a value`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${flag} must be a positive number`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    all: false,
    top: DEFAULT_TOP,
    maxPages: DEFAULT_MAX_PAGES,
    query: DEFAULT_QUERY,
    statePath: '~/.gstack/hate-driven-development/state.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
      case '--all':
        args.all = true;
        break;
      case '--hours':
        args.hours = parseNumber(argv[i + 1], '--hours');
        i += 1;
        break;
      case '--query':
        args.query = argv[i + 1] ?? fail('--query requires a value');
        i += 1;
        break;
      case '--top':
        args.top = parseNumber(argv[i + 1], '--top');
        i += 1;
        break;
      case '--max-pages':
        args.maxPages = parseNumber(argv[i + 1], '--max-pages');
        i += 1;
        break;
      case '--state':
        args.statePath = argv[i + 1] ?? fail('--state requires a value');
        i += 1;
        break;
      case '--json':
        args.jsonPath = argv[i + 1] ?? fail('--json requires a value');
        i += 1;
        break;
      case '--markdown':
        args.markdownPath = argv[i + 1] ?? fail('--markdown requires a value');
        i += 1;
        break;
      default:
        fail(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (args.all && args.hours !== undefined) {
    fail('Choose either --all or --hours, not both');
  }

  args.statePath = expandHome(args.statePath);
  if (args.jsonPath) args.jsonPath = expandHome(args.jsonPath);
  if (args.markdownPath) args.markdownPath = expandHome(args.markdownPath);
  return args;
}

async function readState(statePath: string): Promise<StateFile | null> {
  try {
    const content = await readFile(statePath, 'utf8');
    return JSON.parse(content) as StateFile;
  } catch {
    return null;
  }
}

function resolveToken(): string {
  const token =
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.X_BEARER_TOKEN;

  if (!token) {
    fail('Missing X API bearer token. Set X_API_BEARER_TOKEN, TWITTER_BEARER_TOKEN, or X_BEARER_TOKEN.');
  }

  return token;
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
}

function planWindow(args: Args, state: StateFile | null): WindowPlan {
  if (args.all) {
    return {
      mode: 'start_time',
      startTime: hoursAgoIso(RECENT_SEARCH_WINDOW_HOURS),
      detail: 'recent-search reset',
      reason: `explicit --all override (last ${RECENT_SEARCH_WINDOW_HOURS}h window)`,
    };
  }

  if (args.hours !== undefined) {
    return {
      mode: 'start_time',
      startTime: hoursAgoIso(args.hours),
      detail: `last ${args.hours}h`,
      reason: 'explicit --hours override',
    };
  }

  if (state?.last_query === args.query && state.newest_id) {
    return {
      mode: 'since_id',
      sinceId: state.newest_id,
      detail: `since_id ${state.newest_id}`,
      reason: `saved state from ${state.last_run_at ?? 'a previous run'}`,
    };
  }

  if (state?.last_query && state.last_query !== args.query) {
    return {
      mode: 'start_time',
      startTime: hoursAgoIso(RECENT_SEARCH_WINDOW_HOURS),
      detail: 'recent-search fallback',
      reason: 'saved state query did not match this run',
    };
  }

  return {
    mode: 'start_time',
    startTime: hoursAgoIso(RECENT_SEARCH_WINDOW_HOURS),
    detail: 'cold start fallback',
    reason: 'no prior matching state',
  };
}

function snippet(text: string, max = 220): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max - 3).trimEnd()}...`;
}

async function fetchSearchPage(
  token: string,
  args: Args,
  windowPlan: WindowPlan,
  nextToken?: string,
): Promise<SearchResponse> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('query', args.query);
  url.searchParams.set('max_results', '100');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('tweet.fields', 'author_id,created_at,lang,public_metrics');
  url.searchParams.set('user.fields', 'name,username');

  if (windowPlan.sinceId) url.searchParams.set('since_id', windowPlan.sinceId);
  if (windowPlan.startTime) url.searchParams.set('start_time', windowPlan.startTime);
  if (nextToken) url.searchParams.set('next_token', nextToken);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const reset = response.headers.get('x-rate-limit-reset');
    const body = await response.text();
    const rateLimitHint = reset ? ` Rate limit resets at unix ${reset}.` : '';
    fail(`X API request failed (${response.status}).${rateLimitHint}\n${body}`);
  }

  return response.json() as Promise<SearchResponse>;
}

function buildXUrl(username: string | undefined, postId: string): string {
  return username
    ? `https://x.com/${username}/status/${postId}`
    : `https://x.com/i/web/status/${postId}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = resolveToken();
  const state = await readState(args.statePath);
  const windowPlan = planWindow(args, state);

  const userById = new Map<string, XUser>();
  const posts = new Map<string, XPost>();
  let nextToken: string | undefined;
  let pageCount = 0;
  let newestId: string | undefined;
  let oldestId: string | undefined;

  do {
    const page = await fetchSearchPage(token, args, windowPlan, nextToken);
    pageCount += 1;

    if (!newestId && page.meta?.newest_id) newestId = page.meta.newest_id;
    if (page.meta?.oldest_id) oldestId = page.meta.oldest_id;

    for (const user of page.includes?.users ?? []) {
      userById.set(user.id, user);
    }

    for (const post of page.data ?? []) {
      posts.set(post.id, post);
    }

    nextToken = page.meta?.next_token;
  } while (nextToken && pageCount < args.maxPages);

  const ranked = rankMentions(
    [...posts.values()].map(post => ({
      ...post,
      author_username: userById.get(post.author_id)?.username,
      author_name: userById.get(post.author_id)?.name,
      url: buildXUrl(userById.get(post.author_id)?.username, post.id),
    })),
  );

  const top = ranked.slice(0, args.top);
  const actionable = top.filter(item => item.actionable);
  const emptyCalories = top.filter(item => !item.actionable);
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    query: args.query,
    window: windowPlan,
    fetched_posts: ranked.length,
    returned_posts: top.length,
    actionable_count: actionable.length,
    empty_calorie_count: emptyCalories.length,
    pages_fetched: pageCount,
    newest_id: newestId,
    oldest_id: oldestId,
    breakfast_board: top.map(item => ({
      id: item.id,
      url: (item as typeof item & { url?: string }).url,
      author_username: (item as typeof item & { author_username?: string }).author_username,
      author_name: (item as typeof item & { author_name?: string }).author_name,
      created_at: item.created_at,
      score: item.score,
      meal_tag: item.mealTag,
      actionable: item.actionable,
      actionable_signals: item.actionableSignals,
      engagement: item.engagement,
      reasons: item.reasons,
      text: item.text,
      public_metrics: item.public_metrics,
    })),
  };

  const markdownLines: string[] = [
    '# Hate-Driven Development',
    '',
    `Generated: ${generatedAt}`,
    `Query: ${args.query}`,
    `Window: ${windowPlan.detail} (${windowPlan.reason})`,
    `Pages fetched: ${pageCount}`,
    `Mentions scored: ${ranked.length}`,
    `Breakfast items kept: ${top.length}`,
    '',
  ];

  if (top.length === 0) {
    markdownLines.push('## No new breakfast');
    markdownLines.push('');
    markdownLines.push('Nothing new matched the current window.');
  } else {
    markdownLines.push("## Gary's breakfast board");
    markdownLines.push('');

    top.forEach((item, index) => {
      const authorUsername = (item as typeof item & { author_username?: string }).author_username ?? 'unknown';
      const url = (item as typeof item & { url?: string }).url ?? buildXUrl(undefined, item.id);
      markdownLines.push(`${index + 1}. @${authorUsername} — score ${item.score} — ${item.mealTag}`);
      markdownLines.push(`   ${url}`);
      markdownLines.push(`   "${snippet(item.text)}"`);
      markdownLines.push(`   Why it ranked: ${item.reasons.join(', ') || 'low-signal match'}`);
      if (item.actionableSignals.length > 0) {
        markdownLines.push(`   Actionable signals: ${item.actionableSignals.join(', ')}`);
      }
      markdownLines.push('');
    });

    markdownLines.push('## Actionable complaints');
    markdownLines.push('');
    if (actionable.length === 0) {
      markdownLines.push('- None. This run was mostly empty-calorie hate.');
    } else {
      for (const item of actionable) {
        const authorUsername = (item as typeof item & { author_username?: string }).author_username ?? 'unknown';
        const url = (item as typeof item & { url?: string }).url ?? buildXUrl(undefined, item.id);
        markdownLines.push(`- @${authorUsername} — ${item.actionableSignals.join(', ')} — ${url}`);
      }
    }
    markdownLines.push('');

    markdownLines.push('## Empty-calorie snark');
    markdownLines.push('');
    if (emptyCalories.length === 0) {
      markdownLines.push('- None. Everything sharp enough to rank was at least somewhat actionable.');
    } else {
      for (const item of emptyCalories) {
        const authorUsername = (item as typeof item & { author_username?: string }).author_username ?? 'unknown';
        markdownLines.push(`- @${authorUsername} — ${snippet(item.text, 120)}`);
      }
    }
  }

  markdownLines.push('');
  markdownLines.push('## State');
  markdownLines.push('');
  markdownLines.push(`- newest_id saved: ${newestId ?? state?.newest_id ?? 'none'}`);
  markdownLines.push(`- next default run: ${newestId ? `since_id ${newestId}` : 'cold-start fallback unless a future run finds matches'}`);

  const markdown = markdownLines.join('\n');

  if (args.jsonPath) {
    await mkdir(path.dirname(args.jsonPath), { recursive: true });
    await writeFile(args.jsonPath, JSON.stringify(report, null, 2));
  }

  if (args.markdownPath) {
    await mkdir(path.dirname(args.markdownPath), { recursive: true });
    await writeFile(args.markdownPath, markdown);
  }

  const nextState: StateFile = {
    version: 1,
    last_query: args.query,
    newest_id: newestId ?? state?.newest_id,
    last_run_at: generatedAt,
    last_report_json: args.jsonPath,
    last_report_markdown: args.markdownPath,
  };

  await mkdir(path.dirname(args.statePath), { recursive: true });
  await writeFile(args.statePath, JSON.stringify(nextState, null, 2));

  console.log(JSON.stringify({
    status: 'ok',
    fetched_posts: ranked.length,
    breakfast_items: top.length,
    actionable_count: actionable.length,
    empty_calorie_count: emptyCalories.length,
    window: windowPlan,
    newest_id: newestId ?? null,
    markdown_report: args.markdownPath ?? null,
    json_report: args.jsonPath ?? null,
  }, null, 2));
}

await main();
