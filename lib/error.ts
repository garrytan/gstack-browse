// cavestack error helper (Tier-2 Rust-style pattern).
// Shared codes live in lib/error-codes.json so bash and TS print identical output.

import codes from "./error-codes.json" with { type: "json" };

export interface ErrorEntry {
  message: string;
  fix: string;
  docs: string;
}

export type ErrorCode = keyof typeof codes;

export class CavestackError extends Error {
  code: string;
  fix: string;
  docs: string;
  context?: string;

  constructor(code: string, context?: string) {
    const entry = (codes as Record<string, ErrorEntry>)[code];
    if (!entry) {
      super(`Unrecognized error code ${code}`);
      this.code = "CS900";
      this.fix = "check lib/error-codes.json for valid codes";
      this.docs = "https://cavestack.jerkyjesse.io/docs/errors";
      return;
    }
    super(entry.message);
    this.code = code;
    this.fix = entry.fix;
    this.docs = entry.docs;
    this.context = context;
  }

  format(): string {
    const lines = [`Error[${this.code}]: ${this.message}`];
    if (this.context) lines.push(`   context: ${this.context}`);
    lines.push(`   fix: ${this.fix}`);
    lines.push(`   docs: ${this.docs}`);
    return lines.join("\n");
  }
}

export function cavestackError(code: string, context?: string): never {
  const err = new CavestackError(code, context);
  process.stderr.write(err.format() + "\n");
  process.exit(1);
}

export function cavestackWarn(code: string, context?: string): void {
  const entry = (codes as Record<string, ErrorEntry>)[code];
  const msg = entry?.message ?? "unrecognized warning";
  const suffix = context ? ` — ${context}` : "";
  process.stderr.write(`warn[${code}]: ${msg}${suffix}\n`);
}
