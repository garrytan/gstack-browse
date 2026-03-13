#!/usr/bin/env python3
"""
ai_spend.py — AI Spend Dashboard
=================================
Track and analyze spending across Claude Code and other AI tools.
Supports user, team, and org views.

Usage:
  python3 ai_spend.py                        # Your personal dashboard (all projects)
  python3 ai_spend.py /path/to/project       # Dashboard for a specific project
  python3 ai_spend.py --team                 # Team view (reads from team_dir in config)
  python3 ai_spend.py --org                  # Org view (aggregates all teams)
  python3 ai_spend.py --days 7               # Last 7 days (default: 30)
  python3 ai_spend.py --add                  # Log a spend entry from another AI tool
  python3 ai_spend.py --export               # Export your data for team sharing
  python3 ai_spend.py --setup                # Interactive first-time configuration

Config:  ~/.ai-spend-config.json
Log:     ~/.ai-spend-log.json   (other AI tools)
Exports: <team_dir>/<user>.json  (team-level aggregation)
"""

import argparse
import json
import math
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────────

# Per-model pricing (cost per token)
MODEL_PRICING = {
    # Claude Sonnet 4.x
    "claude-sonnet-4-6": {"input": 3.0, "cache_write": 3.75, "cache_read": 0.30, "output": 15.0},
    "claude-sonnet-4-5": {"input": 3.0, "cache_write": 3.75, "cache_read": 0.30, "output": 15.0},
    # Claude Opus 4.x
    "claude-opus-4-6":   {"input": 15.0, "cache_write": 18.75, "cache_read": 1.50, "output": 75.0},
    "claude-opus-4-5":   {"input": 15.0, "cache_write": 18.75, "cache_read": 1.50, "output": 75.0},
    # Claude Haiku 4.x
    "claude-haiku-4-5":  {"input": 0.80, "cache_write": 1.00,  "cache_read": 0.08, "output": 4.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "cache_write": 1.00, "cache_read": 0.08, "output": 4.0},
    # Fallback / unknown
    "_default":          {"input": 3.0, "cache_write": 3.75, "cache_read": 0.30, "output": 15.0},
}

HOME         = Path.home()
PROJECTS_DIR = HOME / ".claude" / "projects"
CONFIG_FILE  = HOME / ".ai-spend-config.json"
SPEND_LOG    = HOME / ".ai-spend-log.json"

# ── ANSI styling ──────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
WHITE  = "\033[97m"
GRAY   = "\033[90m"
ORANGE = "\033[33m"


def s(*codes):
    """Return a styler function for ANSI codes."""
    def style(text):
        return "".join(codes) + str(text) + RESET
    return style


hi    = s(BOLD, CYAN)
dim   = s(DIM)
warn  = s(YELLOW)
err   = s(RED)
good  = s(GREEN)
bold  = s(BOLD)
gray  = s(GRAY)
money = s(BOLD, WHITE)
title = s(BOLD, CYAN)


# ── Configuration ─────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "user":     os.environ.get("USER", "me"),
    "team":     "",
    "org":      "",
    "team_dir": "",
    "budgets": {
        "daily_user":    100.0,
        "daily_team":    500.0,
        "monthly_user":  2000.0,
        "monthly_org":   10000.0,
    },
}


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                cfg = json.load(f)
            # Merge with defaults so new keys always exist
            merged = {**DEFAULT_CONFIG, **cfg}
            merged["budgets"] = {**DEFAULT_CONFIG["budgets"], **cfg.get("budgets", {})}
            return merged
        except Exception:
            pass
    return {**DEFAULT_CONFIG}


def save_config(cfg: dict):
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


# ── Data Loading — Claude Code ────────────────────────────────────────────────

def pricing_for_model(model: str) -> dict:
    """Return per-million-token pricing dict for a model."""
    for key in MODEL_PRICING:
        if key != "_default" and model and model.startswith(key):
            return MODEL_PRICING[key]
    return MODEL_PRICING["_default"]


def token_cost(p: dict, input_tok: int, cache_write: int,
               cache_read: int, output_tok: int) -> float:
    return (
        input_tok    * p["input"]       / 1_000_000 +
        cache_write  * p["cache_write"] / 1_000_000 +
        cache_read   * p["cache_read"]  / 1_000_000 +
        output_tok   * p["output"]      / 1_000_000
    )


