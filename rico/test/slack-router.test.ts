import { createHmac } from "node:crypto";
import { expect, test } from "bun:test";
import { openStore } from "../src/state/store";
import { createSlackRouter } from "../src/slack/router";
import { verifySlackRequest } from "../src/slack/signing";

function signSlackPayload(secret: string, timestamp: string, rawBody: string) {
  return `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
}

function seedGoal(store: ReturnType<typeof openStore>, goalId = "goal-1") {
  store.repositories.projects.create({
    id: "project-1",
    slackChannelId: "C_PROJECT",
  });
  store.repositories.goals.create({
    id: goalId,
    initiativeId: null,
    projectId: "project-1",
    title: "Handle Slack work",
    state: "planned",
  });
}

test("rejects requests with invalid signature", () => {
  const ok = verifySlackRequest({
    signingSecret: "secret",
    rawBody: "payload=1",
    timestamp: "1710000000",
    signature: "v0=bad",
    nowSeconds: 1710000000,
  });

  expect(ok).toBe(false);
});

test("url_verification echoes the challenge", async () => {
  const store = openStore(":memory:");
  const router = createSlackRouter({
    db: store.db,
    aiOpsChannelId: "C_AI_OPS",
    signingSecret: "secret",
  });

  const response = await router(
    new Request("http://localhost/slack/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "url_verification",
        challenge: "challenge-token",
      }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ challenge: "challenge-token" });
  store.db.close();
});

test("event callback returns 200 and enqueues a queued run", async () => {
  const store = openStore(":memory:");
  seedGoal(store);

  let drainCalls = 0;
  const router = createSlackRouter({
    db: store.db,
    aiOpsChannelId: "C_AI_OPS",
    signingSecret: "secret",
    runIdFactory: () => "run-1",
    triggerDrain: () => {
      drainCalls += 1;
    },
  });

  const rawBody = JSON.stringify({
    type: "event_callback",
    goalId: "goal-1",
    event: { type: "app_mention" },
  });
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const response = await router(
    new Request("http://localhost/slack/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signSlackPayload("secret", timestamp, rawBody),
      },
      body: rawBody,
    }),
  );

  expect(response.status).toBe(200);
  expect(drainCalls).toBe(1);
  expect(store.repositories.runs.get("run-1")).toMatchObject({
    id: "run-1",
    goalId: "goal-1",
    status: "queued",
  });
  expect(
    store.db
      .query("select key, value from run_memory where run_id = ? order by key asc")
      .all("run-1"),
  ).toEqual([
    { key: "queue.kind", value: "event" },
    { key: "queue.payload_json", value: rawBody },
  ]);
  store.db.close();
});

test("interactive payloads are verified and enqueued", async () => {
  const store = openStore(":memory:");
  seedGoal(store, "goal-2");

  const router = createSlackRouter({
    db: store.db,
    aiOpsChannelId: "C_AI_OPS",
    signingSecret: "secret",
    runIdFactory: () => "run-2",
  });

  const payload = JSON.stringify({
    type: "block_actions",
    goalId: "goal-2",
  });
  const rawBody = `payload=${encodeURIComponent(payload)}`;
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const response = await router(
    new Request("http://localhost/slack/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signSlackPayload("secret", timestamp, rawBody),
      },
      body: rawBody,
    }),
  );

  expect(response.status).toBe(200);
  expect(store.repositories.runs.get("run-2")).toMatchObject({
    id: "run-2",
    goalId: "goal-2",
    status: "queued",
  });
  store.db.close();
});

test("non app-mention traffic in the ai-ops channel is ignored", async () => {
  const store = openStore(":memory:");
  let drainCalls = 0;
  const router = createSlackRouter({
    db: store.db,
    aiOpsChannelId: "C_AI_OPS",
    signingSecret: "secret",
    triggerDrain: () => {
      drainCalls += 1;
    },
  });

  const rawBody = JSON.stringify({
    type: "event_callback",
    event: {
      type: "message",
      channel: "C_AI_OPS",
      text: "project-1: accidental chatter",
    },
  });
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const response = await router(
    new Request("http://localhost/slack/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signSlackPayload("secret", timestamp, rawBody),
      },
      body: rawBody,
    }),
  );

  expect(response.status).toBe(200);
  expect(drainCalls).toBe(0);
  expect(store.db.query("select count(*) as count from runs").get()).toEqual({ count: 0 });
  store.db.close();
});
