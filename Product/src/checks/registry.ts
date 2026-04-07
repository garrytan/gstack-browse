/**
 * Check handler registry.
 * Maps check IDs to their handler functions.
 */

import type { CheckHandler } from "../types";
import { checkTitleBlockField } from "./c-rank/title-block";
import { checkRequiredNotation } from "./c-rank/notations";
import { checkNoteNumbering } from "./c-rank/note-numbering";
import { checkRevisionConsistency } from "./c-rank/revision";
import { checkDimensionOverlap } from "./b-rank/dimension-overlap";
import { checkOutermostDimensions } from "./b-rank/outermost-dims";
import { checkDuplicateDimensions } from "./b-rank/duplicate-dims";
import { checkFilenameMatch } from "./b-rank/filename-match";
import { checkToleranceNotation } from "./b-rank/tolerance";

// Map check IDs to their handlers.
// Handlers that share a prompt template (like C-001..C-005) use the same function
// with different promptVariables.
const HANDLER_MAP: Record<string, CheckHandler> = {
  // C-Rank
  "C-001": checkTitleBlockField,
  "C-002": checkTitleBlockField,
  "C-003": checkTitleBlockField,
  "C-004": checkTitleBlockField,
  "C-005": checkTitleBlockField,
  "C-006": checkRequiredNotation,
  "C-007": checkRequiredNotation,
  "C-008": checkNoteNumbering,
  "C-009": checkRevisionConsistency,
  "C-010": checkRequiredNotation,

  // B-Rank
  "B-001": checkDimensionOverlap,
  "B-002": checkOutermostDimensions,
  "B-003": checkDuplicateDimensions,
  "B-004": checkFilenameMatch,
  "B-005": checkToleranceNotation,
};

export function getCheckHandler(checkId: string): CheckHandler | null {
  return HANDLER_MAP[checkId] || null;
}

export function registerCheckHandler(checkId: string, handler: CheckHandler): void {
  HANDLER_MAP[checkId] = handler;
}
