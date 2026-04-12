import type { Database } from "bun:sqlite";

export interface QueueJob {
  kind: "event" | "command" | "interaction";
  payload: unknown;
  runId: string;
}

export interface ClaimedQueuedRun {
  id: string;
  goalId: string;
  kind: QueueJob["kind"];
  payload: unknown;
}

const JOB_KIND_MEMORY_KEY = "queue.kind";
const PAYLOAD_MEMORY_KEY = "queue.payload_json";

function extractGoalId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const candidate =
    ("goalId" in payload && typeof payload.goalId === "string" && payload.goalId) ||
    ("goal_id" in payload && typeof payload.goal_id === "string" && payload.goal_id) ||
    null;

  return candidate;
}

export function enqueueQueuedRun(
  db: Database,
  job: QueueJob,
  options: { queuedAt?: string } = {},
) {
  const goalId = extractGoalId(job.payload);
  if (!goalId) {
    throw new Error("Queue job payload must include goalId");
  }

  db.transaction(() => {
    db.query(
      `insert into runs (id, goal_id, status, queued_at, started_at, finished_at)
       values (?, ?, 'queued', ?, null, null)
       on conflict(id) do update set
         goal_id = excluded.goal_id,
         status = 'queued',
         queued_at = excluded.queued_at,
         started_at = null,
         finished_at = null`,
    ).run(job.runId, goalId, options.queuedAt ?? new Date().toISOString());

    db.query(
      `insert into run_memory (run_id, key, value)
       values (?, ?, ?)
       on conflict(run_id, key) do update set value = excluded.value`,
    ).run(job.runId, JOB_KIND_MEMORY_KEY, job.kind);
    db.query(
      `insert into run_memory (run_id, key, value)
       values (?, ?, ?)
       on conflict(run_id, key) do update set value = excluded.value`,
    ).run(job.runId, PAYLOAD_MEMORY_KEY, JSON.stringify(job.payload));
  })();

  return { id: job.runId, goalId };
}

export function claimNextQueuedRun(
  db: Database,
  options: { startedAt?: string } = {},
) {
  return db.transaction(() => {
    const row = db.query(
      `select id, goal_id
       from runs
       where status = 'queued'
       order by queued_at asc, id asc
       limit 1`,
    ).get() as { id: string; goal_id: string } | null;

    if (!row) return null;

    const result = db
      .query(
        `update runs
         set status = 'running', started_at = ?
         where id = ? and status = 'queued'`,
      )
      .run(options.startedAt ?? new Date().toISOString(), row.id) as
      | { changes?: number }
      | undefined;

    if (!result || result.changes !== 1) return null;

    const memoryRows = db
      .query("select key, value from run_memory where run_id = ?")
      .all(row.id) as Array<{ key: string; value: string }>;
    const memory = Object.fromEntries(memoryRows.map((entry) => [entry.key, entry.value]));
    const kind = memory[JOB_KIND_MEMORY_KEY];
    const payloadJson = memory[PAYLOAD_MEMORY_KEY];

    if (kind !== "event" && kind !== "command" && kind !== "interaction") {
      throw new Error(`Missing queue kind for run ${row.id}`);
    }

    return {
      id: row.id,
      goalId: row.goal_id,
      kind,
      payload: payloadJson ? JSON.parse(payloadJson) : { goalId: row.goal_id },
    };
  })();
}
