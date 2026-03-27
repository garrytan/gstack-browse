#!/usr/bin/env bun
/**
 * scan-imports.ts — CLI orchestrator for /oracle scan
 *
 * Thin entry point that coordinates the scanner modules:
 *   scanner/core.ts      — graph construction, unified traversal, classification
 *   scanner/routes.ts    — framework detection and route discovery
 *   scanner/aliases.ts   — Vite alias resolution
 *   scanner/dead-code.ts — dead file detection
 *   scanner/css.ts       — CSS/SCSS import tracking (stub)
 *   scanner/monorepo.ts  — workspace detection (stub)
 *   scanner/non-ts.ts    — non-TypeScript file discovery (stub)
 *
 * Usage:
 *   bun run ~/.claude/skills/gstack/oracle/bin/scan-imports.ts [options]
 *
 * Options:
 *   --project <path>    tsconfig.json path (default: tsconfig.json)
 *   --root <path>       Project root directory (default: .)
 *   --max-depth <n>     Max file discovery depth (default: 8)
 *   --mega-depth <n>    MEGA route trace depth cap (default: 4)
 *   --no-css            Disable CSS import tracking
 *   --no-monorepo       Disable monorepo auto-detection
 *   --no-eval           Disable runtime eval fallback (AST-only)
 *   --no-non-ts         Skip non-TypeScript file discovery
 *
 * Output: JSON scan manifest to stdout
 */

import * as path from "path";
import * as fs from "fs";

import {
  type ScanManifest,
  type RouteEntry,
  type ScanOptions,
  BASE_BUDGET,
  MEGA_TRACE_DEPTH_CAP,
  MAX_FILE_DISCOVERY_DEPTH,
  buildImportGraph,
  unifiedTraversal,
  findCircularDeps,
  classify,
  estimateSessions,
  getGitCoChangeComplexity,
  getGitBornDate,
  computeContentHash,
  findEntryPoints,
} from "./scanner/core";
import { detectFramework, discoverRoutes } from "./scanner/routes";
import { parseViteAliases } from "./scanner/aliases";
import { findDeadFiles } from "./scanner/dead-code";
import { buildCssGraph } from "./scanner/css";
import { detectMonorepo } from "./scanner/monorepo";
import { discoverNonTsFiles } from "./scanner/non-ts";

