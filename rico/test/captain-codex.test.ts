import { expect, test } from "bun:test";
import { parseCodexCaptainPlanResponse } from "../src/codex/captain";

test("parseCodexCaptainPlanResponse accepts structured captain planning json", () => {
  const plan = parseCodexCaptainPlanResponse(`
    {
      "selectedRoles": ["planner", "customer-voice"],
      "nextAction": "핵심 목표 문장을 먼저 고정한다.",
      "blockedReason": null,
      "status": "active",
      "taskGraph": [
        {
          "id": "task-1",
          "role": "planner",
          "title": "목표 문장 정리",
          "dependsOn": []
        }
      ]
    }
  `);

  expect(plan).toEqual({
    selectedRoles: ["planner", "customer-voice"],
    nextAction: "핵심 목표 문장을 먼저 고정한다.",
    blockedReason: null,
    status: "active",
    taskGraph: [
      {
        id: "task-1",
        role: "planner",
        title: "목표 문장 정리",
        dependsOn: [],
      },
    ],
  });
});

test("parseCodexCaptainPlanResponse rejects invalid role names", () => {
  expect(() =>
    parseCodexCaptainPlanResponse(`
      {
        "selectedRoles": ["wizard"],
        "nextAction": "정리한다.",
        "blockedReason": null,
        "status": "active",
        "taskGraph": []
      }
    `)
  ).toThrow("Codex captain response was not valid JSON");
});
