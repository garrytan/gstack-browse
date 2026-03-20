---
name: gstack
version: 1.1.0
description: |
  快速無頭瀏覽器，用於 QA 測試和網站試用。可導航任何 URL、與元素互動、
  驗證頁面狀態、比較操作前後差異、拍攝帶標注的截圖、測試響應式版面、
  測試表單和上傳、處理對話框，以及斷言元素狀態。
  每個指令約 100ms。當你需要測試功能、驗證部署、試用使用者流程
  或附上證據提交 bug 時使用。

  gstack 也包含開發工作流程技能。當你注意到使用者正在這些階段時，
  建議適合的技能：
  - 腦力激盪新想法 → 建議 /office-hours
  - 審查計畫（策略）→ 建議 /plan-ceo-review
  - 審查計畫（架構）→ 建議 /plan-eng-review
  - 審查計畫（設計）→ 建議 /plan-design-review
  - 建立設計系統 → 建議 /design-consultation
  - 除錯錯誤 → 建議 /investigate
  - 測試 app → 建議 /qa
  - 合併前的程式碼審查 → 建議 /review
  - 視覺設計審查 → 建議 /design-review
  - 準備部署/建立 PR → 建議 /ship
  - 出貨後文件更新 → 建議 /document-release
  - 每週回顧 → 建議 /retro
  - 想要第二意見或對抗性程式碼審查 → 建議 /codex
  - 在正式環境或線上系統工作 → 建議 /careful
  - 想要將編輯範圍限制在一個模組/目錄 → 建議 /freeze
  - 最高安全模式（破壞性警告 + 編輯限制）→ 建議 /guard
  - 移除編輯限制 → 建議 /unfreeze
  - 升級 gstack 到最新版本 → 建議 /gstack-upgrade

  如果使用者拒絕技能建議（「stop suggesting things」、
  「I don't need suggestions」、「too aggressive」）：
  1. 在本次工作階段停止建議
  2. 執行：gstack-config set proactive false
  3. 說：「Got it — I'll stop suggesting skills. Just tell me to be proactive
     again if you change your mind.」

  如果使用者說「be proactive again」或「turn on suggestions」：
  1. 執行：gstack-config set proactive true
  2. 說：「Proactive suggestions are back on.」
allowed-tools:
  - Bash
  - Read
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
find ~/.gstack/sessions -mmin +120 -type f -delete 2>/dev/null || true
_CONTRIB=$(~/.claude/skills/gstack/bin/gstack-config get gstack_contributor 2>/dev/null || true)
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.gstack/analytics
echo '{"skill":"gstack","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
for _PF in ~/.gstack/analytics/.pending-*; do [ -f "$_PF" ] && ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

If `PROACTIVE` is `"false"`, do not proactively suggest gstack skills — only invoke
them when the user explicitly asks. The user opted out of proactive suggestions.

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

> gstack can share anonymous usage data (which skills you use, how long they take, crash info)
> to help improve the project. No code, file paths, or repo names are ever sent.
> Change anytime with `gstack-config set telemetry off`.

Options:
- A) Yes, share anonymous data (recommended)
- B) No thanks

If A: run `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous`
If B: run `~/.claude/skills/gstack/bin/gstack-config set telemetry off`

Always run:
```bash
touch ~/.gstack/.telemetry-prompted
```

This only happens once. If `TEL_PROMPTED` is `yes`, skip this entirely.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history or gitStatus), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — always prefer the complete option over shortcuts (see Completeness Principle). Include `Completeness: X/10` for each option. Calibration: 10 = complete implementation (all edge cases, full coverage), 7 = covers happy path but skips some edges, 3 = shortcut that defers significant work. If both options are 8+, pick the higher; if one is ≤5, flag it.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — when an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. When you present options:

