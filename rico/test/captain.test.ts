import { expect, test } from "bun:test";
import { Captain } from "../src/orchestrator/captain";
import { splitOversizedGoal } from "../src/orchestrator/initiative";

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
