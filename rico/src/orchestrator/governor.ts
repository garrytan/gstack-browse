interface GovernorProjectRecord {
  channelId: string;
  priority: number;
  paused: boolean;
  queuedAt?: string;
}

type StartProjectResult =
  | { ok: true }
  | { ok: false; reason: "project_paused" | "slot_limit_exceeded" };

export class Governor {
  private readonly active = new Set<string>();
  private readonly projects = new Map<string, GovernorProjectRecord>();

  constructor(private readonly policy: { maxActiveProjects: number }) {}

  registerProject(input: { id: string; channelId: string }) {
    const existing = this.projects.get(input.id);
    this.projects.set(input.id, {
      channelId: input.channelId,
      priority: existing?.priority ?? 0,
      paused: existing?.paused ?? false,
      queuedAt: existing?.queuedAt,
    });
  }

  startProject(projectId: string): StartProjectResult {
    const project = this.getProject(projectId);
    if (project.paused) {
      return { ok: false, reason: "project_paused" };
    }
    if (!this.active.has(projectId) && this.active.size >= this.policy.maxActiveProjects) {
      return { ok: false, reason: "slot_limit_exceeded" };
    }

    this.active.add(projectId);
    return { ok: true };
  }

  finishProject(projectId: string) {
    this.active.delete(projectId);
  }

  handleAiOpsCommand(input: {
    action: "reprioritize" | "pause" | "resume";
    projectId: string;
    priority?: number;
  }) {
    const project = this.getProject(input.projectId);
    if (input.action === "reprioritize") {
      project.priority = input.priority ?? project.priority;
    }
    if (input.action === "pause") {
      project.paused = true;
    }
    if (input.action === "resume") {
      project.paused = false;
    }
  }

  snapshot(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) return null;

    return {
      channelId: project.channelId,
      priority: project.priority,
      paused: project.paused,
      queuedAt: project.queuedAt,
      active: this.active.has(projectId),
    };
  }

  markQueued(projectId: string, queuedAt: string) {
    const project = this.getProject(projectId);
    project.queuedAt = queuedAt;
  }

  chooseNextProject(projectIds: string[]) {
    return [...projectIds]
      .map((id) => ({ id, ...this.getProject(id) }))
      .filter((project) => !project.paused)
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }

        const leftQueued = left.queuedAt ?? "9999-12-31T23:59:59.999Z";
        const rightQueued = right.queuedAt ?? "9999-12-31T23:59:59.999Z";
        return leftQueued.localeCompare(rightQueued);
      })[0]?.id ?? null;
  }

  private getProject(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`unknown project: ${projectId}`);
    }
    return project;
  }
}
