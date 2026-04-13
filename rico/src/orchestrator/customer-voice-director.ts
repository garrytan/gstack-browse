import type { RoleName } from "../roles";
import type { CaptainPlan, CaptainTaskNode } from "./captain-plan";
import { MemoryStore } from "../memory/store";

export type CustomerVoiceMode = "generic" | "persona-driven";

export interface CustomerVoicePersona {
  id: string;
  label: string;
  jobToBeDone: string;
  pains: string[];
  triggers: string[];
  desiredOutcome: string;
}

export interface CustomerVoiceSimulationPolicy {
  enabled: boolean;
  baseUrl: string | null;
  requiresCredentials: boolean;
  credentialRefs: string[];
  allowedJourneys: string[];
  notes: string | null;
}

export interface CustomerVoiceProjectProfile {
  mode: CustomerVoiceMode;
  needsSetup: boolean;
  personas: CustomerVoicePersona[];
  simulation: CustomerVoiceSimulationPolicy;
  notes: string | null;
}

export interface CustomerVoiceDelegationDecision {
  enabled: boolean;
  mode: CustomerVoiceMode;
  needsSetup: boolean;
  reason: string;
  selectedPersonas: CustomerVoicePersona[];
  simulation: CustomerVoiceSimulationPolicy;
}

const PROFILE_KEYS = {
  mode: "customer_voice.mode",
  needsSetup: "customer_voice.needs_setup",
  personas: "customer_voice.personas_json",
  simulation: "customer_voice.simulation_json",
  notes: "customer_voice.notes",
} as const;

const EXPLICIT_CUSTOMER_VOICE_KEYWORDS = [
  "고객 관점",
  "customer voice",
  "페르소나",
  "persona",
  "실제 고객",
  "사용자 관점",
];

const USER_FACING_KEYWORDS = [
  "ux",
  "ui",
  "카피",
  "문구",
  "메시지",
  "가입",
  "signup",
  "온보딩",
  "cta",
  "제안",
  "아이디어",
  "기획",
  "사용자",
  "고객",
  "가치",
  "약속",
  "positioning",
  "pricing",
  "도입",
];

const BROAD_EXPERIENCE_KEYWORDS = [
  "랜딩",
  "landing",
  "동선",
  "navigation",
  "네비게이션",
  "flow",
];

const SYSTEM_ONLY_KEYWORDS = [
  "git",
  "repo",
  "repository",
  "저장소",
  "브랜치",
  "branch",
  "remote",
  "원격",
  "schema",
  "migration",
  "로그",
  "log",
  "auth token",
  "환경 변수",
  "env",
];

const MULTI_PERSONA_KEYWORDS = [
  "여러",
  "복수",
  "다양한",
  "둘",
  "2개",
  "two personas",
  "multi persona",
  "멀티 페르소나",
];

const SIMULATION_KEYWORDS = [
  "체험",
  "써봐",
  "시뮬레이션",
  "simulate",
  "dogfood",
  "실제 사용",
  "브라우저",
  "로그인",
  "가입 흐름",
  "journey",
];

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function normalizeProjectId(projectId: string) {
  return projectId.trim().toLowerCase();
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value === "true";
}

function parseJsonValue<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function uniqueRoles(roles: RoleName[]) {
  return [...new Set(roles)];
}

function buildGenericPersona(projectId: string): CustomerVoicePersona {
  return {
    id: "generic-user",
    label: "초기 사용자",
    jobToBeDone: `#${projectId} 채널이 무엇을 해주는지 빠르게 이해하고 다음 행동을 정한다.`,
    pains: [
      "채널 목적이 불명확하면 바로 이탈한다.",
      "내부 용어가 앞서가면 가치를 이해하지 못한다.",
    ],
    triggers: ["목표", "제안", "메시지", "ux", "landing"],
    desiredOutcome: "무엇을 기대할 수 있는지와 다음 행동이 한 번에 보인다.",
  };
}

