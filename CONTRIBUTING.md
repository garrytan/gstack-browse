# 貢獻 gstack

感謝你想讓 gstack 變得更好。無論你是在修復技能提示詞中的錯字，還是在打造全新的工作流程，這份指南都能讓你快速上手。

## 快速開始

gstack 技能是 Claude Code 從 `skills/` 目錄發現的 Markdown 檔案。通常它們位於 `~/.claude/skills/gstack/`（你的全域安裝）。但當你在開發 gstack 本身時，你希望 Claude Code 使用*你工作樹中的*技能——這樣編輯就能立即生效，無需複製或部署任何東西。

這就是開發模式的功用。它將你的 repo 符號連結到本地 `.claude/skills/` 目錄，讓 Claude Code 直接從你的 checkout 讀取技能。

```bash
git clone <repo> && cd gstack
bun install                    # 安裝依賴
bin/dev-setup                  # 啟用開發模式
```

現在編輯任何 `SKILL.md`，在 Claude Code 中呼叫它（例如 `/review`），就能即時看到你的變更。完成開發後：

```bash
bin/dev-teardown               # 停用——回到你的全域安裝
```

## 貢獻者模式

貢獻者模式將 gstack 變成一個自我改進的工具。啟用它後，Claude Code 會定期在每個主要工作流程步驟結束時反思其 gstack 體驗——對其評分 0-10。當某事不是 10 分時，它會思考原因，並向 `~/.gstack/contributor-logs/` 提交一份報告，記錄發生了什麼、重現步驟，以及什麼能讓它變得更好。

```bash
~/.claude/skills/gstack/bin/gstack-config set gstack_contributor true
```

日誌是**給你的**。當某事困擾你到足以修復的程度時，報告已經寫好了。Fork gstack，將你的 fork 符號連結到你遇到問題的專案中，修復它，然後開一個 PR。

### 貢獻者工作流程

1. **正常使用 gstack**——貢獻者模式自動反思並記錄問題
2. **查看你的日誌：** `ls ~/.gstack/contributor-logs/`
3. **Fork 並 clone gstack**（如果你還沒有的話）
4. **將你的 fork 符號連結到你遇到 bug 的專案中：**
   ```bash
   # 在你的核心專案中（遇到 gstack 讓你惱火的地方）
   ln -sfn /path/to/your/gstack-fork .claude/skills/gstack
   cd .claude/skills/gstack && bun install && bun run build
   ```
5. **修復問題**——你的變更立即在這個專案中生效
6. **透過實際使用 gstack 來測試**——做那個讓你惱火的事，驗證它已修復
7. **從你的 fork 開啟一個 PR**

這是最好的貢獻方式：在做你真正的工作時修復 gstack，在你真正感受到痛點的專案中修復。

### 工作階段意識

當你同時有 3+ 個 gstack 工作階段開啟時，每個問題都會告訴你是哪個專案、哪個分支，以及正在發生什麼。不再盯著一個問題思考「等等，這是哪個視窗？」格式在所有 15 個技能中保持一致。

## 在 gstack repo 內部開發 gstack

當你在編輯 gstack 技能並想透過在同一個 repo 中實際使用 gstack 來測試它們時，`bin/dev-setup` 會設定好這一切。它建立 `.claude/skills/` 符號連結（gitignored），指回你的工作樹，這樣 Claude Code 就會使用你的本地編輯，而不是全域安裝。

```
gstack/                          <- your working tree
├── .claude/skills/              <- created by dev-setup (gitignored)
│   ├── gstack -> ../../         <- symlink back to repo root
│   ├── review -> gstack/review
│   ├── ship -> gstack/ship
│   └── ...                      <- one symlink per skill
├── review/
│   └── SKILL.md                 <- edit this, test with /review
├── ship/
│   └── SKILL.md
├── browse/
│   ├── src/                     <- TypeScript source
│   └── dist/                    <- compiled binary (gitignored)
└── ...
```

## 日常工作流程

```bash
# 1. 進入開發模式
bin/dev-setup

# 2. 編輯技能
vim review/SKILL.md

# 3. 在 Claude Code 中測試——變更立即生效
#    > /review

# 4. 編輯 browse 原始碼？重新建置二進位檔
bun run build

# 5. 今天完成了？拆除
bin/dev-teardown
```

## 測試與評估

### 設定

