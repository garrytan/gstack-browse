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

test("processSlackPayload replies to greeting in ai-ops channel without creating work", async () => {
  const store = openStore(":memory:");
  store.repositories.projects.create({
    id: "mypetroutine",
    slackChannelId: "C_MYPETROUTINE",
  });

  const posted: Array<{ channel: string; thread_ts?: string; text: string }> = [];
  const result = await processSlackPayload(
    {
      db: store.db,
      aiOpsChannelId: "C_TOTAL",
      slackClient: {
        async postMessage(input) {
          posted.push(input);
          return { ok: true, ts: "1710000000.000100" };
        },
      },
    },
    "event",
    {
      type: "event_callback",
      event: {
        type: "message",
        channel: "C_TOTAL",
        user: "U_TONY",
        text: "안녕",
        ts: "1712900000.000100",
      },
    },
  );

  expect(result).toEqual({ queued: false, handled: true });
  expect(posted).toHaveLength(1);
  expect(posted[0]?.channel).toBe("C_TOTAL");
  expect(posted[0]?.thread_ts).toBe("1712900000.000100");
  expect(posted[0]?.text).toContain("프로젝트명: 목표");
  expect(store.db.query("select count(*) as count from runs").get()).toEqual({ count: 0 });
});

test("processSlackPayload replies to greeting in project channel without creating a goal", async () => {
  const store = openStore(":memory:");
  store.repositories.projects.create({
    id: "mypetroutine",
    slackChannelId: "C_MYPETROUTINE",
  });

  const posted: Array<{ channel: string; thread_ts?: string; text: string }> = [];
  const result = await processSlackPayload(
    {
      db: store.db,
      aiOpsChannelId: "C_TOTAL",
      slackClient: {
        async postMessage(input) {
          posted.push(input);
          return { ok: true, ts: "1710000000.000100" };
        },
      },
    },
    "event",
    {
      type: "event_callback",
      event: {
        type: "message",
        channel: "C_MYPETROUTINE",
        user: "U_TONY",
        text: "안녕",
        ts: "1712900000.000200",
      },
    },
  );

  expect(result).toEqual({ queued: false, handled: true });
  expect(posted).toHaveLength(1);
  expect(posted[0]?.channel).toBe("C_MYPETROUTINE");
  expect(posted[0]?.thread_ts).toBe("1712900000.000200");
  expect(posted[0]?.text).toContain("이 채널은 mypetroutine 프로젝트");
  expect(store.repositories.goals.listByProject("mypetroutine")).toHaveLength(0);
});
