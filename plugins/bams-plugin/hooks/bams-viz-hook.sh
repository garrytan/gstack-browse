#!/usr/bin/env bash
# bams-viz-hook.sh — PreToolUse / PostToolUse hook for Agent tool calls
# Appends NDJSON events to .crew/artifacts/agents/YYYY-MM-DD.jsonl
# Also writes to pipeline event file if a pipeline is active.
# Performance target: < 50ms execution time
# Fail-open: never blocks execution
set -uo pipefail

# Read stdin (Claude Code passes tool info as JSON)
INPUT=$(cat 2>/dev/null || true)

# Fast-path: exit if not Agent tool
if ! printf '%s' "$INPUT" | grep -q '"Agent"' 2>/dev/null; then
  exit 0
fi

# Resolve project root: use git root, or fallback to script's plugin directory
BAMS_ROOT="${BAMS_CREW_DIR:-}"
if [ -z "$BAMS_ROOT" ]; then
  BAMS_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || true
fi
if [ -z "$BAMS_ROOT" ]; then
  BAMS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

# Agent events directory (always exists, independent of pipeline)
CREW_DIR="${BAMS_ROOT}/.crew/artifacts/agents"
mkdir -p "$CREW_DIR" 2>/dev/null || true
TODAY=$(date -u +%Y-%m-%d)
AGENTS_FILE="$CREW_DIR/${TODAY}.jsonl"

