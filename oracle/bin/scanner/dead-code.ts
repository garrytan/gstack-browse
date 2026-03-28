/**
 * scanner/dead-code.ts — Dead file detection
 *
 * Identifies files in the import graph that are unreachable from any entry point.
 */

import type { FileNode, DeadFile } from "./core";

const CONFIG_PATTERNS = [
  /^vite\.config/,
  /^vitest\.config/,
  /^tailwind\.config/,
  /^postcss\.config/,
  /^tsconfig/,
  /^jest\.config/,
  /^eslint/,
  /^prettier/,
  /^next\.config/,
  /^\.eslintrc/,
  /^babel\.config/,
  /^webpack\.config/,
];

function isConfigFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? "";
  return CONFIG_PATTERNS.some(p => p.test(basename));
}

function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("__tests__/")
  );
}

function isBarrelFile(filePath: string, node: FileNode): boolean {
  const basename = filePath.split("/").pop() ?? "";
  return (
    (basename === "index.ts" || basename === "index.tsx" || basename === "index.js") &&
    node.imports.length > 0
  );
}

export function findDeadFiles(
  graph: Record<string, FileNode>,
  reachable: Set<string>,
  _projectRoot?: string,
): DeadFile[] {
  const dead: DeadFile[] = [];

  for (const [file, node] of Object.entries(graph)) {
    if (reachable.has(file)) continue;

    // Exclude known non-dead patterns
    if (isConfigFile(file)) continue;
    if (isTestFile(file)) continue;
    if (isBarrelFile(file, node)) continue;

    dead.push({
      file,
      confidence: "high",
      lines: node.lines,
    });
  }

  return dead;
}