- If Option A is the complete implementation (full parity, all edge cases, 100% coverage) and Option B is a shortcut that saves modest effort — **always recommend A**. The delta between 80 lines and 150 lines is meaningless with CC+gstack. "Good enough" is the wrong instinct when "complete" costs minutes more.
- **Lake vs. ocean:** A "lake" is boilable — 100% test coverage for a module, full feature implementation, handling all edge cases, complete error paths. An "ocean" is not — rewriting an entire system from scratch, adding features to dependencies you don't control, multi-quarter platform migrations. Recommend boiling lakes. Flag oceans as out of scope.
- **When estimating effort**, always show both scales: human team time and CC+gstack time. The compression ratio varies by task type — use this reference:

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

- This principle applies to test coverage, error handling, documentation, edge cases, and feature completeness. Don't skip the last 10% to "save time" — with AI, that 10% costs seconds.

**Anti-patterns — DON'T do this:**
- BAD: "Choose B — it covers 90% of the value with less code." (If A is only 70 lines more, choose A.)
- BAD: "We can skip edge case handling to save time." (Edge case handling costs minutes with CC.)
- BAD: "Let's defer test coverage to a follow-up PR." (Tests are the cheapest lake to boil.)
- BAD: Quoting only human-team effort: "This would take 2 weeks." (Say: "2 weeks human / ~1 hour CC.")

## Contributor Mode

If `_CONTRIB` is `true`: you are in **contributor mode**. You're a gstack user who also helps make it better.

**At the end of each major workflow step** (not after every single command), reflect on the gstack tooling you used. Rate your experience 0 to 10. If it wasn't a 10, think about why. If there is an obvious, actionable bug OR an insightful, interesting thing that could have been done better by gstack code or skill markdown — file a field report. Maybe our contributor will help make us better!

**Calibration — this is the bar:** For example, `$B js "await fetch(...)"` used to fail with `SyntaxError: await is only valid in async functions` because gstack didn't wrap expressions in async context. Small, but the input was reasonable and gstack should have handled it — that's the kind of thing worth filing. Things less consequential than this, ignore.

**NOT worth filing:** user's app bugs, network errors to user's URL, auth failures on user's site, user's own JS logic bugs.

**To file:** write `~/.gstack/contributor-logs/{slug}.md` with **all sections below** (do not truncate — include every section through the Date/Version footer):

```
# {Title}

Hey gstack team — ran into this while using /{skill-name}:

**What I was trying to do:** {what the user/agent was attempting}
**What happened instead:** {what actually happened}
**My rating:** {0-10} — {one sentence on why it wasn't a 10}

## Steps to reproduce
1. {step}

## Raw output
```
{paste the actual error or unexpected output here}
```

## What would make this a 10
{one sentence: what gstack should have done differently}

**Date:** {YYYY-MM-DD} | **Version:** {gstack version} | **Skill:** /{skill}
```

Slug: lowercase, hyphens, max 60 chars (e.g. `browse-js-no-await`). Skip if file already exists. Max 3 reports per session. File inline and continue — don't stop the workflow. Tell user: "Filed gstack field report: {title}"

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

## Telemetry (run last)

After the skill workflow completes (success, error, or abort), log the telemetry event.
Determine the skill name from the `name:` field in this file's YAML frontmatter.
Determine the outcome from the workflow result (success if completed normally, error
if it failed, abort if the user interrupted). Run this bash:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-telemetry-log \
  --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
  --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
```

Replace `SKILL_NAME` with the actual skill name from frontmatter, `OUTCOME` with
success/error/abort, and `USED_BROWSE` with true/false based on whether `$B` was used.
If you cannot determine the outcome, use "unknown". This runs in the background and
never blocks the user.

如果 `PROACTIVE` 是 `false`：在本次工作階段中不要主動建議其他 gstack 技能。
只執行使用者明確呼叫的技能。此偏好透過 `gstack-config` 跨工作階段持續。

# gstack browse：QA 測試與網站試用

持久無頭 Chromium。第一次呼叫自動啟動（約 3 秒），之後每個指令約 100-200ms。
閒置 30 分鐘後自動關閉。呼叫之間狀態持續（Cookie、分頁、工作階段）。

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "gstack browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd <SKILL_DIR> && ./setup`
3. If `bun` is not installed: `curl -fsSL https://bun.sh/install | bash`

## 重要事項

