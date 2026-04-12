export const BACKEND_ROLE_PROFILE = {
  role: "backend",
  invoke: "implementBackendSlice",
  defaultImpact: "info" as const,
  guardrails: ["preserve_data_contracts"],
};
