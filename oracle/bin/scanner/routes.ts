/**
 * scanner/routes.ts — Framework detection and route discovery
 *
 * Detects the routing framework (React Router, Next.js App/Pages)
 * and discovers page routes, API endpoints, and workers.
 *
 * Discovery strategies (layered):
 *   1. Filesystem-based: scan pages/, app/ directories
 *   2. Router content parsing: createBrowserRouter, <Route> patterns
 *   3. Edge Functions: supabase/functions/ detection
 */

import * as fs from "fs";
import * as path from "path";
import { findFiles } from "./core";
import type { DiscoveredRoute } from "./core";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FrameworkDetectionResult {
  framework: "react-router" | "nextjs-pages" | "nextjs-app" | "unknown";
  routerContent?: string;
}

// ─── Framework Detection ────────────────────────────────────────────────────

function readPackageJson(projectRoot: string): Record<string, unknown> | null {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function hasDependency(pkg: Record<string, unknown>, name: string): boolean {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  return name in deps || name in devDeps;
}

function findRouterContent(projectRoot: string): string | undefined {
  const candidates = [
    "src/router.tsx", "src/router.ts",
    "src/routes.tsx", "src/routes.ts",
    "src/App.tsx", "src/App.ts",
    "app/router.tsx", "app/routes.tsx",
  ];
  for (const rel of candidates) {
    const full = path.join(projectRoot, rel);
    if (fs.existsSync(full)) {
      try {
        return fs.readFileSync(full, "utf-8");
      } catch {
        // Skip unreadable
      }
    }
  }
  return undefined;
}

export function detectFramework(projectRoot: string): FrameworkDetectionResult {
  const pkg = readPackageJson(projectRoot);
  if (!pkg) return { framework: "unknown" };

  // Next.js
  if (hasDependency(pkg, "next")) {
    const appDir = path.join(projectRoot, "app");
    if (fs.existsSync(appDir)) {
      return { framework: "nextjs-app" };
    }
    return { framework: "nextjs-pages" };
  }

  // React Router
  if (hasDependency(pkg, "react-router-dom") || hasDependency(pkg, "react-router")) {
    const routerContent = findRouterContent(projectRoot);
    return { framework: "react-router", routerContent };
  }

  return { framework: "unknown" };
}

// ─── Route Discovery ────────────────────────────────────────────────────────

function discoverNextAppRoutes(projectRoot: string): DiscoveredRoute[] {
  const appDir = path.join(projectRoot, "app");
  if (!fs.existsSync(appDir)) return [];

  const pageFiles = findFiles(appDir, /^(page|route)\.(tsx?|jsx?)$/);
  const routes: DiscoveredRoute[] = [];

  for (const fullPath of pageFiles) {
    const relFromApp = path.relative(appDir, fullPath);
    const dir = path.dirname(relFromApp);
    const basename = path.basename(fullPath);
    const isApi = basename.startsWith("route.");

    // Convert directory path to route path
    let routePath = "/" + dir.replace(/\\/g, "/");
    if (routePath === "/.") routePath = "/";
    // Strip route groups: (group)/page.tsx → /page
    routePath = routePath.replace(/\/\([^)]+\)/g, "");
    // Clean trailing slashes
    if (routePath !== "/" && routePath.endsWith("/")) {
      routePath = routePath.slice(0, -1);
    }

    const relPageFile = path.relative(projectRoot, fullPath);
    routes.push({
      routePath,
      type: isApi ? "api" : "page",
      pageFile: relPageFile,
    });
  }

  return routes;
}

function discoverNextPagesRoutes(projectRoot: string): DiscoveredRoute[] {
  const pagesDir = path.join(projectRoot, "pages");
  if (!fs.existsSync(pagesDir)) return [];

  const pageFiles = findFiles(pagesDir, /\.(tsx?|jsx?)$/);
  const routes: DiscoveredRoute[] = [];

  for (const fullPath of pageFiles) {
    const relFromPages = path.relative(pagesDir, fullPath);
    const isApi = relFromPages.startsWith("api/") || relFromPages.startsWith("api\\");

    // Convert file path to route path
    let routePath = "/" + relFromPages
      .replace(/\\/g, "/")
      .replace(/\.(tsx?|jsx?)$/, "")
      .replace(/\/index$/, "");
    if (routePath === "/") routePath = "/";

    const relPageFile = path.relative(projectRoot, fullPath);
    routes.push({
      routePath,
      type: isApi ? "api" : "page",
      pageFile: relPageFile,
    });
  }

  return routes;
}

