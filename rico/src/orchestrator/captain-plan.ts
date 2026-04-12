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

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

export function normalizeCaptainPlanForGoal(goalTitle: string, plan: CaptainPlan): CaptainPlan {
  const normalizedGoal = goalTitle.toLowerCase();
  const normalizedPlan: CaptainPlan = {
    ...plan,
    selectedRoles: [...plan.selectedRoles],
    taskGraph: plan.taskGraph.map((task) => ({
      ...task,
      dependsOn: [...task.dependsOn],
    })),
  };

  if (includesAny(normalizedGoal, ["원격", "git", "repo", "repository", "저장소", "브랜치"])) {
    normalizedPlan.selectedRoles = ["backend"];
    normalizedPlan.taskGraph = normalizedPlan.taskGraph.length > 0
      ? normalizedPlan.taskGraph.map((task, index) => ({
          ...task,
          id: index === 0 ? task.id : `task-${index + 1}`,
          role: "backend",
        }))
      : [
          {
            id: "task-1",
            role: "backend",
            title: "원격 저장소와 브랜치 상태 확인",
            dependsOn: [],
          },
        ];
    normalizedPlan.nextAction = normalizedPlan.nextAction.replace(/\bplanner\b/gi, "backend");
  }

  return normalizedPlan;
}
