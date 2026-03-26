/**
 * Snapshot command — accessibility tree with ref-based element selection
 *
 * Architecture (Locator map — no DOM mutation):
 *   1. page.locator(scope).ariaSnapshot() → YAML-like accessibility tree
 *   2. Parse tree, assign refs @e1, @e2, ...
 *   3. Build Playwright Locator for each ref (getByRole + nth)
 *   4. Store Map<string, Locator> on BrowserManager
 *   5. Return compact text output with refs prepended
 *
 * Flutter Web support:
 *   Flutter renders to <canvas> — standard ariaSnapshot() returns empty.
 *   When detected, we enable Flutter's Semantics tree (flt-semantics-placeholder)
 *   and scan flt-semantics elements inside <flutter-view> for ARIA roles/labels.
 *
 * Extended features:
 *   --diff / -D:       Compare against last snapshot, return unified diff
 *   --annotate / -a:   Screenshot with overlay boxes at each @ref
 *   --output / -o:     Output path for annotated screenshot
 *   -C / --cursor-interactive: Scan for cursor:pointer/onclick/tabindex elements
 *
 * Later: "click @e3" → look up Locator → locator.click()
 */

import type { Page, Locator } from 'playwright';
import type { BrowserManager, RefEntry } from './browser-manager';
import * as Diff from 'diff';
import { TEMP_DIR, isPathWithin } from './platform';

// Roles considered "interactive" for the -i flag
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
  'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab',
  'treeitem',
]);

interface SnapshotOptions {
  interactive?: boolean;       // -i: only interactive elements
  compact?: boolean;           // -c: remove empty structural elements
  depth?: number;              // -d N: limit tree depth
  selector?: string;           // -s SEL: scope to CSS selector
  diff?: boolean;              // -D / --diff: diff against last snapshot
  annotate?: boolean;          // -a / --annotate: annotated screenshot
  outputPath?: string;         // -o / --output: path for annotated screenshot
  cursorInteractive?: boolean; // -C / --cursor-interactive: scan cursor:pointer etc.
}

/**
 * Snapshot flag metadata — single source of truth for CLI parsing and doc generation.
 *
 * Imported by:
 *   - gen-skill-docs.ts (generates {{SNAPSHOT_FLAGS}} tables)
 *   - skill-parser.ts (validates flags in SKILL.md examples)
 */
export const SNAPSHOT_FLAGS: Array<{
  short: string;
  long: string;
  description: string;
  takesValue?: boolean;
  valueHint?: string;
  optionKey: keyof SnapshotOptions;
}> = [
  { short: '-i', long: '--interactive', description: 'Interactive elements only (buttons, links, inputs) with @e refs', optionKey: 'interactive' },
  { short: '-c', long: '--compact', description: 'Compact (no empty structural nodes)', optionKey: 'compact' },
  { short: '-d', long: '--depth', description: 'Limit tree depth (0 = root only, default: unlimited)', takesValue: true, valueHint: '<N>', optionKey: 'depth' },
  { short: '-s', long: '--selector', description: 'Scope to CSS selector', takesValue: true, valueHint: '<sel>', optionKey: 'selector' },
  { short: '-D', long: '--diff', description: 'Unified diff against previous snapshot (first call stores baseline)', optionKey: 'diff' },
  { short: '-a', long: '--annotate', description: 'Annotated screenshot with red overlay boxes and ref labels', optionKey: 'annotate' },
  { short: '-o', long: '--output', description: 'Output path for annotated screenshot (default: <temp>/browse-annotated.png)', takesValue: true, valueHint: '<path>', optionKey: 'outputPath' },
  { short: '-C', long: '--cursor-interactive', description: 'Cursor-interactive elements (@c refs — divs with pointer, onclick)', optionKey: 'cursorInteractive' },
];

interface ParsedNode {
  indent: number;
  role: string;
  name: string | null;
  props: string;      // e.g., "[level=1]"
  children: string;   // inline text content after ":"
  rawLine: string;
}

/**
 * Parse CLI args into SnapshotOptions — driven by SNAPSHOT_FLAGS metadata.
 */
