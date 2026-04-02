#!/usr/bin/env bash
# bams-viz-emit.sh — Pipeline/step event emit helper
# Called from pipeline commands (feature, dev, hotfix, etc.)
#
# Usage:
#   bash bams-viz-emit.sh pipeline_start <slug> <type> [command] [arguments]
#   bash bams-viz-emit.sh pipeline_end   <slug> <status> [total] [completed] [failed] [skipped]
#   bash bams-viz-emit.sh step_start     <slug> <step_number> <step_name> <phase>
#   bash bams-viz-emit.sh step_end       <slug> <step_number> <status> [duration_ms]
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
mkdir -p "$(dirname "$EVENTS_FILE")" 2>/dev/null || true
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

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
  error)
    printf '{"type":"error","pipeline_slug":"%s","message":"%s","step_number":%s,"error_code":"%s","ts":"%s"}\n' \
      "$SLUG" "${3:-}" "${4:-0}" "${5:-unknown}" "$TS" >> "$EVENTS_FILE"
    ;;
esac

exit 0
