# Installing gstack Skills for OpenClaw

## Quick Install

Copy the skill directories to your OpenClaw workspace:

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/dddabtc/gstack.git
cd gstack

# Copy all OpenClaw skills to your workspace
cp -r openclaw/skills/* ~/.openclaw/workspace/skills/
```

## What Gets Installed

| Skill | Command | Description |
|-------|---------|-------------|
| plan-ceo-review | /plan-ceo-review | Founder/CEO product thinking — rethink the problem, find the 10-star product |
| plan-eng-review | /plan-eng-review | Engineering architecture review — lock in the execution plan |
| review | /review | Paranoid pre-landing code review for structural issues tests don't catch |
| ship | /ship | One-command shipping: sync, test, review, bump, commit, push, PR |
| browse | /browse | Browser automation for QA testing and site dogfooding |
| qa | /qa | Full QA with bug fixing — test, find bugs, fix them, re-verify |
| qa-only | /qa-only | Report-only QA — find and document bugs without fixing |
| setup-browser-cookies | /setup-browser-cookies | Import browser cookies for testing authenticated pages |
| retro | /retro | Weekly engineering retrospective with trend tracking |
| document-release | /document-release | Post-ship documentation update |

## Requirements

- [OpenClaw](https://github.com/nichochar/openclaw) installed and running
- `gh` CLI installed and authenticated (for /ship, /review, /retro)
- A git repository to work in (most skills are git-aware)

## Key Differences from Claude Code Version

The OpenClaw versions use OpenClaw's native tools instead of Claude Code's:

| Claude Code | OpenClaw |
|-------------|----------|
| Bash tool | `exec` tool |
| `$B goto/click/snapshot` (compiled browse binary) | `browser` tool (navigate, snapshot, act, screenshot) |
| AskUserQuestion | Direct conversation with user |
| Read/Write/Edit tools | `read`/`write`/`edit` tools |
| Grep/Glob tools | `exec` with grep/find |

### Browser Automation

The biggest change is browser automation. The original gstack uses a compiled Playwright binary
(`$B` commands). OpenClaw has a built-in browser tool that provides equivalent functionality:

| gstack `$B` command | OpenClaw equivalent |
|---------------------|---------------------|
| `$B goto <url>` | `browser(action: "navigate", url: "<url>")` |
| `$B snapshot -i` | `browser(action: "snapshot", refs: "aria")` |
| `$B click @e3` | `browser(action: "act", kind: "click", ref: "e3")` |
| `$B fill @e3 "value"` | `browser(action: "act", kind: "fill", ref: "e3", text: "value")` |
| `$B screenshot /tmp/shot.png` | `browser(action: "screenshot")` |
| `$B console --errors` | `browser(action: "console")` |
| `$B viewport 375x812` | `browser(action: "act", kind: "resize", width: 375, height: 812)` |
| `$B js "expr"` | `browser(action: "act", kind: "evaluate", fn: "expr")` |

## Selective Install

Install only the skills you need:

```bash
# Just the review + ship workflow
cp -r openclaw/skills/review ~/.openclaw/workspace/skills/
cp -r openclaw/skills/ship ~/.openclaw/workspace/skills/

# Just QA
cp -r openclaw/skills/qa ~/.openclaw/workspace/skills/
cp -r openclaw/skills/qa-only ~/.openclaw/workspace/skills/
cp -r openclaw/skills/browse ~/.openclaw/workspace/skills/

# Just planning
cp -r openclaw/skills/plan-ceo-review ~/.openclaw/workspace/skills/
cp -r openclaw/skills/plan-eng-review ~/.openclaw/workspace/skills/
```

## Uninstall

```bash
# Remove all gstack skills
for skill in plan-ceo-review plan-eng-review review ship browse qa qa-only setup-browser-cookies retro document-release; do
  rm -rf ~/.openclaw/workspace/skills/$skill
done
```