export function parseSnapshotArgs(args: string[]): SnapshotOptions {
  const opts: SnapshotOptions = {};
  for (let i = 0; i < args.length; i++) {
    const flag = SNAPSHOT_FLAGS.find(f => f.short === args[i] || f.long === args[i]);
    if (!flag) throw new Error(`Unknown snapshot flag: ${args[i]}`);
    if (flag.takesValue) {
      const value = args[++i];
      if (!value) throw new Error(`Usage: snapshot ${flag.short} <value>`);
      if (flag.optionKey === 'depth') {
        (opts as any)[flag.optionKey] = parseInt(value, 10);
        if (isNaN(opts.depth!)) throw new Error('Usage: snapshot -d <number>');
      } else {
        (opts as any)[flag.optionKey] = value;
      }
    } else {
      (opts as any)[flag.optionKey] = true;
    }
  }
  return opts;
}

/**
 * Parse one line of ariaSnapshot output.
 *
 * Format examples:
 *   - heading "Test" [level=1]
 *   - link "Link A":
 *     - /url: /a
 *   - textbox "Name"
 *   - paragraph: Some text
 *   - combobox "Role":
 */
function parseLine(line: string): ParsedNode | null {
  // Match: (indent)(- )(role)( "name")?( [props])?(: inline)?
  const match = line.match(/^(\s*)-\s+(\w+)(?:\s+"([^"]*)")?(?:\s+(\[.*?\]))?\s*(?::\s*(.*))?$/);
  if (!match) {
    // Skip metadata lines like "- /url: /a"
    return null;
  }
  return {
    indent: match[1].length,
    role: match[2],
    name: match[3] ?? null,
    props: match[4] || '',
    children: match[5]?.trim() || '',
    rawLine: line,
  };
}

// ─── Flutter Web Support ──────────────────────────────────

interface FlutterSemanticNode {
  id: string;
  role: string;
  name: string;
  tagName: string;
  selector: string;
  depth: number;
}

/**
 * Detect whether the current page is a Flutter Web application.
 * Checks for Flutter-specific elements: flutter-view, flt-glass-pane, $isFlutterApp.
 */
export async function isFlutterWeb(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return !!(
      (window as any).$isFlutterApp ||
      document.querySelector('flutter-view') ||
      document.querySelector('flt-glass-pane')
    );
  });
}

/**
 * Enable Flutter's Semantics tree by activating the flt-semantics-placeholder.
 *
 * Flutter hides the placeholder off-screen (-1px, -1px, 1x1px). We temporarily
 * reposition it into the viewport so Playwright can click it, which triggers
 * Flutter's SemanticsBinding to populate <flt-semantics-host> with ARIA elements.
 */
async function enableFlutterSemantics(page: Page): Promise<boolean> {
  // Check if semantics are already enabled (flt-semantics-host has children)
  const alreadyEnabled = await page.evaluate(() => {
    const fv = document.querySelector('flutter-view');
    if (!fv) return false;
    const host = fv.querySelector('flt-semantics-host');
    return host ? host.children.length > 0 : false;
  });
  if (alreadyEnabled) return true;

  // Check for the placeholder
  const hasPlaceholder = await page.evaluate(() => {
    return !!document.querySelector('flt-semantics-placeholder');
  });
  if (!hasPlaceholder) return false;

  // Reposition placeholder into viewport so Playwright can click it
  await page.evaluate(() => {
    const p = document.querySelector('flt-semantics-placeholder') as HTMLElement;
    if (!p) return;
    p.style.left = '0px';
    p.style.top = '0px';
    p.style.width = '50px';
    p.style.height = '50px';
    p.style.zIndex = '99999';
  });

  try {
    await page.click('flt-semantics-placeholder', { timeout: 3000 });
  } catch {
    return false;
  }

  // Wait briefly for Flutter to populate the semantics tree
  await page.waitForTimeout(500);

  // Verify semantics are now populated
  return page.evaluate(() => {
    const fv = document.querySelector('flutter-view');
    if (!fv) return false;
    const host = fv.querySelector('flt-semantics-host');
    return host ? host.children.length > 0 : false;
  });
}

/**
 * Scan Flutter's flt-semantics elements and build a list of semantic nodes
 * with their ARIA roles, labels, and CSS selectors for Playwright locators.
 */