function buildDefaultProfile(projectId: string): CustomerVoiceProjectProfile {
  const normalized = normalizeProjectId(projectId);

  if (["test", "sandbox", "demo", "tmp", "temp", "poc"].includes(normalized)) {
    return {
      mode: "generic",
      needsSetup: true,
      personas: [buildGenericPersona(projectId)],
      simulation: {
        enabled: false,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: [],
        notes: "임시 채널이라 실제 고객 페르소나는 아직 연결되지 않았습니다.",
      },
      notes: "임시 채널은 generic customer voice로 시작하고, 필요할 때 persona/JTBD를 주입합니다.",
    };
  }

  if (normalized === "sherpalabs") {
    return {
      mode: "persona-driven",
      needsSetup: false,
      personas: [
        {
          id: "ops-lead",
          label: "운영 리더",
          jobToBeDone: "AI employee 도입이 팀 생산성을 실제로 올리는지 빨리 판단한다.",
          pains: [
            "효과가 추상적으로만 보이면 도입을 미룬다.",
            "랜딩 메시지가 내부 용어 위주면 신뢰가 떨어진다.",
          ],
          triggers: ["랜딩", "메시지", "도입", "가치", "cta"],
          desiredOutcome: "도입 이유, 기대 효과, 다음 행동이 명확하다.",
        },
        {
          id: "team-manager",
          label: "현업 팀장",
          jobToBeDone: "내 팀 업무 흐름에 AI employee가 어디에 들어오는지 이해한다.",
          pains: [
            "페이지가 단절돼 있으면 제품 구조를 파악하기 어렵다.",
            "실제 동작 예시가 없으면 데모처럼 느껴진다.",
          ],
          triggers: ["동선", "네비게이션", "workflow", "landing", "ai-employee"],
          desiredOutcome: "메인 랜딩에서 서브 페이지로 자연스럽게 넘어가고 활용 장면이 보인다.",
        },
      ],
      simulation: {
        enabled: true,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: ["/", "/ai-employee", "/projects"],
        notes: "공개 랜딩과 AI employee 소개 흐름은 바로 체험 가능합니다.",
      },
      notes: "도입 검토자와 현업 팀장 두 관점에서 가치와 동선을 점검합니다.",
    };
  }

  if (normalized === "mypetroutine") {
    return {
      mode: "persona-driven",
      needsSetup: false,
      personas: [
        {
          id: "solo-pet-parent",
          label: "혼자 돌보는 보호자",
          jobToBeDone: "반려동물 루틴을 놓치지 않고 하루 관리를 단순하게 만든다.",
          pains: [
            "설정이 복잡하면 바로 포기한다.",
            "왜 이 기능이 필요한지 명확하지 않으면 재방문하지 않는다.",
          ],
          triggers: ["온보딩", "가입", "루틴", "알림"],
          desiredOutcome: "처음 들어와도 무엇을 해야 하는지와 반복 가치가 바로 보인다.",
        },
        {
          id: "shared-caregiver",
          label: "함께 돌보는 가족",
          jobToBeDone: "가족과 역할을 나눠도 반려동물 관리가 끊기지 않게 한다.",
          pains: [
            "공유 구조가 안 보이면 개인용 앱처럼 느낀다.",
            "상태가 분명하지 않으면 협업이 어렵다.",
          ],
          triggers: ["공유", "가족", "협업", "루틴"],
          desiredOutcome: "누가 무엇을 하는지와 공유 가치가 분명하게 보인다.",
        },
      ],
      simulation: {
        enabled: true,
        baseUrl: null,
        requiresCredentials: true,
        credentialRefs: ["MYPETROUTINE_TEST_EMAIL", "MYPETROUTINE_TEST_PASSWORD"],
        allowedJourneys: ["/", "/onboarding", "/signup"],
        notes: "로그인 이후 흐름 점검에는 테스트 계정 연결이 필요합니다.",
      },
      notes: "초기 온보딩과 재방문 가치가 핵심입니다.",
    };
  }

  if (normalized === "pet-memorial") {
    return {
      mode: "persona-driven",
      needsSetup: false,
      personas: [
        {
          id: "grieving-pet-parent",
          label: "추모 페이지를 만드는 보호자",
          jobToBeDone: "감정을 해치지 않으면서 반려동물 기억을 남긴다.",
          pains: [
            "톤이 지나치게 기능적이면 정서적으로 이탈한다.",
            "만드는 과정이 복잡하면 완주하기 어렵다.",
          ],
          triggers: ["추모", "공유", "페이지 생성", "카피"],
          desiredOutcome: "따뜻하고 부담 없는 흐름으로 기억을 남길 수 있다.",
        },
        {
          id: "family-friend",
          label: "가족/지인 방문자",
          jobToBeDone: "추모 페이지를 보고 함께 기억을 나누고 싶다.",
          pains: [
            "페이지 구조가 불분명하면 감정 몰입이 깨진다.",
            "공유 동선이 어색하면 참여하기 어렵다.",
          ],
          triggers: ["공유", "방문", "메시지", "추모"],
          desiredOutcome: "방문과 공감, 공유 행동이 자연스럽게 이어진다.",
        },
      ],
      simulation: {
        enabled: true,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: ["/", "/create", "/memorial"],
        notes: "공개 추모 흐름은 브라우저 체험 기준으로 점검 가능합니다.",
      },
      notes: "정서적 톤과 생성 흐름을 같이 봐야 합니다.",
    };
  }

  if (normalized === "petnow-rnd") {
    return {
      mode: "generic",
      needsSetup: true,
      personas: [buildGenericPersona(projectId)],
      simulation: {
        enabled: false,
        baseUrl: null,
        requiresCredentials: false,
        credentialRefs: [],
        allowedJourneys: [],
        notes: "내부 R&D 채널은 외부 고객 페르소나가 아직 고정되지 않았습니다.",
      },
      notes: "내부 실험 채널이라 generic reviewer로 시작하고 필요 시 persona를 주입합니다.",
    };
  }

  return {
    mode: "generic",
    needsSetup: true,
    personas: [buildGenericPersona(projectId)],
    simulation: {
      enabled: false,
      baseUrl: null,
      requiresCredentials: false,
      credentialRefs: [],
      allowedJourneys: [],
      notes: "기본 customer voice는 generic reviewer로 시작합니다.",
    },
    notes: "프로젝트별 persona/JTBD가 아직 주입되지 않아 generic reviewer로 동작합니다.",
  };
}

