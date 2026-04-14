import type { ImpactLevel, SpecialistExecutionMode } from "../roles/contracts";
import type { CaptainPlan } from "../orchestrator/captain-plan";
import type { RoleName } from "../roles";

const CHATGPT_FOOTER_PATTERN =
  /\*?(?:다음을\s+사용하여\s+보냄|Sent using)\*?\s*ChatGPT/gi;
const GREETING_PATTERN = /^(안녕+|안녕하세요|ㅎㅇ|hello|hi|hey|반가워)([!.?\s~]*)$/i;
const STATUS_PATTERN = /^(상태|status|지금 상태|뭐하고 있어|무슨 일 하고 있어|도움말|help)([!.?\s~]*)$/i;

function cleanWhitespace(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function sanitizeIncomingSlackText(text: string) {
  return cleanWhitespace(text.replace(CHATGPT_FOOTER_PATTERN, ""));
}

export type ConversationalIntent = "greeting" | "status" | null;
export type CaptainCompactMode = "fact_check";

export function detectConversationalIntent(text: string): ConversationalIntent {
  const normalized = sanitizeIncomingSlackText(text);
  if (GREETING_PATTERN.test(normalized)) return "greeting";
  if (STATUS_PATTERN.test(normalized)) return "status";
  return null;
}

export function buildAiOpsGreetingText(projectIds: string[]) {
  const knownProjects = projectIds.length > 0 ? projectIds.join(", ") : "등록된 프로젝트";
  return `총괄: 여기서는 \`프로젝트명: 목표\` 형식으로 말해주시면 바로 넘길게요. 지금 연결된 프로젝트는 ${knownProjects}예요.`;
}

export function buildAiOpsStatusText(projectIds: string[]) {
  const knownProjects = projectIds.length > 0 ? projectIds.join(", ") : "아직 등록된 프로젝트가 없어요";
  return `총괄: 지금 연결된 프로젝트는 ${knownProjects}예요. 여기서는 \`프로젝트명: 목표\` 형식으로 요청해주시면 바로 진행할게요.`;
}

export function buildProjectGreetingText(projectId: string) {
  return `안녕하세요. 이 채널은 ${projectId} 프로젝트 전용이에요. 목표를 한 문장으로 남겨주시면 바로 이어서 볼게요.`;
}

export function buildProjectStatusText(projectId: string) {
  return `여기는 ${projectId} 프로젝트 채널이에요. 작업 요청을 남겨주시면 바로 이어서 진행할게요.`;
}

function roleLabel(role: RoleName | string) {
  if (role === "planner") return "기획";
  if (role === "designer") return "디자인";
  if (role === "frontend") return "프론트엔드";
  if (role === "backend") return "백엔드";
  if (role === "qa") return "QA";
  if (role === "customer-voice") return "고객 관점";
  return role;
}

function roleIcon(role: RoleName | string) {
  if (role === "planner") return "🧠";
  if (role === "designer") return "🎨";
  if (role === "frontend") return "🖥️";
  if (role === "backend") return "🧱";
  if (role === "qa") return "🧪";
  if (role === "customer-voice") return "🗣️";
  return "•";
}

function joinRoleLabels(roles: Array<RoleName | string>) {
  const labels = roles.map(roleLabel);
  if (labels.length === 0) return "캡틴";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]}과 ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, ${labels.at(-1)}`;
}

function impactLabel(impact: ImpactLevel) {
  if (impact === "blocking") return "차단";
  if (impact === "approval_needed") return "결정 필요";
  return "진행 가능";
}

function headerForCaptain(kind: "plan" | "progress" | "final", state?: string) {
  const icon =
    kind === "plan"
      ? state === "blocked"
        ? "⛔"
        : state === "needs_decision"
          ? "🟡"
          : "📝"
      : kind === "progress"
        ? state === "blocking"
          ? "⛔"
          : state === "approval_needed"
            ? "🟡"
            : "🔄"
        : state === "approved" || state === "released"
          ? "✅"
          : state === "awaiting_human_approval"
            ? "🟡"
            : state === "qa_failed" || state === "blocking" || state === "blocked"
              ? "⛔"
              : "✅";
  const label = kind === "plan" ? "캡틴 계획" : kind === "progress" ? "캡틴 진행" : "캡틴 마감";
  return `${icon} ${label}`;
}

function headerForGovernor(kind: "routing" | "final" | "approval", state?: string) {
  if (kind === "routing") return "🧭 총괄 라우팅";
  if (kind === "approval") return "🛑 총괄 승인 요청";
  const icon =
    state === "approved" || state === "released"
      ? "✅"
      : state === "awaiting_human_approval"
        ? "🟡"
        : state === "qa_failed" || state === "blocking" || state === "blocked"
          ? "⛔"
          : "✅";
  return `${icon} 총괄 마감`;
}

function hasFinalConsonant(text: string) {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    const code = text.charCodeAt(index);
    if (code < 0xac00 || code > 0xd7a3) continue;
    return (code - 0xac00) % 28 !== 0;
  }
  return false;
}

function objectParticle(text: string) {
  return hasFinalConsonant(text) ? "을" : "를";
}

function buildAssignmentText(plan?: CaptainPlan, roles: Array<RoleName | string> = []) {
  const assignments = plan?.taskGraph?.length
    ? plan.taskGraph.map((task) => `${roleLabel(task.role)}에게 ${task.title}${objectParticle(task.title)}`)
    : roles.map((role) => {
        const label = roleLabel(role);
        const taskTitle = `${label} 1차 검토`;
        return `${label}에게 ${taskTitle}${objectParticle(taskTitle)}`;
      });
  if (assignments.length === 0) return null;
  return assignments.join(", ");
}

function buildAssignmentLines(plan?: CaptainPlan, roles: Array<RoleName | string> = []) {
  const tasks = plan?.taskGraph?.length
    ? plan.taskGraph.map((task) => ({
        role: roleLabel(task.role),
        title: task.title,
      }))
    : roles.map((role) => ({
        role: roleLabel(role),
        title: `${roleLabel(role)} 1차 검토`,
      }));
  return tasks.map((task) => `  • ${task.role}: ${task.title}`);
}

export function buildRoutingText(projectId: string, plan?: CaptainPlan) {
  const lines = [
    headerForGovernor("routing"),
    `- 프로젝트: #${projectId}`,
    "- 상태: 프로젝트 채널에서 바로 이어가요.",
  ];
  const assignments = buildAssignmentLines(plan, plan?.selectedRoles ?? []);
  if (assignments.length > 0) {
    lines.push("- 배정:");
    lines.push(...assignments);
  }
  return lines.join("\n");
}