async function scanFlutterSemantics(page: Page): Promise<FlutterSemanticNode[]> {
  return page.evaluate(() => {
    const fv = document.querySelector('flutter-view');
    if (!fv) return [];

    const host = fv.querySelector('flt-semantics-host');
    if (!host || host.children.length === 0) return [];

    const results: Array<{
      id: string;
      role: string;
      name: string;
      tagName: string;
      selector: string;
      depth: number;
    }> = [];

    function walk(el: Element, depth: number) {
      const tag = el.tagName.toLowerCase();

      // Process flt-semantics elements and standard elements inside them
      if (tag === 'flt-semantics' || el.closest('flt-semantics-host')) {
        const role = el.getAttribute('role') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const textContent = (el.textContent || '').trim().substring(0, 200);
        const elTag = el.tagName;
        const id = el.getAttribute('id') || '';

        // Determine the effective role based on element type and attributes
        let effectiveRole = role;
        if (!effectiveRole) {
          if (elTag === 'H1' || elTag === 'H2' || elTag === 'H3' ||
              elTag === 'H4' || elTag === 'H5' || elTag === 'H6') {
            effectiveRole = 'heading';
          } else if (elTag === 'INPUT') {
            const type = (el as HTMLInputElement).type || 'text';
            if (type === 'checkbox') effectiveRole = 'checkbox';
            else if (type === 'radio') effectiveRole = 'radio';
            else if (type === 'range') effectiveRole = 'slider';
            else effectiveRole = 'textbox';
          } else if (elTag === 'TEXTAREA') {
            effectiveRole = 'textbox';
          } else if (elTag === 'SPAN' && textContent) {
            effectiveRole = 'text';
          }
        }

        // Build a deterministic CSS selector
        let selector = '';
        if (id) {
          selector = `#${id}`;
        } else if (effectiveRole && ariaLabel) {
          selector = `${tag}[role="${effectiveRole}"][aria-label="${ariaLabel}"]`;
        } else if (effectiveRole === 'textbox' && elTag === 'INPUT') {
          // For inputs, use aria-label or the tag within flt-semantics-host
          selector = ariaLabel
            ? `flutter-view flt-semantics-host input[aria-label="${ariaLabel}"]`
            : 'flutter-view flt-semantics-host input';
        }

        // Only include meaningful nodes (have role, label, or text)
        const name = ariaLabel || textContent;
        if (effectiveRole && (name || effectiveRole === 'textbox') && selector) {
          results.push({
            id,
            role: effectiveRole,
            name: name || '',
            tagName: elTag,
            selector,
            depth,
          });
        }
      }

      for (const child of el.children) {
        walk(child, depth + 1);
      }
    }

    walk(host, 0);
    return results;
  });
}

/**
 * Build an ariaSnapshot-compatible YAML string from Flutter semantic nodes.
 * This allows the existing parsing logic to process Flutter elements.
 */
function flutterNodesToAriaYaml(nodes: FlutterSemanticNode[]): string {
  return nodes.map(n => {
    const indent = '  '.repeat(Math.min(n.depth, 4));
    const name = n.name ? ` "${n.name}"` : '';
    return `${indent}- ${n.role}${name}`;
  }).join('\n');
}

/**
 * Take an accessibility snapshot and build the ref map.
 */