- 透過 Bash 使用編譯後的二進位檔：`$B <command>`
- **絕對不要**使用 `mcp__claude-in-chrome__*` 工具。它們緩慢且不可靠。
- 瀏覽器在呼叫之間持續——Cookie、登入工作階段和分頁都會延續。
- 對話框（alert/confirm/prompt）預設自動接受——不會發生瀏覽器鎖定。
- **顯示截圖：** 執行 `$B screenshot`、`$B snapshot -a -o` 或 `$B responsive` 後，
  務必對輸出的 PNG 使用 Read 工具，讓使用者能看到截圖。沒有這步驟，截圖是看不見的。

## QA 工作流程

### 測試使用者流程（登入、註冊、結帳等）

```bash
# 1. 前往頁面
$B goto https://app.example.com/login

# 2. 查看有什麼可互動的
$B snapshot -i

# 3. 使用參考填寫表單
$B fill @e3 "test@example.com"
$B fill @e4 "password123"
$B click @e5

# 4. 驗證是否成功
$B snapshot -D              # diff 顯示點擊後的變化
$B is visible ".dashboard"  # 斷言儀表板出現了
$B screenshot /tmp/after-login.png
```

### 驗證部署/檢查正式環境

```bash
$B goto https://yourapp.com
$B text                          # 讀取頁面——它有載入嗎？
$B console                       # 有 JS 錯誤嗎？
$B network                       # 有失敗的請求嗎？
$B js "document.title"           # 標題正確嗎？
$B is visible ".hero-section"    # 關鍵元素存在嗎？
$B screenshot /tmp/prod-check.png
```

### 端到端試用功能

```bash
# 導航到功能
$B goto https://app.example.com/new-feature

# 拍攝帶標注的截圖——顯示每個帶標籤的互動元素
$B snapshot -i -a -o /tmp/feature-annotated.png

# 找出所有可點擊的東西（包括帶 cursor:pointer 的 div）
$B snapshot -C

# 逐步執行流程
$B snapshot -i          # 基準線
$B click @e3            # 互動
$B snapshot -D          # 發生了什麼變化？（統一差異）

# 檢查元素狀態
$B is visible ".success-toast"
$B is enabled "#next-step-btn"
$B is checked "#agree-checkbox"

# 互動後檢查主控台是否有錯誤
$B console
```

### 測試響應式版面

```bash
# 快速：在手機/平板/桌機三種尺寸截圖
$B goto https://yourapp.com
$B responsive /tmp/layout

# 手動：特定視窗尺寸
$B viewport 375x812     # iPhone
$B screenshot /tmp/mobile.png
$B viewport 1440x900    # 桌機
$B screenshot /tmp/desktop.png

# 元素截圖（裁切到特定元素）
$B screenshot "#hero-banner" /tmp/hero.png
$B snapshot -i
$B screenshot @e3 /tmp/button.png

# 區域裁切
$B screenshot --clip 0,0,800,600 /tmp/above-fold.png

# 僅視窗（不捲動）
$B screenshot --viewport /tmp/viewport.png
```

### 測試檔案上傳

```bash
$B goto https://app.example.com/upload
$B snapshot -i
$B upload @e3 /path/to/test-file.pdf
$B is visible ".upload-success"
$B screenshot /tmp/upload-result.png
```

### 測試帶驗證的表單

```bash
$B goto https://app.example.com/form
$B snapshot -i

# 空白提交——檢查驗證錯誤是否出現
$B click @e10                        # 提交按鈕
$B snapshot -D                       # diff 顯示錯誤訊息出現了
$B is visible ".error-message"

# 填寫並重新提交
$B fill @e3 "valid input"
$B click @e10
$B snapshot -D                       # diff 顯示錯誤消失了，成功狀態
```

### 測試對話框（刪除確認、提示）

```bash
# 在觸發之前設定對話框處理
$B dialog-accept              # 將自動接受下一個 alert/confirm
$B click "#delete-button"     # 觸發確認對話框
$B dialog                     # 查看出現了什麼對話框
$B snapshot -D                # 驗證項目已刪除

# 對需要輸入的 prompt
$B dialog-accept "my answer"  # 帶文字接受
$B click "#rename-button"     # 觸發 prompt
```

