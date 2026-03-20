# 瀏覽器——技術細節

本文件涵蓋 gstack 無頭瀏覽器的指令參考和內部原理。

## 指令參考

| 類別 | 指令 | 用途 |
|----------|----------|----------|
| 導航 | `goto`, `back`, `forward`, `reload`, `url` | 前往頁面 |
| 讀取 | `text`, `html`, `links`, `forms`, `accessibility` | 提取內容 |
| 快照 | `snapshot [-i] [-c] [-d N] [-s sel] [-D] [-a] [-o] [-C]` | 取得參考、差異比對、標注 |
| 互動 | `click`, `fill`, `select`, `hover`, `type`, `press`, `scroll`, `wait`, `viewport`, `upload` | 使用頁面 |
| 檢查 | `js`, `eval`, `css`, `attrs`, `is`, `console`, `network`, `dialog`, `cookies`, `storage`, `perf` | 除錯和驗證 |
| 視覺 | `screenshot [--viewport] [--clip x,y,w,h] [sel\|@ref] [path]`, `pdf`, `responsive` | 查看 Claude 所看到的 |
| 比較 | `diff <url1> <url2>` | 找出環境之間的差異 |
| 對話框 | `dialog-accept [text]`, `dialog-dismiss` | 控制 alert/confirm/prompt 處理 |
| 分頁 | `tabs`, `tab`, `newtab`, `closetab` | 多頁面工作流程 |
| Cookies | `cookie-import`, `cookie-import-browser` | 從檔案或真實瀏覽器匯入 Cookie |
| 多步驟 | `chain`（JSON 來自 stdin） | 在一次呼叫中批次指令 |
| 交接 | `handoff [reason]`, `resume` | 切換到可見 Chrome 讓使用者接手 |

所有選擇器參數接受 CSS 選擇器、`snapshot` 後的 `@e` 參考，或 `snapshot -C` 後的 `@c` 參考。共 50+ 個指令加上 Cookie 匯入。

## 運作方式

