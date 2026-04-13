import { Governor } from "../orchestrator/governor";
import { createRepositories } from "../state/repositories";

export type GovernorCommand =
  | { type: "status" }
  | { type: "queue" }
  | { type: "approval_backlog" }
  | { type: "pause"; projectId: string }
  | { type: "resume"; projectId: string }
  | { type: "reprioritize"; projectId: string; priority: number };

export interface GovernorProjectSnapshot {
  projectId: string;
  priority: number;
  paused: boolean;
  currentGoalTitle: string | null;
  currentGoalState: string | null;
  queuedAt: string | null;
  active: boolean;
}

export interface GovernorApprovalSnapshot {
  projectId: string;
  goalTitle: string;
  actionType: string;
  rationale: string | null;
}

export interface GovernorSnapshot {
  activeProjects: GovernorProjectSnapshot[];
  queuedProjects: GovernorProjectSnapshot[];
  pausedProjects: GovernorProjectSnapshot[];
  blockedProjects: GovernorProjectSnapshot[];
  pendingApprovals: GovernorApprovalSnapshot[];
}

function normalizeProjectKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseGovernorCommand(text: string): GovernorCommand | null {
  const normalized = text.trim();
  if (normalized === "상태" || /^status$/i.test(normalized)) {
    return { type: "status" };
  }
  if (normalized === "대기열") {
    return { type: "queue" };
  }
  if (normalized === "승인 대기") {
    return { type: "approval_backlog" };
  }

  const pauseMatch = normalized.match(/^일시정지\s+(.+)$/);
  if (pauseMatch) {
    return { type: "pause", projectId: normalizeProjectKey(pauseMatch[1] ?? "") };
  }
  const resumeMatch = normalized.match(/^재개\s+(.+)$/);
  if (resumeMatch) {
    return { type: "resume", projectId: normalizeProjectKey(resumeMatch[1] ?? "") };
  }
  const reprioritizeMatch = normalized.match(/^우선순위\s+(.+?)\s+(-?\d+)$/);
  if (reprioritizeMatch) {
    return {
      type: "reprioritize",
      projectId: normalizeProjectKey(reprioritizeMatch[1] ?? ""),
      priority: Number(reprioritizeMatch[2]),
    };
  }

  return null;
}

export function buildGovernorSnapshot(
  repositories: ReturnType<typeof createRepositories>,
  maxActiveProjects: number,
): GovernorSnapshot {
  const projects = repositories.projects.list();
  const goals = repositories.goals.list();
  const runs = repositories.runs.list();
  const approvals = repositories.approvals.list().filter((approval) => approval.status === "pending");

  const governor = new Governor({ maxActiveProjects });
  for (const project of projects) {
    governor.registerProject({
      id: project.id,
      channelId: project.slackChannelId,
    });
    governor.handleAiOpsCommand({
      action: "reprioritize",
      projectId: project.id,
      priority: project.priority,
    });
    if (project.paused) {
      governor.handleAiOpsCommand({
        action: "pause",
        projectId: project.id,
      });
    }
  }

  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const runsByGoal = new Map<string, ReturnType<typeof repositories.runs.listByGoal>>();
  for (const goal of goals) {
    runsByGoal.set(goal.id, repositories.runs.listByGoal(goal.id));
  }

  const snapshots: GovernorProjectSnapshot[] = projects.map((project) => {
    const projectGoals = goals.filter((goal) => goal.projectId === project.id);
    const activeGoal = projectGoals.find((goal) =>
      runsByGoal.get(goal.id)?.some((run) => run.status === "running"),
    ) ?? projectGoals.find((goal) => goal.state === "in_progress" || goal.state === "awaiting_qa") ?? null;
    const queuedGoal = projectGoals.find((goal) =>
      runsByGoal.get(goal.id)?.some((run) => run.status === "queued"),
    ) ?? null;
    const latestQueuedRun = queuedGoal
      ? (runsByGoal.get(queuedGoal.id) ?? []).find((run) => run.status === "queued") ?? null
      : null;

    if (latestQueuedRun?.queuedAt) {
      governor.markQueued(project.id, latestQueuedRun.queuedAt);
    }
    if (activeGoal) {
      const started = governor.startProject(project.id);
      if (!started.ok) {
        governor.finishProject(project.id);
      }
    }

    const pendingGoal = activeGoal ?? queuedGoal ?? projectGoals.at(-1) ?? null;

    return {
      projectId: project.id,
      priority: project.priority,
      paused: project.paused,
      currentGoalTitle: pendingGoal?.title ?? null,
      currentGoalState: pendingGoal?.state ?? null,
      queuedAt: latestQueuedRun?.queuedAt ?? null,
      active: activeGoal != null && !project.paused,
    };
  });

  const activeProjects = snapshots
    .filter((snapshot) => snapshot.active)
    .sort((left, right) => right.priority - left.priority || left.projectId.localeCompare(right.projectId));
  const queuedProjects = snapshots
    .filter((snapshot) => !snapshot.active && !snapshot.paused && snapshot.queuedAt)
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return (left.queuedAt ?? "").localeCompare(right.queuedAt ?? "");
    });
  const pausedProjects = snapshots.filter((snapshot) => snapshot.paused);
  const blockedProjects = snapshots.filter((snapshot) =>
    snapshot.currentGoalState === "blocked" || snapshot.currentGoalState === "qa_failed",
  );
  const pendingApprovals = approvals.map((approval) => {
    const goal = goalById.get(approval.goalId);
    return {
      projectId: goal?.projectId ?? "unknown",
      goalTitle: goal?.title ?? approval.goalId,
      actionType: approval.type,
      rationale: approval.rationale,
    };
  });

  return {
    activeProjects,
    queuedProjects,
    pausedProjects,
    blockedProjects,
    pendingApprovals,
  };
}

