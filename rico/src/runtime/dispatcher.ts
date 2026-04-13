import type { Database } from "bun:sqlite";
import { MemoryStore } from "../memory/store";
import { evaluateAction } from "../orchestrator/approvals";
import { Captain } from "../orchestrator/captain";
import {
  buildFallbackCaptainPlan,
  normalizeCaptainPlanForGoal,
  type CaptainPlan,
} from "../orchestrator/captain-plan";
import {
  applyCustomerVoiceDecisionToPlan,
  decideCustomerVoiceDelegation,
  ensureProjectCustomerVoiceProfile,
} from "../orchestrator/customer-voice-director";
import { Governor } from "../orchestrator/governor";
import { runSpecialist, type SpecialistExecutor } from "../orchestrator/specialists";
import { ensureDefaultRolePlaybooks } from "../roles/playbooks";
import type { SpecialistResult } from "../roles/contracts";
import { buildApprovalRequest, type SlackMessageClient } from "../slack/publish";
import {
  buildCaptainFinalText,
  buildCaptainStartText,
  buildGovernorFinalText,
  buildImpactNarration,
  buildRoutingText,
} from "../slack/message-style";
import type { LoadedRunContext } from "./job-runner";
import { createRepositories } from "../state/repositories";

interface GoalIntakePayload {
  goalId: string;
  projectId: string;
  text: string;
  aiOpsChannelId: string;
  intakeThreadTs: string;
  projectChannelId: string;
  projectThreadTs?: string;
  sourceChannelId: string;
  isFinalGoal: boolean;
  requiresDeployApproval: boolean;
}

function asGoalIntakePayload(payload: unknown): GoalIntakePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.goalId !== "string" ||
    typeof candidate.projectId !== "string" ||
    typeof candidate.text !== "string" ||
    typeof candidate.intakeThreadTs !== "string" ||
    typeof candidate.projectChannelId !== "string" ||
    typeof candidate.sourceChannelId !== "string"
  ) {
    return null;
  }

  return {
    goalId: candidate.goalId,
    projectId: candidate.projectId,
    text: candidate.text,
    aiOpsChannelId: typeof candidate.aiOpsChannelId === "string" ? candidate.aiOpsChannelId : "",
    intakeThreadTs: candidate.intakeThreadTs,
    projectChannelId: candidate.projectChannelId,
    projectThreadTs:
      typeof candidate.projectThreadTs === "string" ? candidate.projectThreadTs : undefined,
    sourceChannelId: candidate.sourceChannelId,
    isFinalGoal: candidate.isFinalGoal === true,
    requiresDeployApproval: candidate.requiresDeployApproval === true,
  };
}