_SYSTEM_PATTERNS = re.compile(
    r"^(\[Image:|"                            # image references
    r"\[Request interrupted|"                # interruption messages
    r"<task-notification>|"                  # task notifications
    r"<system-reminder>|"                    # system reminders
    r"<command-message>|"                    # slash command wrappers
    r"<command-name>|"                       # slash command wrappers
    r"This session is being continued|"      # session continuation injections
    r"Base directory for this skill:|"       # skill invocation preamble
    r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}"  # log lines with timestamps
    r")",
    re.IGNORECASE,
)

_PASTED_CONTENT = re.compile(
    r"^(\{[\s\S]*\}|"           # raw JSON objects
    r"\[[\s\S]*\]|"             # raw JSON arrays
    r"\S+@\S+[\s%$]|"           # shell prompts (user@host %)
    r"https?://\S+$"            # bare URLs only
    r")",
)


def _is_real_user_message(text: str) -> bool:
    """Return True only for genuine human-typed conversational messages."""
    if len(text) < 20:
        return False
    if _SYSTEM_PATTERNS.match(text):
        return False
    if _PASTED_CONTENT.match(text):
        return False
    # Skip messages that are purely XML wrappers
    stripped = text.strip()
    if stripped.startswith("<") and ">" in stripped[:40]:
        tag = stripped[1: stripped.index(">")]
        if tag.isalpha() or "-" in tag:
            return False
    return True