// ─── CLI Args ───────────────────────────────────────────────────────────────
function parseArgs(): ScanOptions {
  const args = process.argv.slice(2);
  let tsconfigPath = "tsconfig.json";
  let projectRoot = ".";
  let maxDepth = MAX_FILE_DISCOVERY_DEPTH;
  let megaDepthCap = MEGA_TRACE_DEPTH_CAP;
  let noCss = false;
  let noMonorepo = false;
  let noEval = false;
  let noNonTs = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--project":
        tsconfigPath = args[++i];
        break;
      case "--root":
        projectRoot = args[++i];
        break;
      case "--max-depth":
        maxDepth = parseInt(args[++i], 10);
        break;
      case "--mega-depth":
        megaDepthCap = parseInt(args[++i], 10);
        break;
      case "--no-css":
        noCss = true;
        break;
      case "--no-monorepo":
        noMonorepo = true;
        break;
      case "--no-eval":
        noEval = true;
        break;
      case "--no-non-ts":
        noNonTs = true;
        break;
    }
  }

  projectRoot = path.resolve(projectRoot);
  tsconfigPath = path.resolve(projectRoot, tsconfigPath);

  return { tsconfigPath, projectRoot, maxDepth, megaDepthCap, noCss, noMonorepo, noEval, noNonTs };
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main(): void {
  const options = parseArgs();
  const { projectRoot, tsconfigPath } = options;

  // Validate prerequisites
  if (!fs.existsSync(tsconfigPath)) {
    console.error(
      `Warning: No tsconfig.json found at ${tsconfigPath} — import aliases won't be resolved.`
    );
  }

  const projectName = path.basename(projectRoot);

  // Detect framework (single pass — returns router content for reuse)
  const detection = detectFramework(projectRoot);

  // Parse Vite aliases
  const viteAliases = parseViteAliases(projectRoot);

  // Build import graph
  const { graph, skippedFiles } = buildImportGraph(
    projectRoot,
    tsconfigPath,
    viteAliases
  );

  // Merge CSS graph if enabled
  if (!options.noCss) {
    const cssGraph = buildCssGraph(projectRoot, graph);
    Object.assign(graph, cssGraph);
  }

  // Discover routes
  const discoveredRoutes = discoverRoutes(projectRoot, detection, viteAliases);

  // Build route map for unified traversal
  const routeRoots = new Map<string, string>();
  for (const dr of discoveredRoutes) {
    const routePath = dr.routePath.startsWith("/") ? dr.routePath : `/${dr.routePath}`;
    if (graph[dr.pageFile]) {
      routeRoots.set(routePath, dr.pageFile);
    }
  }

  // Find entry points
  const entryPoints = findEntryPoints(graph);

  // Unified traversal — single O(N+E) pass replaces buildBranch + findDeadFiles BFS
  const traversal = unifiedTraversal(graph, routeRoots, entryPoints, options.megaDepthCap);

  // Git co-change complexity for classification (language-agnostic, no AST)
  const pageFiles = discoveredRoutes.map(dr => dr.pageFile);
  const complexity = getGitCoChangeComplexity(projectRoot, pageFiles);
  const bornDates = getGitBornDate(projectRoot, pageFiles);

  // Build route entries from git co-change results
  const routes: RouteEntry[] = [];
  for (const dr of discoveredRoutes) {
    const routePath = dr.routePath.startsWith("/") ? dr.routePath : `/${dr.routePath}`;
    const cx = complexity.get(dr.pageFile) ?? { lines: 0, files: 0, coChangedFiles: [] };
    const classification = cx.lines > 0 ? classify(cx.lines) : "unknown" as const;

    routes.push({
      path: routePath,
      type: dr.type,
      page_file: dr.pageFile,
      branch_lines: cx.lines,
      branch_files: cx.files,
      classification,
      session_slots: Math.round((cx.lines / BASE_BUDGET) * 100) / 100,
      status: "not_started",
      born_date: bornDates.get(dr.pageFile) ?? 0,
      co_changed_files: cx.coChangedFiles,
    });
  }

  // Sort by born_date (chronological) — foundation first, newest last
  routes.sort((a, b) => (a.born_date ?? 0) - (b.born_date ?? 0));

  // Circular dependency detection
  const circularDeps = findCircularDeps(graph);

  // Dead code detection (uses reachable set from unified traversal)
  const deadFiles = findDeadFiles(graph, traversal.reachable, projectRoot);

  // Non-TypeScript file discovery
  const nonTsFiles = !options.noNonTs ? discoverNonTsFiles(projectRoot) : [];

  // Monorepo detection
  const monorepo = !options.noMonorepo ? detectMonorepo(projectRoot) : undefined;

  // Collect unresolved imports
  const allUnresolved: ScanManifest["unresolved_imports"] = [];
  for (const [file, node] of Object.entries(graph)) {
    for (const u of node.unresolved_imports) {
      allUnresolved.push({ file, import: u.specifier, reason: u.reason });
    }
  }

  // Calculate totals
  let totalLines = 0;
  for (const node of Object.values(graph)) {
    totalLines += node.lines;
  }

  // Build manifest
  const manifest: ScanManifest = {
    schema_version: 1,
    scanned_at: new Date().toISOString(),
    project: projectName,
    total_files: Object.keys(graph).length,
    total_lines: totalLines,
    routes,
    circular_deps: circularDeps,
    dead_files: deadFiles.filter((d) => d.confidence === "high"),
    unresolved_imports: allUnresolved,
    skipped_files: skippedFiles,
    non_ts_files: nonTsFiles,
    import_graph: graph,
    estimated_sessions: estimateSessions(routes),
    content_hash: computeContentHash(graph),
    monorepo: monorepo ? {
      detected: monorepo.detected,
      type: monorepo.type,
      packages: monorepo.packages,
    } : undefined,
  };

  // Output to stdout
  console.log(JSON.stringify(manifest, null, 2));
}

main();
