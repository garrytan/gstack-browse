#!/usr/bin/env bash
# bams-viz-emit.sh — Pipeline/step event emit helper
# Called from pipeline commands (feature, dev, hotfix, etc.)
#
# Usage:
#   bash bams-viz-emit.sh pipeline_start <slug> <type> [command] [arguments]
#   bash bams-viz-emit.sh pipeline_end   <slug> <status> [total] [completed] [failed] [skipped]
#   bash bams-viz-emit.sh step_start     <slug> <step_number> <step_name> <phase>
#   bash bams-viz-emit.sh step_end       <slug> <step_number> <status> [duration_ms]
#   bash bams-viz-emit.sh agent_start    <slug> <call_id> <agent_type> [model] [description] [prompt_summary]
#   bash bams-viz-emit.sh agent_end      <slug> <call_id> <agent_type> <status> [duration_ms] [result_summary]
#   bash bams-viz-emit.sh error          <slug> <message> [step_number] [error_code]
set -uo pipefail

EVENT_TYPE="${1:-}"
SLUG="${2:-}"

if [ -z "$EVENT_TYPE" ] || [ -z "$SLUG" ]; then
  exit 0
fi

# Resolve project root: use git root, or fallback to script's plugin directory
BAMS_ROOT="${BAMS_CREW_DIR:-}"
if [ -z "$BAMS_ROOT" ]; then
  BAMS_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || true
fi
if [ -z "$BAMS_ROOT" ]; then
  # Fallback: script is at <plugin>/hooks/bams-viz-emit.sh → plugin root
  BAMS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
EVENTS_FILE="${BAMS_ROOT}/.crew/artifacts/pipeline/${SLUG}-events.jsonl"
AGENTS_DIR="${BAMS_ROOT}/.crew/artifacts/agents"
mkdir -p "$(dirname "$EVENTS_FILE")" 2>/dev/null || true
mkdir -p "$AGENTS_DIR" 2>/dev/null || true
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(date -u +%Y-%m-%d)
AGENTS_FILE="$AGENTS_DIR/${TODAY}.jsonl"

# Department mapping from agent_type
dept_map() {
  case "$1" in
    product-strategy|business-analysis|ux-research|project-governance) echo "planning" ;;
    frontend-engineering|backend-engineering|platform-devops|data-integration) echo "engineering" ;;
    product-analytics|experimentation|performance-evaluation|business-kpi) echo "evaluation" ;;
    qa-strategy|automation-qa|defect-triage|release-quality-gate) echo "qa" ;;
    pipeline-orchestrator|cross-department-coordinator|executive-reporter|resource-optimizer) echo "management" ;;
    *) echo "general" ;;
  esac
}

case "$EVENT_TYPE" in
  pipeline_start)
    printf '{"type":"pipeline_start","pipeline_slug":"%s","pipeline_type":"%s","command":"%s","arguments":"%s","ts":"%s"}\n' \
      "$SLUG" "${3:-unknown}" "${4:-}" "${5:-}" "$TS" >> "$EVENTS_FILE"
    ;;
  pipeline_end)
    printf '{"type":"pipeline_end","pipeline_slug":"%s","status":"%s","total_steps":%s,"completed_steps":%s,"failed_steps":%s,"skipped_steps":%s,"ts":"%s"}\n' \
      "$SLUG" "${3:-completed}" "${4:-0}" "${5:-0}" "${6:-0}" "${7:-0}" "$TS" >> "$EVENTS_FILE"
    ;;
  step_start)
    printf '{"type":"step_start","pipeline_slug":"%s","step_number":%s,"step_name":"%s","phase":"%s","ts":"%s"}\n' \
      "$SLUG" "${3:-0}" "${4:-}" "${5:-}" "$TS" >> "$EVENTS_FILE"
    ;;
  step_end)
    printf '{"type":"step_end","pipeline_slug":"%s","step_number":%s,"status":"%s","duration_ms":%s,"ts":"%s"}\n' \
      "$SLUG" "${3:-0}" "${4:-done}" "${5:-0}" "$TS" >> "$EVENTS_FILE"
    ;;
  agent_start)
    CALL_ID="${3:-}"
    AGENT_TYPE="${4:-general-purpose}"
    DEPT=$(dept_map "$AGENT_TYPE")
    TRACE_ID="${SLUG}-$(date -u +%Y%m%dT%H%M%SZ)"
    # Get current step_number from pipeline events
    STEP_NUM="null"
    if [ -f "$EVENTS_FILE" ]; then
      STEP_NUM=$(grep '"step_start"' "$EVENTS_FILE" 2>/dev/null | tail -1 | jq -r '.step_number // empty' 2>/dev/null || echo "null")
      [ -z "$STEP_NUM" ] && STEP_NUM="null"
    fi
    EVENT=$(jq -cn \
      --arg type "agent_start" \
      --arg call_id "$CALL_ID" \
      --arg trace_id "$TRACE_ID" \
      --arg agent_type "$AGENT_TYPE" \
      --arg department "$DEPT" \
      --arg model "${5:-}" \
      --arg description "${6:-}" \
      --arg prompt_summary "$(printf '%s' "${7:-}" | head -c 300)" \
      --arg input "$(printf '%s' "${7:-}" | head -c 1000)" \
      --argjson step_number "$STEP_NUM" \
      --arg ts "$TS" \
      --arg pipeline_slug "$SLUG" \
      '{type:$type, call_id:$call_id, trace_id:$trace_id, agent_type:$agent_type, department:$department, model:$model, description:$description, prompt_summary:$prompt_summary, input:$input, ts:$ts}
       + (if $step_number != null then {step_number:$step_number} else {} end)
       + (if $pipeline_slug != "" then {pipeline_slug:$pipeline_slug} else {} end)')
    printf '%s\n' "$EVENT" >> "$EVENTS_FILE"
    printf '%s\n' "$EVENT" >> "$AGENTS_FILE" 2>/dev/null || true
    ;;
  agent_end)
    CALL_ID="${3:-}"
    AGENT_TYPE="${4:-general-purpose}"
    A_STATUS="${5:-success}"
    IS_ERR="false"
    [ "$A_STATUS" = "error" ] && IS_ERR="true"
    EVENT=$(jq -cn \
      --arg type "agent_end" \
      --arg call_id "$CALL_ID" \
      --arg agent_type "$AGENT_TYPE" \
      --argjson is_error "$IS_ERR" \
      --arg status "$A_STATUS" \
      --argjson duration_ms "${6:-null}" \
      --arg result_summary "$(printf '%s' "${7:-}" | head -c 300)" \
      --arg output "$(printf '%s' "${7:-}" | head -c 1000)" \
      --argjson token_usage "null" \
      --arg ts "$TS" \
      --arg pipeline_slug "$SLUG" \
      '{type:$type, call_id:$call_id, agent_type:$agent_type, is_error:$is_error, status:$status, duration_ms:$duration_ms, result_summary:$result_summary, output:$output, token_usage:$token_usage, ts:$ts}
       + (if $pipeline_slug != "" then {pipeline_slug:$pipeline_slug} else {} end)')
    printf '%s\n' "$EVENT" >> "$EVENTS_FILE"
    printf '%s\n' "$EVENT" >> "$AGENTS_FILE" 2>/dev/null || true
    ;;
  error)
    printf '{"type":"error","pipeline_slug":"%s","message":"%s","step_number":%s,"error_code":"%s","ts":"%s"}\n' \
      "$SLUG" "${3:-}" "${4:-0}" "${5:-unknown}" "$TS" >> "$EVENTS_FILE"
    ;;
esac

exit 0
