/**
 * Command registry — single source of truth for all browse commands.
 *
 * Dependency graph:
 *   commands.ts ──▶ server.ts (runtime dispatch)
 *                ──▶ gen-skill-docs.ts (doc generation)
 *                ──▶ skill-parser.ts (validation)
 *                ──▶ skill-check.ts (health reporting)
 *
 * Zero side effects. Safe to import from build scripts and tests.
 *
 * Architecture:
 *   - CHAIN_ONLY_COMMANDS: write/interaction commands, only callable via chain
 *   - READ_COMMANDS: observation commands, callable standalone (but rarely needed)
 *   - META_COMMANDS: tabs, server control, visual, snapshot — callable standalone
 *   - chain is the primary interface: executes actions + auto-observes (snapshot + page state)
 */

/** Read commands — callable standalone, but rarely needed since chain auto-observes */
export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is',
]);

/**
 * Write/interaction commands — ONLY callable inside chain.
 * Standalone dispatch is rejected with guidance to use chain.
 */
export const CHAIN_ONLY_COMMANDS = new Set([
  'goto', 'back', 'forward', 'reload',
  'click', 'fill', 'select', 'hover', 'type', 'press', 'scroll', 'wait',
  'viewport', 'cookie', 'cookie-import', 'cookie-import-browser', 'header', 'useragent',
  'upload', 'dialog-accept', 'dialog-dismiss',
]);

/** @deprecated Use CHAIN_ONLY_COMMANDS. Kept for backward compat in tests. */
export const WRITE_COMMANDS = CHAIN_ONLY_COMMANDS;

export const META_COMMANDS = new Set([
  'tabs', 'tab', 'newtab', 'closetab',
  'status', 'stop', 'restart',
  'screenshot', 'pdf', 'responsive',
  'chain', 'diff',
  'url', 'snapshot',
  'handoff', 'resume',
]);

export const ALL_COMMANDS = new Set([...READ_COMMANDS, ...CHAIN_ONLY_COMMANDS, ...META_COMMANDS]);