export function ensureProjectCustomerVoiceProfile(input: {
  memoryStore: MemoryStore;
  projectId: string;
}) {
  const defaults = buildDefaultProfile(input.projectId);
  const existing = input.memoryStore.getSharedProjectMemory(input.projectId);

  if (!existing[PROFILE_KEYS.mode]) {
    input.memoryStore.putProjectFact(input.projectId, PROFILE_KEYS.mode, defaults.mode);
  }
  if (!existing[PROFILE_KEYS.needsSetup]) {
    input.memoryStore.putProjectFact(
      input.projectId,
      PROFILE_KEYS.needsSetup,
      String(defaults.needsSetup),
    );
  }
  if (!existing[PROFILE_KEYS.personas]) {
    input.memoryStore.putProjectFact(
      input.projectId,
      PROFILE_KEYS.personas,
      JSON.stringify(defaults.personas),
    );
  }
  if (!existing[PROFILE_KEYS.simulation]) {
    input.memoryStore.putProjectFact(
      input.projectId,
      PROFILE_KEYS.simulation,
      JSON.stringify(defaults.simulation),
    );
  }
  if (!existing[PROFILE_KEYS.notes] && defaults.notes) {
    input.memoryStore.putProjectFact(input.projectId, PROFILE_KEYS.notes, defaults.notes);
  }
}

export function writeProjectCustomerVoiceProfile(input: {
  memoryStore: MemoryStore;
  projectId: string;
  profile: CustomerVoiceProjectProfile;
}) {
  input.memoryStore.putProjectFact(input.projectId, PROFILE_KEYS.mode, input.profile.mode);
  input.memoryStore.putProjectFact(
    input.projectId,
    PROFILE_KEYS.needsSetup,
    String(input.profile.needsSetup),
  );
  input.memoryStore.putProjectFact(
    input.projectId,
    PROFILE_KEYS.personas,
    JSON.stringify(input.profile.personas),
  );
  input.memoryStore.putProjectFact(
    input.projectId,
    PROFILE_KEYS.simulation,
    JSON.stringify(input.profile.simulation),
  );
  input.memoryStore.putProjectFact(
    input.projectId,
    PROFILE_KEYS.notes,
    input.profile.notes ?? "",
  );
}