function renderProjectLine(project: GovernorProjectSnapshot) {
  const suffix = [
    `우선순위 ${project.priority}`,
    project.currentGoalTitle ? `목표 ${project.currentGoalTitle}` : null,
    project.queuedAt ? `대기 ${project.queuedAt}` : null,
  ].filter(Boolean);
  return `  • #${project.projectId}${suffix.length > 0 ? ` · ${suffix.join(" · ")}` : ""}`;
}

export function buildGovernorStatusSnapshotText(snapshot: GovernorSnapshot) {
  const lines = [
    "🧭 총괄 상태",
    `- 활성 프로젝트: ${snapshot.activeProjects.length}`,
  ];
  if (snapshot.activeProjects.length > 0) {
    lines.push(...snapshot.activeProjects.map(renderProjectLine));
  }
  lines.push(`- 대기 프로젝트: ${snapshot.queuedProjects.length}`);
  if (snapshot.queuedProjects.length > 0) {
    lines.push(...snapshot.queuedProjects.map(renderProjectLine));
  }
  lines.push(`- 승인 대기: ${snapshot.pendingApprovals.length}`);
  if (snapshot.pendingApprovals.length > 0) {
    lines.push(
      ...snapshot.pendingApprovals.map(
        (approval) =>
          `  • #${approval.projectId} · ${approval.actionType} · ${approval.goalTitle}`,
      ),
    );
  }
  lines.push(`- 일시정지: ${snapshot.pausedProjects.length}`);
  if (snapshot.pausedProjects.length > 0) {
    lines.push(...snapshot.pausedProjects.map(renderProjectLine));
  }
  if (snapshot.blockedProjects.length > 0) {
    lines.push(`- 차단 프로젝트: ${snapshot.blockedProjects.length}`);
    lines.push(...snapshot.blockedProjects.map(renderProjectLine));
  }
  return lines.join("\n");
}

export function buildGovernorQueueText(snapshot: GovernorSnapshot) {
  const lines = ["🧭 총괄 대기열", `- 대기 프로젝트: ${snapshot.queuedProjects.length}`];
  if (snapshot.queuedProjects.length === 0) {
    lines.push("- 상태: 현재 대기 중인 프로젝트가 없어요.");
    return lines.join("\n");
  }
  lines.push(...snapshot.queuedProjects.map(renderProjectLine));
  return lines.join("\n");
}

export function buildGovernorApprovalBacklogText(snapshot: GovernorSnapshot) {
  const lines = ["🛑 총괄 승인 대기", `- 승인 대기 건수: ${snapshot.pendingApprovals.length}`];
  if (snapshot.pendingApprovals.length === 0) {
    lines.push("- 상태: 지금은 사람 확인이 필요한 건이 없어요.");
    return lines.join("\n");
  }
  lines.push(
    ...snapshot.pendingApprovals.map((approval) =>
      `  • #${approval.projectId} · ${approval.actionType} · ${approval.goalTitle}${approval.rationale ? ` · ${approval.rationale}` : ""}`,
    ),
  );
  return lines.join("\n");
}

export function buildGovernorPolicyChangeText(input: {
  projectId: string;
  action: "pause" | "resume" | "reprioritize";
  priority?: number;
}) {
  const lines = [
    "🧭 총괄 정책 변경",
    `- 프로젝트: #${input.projectId}`,
  ];
  if (input.action === "pause") {
    lines.push("- 반영: 일시정지");
    lines.push("- 영향: 새 슬롯 배정에서 제외돼요.");
  } else if (input.action === "resume") {
    lines.push("- 반영: 재개");
    lines.push("- 영향: 다음 슬롯 배정부터 다시 후보가 돼요.");
  } else {
    lines.push(`- 반영: 우선순위: ${input.priority}`);
    lines.push("- 영향: 다음 arbitration부터 순서에 반영돼요.");
  }
  return lines.join("\n");
}
