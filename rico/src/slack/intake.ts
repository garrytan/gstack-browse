import { randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";
import { splitOversizedGoal } from "../orchestrator/initiative";
import { enqueueQueuedRun, type QueueJob } from "../runtime/queue";
import { createRepositories } from "../state/repositories";

interface SlackIntakeOptions {
  aiOpsChannelId: string;
  runIdFactory: () => string;
}

export type SlackIntakeResult = "handled" | "ignored" | null;

interface GoalIntakePayload {
  goalId: string;
  projectId: string;
  text: string;
  aiOpsChannelId: string;
  intakeThreadTs: string;
  projectChannelId: string;
  isFinalGoal: boolean;
  requiresDeployApproval: boolean;
}

function stripLeadingMention(text: string) {
  return text.replace(/^\s*<@[^>]+>\s*/, "").trim();
}

function deriveTaskList(text: string) {
  const segments = stripLeadingMention(text)
    .split(/[,\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [
      `plan:${text}`,
      `implement:${text}`,
      `review:${text}`,
    ];
  }

  return segments.flatMap((segment) => [
    `plan:${segment}`,
    `implement:${segment}`,
    `review:${segment}`,
  ]);
}

function normalizeEventText(text: string) {
  const normalized = stripLeadingMention(text);
  const projectSeparator = normalized.indexOf(":");
  if (projectSeparator === -1) return null;

  const projectId = normalized.slice(0, projectSeparator).trim();
  const goalText = normalized.slice(projectSeparator + 1).trim();
  if (!projectId || !goalText) return null;

  return {
    projectId,
    goalText,
  };
}

function resolveEvent(payload: Record<string, unknown>) {
  return payload.event && typeof payload.event === "object"
    ? payload.event as Record<string, unknown>
    : payload;
}

function resolveChannelId(payload: Record<string, unknown>, event: Record<string, unknown>) {
  return typeof event.channel === "string"
    ? event.channel
    : typeof payload.channel_id === "string"
      ? payload.channel_id
      : "";
}

function isAiOpsAppMention(
  payload: Record<string, unknown>,
  event: Record<string, unknown>,
) {
  return payload.type === "event_callback" && event.type === "app_mention";
}

function bootstrapAiOpsIntake(
  db: Database,
  payload: Record<string, unknown>,
  options: SlackIntakeOptions,
) {
  const event = resolveEvent(payload);
  const channelId = resolveChannelId(payload, event);
  if (!options.aiOpsChannelId || channelId !== options.aiOpsChannelId) {
    return null;
  }
  if (!isAiOpsAppMention(payload, event)) {
    return "ignored";
  }

  const text =
    typeof event.text === "string"
      ? event.text
      : typeof payload.text === "string"
        ? payload.text
        : "";
  const normalized = normalizeEventText(text);
  if (!normalized) return "ignored";

  const repositories = createRepositories(db);
  const project = repositories.projects.get(normalized.projectId);
  if (!project) {
    return "ignored";
  }

  const taskList = deriveTaskList(normalized.goalText);
  const split = splitOversizedGoal({
    projectId: normalized.projectId,
    title: normalized.goalText,
    tasks: taskList,
  });
  const intakeThreadTs =
    typeof event.thread_ts === "string"
      ? event.thread_ts
      : typeof event.ts === "string"
        ? event.ts
        : `aiops-${Date.now()}`;

  const initiativeId =
    split.kind === "initiative"
      ? `initiative-${normalized.projectId}-${randomUUID()}`
      : null;
  if (initiativeId) {
    repositories.initiatives.create({
      id: initiativeId,
      projectId: normalized.projectId,
      title: normalized.goalText,
      status: "in_progress",
    });
  }

  const goals =
    split.kind === "initiative"
      ? split.goals
      : [{ title: normalized.goalText, tasks: taskList }];

  goals.forEach((goal, index) => {
    const goalId = `goal-${normalized.projectId}-${index + 1}-${randomUUID()}`;
    repositories.goals.create({
      id: goalId,
      initiativeId,
      projectId: normalized.projectId,
      title: goal.title,
      state: "planned",
    });
    const queueJob: QueueJob = {
      kind: "event",
      runId: options.runIdFactory(),
      payload: {
        goalId,
        projectId: normalized.projectId,
        text: normalized.goalText,
        aiOpsChannelId: options.aiOpsChannelId,
        intakeThreadTs,
        projectChannelId: project.slackChannelId,
        isFinalGoal: index === goals.length - 1,
        requiresDeployApproval: /배포|deploy/i.test(normalized.goalText),
      } satisfies GoalIntakePayload,
    };
    enqueueQueuedRun(db, queueJob);
  });

  return "handled";
}

export function bootstrapSlackIntake(
  db: Database,
  payload: Record<string, unknown>,
  options: SlackIntakeOptions,
) {
  return bootstrapAiOpsIntake(db, payload, options);
}