function firstSentence(text: string, fallback: string) {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/^(.+?(?:[.!?](?=\s|$)|$))/s);
  return match?.[1]?.trim() ?? fallback;
}

function trimMessage(text: string, limit = 90) {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

function compactSentence(text: string, limit = 110) {
  return trimMessage(firstSentence(text, text), limit);
}

function impactPriority(impact: ImpactLevel) {
  if (impact === "blocking") return 0;
  if (impact === "approval_needed") return 1;
  return 2;
}

export function buildCaptainStartText(
  title: string,
  roles: RoleName[] = [],
  plan?: CaptainPlan,
  options?: {
    compactMode?: CaptainCompactMode;
    followUpText?: string;
  },
) {
  const requestText = options?.followUpText?.trim() || title;
  if (options?.compactMode === "fact_check") {
    return [
      "🔍 캡틴 확인",
      `${options?.followUpText?.trim() ? "- 후속 요청" : "- 요청"}: ${trimMessage(requestText, 120)}`,
      `- 바로 볼 항목: ${trimMessage(plan?.nextAction ?? "관련 상태를 바로 다시 확인할게요.", 120)}`,
    ].join("\n");
  }
  const lines = [headerForCaptain("plan", plan?.status), `- 요청: ${trimMessage(title, 120)}`];
  if (plan?.status === "blocked" && plan.blockedReason) {
    lines.push("- 상태: 차단");
    lines.push(`- 이유: ${plan.blockedReason}`);
    if (plan.nextAction) {
      lines.push(`- 다음 액션: ${plan.nextAction}`);
    }
    return lines.join("\n");
  }
  if (plan?.status === "needs_decision" && plan.blockedReason) {
    lines.push("- 상태: 결정 필요");
    lines.push(`- 이유: ${plan.blockedReason}`);
    if (plan.nextAction) {
      lines.push(`- 다음 액션: ${plan.nextAction}`);
    }
    return lines.join("\n");
  }
  if (roles.length === 0) {
    lines.push("- 상태: 요청 확인");
    lines.push("- 다음 액션: 먼저 범위와 리스크를 빠르게 정리할게요.");
    if (plan?.nextAction) {
      lines.push(`- 이어서: ${plan.nextAction}`);
    }
    return lines.join("\n");
  }
  lines.push("- 배정:");
  lines.push(...buildAssignmentLines(plan, roles));
  if (plan?.nextAction) {
    lines.push(`- 다음 액션: ${plan.nextAction}`);
  }
  return lines.join("\n");
}

export function buildCaptainProgressText(
  title: string,
  impacts: Array<{ role: string; level: ImpactLevel; message: string; changedFiles?: string[] }> = [],
  plan?: CaptainPlan,
) {
  if (impacts.length === 0) {
    if (plan?.nextAction) {
      return [
        headerForCaptain("progress"),
        `- 요청: ${trimMessage(title, 120)}`,
        "- 상태: 계획 정리 중",
        `- 다음 액션: ${plan.nextAction}`,
      ].join("\n");
    }
    return [
      headerForCaptain("progress"),
      `- 요청: ${trimMessage(title, 120)}`,
      "- 상태: 계획 정리 중",
      "- 다음 액션: 바로 실행 가능한 한 줄 계획으로 묶고 있어요.",
    ].join("\n");
  }

  const sorted = [...impacts].sort(
    (left, right) => impactPriority(left.level) - impactPriority(right.level),
  );
  const lead = sorted[0]!;
  const supportingRoles = sorted.slice(1, 3).map((impact) => roleLabel(impact.role));
  const supportingText =
    supportingRoles.length > 0 ? ` ${supportingRoles.join(", ")} 의견까지 묶어서.` : "";
  const leadSummary = trimMessage(
    firstSentence(lead.message, "핵심 쟁점을 먼저 정리하고 있어요."),
  );
  const lines = [
    headerForCaptain("progress", lead.level),
    `- 요청: ${trimMessage(title, 120)}`,
    `- 기준 역할: ${roleLabel(lead.role)}`,
    `- 판정: ${impactLabel(lead.level)}`,
    `- 핵심 결론: ${compactSentence(leadSummary, 100)}`,
  ];
  if (supportingRoles.length > 0) {
    lines.push(`- 참고: ${supportingRoles.join(", ")} 의견까지 함께 보고 있어요.`);
  }
  if (plan?.nextAction) {
    lines.push(`- 다음 액션: ${plan.nextAction}`);
  }
  if (lead.changedFiles && lead.changedFiles.length > 0) {
    lines.push(
      `- 변경 파일: ${lead.changedFiles.slice(0, 2).join(", ")}${lead.changedFiles.length > 2 ? ` 외 ${lead.changedFiles.length - 2}개` : ""}`,
    );
  }
  return lines.join("\n");
}

function finalStateLabel(state: string) {
  if (state === "approved") return "완료";
  if (state === "released") return "출시 완료";
  if (state === "awaiting_human_approval") return "결정 필요";
  if (state === "blocking" || state === "blocked" || state === "qa_failed") return "차단";
  return "진행 중";
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function summarizeChangedFiles(
  impacts: Array<{ changedFiles?: string[] }>,
) {
  return [
    ...new Set(
      impacts.flatMap((impact) => impact.changedFiles ?? []).filter(Boolean),
    ),
  ];
}

function summarizeVerificationNotes(
  impacts: Array<{ verificationNotes?: string[] }>,
) {
  return [
    ...new Set(
      impacts.flatMap((impact) => impact.verificationNotes ?? []).filter(Boolean),
    ),
  ];
}

function pickLeadImpact(
  impacts: Array<{ role: string; level: ImpactLevel; message: string }>,
) {
  if (impacts.length === 0) return null;
  return [...impacts].sort(
    (left, right) => impactPriority(left.level) - impactPriority(right.level),
  )[0]!;
}

export function buildCaptainFinalText(input: {
  finalState: string;
  impacts: Array<{
    role: string;
    level: ImpactLevel;
    message: string;
    changedFiles?: string[];
    verificationNotes?: string[];
  }>;
  nextAction?: string | null;
}, options?: {
  compactMode?: CaptainCompactMode;
}) {
  if (options?.compactMode === "fact_check") {
    const lead = pickLeadImpact(input.impacts);
    const verificationNotes = summarizeVerificationNotes(input.impacts);
    const header =
      input.finalState === "approved" || input.finalState === "released"
        ? "✅ 캡틴 확인 완료"
        : input.finalState === "awaiting_human_approval"
          ? "🟡 캡틴 확인 보류"
          : "⛔ 캡틴 확인 보류";
    const lines = [header];
    if (lead) {
      lines.push(`- 결론: ${compactSentence(lead.message, 120)}`);
    }
    if (verificationNotes.length > 0) {
      lines.push(`- 검증: ${compactSentence(verificationNotes[0]!, 120)}`);
    }
    if (
      input.nextAction
      && (input.finalState === "awaiting_human_approval" || input.finalState === "blocked" || input.finalState === "qa_failed")
    ) {
      lines.push(`- 참고: ${input.nextAction}`);
    }
    return lines.join("\n");
  }
  const lines = [
    headerForCaptain("final", input.finalState),
    `- 상태: ${finalStateLabel(input.finalState)}`,
  ];
  const lead = pickLeadImpact(input.impacts);
  if (lead) {
    lines.push(`- 핵심 결론: ${compactSentence(lead.message, 120)}`);
  }
  const changedFiles = summarizeChangedFiles(input.impacts);
  if (changedFiles.length > 0) {
    lines.push(
      `- 실제 변경: ${changedFiles.slice(0, 2).join(", ")}${changedFiles.length > 2 ? ` 외 ${changedFiles.length - 2}개` : ""}`,
    );
  }
  const verificationNotes = summarizeVerificationNotes(input.impacts);
  if (verificationNotes.length > 0) {
    lines.push(`- 검증: ${compactSentence(verificationNotes[0]!, 120)}`);
  }
  if (
    input.nextAction
    && (input.finalState === "awaiting_human_approval" || input.finalState === "blocked" || input.finalState === "qa_failed")
  ) {
    lines.push(`- 남은 조치: ${input.nextAction}`);
  }
  return lines.join("\n");
}

export function buildGovernorFinalText(input: {
  projectId: string;
  finalState: string;
  leadSummary?: string | null;
  changedFiles?: string[];
  nextAction?: string | null;
}) {
  const lines = [
    headerForGovernor("final", input.finalState),
    `- 프로젝트: #${input.projectId}`,
    `- 상태: ${finalStateLabel(input.finalState)}`,
  ];
  if (input.leadSummary) {
    lines.push(`- 핵심 결론: ${compactSentence(input.leadSummary, 120)}`);
  }
  const changedFiles = uniqueStrings(input.changedFiles ?? []);
  if (changedFiles.length > 0) {
    lines.push(
      `- 실제 변경: ${changedFiles.slice(0, 2).join(", ")}${changedFiles.length > 2 ? ` 외 ${changedFiles.length - 2}개` : ""}`,
    );
  }
  if (
    input.nextAction
    && (input.finalState === "awaiting_human_approval" || input.finalState === "blocked" || input.finalState === "qa_failed")
  ) {
    lines.push(`- 남은 조치: ${input.nextAction}`);
  }
  return lines.join("\n");
}

export function buildApprovalText(actionType: string, blockingReason: string) {
  return `${headerForGovernor("approval")}\n- 상태: 사람 확인 필요\n- 액션: ${actionType}\n- 이유: ${blockingReason}`;
}

export function buildApprovalResolutionText(input: {
  approvalId: string;
  nextState: "approved" | "rejected";
  actionType: string;
  actor: string;
}) {
  const action = input.nextState === "approved" ? "승인됐어요" : "반려됐어요";
  return `${input.actionType} 요청(${input.approvalId})은 ${action}. 처리한 사람은 ${input.actor}예요.`;
}

function detailLabelForRole(input: {
  role: string;
  executionMode?: SpecialistExecutionMode;
  changedFiles?: string[];
}) {
  if (input.role === "planner") return "제안";
  if (input.role === "designer") return "UX 판단";
  if (input.role === "customer-voice") return "사용자 영향";
  if (input.role === "qa") return "근거";
  if (
    input.executionMode === "write"
    || (input.changedFiles && input.changedFiles.length > 0)
  ) {
    return "변경";
  }
  return "판단";
}

export function buildImpactNarration(input: {
  role: string;
  summary: string;
  level: ImpactLevel;
  changedFiles?: string[];
  verificationNotes?: string[];
  executionMode?: SpecialistExecutionMode;
  personaLabel?: string;
  compactMode?: CaptainCompactMode;
}) {
  if (
    input.compactMode === "fact_check"
    && input.role === "backend"
    && input.executionMode !== "write"
  ) {
    const lines = [
      "🧱 백엔드 확인",
      `- 결론: ${compactSentence(input.summary, 120)}`,
    ];
    if (input.verificationNotes && input.verificationNotes.length > 0) {
      lines.push(
        `- 검증: ${input.verificationNotes
          .slice(0, 1)
          .map((note) => compactSentence(note, 100))
          .join(" / ")}${input.verificationNotes.length > 1 ? " / ..." : ""}`,
      );
    }
    return lines.join("\n");
  }
  const statusLabel = input.role === "qa" ? "판정" : "상태";
  const detailLabel = detailLabelForRole({
    role: input.role,
    executionMode: input.executionMode,
    changedFiles: input.changedFiles,
  });
  const lines = [
    `${roleIcon(input.role)} ${roleLabel(input.role)}${input.personaLabel ? ` · ${input.personaLabel}` : ""}`,
    `- ${statusLabel}: ${impactLabel(input.level)}`,
    `- ${detailLabel}: ${compactSentence(input.summary, 120)}`,
  ];
  if (input.changedFiles && input.changedFiles.length > 0) {
    lines.push(
      `- 변경 파일: ${input.changedFiles.slice(0, 2).join(", ")}${input.changedFiles.length > 2 ? ` 외 ${input.changedFiles.length - 2}개` : ""}`,
    );
  }
  if (input.verificationNotes && input.verificationNotes.length > 0) {
    lines.push(
      `- 검증: ${input.verificationNotes
        .slice(0, 1)
        .map((note) => compactSentence(note, 100))
        .join(" / ")}${input.verificationNotes.length > 1 ? " / ..." : ""}`,
    );
  }
  return lines.join("\n");
}
