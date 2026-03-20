# 架構

本文件說明 gstack 為何以現有方式建置。關於設定和指令，請參閱 CLAUDE.md。關於貢獻，請參閱 CONTRIBUTING.md。

## 核心理念

gstack 給予 Claude Code 一個持久的瀏覽器和一組固執己見的工作流程技能。瀏覽器是困難的部分——其他一切都是 Markdown。

關鍵洞察：AI 代理人與瀏覽器互動需要**低於一秒的延遲**和**持久狀態**。如果每個指令都要冷啟動瀏覽器，你每次工具呼叫要等待 3-5 秒。如果瀏覽器在指令之間死掉，你就失去了 Cookie、分頁和登入工作階段。因此 gstack 執行一個長壽的 Chromium 守護程序，CLI 透過本地端的 HTTP 與之通訊。

```
Claude Code                     gstack
─────────                      ──────
                               ┌──────────────────────┐
  Tool call: $B snapshot -i    │  CLI (compiled binary)│
  ─────────────────────────→   │  • reads state file   │
                               │  • POST /command      │
                               │    to localhost:PORT   │
                               └──────────┬───────────┘
                                          │ HTTP
                               ┌──────────▼───────────┐
                               │  Server (Bun.serve)   │
                               │  • dispatches command  │
                               │  • talks to Chromium   │
                               │  • returns plain text  │
                               └──────────┬───────────┘
                                          │ CDP
                               ┌──────────▼───────────┐
                               │  Chromium (headless)   │
                               │  • persistent tabs     │
                               │  • cookies carry over  │
                               │  • 30min idle timeout  │
                               └───────────────────────┘
```

第一次呼叫啟動所有東西（約 3 秒）。之後的每次呼叫：約 100-200ms。

## 為什麼選擇 Bun

Node.js 可以運作。但 Bun 在這裡有三個優勢：

1. **編譯二進位檔。** `bun build --compile` 產生一個約 58MB 的執行檔。執行時不需要 `node_modules`、不需要 `npx`、不需要 PATH 設定。二進位檔直接執行。這很重要，因為 gstack 安裝到 `~/.claude/skills/` 中，使用者不希望在那裡管理 Node.js 專案。

2. **原生 SQLite。** Cookie 解密直接讀取 Chromium 的 SQLite Cookie 資料庫。Bun 內建 `new Database()`——不需要 `better-sqlite3`，不需要原生附加元件編譯，不需要 gyp。少了一個在不同機器上會壞掉的東西。

3. **原生 TypeScript。** 伺服器在開發時以 `bun run server.ts` 執行。不需要編譯步驟，不需要 `ts-node`，不需要 source map 來除錯。編譯後的二進位檔用於部署；原始碼檔案用於開發。

4. **內建 HTTP 伺服器。** `Bun.serve()` 快速、簡單，不需要 Express 或 Fastify。伺服器總共處理約 10 個路由。框架會是多餘的負擔。

瓶頸始終是 Chromium，不是 CLI 或伺服器。Bun 的啟動速度（編譯後二進位檔約 1ms，相對於 Node 的約 100ms）很好，但這不是選擇它的原因。編譯後的二進位檔和原生 SQLite 才是。

## 守護程序模型

### 為什麼不每個指令啟動一個瀏覽器？

Playwright 啟動 Chromium 約需 2-3 秒。對於單一截圖來說，這沒問題。對於擁有 20+ 個指令的 QA 工作階段，這就是 40+ 秒的瀏覽器啟動開銷。更糟的是：指令之間你會失去所有狀態。Cookie、localStorage、登入工作階段、開啟的分頁——全部消失。

守護程序模型的意義：

- **持久狀態。** 登入一次，保持登入。開啟一個分頁，它就保持開啟。localStorage 在指令之間持續存在。
- **低於一秒的指令。** 第一次呼叫後，每個指令只是一個 HTTP POST。往返約 100-200ms，包含 Chromium 的工作。
- **自動生命週期。** 伺服器在第一次使用時自動啟動，在閒置 30 分鐘後自動關閉。不需要程序管理。

### 狀態檔案

伺服器寫入 `.gstack/browse.json`（透過 tmp + rename 進行原子寫入，模式 0o600）：

```json
{ "pid": 12345, "port": 34567, "token": "uuid-v4", "startedAt": "...", "binaryVersion": "abc123" }
```

CLI 讀取此檔案以找到伺服器。如果檔案缺失、過時或 PID 已死，CLI 會產生一個新伺服器。

