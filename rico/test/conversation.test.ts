import { expect, test } from "bun:test";
import { sanitizeConversationReplyForSlack } from "../src/codex/conversation";

test("sanitizeConversationReplyForSlack normalizes autolinks and stiff session phrasing", () => {
  const sanitized = sanitizeConversationReplyForSlack(
    "캡틴: 이 세션에서 origin이 https://github.com/xogjs/Crypto.git로 잡혀 있고 `main`도 `origin/main`을 추적합니다.",
  );

  expect(sanitized).toContain("지금 확인 기준으로는");
  expect(sanitized).toContain("`https://github.com/xogjs/Crypto.git`로");
  expect(sanitized.includes("<https://")).toBe(false);
  expect(sanitized.includes("로>")).toBe(false);
});