```bash
# 1. 複製 .env.example 並新增你的 API 金鑰
cp .env.example .env
# 編輯 .env → 設定 ANTHROPIC_API_KEY=sk-ant-...

# 2. 安裝依賴（如果你還沒有的話）
bun install
```

Bun 自動載入 `.env`——不需要額外設定。Conductor 工作空間自動從主要工作樹繼承 `.env`（見下方「Conductor 工作空間」）。

### 測試層級

| 層級 | 指令 | 費用 | 測試內容 |
|------|---------|------|---------------|
| 1 — 靜態 | `bun test` | 免費 | 指令驗證、快照旗標、SKILL.md 正確性、TODOS-format.md 參考、可觀察性單元測試 |
| 2 — E2E | `bun run test:e2e` | ~$3.85 | 透過 `claude -p` 子程序完整技能執行 |
| 3 — LLM 評估 | `bun run test:evals` | ~$0.15 獨立 | LLM 評審對生成的 SKILL.md 文件評分 |
| 2+3 | `bun run test:evals` | ~$4 合計 | E2E + LLM 評審（兩者都執行） |

```bash
bun test                     # 僅第 1 層（每次提交都執行，<5 秒）
bun run test:e2e             # 第 2 層：僅 E2E（需要 EVALS=1，無法在 Claude Code 內執行）
bun run test:evals           # 第 2 + 3 層合計（~$4/次執行）
```

### 第 1 層：靜態驗證（免費）

透過 `bun test` 自動執行。不需要 API 金鑰。

- **技能解析器測試**（`test/skill-parser.test.ts`）——從 SKILL.md bash 程式碼區塊提取每個 `$B` 指令，並對照 `browse/src/commands.ts` 中的指令登錄檔驗證。捕捉錯字、已移除的指令和無效的快照旗標。
- **技能驗證測試**（`test/skill-validation.test.ts`）——驗證 SKILL.md 檔案只參考真實的指令和旗標，以及指令描述符合品質閾值。
- **生成器測試**（`test/gen-skill-docs.test.ts`）——測試模板系統：驗證佔位符正確解析，輸出包含旗標的值提示（例如 `-d <N>` 而不只是 `-d`），以及關鍵指令的豐富描述（例如 `is` 列出有效狀態，`press` 列出按鍵範例）。

### 第 2 層：透過 `claude -p` 的 E2E（~$3.85/次執行）

以子程序形式產生 `claude -p`，搭配 `--output-format stream-json --verbose`，串流 NDJSON 以獲得實時進度，並掃描 browse 錯誤。這是最接近「這個技能真的能端到端運作嗎？」的方式。

```bash
# 必須從普通終端機執行——無法在 Claude Code 或 Conductor 內部巢套
EVALS=1 bun test test/skill-e2e.test.ts
```

- 由 `EVALS=1` 環境變數管控（防止意外的昂貴執行）
- 如果在 Claude Code 內執行則自動跳過（`claude -p` 無法巢套）
- API 連線預檢——在燒掉預算之前，在 ConnectionRefused 時快速失敗
- 到 stderr 的實時進度：`[Ns] turn T tool #C: Name(...)`
- 保存完整 NDJSON 記錄和失敗 JSON 以供除錯
- 測試在 `test/skill-e2e.test.ts` 中，執行器邏輯在 `test/helpers/session-runner.ts` 中

### E2E 可觀察性

E2E 測試執行時，它們在 `~/.gstack-dev/` 中產生機器可讀的工件：

| 工件 | 路徑 | 用途 |
|----------|------|---------|
| 心跳 | `e2e-live.json` | 當前測試狀態（每次工具呼叫更新） |
| 部分結果 | `evals/_partial-e2e.json` | 已完成的測試（在被終止後存活） |
| 進度日誌 | `e2e-runs/{runId}/progress.log` | 僅附加的文字日誌 |
| NDJSON 記錄 | `e2e-runs/{runId}/{test}.ndjson` | 每個測試的原始 `claude -p` 輸出 |
| 失敗 JSON | `e2e-runs/{runId}/{test}-failure.json` | 失敗時的診斷資料 |

**即時儀表板：** 在第二個終端機中執行 `bun run eval:watch` 以查看顯示已完成測試、當前執行中的測試和費用的即時儀表板。使用 `--tail` 也顯示 progress.log 的最後 10 行。

**Eval 歷史工具：**

