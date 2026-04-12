export const FRONTEND_ROLE_PROFILE = {
  role: "frontend",
  invoke: "implementFrontendSlice",
  defaultImpact: "info" as const,
  guardrails: ["preserve_ui_contracts"],
};