### 連接埠選擇

在 10000-60000 之間隨機選擇連接埠（衝突時最多重試 5 次）。這表示 10 個 Conductor 工作空間可以各自執行自己的 browse 守護程序，零設定，零連接埠衝突。舊方法（掃描 9400-9409）在多工作空間設定中經常出問題。

### 版本自動重啟

建置時將 `git rev-parse HEAD` 寫入 `browse/dist/.version`。在每次 CLI 呼叫時，如果二進位檔的版本與執行中伺服器的 `binaryVersion` 不符，CLI 會終止舊伺服器並啟動一個新的。這完全防止了「過時二進位檔」這類 bug——重新建置二進位檔，下一個指令就自動使用新的。

## 安全模型

### 僅限本地端

HTTP 伺服器綁定到 `localhost`，而不是 `0.0.0.0`。無法從網路存取。

### Bearer token 驗證

每個伺服器工作階段生成一個隨機 UUID token，以模式 0o600（僅擁有者可讀）寫入狀態檔案。每個 HTTP 請求都必須包含 `Authorization: Bearer <token>`。如果 token 不符，伺服器返回 401。

這防止同一台機器上的其他程序與你的 browse 伺服器通訊。Cookie 選擇器 UI（`/cookie-picker`）和健康檢查（`/health`）是例外——它們是本地端限定的，不執行指令。

### Cookie 安全性

Cookie 是 gstack 處理的最敏感資料。設計如下：

1. **鑰匙圈存取需要使用者批准。** 每個瀏覽器的第一次 Cookie 匯入會觸發 macOS 鑰匙圈對話框。使用者必須點擊「允許」或「總是允許」。gstack 從不靜默存取憑證。

2. **解密在程序內進行。** Cookie 值在記憶體中解密（PBKDF2 + AES-128-CBC），載入 Playwright 上下文，且從不以明文寫入磁碟。Cookie 選擇器 UI 從不顯示 Cookie 值——只顯示域名和數量。

3. **資料庫是唯讀的。** gstack 將 Chromium Cookie 資料庫複製到暫存檔案（以避免與執行中的瀏覽器發生 SQLite 鎖定衝突），並以唯讀方式開啟。它從不修改你真實瀏覽器的 Cookie 資料庫。

4. **金鑰快取是每個工作階段的。** 鑰匙圈密碼和衍生的 AES 金鑰在伺服器的生命週期內快取在記憶體中。當伺服器關閉（閒置逾時或明確停止）時，快取就消失了。

5. **日誌中沒有 Cookie 值。** 主控台、網路和對話框日誌從不包含 Cookie 值。`cookies` 指令輸出 Cookie 元數據（域名、名稱、到期時間），但值會被截斷。

### Shell 注入防護

瀏覽器登錄檔（Comet、Chrome、Arc、Brave、Edge）是硬編碼的。資料庫路徑從已知常數建立，從不從使用者輸入建立。鑰匙圈存取使用 `Bun.spawn()` 搭配明確的參數陣列，而不是 shell 字串插值。

## 參考系統

參考（`@e1`、`@e2`、`@c1`）是代理人在不撰寫 CSS 選擇器或 XPath 的情況下定址頁面元素的方式。

### 運作方式

```
1. Agent runs: $B snapshot -i
2. Server calls Playwright's page.accessibility.snapshot()
3. Parser walks the ARIA tree, assigns sequential refs: @e1, @e2, @e3...
4. For each ref, builds a Playwright Locator: getByRole(role, { name }).nth(index)
5. Stores Map<string, RefEntry> on the BrowserManager instance (role + name + Locator)
6. Returns the annotated tree as plain text

Later:
7. Agent runs: $B click @e3
8. Server resolves @e3 → Locator → locator.click()
```

### 為什麼使用 Locator，而不是 DOM 修改

明顯的方法是將 `data-ref="@e1"` 屬性注入 DOM。但這在以下情況會出問題：

- **CSP（內容安全政策）。** 許多正式環境網站封鎖來自腳本的 DOM 修改。
- **React/Vue/Svelte 水合。** 框架協調可能會剝離注入的屬性。
- **Shadow DOM。** 無法從外部進入 shadow root。

Playwright Locator 對 DOM 是外部的。它們使用無障礙樹（由 Chromium 內部維護）和 `getByRole()` 查詢。沒有 DOM 修改，沒有 CSP 問題，沒有框架衝突。

### 參考生命週期

