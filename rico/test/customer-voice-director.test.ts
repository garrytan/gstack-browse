import { expect, test } from "bun:test";
import {
  applyCustomerVoiceDecisionToPlan,
  decideCustomerVoiceDelegation,
  ensureProjectCustomerVoiceProfile,
  readProjectCustomerVoiceProfile,
} from "../src/orchestrator/customer-voice-director";
import type { CaptainPlan } from "../src/orchestrator/captain-plan";
import { MemoryStore } from "../src/memory/store";
import { openStore } from "../src/state/store";

function basePlan(selectedRoles: CaptainPlan["selectedRoles"]): CaptainPlan {
  return {
    selectedRoles,
    nextAction: "다음 액션을 정한다.",
    blockedReason: null,
    status: "active",
    taskGraph: selectedRoles.map((role, index) => ({
      id: `task-${index + 1}`,
      role,
      title: `${role} task`,
      dependsOn: index === 0 ? [] : [`task-${index}`],
    })),
  };
}

test("ensureProjectCustomerVoiceProfile seeds generic fallback for ambiguous projects", () => {
  const store = openStore(":memory:");
  const memoryStore = new MemoryStore(store.db);

  ensureProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "test",
  });

  const profile = readProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "test",
  });

  expect(profile.mode).toBe("generic");
  expect(profile.needsSetup).toBe(true);
  expect(profile.personas.length).toBe(1);
  expect(profile.personas[0]?.label).toContain("초기");

  store.db.close();
});

test("ensureProjectCustomerVoiceProfile seeds persona-driven defaults for known projects", () => {
  const store = openStore(":memory:");
  const memoryStore = new MemoryStore(store.db);

  ensureProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "sherpalabs",
  });

  const profile = readProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "sherpalabs",
  });

  expect(profile.mode).toBe("persona-driven");
  expect(profile.needsSetup).toBe(false);
  expect(profile.personas.length).toBeGreaterThanOrEqual(2);
  expect(profile.personas.some((persona) => persona.label.includes("운영"))).toBe(true);

  store.db.close();
});

test("decideCustomerVoiceDelegation skips customer voice for repo-only backend questions", () => {
  const store = openStore(":memory:");
  const memoryStore = new MemoryStore(store.db);
  ensureProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "mypetroutine",
  });

  const decision = decideCustomerVoiceDelegation({
    memoryStore,
    projectId: "mypetroutine",
    goalTitle: "지금 원격 git 연결 상태만 확인해줘",
    selectedRoles: ["backend", "customer-voice"],
  });

  expect(decision.enabled).toBe(false);
  expect(decision.selectedPersonas).toEqual([]);

  store.db.close();
});

test("decideCustomerVoiceDelegation selects multiple personas for explicit multi-persona UX reviews", () => {
  const store = openStore(":memory:");
  const memoryStore = new MemoryStore(store.db);
  ensureProjectCustomerVoiceProfile({
    memoryStore,
    projectId: "sherpalabs",
  });

  const decision = decideCustomerVoiceDelegation({
    memoryStore,
    projectId: "sherpalabs",
    goalTitle: "여러 페르소나의 고객 관점으로 메인 랜딩과 ai-employee 동선, UX writing을 같이 점검해줘",
    selectedRoles: ["designer", "frontend"],
  });

  expect(decision.enabled).toBe(true);
  expect(decision.selectedPersonas.length).toBeGreaterThanOrEqual(2);
  expect(decision.mode).toBe("persona-driven");

  store.db.close();
});

test("applyCustomerVoiceDecisionToPlan injects customer voice before QA when the director enables it", () => {
  const plan = basePlan(["designer", "frontend", "qa"]);

  const updated = applyCustomerVoiceDecisionToPlan({
    plan,
    decision: {
      enabled: true,
      mode: "persona-driven",
      needsSetup: false,
      reason: "사용자-facing 카피와 동선 수정이라 고객 관점 검토가 필요합니다.",
      selectedPersonas: [
        {
          id: "ops-lead",
          label: "운영 리더",
          jobToBeDone: "AI employee 도입 가치를 빠르게 판단한다.",
          pains: ["성과가 불명확하면 도입을 미룬다."],
          triggers: ["랜딩", "메시지", "도입"],
          desiredOutcome: "도입 이유와 다음 행동이 명확하다.",
        },
      ],
      simulation: {
        enabled: true,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: ["/", "/ai-employee"],
        notes: "공개 랜딩은 바로 체험 가능",
      },
    },
    goalTitle: "랜딩 메시지와 ai-employee 동선을 보완해줘",
  });

  expect(updated.selectedRoles).toEqual(["designer", "frontend", "customer-voice", "qa"]);
  expect(updated.taskGraph.map((task) => task.role)).toEqual([
    "designer",
    "frontend",
    "customer-voice",
    "qa",
  ]);
  expect(updated.taskGraph.at(-1)?.dependsOn).toContain("task-customer-voice");
});

test("applyCustomerVoiceDecisionToPlan removes customer voice when the director disables it", () => {
  const plan = basePlan(["backend", "customer-voice", "qa"]);

  const updated = applyCustomerVoiceDecisionToPlan({
    plan,
    decision: {
      enabled: false,
      mode: "generic",
      needsSetup: false,
      reason: "이번 라운드는 순수 저장소 점검이라 고객 관점이 필요하지 않습니다.",
      selectedPersonas: [],
      simulation: {
        enabled: false,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: [],
        notes: null,
      },
    },
    goalTitle: "원격 저장소 상태만 확인해줘",
  });

  expect(updated.selectedRoles).toEqual(["backend", "qa"]);
  expect(updated.taskGraph.some((task) => task.role === "customer-voice")).toBe(false);
});