export function readProjectCustomerVoiceProfile(input: {
  memoryStore: MemoryStore;
  projectId: string;
}): CustomerVoiceProjectProfile {
  ensureProjectCustomerVoiceProfile(input);
  const memory = input.memoryStore.getSharedProjectMemory(input.projectId);
  const fallback = buildDefaultProfile(input.projectId);

  return {
    mode:
      memory[PROFILE_KEYS.mode] === "persona-driven"
        ? "persona-driven"
        : fallback.mode,
    needsSetup: parseBoolean(memory[PROFILE_KEYS.needsSetup], fallback.needsSetup),
    personas: parseJsonValue(memory[PROFILE_KEYS.personas], fallback.personas),
    simulation: parseJsonValue(memory[PROFILE_KEYS.simulation], fallback.simulation),
    notes: memory[PROFILE_KEYS.notes] ?? fallback.notes,
  };
}

function wantsCustomerVoice(goalTitle: string, selectedRoles: RoleName[]) {
  const normalized = goalTitle.toLowerCase();
  if (includesAny(normalized, EXPLICIT_CUSTOMER_VOICE_KEYWORDS)) return true;
  if (selectedRoles.includes("customer-voice")) return true;
  if (includesAny(normalized, USER_FACING_KEYWORDS)) return true;
  if (
    includesAny(normalized, BROAD_EXPERIENCE_KEYWORDS)
    && (selectedRoles.includes("designer") || selectedRoles.includes("planner"))
  ) {
    return true;
  }
  return false;
}

function isSystemOnlyGoal(goalTitle: string, selectedRoles: RoleName[]) {
  const normalized = goalTitle.toLowerCase();
  if (selectedRoles.every((role) => role === "backend" || role === "qa" || role === "customer-voice")) {
    return includesAny(normalized, SYSTEM_ONLY_KEYWORDS) && !includesAny(normalized, USER_FACING_KEYWORDS);
  }
  return includesAny(normalized, SYSTEM_ONLY_KEYWORDS) && !includesAny(normalized, USER_FACING_KEYWORDS);
}

function choosePersonas(profile: CustomerVoiceProjectProfile, goalTitle: string) {
  const normalized = goalTitle.toLowerCase();
  if (profile.personas.length === 0) return [];

  const matched = profile.personas.filter((persona) =>
    persona.triggers.some((trigger) => normalized.includes(trigger.toLowerCase()))
  );
  const pool = matched.length > 0 ? matched : profile.personas;
  const wantsMultiple = includesAny(normalized, MULTI_PERSONA_KEYWORDS)
    || includesAny(normalized, ["랜딩", "landing", "메시지", "카피", "동선", "navigation"]);

  return wantsMultiple ? pool.slice(0, Math.min(2, pool.length)) : pool.slice(0, 1);
}

function chooseSimulationPolicy(profile: CustomerVoiceProjectProfile, goalTitle: string) {
  const normalized = goalTitle.toLowerCase();
  if (!profile.simulation.enabled) {
    return profile.simulation;
  }
  if (includesAny(normalized, SIMULATION_KEYWORDS)) {
    return profile.simulation;
  }
  return {
    ...profile.simulation,
    enabled: false,
  };
}

