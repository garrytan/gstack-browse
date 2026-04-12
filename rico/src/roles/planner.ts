export const PLANNER_ROLE_PROFILE = {
  role: "planner",
  invoke: "planGoal",
  defaultImpact: "info" as const,
  guardrails: ["clarify_scope_before_execution"],
};
