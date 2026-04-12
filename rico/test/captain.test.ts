import { expect, test } from "bun:test";
import { Captain } from "../src/orchestrator/captain";
import { MemoryStore } from "../src/memory/store";
import { splitOversizedGoal } from "../src/orchestrator/initiative";
import { openStore } from "../src/state/store";

test("splitOversizedGoal converts more than eight tasks into initiative phases", () => {
  const plan = splitOversizedGoal({
    projectId: "mypetroutine",
    title: "rebuild onboarding and retention flow",
    tasks: Array.from({ length: 10 }, (_, index) => `task-${index + 1}`),
  });

  expect(plan.kind).toBe("initiative");
  expect(plan.goals.length).toBeGreaterThan(1);
});

test("Captain keeps raw specialist impacts in the summary", () => {
  const captain = new Captain();

  captain.handleAiOpsIntake({
    projectId: "mypetroutine",
    aiOpsChannelId: "C_AI_OPS",
    projectChannelId: "C_PROJECT",
    intakeThreadTs: "1710000000.000100",
    title: "improve onboarding conversion",
  });

  const summary = captain.composeProjectSummary({
    projectId: "mypetroutine",
    projectThreadTs: "1710000000.000200",
    summary: "QA blocked the rollout",
    impacts: [{ role: "qa", level: "blocking", message: "Regression found" }],
  });

  expect(summary.impacts).toEqual([
    { role: "qa", level: "blocking", message: "Regression found" },
  ]);
});

test("Captain stores ai-ops intake in the portfolio and narrates project work in the mapped project channel", () => {
  const captain = new Captain();

  const intake = captain.handleAiOpsIntake({
    projectId: "mypetroutine",
    aiOpsChannelId: "C_AI_OPS",
    projectChannelId: "C_PROJECT",
    intakeThreadTs: "1710000000.000100",
    title: "improve onboarding conversion",
  });

  expect(intake.portfolioRecord).toMatchObject({
    projectId: "mypetroutine",
    aiOpsChannelId: "C_AI_OPS",
    projectChannelId: "C_PROJECT",
    latestGoalTitle: "improve onboarding conversion",
  });

  const narration = captain.composeProjectSummary({
    projectId: "mypetroutine",
    projectThreadTs: "1710000000.000200",
    summary: "Planner and QA finished the first pass",
    impacts: [{ role: "planner", level: "info", message: "Plan ready" }],
  });

  expect(narration.channelId).toBe("C_PROJECT");
  expect(narration.channelId).not.toBe("C_AI_OPS");
  expect(narration.threadTs).toBe("1710000000.000200");
});

test("Captain persists a structured plan with next action and blocked reason", () => {
  const db = openStore(":memory:");
  const memoryStore = new MemoryStore(db.db);
  const firstCaptain = new Captain(memoryStore);

  firstCaptain.handleAiOpsIntake({
    projectId: "mypetroutine",
    aiOpsChannelId: "C_AI_OPS",
    projectChannelId: "C_PROJECT",
    intakeThreadTs: "1710000000.000100",
    title: "improve onboarding conversion",
  });
  firstCaptain.capturePlan("mypetroutine", "run-1", {
    selectedRoles: ["planner", "customer-voice"],
    nextAction: "핵심 목표 문장을 먼저 고정한다.",
    blockedReason: "사용자 약속 문장이 아직 흐리다.",
    status: "needs_decision",
    taskGraph: [
      {
        id: "task-1",
        role: "planner",
        title: "목표 문장 정리",
        dependsOn: [],
      },
    ],
  });

  const restartedCaptain = new Captain(memoryStore);
  expect(restartedCaptain.getStoredPlan("mypetroutine")).toEqual({
    selectedRoles: ["planner", "customer-voice"],
    nextAction: "핵심 목표 문장을 먼저 고정한다.",
    blockedReason: "사용자 약속 문장이 아직 흐리다.",
    status: "needs_decision",
    taskGraph: [
      {
        id: "task-1",
        role: "planner",
        title: "목표 문장 정리",
        dependsOn: [],
      },
    ],
  });

  db.db.close();
});
