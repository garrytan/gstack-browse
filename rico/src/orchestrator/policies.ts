export const MAX_DIRECT_GOAL_TASKS = 8;
export const INITIATIVE_PHASE_SIZE = 4;

export const PROTECTED_ACTION_TYPES = [
  "external_message",
  "spend",
  "delete_data",
  "deploy",
] as const;

export type ProtectedActionType = (typeof PROTECTED_ACTION_TYPES)[number];

const PROTECTED_ACTION_SET = new Set<string>(PROTECTED_ACTION_TYPES);

export function isProtectedActionType(type: string): type is ProtectedActionType {
  return PROTECTED_ACTION_SET.has(type);
}
