import { build, write, file } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const SRC_DIR = join(REPO_ROOT, "browse", "src");
const DIST_DIR = join(REPO_ROOT, "browse", "dist");

async function run() {
  console.log("Building Node-compatible server bundle...");

  // Ensure dist dir exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Step 1: Transpile server.ts to a single .mjs bundle
  const buildResult = await build({
    entrypoints: [join(SRC_DIR, "server.ts")],
    outdir: DIST_DIR,
    naming: "server-node.mjs",
    target: "node",
    external: ["playwright", "playwright-core", "diff", "bun:sqlite"],
  });

  if (!buildResult.success) {
    console.error("Build failed:", buildResult.logs);
    process.exit(1);
  }

  const bundlePath = join(DIST_DIR, "server-node.mjs");
  let content = await file(bundlePath).text();

  // Step 2: Post-process (replacing perl)
  // Replace import.meta.dir with a resolvable reference
  content = content.replace(/import\.meta\.dir/g, "__browseNodeSrcDir");
  // Stub out bun:sqlite
  content = content.replace(
    /import \{ Database \} from "bun:sqlite";/g,
    'const Database = null; // bun:sqlite stubbed on Node'
  );
  // Fix Bun-specific createRequire bundling
  content = content.replace(/createRequire\(import\.meta\.url\)/g, "_cr(import.meta.url)");

  // Step 3: Create the final file with polyfill header
  const lines = content.split("\n");
  const firstLine = lines[0];
  const rest = lines.slice(1).join("\n");

  const header = `// ── Windows Node.js compatibility (auto-generated) ──
import { fileURLToPath as _ftp } from "node:url";
import { dirname as _dn } from "node:path";
import { createRequire as _cr } from "node:module";
const __browseNodeSrcDir = _dn(_dn(_ftp(import.meta.url))) + "/src";
const createRequire = _cr; // Define globally for bundled code
{ const _r = _cr(import.meta.url); _r("./bun-polyfill.cjs"); }
// ── end compatibility ──
`;

  // Filter out any duplicate createRequire imports that might have been bundled
  let finalContent = firstLine + "\n" + header + rest;
  finalContent = finalContent.replace(/^import \{ createRequire \} from "node:module";\s*$/gm, "");
  await write(bundlePath, finalContent);

  // Step 4: Copy polyfill to dist/
  const polyfillSrc = join(SRC_DIR, "bun-polyfill.cjs");
  const polyfillDest = join(DIST_DIR, "bun-polyfill.cjs");
  fs.copyFileSync(polyfillSrc, polyfillDest);

  console.log(`Node server bundle ready: ${bundlePath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
