import { file, write } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const filesToFix = [
  "setup",
  "browse/scripts/build-node-server.sh",
  ...fs.readdirSync(join(REPO_ROOT, "bin")).map((f: string) => join("bin", f)),
  ...fs.readdirSync(join(REPO_ROOT, "browse/bin")).map((f: string) => join("browse/bin", f)),
];

async function fixFile(relPath: string) {
  const absPath = join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) return;
  if (fs.lstatSync(absPath).isDirectory()) return;

  const content = await file(absPath).text();
  const fixedContent = content.replace(/\r\n/g, "\n");
  
  if (content !== fixedContent) {
    console.log(`Fixing line endings for ${relPath}`);
    await write(absPath, fixedContent);
  }
}

async function run() {
  for (const f of filesToFix) {
    await fixFile(f);
  }
  console.log("Done fixing line endings.");
}

run();
