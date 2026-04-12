import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStore } from "../src/state/store";

function withStore<T>(fn: (store: ReturnType<typeof openStore>) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "rico-store-"));
  const dbPath = join(dir, "rico.sqlite");
  const store = openStore(dbPath);

  try {
    return fn(store);
  } finally {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("bootstrap creates the workflow tables", () => {
  withStore((store) => {
    const tables = store.listTables();
    for (const table of [
      "projects",
      "initiatives",
      "goals",
      "runs",
      "tasks",
      "approvals",
      "artifacts",
      "state_transitions",
      "project_memory",
      "run_memory",
      "role_playbooks",
    ]) {
      expect(tables).toContain(table);
    }

    const taskColumns = store.db
      .query("pragma table_info(tasks)")
      .all()
      .map((row: any) => row.name);
    expect(taskColumns).toContain("run_id");
  });
});

test("goal state transitions can be appended and read back in order", () => {
  withStore((store) => {
    const { goals, stateTransitions } = store.repositories;

    goals.create({
      id: "goal-1",
      initiativeId: null,
      projectId: "project-1",
      title: "Ship the workflow store",
      state: "planned",
    });

    stateTransitions.append({
      id: "transition-1",
      goalId: "goal-1",
      fromState: null,
      toState: "planned",
      createdAt: "2026-04-12T00:00:00.000Z",
      actor: "planner",
    });
    stateTransitions.append({
      id: "transition-2",
      goalId: "goal-1",
      fromState: "planned",
      toState: "in_progress",
      createdAt: "2026-04-12T00:01:00.000Z",
      actor: "captain",
    });
    stateTransitions.append({
      id: "transition-3",
      goalId: "goal-1",
      fromState: "in_progress",
      toState: "awaiting_qa",
      createdAt: "2026-04-12T00:02:00.000Z",
      actor: "qa",
    });

    expect(
      stateTransitions.listByGoal("goal-1").map((transition) => transition.toState),
    ).toEqual(["planned", "in_progress", "awaiting_qa"]);
    expect(goals.get("goal-1")?.state).toBe("awaiting_qa");
  });
});

test("foreign keys reject orphan runs for missing goals", () => {
  withStore((store) => {
    expect(() =>
      store.repositories.runs.create({
        id: "run-orphan",
        goalId: "missing-goal",
        status: "queued",
        queuedAt: "2026-04-12T00:04:00.000Z",
        startedAt: null,
        finishedAt: null,
      }),
    ).toThrow();
  });
});

test("current execution snapshot groups the active run and tasks for a goal", () => {
  withStore((store) => {
    const { goals, runs, tasks } = store.repositories;

    goals.create({
      id: "goal-2",
      initiativeId: null,
      projectId: "project-1",
      title: "Build the execution snapshot",
      state: "in_progress",
    });

    runs.create({
      id: "run-1",
      goalId: "goal-2",
      status: "in_progress",
      queuedAt: "2026-04-12T00:00:00.000Z",
      startedAt: "2026-04-12T00:01:00.000Z",
      finishedAt: null,
    });
    runs.create({
      id: "run-0",
      goalId: "goal-2",
      status: "finished",
      queuedAt: "2026-04-11T23:50:00.000Z",
      startedAt: "2026-04-11T23:51:00.000Z",
      finishedAt: "2026-04-11T23:59:00.000Z",
    });

    tasks.create({
      id: "task-1",
      goalId: "goal-2",
      runId: "run-1",
      role: "planner",
      state: "done",
      payloadJson: JSON.stringify({ step: 1 }),
    });
    tasks.create({
      id: "task-2",
      goalId: "goal-2",
      runId: "run-1",
      role: "qa",
      state: "queued",
      payloadJson: JSON.stringify({ step: 2 }),
    });
    tasks.create({
      id: "task-old",
      goalId: "goal-2",
      runId: "run-0",
      role: "qa",
      state: "done",
      payloadJson: JSON.stringify({ step: "old" }),
    });

    const snapshot = goals.getCurrentExecutionSnapshot("goal-2");

    expect(snapshot.goal?.id).toBe("goal-2");
    expect(snapshot.run?.id).toBe("run-1");
    expect(snapshot.tasks.map((task) => task.id)).toEqual(["task-1", "task-2"]);
  });
});

test("stateTransitions.append rolls back partial writes when the goal is missing", () => {
  withStore((store) => {
    const { stateTransitions } = store.repositories;

    expect(() =>
      stateTransitions.append({
        id: "transition-missing-goal",
        goalId: "goal-missing",
        fromState: "planned",
        toState: "in_progress",
        createdAt: "2026-04-12T00:03:00.000Z",
        actor: "captain",
      }),
    ).toThrow();

    expect(stateTransitions.listByGoal("goal-missing")).toHaveLength(0);
  });
});