function discoverReactRouterRoutes(
  projectRoot: string,
  routerContent?: string,
): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  // Strategy 1: Scan src/pages/ directory (convention-based)
  const pagesDir = path.join(projectRoot, "src", "pages");
  if (fs.existsSync(pagesDir)) {
    const pageFiles = findFiles(pagesDir, /\.(tsx?|jsx?)$/);
    for (const fullPath of pageFiles) {
      const relFromPages = path.relative(pagesDir, fullPath);
      const stem = relFromPages
        .replace(/\\/g, "/")
        .replace(/\.(tsx?|jsx?)$/, "");

      // Skip index files, map directly
      let routePath: string;
      if (stem.toLowerCase() === "index") {
        routePath = "/";
      } else {
        routePath = "/" + stem.toLowerCase();
      }

      const relPageFile = path.relative(projectRoot, fullPath);
      routes.push({ routePath, type: "page", pageFile: relPageFile });
    }
  }

  // Strategy 2: Parse router content for path definitions
  if (routerContent) {
    // Match createBrowserRouter path strings: path: "/dashboard"
    const pathRegex = /path:\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = pathRegex.exec(routerContent)) !== null) {
      const routePath = match[1];
      // Check if this route is already discovered via filesystem
      if (!routes.some(r => r.routePath === routePath)) {
        // Try to find the page file for this route
        const pageFile = findPageFileForRoute(routerContent, routePath, path.join(projectRoot, "src"));
        if (pageFile) {
          routes.push({
            routePath,
            type: "page",
            pageFile: path.relative(projectRoot, pageFile),
          });
        }
      }
    }

    // Match JSX Route patterns: <Route path="/about"
    const jsxRouteRegex = /<Route\s+[^>]*path=['"]([^'"]+)['"]/g;
    while ((match = jsxRouteRegex.exec(routerContent)) !== null) {
      const routePath = match[1];
      if (!routes.some(r => r.routePath === routePath)) {
        const pageFile = findPageFileForRoute(routerContent, routePath, path.join(projectRoot, "src"));
        if (pageFile) {
          routes.push({
            routePath,
            type: "page",
            pageFile: path.relative(projectRoot, pageFile),
          });
        }
      }
    }
  }

  return routes;
}

function discoverSupabaseEdgeFunctions(projectRoot: string): DiscoveredRoute[] {
  const functionsDir = path.join(projectRoot, "supabase", "functions");
  if (!fs.existsSync(functionsDir)) return [];

  const routes: DiscoveredRoute[] = [];
  try {
    const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const indexFile = path.join(functionsDir, entry.name, "index.ts");
      if (fs.existsSync(indexFile)) {
        routes.push({
          routePath: `/functions/${entry.name}`,
          type: "api",
          pageFile: path.relative(projectRoot, indexFile),
        });
      }
    }
  } catch {
    // Skip unreadable
  }

  return routes;
}

export function discoverRoutes(
  projectRoot: string,
  detection: FrameworkDetectionResult,
  _viteAliases?: Record<string, string>,
): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  switch (detection.framework) {
    case "nextjs-app":
      routes.push(...discoverNextAppRoutes(projectRoot));
      break;
    case "nextjs-pages":
      routes.push(...discoverNextPagesRoutes(projectRoot));
      break;
    case "react-router":
      routes.push(...discoverReactRouterRoutes(projectRoot, detection.routerContent));
      break;
    case "unknown":
      // Try all strategies
      routes.push(...discoverReactRouterRoutes(projectRoot));
      break;
  }

  // Always check for Supabase Edge Functions (framework-independent)
  routes.push(...discoverSupabaseEdgeFunctions(projectRoot));

  return routes;
}

// ─── Page File Resolution ───────────────────────────────────────────────────

/**
 * Find the page file for a given route path by searching the source directory.
 * Case-insensitive exact-stem match — no substring false positives.
 */
export function findPageFileForRoute(
  _routerContent: string,
  routePath: string,
  srcDir: string,
): string | null {
  // Strip leading slash and get the last segment as the filename to match
  const segment = routePath.replace(/^\//, "").split("/").pop() ?? "";
  if (!segment) return null;

  const segmentLower = segment.toLowerCase();

  // Search in pages/ subdirectory first, then src/ root
  const searchDirs = [
    path.join(srcDir, "pages"),
    srcDir,
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const stem = entry.replace(/\.(tsx?|jsx?)$/, "");
        if (stem.toLowerCase() === segmentLower && /\.(tsx?|jsx?)$/.test(entry)) {
          return path.join(dir, entry);
        }
      }
    } catch {
      // Skip unreadable
    }
  }

  return null;
}
