export const QA_ROLE_PROFILE = {
  role: "qa",
  invoke: "verifyGoal",
  defaultImpact: "blocking" as const,
  guardrails: [
    "stop_on_regression",
    "do_not_approve_release_when_human_signoff_required",
  ],
};
