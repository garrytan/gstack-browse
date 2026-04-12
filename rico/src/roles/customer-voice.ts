export const CUSTOMER_VOICE_ROLE_PROFILE = {
  role: "customer-voice",
  invoke: "reviewCustomerValue",
  defaultImpact: "approval_needed" as const,
  guardrails: ["raise_customer_value_objections"],
};
