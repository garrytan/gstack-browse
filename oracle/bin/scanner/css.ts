/**
 * scanner/css.ts — CSS/SCSS import tracking
 *
 * Discovers .css and .scss files, parses @import and @use directives,
 * and returns FileNode entries for the unified graph.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { findFiles } from "./core";
import type { FileNode } from "./core";

const IMPORT_REGEX = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]\s*\)?/g;
const USE_REGEX = /@use\s+['"]([^'"]+)['"]/g;

function resolveImportPath(importStr: string, fromFile: string, projectRoot: string): string {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importStr);
  // Return relative to project root
  return path.relative(projectRoot, resolved);
}

export function buildCssGraph(
  projectRoot: string,
  _existingGraph: Record<string, FileNode>,
): Record<string, FileNode> {
  const cssFiles = findFiles(projectRoot, /\.(css|scss|sass|less)$/);
  const graph: Record<string, FileNode> = {};

  for (const fullPath of cssFiles) {
    const relPath = path.relative(projectRoot, fullPath);

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n").length;
      const contentHash = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex")
        .substring(0, 12);

      const imports: string[] = [];

      // Parse @import directives
      let match: RegExpExecArray | null;
      IMPORT_REGEX.lastIndex = 0;
      while ((match = IMPORT_REGEX.exec(content)) !== null) {
        imports.push(resolveImportPath(match[1], fullPath, projectRoot));
      }

      // Parse @use directives (SCSS)
      USE_REGEX.lastIndex = 0;
      while ((match = USE_REGEX.exec(content)) !== null) {
        imports.push(resolveImportPath(match[1], fullPath, projectRoot));
      }

      graph[relPath] = {
        lines,
        content_hash: contentHash,
        imports,
        unresolved_imports: [],
        is_css: true,
      };
    } catch {
      // Skip unreadable files
    }
  }

  return graph;
}