```bash
bun run eval:list            # 列出所有 eval 執行（每次執行的回合、時間、費用）
bun run eval:compare         # 比較兩次執行——顯示每個測試的差異 + Takeaway 評論
bun run eval:summary         # 跨所有執行的彙總統計 + 每個測試的效率平均值
```

**Eval 比較評論：** `eval:compare` 生成自然語言 Takeaway 段落，解釋執行之間的變化——標記退步、注意改進、指出效率提升（更少回合、更快、更便宜），並產生整體摘要。這由 `eval-store.ts` 中的 `generateCommentary()` 驅動。

工件從不被清理——它們在 `~/.gstack-dev/` 中累積，用於事後除錯和趨勢分析。

### 第 3 層：LLM 評審（~$0.15/次執行）

使用 Claude Sonnet 在三個維度上對生成的 SKILL.md 文件評分：

- **清晰度**——AI 代理人能否無歧義地理解說明？
- **完整性**——所有指令、旗標和使用模式是否都已記錄？
- **可操作性**——代理人能否只使用文件中的資訊執行任務？

每個維度評分 1-5。閾值：每個維度必須評分 **≥ 4**。還有一個回歸測試，將生成的文件與從 `origin/main` 手動維護的基準進行比較——生成的必須評分相等或更高。

```bash
# 需要 .env 中的 ANTHROPIC_API_KEY——包含在 bun run test:evals 中
```

- 使用 `claude-sonnet-4-6` 以保持評分穩定性
- 測試在 `test/skill-llm-eval.test.ts` 中
- 直接呼叫 Anthropic API（不是 `claude -p`），因此可以在任何地方運作，包括在 Claude Code 內部

### CI

GitHub Action（`.github/workflows/skill-docs.yml`）在每次推送和 PR 上執行 `bun run gen:skill-docs --dry-run`。如果生成的 SKILL.md 檔案與已提交的不同，CI 就會失敗。這在合併前捕捉過時的文件。

測試直接針對 browse 二進位檔執行——它們不需要開發模式。

## 編輯 SKILL.md 檔案

SKILL.md 檔案是從 `.tmpl` 模板**生成的**。不要直接編輯 `.md`——你的變更在下次建置時會被覆蓋。

```bash
# 1. 編輯模板
vim SKILL.md.tmpl              # 或 browse/SKILL.md.tmpl

# 2. 為兩個主機重新生成
bun run gen:skill-docs
bun run gen:skill-docs --host codex

# 3. 檢查健康狀況（報告 Claude 和 Codex 兩者）
bun run skill:check

# 或使用監視模式——在儲存時自動重新生成
bun run dev:skill
```

關於模板撰寫最佳實踐（自然語言優先於 bash 慣用語、動態分支偵測、`{{BASE_BRANCH_DETECT}}` 用法），請參閱 CLAUDE.md 的「撰寫 SKILL 模板」段落。

要新增 browse 指令，請將其新增到 `browse/src/commands.ts`。要新增快照旗標，請將其新增到 `browse/src/snapshot.ts` 中的 `SNAPSHOT_FLAGS`。然後重新建置。

## 雙主機開發（Claude + Codex）

gstack 為兩個主機生成 SKILL.md 檔案：**Claude**（`.claude/skills/`）和 **Codex**（`.agents/skills/`）。每次模板變更都需要為兩者生成。

### 為兩個主機生成

```bash
# 生成 Claude 輸出（預設）
bun run gen:skill-docs

# 生成 Codex 輸出
bun run gen:skill-docs --host codex
# --host agents 是 --host codex 的別名

# 或使用 build，它會做兩者 + 編譯二進位檔
bun run build
```

### 主機之間的差異

| 面向 | Claude | Codex |
|--------|--------|-------|
| 輸出目錄 | `{skill}/SKILL.md` | `.agents/skills/gstack-{skill}/SKILL.md` |
| Frontmatter | 完整（name、description、allowed-tools、hooks、version） | 最小（僅 name + description） |
| 路徑 | `~/.claude/skills/gstack` | `~/.codex/skills/gstack` |
| Hook 技能 | `hooks:` frontmatter（由 Claude 強制執行） | 內嵌安全建議說明（僅供建議） |
| `/codex` 技能 | 包含（Claude 包裝 codex exec） | 排除（自我參照） |

### 測試 Codex 輸出

