// bin/cavestack-redact-stream — stdin → redacted stdout
// Used by cavestack-run to filter live output streams into the replay file.

import { redact } from "../lib/redact.js";

let buffer = "";

process.stdin.setEncoding("utf-8");

process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  // Process complete lines; keep partial line buffered for next chunk
  let newlineIdx: number;
  // eslint-disable-next-line no-cond-assign
  while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    const result = redact(line);
    process.stdout.write(result.text + "\n");
  }
});

process.stdin.on("end", () => {
  if (buffer.length > 0) {
    const result = redact(buffer);
    process.stdout.write(result.text);
  }
});