def load_session(jsonl_path: Path) -> dict | None:
    """Parse a Claude Code .jsonl transcript into a session dict."""
    input_tok = cw_tok = cr_tok = out_tok = 0
    messages  = []
    first_ts  = last_ts = None
    cwd       = git_branch = session_id = None
    models    = set()

    try:
        with open(jsonl_path, errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue

                rtype = row.get("type")

                # Session metadata from first user row
                if rtype == "user" and not session_id:
                    session_id = row.get("sessionId")
                    cwd        = row.get("cwd", "")
                    git_branch = row.get("gitBranch", "")

                # Collect user message text
                if rtype == "user":
                    msg     = row.get("message", {})
                    content = msg.get("content", "")
                    if isinstance(content, list):
                        text = " ".join(
                            b.get("text", "") for b in content
                            if isinstance(b, dict) and b.get("type") == "text"
                        )
                    else:
                        text = str(content)
                    ts = row.get("timestamp", "")
                    if ts:
                        if not first_ts:
                            first_ts = ts
                        last_ts = ts
                    text = text.strip()
                    if _is_real_user_message(text):
                        messages.append({"role": "user", "content": text, "ts": ts})

                # Token usage from assistant messages
                usage = row.get("message", {}).get("usage")
                if usage:
                    model = row.get("message", {}).get("model", "")
                    if model:
                        models.add(model)
                    p       = pricing_for_model(model)
                    input_tok += usage.get("input_tokens", 0)
                    cw_tok    += usage.get("cache_creation_input_tokens", 0)
                    cr_tok    += usage.get("cache_read_input_tokens", 0)
                    out_tok   += usage.get("output_tokens", 0)
                    ts = row.get("timestamp", "")
                    if ts:
                        if not first_ts:
                            first_ts = ts
                        last_ts = ts

    except (OSError, IOError):
        return None

    # Use the dominant model's pricing for total cost
    dominant_model = next(iter(models), "")
    p    = pricing_for_model(dominant_model)
    cost = token_cost(p, input_tok, cw_tok, cr_tok, out_tok)

    session_date = None
    if last_ts:
        try:
            session_date = last_ts[:10]
        except Exception:
            pass

    if not session_date:
        return None

    return {
        "session_id":     session_id or jsonl_path.stem,
        "cwd":            cwd or "",
        "git_branch":     git_branch or "main",
        "date":           session_date,
        "cost":           cost,
        "input_tokens":   input_tok,
        "cache_write_tokens": cw_tok,
        "cache_read_tokens":  cr_tok,
        "output_tokens":  out_tok,
        "models":         list(models),
        "messages":       messages,
        "first_ts":       first_ts,
        "last_ts":        last_ts,
        "tool":           "claude-code",
        "file":           str(jsonl_path),
    }


def load_all_sessions(filter_cwd: Path = None) -> list[dict]:
    """Load all Claude Code sessions. Optionally filter to a specific project folder."""
    sessions = []
    if not PROJECTS_DIR.exists():
        return sessions

    # Derive the project key for the filter folder
    filter_key = None
    if filter_cwd:
        filter_key = str(filter_cwd).lstrip("/").replace("/", "-")

    for project_dir in sorted(PROJECTS_DIR.iterdir()):
        if not project_dir.is_dir():
            continue
        if filter_key and filter_key not in project_dir.name:
            continue
        for jsonl in sorted(project_dir.glob("*.jsonl")):
            s = load_session(jsonl)
            if s:
                sessions.append(s)

    return sessions


# ── Data Loading — Other Tools ────────────────────────────────────────────────

def load_other_tools() -> list[dict]:
    """Load manually logged spend from ~/.ai-spend-log.json."""
    if not SPEND_LOG.exists():
        return []
    try:
        with open(SPEND_LOG) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_other_tools(entries: list[dict]):
    with open(SPEND_LOG, "w") as f:
        json.dump(entries, f, indent=2)


# ── Data Loading — Team / Org ─────────────────────────────────────────────────

def load_team_exports(team_dir: str) -> list[dict]:
    """Load all user export files from a shared team directory."""
    if not team_dir:
        return []
    td = Path(team_dir)
    if not td.exists():
        return []
    members = []
    for f in sorted(td.glob("*.json")):
        try:
            with open(f) as fh:
                data = json.load(fh)
            if isinstance(data, dict) and "user" in data:
                members.append(data)
        except Exception:
            continue
    return members


def build_export_payload(cfg: dict, sessions: list[dict], other: list[dict]) -> dict:
    """Build a privacy-safe export for team sharing (no raw message content)."""
    daily: dict = defaultdict(lambda: {"total": 0.0, "by_tool": defaultdict(float), "by_project": defaultdict(float)})
    feature_spend: dict = defaultdict(float)

    for s in sessions:
        d = s["date"]
        p = Path(s["cwd"]).name if s["cwd"] else "unknown"
        b = s["git_branch"] or "main"
        daily[d]["total"]              += s["cost"]
        daily[d]["by_tool"]["claude-code"] += s["cost"]
        daily[d]["by_project"][p]      += s["cost"]
        feature_spend[f"{p}/{b}"]      += s["cost"]

    for e in other:
        d = e.get("date", "")
        t = e.get("tool", "other")
        c = float(e.get("cost", 0))
        p = Path(e.get("project", "")).name or t
        daily[d]["total"]         += c
        daily[d]["by_tool"][t]    += c
        daily[d]["by_project"][p] += c
        desc = e.get("description", "")
        feature_spend[f"{p}/{desc}" if desc else p] += c

    # Convert defaultdicts for JSON serialisation
    clean_daily = {}
    for d, v in daily.items():
        clean_daily[d] = {
            "total":      round(v["total"], 4),
            "by_tool":    {k: round(vv, 4) for k, vv in v["by_tool"].items()},
            "by_project": {k: round(vv, 4) for k, vv in v["by_project"].items()},
        }

    return {
        "user":         cfg.get("user", ""),
        "team":         cfg.get("team", ""),
        "org":          cfg.get("org", ""),
        "exported_at":  datetime.utcnow().isoformat() + "Z",
        "daily_spend":  clean_daily,
        "feature_spend": {k: round(v, 4) for k, v in feature_spend.items()},
    }


# ── Analysis ──────────────────────────────────────────────────────────────────

def bag_of_words(text: str) -> dict:
    """Simple bag-of-words tokenizer with stop-word removal."""
    STOPS = {
        "the","a","an","and","or","but","in","on","at","to","for","of",
        "with","by","from","up","about","into","i","we","you","it","this",
        "that","is","was","are","be","have","has","had","do","does","did",
        "will","would","could","should","may","might","can","please","just",
        "my","me","its","not","so","if","as","what","how","let","add","make",
        "need","want","get","use","using","also","now","then","new","hi",
    }
    tokens = re.findall(r'\b[a-z]{3,}\b', text.lower())
    freq: dict = defaultdict(int)
    for t in tokens:
        if t not in STOPS:
            freq[t] += 1
    return dict(freq)


def cosine_sim(a: dict, b: dict) -> float:
    keys = set(a) | set(b)
    if not keys:
        return 0.0
    dot    = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    mag_a  = math.sqrt(sum(v * v for v in a.values()))
    mag_b  = math.sqrt(sum(v * v for v in b.values()))
    return dot / (mag_a * mag_b) if mag_a and mag_b else 0.0


def find_repetitive_prompts(sessions: list[dict], threshold: float = 0.65) -> list[dict]:
    """
    Find clusters of semantically similar prompts across sessions.
    Returns up to 10 clusters sorted by repetition count.
    """
    all_msgs: list[dict] = []
    for s in sessions:
        for m in s["messages"]:
            txt = m["content"]
            if len(txt) > 30:
                all_msgs.append({
                    "content":    txt,
                    "session_id": s["session_id"],
                    "cwd":        s["cwd"],
                    "date":       s["date"],
                    "bow":        bag_of_words(txt),
                })

    # Cap at 600 messages for performance
    if len(all_msgs) > 600:
        all_msgs = all_msgs[-600:]

    if not all_msgs:
        return []

    clusters   = []
    used       = set()

    for i, msg_a in enumerate(all_msgs):
        if i in used:
            continue
        cluster_idxs = [i]
        for j in range(i + 1, len(all_msgs)):
            if j in used:
                continue
            if cosine_sim(msg_a["bow"], all_msgs[j]["bow"]) >= threshold:
                cluster_idxs.append(j)
                used.add(j)
        if len(cluster_idxs) >= 2:
            used.add(i)
            clusters.append({
                "count":    len(cluster_idxs),
                "example":  msg_a["content"][:120],
                "messages": [all_msgs[k] for k in cluster_idxs],
            })

    return sorted(clusters, key=lambda x: x["count"], reverse=True)[:10]


def estimate_waste(clusters: list[dict], sessions: list[dict]) -> float:
    """Rough dollar estimate of spend attributable to prompt repetition."""
    if not sessions:
        return 0.0
    total_cost = sum(s["cost"] for s in sessions)
    total_msgs = sum(len(s["messages"]) for s in sessions)
    if total_msgs == 0:
        return 0.0
    cost_per_msg = total_cost / total_msgs
    return sum((cl["count"] - 1) * cost_per_msg for cl in clusters)


def cache_hit_rate(sessions: list[dict]) -> float:
    cr  = sum(s["cache_read_tokens"]  for s in sessions)
    inp = sum(s["input_tokens"]       for s in sessions)
    cw  = sum(s["cache_write_tokens"] for s in sessions)
    total = inp + cr + cw
    return cr / total if total else 0.0


def generate_strategies(sessions: list[dict], clusters: list[dict],
                        waste: float, cfg: dict, target_folder: Path | None) -> list[str]:
    tips = []

    if not sessions:
        tips += [
            "Use prompt caching — cache reads cost 90% less than fresh input tokens.",
            "Work in focused sessions: one feature per session keeps context small.",
            "Log Cursor, Lovable, and other AI tools with `python3 ai_spend.py --add`.",
            "Run `/session` at the end of each Claude Code session to track cost.",
        ]
        return tips

    total_cost  = sum(s["cost"] for s in sessions)
    n_sessions  = len(sessions)
    avg_cost    = total_cost / n_sessions if n_sessions else 0
    hit_rate    = cache_hit_rate(sessions)
    out_tokens  = sum(s["output_tokens"] for s in sessions)
    all_tokens  = sum(
        s["input_tokens"] + s["cache_read_tokens"] + s["cache_write_tokens"] + s["output_tokens"]
        for s in sessions
    )
    output_ratio = out_tokens / all_tokens if all_tokens else 0

    if clusters:
        tips.append(
            f"You re-asked similar questions {sum(c['count'] for c in clusters)}× — "
            f"potential savings: {fmt_cost(waste)}. "
            "Add common answers to CLAUDE.md so they're cached automatically."
        )

    if hit_rate < 0.25:
        tips.append(
            f"Cache hit rate is {hit_rate:.0%} — keep sessions open longer instead of "
            "starting fresh. Cache reads cost 10× less than uncached input."
        )
    elif hit_rate >= 0.65:
        tips.append(
            f"Excellent cache hit rate ({hit_rate:.0%}). "
            "You're efficiently reusing context — keep it up."
        )

    if avg_cost > 5.0:
        tips.append(
            f"Average session cost is {fmt_cost(avg_cost)}. "
            "Scope sessions to one feature and start a new one when switching tasks."
        )

    if output_ratio > 0.45:
        tips.append(
            f"Output tokens are {output_ratio:.0%} of total spend — "
            "output costs 5× more than input. Break large generation tasks into "
            "smaller, targeted requests."
        )

    tips.append(
        "Use extended thinking sparingly — it generates many output tokens. "
        "Reserve it for genuinely hard problems."
    )

    if not SPEND_LOG.exists():
        tips.append(
            f"Track Cursor, Lovable, ChatGPT, and other tools: "
            f"`python3 ai_spend.py --add`  →  stored in {SPEND_LOG}"
        )

    team_dir = cfg.get("team_dir", "")
    if not team_dir:
        tips.append(
            "Set up team sharing: run `python3 ai_spend.py --setup` to configure "
            "a shared directory so your team can see aggregated spend."
        )

    return tips[:6]


# ── Formatting helpers ────────────────────────────────────────────────────────

def fmt_cost(v: float) -> str:
    if v == 0:
        return "$0.00"
    if v < 0.01:
        return "<$0.01"
    return f"${v:,.2f}"


def fmt_date(d: str) -> str:
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%b %d")
    except Exception:
        return d


def truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def bar_chart(value: float, max_val: float, width: int = 22) -> str:
    if max_val == 0:
        return dim("─" * width)
    filled = round((value / max_val) * width)
    filled = max(0, min(width, filled))
    return s(BLUE)("█" * filled) + s(GRAY)("░" * (width - filled))


def budget_indicator(cost: float, budget: float) -> str:
    if budget <= 0:
        return ""
    pct = cost / budget
    if pct >= 1.0:
        return err(f" ▲ {pct:.0%} of budget")
    if pct >= 0.80:
        return warn(f" ⚠ {pct:.0%} of budget")
    return good(f" ✓ {pct:.0%} of budget")


# ── Dashboard sections ────────────────────────────────────────────────────────

W = 64  # box width

def rule():
    print(dim("  " + "─" * (W - 4)))


def section(label: str):
    print()
    print(bold(f"  {label}"))
    rule()


def print_banner(label: str, sub: str = ""):
    inner = W - 4
    print()
    print(hi("┌" + "─" * (W - 2) + "┐"))
    print(hi("│ ") + bold(label.center(inner)) + hi(" │"))
    if sub:
        print(hi("│ ") + dim(sub.center(inner)) + hi(" │"))
    print(hi("└" + "─" * (W - 2) + "┘"))


# ── User dashboard ────────────────────────────────────────────────────────────

def render_user_dashboard(cfg: dict, target_folder: Path | None, days: int):
    sessions_all = load_all_sessions(filter_cwd=target_folder)
    other_all    = load_other_tools()

    cutoff    = (date.today() - timedelta(days=days)).isoformat()
    sessions  = [s for s in sessions_all if s["date"] >= cutoff]
    other     = [e for e in other_all    if e.get("date", "") >= cutoff]

    user      = cfg.get("user", "me")
    team      = cfg.get("team", "")
    daily_bud = cfg["budgets"]["daily_user"]

    sub = f"@{user}"
    if team:
        sub += f"  ·  team: {team}"
    if target_folder:
        sub += f"  ·  {target_folder.name}"
    sub += f"  ·  last {days} days"

    print_banner("AI Spend Dashboard", sub)

    # ── 1. Daily spend ────────────────────────────────────────────────────────
    section("Daily Spend")

    daily: dict = defaultdict(lambda: {"claude": 0.0, "other": 0.0, "tools": defaultdict(float)})
    for s in sessions:
        daily[s["date"]]["claude"] += s["cost"]
    for e in other:
        d = e.get("date", "")
        t = e.get("tool", "Other")
        v = float(e.get("cost", 0))
        daily[d]["other"] += v
        daily[d]["tools"][t] += v

    sorted_days = sorted(daily.keys())
    max_day     = max((v["claude"] + v["other"] for v in daily.values()), default=0)

    if sorted_days:
        for d in sorted_days[-20:]:
            claude_c = daily[d]["claude"]
            other_c  = daily[d]["other"]
            total    = claude_c + other_c
            tools_s  = ""
            if daily[d]["tools"]:
                ts = ", ".join(f"{t}: {fmt_cost(v)}" for t, v in daily[d]["tools"].items())
                tools_s = dim(f"  [{ts}]")
            bud_s = budget_indicator(total, daily_bud)
            print(
                f"  {hi(fmt_date(d))}  {bar_chart(total, max_day)}  "
                f"{money(fmt_cost(total))}{bud_s}{tools_s}"
            )
    else:
        print(dim("  No data for this period."))

    total_c = sum(s["cost"]            for s in sessions)
    total_o = sum(float(e.get("cost", 0)) for e in other)
    grand   = total_c + total_o

    print()
    print(
        f"  {bold('Total:')}"
        f"  Claude Code {good(fmt_cost(total_c))}"
        f"  Other {warn(fmt_cost(total_o))}"
        f"  Grand {money(fmt_cost(grand))}"
    )

    # ── 2. Spend per feature / branch ─────────────────────────────────────────
    section("Spend per Feature / Branch")

    feat: dict = defaultdict(float)
    for s in sessions:
        project = Path(s["cwd"]).name if s["cwd"] else "unknown"
        branch  = s["git_branch"] or "main"
        feat[f"{project}  /  {branch}"] += s["cost"]
    for e in other:
        proj = Path(e.get("project", "")).name or e.get("tool", "Other")
        desc = e.get("description", "")
        key  = f"{proj}  /  {desc}" if desc else proj
        feat[key] += float(e.get("cost", 0))

    sorted_feat = sorted(feat.items(), key=lambda x: x[1], reverse=True)
    max_feat    = sorted_feat[0][1] if sorted_feat else 0

    if sorted_feat:
        for f_name, f_cost in sorted_feat[:15]:
            b = bar_chart(f_cost, max_feat, 20)
            print(f"  {hi(truncate(f_name, 34)):<44}  {b}  {money(fmt_cost(f_cost))}")
    else:
        print(dim("  No feature data."))

    # ── 3. Repetitive prompts ─────────────────────────────────────────────────
    section("Prompt Repetition  (potential waste)")

    clusters = find_repetitive_prompts(sessions)
    waste    = estimate_waste(clusters, sessions)

    if clusters:
        print(f"  Estimated waste from repetition: {err(bold(fmt_cost(waste)))}")
        print()
        for i, cl in enumerate(clusters[:5], 1):
            ex    = truncate(cl["example"], 70)
            count = cl["count"]
            print(f"  {bold(str(i))}.  {err(bold(f'×{count}'))}  {dim(ex)}")
    else:
        print(good("  No significant prompt repetition detected."))

    # ── 4. Cost-saving strategies ─────────────────────────────────────────────
    section("Cost-Saving Strategies")

    tips = generate_strategies(sessions, clusters, waste, cfg, target_folder)
    for i, tip in enumerate(tips, 1):
        print(f"  {bold(str(i))}.  {tip}")

    print()
    if not SPEND_LOG.exists():
        print(dim(f"  Tip: log Cursor/Lovable/ChatGPT costs → `python3 ai_spend.py --add`"))
        print(dim(f"       format: {SPEND_LOG}"))
    print()


# ── Team dashboard ────────────────────────────────────────────────────────────

def render_team_dashboard(cfg: dict, days: int):
    team_dir = cfg.get("team_dir", "")
    if not team_dir:
        print(err("\n  team_dir not configured. Run `python3 ai_spend.py --setup`\n"))
        return

    members = load_team_exports(team_dir)
    if not members:
        print(err(f"\n  No export files found in {team_dir}"))
        print(dim(f"  Team members should run: python3 ai_spend.py --export\n"))
        return

    cutoff = (date.today() - timedelta(days=days)).isoformat()
    team   = cfg.get("team", "Team")

    print_banner(f"{team} — Team Dashboard", f"last {days} days  ·  {len(members)} members")

    # Aggregate daily spend per member
    section("Daily Spend by Member")

    member_totals: dict = {}
    for m in members:
        user   = m.get("user", "?")
        total  = sum(
            v.get("total", 0)
            for d, v in m.get("daily_spend", {}).items()
            if d >= cutoff
        )
        member_totals[user] = total

    max_mem = max(member_totals.values(), default=0)
    team_total = sum(member_totals.values())
    daily_bud  = cfg["budgets"]["daily_team"]

    for user, total in sorted(member_totals.items(), key=lambda x: x[1], reverse=True):
        b = bar_chart(total, max_mem, 22)
        print(f"  {hi(truncate(user, 20)):<30}  {b}  {money(fmt_cost(total))}")

    print()
    print(f"  {bold('Team Total:')}  {money(fmt_cost(team_total))}")

    # Aggregate daily spend across team
    section("Team Daily Spend")

    team_daily: dict = defaultdict(float)
    for m in members:
        for d, v in m.get("daily_spend", {}).items():
            if d >= cutoff:
                team_daily[d] += v.get("total", 0)

    sorted_days = sorted(team_daily.keys())
    max_day = max(team_daily.values(), default=0)

    for d in sorted_days[-15:]:
        total = team_daily[d]
        bud_s = budget_indicator(total, daily_bud)
        print(f"  {hi(fmt_date(d))}  {bar_chart(total, max_day)}  {money(fmt_cost(total))}{bud_s}")

    # Top features across team
    section("Top Features Across Team")

    feat_agg: dict = defaultdict(float)
    for m in members:
        for feat, cost in m.get("feature_spend", {}).items():
            feat_agg[feat] += cost

    sorted_feats = sorted(feat_agg.items(), key=lambda x: x[1], reverse=True)[:12]
    max_feat = sorted_feats[0][1] if sorted_feats else 0

    for f_name, f_cost in sorted_feats:
        b = bar_chart(f_cost, max_feat, 20)
        print(f"  {hi(truncate(f_name, 34)):<44}  {b}  {money(fmt_cost(f_cost))}")

    print()


# ── Org dashboard ─────────────────────────────────────────────────────────────

def render_org_dashboard(cfg: dict, days: int):
    team_dir = cfg.get("team_dir", "")
    if not team_dir:
        print(err("\n  team_dir not configured. Run `python3 ai_spend.py --setup`\n"))
        return

    members = load_team_exports(team_dir)
    if not members:
        print(err(f"\n  No export files found in {team_dir}\n"))
        return

    cutoff  = (date.today() - timedelta(days=days)).isoformat()
    org     = cfg.get("org", "Org")
    mon_bud = cfg["budgets"]["monthly_org"]

    print_banner(f"{org} — Org Dashboard", f"last {days} days  ·  {len(members)} members")

    # Spend by team
    section("Spend by Team")

    team_totals: dict = defaultdict(float)
    for m in members:
        team = m.get("team", "unassigned")
        for d, v in m.get("daily_spend", {}).items():
            if d >= cutoff:
                team_totals[team] += v.get("total", 0)

    max_team = max(team_totals.values(), default=0)
    org_total = sum(team_totals.values())

    for team, total in sorted(team_totals.items(), key=lambda x: x[1], reverse=True):
        b   = bar_chart(total, max_team, 22)
        pct = f"{total/org_total*100:.0f}%" if org_total else "—"
        print(f"  {hi(truncate(team, 20)):<30}  {b}  {money(fmt_cost(total))}  {dim(pct)}")

    print()
    bud_s = budget_indicator(org_total, mon_bud)
    print(f"  {bold('Org Total:')}  {money(fmt_cost(org_total))}{bud_s}")

    # Spend by tool
    section("Spend by AI Tool")

    tool_totals: dict = defaultdict(float)
    for m in members:
        for d, v in m.get("daily_spend", {}).items():
            if d >= cutoff:
                for tool, cost in v.get("by_tool", {}).items():
                    tool_totals[tool] += cost

    max_tool = max(tool_totals.values(), default=0)
    for tool, total in sorted(tool_totals.items(), key=lambda x: x[1], reverse=True):
        b = bar_chart(total, max_tool, 22)
        print(f"  {hi(truncate(tool, 20)):<30}  {b}  {money(fmt_cost(total))}")

    # Top projects across org
    section("Top Projects Across Org")

    proj_totals: dict = defaultdict(float)
    for m in members:
        for d, v in m.get("daily_spend", {}).items():
            if d >= cutoff:
                for proj, cost in v.get("by_project", {}).items():
                    proj_totals[proj] += cost

    sorted_projs = sorted(proj_totals.items(), key=lambda x: x[1], reverse=True)[:12]
    max_proj = sorted_projs[0][1] if sorted_projs else 0
    for proj, total in sorted_projs:
        b = bar_chart(total, max_proj, 20)
        print(f"  {hi(truncate(proj, 34)):<44}  {b}  {money(fmt_cost(total))}")

    print()


# ── Interactive helpers ───────────────────────────────────────────────────────

def add_manual_entry():
    """Interactive prompt to log spend from a non-Claude tool."""
    print(bold(hi("\n  Add AI Spend Entry")))
    rule()
    tool     = input("  Tool name (e.g. Cursor, Lovable, ChatGPT): ").strip()
    cost_str = input("  Cost in USD (e.g. 5.00): ").strip()
    date_str = input(f"  Date [YYYY-MM-DD, default today {date.today()}]: ").strip() or str(date.today())
    project  = input("  Project path or name (optional): ").strip()
    desc     = input("  Description (e.g. 'auth feature'): ").strip()

    try:
        cost = float(cost_str)
    except ValueError:
        print(err("  Invalid cost amount."))
        return

    entry: dict = {"date": date_str, "tool": tool, "cost": cost}
    if project:
        entry["project"] = project
    if desc:
        entry["description"] = desc

    entries = load_other_tools()
    entries.append(entry)
    save_other_tools(entries)
    print(good(f"\n  Saved to {SPEND_LOG}\n"))


def export_data(cfg: dict):
    """Export aggregated spend data to team_dir for team/org views."""
    sessions = load_all_sessions()
    other    = load_other_tools()
    payload  = build_export_payload(cfg, sessions, other)

    team_dir = cfg.get("team_dir", "")
    if not team_dir:
        print(warn("\n  team_dir not set. Run `python3 ai_spend.py --setup` first.\n"))
        return

    td = Path(team_dir)
    td.mkdir(parents=True, exist_ok=True)

    user   = cfg.get("user", "me")
    outfile = td / f"{user}.json"
    with open(outfile, "w") as f:
        json.dump(payload, f, indent=2)

    print(good(f"\n  Exported to {outfile}"))
    print(dim(f"  Share {team_dir} with your team so they can run `--team` or `--org`.\n"))


def setup_wizard():
    """Interactive first-time setup."""
    cfg = load_config()

    print(bold(hi("\n  AI Spend Dashboard — Setup")))
    rule()
    print(dim(f"  Config will be saved to {CONFIG_FILE}\n"))

    def ask(prompt: str, default: str) -> str:
        val = input(f"  {prompt} [{default}]: ").strip()
        return val or default

    cfg["user"]     = ask("Your username", cfg.get("user", os.environ.get("USER", "me")))
    cfg["team"]     = ask("Team name (e.g. engineering)", cfg.get("team", ""))
    cfg["org"]      = ask("Org name (e.g. Acme Inc)", cfg.get("org", ""))
    cfg["team_dir"] = ask(
        "Shared directory for team exports (leave blank to skip)",
        cfg.get("team_dir", "")
    )

    print()
    print(dim("  Budgets (enter 0 to disable)"))
    for k, label in [
        ("daily_user",  "Daily budget (you)"),
        ("daily_team",  "Daily budget (team)"),
        ("monthly_user","Monthly budget (you)"),
        ("monthly_org", "Monthly budget (org)"),
    ]:
        val_str = input(f"  {label} [${cfg['budgets'][k]:.0f}]: ").strip()
        if val_str:
            try:
                cfg["budgets"][k] = float(val_str)
            except ValueError:
                pass

    save_config(cfg)
    print(good(f"\n  Config saved to {CONFIG_FILE}\n"))
    print(dim("  Next steps:"))
    print(dim("    • Run `python3 ai_spend.py` to see your dashboard"))
    if cfg.get("team_dir"):
        print(dim("    • Run `python3 ai_spend.py --export` to share with your team"))
    print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AI Spend Dashboard — track Claude Code and other AI tool costs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  python3 ai_spend.py                     personal dashboard, all projects
  python3 ai_spend.py ~/my-project        filter to one project folder
  python3 ai_spend.py --days 7            last 7 days
  python3 ai_spend.py --team              team view
  python3 ai_spend.py --org               org view
  python3 ai_spend.py --add               log a spend entry (Cursor, Lovable, etc.)
  python3 ai_spend.py --export            push your data to the team directory
  python3 ai_spend.py --setup             first-time configuration
        """,
    )
    parser.add_argument("folder",   nargs="?", type=Path, default=None,
                        help="Project folder to filter to (default: all projects)")
    parser.add_argument("--days",   type=int, default=30,
                        help="Number of days to include (default: 30)")
    parser.add_argument("--team",   action="store_true", help="Show team dashboard")
    parser.add_argument("--org",    action="store_true", help="Show org dashboard")
    parser.add_argument("--add",    action="store_true", help="Add a manual spend entry")
    parser.add_argument("--export", action="store_true", help="Export data for team sharing")
    parser.add_argument("--setup",  action="store_true", help="Run first-time setup wizard")
    args = parser.parse_args()

    cfg = load_config()

    if args.setup:
        setup_wizard()
    elif args.add:
        add_manual_entry()
    elif args.export:
        export_data(cfg)
    elif args.team:
        render_team_dashboard(cfg, args.days)
    elif args.org:
        render_org_dashboard(cfg, args.days)
    else:
        folder = args.folder.resolve() if args.folder else None
        render_user_dashboard(cfg, folder, args.days)


if __name__ == "__main__":
    main()