參考在導航時被清除（主框架上的 `framenavigated` 事件）。這是正確的——導航後，所有 Locator 都是過時的。代理人必須再次執行 `snapshot` 以獲取新的參考。這是設計上的決定：過時的參考應該明確地失敗，而不是點擊錯誤的元素。

### 參考過時偵測

SPA 可以在不觸發 `framenavigated` 的情況下修改 DOM（例如 React router 轉場、分頁切換、modal 開啟）。這使得參考變得過時，即使頁面 URL 沒有改變。為了捕捉這種情況，`resolveRef()` 在使用任何參考之前執行非同步的 `count()` 檢查：

```
resolveRef(@e3) → entry = refMap.get("e3")
                → count = await entry.locator.count()
                → if count === 0: throw "Ref @e3 is stale — element no longer exists. Run 'snapshot' to get fresh refs."
                → if count > 0: return { locator }
```

這快速失敗（約 5ms 開銷），而不是等待 Playwright 的 30 秒動作逾時在缺少的元素上到期。`RefEntry` 在 Locator 旁邊儲存 `role` 和 `name` 元數據，這樣錯誤訊息可以告訴代理人該元素是什麼。

### 游標互動參考（@c）

`-C` 旗標找到可點擊但不在 ARIA 樹中的元素——使用 `cursor: pointer` 樣式、帶有 `onclick` 屬性或自定義 `tabindex` 的元素。這些在單獨的命名空間中獲得 `@c1`、`@c2` 參考。這能找到框架渲染為 `<div>` 但實際上是按鈕的自定義元件。

## 日誌架構

三個環形緩衝區（各 50,000 個條目，O(1) 推送）：

```
Browser events → CircularBuffer (in-memory) → Async flush to .gstack/*.log
```

主控台訊息、網路請求和對話框事件各有自己的緩衝區。每 1 秒刷新一次——伺服器只附加自上次刷新以來的新條目。這表示：

- HTTP 請求處理從不被磁碟 I/O 阻塞
- 日誌在伺服器崩潰後存活（最多 1 秒的資料遺失）
- 記憶體有界（50K 條目 × 3 個緩衝區）
- 磁碟檔案是僅附加的，可由外部工具讀取

`console`、`network` 和 `dialog` 指令從記憶體緩衝區讀取，而不是磁碟。磁碟檔案用於事後除錯。

## SKILL.md 模板系統

### 問題

SKILL.md 檔案告訴 Claude 如何使用 browse 指令。如果文件列出一個不存在的旗標，或遺漏了一個已新增的指令，代理人就會遇到錯誤。手動維護的文件總是會與程式碼漂移。

### 解決方案

```
SKILL.md.tmpl          (human-written prose + placeholders)
       ↓
gen-skill-docs.ts      (reads source code metadata)
       ↓
SKILL.md               (committed, auto-generated sections)
```

模板包含需要人類判斷的工作流程、提示和範例。佔位符在建置時從原始碼填入：

| 佔位符 | 來源 | 產生什麼 |
|-------------|--------|-------------------|
| `{{COMMAND_REFERENCE}}` | `commands.ts` | 分類指令表 |
| `{{SNAPSHOT_FLAGS}}` | `snapshot.ts` | 帶範例的旗標參考 |
| `{{PREAMBLE}}` | `gen-skill-docs.ts` | 啟動區塊：更新檢查、工作階段追蹤、貢獻者模式、AskUserQuestion 格式 |
| `{{BROWSE_SETUP}}` | `gen-skill-docs.ts` | 二進位檔發現 + 設定說明 |
| `{{BASE_BRANCH_DETECT}}` | `gen-skill-docs.ts` | 針對 PR 的技能的動態基礎分支偵測（ship、review、qa、plan-ceo-review） |
| `{{QA_METHODOLOGY}}` | `gen-skill-docs.ts` | /qa 和 /qa-only 的共享 QA 方法區塊 |
| `{{DESIGN_METHODOLOGY}}` | `gen-skill-docs.ts` | /plan-design-review 和 /design-review 的共享設計審查方法 |
| `{{REVIEW_DASHBOARD}}` | `gen-skill-docs.ts` | /ship 預飛行的審查就緒儀表板 |
| `{{TEST_BOOTSTRAP}}` | `gen-skill-docs.ts` | /qa、/ship、/design-review 的測試框架偵測、啟動、CI/CD 設定 |

這在結構上是合理的——如果指令存在於程式碼中，它就出現在文件中。如果它不存在，它就不能出現。

### 前言