### 測試已驗證的頁面（匯入真實瀏覽器 Cookie）

```bash
# 從你的真實瀏覽器匯入 Cookie（開啟互動式選擇器）
$B cookie-import-browser

# 或直接匯入特定域名
$B cookie-import-browser comet --domain .github.com

# 現在測試已驗證的頁面
$B goto https://github.com/settings/profile
$B snapshot -i
$B screenshot /tmp/github-profile.png
```

### 比較兩個頁面/環境

```bash
$B diff https://staging.app.com https://prod.app.com
```

### 多步驟鏈（適用於長流程的高效方式）

```bash
echo '[
  ["goto","https://app.example.com"],
  ["snapshot","-i"],
  ["fill","@e3","test@test.com"],
  ["fill","@e4","password"],
  ["click","@e5"],
  ["snapshot","-D"],
  ["screenshot","/tmp/result.png"]
]' | $B chain
```

## 快速斷言模式

```bash
# 元素存在且可見
$B is visible ".modal"

# 按鈕已啟用/已停用
$B is enabled "#submit-btn"
$B is disabled "#submit-btn"

# 核取方塊狀態
$B is checked "#agree"

# 輸入框可編輯
$B is editable "#name-field"

# 元素已聚焦
$B is focused "#search-input"

# 頁面包含文字
$B js "document.body.textContent.includes('Success')"

# 元素計數
$B js "document.querySelectorAll('.list-item').length"

# 特定屬性值
$B attrs "#logo"    # 以 JSON 返回所有屬性

# CSS 屬性
$B css ".button" "background-color"
```

## 快照系統

The snapshot is your primary tool for understanding and interacting with pages.

```
-i        --interactive           Interactive elements only (buttons, links, inputs) with @e refs
-c        --compact               Compact (no empty structural nodes)
-d <N>    --depth                 Limit tree depth (0 = root only, default: unlimited)
-s <sel>  --selector              Scope to CSS selector
-D        --diff                  Unified diff against previous snapshot (first call stores baseline)
-a        --annotate              Annotated screenshot with red overlay boxes and ref labels
-o <path> --output                Output path for annotated screenshot (default: /tmp/browse-annotated.png)
-C        --cursor-interactive    Cursor-interactive elements (@c refs — divs with pointer, onclick)
```

All flags can be combined freely. `-o` only applies when `-a` is also used.
Example: `$B snapshot -i -a -C -o /tmp/annotated.png`

**Ref numbering:** @e refs are assigned sequentially (@e1, @e2, ...) in tree order.
@c refs from `-C` are numbered separately (@c1, @c2, ...).

After snapshot, use @refs as selectors in any command:
```bash
$B click @e3       $B fill @e4 "value"     $B hover @e1
$B html @e2        $B css @e5 "color"      $B attrs @e6
$B click @c1       # cursor-interactive ref (from -C)
```

**Output format:** indented accessibility tree with @ref IDs, one element per line.
```
  @e1 [heading] "Welcome" [level=1]
  @e2 [textbox] "Email"
  @e3 [button] "Submit"
```

Refs are invalidated on navigation — run `snapshot` again after `goto`.

## 指令參考

### Navigation
| Command | Description |
|---------|-------------|
| `back` | History back |
| `forward` | History forward |
| `goto <url>` | Navigate to URL |
| `reload` | Reload page |
| `url` | Print current URL |

### Reading
| Command | Description |
|---------|-------------|
| `accessibility` | Full ARIA tree |
| `forms` | Form fields as JSON |
| `html [selector]` | innerHTML of selector (throws if not found), or full page HTML if no selector given |
| `links` | All links as "text → href" |
| `text` | Cleaned page text |

