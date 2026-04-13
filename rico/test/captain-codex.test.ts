import { expect, test } from "bun:test";
import { parseCodexCaptainPlanResponse } from "../src/codex/captain";
import { normalizeCaptainPlanForGoal } from "../src/orchestrator/captain-plan";

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

test("normalizeCaptainPlanForGoal corrects obvious repo questions toward backend", () => {
  const normalized = normalizeCaptainPlanForGoal(
    "지금 원격 깃 연결 상태만 확인해줘",
    {
      selectedRoles: ["planner"],
      nextAction: "planner가 저장소가 Git 작업 트리인지 확인한다.",
      blockedReason: null,
      status: "active",
      taskGraph: [
        {
          id: "task-1",
          role: "planner",
          title: "저장소 확인",
          dependsOn: [],
        },
      ],
    },
  );

  expect(normalized.selectedRoles).toEqual(["backend"]);
  expect(normalized.taskGraph[0]?.role).toBe("backend");
  expect(normalized.nextAction).toContain("원격 저장소");
  expect(normalized.taskGraph[0]?.title).toContain("원격 저장소");
});

test("normalizeCaptainPlanForGoal expands empty task graphs into goal-sensitive delegation titles", () => {
  const normalized = normalizeCaptainPlanForGoal(
    "이 채널 목표를 한 줄로 제안해줘",
    {
      selectedRoles: ["planner", "customer-voice"],
      nextAction: "planner 관점에서 핵심 전제와 다음 단계를 먼저 정리한다.",
      blockedReason: null,
      status: "active",
      taskGraph: [],
    },
  );

  expect(normalized.taskGraph).toHaveLength(2);
  expect(normalized.taskGraph[0]?.title).not.toContain("1차 검토");
  expect(normalized.taskGraph[0]?.title).toContain("목표");
  expect(normalized.taskGraph[1]?.title).toContain("사용자");
  expect(normalized.nextAction).not.toContain("planner");
  expect(normalized.nextAction).toContain("목표 후보");
});

test("normalizeCaptainPlanForGoal drops planner from concrete implementation loops unless a planning doc is requested", () => {
  const normalized = normalizeCaptainPlanForGoal(
    "실제 수정까지 진행해줘. UX writing을 보완하고 네비게이션을 이어줘",
    {
      selectedRoles: ["planner", "frontend", "backend", "qa"],
      nextAction: "기획이 먼저 수정 범위를 고정한다.",
      blockedReason: null,
      status: "active",
      taskGraph: [
        {
          id: "task-1",
          role: "planner",
          title: "수정 범위 확정",
          dependsOn: [],
        },
        {
          id: "task-2",
          role: "frontend",
          title: "랜딩 네비게이션 수정",
          dependsOn: ["task-1"],
        },
        {
          id: "task-3",
          role: "backend",
          title: "엔드포인트 보완",
          dependsOn: ["task-2"],
        },
      ],
    },
  );

  expect(normalized.selectedRoles).toEqual(["designer", "frontend", "backend", "qa"]);
  expect(normalized.taskGraph.map((task) => task.role)).toEqual(["designer", "frontend", "backend"]);
  expect(normalized.taskGraph[0]?.dependsOn).toEqual([]);
  expect(normalized.taskGraph[1]?.dependsOn).toContain("task-design");
});