每個技能都以一個 `{{PREAMBLE}}` 區塊開始，在技能自己的邏輯之前執行。它在單一 bash 指令中處理四件事：

1. **更新檢查**——呼叫 `gstack-update-check`，如果有升級可用，則報告。
2. **工作階段追蹤**——觸碰 `~/.gstack/sessions/$PPID` 並計算活躍工作階段數（過去 2 小時內修改的檔案）。當有 3+ 個工作階段在執行時，所有技能進入「ELI16 模式」——每個問題都重新讓使用者了解上下文，因為他們在同時管理多個視窗。
3. **貢獻者模式**——從設定讀取 `gstack_contributor`。當為 true 時，代理人在 gstack 本身行為不當時向 `~/.gstack/contributor-logs/` 提交隨意的現場報告。
4. **AskUserQuestion 格式**——通用格式：上下文、問題、`RECOMMENDATION: Choose X because ___`、字母選項。在所有技能中一致。

### 為什麼是已提交的，而不是在執行時生成的？

三個原因：

1. **Claude 在技能載入時讀取 SKILL.md。** 當使用者呼叫 `/browse` 時，沒有建置步驟。檔案必須已經存在且正確。
2. **CI 可以驗證新鮮度。** `gen:skill-docs --dry-run` + `git diff --exit-code` 在合併前捕捉過時的文件。
3. **Git blame 有效。** 你可以看到指令是何時新增的以及在哪個提交中。

### 模板測試層級

| 層級 | 內容 | 費用 | 速度 |
|------|------|------|-------|
| 1 — 靜態驗證 | 解析 SKILL.md 中的每個 `$B` 指令，對照登錄檔驗證 | 免費 | <2 秒 |
| 2 — 透過 `claude -p` 的 E2E | 產生真實 Claude 工作階段，執行每個技能，檢查錯誤 | ~$3.85 | ~20 分鐘 |
| 3 — LLM 評審 | Sonnet 在清晰度/完整性/可操作性上對文件評分 | ~$0.15 | ~30 秒 |

第 1 層在每次 `bun test` 上執行。第 2+3 層在 `EVALS=1` 後面管控。理念是：免費抓住 95% 的問題，只在判斷呼叫時使用 LLM。

## 指令分派

指令按副作用分類：

- **READ**（text、html、links、console、cookies、...）：無修改。可安全重試。返回頁面狀態。
- **WRITE**（goto、click、fill、press、...）：修改頁面狀態。不是冪等的。
- **META**（snapshot、screenshot、tabs、chain、...）：不整齊地適合讀/寫的伺服器級操作。

這不只是組織性的。伺服器用它進行分派：

```typescript
if (READ_COMMANDS.has(cmd))  → handleReadCommand(cmd, args, bm)
if (WRITE_COMMANDS.has(cmd)) → handleWriteCommand(cmd, args, bm)
if (META_COMMANDS.has(cmd))  → handleMetaCommand(cmd, args, bm, shutdown)
```

`help` 指令返回所有三組，讓代理人可以自我發現可用指令。

## 錯誤理念

錯誤是給 AI 代理人的，不是給人類的。每個錯誤訊息都必須是可操作的：

- "Element not found" → "Element not found or not interactable. Run `snapshot -i` to see available elements."
- "Selector matched multiple elements" → "Selector matched multiple elements. Use @refs from `snapshot` instead."
- Timeout → "Navigation timed out after 30s. The page may be slow or the URL may be wrong."

Playwright 的原生錯誤透過 `wrapError()` 重寫，以剝離內部堆疊追蹤並新增指引。代理人應該能夠讀取錯誤並知道下一步該做什麼，無需人工介入。

### 崩潰復原

伺服器不嘗試自我修復。如果 Chromium 崩潰（`browser.on('disconnected')`），伺服器立即退出。CLI 在下一個指令偵測到死掉的伺服器並自動重啟。這比嘗試重新連接到半死的瀏覽器程序更簡單、更可靠。

## E2E 測試基礎設施

### 工作階段執行器（`test/helpers/session-runner.ts`）

E2E 測試將 `claude -p` 作為完全獨立的子程序產生——不是透過 Agent SDK，因為它無法在 Claude Code 工作階段中巢套。執行器：

1. 將提示詞寫入暫存檔案（避免 shell 跳脫問題）
2. 產生 `sh -c 'cat prompt | claude -p --output-format stream-json --verbose'`
3. 從 stdout 串流 NDJSON 以獲得實時進度
4. 與可設定的逾時競速
5. 將完整的 NDJSON 記錄解析為結構化結果

