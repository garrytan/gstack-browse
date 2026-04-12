import type { RoleName } from "../roles";
import { selectSpecialistRoles } from "./role-selection";

export type CaptainPlanStatus = "active" | "needs_decision" | "blocked";

export interface CaptainTaskNode {
  id: string;
  role: RoleName;
  title: string;
  dependsOn: string[];
}

export interface CaptainPlan {
  selectedRoles: RoleName[];
  nextAction: string;
  blockedReason: string | null;
  status: CaptainPlanStatus;
  taskGraph: CaptainTaskNode[];
}

export function buildFallbackCaptainPlan(goalTitle: string): CaptainPlan {
  const selectedRoles = selectSpecialistRoles(goalTitle);
  return {
    selectedRoles,
    nextAction:
      selectedRoles.length > 0
        ? `${selectedRoles[0]} 관점에서 핵심 전제와 다음 단계를 먼저 정리한다.`
        : "범위와 리스크를 먼저 정리한다.",
    blockedReason: null,
    status: "active",
    taskGraph: selectedRoles.map((role, index) => ({
      id: `task-${index + 1}`,
      role,
      title: `${role} 1차 검토`,
      dependsOn: [],
    })),
  };
}
