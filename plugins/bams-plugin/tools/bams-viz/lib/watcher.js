import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Watch a directory for JSONL file changes
 * Falls back to polling if chokidar is not available
 * @param {string} dir - Directory to watch
 * @param {string} pattern - Glob pattern for files (e.g. '*.jsonl', '*-events.jsonl')
 * @param {Function} onNewEvent - Callback for each new event
 */
export async function createWatcher(dir, pattern, onNewEvent) {
  const fileOffsets = new Map();
  const suffix = pattern.replace('*', '');

  function processFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lastOffset = fileOffsets.get(filePath) || 0;
      if (content.length <= lastOffset) return;

      const newContent = content.slice(lastOffset);
      fileOffsets.set(filePath, content.length);

      const newLines = newContent.trim().split('\n').filter(Boolean);
      for (const line of newLines) {
        try {
          onNewEvent(JSON.parse(line), filePath);
        } catch { /* skip malformed */ }
      }
    } catch { /* file may be deleted */ }
  }

  // Try chokidar first, fall back to polling
  try {
    const chokidar = await import('chokidar');
    const glob = join(dir, pattern);

    const watcher = chokidar.watch(glob, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    watcher.on('add', processFile);
    watcher.on('change', processFile);

    return { close: () => watcher.close() };
  } catch {
    // Fallback: polling
    console.log(`[bams-viz] chokidar not available for ${dir}, using polling`);

    const interval = setInterval(() => {
      try {
        const files = readdirSync(dir).filter(f => f.endsWith(suffix));
        for (const f of files) {
          processFile(join(dir, f));
        }
      } catch { /* dir may not exist yet */ }
    }, 1000);

    return { close: () => clearInterval(interval) };
  }
}