export const COMMAND_DESCRIPTIONS: Record<string, { category: string; description: string; usage?: string }> = {
  // Chain — primary interface
  'chain':   { category: 'Chain', description: 'Execute actions + auto-observe. Primary interface for all browser interactions. Returns action results + snapshot + page state.', usage: 'chain <json>' },
  // Navigation (chain-only)
  'goto':    { category: 'Navigation', description: 'Navigate to URL (chain-only)', usage: 'goto <url>' },
  'back':    { category: 'Navigation', description: 'History back (chain-only)' },
  'forward': { category: 'Navigation', description: 'History forward (chain-only)' },
  'reload':  { category: 'Navigation', description: 'Reload page (chain-only)' },
  'url':     { category: 'Navigation', description: 'Print current URL' },
  // Reading (standalone — rarely needed, chain auto-observes)
  'text':    { category: 'Reading', description: 'Cleaned page text (rarely needed — chain auto-observes)' },
  'html':    { category: 'Reading', description: 'innerHTML of selector or full page HTML (rarely needed)', usage: 'html [selector]' },
  'links':   { category: 'Reading', description: 'All links as "text → href" (rarely needed)' },
  'forms':   { category: 'Reading', description: 'Form fields as JSON (rarely needed)' },
  'accessibility': { category: 'Reading', description: 'Full ARIA tree (rarely needed)' },
  // Inspection (standalone — rarely needed)
  'js':      { category: 'Inspection', description: 'Run JavaScript expression', usage: 'js <expr>' },
  'eval':    { category: 'Inspection', description: 'Run JavaScript from file (path must be under /tmp or cwd)', usage: 'eval <file>' },
  'css':     { category: 'Inspection', description: 'Computed CSS value', usage: 'css <sel> <prop>' },
  'attrs':   { category: 'Inspection', description: 'Element attributes as JSON', usage: 'attrs <sel|@ref>' },
  'is':      { category: 'Inspection', description: 'State check (visible/hidden/enabled/disabled/checked/editable/focused)', usage: 'is <prop> <sel>' },
  'console': { category: 'Inspection', description: 'Console messages (--errors filters to error/warning)', usage: 'console [--clear|--errors]' },
  'network': { category: 'Inspection', description: 'Network requests', usage: 'network [--clear]' },
  'dialog':  { category: 'Inspection', description: 'Dialog messages', usage: 'dialog [--clear]' },
  'cookies': { category: 'Inspection', description: 'All cookies as JSON' },
  'storage': { category: 'Inspection', description: 'Read localStorage + sessionStorage, or set <key> <value>', usage: 'storage [set k v]' },
  'perf':    { category: 'Inspection', description: 'Page load timings' },
  // Interaction (chain-only)
  'click':   { category: 'Interaction', description: 'Click element with eased mouse movement (chain-only)', usage: 'click <sel>' },
  'fill':    { category: 'Interaction', description: 'Fill input (chain-only)', usage: 'fill <sel> <val>' },
  'select':  { category: 'Interaction', description: 'Select dropdown option (chain-only)', usage: 'select <sel> <val>' },
  'hover':   { category: 'Interaction', description: 'Hover element with eased mouse movement (chain-only)', usage: 'hover <sel>' },
  'type':    { category: 'Interaction', description: 'Type into focused element (chain-only)', usage: 'type <text>' },
  'press':   { category: 'Interaction', description: 'Press key — Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown, or modifiers like Shift+Enter (chain-only)', usage: 'press <key>' },
  'scroll':  { category: 'Interaction', description: 'Scroll element into view or to page bottom (chain-only)', usage: 'scroll [sel]' },
  'wait':    { category: 'Interaction', description: 'Wait for element, network idle, or page load (chain-only)', usage: 'wait <sel|--networkidle|--load>' },
  'upload':  { category: 'Interaction', description: 'Upload file(s) (chain-only)', usage: 'upload <sel> <file> [file2...]' },
  'viewport':{ category: 'Interaction', description: 'Set viewport size (chain-only)', usage: 'viewport <WxH>' },
  'cookie':  { category: 'Interaction', description: 'Set cookie on current domain (chain-only)', usage: 'cookie <name>=<value>' },
  'cookie-import': { category: 'Interaction', description: 'Import cookies from JSON file (chain-only)', usage: 'cookie-import <json>' },
  'cookie-import-browser': { category: 'Interaction', description: 'Import cookies from browser (chain-only)', usage: 'cookie-import-browser [browser] [--domain d]' },
  'header':  { category: 'Interaction', description: 'Set custom request header (chain-only)', usage: 'header <name>:<value>' },
  'useragent': { category: 'Interaction', description: 'Set user agent (chain-only)', usage: 'useragent <string>' },
  'dialog-accept': { category: 'Interaction', description: 'Auto-accept dialogs (chain-only)', usage: 'dialog-accept [text]' },
  'dialog-dismiss': { category: 'Interaction', description: 'Auto-dismiss dialogs (chain-only)' },
  // Visual
  'screenshot': { category: 'Visual', description: 'Save screenshot (deduped — returns "unchanged" if identical to previous)', usage: 'screenshot [--viewport] [--clip x,y,w,h] [selector|@ref] [path]' },
  'pdf':     { category: 'Visual', description: 'Save as PDF', usage: 'pdf [path]' },
  'responsive': { category: 'Visual', description: 'Screenshots at mobile, tablet, desktop breakpoints', usage: 'responsive [prefix]' },
  'diff':    { category: 'Visual', description: 'Text diff between pages', usage: 'diff <url1> <url2>' },
  // Snapshot
  'snapshot':{ category: 'Snapshot', description: 'Accessibility tree with @e refs. Flags: -i interactive, -c compact, -d N depth, -s sel scope, -D diff, -a annotated, -o path, -C cursor-interactive', usage: 'snapshot [flags]' },
  // Tabs
  'tabs':    { category: 'Tabs', description: 'List open tabs' },
  'tab':     { category: 'Tabs', description: 'Switch to tab', usage: 'tab <id>' },
  'newtab':  { category: 'Tabs', description: 'Open new tab', usage: 'newtab [url]' },
  'closetab':{ category: 'Tabs', description: 'Close tab', usage: 'closetab [id]' },
  // Server
  'status':  { category: 'Server', description: 'Health check' },
  'stop':    { category: 'Server', description: 'Shutdown server' },
  'restart': { category: 'Server', description: 'Restart server' },
  'handoff': { category: 'Server', description: 'Open visible Chrome for user takeover', usage: 'handoff [message]' },
  'resume':  { category: 'Server', description: 'Re-snapshot after user takeover', usage: 'resume' },
};

// Load-time validation: descriptions must cover exactly the command sets
const allCmds = new Set([...READ_COMMANDS, ...CHAIN_ONLY_COMMANDS, ...META_COMMANDS]);
const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
for (const cmd of allCmds) {
  if (!descKeys.has(cmd)) throw new Error(`COMMAND_DESCRIPTIONS missing entry for: ${cmd}`);
}
for (const key of descKeys) {
  if (!allCmds.has(key)) throw new Error(`COMMAND_DESCRIPTIONS has unknown command: ${key}`);
}