# Check for active pipeline (optional — enrich agent events with pipeline context)
PIPELINE_DIR="${BAMS_ROOT}/.crew/artifacts/pipeline"
PIPELINE_SLUG=""
PIPELINE_EVENTS=""
if [ -d "$PIPELINE_DIR" ]; then
  LOCK_FILE=$(ls -t "$PIPELINE_DIR"/*.lock 2>/dev/null | head -1)
  if [ -n "${LOCK_FILE:-}" ]; then
    PIPELINE_SLUG=$(basename "$LOCK_FILE" .lock)
    PIPELINE_EVENTS="$PIPELINE_DIR/${PIPELINE_SLUG}-events.jsonl"
  fi
fi

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
HOOK_PHASE="${CLAUDE_HOOK_EVENT:-post}"
CALLSTACK_FILE="/tmp/bams-viz-callstack"

# Parse agent info with jq (~5ms vs python3 ~25ms)
TOOL_INPUT=$(printf '%s' "$INPUT" | jq -r '.tool_input // .' 2>/dev/null)
# If tool_input is a string (JSON-encoded), parse it again
if printf '%s' "$TOOL_INPUT" | jq -e 'type == "string"' >/dev/null 2>&1; then
  TOOL_INPUT=$(printf '%s' "$TOOL_INPUT" | jq -r '.' | jq '.' 2>/dev/null || echo '{}')
fi

AGENT_TYPE=$(printf '%s' "$TOOL_INPUT" | jq -r '.subagent_type // .agent // "general-purpose"' 2>/dev/null)
# Strip namespace prefix (e.g., "bams-plugin:frontend-engineering" -> "frontend-engineering")
AGENT_TYPE="${AGENT_TYPE##*:}"
MODEL=$(printf '%s' "$TOOL_INPUT" | jq -r '.model // ""' 2>/dev/null)
DESCRIPTION=$(printf '%s' "$TOOL_INPUT" | jq -r '.description // ""' 2>/dev/null)
PROMPT_SUMMARY=$(printf '%s' "$TOOL_INPUT" | jq -r '(.prompt // "")[:300] | split("\n")[0]' 2>/dev/null)
BACKGROUND=$(printf '%s' "$TOOL_INPUT" | jq -r '.run_in_background // false' 2>/dev/null)

# Generate call_id (~2ms with md5)
CALL_ID=$(printf '%s:%s:%s' "$AGENT_TYPE" "$TS" "$$" | md5 2>/dev/null | head -c 12 || printf '%s:%s:%s' "$AGENT_TYPE" "$TS" "$$" | md5sum 2>/dev/null | head -c 12)

if printf '%s' "$HOOK_PHASE" | grep -qi "pre"; then
  # Push call_id to stack
  printf '%s|%s|%s\n' "$CALL_ID" "$AGENT_TYPE" "$TS" >> "$CALLSTACK_FILE" 2>/dev/null || true

  EVENT_JSON=$(jq -cn \
    --arg type "agent_start" \
    --arg call_id "$CALL_ID" \
    --arg agent_type "$AGENT_TYPE" \
    --arg model "$MODEL" \
    --arg description "$DESCRIPTION" \
    --arg prompt_summary "$PROMPT_SUMMARY" \
    --argjson background "${BACKGROUND:-false}" \
    --arg ts "$TS" \
    --arg pipeline_slug "$PIPELINE_SLUG" \
    '{type:$type, call_id:$call_id, agent_type:$agent_type, model:$model, description:$description, prompt_summary:$prompt_summary, background:$background, ts:$ts} + (if $pipeline_slug != "" then {pipeline_slug:$pipeline_slug} else {} end)')
else
  # Pop call_id from stack
  MATCHED_CALL_ID="$CALL_ID"
  MATCHED_START_TS=""
  if [ -f "$CALLSTACK_FILE" ] && [ -s "$CALLSTACK_FILE" ]; then
    LAST_LINE=$(tail -1 "$CALLSTACK_FILE" 2>/dev/null)
    if [ -n "$LAST_LINE" ]; then
      MATCHED_CALL_ID=$(printf '%s' "$LAST_LINE" | cut -d'|' -f1)
      MATCHED_START_TS=$(printf '%s' "$LAST_LINE" | cut -d'|' -f3)
      # Remove last line
      sed -i '' '$d' "$CALLSTACK_FILE" 2>/dev/null || sed -i '$d' "$CALLSTACK_FILE" 2>/dev/null || true
    fi
  fi

  # Parse result info
  IS_ERROR=$(printf '%s' "$INPUT" | jq -r '.tool_result.is_error // false' 2>/dev/null)
  RESULT_SUMMARY=$(printf '%s' "$INPUT" | jq -r '
    .tool_result.content
    | if type == "string" then .[:300]
      elif type == "array" then (map(select(.type == "text") | .text) | first // "")[:300]
      else ""
      end' 2>/dev/null)

  # Compute duration_ms
  DURATION_MS="null"
  if [ -n "$MATCHED_START_TS" ]; then
    START_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$MATCHED_START_TS" "+%s" 2>/dev/null || date -d "$MATCHED_START_TS" "+%s" 2>/dev/null)
    END_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$TS" "+%s" 2>/dev/null || date -d "$TS" "+%s" 2>/dev/null)
    if [ -n "${START_EPOCH:-}" ] && [ -n "${END_EPOCH:-}" ]; then
      DURATION_MS=$(( (END_EPOCH - START_EPOCH) * 1000 ))
    fi
  fi

  ERROR_MSG=""
  if [ "$IS_ERROR" = "true" ]; then
    ERROR_MSG="$RESULT_SUMMARY"
  fi

  EVENT_JSON=$(jq -cn \
    --arg type "agent_end" \
    --arg call_id "$MATCHED_CALL_ID" \
    --arg agent_type "$AGENT_TYPE" \
    --argjson is_error "${IS_ERROR:-false}" \
    --argjson duration_ms "${DURATION_MS:-null}" \
    --arg result_summary "$RESULT_SUMMARY" \
    --arg ts "$TS" \
    --arg pipeline_slug "$PIPELINE_SLUG" \
    --arg error_message "$ERROR_MSG" \
    '{type:$type, call_id:$call_id, agent_type:$agent_type, is_error:$is_error, duration_ms:$duration_ms, result_summary:$result_summary, ts:$ts} + (if $error_message != "" then {error_message:$error_message} else {} end) + (if $pipeline_slug != "" then {pipeline_slug:$pipeline_slug} else {} end)')
fi

# Atomic append to agents file (always)
if [ -n "${EVENT_JSON:-}" ]; then
  printf '%s\n' "$EVENT_JSON" >> "$AGENTS_FILE" 2>/dev/null || true

  # Also append to pipeline events file (if pipeline active)
  if [ -n "${PIPELINE_EVENTS:-}" ]; then
    printf '%s\n' "$EVENT_JSON" >> "$PIPELINE_EVENTS" 2>/dev/null || true
  fi
fi

exit 0
