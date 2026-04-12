import { BACKEND_ROLE_PROFILE } from "./backend";
import { CUSTOMER_VOICE_ROLE_PROFILE } from "./customer-voice";
import { DESIGNER_ROLE_PROFILE } from "./designer";
import { FRONTEND_ROLE_PROFILE } from "./frontend";
import { PLANNER_ROLE_PROFILE } from "./planner";
import { QA_ROLE_PROFILE } from "./qa";

export const ROLE_REGISTRY = {
  planner: PLANNER_ROLE_PROFILE,
  designer: DESIGNER_ROLE_PROFILE,
  "customer-voice": CUSTOMER_VOICE_ROLE_PROFILE,
  frontend: FRONTEND_ROLE_PROFILE,
  backend: BACKEND_ROLE_PROFILE,
  qa: QA_ROLE_PROFILE,
} as const;

export type RoleName = keyof typeof ROLE_REGISTRY;
