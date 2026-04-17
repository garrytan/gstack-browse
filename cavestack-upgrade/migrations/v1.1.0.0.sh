#!/usr/bin/env bash
# Migration: v1.1.0.0 — Closed-loop voice enforcement
#
# What changed:
#   - New hooks/caveman-voice-verify.js Stop hook (density check, block or pass)
#   - Terminal enforcement rule (voice + anti-deferral) in all caveman-*.json
#   - density_thresholds populated per caveman profile
#   - New scripts/lib/voice-density.ts shared density math (voice-audit + hook)
#   - CLAUDE.md gains "No deferred work" section mirroring Clause B
#
# What this migration does (idempotent):
#   1. Register caveman-voice-verify Stop hook in ~/.claude/settings.json
#      (skipped if caveman always-on was disabled — no install-caveman hook found)
#   2. Record install_completed DX event (one-time)
#   3. Show "what's new in v1.1" message
#
# What it does NOT do (explicit non-destructive choices):
#   - No changes if user previously ran ./setup --no-caveman (respects opt-out)
#   - No HMAC keys, no telemetry, no remote submission
#   - No voice profile edits on user's side — their config.yaml voice key is untouched
#
# Idempotent — safe to run multiple times.
set -euo pipefail

CAVESTACK_HOME="${CAVESTACK_HOME:-$HOME/.cavestack}"
DX_FILE="$CAVESTACK_HOME/analytics/dx-metrics.jsonl"
MARKER="$CAVESTACK_HOME/.migrations/v1.1.0.0.done"
SETTINGS_FILE="${CAVESTACK_SETTINGS_FILE:-$HOME/.claude/settings.json}"

mkdir -p "$CAVESTACK_HOME/.migrations" "$CAVESTACK_HOME/analytics" 2>/dev/null

# Idempotency check
if [ -f "$MARKER" ]; then
  echo "  [v1.1.0.0] already applied, skipping"
  exit 0
fi

echo "  [v1.1.0.0] Closed-loop voice enforcement"

# Resolve cavestack root: migration runs from cavestack-upgrade/migrations/
_mig_dir="$(cd "$(dirname "$0")" && pwd)"
CAVESTACK_ROOT="$(dirname "$(dirname "$_mig_dir")")"
SETTINGS_HOOK="$CAVESTACK_ROOT/bin/cavestack-settings-hook"

# 1. Register voice-verify Stop hook — only if caveman is already installed
#    (respects --no-caveman opt-out from prior setup runs)
if [ -x "$SETTINGS_HOOK" ]; then
  _caveman_active=0
  if [ -f "$SETTINGS_FILE" ] && command -v grep >/dev/null 2>&1; then
    if grep -q "caveman-activate" "$SETTINGS_FILE" 2>/dev/null; then
      _caveman_active=1
    fi
  fi

  if [ "$_caveman_active" -eq 1 ]; then
    if [ -f "$CAVESTACK_ROOT/hooks/caveman-voice-verify.js" ]; then
      "$SETTINGS_HOOK" install-voice-verify 2>/dev/null && \
        echo "    registered caveman-voice-verify Stop hook" || \
        echo "    voice-verify registration failed (non-fatal)"
    else
      echo "    skipped voice-verify: hooks/caveman-voice-verify.js not built"
      echo "    run: cd $CAVESTACK_ROOT && bun run build:hook && $SETTINGS_HOOK install-voice-verify"
    fi
  else
    echo "    skipped voice-verify: caveman mode not active (respecting --no-caveman)"
  fi
fi

# 2. Record install_completed event (idempotent — cavestack-dx handles dedup)
if [ -x "$CAVESTACK_ROOT/bin/cavestack-dx" ]; then
  "$CAVESTACK_ROOT/bin/cavestack-dx" record install_completed "v1.1.0.0" 2>/dev/null || true
fi

# 3. Write completion marker
date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"

# 4. What's new message
cat <<'EOF'

  [v1.1.0.0] Closed-loop voice enforcement. What's new:

    NEW  caveman-voice-verify      Stop hook blocks sub-threshold output mid-session
    NEW  density_thresholds        per-profile floors in voices/caveman-*.json
    NEW  ENFORCEMENT clause        voice compression as a terminal rule
    NEW  NO DEFERRED WORK clause   anti-phased-rollout in every caveman profile
    NEW  scripts/lib/voice-density shared math for build-time + runtime checks
    NEW  voices/README.md          threshold rationale + derivation notes

  Opt-out one hook:
    cavestack-config set voice_verify false
    (or CAVESTACK_VOICE_VERIFY=0 per-session)

  Full opt-out:
    ./setup --no-caveman

EOF
