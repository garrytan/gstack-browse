import { expect, test } from "bun:test";
import { openStore } from "../src/state/store";
import {
  claimNextQueuedRun,
  enqueueQueuedRun,
} from "../src/runtime/queue";
import { drainNextQueuedRun } from "../src/runtime/job-runner";

function seedGoal(store: ReturnType<typeof openStore>, goalId = "goal-1") {
  store.repositories.projects.create({
    id: "project-1",
    slackChannelId: "C_PROJECT",
  });
  store.repositories.goals.create({
    id: goalId,
    initiativeId: null,
    projectId: "project-1",
    title: "Drain queued work",
    state: "planned",
  });
}

test("claimNextQueuedRun drains the oldest queued run", () => {
  const store = openStore(":memory:");
  seedGoal(store);

  enqueueQueuedRun(
    store.db,
    { kind: "command", runId: "run-2", payload: { goalId: "goal-1" } },
    { queuedAt: "2026-04-12T00:02:00.000Z" },
  );
  enqueueQueuedRun(
    store.db,
    { kind: "command", runId: "run-1", payload: { goalId: "goal-1" } },
    { queuedAt: "2026-04-12T00:01:00.000Z" },
  );

  const claimed = claimNextQueuedRun(store.db, {
    startedAt: "2026-04-12T00:03:00.000Z",
  });

  expect(claimed?.id).toBe("run-1");
  expect(claimed?.kind).toBe("command");
  expect(claimed?.payload).toEqual({ goalId: "goal-1" });
  expect(store.repositories.runs.get("run-1")?.status).toBe("running");
  store.db.close();
});

test("drainNextQueuedRun loads goal/project snapshots and routes work before finishing", async () => {
  const store = openStore(":memory:");
  seedGoal(store);

  enqueueQueuedRun(
    store.db,
    { kind: "event", runId: "run-1", payload: { goalId: "goal-1" } },
    { queuedAt: "2026-04-12T00:01:00.000Z" },
  );

  const drained = await drainNextQueuedRun(store.db, {
    startedAt: "2026-04-12T00:02:00.000Z",
    finishedAt: "2026-04-12T00:03:00.000Z",
    dispatch: async (context) => {
      expect(context.target).toBe("governor");
      expect(context.job).toMatchObject({
        id: "run-1",
        goalId: "goal-1",
        kind: "event",
        payload: { goalId: "goal-1" },
      });
      expect(context.goal).toMatchObject({
        id: "goal-1",
        projectId: "project-1",
      });
      expect(context.project).toMatchObject({
        id: "project-1",
        slackChannelId: "C_PROJECT",
      });
    },
  });

  expect(drained).toMatchObject({
    id: "run-1",
    status: "finished",
    target: "governor",
  });
  expect(store.repositories.runs.get("run-1")).toMatchObject({
    id: "run-1",
    status: "finished",
    startedAt: "2026-04-12T00:02:00.000Z",
    finishedAt: "2026-04-12T00:03:00.000Z",
  });
  store.db.close();
});

test("drainNextQueuedRun marks runs failed when dispatch throws", async () => {
  const store = openStore(":memory:");
  seedGoal(store);

  enqueueQueuedRun(
    store.db,
    { kind: "interaction", runId: "run-2", payload: { goalId: "goal-1" } },
    { queuedAt: "2026-04-12T00:04:00.000Z" },
  );

  await expect(() =>
    drainNextQueuedRun(store.db, {
      startedAt: "2026-04-12T00:05:00.000Z",
      finishedAt: "2026-04-12T00:06:00.000Z",
      dispatch: async (context) => {
        expect(context.target).toBe("governor");
        throw new Error("dispatch failed");
      },
    }),
  ).toThrow("dispatch failed");

  expect(store.repositories.runs.get("run-2")).toMatchObject({
    id: "run-2",
    status: "failed",
    finishedAt: "2026-04-12T00:06:00.000Z",
  });
  store.db.close();
});
