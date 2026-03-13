---
name: cfo
version: 1.0.0
description: |
  CFO mode: show current session cost and elapsed time, then run the AI spend
  dashboard for this project. Tells you exactly what you've spent this session
  and in total on the project.
allowed-tools:
  - Bash
  - Read
---

# /cfo — Session Cost + Project Spend Dashboard

You are running the `/cfo` skill. Show what this session cost and what the total project spend looks like.

## Step 1 — Locate the ai_spend.py script

```bash
if [ -f .claude/skills/cfo/ai_spend.py ]; then
  echo "SCRIPT=.claude/skills/cfo/ai_spend.py"
elif [ -f ~/.claude/skills/cfo/ai_spend.py ]; then
  echo "SCRIPT=$HOME/.claude/skills/cfo/ai_spend.py"
else
  echo "SCRIPT=NOT_FOUND"
fi
```

If `NOT_FOUND`, tell the user: "ai_spend.py not found. Run `cd ~/.claude/skills/gstack && ./setup` (user install) or `cd .claude/skills/gstack && ./setup` (project install) to reinstall." Then stop.

Set `SCRIPT` to whichever path was found.

## Step 2 — Gather all session metrics in one call

Run this entire block as a single bash command. It finds the transcript, computes cost and elapsed time, and gets git stats — all in one shell so variables don't get lost between calls.

Note: cost is computed using Claude Sonnet pricing (input $3/MTok, cache_write $3.75/MTok, cache_read $0.30/MTok, output $15/MTok). If using Opus or Haiku the estimate will differ; the full dashboard in Step 3 uses per-model pricing.

```bash
PROJECT_DIR=$(pwd | sed 's|/|-|g')
TRANSCRIPT=$(ls -t "$HOME/.claude/projects/$PROJECT_DIR"/*.jsonl 2>/dev/null | head -1)

if [ -z "$TRANSCRIPT" ]; then
  echo "SESSION_COST=unavailable"
  echo "ELAPSED=unavailable"
else
  # Compute cost and timestamps in one awk pass
  eval $(jq -r 'select(.message.usage) | [
    (.message.usage.input_tokens // 0),
    (.message.usage.cache_creation_input_tokens // 0),
    (.message.usage.cache_read_input_tokens // 0),
    (.message.usage.output_tokens // 0),
    (.timestamp // "")
  ] | @tsv' "$TRANSCRIPT" | awk -F'\t' '
  NR==1 { first_ts = $5 }
  { input += $1; cache_write += $2; cache_read += $3; output += $4; last_ts = $5 }
  END {
    cost = (input * 3 + cache_write * 3.75 + cache_read * 0.30 + output * 15) / 1000000
    printf "SESSION_COST=$%.4f\nFIRST_TS=%s\nLAST_TS=%s\n", cost, first_ts, last_ts
  }')

  # Compute elapsed time
  ELAPSED=$(python3 -c "
from datetime import datetime
def p(s): return datetime.fromisoformat(s.replace('Z','+00:00'))
diff = p('$LAST_TS') - p('$FIRST_TS')
m = int(diff.total_seconds() / 60)
print(f'{m//60}h {m%60}m' if m >= 60 else f'{m}m')
" 2>/dev/null || echo "unavailable")

  echo "SESSION_COST=$SESSION_COST"
  echo "ELAPSED=$ELAPSED"
fi

# Git stats
GIT_STATS=$(git diff --stat HEAD 2>/dev/null | tail -1)
echo "GIT_STATS=${GIT_STATS:-none}"
```

Use the SESSION_COST, ELAPSED, and GIT_STATS values for the banner in Step 4.

## Step 3 — Run the project spend dashboard

```bash
python3 "$SCRIPT" "$(pwd)" --days 30
```

## Step 4 — Print the session banner, then the dashboard

Print this banner using the values from Step 2:

```
╔══════════════════════════════════════════════════╗
║  This session                                    ║
╠══════════════════════════════════════════════════╣
║  $<session_cost> · <elapsed> · <git +N −N>       ║
╚══════════════════════════════════════════════════╝
```

Then output the full ai_spend.py dashboard (Step 3 output) below it.

- If SESSION_COST is "unavailable", omit the cost from the banner and note that the transcript was not found.
- If GIT_STATS is "none", omit the git portion of the banner line.