gstack 的瀏覽器是一個編譯後的 CLI 二進位檔，透過 HTTP 與持久的本地端 Chromium 守護程序通訊。CLI 是一個精簡的客戶端——它讀取狀態檔案，傳送指令，並將回應輸出到 stdout。伺服器透過 [Playwright](https://playwright.dev/) 進行真正的工作。

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code                                                    │
│                                                                 │
│  "browse goto https://staging.myapp.com"                        │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP POST     ┌──────────────┐                 │
│  │ browse   │ ──────────────── │ Bun HTTP     │                 │
│  │ CLI      │  localhost:rand  │ server       │                 │
│  │          │  Bearer token    │              │                 │
│  │ compiled │ ◄──────────────  │  Playwright  │──── Chromium    │
│  │ binary   │  plain text      │  API calls   │    (headless)   │
│  └──────────┘                  └──────────────┘                 │
│   ~1ms startup                  persistent daemon               │
│                                 auto-starts on first call       │
│                                 auto-stops after 30 min idle    │
└─────────────────────────────────────────────────────────────────┘
```

### 生命週期

1. **第一次呼叫**：CLI 在專案根目錄中檢查 `.gstack/browse.json` 是否有執行中的伺服器。沒有找到——它在背景產生 `bun run browse/src/server.ts`。伺服器透過 Playwright 啟動無頭 Chromium，選擇一個隨機連接埠（10000-60000），生成 bearer token，寫入狀態檔案，並開始接受 HTTP 請求。這大約需要 3 秒。

2. **後續呼叫**：CLI 讀取狀態檔案，發送帶有 bearer token 的 HTTP POST，輸出回應。往返約 100-200ms。

3. **閒置關閉**：30 分鐘沒有指令後，伺服器關閉並清理狀態檔案。下一次呼叫自動重啟它。

4. **崩潰復原**：如果 Chromium 崩潰，伺服器立即退出（不自我修復——不隱藏失敗）。CLI 在下一次呼叫時偵測到死掉的伺服器並啟動一個全新的。

### 關鍵元件

```
browse/
├── src/
│   ├── cli.ts              # 精簡客戶端——讀取狀態檔案，發送 HTTP，輸出回應
│   ├── server.ts           # Bun.serve HTTP 伺服器——路由指令到 Playwright
│   ├── browser-manager.ts  # Chromium 生命週期——啟動、分頁、參考映射、崩潰處理
│   ├── snapshot.ts         # 無障礙樹 → @ref 分配 → Locator 映射 + diff/annotate/-C
│   ├── read-commands.ts    # 非修改性指令（text、html、links、js、css、is、dialog 等）
│   ├── write-commands.ts   # 修改性指令（click、fill、select、upload、dialog-accept 等）
│   ├── meta-commands.ts    # 伺服器管理、chain、diff、快照路由
│   ├── cookie-import-browser.ts  # 從真實 Chromium 瀏覽器解密並匯入 Cookie
│   ├── cookie-picker-routes.ts   # 互動式 Cookie 選擇器 UI 的 HTTP 路由
│   ├── cookie-picker-ui.ts       # Cookie 選擇器的自包含 HTML/CSS/JS
│   └── buffers.ts          # CircularBuffer<T> + 主控台/網路/對話框捕捉
├── test/                   # 整合測試 + HTML 測試裝置
└── dist/
    └── browse              # 編譯後的二進位檔（~58MB，Bun --compile）
```

### 快照系統

瀏覽器的關鍵創新是基於參考的元素選擇，建立在 Playwright 的無障礙樹 API 之上：

1. `page.locator(scope).ariaSnapshot()` 返回類似 YAML 的無障礙樹
2. 快照解析器為每個元素分配參考（`@e1`、`@e2`、...）
3. 對於每個參考，建立一個 Playwright `Locator`（使用 `getByRole` + nth-child）
4. 參考到 Locator 的映射儲存在 `BrowserManager` 上
5. 之後的指令如 `click @e3` 查找 Locator 並呼叫 `locator.click()`

沒有 DOM 修改。沒有注入的腳本。只使用 Playwright 的原生無障礙 API。

**參考過時偵測：** SPA 可以在不導航的情況下修改 DOM（React router、分頁切換、modal）。當這發生時，從先前的 `snapshot` 收集的參考可能指向已不存在的元素。為了處理這種情況，`resolveRef()` 在使用任何參考之前執行非同步的 `count()` 檢查——如果元素計數為 0，它立即拋出一個訊息，告訴代理人重新執行 `snapshot`。這快速失敗（約 5ms），而不是等待 Playwright 的 30 秒動作逾時。

**擴展快照功能：**
- `--diff`（`-D`）：將每個快照儲存為基準線。在下一次 `-D` 呼叫時，返回顯示變更內容的統一差異。使用此功能來驗證操作（click、fill 等）是否真的有效。
- `--annotate`（`-a`）：在每個參考的邊界框注入臨時覆蓋 div，截取帶有可見參考標籤的截圖，然後移除覆蓋。使用 `-o <path>` 控制輸出路徑。
- `--cursor-interactive`（`-C`）：使用 `page.evaluate` 掃描非 ARIA 互動元素（帶 `cursor:pointer`、`onclick`、`tabindex>=0` 的 div）。分配 `@c1`、`@c2`... 參考，帶有確定性的 `nth-child` CSS 選擇器。這些是 ARIA 樹錯過但使用者仍能點擊的元素。

### 截圖模式

`screenshot` 指令支援四種模式：

| 模式 | 語法 | Playwright API |
|------|--------|----------------|
| 全頁（預設） | `screenshot [path]` | `page.screenshot({ fullPage: true })` |
| 僅視窗 | `screenshot --viewport [path]` | `page.screenshot({ fullPage: false })` |
| 元素裁切 | `screenshot "#sel" [path]` 或 `screenshot @e3 [path]` | `locator.screenshot()` |
| 區域裁切 | `screenshot --clip x,y,w,h [path]` | `page.screenshot({ clip })` |

元素裁切接受 CSS 選擇器（`.class`、`#id`、`[attr]`）或來自 `snapshot` 的 `@e`/`@c` 參考。自動偵測：`@e`/`@c` 前綴 = 參考，`.`/`#`/`[` 前綴 = CSS 選擇器，`--` 前綴 = 旗標，其他 = 輸出路徑。

互斥：`--clip` + 選擇器，以及 `--viewport` + `--clip` 都會拋出錯誤。未知旗標（例如 `--bogus`）也會拋出錯誤。

### 驗證

每個伺服器工作階段生成一個隨機 UUID 作為 bearer token。Token 以 chmod 600 寫入狀態檔案（`.gstack/browse.json`）。每個 HTTP 請求都必須包含 `Authorization: Bearer <token>`。這防止機器上的其他程序控制瀏覽器。

### 主控台、網路和對話框捕捉

伺服器掛接到 Playwright 的 `page.on('console')`、`page.on('response')` 和 `page.on('dialog')` 事件。所有條目都保存在 O(1) 環形緩衝區中（各 50,000 容量），並透過 `Bun.write()` 非同步刷新到磁碟：

- 主控台：`.gstack/browse-console.log`
- 網路：`.gstack/browse-network.log`
- 對話框：`.gstack/browse-dialog.log`

`console`、`network` 和 `dialog` 指令從記憶體緩衝區讀取，而不是磁碟。

### 使用者交接

當無頭瀏覽器無法繼續（CAPTCHA、MFA、複雜的身份驗證）時，`handoff` 會在完全相同的頁面上開啟一個可見的 Chrome 視窗，保留所有 Cookie、localStorage 和分頁。使用者手動解決問題，然後 `resume` 將控制權返回給代理人，並帶有新的快照。

```bash
$B handoff "Stuck on CAPTCHA at login page"   # 開啟可見 Chrome
# 使用者解決 CAPTCHA...
$B resume                                       # 帶有新快照返回到無頭模式
```

瀏覽器在連續 3 次失敗後自動建議 `handoff`。狀態在切換過程中完全保留——不需要重新登入。

### 對話框處理

對話框（alert、confirm、prompt）預設自動接受，以防止瀏覽器鎖定。`dialog-accept` 和 `dialog-dismiss` 指令控制此行為。對於 prompt，`dialog-accept <text>` 提供回應文字。所有對話框都記錄到對話框緩衝區，帶有類型、訊息和採取的動作。

### JavaScript 執行（`js` 和 `eval`）

`js` 執行單一表達式，`eval` 執行 JS 檔案。兩者都支援 `await`——包含 `await` 的表達式自動包裝在非同步上下文中：

```bash
$B js "await fetch('/api/data').then(r => r.json())"  # 可以運作
$B js "document.title"                                  # 也可以（不需要包裝）
$B eval my-script.js                                    # 帶有 await 的檔案也可以運作
```

對於 `eval` 檔案，單行檔案直接返回表達式值。多行檔案在使用 `await` 時需要明確的 `return`。包含「await」的注釋不會觸發包裝。

### 多工作空間支援

每個工作空間都有自己隔離的瀏覽器實例，有自己的 Chromium 程序、分頁、Cookie 和日誌。狀態儲存在專案根目錄（透過 `git rev-parse --show-toplevel` 偵測）內的 `.gstack/` 中。

| 工作空間 | 狀態檔案 | 連接埠 |
|-----------|------------|------|
| `/code/project-a` | `/code/project-a/.gstack/browse.json` | 隨機（10000-60000） |
| `/code/project-b` | `/code/project-b/.gstack/browse.json` | 隨機（10000-60000） |

沒有連接埠衝突。沒有共享狀態。每個專案完全隔離。

### 環境變數

| 變數 | 預設值 | 說明 |
|----------|---------|-------------|
| `BROWSE_PORT` | 0（隨機 10000-60000） | HTTP 伺服器的固定連接埠（除錯覆蓋） |
| `BROWSE_IDLE_TIMEOUT` | 1800000（30 分鐘） | 閒置關閉逾時（毫秒） |
| `BROWSE_STATE_FILE` | `.gstack/browse.json` | 狀態檔案路徑（CLI 傳遞給伺服器） |
| `BROWSE_SERVER_SCRIPT` | 自動偵測 | server.ts 的路徑 |

### 效能

| 工具 | 第一次呼叫 | 後續呼叫 | 每次呼叫的上下文開銷 |
|------|-----------|-----------------|--------------------------|
| Chrome MCP | ~5 秒 | ~2-5 秒 | ~2000 tokens（結構描述 + 協定） |
| Playwright MCP | ~3 秒 | ~1-3 秒 | ~1500 tokens（結構描述 + 協定） |
| **gstack browse** | **~3 秒** | **~100-200ms** | **0 tokens**（純文字 stdout） |

上下文開銷差異很快就會累積。在一個 20 個指令的瀏覽器工作階段中，MCP 工具單獨在協定框架上就燒掉 30,000-40,000 個 token。gstack 燒掉零個。

### 為什麼選擇 CLI 而不是 MCP？

MCP（Model Context Protocol）對遠端服務運作良好，但對本地端瀏覽器自動化它只是純粹的開銷：

- **上下文膨脹**：每個 MCP 呼叫都包含完整的 JSON 結構描述和協定框架。一個簡單的「取得頁面文字」比它應有的消耗多 10 倍的上下文 token。
- **連接脆弱性**：持久的 WebSocket/stdio 連接會斷開並且無法重新連接。
- **不必要的抽象**：Claude Code 已經有一個 Bash 工具。輸出到 stdout 的 CLI 是最簡單的介面。

gstack 跳過了所有這些。編譯後的二進位檔。純文字進，純文字出。沒有協定。沒有結構描述。沒有連接管理。

## 致謝

瀏覽器自動化層建立在 Microsoft 的 [Playwright](https://playwright.dev/) 之上。Playwright 的無障礙樹 API、Locator 系統和無頭 Chromium 管理使基於參考的互動成為可能。快照系統——為無障礙樹節點分配 `@ref` 標籤並將它們映射回 Playwright Locator——完全建立在 Playwright 的原語之上。感謝 Playwright 團隊建立如此堅實的基礎。

## 開發

### 前置需求

- [Bun](https://bun.sh/) v1.0+
- Playwright 的 Chromium（透過 `bun install` 自動安裝）

### 快速開始

```bash
bun install              # 安裝依賴 + Playwright Chromium
bun test                 # 執行整合測試（~3 秒）
bun run dev <cmd>        # 從原始碼執行 CLI（無需編譯）
bun run build            # 編譯到 browse/dist/browse
```

### 開發模式與編譯後二進位檔

開發期間，使用 `bun run dev` 而不是編譯後的二進位檔。它直接用 Bun 執行 `browse/src/cli.ts`，讓你無需編譯步驟就能獲得即時回饋：

```bash
bun run dev goto https://example.com
bun run dev text
bun run dev snapshot -i
bun run dev click @e3
```

編譯後的二進位檔（`bun run build`）只在發布時需要。它使用 Bun 的 `--compile` 旗標在 `browse/dist/browse` 產生一個約 58MB 的執行檔。

### 執行測試

```bash
bun test                         # 執行所有測試
bun test browse/test/commands              # 僅執行指令整合測試
bun test browse/test/snapshot              # 僅執行快照測試
bun test browse/test/cookie-import-browser # 僅執行 Cookie 匯入單元測試
```

測試啟動一個本地端 HTTP 伺服器（`browse/test/test-server.ts`），從 `browse/test/fixtures/` 提供 HTML 測試裝置，然後針對這些頁面執行 CLI 指令。203 個測試分布在 3 個檔案中，共約 15 秒。

### 原始碼地圖

| 檔案 | 角色 |
|------|------|
| `browse/src/cli.ts` | 入口點。讀取 `.gstack/browse.json`，發送 HTTP 到伺服器，輸出回應。 |
| `browse/src/server.ts` | Bun HTTP 伺服器。路由指令到正確的處理器。管理閒置逾時。 |
| `browse/src/browser-manager.ts` | Chromium 生命週期——啟動、分頁管理、參考映射、崩潰偵測。 |
| `browse/src/snapshot.ts` | 解析無障礙樹，分配 `@e`/`@c` 參考，建立 Locator 映射。處理 `--diff`、`--annotate`、`-C`。 |
| `browse/src/read-commands.ts` | 非修改性指令：`text`、`html`、`links`、`js`、`css`、`is`、`dialog`、`forms` 等。匯出 `getCleanText()`。 |
| `browse/src/write-commands.ts` | 修改性指令：`goto`、`click`、`fill`、`upload`、`dialog-accept`、`useragent`（帶上下文重建）等。 |
| `browse/src/meta-commands.ts` | 伺服器管理、chain 路由、diff（透過 `getCleanText` 的 DRY）、快照委派。 |
| `browse/src/cookie-import-browser.ts` | 透過 macOS 鑰匙圈 + PBKDF2/AES-128-CBC 解密 Chromium Cookie。自動偵測已安裝的瀏覽器。 |
| `browse/src/cookie-picker-routes.ts` | `/cookie-picker/*` 的 HTTP 路由——瀏覽器清單、域名搜尋、匯入、移除。 |
| `browse/src/cookie-picker-ui.ts` | 互動式 Cookie 選擇器的自包含 HTML 生成器（深色主題，無框架）。 |
| `browse/src/buffers.ts` | `CircularBuffer<T>`（O(1) 環形緩衝區）+ 帶非同步磁碟刷新的主控台/網路/對話框捕捉。 |

### 部署到活躍技能

活躍技能位於 `~/.claude/skills/gstack/`。進行變更後：

1. 推送你的分支
2. 在技能目錄中拉取：`cd ~/.claude/skills/gstack && git pull`
3. 重新建置：`cd ~/.claude/skills/gstack && bun run build`

或直接複製二進位檔：`cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`

### 新增指令

1. 在 `read-commands.ts`（非修改性）或 `write-commands.ts`（修改性）中新增處理器
2. 在 `server.ts` 中注冊路由
3. 如需要，在 `browse/test/commands.test.ts` 中新增帶有 HTML 測試裝置的測試案例
4. 執行 `bun test` 以驗證
5. 執行 `bun run build` 以編譯
