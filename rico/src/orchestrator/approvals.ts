import { isProtectedActionType, type ProtectedActionType } from "./policies";

export interface EvaluateActionInput {
  type: string;
}

export interface EvaluateActionResult {
  allowed: boolean;
  state: "approved" | "awaiting_human_approval";
  blockingReason?: string;
}

export interface RiskAcceptedInput {
  actor: string;
  action: string;
  rationale: string;
  now?: () => string;
}

export interface RiskAcceptedEvent {
  type: "risk_accepted";
  actor: string;
  action: string;
  rationale: string;
  createdAt: string;
}

function blockingReasonForAction(type: ProtectedActionType) {
  switch (type) {
    case "external_message":
      return "external message requires human approval";
    case "spend":
      return "spending requires human approval";
    case "delete_data":
      return "data deletion requires human approval";
    case "deploy":
      return "deployment requires human approval";
  }
}

export function evaluateAction(input: EvaluateActionInput): EvaluateActionResult {
  if (!isProtectedActionType(input.type)) {
    return {
      allowed: true,
      state: "approved",
    };
  }

  return {
    allowed: false,
    state: "awaiting_human_approval",
    blockingReason: blockingReasonForAction(input.type),
  };
}

export function recordRiskAccepted(input: RiskAcceptedInput): RiskAcceptedEvent {
  return {
    type: "risk_accepted",
    actor: input.actor,
    action: input.action,
    rationale: input.rationale,
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
  };
}
