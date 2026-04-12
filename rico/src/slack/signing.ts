import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifySlackRequestInput {
  signingSecret: string;
  rawBody: string;
  timestamp: string;
  signature: string;
  nowSeconds?: number;
}

export function verifySlackRequest(input: VerifySlackRequestInput) {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timestamp = Number(input.timestamp);

  if (!input.signingSecret) return false;
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(now - timestamp) > 60 * 5) return false;

  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const digest = `v0=${createHmac("sha256", input.signingSecret)
    .update(base)
    .digest("hex")}`;
  const expected = Buffer.from(digest);
  const actual = Buffer.from(input.signature);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