`parseNDJSON()` 函式是純粹的——沒有 I/O，沒有副作用——使其可以獨立測試。

### 可觀察性資料流

```
  skill-e2e.test.ts
        │
        │ generates runId, passes testName + runId to each call
        │
  ┌─────┼──────────────────────────────┐
  │     │                              │
  │  runSkillTest()              evalCollector
  │  (session-runner.ts)         (eval-store.ts)
  │     │                              │
  │  per tool call:              per addTest():
  │  ┌──┼──────────┐              savePartial()
  │  │  │          │                   │
  │  ▼  ▼          ▼                   ▼
  │ [HB] [PL]    [NJ]          _partial-e2e.json
  │  │    │        │             (atomic overwrite)
  │  │    │        │
  │  ▼    ▼        ▼
  │ e2e-  prog-  {name}
  │ live  ress   .ndjson
  │ .json .log
  │
  │  on failure:
  │  {name}-failure.json
  │
  │  ALL files in ~/.gstack-dev/
  │  Run dir: e2e-runs/{runId}/
  │
  │         eval-watch.ts
  │              │
  │        ┌─────┴─────┐
  │     read HB     read partial
  │        └─────┬─────┘
  │              ▼
  │        render dashboard
  │        (stale >10min? warn)
```

**分離所有權：** session-runner 擁有心跳（當前測試狀態），eval-store 擁有部分結果（已完成測試狀態）。watcher 讀取兩者。兩個元件都不了解對方——它們只透過檔案系統共享資料。

**所有事情都不是致命的：** 所有可觀察性 I/O 都包裝在 try/catch 中。寫入失敗永遠不會導致測試失敗。測試本身是真相的來源；可觀察性是盡力而為的。

**機器可讀診斷：** 每個測試結果包含 `exit_reason`（success、timeout、error_max_turns、error_api、exit_code_N）、`timeout_at_turn` 和 `last_tool_call`。這使得 `jq` 查詢成為可能：
```bash
jq '.tests[] | select(.exit_reason == "timeout") | .last_tool_call' ~/.gstack-dev/evals/_partial-e2e.json
```

### Eval 持久化（`test/helpers/eval-store.ts`）

`EvalCollector` 累積測試結果並以兩種方式寫入：

1. **增量：** `savePartial()` 在每次測試後寫入 `_partial-e2e.json`（原子操作：寫入 `.tmp`，`fs.renameSync`）。在被終止後存活。
2. **最終：** `finalize()` 寫入帶有時間戳記的 eval 檔案（例如 `e2e-20260314-143022.json`）。部分檔案從未被清理——它與最終檔案一起持續存在，用於可觀察性。

`eval:compare` 比較兩次 eval 執行。`eval:summary` 彙總 `~/.gstack-dev/evals/` 中所有執行的統計資料。

### 測試層級

| 層級 | 內容 | 費用 | 速度 |
|------|------|------|-------|
| 1 — 靜態驗證 | 解析 `$B` 指令，對照登錄檔驗證，可觀察性單元測試 | 免費 | <5 秒 |
| 2 — 透過 `claude -p` 的 E2E | 產生真實 Claude 工作階段，執行每個技能，掃描錯誤 | ~$3.85 | ~20 分鐘 |
| 3 — LLM 評審 | Sonnet 在清晰度/完整性/可操作性上對文件評分 | ~$0.15 | ~30 秒 |

第 1 層在每次 `bun test` 上執行。第 2+3 層在 `EVALS=1` 後面管控。理念是：免費抓住 95% 的問題，只在判斷呼叫和整合測試時使用 LLM。

## 有意不包含的功能

- **沒有 WebSocket 串流。** HTTP 請求/回應更簡單，可用 curl 除錯，且夠快。串流會增加複雜性，但邊際收益有限。
- **沒有 MCP 協定。** MCP 在每個請求上增加 JSON 結構描述開銷，並需要持久連接。純 HTTP + 純文字輸出在 token 上更輕量，更容易除錯。
- **沒有多使用者支援。** 每個工作空間一個伺服器，一個使用者。Token 驗證是深度防禦，而不是多租戶。
- **沒有 Windows/Linux Cookie 解密。** macOS 鑰匙圈是唯一支援的憑證儲存。Linux（GNOME Keyring/kwallet）和 Windows（DPAPI）在架構上是可能的，但尚未實作。
- **沒有 iframe 支援。** Playwright 可以處理 iframe，但參考系統目前尚未跨框架邊界。這是最多人要求的缺失功能。
