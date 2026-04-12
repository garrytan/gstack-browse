import { MemoryStore } from "../memory/store";
import type { CaptainPlan } from "./captain-plan";
import type { SpecialistResult } from "../roles/contracts";
import {
  preserveSpecialistImpacts,
  type SpecialistImpact,
} from "./specialists";

interface PortfolioRecord {
  projectId: string;
  aiOpsChannelId: string;
  projectChannelId: string;
  intakeThreadTs: string;
  latestGoalTitle: string;
}

export class Captain {
  private readonly portfolio = new Map<string, PortfolioRecord>();
  private readonly specialistResults = new Map<string, SpecialistResult[]>();
  private readonly plans = new Map<string, CaptainPlan>();

  constructor(private readonly memoryStore?: MemoryStore) {}

  handleAiOpsIntake(input: {
    projectId: string;
    aiOpsChannelId: string;
    projectChannelId: string;
    intakeThreadTs: string;
    title: string;
  }) {
    const record: PortfolioRecord = {
      projectId: input.projectId,
      aiOpsChannelId: input.aiOpsChannelId,
      projectChannelId: input.projectChannelId,
      intakeThreadTs: input.intakeThreadTs,
      latestGoalTitle: input.title,
    };

    this.portfolio.set(input.projectId, record);
    if (this.memoryStore) {
      this.memoryStore.putProjectFact(
        input.projectId,
        "captain.portfolio_json",
        JSON.stringify(record),
      );
    }
    return {
      portfolioRecord: { ...record },
    };
  }

  composeProjectSummary(input: {
    projectId: string;
    projectThreadTs: string;
    summary: string;
    impacts: SpecialistImpact[];
  }) {
    const record = this.getPortfolioRecord(input.projectId);
    if (!record) {
      throw new Error(`unknown project: ${input.projectId}`);
    }

    return {
      channelId: record.projectChannelId,
      threadTs: input.projectThreadTs,
      summary: input.summary,
      impacts: preserveSpecialistImpacts(input.impacts),
    };
  }

  capturePlan(projectId: string, runId: string | null, plan: CaptainPlan) {
    if (!this.getPortfolioRecord(projectId)) {
      throw new Error(`unknown project: ${projectId}`);
    }
    const cloned = {
      ...plan,
      selectedRoles: [...plan.selectedRoles],
      taskGraph: plan.taskGraph.map((task) => ({
        ...task,
        dependsOn: [...task.dependsOn],
      })),
    };
    this.plans.set(projectId, cloned);

    if (this.memoryStore) {
      this.memoryStore.putProjectFact(
        projectId,
        "captain.plan_json",
        JSON.stringify(cloned),
      );
      this.memoryStore.putProjectFact(projectId, "captain.next_action", cloned.nextAction);
      if (cloned.blockedReason) {
        this.memoryStore.putProjectFact(projectId, "captain.blocked_reason", cloned.blockedReason);
      }
      if (runId) {
        this.memoryStore.putRunFact(runId, "captain.plan_json", JSON.stringify(cloned));
      }
    }

    return {
      ...cloned,
      selectedRoles: [...cloned.selectedRoles],
      taskGraph: cloned.taskGraph.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    };
  }

  getPortfolioRecord(projectId: string) {
    const inMemory = this.portfolio.get(projectId);
    if (inMemory) {
      return { ...inMemory };
    }

    const persisted = this.readPersistedPortfolio(projectId);
    if (!persisted) return null;

    this.portfolio.set(projectId, persisted);
    return { ...persisted };
  }

  captureSpecialistResults(projectId: string, results: SpecialistResult[]) {
    if (!this.getPortfolioRecord(projectId)) {
      throw new Error(`unknown project: ${projectId}`);
    }
    const cloned = results.map((result) => ({
      ...result,
      artifacts: result.artifacts.map((artifact) => ({ ...artifact })),
      rawFindings: result.rawFindings ? [...result.rawFindings] : undefined,
    }));
    this.specialistResults.set(projectId, cloned);

    if (this.memoryStore) {
      for (const result of cloned) {
        this.memoryStore.putProjectFact(
          projectId,
          `captain.specialist.${result.role}.result_json`,
          JSON.stringify(result),
        );
      }
    }
  }

  getStoredSpecialistResults(projectId: string) {
    const inMemory = this.specialistResults.get(projectId);
    if (inMemory) {
      return inMemory.map((result) => ({
        ...result,
        artifacts: result.artifacts.map((artifact) => ({ ...artifact })),
        rawFindings: result.rawFindings ? [...result.rawFindings] : undefined,
      }));
    }

    const persisted = this.readPersistedSpecialistResults(projectId);
    this.specialistResults.set(projectId, persisted);
    return persisted.map((result) => ({
      ...result,
      artifacts: result.artifacts.map((artifact) => ({ ...artifact })),
      rawFindings: result.rawFindings ? [...result.rawFindings] : undefined,
    }));
  }

  getStoredPlan(projectId: string) {
    const inMemory = this.plans.get(projectId);
    if (inMemory) {
      return {
        ...inMemory,
        selectedRoles: [...inMemory.selectedRoles],
        taskGraph: inMemory.taskGraph.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
      };
    }

    const persisted = this.readPersistedPlan(projectId);
    if (!persisted) return null;
    this.plans.set(projectId, persisted);
    return {
      ...persisted,
      selectedRoles: [...persisted.selectedRoles],
      taskGraph: persisted.taskGraph.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    };
  }

  promoteRunResultsToProject(projectId: string, runId: string) {
    if (!this.getPortfolioRecord(projectId)) {
      throw new Error(`unknown project: ${projectId}`);
    }

    const runResults = this.readPersistedRunSpecialistResults(runId);
    if (runResults.length === 0) return [];

    this.captureSpecialistResults(projectId, runResults);
    return this.getStoredSpecialistResults(projectId);
  }

  private readPersistedPortfolio(projectId: string) {
    if (!this.memoryStore) return null;

    const memory = this.memoryStore.getProjectMemory(projectId);
    const raw = memory["captain.portfolio_json"];
    if (!raw) return null;

    return JSON.parse(raw) as PortfolioRecord;
  }

  private readPersistedSpecialistResults(projectId: string) {
    if (!this.memoryStore) return [];

    const memory = this.memoryStore.getProjectMemory(projectId);
    return Object.entries(memory)
      .filter(([key]) => key.startsWith("captain.specialist.") && key.endsWith(".result_json"))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => JSON.parse(value) as SpecialistResult);
  }

  private readPersistedPlan(projectId: string) {
    if (!this.memoryStore) return null;
    const memory = this.memoryStore.getProjectMemory(projectId);
    const raw = memory["captain.plan_json"];
    if (!raw) return null;
    return JSON.parse(raw) as CaptainPlan;
  }

  private readPersistedRunSpecialistResults(runId: string) {
    if (!this.memoryStore) return [];

    const memory = this.memoryStore.getRunMemory(runId);
    return Object.entries(memory)
      .filter(([key]) => key.startsWith("specialist.") && key.endsWith(".result_json"))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => JSON.parse(value) as SpecialistResult);
  }
}
