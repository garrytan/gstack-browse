/**
 * scanner/aliases.ts — Vite alias resolution
 *
 * Parses vite.config.ts to extract path aliases using AST analysis,
 * with a stripped-eval fallback for configs that use runtime expressions.
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

export interface AliasResult {
  aliases: Record<string, string>;
  method: "ast" | "eval";
}

function findViteConfig(projectRoot: string): string | null {
  for (const name of ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"]) {
    const p = path.join(projectRoot, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Resolve a value expression to a string path.
 * Handles: string literals, path.resolve(__dirname, "..."), template literals.
 */
function resolveValueExpr(node: ts.Node, projectRoot: string): string | null {
  // String literal: "@": "./src"
  if (ts.isStringLiteral(node)) {
    return path.resolve(projectRoot, node.text);
  }

  // path.resolve(__dirname, "src") or path.resolve(__dirname, "./src")
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "resolve"
  ) {
    const args = node.arguments;
    if (args.length >= 2) {
      // Check if first arg is __dirname
      const firstArg = args[0];
      if (ts.isIdentifier(firstArg) && firstArg.text === "__dirname") {
        // Collect remaining string args
        const parts: string[] = [projectRoot];
        for (let i = 1; i < args.length; i++) {
          if (ts.isStringLiteral(args[i])) {
            parts.push((args[i] as ts.StringLiteral).text);
          } else {
            return null; // Non-string arg, can't resolve statically
          }
        }
        return path.resolve(...parts);
      }
    }
  }

  return null;
}

function parseAliasesFromAST(content: string, projectRoot: string): Record<string, string> | null {
  const sourceFile = ts.createSourceFile("vite.config.ts", content, ts.ScriptTarget.Latest, true);
  const aliases: Record<string, string> = {};
  let found = false;

  function visit(node: ts.Node): void {
    // Look for: alias: { ... }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "alias" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (ts.isPropertyAssignment(prop)) {
          let key: string | null = null;
          if (ts.isIdentifier(prop.name)) key = prop.name.text;
          else if (ts.isStringLiteral(prop.name)) key = prop.name.text;

          if (key) {
            const value = resolveValueExpr(prop.initializer, projectRoot);
            if (value) {
              aliases[key] = value;
              found = true;
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found ? aliases : null;
}

function parseAliasesFromEval(content: string, projectRoot: string): Record<string, string> | null {
  try {
    // Strip import/export statements and TypeScript-specific syntax
    let stripped = content
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+default\s+/gm, "const __config__ = ")
      .replace(/defineConfig\s*\(/g, "(");

    // Provide __dirname and path.resolve
    const __dirname = projectRoot;
    const pathResolve = (...args: string[]) => path.resolve(...args);

    const fn = new Function(
      "__dirname",
      "path",
      `${stripped}; return typeof __config__ !== 'undefined' ? __config__ : undefined;`,
    );

    const config = fn(__dirname, { resolve: pathResolve, join: path.join });
    if (config?.resolve?.alias && typeof config.resolve.alias === "object") {
      const aliases: Record<string, string> = {};
      for (const [key, value] of Object.entries(config.resolve.alias)) {
        if (typeof value === "string") {
          aliases[key] = path.resolve(projectRoot, value);
        }
      }
      return Object.keys(aliases).length > 0 ? aliases : null;
    }
  } catch {
    // Eval failed — expected for complex configs
  }
  return null;
}

export function parseViteAliasesDetailed(
  projectRoot: string,
  noEval = false,
): AliasResult {
  const configPath = findViteConfig(projectRoot);
  if (!configPath) return { aliases: {}, method: "ast" };

  const content = fs.readFileSync(configPath, "utf-8");

  // Try AST first
  const astResult = parseAliasesFromAST(content, projectRoot);
  if (astResult) return { aliases: astResult, method: "ast" };

  // Eval fallback (if allowed)
  if (!noEval) {
    const evalResult = parseAliasesFromEval(content, projectRoot);
    if (evalResult) return { aliases: evalResult, method: "eval" };
  }

  return { aliases: {}, method: "ast" };
}

export function parseViteAliases(projectRoot: string): Record<string, string> {
  return parseViteAliasesDetailed(projectRoot, false).aliases;
}
