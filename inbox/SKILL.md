---
name: inbox
preamble-tier: 1
version: 1.0.0
description: |
  Cross-session messaging for Claude Code. Send messages between concurrent
  sessions, claim work items to prevent double-booking, check who's working
  on what. File-based — no server needed. Sessions see new messages inline
  via a lightweight PreToolUse hook.
  Use when asked to "send a message", "check inbox", "claim this task",
  "who's working on what", "notify when done", or "message other sessions".
  Proactively suggest when multiple sessions are active in the same project
  and coordination is needed. (gstack)
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.gstack/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(~/.claude/skills/gstack/bin/gstack-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.gstack/analytics
if [ "$_TEL" != "off" ]; then
echo '{"skill":"inbox","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  if [ -f "$_PF" ]; then
    if [ "$_TEL" != "off" ] && [ -x "~/.claude/skills/gstack/bin/gstack-telemetry-log" ]; then
      ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
    fi
    rm -f "$_PF" 2>/dev/null || true
  fi
  break
done
# Learnings count
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
_LEARN_FILE="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}/learnings.jsonl"
if [ -f "$_LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$_LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries loaded"
  if [ "$_LEARN_COUNT" -gt 5 ] 2>/dev/null; then
    ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 3 2>/dev/null || true
  fi
else
  echo "LEARNINGS: 0"
fi
# Session timeline: record skill start (local-only, never sent anywhere)
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"inbox","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
# Check if CLAUDE.md has routing rules
_HAS_ROUTING="no"
if [ -f CLAUDE.md ] && grep -q "## Skill routing" CLAUDE.md 2>/dev/null; then
  _HAS_ROUTING="yes"
fi
_ROUTING_DECLINED=$(~/.claude/skills/gstack/bin/gstack-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
```

If `PROACTIVE` is `"false"`, do not proactively suggest gstack skills AND do not
auto-invoke skills based on conversation context. Only run skills the user explicitly
types (e.g., /qa, /ship). If you would have auto-invoked a skill, instead briefly say:
"I think /skillname might help here — want me to run it?" and wait for confirmation.
The user opted out of proactive behavior.

If `SKILL_PREFIX` is `"true"`, the user has namespaced skill names. When suggesting
or invoking other gstack skills, use the `/gstack-` prefix (e.g., `/gstack-qa` instead
of `/qa`, `/gstack-ship` instead of `/ship`). Disk paths are unaffected — always use
`~/.claude/skills/gstack/[skill-name]/SKILL.md` for reading skill files.

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "gstack follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: After the lake intro is handled,
ask the user about telemetry. Use AskUserQuestion:

> Help gstack get better! Community mode shares usage data (which skills you use, how long
> they take, crash info) with a stable device ID so we can track trends and fix bugs faster.
> No code, file paths, or repo names are ever sent.
> Change anytime with `gstack-config set telemetry off`.

Options:
- A) Help gstack get better! (recommended)
- B) No thanks

If A: run `~/.claude/skills/gstack/bin/gstack-config set telemetry community`

If B: ask a follow-up AskUserQuestion:

> How about anonymous mode? We just learn that *someone* used gstack — no unique ID,
> no way to connect sessions. Just a counter that helps us know if anyone's out there.

Options:
- A) Sure, anonymous is fine
- B) No thanks, fully off

If B→A: run `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous`
If B→B: run `~/.claude/skills/gstack/bin/gstack-config set telemetry off`

Always run:
```bash
touch ~/.gstack/.telemetry-prompted
```

This only happens once. If `TEL_PROMPTED` is `yes`, skip this entirely.

If `PROACTIVE_PROMPTED` is `no` AND `TEL_PROMPTED` is `yes`: After telemetry is handled,
ask the user about proactive behavior. Use AskUserQuestion:

> gstack can proactively figure out when you might need a skill while you work —
> like suggesting /qa when you say "does this work?" or /investigate when you hit
> a bug. We recommend keeping this on — it speeds up every part of your workflow.

Options:
- A) Keep it on (recommended)
- B) Turn it off — I'll type /commands myself

If A: run `~/.claude/skills/gstack/bin/gstack-config set proactive true`
If B: run `~/.claude/skills/gstack/bin/gstack-config set proactive false`

Always run:
```bash
touch ~/.gstack/.proactive-prompted
```

This only happens once. If `PROACTIVE_PROMPTED` is `yes`, skip this entirely.

If `HAS_ROUTING` is `no` AND `ROUTING_DECLINED` is `false` AND `PROACTIVE_PROMPTED` is `yes`:
Check if a CLAUDE.md file exists in the project root. If it does not exist, create it.

Use AskUserQuestion:

> gstack works best when your project's CLAUDE.md includes skill routing rules.
> This tells Claude to use specialized workflows (like /ship, /investigate, /qa)
> instead of answering directly. It's a one-time addition, about 15 lines.

Options:
- A) Add routing rules to CLAUDE.md (recommended)
- B) No thanks, I'll invoke skills manually

If A: Append this section to the end of CLAUDE.md:

```markdown

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
```

Then commit the change: `git add CLAUDE.md && git commit -m "chore: add gstack skill routing rules to CLAUDE.md"`

If B: run `~/.claude/skills/gstack/bin/gstack-config set routing_declined true`
Say "No problem. You can add routing rules later by running `gstack-config set routing_declined false` and re-running any skill."

This only happens once per project. If `HAS_ROUTING` is `yes` or `ROUTING_DECLINED` is `true`, skip this entirely.

## Voice

**Tone:** direct, concrete, sharp, never corporate, never academic. Sound like a builder, not a consultant. Name the file, the function, the command. No filler, no throat-clearing.

**Writing rules:** No em dashes (use commas, periods, "..."). No AI vocabulary (delve, crucial, robust, comprehensive, nuanced, etc.). Short paragraphs. End with what to do.

The user always has context you don't. Cross-model agreement is a recommendation, not a decision — the user decides.

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — All steps completed successfully. Evidence provided for each claim.
- **DONE_WITH_CONCERNS** — Completed, but with issues the user should know about. List each concern.
- **BLOCKED** — Cannot proceed. State what is blocking and what was tried.
- **NEEDS_CONTEXT** — Missing information required to continue. State exactly what you need.

### Escalation

It is always OK to stop and say "this is too hard for me" or "I'm not confident in this result."

Bad work is worse than no work. You will not be penalized for escalating.
- If you have attempted a task 3 times without success, STOP and escalate.
- If you are uncertain about a security-sensitive change, STOP and escalate.
- If the scope of work exceeds what you can verify, STOP and escalate.

Escalation format:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Operational Self-Improvement

Before completing, reflect on this session:
- Did any commands fail unexpectedly?
- Did you take a wrong approach and have to backtrack?
- Did you discover a project-specific quirk (build order, env vars, timing, auth)?
- Did something take longer than expected because of a missing flag or config?

If yes, log an operational learning for future sessions:

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"SKILL_NAME","type":"operational","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"observed"}'
```

Replace SKILL_NAME with the current skill name. Only log genuine operational discoveries.
Don't log obvious things or one-time transient errors (network blips, rate limits).
A good test: would knowing this save 5+ minutes in a future session? If yes, log it.

## Telemetry (run last)

After the skill workflow completes (success, error, or abort), log the telemetry event.
Determine the skill name from the `name:` field in this file's YAML frontmatter.
Determine the outcome from the workflow result (success if completed normally, error
if it failed, abort if the user interrupted).

**PLAN MODE EXCEPTION — ALWAYS RUN:** This command writes telemetry to
`~/.gstack/analytics/` (user config directory, not project files). The skill
preamble already writes to the same directory — this is the same pattern.
Skipping this command loses session duration and outcome data.

Run this bash:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
# Session timeline: record skill completion (local-only, never sent anywhere)
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"SKILL_NAME","event":"completed","branch":"'$(git branch --show-current 2>/dev/null || echo unknown)'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
# Local analytics (gated on telemetry setting)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"SKILL_NAME","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","browse":"USED_BROWSE","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# Remote telemetry (opt-in, requires binary)
if [ "$_TEL" != "off" ] && [ -x ~/.claude/skills/gstack/bin/gstack-telemetry-log ]; then
  ~/.claude/skills/gstack/bin/gstack-telemetry-log \
    --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
    --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
fi
```

Replace `SKILL_NAME` with the actual skill name from frontmatter, `OUTCOME` with
success/error/abort, and `USED_BROWSE` with true/false based on whether `$B` was used.
If you cannot determine the outcome, use "unknown". The local JSONL always logs. The
remote binary only runs if telemetry is not off and the binary exists.

## Plan Mode Safe Operations

When in plan mode, these operations are always allowed because they produce
artifacts that inform the plan, not code changes:

- `$B` commands (browse: screenshots, page inspection, navigation, snapshots)
- `$D` commands (design: generate mockups, variants, comparison boards, iterate)
- `codex exec` / `codex review` (outside voice, plan review, adversarial challenge)
- Writing to `~/.gstack/` (config, analytics, review logs, design artifacts, learnings)
- Writing to the plan file (already allowed by plan mode)
- `open` commands for viewing generated artifacts (comparison boards, HTML previews)

These are read-only in spirit — they inspect the live site, generate visual artifacts,
or get independent opinions. They do NOT modify project source files.

## Plan Status Footer

When you are in plan mode and about to call ExitPlanMode:

1. Check if the plan file already has a `## GSTACK REVIEW REPORT` section.
2. If it DOES — skip (a review skill already wrote a richer report).
3. If it does NOT — run this command:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

Then write a `## GSTACK REVIEW REPORT` section to the end of the plan file:

- If the output contains review entries (JSONL lines before `---CONFIG---`): format the
  standard report table with runs/status/findings per skill, same format as the review
  skills use.
- If the output is `NO_REVIEWS` or empty: write this placeholder table:

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | 0 | — | — |
| Codex Review | \`/codex review\` | Independent 2nd opinion | 0 | — | — |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | 0 | — | — |
| Design Review | \`/plan-design-review\` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run \`/autoplan\` for full review pipeline, or individual reviews above.
\`\`\`

**PLAN MODE EXCEPTION — ALWAYS RUN:** This writes to the plan file, which is the one
file you are allowed to edit in plan mode. The plan file review report is part of the
plan's living status.

# /inbox: Cross-Session Messaging

Send and receive messages between concurrent Claude Code sessions. File-based,
zero infrastructure, real-time-ish delivery via PreToolUse hook.

---

## Step 0: Ensure hook is installed

```bash
# Check if the inbox hook is installed in settings.json
INSTALLER="$HOME/.claude/skills/gstack/inbox/bin/inbox-install"
if [ -x "$INSTALLER" ]; then
  "$INSTALLER" --check 2>/dev/null
  HOOK_STATUS=$?
else
  HOOK_STATUS=1
fi
echo "HOOK_STATUS: $HOOK_STATUS"
```

If `HOOK_STATUS` is 1 (not installed), install it:

```bash
"$HOME/.claude/skills/gstack/inbox/bin/inbox-install"
```

Tell the user: "Installed inbox hook — other sessions will see your messages
on their next tool call. Note: existing sessions need to be restarted to pick
up the new hook from settings.json."

---

## Step 1: Ensure inbox exists

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
mkdir -p "$INBOX/messages" "$INBOX/claims"
echo "INBOX: $INBOX"
```

---

## Step 2: Parse the user's intent

The user may want to:

| Intent | Examples |
|--------|----------|
| **send** | "tell the other sessions...", "message: X is done", "notify that..." |
| **read** | "check inbox", "any messages?", "what's new?" |
| **claim** | "I'm working on X", "claim the auth task", "lock this" |
| **release** | "done with X", "release the claim", "unclaim" |
| **status** | "who's working on what?", "show active sessions", "status" |
| **clear** | "clear inbox", "dismiss messages", "mark all read" |
| **setup** | "set up inbox", "initialize" (already done in Step 1) |

---

## Command: send

Write a message file to the inbox. Include sender identity and timestamp.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
TIMESTAMP=$(date +%s)
DATE_HUMAN=$(date "+%Y-%m-%d %H:%M")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
SESSION_ID="$$"

# Identify this session by what it's working on
SENDER="session-$SESSION_ID ($BRANCH)"
```

Create the message file:

```bash
cat > "$INBOX/messages/${TIMESTAMP}-${SESSION_ID}.md" << 'MSGEOF'
<sender-name>
<date>
<message-body>
MSGEOF
```

Replace `<sender-name>`, `<date>`, and `<message-body>` with actual values.
The first line is the sender, second line is the date, third line onward is
the message body.

**Message format examples:**

For a completion notification:
```
session-12345 (feat/beat-rewrites)
2026-04-02 15:30
Beat outline rewrites complete for Honey Falls Ch 1-6.
Book-system is now unblocked for prose generation.
Rewritten files: outlining-system/output/honey-falls/ch1-beat.md through ch6-beat.md
```

For a question:
```
session-12345 (main)
2026-04-02 15:30
Question: Should we use the v2 or v3 API for the payment integration?
Need a decision before I can proceed with the checkout flow.
```

For a handoff:
```
session-12345 (feat/auth)
2026-04-02 15:30
HANDOFF: Auth middleware is done and tested.
Next step: integrate with the /api/users endpoint.
See: src/middleware/auth.ts (new), test/auth.test.ts (new)
```

After writing, tell the user: "Message sent. Other sessions will see it on
their next tool call."

---

## Command: read

Read all messages, newest first. Show full content.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
echo "=== Inbox: $INBOX ==="
echo ""
for msg in $(ls -t "$INBOX/messages"/*.md 2>/dev/null); do
  echo "--- $(basename "$msg") ---"
  cat "$msg"
  echo ""
done
if [ -z "$(ls "$INBOX/messages"/*.md 2>/dev/null)" ]; then
  echo "(empty — no messages)"
fi
```

After reading, update the read marker:

```bash
touch "$INBOX/.last-read-$$" 2>/dev/null || true
```

Present messages in a clean format. If there are action items or questions,
highlight them and ask the user how to proceed.

---

## Command: claim

Claim a work item so other sessions know you're on it. Creates a lock file.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
SESSION_ID="$$"
CLAIM_NAME="<task-slug>"

# Check if already claimed
if [ -f "$INBOX/claims/${CLAIM_NAME}.lock" ]; then
  echo "ALREADY_CLAIMED"
  cat "$INBOX/claims/${CLAIM_NAME}.lock"
else
  cat > "$INBOX/claims/${CLAIM_NAME}.lock" << EOF
session-$SESSION_ID ($BRANCH)
$(date "+%Y-%m-%d %H:%M")
EOF
  echo "CLAIMED: $CLAIM_NAME"
fi
```

Replace `<task-slug>` with a kebab-case version of the task name
(e.g., "beat-rewrite-honey-falls", "payment-integration", "auth-middleware").

If already claimed by another session, tell the user who has it and when
they claimed it. Ask if they want to override (force-claim).

---

## Command: release

Release a claim when done with a work item.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
CLAIM_NAME="<task-slug>"
rm -f "$INBOX/claims/${CLAIM_NAME}.lock"
echo "Released: $CLAIM_NAME"
```

Optionally send a completion message at the same time (combine with send).

---

## Command: status

Show all active sessions and their claims.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"

echo "=== Active Claims ==="
for claim in "$INBOX/claims"/*.lock 2>/dev/null; do
  [ -f "$claim" ] || continue
  NAME=$(basename "$claim" .lock)
  OWNER=$(head -1 "$claim")
  WHEN=$(sed -n '2p' "$claim")
  echo "  $NAME — $OWNER (since $WHEN)"
done
if [ -z "$(ls "$INBOX/claims"/*.lock 2>/dev/null)" ]; then
  echo "  (no active claims)"
fi

echo ""
echo "=== Active Sessions (last 2h) ==="
find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | while read f; do
  echo "  PID: $(basename "$f")"
done
SESSION_COUNT=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  Total: $SESSION_COUNT active session(s)"

echo ""
echo "=== Pending Messages ==="
MSG_COUNT=$(find "$INBOX/messages" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  $MSG_COUNT message(s) in inbox"
```

Present this as a clean dashboard.

---

## Command: clear

Clear all read messages (keep unread ones).

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/.gstack/inbox"
# Remove all messages (they've been seen via the hook)
COUNT=$(find "$INBOX/messages" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
find "$INBOX/messages" -name "*.md" -type f -exec rm {} + 2>/dev/null
echo "Cleared $COUNT message(s)"
```

---

## Proactive behavior

When you notice coordination opportunities, suggest using inbox:

1. **Multiple sessions detected:** If the preamble shows multiple active
   sessions and the user is about to start work that could conflict, suggest
   claiming it first.

2. **Completing a task with dependents:** If the user finishes work that
   other sessions might be waiting on, suggest sending a notification.

3. **Before starting work:** Check claims to make sure no one else is on it.

---

## Message file format

Messages are plain markdown files in `.gstack/inbox/messages/`:

```
.gstack/inbox/
├── messages/
│   ├── 1712084400-12345.md    # timestamp-sessionPID.md
│   └── 1712084500-67890.md
├── claims/
│   ├── beat-rewrite-honey-falls.lock
│   └── payment-integration.lock
├── .last-read-12345           # per-session read marker
├── .last-read-67890
└── .seen-12345                # per-session hook check marker
```

**Message file format** (3+ lines):
```
Line 1: sender identity (session ID + branch)
Line 2: human-readable date
Line 3+: message body (free-form markdown)
```

**Claim file format** (2 lines):
```
Line 1: owner identity
Line 2: claim timestamp
```

Keep `.gstack/inbox/` in `.gitignore` — these are ephemeral coordination
files, not project state.