export async function handleSnapshot(
  args: string[],
  bm: BrowserManager
): Promise<string> {
  const opts = parseSnapshotArgs(args);
  const page = bm.getPage();

  // Get accessibility tree via ariaSnapshot
  let rootLocator: Locator;
  if (opts.selector) {
    rootLocator = page.locator(opts.selector);
    const count = await rootLocator.count();
    if (count === 0) throw new Error(`Selector not found: ${opts.selector}`);
  } else {
    rootLocator = page.locator('body');
  }

  let ariaText = await rootLocator.ariaSnapshot();

  // ─── Flutter Web Fallback ──────────────────────────────────
  // Flutter renders to <canvas> — ariaSnapshot() returns empty.
  // Detect Flutter, enable Semantics, and scan flt-semantics elements.
  let isFlutter = false;
  let flutterNodes: FlutterSemanticNode[] = [];

  if (!ariaText || ariaText.trim().length === 0) {
    if (await isFlutterWeb(page)) {
      isFlutter = true;
      const enabled = await enableFlutterSemantics(page);
      if (enabled) {
        flutterNodes = await scanFlutterSemantics(page);
        if (flutterNodes.length > 0) {
          ariaText = flutterNodesToAriaYaml(flutterNodes);
        }
      }
    }
  }

  if (!ariaText || ariaText.trim().length === 0) {
    bm.setRefMap(new Map());
    return '(no accessible elements found)';
  }

  // Parse the ariaSnapshot output
  const lines = ariaText.split('\n');
  const refMap = new Map<string, RefEntry>();
  const output: string[] = [];
  let refCounter = 1;

  // For Flutter, we track nodes by index to build CSS-selector locators
  let flutterNodeIndex = 0;

  // Track role+name occurrences for nth() disambiguation
  const roleNameCounts = new Map<string, number>();
  const roleNameSeen = new Map<string, number>();

  // First pass: count role+name pairs for disambiguation
  for (const line of lines) {
    const node = parseLine(line);
    if (!node) continue;
    const key = `${node.role}:${node.name || ''}`;
    roleNameCounts.set(key, (roleNameCounts.get(key) || 0) + 1);
  }

  // Second pass: assign refs and build locators
  for (const line of lines) {
    const node = parseLine(line);
    if (!node) continue;

    const depth = Math.floor(node.indent / 2);
    // For Flutter, "text" role is non-interactive but still important
    const isInteractive = INTERACTIVE_ROLES.has(node.role);

    // Depth filter
    if (opts.depth !== undefined && depth > opts.depth) continue;

    // Interactive filter: skip non-interactive but still count for locator indices
    if (opts.interactive && !isInteractive) {
      // Still track for nth() counts
      const key = `${node.role}:${node.name || ''}`;
      roleNameSeen.set(key, (roleNameSeen.get(key) || 0) + 1);
      if (isFlutter) flutterNodeIndex++;
      continue;
    }

    // Compact filter: skip elements with no name and no inline content that aren't interactive
    if (opts.compact && !isInteractive && !node.name && !node.children) {
      if (isFlutter) flutterNodeIndex++;
      continue;
    }

    // Assign ref
    const ref = `e${refCounter++}`;
    const indentStr = '  '.repeat(depth);

    // Build Playwright locator
    const key = `${node.role}:${node.name || ''}`;
    const seenIndex = roleNameSeen.get(key) || 0;
    roleNameSeen.set(key, seenIndex + 1);
    const totalCount = roleNameCounts.get(key) || 1;

    let locator: Locator;

    if (isFlutter && flutterNodeIndex < flutterNodes.length) {
      // Flutter: use CSS selector from the scanned flt-semantics elements
      const fNode = flutterNodes[flutterNodeIndex];
      locator = page.locator(fNode.selector);
    } else if (opts.selector) {
      locator = page.locator(opts.selector).getByRole(node.role as any, {
        name: node.name || undefined,
      });
    } else {
      locator = page.getByRole(node.role as any, {
        name: node.name || undefined,
      });
    }

    // Disambiguate with nth() if multiple elements share role+name (non-Flutter only)
    if (!isFlutter && totalCount > 1) {
      locator = locator.nth(seenIndex);
    }

    if (isFlutter) flutterNodeIndex++;

    refMap.set(ref, { locator, role: node.role, name: node.name || '' });

    // Format output line
    let outputLine = `${indentStr}@${ref} [${node.role}]`;
    if (node.name) outputLine += ` "${node.name}"`;
    if (node.props) outputLine += ` ${node.props}`;
    if (node.children) outputLine += `: ${node.children}`;

    output.push(outputLine);
  }

  // ─── Cursor-interactive scan (-C) ─────────────────────────
  if (opts.cursorInteractive) {
    try {
      const cursorElements = await page.evaluate(() => {
        const STANDARD_INTERACTIVE = new Set([
          'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS',
        ]);

        const results: Array<{ selector: string; text: string; reason: string }> = [];
        const allElements = document.querySelectorAll('*');

        for (const el of allElements) {
          // Skip standard interactive elements (already in ARIA tree)
          if (STANDARD_INTERACTIVE.has(el.tagName)) continue;
          // Skip hidden elements
          if (!(el as HTMLElement).offsetParent && el.tagName !== 'BODY') continue;

          const style = getComputedStyle(el);
          const hasCursorPointer = style.cursor === 'pointer';
          const hasOnclick = el.hasAttribute('onclick');
          const hasTabindex = el.hasAttribute('tabindex') && parseInt(el.getAttribute('tabindex')!, 10) >= 0;
          const hasRole = el.hasAttribute('role');

          if (!hasCursorPointer && !hasOnclick && !hasTabindex) continue;
          // Skip if it has an ARIA role (likely already captured)
          if (hasRole) continue;

          // Build deterministic nth-child CSS path
          const parts: string[] = [];
          let current: Element | null = el;
          while (current && current !== document.documentElement) {
            const parent = current.parentElement;
            if (!parent) break;
            const siblings = [...parent.children];
            const index = siblings.indexOf(current) + 1;
            parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
            current = parent;
          }
          const selector = parts.join(' > ');

          const text = (el as HTMLElement).innerText?.trim().slice(0, 80) || el.tagName.toLowerCase();
          const reasons: string[] = [];
          if (hasCursorPointer) reasons.push('cursor:pointer');
          if (hasOnclick) reasons.push('onclick');
          if (hasTabindex) reasons.push(`tabindex=${el.getAttribute('tabindex')}`);

          results.push({ selector, text, reason: reasons.join(', ') });
        }
        return results;
      });

      if (cursorElements.length > 0) {
        output.push('');
        output.push('── cursor-interactive (not in ARIA tree) ──');
        let cRefCounter = 1;
        for (const elem of cursorElements) {
          const ref = `c${cRefCounter++}`;
          const locator = page.locator(elem.selector);
          refMap.set(ref, { locator, role: 'cursor-interactive', name: elem.text });
          output.push(`@${ref} [${elem.reason}] "${elem.text}"`);
        }
      }
    } catch {
      output.push('');
      output.push('(cursor scan failed — CSP restriction)');
    }
  }

  // Store ref map on BrowserManager
  bm.setRefMap(refMap);

  if (output.length === 0) {
    return '(no interactive elements found)';
  }

  // Prepend Flutter indicator so the agent knows it's a Flutter app
  if (isFlutter) {
    output.unshift('── Flutter Web (semantics enabled) ──');
  }

  const snapshotText = output.join('\n');

  // ─── Annotated screenshot (-a) ────────────────────────────
  if (opts.annotate) {
    const screenshotPath = opts.outputPath || `${TEMP_DIR}/browse-annotated.png`;
    // Validate output path (consistent with screenshot/pdf/responsive)
    const resolvedPath = require('path').resolve(screenshotPath);
    const safeDirs = [TEMP_DIR, process.cwd()];
    if (!safeDirs.some((dir: string) => isPathWithin(resolvedPath, dir))) {
      throw new Error(`Path must be within: ${safeDirs.join(', ')}`);
    }
    try {
      // Inject overlay divs at each ref's bounding box
      const boxes: Array<{ ref: string; box: { x: number; y: number; width: number; height: number } }> = [];
      for (const [ref, entry] of refMap) {
        try {
          const box = await entry.locator.boundingBox({ timeout: 1000 });
          if (box) {
            boxes.push({ ref: `@${ref}`, box });
          }
        } catch {
          // Element may be offscreen or hidden — skip
        }
      }

      await page.evaluate((boxes) => {
        for (const { ref, box } of boxes) {
          const overlay = document.createElement('div');
          overlay.className = '__browse_annotation__';
          overlay.style.cssText = `
            position: absolute; top: ${box.y}px; left: ${box.x}px;
            width: ${box.width}px; height: ${box.height}px;
            border: 2px solid red; background: rgba(255,0,0,0.1);
            pointer-events: none; z-index: 99999;
            font-size: 10px; color: red; font-weight: bold;
          `;
          const label = document.createElement('span');
          label.textContent = ref;
          label.style.cssText = 'position: absolute; top: -14px; left: 0; background: red; color: white; padding: 0 3px; font-size: 10px;';
          overlay.appendChild(label);
          document.body.appendChild(overlay);
        }
      }, boxes);

      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Always remove overlays
      await page.evaluate(() => {
        document.querySelectorAll('.__browse_annotation__').forEach(el => el.remove());
      });

      output.push('');
      output.push(`[annotated screenshot: ${screenshotPath}]`);
    } catch {
      // Remove overlays even on screenshot failure
      try {
        await page.evaluate(() => {
          document.querySelectorAll('.__browse_annotation__').forEach(el => el.remove());
        });
      } catch {}
    }
  }

  // ─── Diff mode (-D) ───────────────────────────────────────
  if (opts.diff) {
    const lastSnapshot = bm.getLastSnapshot();
    if (!lastSnapshot) {
      bm.setLastSnapshot(snapshotText);
      return snapshotText + '\n\n(no previous snapshot to diff against — this snapshot stored as baseline)';
    }

    const changes = Diff.diffLines(lastSnapshot, snapshotText);
    const diffOutput: string[] = ['--- previous snapshot', '+++ current snapshot', ''];

    for (const part of changes) {
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const diffLines = part.value.split('\n').filter(l => l.length > 0);
      for (const line of diffLines) {
        diffOutput.push(`${prefix} ${line}`);
      }
    }

    bm.setLastSnapshot(snapshotText);
    return diffOutput.join('\n');
  }

  // Store for future diffs
  bm.setLastSnapshot(snapshotText);

  return output.join('\n');
}