export function decideCustomerVoiceDelegation(input: {
  memoryStore: MemoryStore;
  projectId: string;
  goalTitle: string;
  selectedRoles: RoleName[];
}): CustomerVoiceDelegationDecision {
  const profile = readProjectCustomerVoiceProfile({
    memoryStore: input.memoryStore,
    projectId: input.projectId,
  });

  if (isSystemOnlyGoal(input.goalTitle, input.selectedRoles) && !includesAny(input.goalTitle.toLowerCase(), EXPLICIT_CUSTOMER_VOICE_KEYWORDS)) {
    return {
      enabled: false,
      mode: profile.mode,
      needsSetup: profile.needsSetup,
      reason: "이번 라운드는 저장소/원격/API 같은 시스템 점검이라 고객 관점을 별도로 붙이지 않습니다.",
      selectedPersonas: [],
      simulation: {
        ...profile.simulation,
        enabled: false,
      },
    };
  }

  if (!wantsCustomerVoice(input.goalTitle, input.selectedRoles)) {
    return {
      enabled: false,
      mode: profile.mode,
      needsSetup: profile.needsSetup,
      reason: "이번 라운드는 사용자 가치보다 내부 구현 점검이 우선이라 customer voice를 생략합니다.",
      selectedPersonas: [],
      simulation: {
        ...profile.simulation,
        enabled: false,
      },
    };
  }

  const selectedPersonas = choosePersonas(profile, input.goalTitle);
  const simulation = chooseSimulationPolicy(profile, input.goalTitle);

  return {
    enabled: true,
    mode: profile.mode,
    needsSetup: profile.needsSetup,
    reason:
      profile.mode === "persona-driven"
        ? "이번 목표는 사용자-facing 가치와 메시지를 다루므로 persona-driven customer voice를 붙입니다."
        : "프로젝트별 persona가 아직 고정되지 않아 generic customer voice로 시작합니다.",
    selectedPersonas,
    simulation,
  };
}

function buildCustomerVoiceTaskTitle(goalTitle: string, decision: CustomerVoiceDelegationDecision) {
  if (decision.selectedPersonas.length > 1) {
    return `여러 고객 페르소나로 "${goalTitle}"의 가치와 경험 점검`;
  }
  if (decision.selectedPersonas.length === 1) {
    return `${decision.selectedPersonas[0]!.label} 관점으로 사용자 가치와 흐름 점검`;
  }
  return `고객 관점으로 "${goalTitle}"의 가치와 경험 점검`;
}

function removeCustomerVoice(plan: CaptainPlan): CaptainPlan {
  const removedIds = new Set(
    plan.taskGraph.filter((task) => task.role === "customer-voice").map((task) => task.id),
  );
  return {
    ...plan,
    selectedRoles: plan.selectedRoles.filter((role) => role !== "customer-voice"),
    taskGraph: plan.taskGraph
      .filter((task) => task.role !== "customer-voice")
      .map((task) => ({
        ...task,
        dependsOn: task.dependsOn.filter((dependency) => !removedIds.has(dependency)),
      })),
  };
}

function insertCustomerVoiceTask(
  plan: CaptainPlan,
  goalTitle: string,
  decision: CustomerVoiceDelegationDecision,
): CaptainPlan {
  if (plan.taskGraph.some((task) => task.role === "customer-voice")) {
    return {
      ...plan,
      selectedRoles: uniqueRoles(plan.selectedRoles),
    };
  }
  const withoutCustomerVoice = removeCustomerVoice(plan);
  const customerVoiceTaskId = "task-customer-voice";
  const customerVoiceTask: CaptainTaskNode = {
    id: customerVoiceTaskId,
    role: "customer-voice",
    title: buildCustomerVoiceTaskTitle(goalTitle, decision),
    dependsOn: withoutCustomerVoice.taskGraph
      .filter((task) => task.role !== "qa")
      .map((task) => task.id),
  };

  const qaTasks = withoutCustomerVoice.taskGraph.filter((task) => task.role === "qa");
  const nonQaTasks = withoutCustomerVoice.taskGraph.filter((task) => task.role !== "qa");

  return {
    ...withoutCustomerVoice,
    selectedRoles: uniqueRoles([
      ...withoutCustomerVoice.selectedRoles.filter((role) => role !== "qa"),
      "customer-voice",
      ...withoutCustomerVoice.selectedRoles.filter((role) => role === "qa"),
    ]),
    taskGraph: [
      ...nonQaTasks,
      customerVoiceTask,
      ...qaTasks.map((task) => ({
        ...task,
        dependsOn: [...new Set([...task.dependsOn, customerVoiceTaskId])],
      })),
    ],
  };
}

export function applyCustomerVoiceDecisionToPlan(input: {
  plan: CaptainPlan;
  decision: CustomerVoiceDelegationDecision;
  goalTitle: string;
}) {
  if (!input.decision.enabled) {
    return removeCustomerVoice(input.plan);
  }
  return insertCustomerVoiceTask(input.plan, input.goalTitle, input.decision);
}
