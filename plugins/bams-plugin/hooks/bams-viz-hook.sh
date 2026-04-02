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

# Parse agent info with python3 (available on macOS, ~20ms)
EVENT_JSON=$(python3 -c '
import sys, json, hashlib, os, time

try:
    data = json.loads(sys.stdin.read())
except:
    sys.exit(0)

hook = os.environ.get("CLAUDE_HOOK_EVENT", "post")
ts = sys.argv[1]
pipeline_slug = sys.argv[2]
callstack_file = sys.argv[3]

tool_input = data.get("tool_input", data)
if isinstance(tool_input, str):
    try:
        tool_input = json.loads(tool_input)
    except:
        tool_input = {}

agent_type = tool_input.get("subagent_type", tool_input.get("agent", "general-purpose"))
if ":" in str(agent_type):
    agent_type = agent_type.split(":")[-1]
model = tool_input.get("model", "")
description = tool_input.get("description", "")
prompt_raw = tool_input.get("prompt", "")
prompt_summary = prompt_raw.split("\n")[0][:300] if prompt_raw else ""
background = tool_input.get("run_in_background", False)

call_id = hashlib.md5(f"{agent_type}:{ts}:{id(data)}:{time.time_ns()}".encode()).hexdigest()[:12]

if "pre" in hook.lower():
    # Push call_id to stack
    try:
        with open(callstack_file, "a") as f:
            f.write(f"{call_id}|{agent_type}|{ts}\n")
    except:
        pass
    event = {
        "type": "agent_start",
        "call_id": call_id,
        "agent_type": agent_type,
        "model": model,
        "description": description,
        "prompt_summary": prompt_summary,
        "background": background,
        "ts": ts,
    }
    if pipeline_slug:
        event["pipeline_slug"] = pipeline_slug
else:
    # Pop call_id from stack
    matched_call_id = call_id
    matched_start_ts = ""
    try:
        with open(callstack_file, "r") as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
        if lines:
            parts = lines[-1].split("|")
            matched_call_id = parts[0]
            matched_start_ts = parts[2] if len(parts) > 2 else ""
            with open(callstack_file, "w") as f:
                f.write("\n".join(lines[:-1]) + "\n" if len(lines) > 1 else "")
    except:
        pass

    is_error = False
    error_message = ""
    result_summary = ""
    tool_result = data.get("tool_result", {})
    if isinstance(tool_result, dict):
        is_error = tool_result.get("is_error", False)
        content = tool_result.get("content", "")
        if isinstance(content, str):
            result_summary = content[:300]
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    result_summary = item.get("text", "")[:300]
                    break
        if is_error:
            error_message = result_summary[:500]

    # Compute duration if we have start timestamp
    duration_ms = None
    if matched_start_ts:
        try:
            from datetime import datetime
            start = datetime.fromisoformat(matched_start_ts.replace("Z", "+00:00"))
            end = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            duration_ms = int((end - start).total_seconds() * 1000)
        except:
            pass

    event = {
        "type": "agent_end",
        "call_id": matched_call_id,
        "agent_type": agent_type,
        "is_error": is_error,
        "duration_ms": duration_ms,
        "result_summary": result_summary,
        "ts": ts,
    }
    if is_error and error_message:
        event["error_message"] = error_message
    if pipeline_slug:
        event["pipeline_slug"] = pipeline_slug

print(json.dumps(event, ensure_ascii=False))
' "$TS" "$PIPELINE_SLUG" "$CALLSTACK_FILE" <<< "$INPUT" 2>/dev/null)

# Atomic append to agents file (always)
if [ -n "${EVENT_JSON:-}" ]; then
  printf '%s\n' "$EVENT_JSON" >> "$AGENTS_FILE" 2>/dev/null || true

  # Also append to pipeline events file (if pipeline active)
  if [ -n "${PIPELINE_EVENTS:-}" ]; then
    printf '%s\n' "$EVENT_JSON" >> "$PIPELINE_EVENTS" 2>/dev/null || true
  fi
fi

exit 0