```bash
# 執行所有靜態測試（包含 Codex 驗證）
bun test

# 檢查兩個主機的新鮮度
bun run gen:skill-docs --dry-run
bun run gen:skill-docs --host codex --dry-run

# 健康儀表板涵蓋兩個主機
bun run skill:check
```

### .agents/ 的開發設定

當你執行 `bin/dev-setup` 時，它會在 `.claude/skills/` 和 `.agents/skills/`（如果適用）中建立符號連結，讓相容 Codex 的代理人也能發現你的開發技能。

### 新增新技能

當你新增一個新的技能模板時，兩個主機都會自動獲得它：
1. 建立 `{skill}/SKILL.md.tmpl`
2. 執行 `bun run gen:skill-docs`（Claude 輸出）和 `bun run gen:skill-docs --host codex`（Codex 輸出）
3. 動態模板發現會自動找到它——不需要更新靜態清單
4. 提交 `{skill}/SKILL.md` 和 `.agents/skills/gstack-{skill}/SKILL.md` 兩者

## Conductor 工作空間

如果你使用 [Conductor](https://conductor.build) 並行執行多個 Claude Code 工作階段，`conductor.json` 會自動連接工作空間生命週期：

| Hook | 腳本 | 功能說明 |
|------|--------|-------------|
| `setup` | `bin/dev-setup` | 從主要工作樹複製 `.env`，安裝依賴，符號連結技能 |
| `archive` | `bin/dev-teardown` | 移除技能符號連結，清理 `.claude/` 目錄 |

當 Conductor 建立新工作空間時，`bin/dev-setup` 會自動執行。它偵測主要工作樹（透過 `git worktree list`），複製你的 `.env` 以攜帶 API 金鑰，並設定開發模式——不需要手動步驟。

**首次設定：** 將你的 `ANTHROPIC_API_KEY` 放在主要 repo 的 `.env` 中（見 `.env.example`）。每個 Conductor 工作空間都會自動繼承它。

## 注意事項

- **SKILL.md 檔案是生成的。** 編輯 `.tmpl` 模板，不要編輯 `.md`。執行 `bun run gen:skill-docs` 以重新生成。
- **TODOS.md 是統一的待辦清單。** 按技能/元件組織，優先級為 P0-P4。`/ship` 自動偵測已完成的項目。所有規劃/審查/回顧技能都讀取它以獲得上下文。
- **Browse 原始碼變更需要重新建置。** 如果你觸碰 `browse/src/*.ts`，請執行 `bun run build`。
- **開發模式會遮蔽你的全域安裝。** 專案本地技能優先於 `~/.claude/skills/gstack`。`bin/dev-teardown` 還原全域安裝。
- **Conductor 工作空間是獨立的。** 每個工作空間都是自己的 git worktree。`bin/dev-setup` 透過 `conductor.json` 自動執行。
- **`.env` 在工作樹間傳播。** 在主要 repo 中設定一次，所有 Conductor 工作空間都能獲得它。
- **`.claude/skills/` 在 gitignore 中。** 符號連結永遠不會被提交。

## 在真實專案中測試你的變更

**這是開發 gstack 的推薦方式。** 將你的 gstack checkout 符號連結到你實際使用它的專案中，這樣你的變更在你做真實工作時就是即時的：

```bash
# 在你的核心專案中
ln -sfn /path/to/your/gstack-checkout .claude/skills/gstack
cd .claude/skills/gstack && bun install && bun run build
```

現在這個專案中每個 gstack 技能呼叫都使用你的工作樹。編輯模板，執行 `bun run gen:skill-docs`，下一個 `/review` 或 `/qa` 呼叫就立即使用它。

**要回到穩定的全域安裝**，只需移除符號連結：

```bash
rm .claude/skills/gstack
```

Claude Code 會自動回退到 `~/.claude/skills/gstack/`。

### 替代方案：將你的全域安裝指向一個分支

如果你不想要每個專案的符號連結，你可以切換全域安裝：

```bash
cd ~/.claude/skills/gstack
git fetch origin
git checkout origin/<branch>
bun install && bun run build
```

這會影響所有專案。要恢復：`git checkout main && git pull && bun run build`。

## 出貨你的變更

當你對你的技能編輯感到滿意時：

```bash
/ship
```

這會執行測試、審查 diff、分類 Greptile 評論（2 層升級）、管理 TODOS.md、升級版本，並開啟 PR。完整工作流程見 `ship/SKILL.md`。