function requestApproval(input: {
  db: Database;
  approvalId: string;
  goalId: string;
  fromState: string;
  toState: string;
  actor: string;
  actionType: string;
  rationale: string | null;
  createdAt?: string;
}) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  input.db.transaction(() => {
    input.db.query(
      `insert into approvals (id, goal_id, type, status, rationale)
       values (?, ?, ?, ?, ?)`,
    ).run(
      input.approvalId,
      input.goalId,
      input.actionType,
      "pending",
      input.rationale,
    );
    input.db.query(
      `insert into state_transitions (id, goal_id, from_state, to_state, created_at, actor)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      `transition-${input.approvalId}`,
      input.goalId,
      input.fromState,
      input.toState,
      createdAt,
      input.actor,
    );
    const updateResult = input.db
      .query("update goals set state = ? where id = ?")
      .run(input.toState, input.goalId) as { changes?: number } | undefined;
    if (!updateResult || updateResult.changes !== 1) {
      throw new Error(`Goal not found for approval: ${input.goalId}`);
    }
  })();
}

function buildRoleExecutionOrder(plan: CaptainPlan, selectedRoles: string[]) {
  const ordered: string[] = [];

  for (const task of plan.taskGraph ?? []) {
    if (!selectedRoles.includes(task.role)) continue;
    if (!ordered.includes(task.role)) {
      ordered.push(task.role);
    }
  }

  for (const role of selectedRoles) {
    if (!ordered.includes(role)) {
      ordered.push(role);
    }
  }

  return ordered;
}

function determineFinalGoalState(
  impacts: Array<{ level: "info" | "blocking" | "approval_needed"; role: string }>,
) {
  if (impacts.some((impact) => impact.level === "blocking")) {
    return impacts.some((impact) => impact.role === "qa") ? "qa_failed" : "blocked";
  }
  if (impacts.some((impact) => impact.level === "approval_needed")) {
    return "awaiting_human_approval";
  }
  return "approved";
}

async function executeRole(input: {
  role: string;
  payload: GoalIntakePayload;
  context: LoadedRunContext;
  memoryStore: MemoryStore;
  specialistExecutor?: SpecialistExecutor;
  customerVoiceDecision?: ReturnType<typeof decideCustomerVoiceDelegation>;
}) {
  if (input.role !== "customer-voice" || !input.customerVoiceDecision?.enabled) {
    const result = await runSpecialist({
      role: input.role as Parameters<typeof runSpecialist>[0]["role"],
      input: {
        projectId: input.payload.projectId,
        runId: input.context.run.id,
        goalTitle: input.context.goal.title,
      },
      memoryStore: input.memoryStore,
      executor: input.specialistExecutor,
    });
    return [result];
  }

  const personas = input.customerVoiceDecision.selectedPersonas.length > 0
    ? input.customerVoiceDecision.selectedPersonas
    : [];

  if (personas.length === 0) {
    const result = await runSpecialist({
      role: "customer-voice",
      input: {
        projectId: input.payload.projectId,
        runId: input.context.run.id,
        goalTitle: input.context.goal.title,
        customerVoiceDecision: input.customerVoiceDecision,
      },
      memoryStore: input.memoryStore,
      executor: input.specialistExecutor,
    });
    return [result];
  }

  const results: SpecialistResult[] = [];
  for (const persona of personas) {
    const result = await runSpecialist({
      role: "customer-voice",
      input: {
        projectId: input.payload.projectId,
        runId: input.context.run.id,
        goalTitle: input.context.goal.title,
        personaLabel: persona.label,
        customerVoiceDecision: input.customerVoiceDecision,
        customerVoicePersona: persona,
      },
      memoryStore: input.memoryStore,
      executor: input.specialistExecutor,
    });
    results.push({
      ...result,
      personaLabel: result.personaLabel ?? persona.label,
    });
  }
  return results;
}

export function createRuntimeDispatcher(input: {
  db: Database;
  slackClient: SlackMessageClient;
  maxActiveProjects: number;
  specialistExecutor?: SpecialistExecutor;
  captainExecutor?: (input: {
    projectId: string;
    goalTitle: string;
    runId?: string | null;
    memoryStore?: MemoryStore;
  }) => Promise<CaptainPlan>;
}) {
  const memoryStore = new MemoryStore(input.db);
  const repositories = createRepositories(input.db);
  ensureDefaultRolePlaybooks(memoryStore);
  for (const project of repositories.projects.list()) {
    ensureProjectCustomerVoiceProfile({
      memoryStore,
      projectId: project.id,
    });
  }
  const captain = new Captain(memoryStore);
  const governor = new Governor({ maxActiveProjects: input.maxActiveProjects });

  return async function dispatch(context: LoadedRunContext) {
    const payload = asGoalIntakePayload(context.job.payload);
    if (!payload) {
      return;
    }

    governor.registerProject({
      id: context.project.id,
      channelId: context.project.slackChannelId,
    });
    const started = governor.startProject(context.project.id);
    if (!started.ok) {
      throw new Error(`Project cannot start: ${started.reason}`);
    }

    try {
      const portfolio = captain.getPortfolioRecord(payload.projectId)
        ?? captain.handleAiOpsIntake({
          projectId: payload.projectId,
          aiOpsChannelId: payload.aiOpsChannelId,
          projectChannelId: payload.projectChannelId,
          intakeThreadTs: payload.intakeThreadTs,
          title: payload.text,
        }).portfolioRecord;

      input.db.query(
        "update goals set state = 'in_progress' where id = ?",
      ).run(payload.goalId);
      ensureProjectCustomerVoiceProfile({
        memoryStore,
        projectId: payload.projectId,
      });

      let projectThreadTs = payload.projectThreadTs;
      const rawCaptainPlan = normalizeCaptainPlanForGoal(
        context.goal.title,
        input.captainExecutor
        ? await input.captainExecutor({
            projectId: payload.projectId,
            goalTitle: context.goal.title,
            runId: context.run.id,
            memoryStore,
          })
        : buildFallbackCaptainPlan(context.goal.title),
      );
      const customerVoiceDecision = decideCustomerVoiceDelegation({
        memoryStore,
        projectId: payload.projectId,
        goalTitle: context.goal.title,
        selectedRoles: rawCaptainPlan.selectedRoles,
      });
      const captainPlan = applyCustomerVoiceDecisionToPlan({
        plan: rawCaptainPlan,
        decision: customerVoiceDecision,
        goalTitle: context.goal.title,
      });
      if (context.run.id) {
        memoryStore.putRunFact(
          context.run.id,
          "customer_voice.decision_json",
          JSON.stringify(customerVoiceDecision),
        );
      }
      const specialistRoles = captainPlan.selectedRoles.length > 0
        ? captainPlan.selectedRoles
        : buildFallbackCaptainPlan(context.goal.title).selectedRoles;
      captain.capturePlan(payload.projectId, context.run.id, captainPlan);
      for (const task of captainPlan.taskGraph) {
        input.db.query(
          `insert into tasks (id, goal_id, run_id, role, state, payload_json)
           values (?, ?, ?, ?, ?, ?)
           on conflict(id) do update set
             goal_id = excluded.goal_id,
             run_id = excluded.run_id,
             role = excluded.role,
             state = excluded.state,
             payload_json = excluded.payload_json`,
        ).run(
          `${context.run.id}:${task.id}`,
          payload.goalId,
          context.run.id,
          task.role,
          "planned",
          JSON.stringify(task),
        );
      }
      if (!projectThreadTs) {
        const root = await input.slackClient.postMessage({
          channel: portfolio.projectChannelId,
          text: buildCaptainStartText(context.goal.title, specialistRoles, captainPlan),
        });
        if (!root.ok || !root.ts) {
          throw new Error("Slack rejected project thread root");
        }
        projectThreadTs = root.ts;
      } else {
        const ack = await input.slackClient.postMessage({
          channel: portfolio.projectChannelId,
          thread_ts: projectThreadTs,
          text: buildCaptainStartText(context.goal.title, specialistRoles, captainPlan),
        });
        if (!ack.ok) {
          throw new Error("Slack rejected project thread acknowledgement");
        }
      }

      if (
        payload.sourceChannelId
        && payload.sourceChannelId !== payload.projectChannelId
      ) {
        const governorUpdate = await input.slackClient.postMessage({
          channel: payload.sourceChannelId,
          thread_ts: payload.intakeThreadTs,
          text: buildRoutingText(payload.projectId, captainPlan),
        });
        if (!governorUpdate.ok) {
          throw new Error("Slack rejected governor routing update");
        }
      }

      const specialistResults = [];
      for (const role of buildRoleExecutionOrder(captainPlan, specialistRoles)) {
        const results = await executeRole({
          role,
          payload,
          context,
          memoryStore,
          specialistExecutor: input.specialistExecutor,
          customerVoiceDecision,
        });
        for (const result of results) {
          specialistResults.push(result);
          const message = await input.slackClient.postMessage({
            channel: portfolio.projectChannelId,
            thread_ts: projectThreadTs,
            text: buildImpactNarration({
              role: result.role,
              summary: result.summary,
              level: result.impact,
              changedFiles: result.changedFiles,
              verificationNotes: result.verificationNotes,
              executionMode: result.executionMode,
              personaLabel: result.personaLabel,
            }),
          });
          if (!message.ok) {
            throw new Error(`Slack rejected ${result.role} impact message`);
          }
        }
      }
      captain.captureSpecialistResults(payload.projectId, specialistResults);

      const baseFinalGoalState = determineFinalGoalState(
        specialistResults.map((result) => ({
          role: result.role,
          level: result.impact,
        })),
      );
      const deployDecision =
        baseFinalGoalState === "approved" && payload.isFinalGoal && payload.requiresDeployApproval
          ? evaluateAction({ type: "deploy" })
          : null;
      const finalGoalState =
        deployDecision && !deployDecision.allowed
          ? deployDecision.state
          : baseFinalGoalState;

      const summary = captain.composeProjectSummary({
        projectId: payload.projectId,
        projectThreadTs: projectThreadTs,
        summary: buildCaptainFinalText({
          finalState: finalGoalState,
          impacts: specialistResults.map((result) => ({
            role: result.role,
            level: result.impact,
            message: result.summary,
            changedFiles: result.changedFiles,
            verificationNotes: result.verificationNotes,
          })),
          nextAction: captainPlan.nextAction,
        }),
        impacts: specialistResults.map((result) => ({
          role: result.role,
          level: result.impact,
          message: result.summary,
        })),
      });
      const summaryResponse = await input.slackClient.postMessage({
        channel: summary.channelId,
        thread_ts: summary.threadTs,
        text: summary.summary,
      });
      if (!summaryResponse.ok) {
        throw new Error("Slack rejected project summary");
      }

      if (
        payload.sourceChannelId
        && payload.sourceChannelId !== payload.projectChannelId
      ) {
        const leadImpact = [...specialistResults].sort((left, right) => {
          const rank = { blocking: 0, approval_needed: 1, info: 2 } as const;
          return rank[left.impact] - rank[right.impact];
        })[0] ?? null;
        const governorFinal = await input.slackClient.postMessage({
          channel: payload.sourceChannelId,
          thread_ts: payload.intakeThreadTs,
          text: buildGovernorFinalText({
            projectId: payload.projectId,
            finalState: finalGoalState,
            leadSummary: leadImpact?.summary ?? null,
            changedFiles: specialistResults.flatMap((result) => result.changedFiles ?? []),
            nextAction: captainPlan.nextAction,
          }),
        });
        if (!governorFinal.ok) {
          throw new Error("Slack rejected governor completion update");
        }
      }

      if (deployDecision && !deployDecision.allowed) {
          const approvalId = `approval-${context.run.id}`;
          requestApproval({
            db: input.db,
            approvalId,
            goalId: payload.goalId,
            actionType: "deploy",
            rationale: deployDecision.blockingReason ?? null,
            fromState: "in_progress",
            toState: deployDecision.state,
            actor: "governor",
          });

          const approvalRequest = buildApprovalRequest({
            approvalId,
            goalId: payload.goalId,
            actionType: "deploy",
            blockingReason: deployDecision.blockingReason ?? "deployment requires human approval",
            channelId: payload.aiOpsChannelId,
            threadTs: payload.intakeThreadTs,
          });
          const approvalMessage = await input.slackClient.postMessage({
            channel: payload.aiOpsChannelId,
            thread_ts: payload.intakeThreadTs,
            text: approvalRequest.text,
            blocks: approvalRequest.blocks,
            metadata: approvalRequest.metadata,
          });
          if (!approvalMessage.ok) {
            throw new Error("Slack rejected approval request");
          }
      } else {
        const currentGoalState = repositories.goals.get(payload.goalId)?.state ?? context.goal.state;
        if (currentGoalState !== finalGoalState) {
          repositories.stateTransitions.append({
            id: `transition-${context.run.id}-final`,
            goalId: payload.goalId,
            fromState: currentGoalState,
            toState: finalGoalState,
            createdAt: new Date().toISOString(),
            actor: "captain",
          });
        }
      }
    } finally {
      governor.finishProject(context.project.id);
    }
  };
}
