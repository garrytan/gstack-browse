export const DESIGNER_ROLE_PROFILE = {
  role: "designer",
  invoke: "designGoal",
  defaultImpact: "info" as const,
  guardrails: ["surface_ux_risks_before_build"],
};