### Interaction
| Command | Description |
|---------|-------------|
| `click <sel>` | Click element |
| `cookie <name>=<value>` | Set cookie on current page domain |
| `cookie-import <json>` | Import cookies from JSON file |
| `cookie-import-browser [browser] [--domain d]` | Import cookies from Comet, Chrome, Arc, Brave, or Edge (opens picker, or use --domain for direct import) |
| `dialog-accept [text]` | Auto-accept next alert/confirm/prompt. Optional text is sent as the prompt response |
| `dialog-dismiss` | Auto-dismiss next dialog |
| `fill <sel> <val>` | Fill input |
| `header <name>:<value>` | Set custom request header (colon-separated, sensitive values auto-redacted) |
| `hover <sel>` | Hover element |
| `press <key>` | Press key — Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown, or modifiers like Shift+Enter |
| `scroll [sel]` | Scroll element into view, or scroll to page bottom if no selector |
| `select <sel> <val>` | Select dropdown option by value, label, or visible text |
| `type <text>` | Type into focused element |
| `upload <sel> <file> [file2...]` | Upload file(s) |
| `useragent <string>` | Set user agent |
| `viewport <WxH>` | Set viewport size |
| `wait <sel|--networkidle|--load>` | Wait for element, network idle, or page load (timeout: 15s) |

### Inspection
| Command | Description |
|---------|-------------|
| `attrs <sel|@ref>` | Element attributes as JSON |
| `console [--clear|--errors]` | Console messages (--errors filters to error/warning) |
| `cookies` | All cookies as JSON |
| `css <sel> <prop>` | Computed CSS value |
| `dialog [--clear]` | Dialog messages |
| `eval <file>` | Run JavaScript from file and return result as string (path must be under /tmp or cwd) |
| `is <prop> <sel>` | State check (visible/hidden/enabled/disabled/checked/editable/focused) |
| `js <expr>` | Run JavaScript expression and return result as string |
| `network [--clear]` | Network requests |
| `perf` | Page load timings |
| `storage [set k v]` | Read all localStorage + sessionStorage as JSON, or set <key> <value> to write localStorage |

### Visual
| Command | Description |
|---------|-------------|
| `diff <url1> <url2>` | Text diff between pages |
| `pdf [path]` | Save as PDF |
| `responsive [prefix]` | Screenshots at mobile (375x812), tablet (768x1024), desktop (1280x720). Saves as {prefix}-mobile.png etc. |
| `screenshot [--viewport] [--clip x,y,w,h] [selector|@ref] [path]` | Save screenshot (supports element crop via CSS/@ref, --clip region, --viewport) |

### Snapshot
| Command | Description |
|---------|-------------|
| `snapshot [flags]` | Accessibility tree with @e refs for element selection. Flags: -i interactive only, -c compact, -d N depth limit, -s sel scope, -D diff vs previous, -a annotated screenshot, -o path output, -C cursor-interactive @c refs |

### Meta
| Command | Description |
|---------|-------------|
| `chain` | Run commands from JSON stdin. Format: [["cmd","arg1",...],...] |

### Tabs
| Command | Description |
|---------|-------------|
| `closetab [id]` | Close tab |
| `newtab [url]` | Open new tab |
| `tab <id>` | Switch to tab |
| `tabs` | List open tabs |

### Server
| Command | Description |
|---------|-------------|
| `handoff [message]` | Open visible Chrome at current page for user takeover |
| `restart` | Restart server |
| `resume` | Re-snapshot after user takeover, return control to AI |
| `status` | Health check |
| `stop` | Shutdown server |

## 技巧

1. **導航一次，查詢多次。** `goto` 載入頁面；之後 `text`、`js`、`screenshot` 都立即命中已載入的頁面。
2. **先用 `snapshot -i`。** 查看所有互動元素，然後透過參考點擊/填寫。不需要猜測 CSS 選擇器。
3. **用 `snapshot -D` 驗證。** 基準線 → 操作 → 差異。精確看到發生了什麼變化。
4. **用 `is` 進行斷言。** `is visible .modal` 比解析頁面文字更快、更可靠。
5. **用 `snapshot -a` 作為證據。** 帶標注的截圖非常適合 bug 報告。
6. **對棘手的 UI 使用 `snapshot -C`。** 找到無障礙樹遺漏的可點擊 div。
7. **操作後檢查 `console`。** 捕捉視覺上看不出來的 JS 錯誤。
8. **對長流程使用 `chain`。** 單一指令，沒有每步驟的 CLI 開銷。
