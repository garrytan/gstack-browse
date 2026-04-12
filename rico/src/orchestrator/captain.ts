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
    const record = this.portfolio.get(input.projectId);
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

  getPortfolioRecord(projectId: string) {
    const record = this.portfolio.get(projectId);
    return record ? { ...record } : null;
  }
}
