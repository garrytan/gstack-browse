import type { Database } from "bun:sqlite";
import {
  createRepositories,
  type GoalRecord,
  type ProjectRecord,
  type RunRecord,
} from "../state/repositories";
import { claimNextQueuedRun, type ClaimedQueuedRun } from "./queue";

export interface LoadedRunContext {
  job: ClaimedQueuedRun;
  goal: GoalRecord;
  project: ProjectRecord;
  run: RunRecord;
  target: "governor" | "captain";
}

export interface DrainNextQueuedRunOptions {
  startedAt?: string;
  finishedAt?: string;
  dispatch?: (context: LoadedRunContext) => Promise<void> | void;
}

export function routeQueuedRun(run: ClaimedQueuedRun) {
  return run.kind === "command" ? "captain" as const : "governor" as const;
}

function loadRunContext(db: Database, claimed: ClaimedQueuedRun): LoadedRunContext {
  const repositories = createRepositories(db);
  const run = repositories.runs.get(claimed.id);
  if (!run) {
    throw new Error(`Claimed run is missing from storage: ${claimed.id}`);
  }

  const goal = repositories.goals.get(claimed.goalId);
  if (!goal) {
    throw new Error(`Claimed run is missing its goal snapshot: ${claimed.goalId}`);
  }

  const project = repositories.projects.get(goal.projectId);
  if (!project) {
    throw new Error(`Claimed run is missing its project snapshot: ${goal.projectId}`);
  }

  return {
    job: claimed,
    goal,
    project,
    run,
    target: routeQueuedRun(claimed),
  };
}

export async function drainNextQueuedRun(
  db: Database,
  options: DrainNextQueuedRunOptions = {},
) {
  const claimed = claimNextQueuedRun(db, { startedAt: options.startedAt });
  if (!claimed) return null;
  const context = loadRunContext(db, claimed);

  try {
    await options.dispatch?.(context);
    db.query("update runs set status = 'finished', finished_at = ? where id = ?")
      .run(options.finishedAt ?? new Date().toISOString(), claimed.id);
    return { ...claimed, status: "finished" as const, target: context.target };
  } catch (error) {
    db.query("update runs set status = 'failed', finished_at = ? where id = ?")
      .run(options.finishedAt ?? new Date().toISOString(), claimed.id);
    throw error;
  }
}

export function startJobRunner(input: {
  db: Database;
  dispatch?: (context: LoadedRunContext) => Promise<void> | void;
  intervalMs?: number;
}) {
  let draining = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const kick = async () => {
    if (draining) return;
    draining = true;

    try {
      while (true) {
        try {
          const drained = await drainNextQueuedRun(input.db, {
            dispatch: input.dispatch,
          });
          if (!drained) break;
        } catch {
          break;
        }
      }
    } finally {
      draining = false;
    }
  };

  return {
    kick,
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void kick();
      }, input.intervalMs ?? 1000);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  };
}
