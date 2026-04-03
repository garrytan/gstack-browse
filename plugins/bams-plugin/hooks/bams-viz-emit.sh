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

# Global bams root: all projects share ~/.bams/ for cross-project visibility
# Override: BAMS_ROOT env var (same name used in event-store.ts, app.ts, global-root.ts)
BAMS_ROOT="${BAMS_ROOT:-$HOME/.bams}"
mkdir -p "$BAMS_ROOT" 2>/dev/null || true
EVENTS_FILE="${BAMS_ROOT}/artifacts/pipeline/${SLUG}-events.jsonl"
AGENTS_DIR="${BAMS_ROOT}/artifacts/agents"
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
    jq -cn --arg slug "$SLUG" --arg ptype "${3:-unknown}" --arg cmd "${4:-}" --arg args "${5:-}" --arg ts "$TS" \
      '{type:"pipeline_start",pipeline_slug:$slug,pipeline_type:$ptype,command:$cmd,arguments:$args,ts:$ts}' >> "$EVENTS_FILE"
    ;;
  pipeline_end)
    jq -cn --arg slug "$SLUG" --arg status "${3:-completed}" --argjson total "${4:-0}" --argjson completed "${5:-0}" --argjson failed "${6:-0}" --argjson skipped "${7:-0}" --arg ts "$TS" \
      '{type:"pipeline_end",pipeline_slug:$slug,status:$status,total_steps:$total,completed_steps:$completed,failed_steps:$failed,skipped_steps:$skipped,ts:$ts}' >> "$EVENTS_FILE"
    ;;
  step_start)
    jq -cn --arg slug "$SLUG" --argjson num "${3:-0}" --arg name "${4:-}" --arg phase "${5:-}" --arg ts "$TS" \
      '{type:"step_start",pipeline_slug:$slug,step_number:$num,step_name:$name,phase:$phase,ts:$ts}' >> "$EVENTS_FILE"
    ;;
  step_end)
    jq -cn --arg slug "$SLUG" --argjson num "${3:-0}" --arg status "${4:-done}" --argjson dur "${5:-0}" --arg ts "$TS" \
      '{type:"step_end",pipeline_slug:$slug,step_number:$num,status:$status,duration_ms:$dur,ts:$ts}' >> "$EVENTS_FILE"
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
    # 토큰 사용량이 전달된 경우 Control Plane에 기록 (B4: CostDB 연동)
    # 8번째 인자($8): token_usage JSON {"input_tokens":N,"output_tokens":N,"model":"..."} 또는 "null"
    TOKEN_USAGE="${8:-null}"
    if [ -n "$TOKEN_USAGE" ] && [ "$TOKEN_USAGE" != "null" ]; then
      _IN_TOK=$(echo "$TOKEN_USAGE" | jq -r '.input_tokens // 0' 2>/dev/null || echo 0)
      _OUT_TOK=$(echo "$TOKEN_USAGE" | jq -r '.output_tokens // 0' 2>/dev/null || echo 0)
      _MODEL=$(echo "$TOKEN_USAGE" | jq -r '.model // empty' 2>/dev/null || echo "")
      [ -z "$_MODEL" ] && _MODEL="$AGENT_TYPE"
      curl -s --max-time 1 -X POST http://localhost:3099/api/costs \
        -H "Content-Type: application/json" \
        -d "$(jq -cn \
          --arg slug "$SLUG" \
          --arg agent "$AGENT_TYPE" \
          --arg model "$_MODEL" \
          --argjson input "$_IN_TOK" \
          --argjson output "$_OUT_TOK" \
          '{pipeline_slug:$slug,agent_slug:$agent,model:$model,input_tokens:$input,output_tokens:$output,billed_cents:0}')" \
        > /dev/null 2>&1 || true
    fi
    ;;
  error)
    jq -cn --arg slug "$SLUG" --arg msg "${3:-}" --argjson num "${4:-0}" --arg code "${5:-unknown}" --arg ts "$TS" \
      '{type:"error",pipeline_slug:$slug,message:$msg,step_number:$num,error_code:$code,ts:$ts}' >> "$EVENTS_FILE"
    ;;
esac

exit 0
