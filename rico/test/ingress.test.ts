import { test, expect } from "bun:test";
import { processSlackPayload } from "../src/slack/ingress";
import { openStore } from "../src/state/store";

test("processSlackPayload ignores unsupported Slack event callbacks without queueing a run", async () => {
  const store = openStore(":memory:");

  const result = await processSlackPayload(
    {
      db: store.db,
      aiOpsChannelId: "C_TOTAL",
    },
    "event",
    {
      type: "event_callback",
      event: {
        type: "user_typing",
        channel: "C_TOTAL",
        user: "U_TONY",
      },
    },
  );

  expect(result).toEqual({ queued: false, handled: false });
  expect(store.db.query("select count(*) as count from runs").get()).toEqual({ count: 0 });
});
