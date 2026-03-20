# gstack

嗨，我是 [Garry Tan](https://x.com/garrytan)。我是 [Y Combinator](https://www.ycombinator.com/) 的總裁暨 CEO，在這裡我與數千家新創公司共事過，包括 Coinbase、Instacart 和 Rippling——當時這些公司的創辦人都只是一兩個人在車庫裡打拼，如今卻已成為市值數百億美元的企業。在 YC 之前，我設計了 Palantir 的 logo，並在那裡擔任首批工程主管/PM/設計師之一。我共同創立了 Posterous（一個部落格平台，後來賣給了 Twitter）。我在 2013 年建立了 Bookface，也就是 YC 的內部社群網絡。作為設計師、PM 和工程主管，我建立產品已有很長一段時間了。

而現在，我正身處一個感覺像全新時代的時刻中。

**過去 60 天，我撰寫了超過 600,000 行正式產品程式碼**——其中 35% 是測試——同時每天在身兼 YC CEO 所有職責的情況下，還能產出 **10,000 到 20,000 行可用程式碼**。這不是筆誤。我上次 `/retro`（過去 7 天的開發者統計，橫跨 3 個專案）：**新增 140,751 行、362 次提交、約 115k 淨程式碼行**。模型每週都在大幅進步。我們正處於某件真實之事的黎明——一個人的產能規模，已能媲美過去需要二十人團隊的水準。

**2026 年——1,237 次貢獻，持續增加中：**

![GitHub contributions 2026 — 1,237 contributions, massive acceleration in Jan-Mar](docs/images/github-2026.png)

**2013 年——我在 YC 建立 Bookface 時（772 次貢獻）：**

![GitHub contributions 2013 — 772 contributions building Bookface at YC](docs/images/github-2013.png)

同一個人。不同的時代。差別在於工具。

**gstack 是我的做法。** 這是我的開源軟體工廠。它將 Claude Code 轉化為一個你真正能管理的虛擬工程團隊——一位重新思考產品的 CEO、一位鎖定架構的工程主管、一位抓出 AI 濫竽充數的設計師、一位找出正式環境 bug 的偏執審查者、一位開啟真實瀏覽器點選你 app 的 QA 主管，以及一位負責送出 PR 的發布工程師。十五位專家加六種強力工具，全部都是斜線指令，全部都是 Markdown，**全部免費，MIT 授權，現在就可用。**

我正在學習如何在 2026 年 3 月觸及代理人系統所能做到的邊界，而這就是我的實況實驗。我分享它，是因為我希望全世界都能與我一同踏上這段旅程。

Fork 它。改進它。讓它成為你的工具。不要心存嫉妒，要心懷感激。

**適合哪些人：**
- **創辦人和 CEO**——尤其是仍想親自出貨的技術型創辦人。這就是你如何以二十人團隊的規模建造產品。
- **第一次使用 Claude Code 的人**——gstack 是最好的起點。有結構化角色，而不是空白提示詞。
- **技術主管和資深工程師**——為每個 PR 帶入嚴格的審查、QA 和發布自動化

## 快速開始：你的前 10 分鐘

1. 安裝 gstack（30 秒——見下方）
2. 執行 `/office-hours`——描述你在打造什麼。它會在你寫任何程式碼前重新框架這個問題。
3. 對任何功能想法執行 `/plan-ceo-review`
4. 對任何有變更的分支執行 `/review`
5. 對你的 staging URL 執行 `/qa`
6. 就停在這裡。你會知道這是不是適合你的工具。

在任何已有測試的 repo 上，預期在 5 分鐘內完成第一次有用的執行。

**如果你只再讀一個段落，請讀這個。**

## 安裝——只需 30 秒

**需求：** [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Git](https://git-scm.com/)、[Bun](https://bun.sh/) v1.0+

### 第一步：安裝到你的機器

開啟 Claude Code 並貼上這段指令。Claude 會完成剩下的事。

> Install gstack: run **`git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`** then add a "gstack" section to CLAUDE.md that says to use the /browse skill from gstack for all web browsing, never use mcp\_\_claude-in-chrome\_\_\* tools, and lists the available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade. Then ask the user if they also want to add gstack to the current project so teammates get it.

### 第二步：加入你的 repo，讓隊友也能使用（選用）

> Add gstack to this project: run **`cp -Rf ~/.claude/skills/gstack .claude/skills/gstack && rm -rf .claude/skills/gstack/.git && cd .claude/skills/gstack && ./setup`** then add a "gstack" section to this project's CLAUDE.md that says to use the /browse skill from gstack for all web browsing, never use mcp\_\_claude-in-chrome\_\_\* tools, lists the available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, and tells Claude that if gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

真實檔案會提交到你的 repo（不是子模組），所以 `git clone` 就可以直接運作。所有東西都在 `.claude/` 裡面。不會碰到你的 PATH，也不會在背景執行。

### Codex、Gemini CLI 或 Cursor

gstack 可在任何支援 [SKILL.md 標準](https://github.com/anthropics/claude-code) 的代理人上運作。技能存放在 `.agents/skills/` 並且會自動被發現。

```bash
git clone https://github.com/garrytan/gstack.git ~/.codex/skills/gstack
cd ~/.codex/skills/gstack && ./setup --host codex
```

或讓 setup 自動偵測你安裝了哪些代理人：

```bash
git clone https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup --host auto
```

這會根據可用的代理人安裝到 `~/.claude/skills/gstack` 和/或 `~/.codex/skills/gstack`。全部 21 個技能在所有支援的代理人上均可運作。基於 hook 的安全技能（careful、freeze、guard）在非 Claude 主機上使用內嵌安全建議說明。

## 實際效果展示

```
你:    我想打造一個行事曆的每日摘要 app。
你:    /office-hours
Claude: [詢問真實的痛點——具體例子，不是假設]

你:    多個 Google 日曆，活動資訊過時、地點錯誤。
        準備工作花時間但結果不夠好...

Claude: 我要挑戰這個框架。你說「每日摘要 app」。
        但你實際描述的是一個個人 AI 幕僚長。
        [提取出 5 個你沒有意識到自己在描述的能力]
        [挑戰 4 個前提——你同意、不同意或調整]
        [產生 3 種實作方案及工作量估算]
        建議：明天先出貨最小化版本，從真實使用中學習。
        完整願景是 3 個月的專案——先從真正有效的
        每日摘要開始。
        [撰寫設計文件 → 自動傳入下游技能]

你:    /plan-ceo-review
        [讀取設計文件，挑戰範疇，執行 10 區段審查]

你:    /plan-eng-review
        [資料流、狀態機、錯誤路徑的 ASCII 圖表]
        [測試矩陣、失效模式、安全疑慮]

你:    Approve plan. Exit plan mode.
        [在 11 個檔案中撰寫 2,400 行。約 8 分鐘。]

你:    /review
        [自動修復] 2 個問題。[需確認] 競爭條件 → 你批准修復。

你:    /qa https://staging.myapp.com
        [開啟真實瀏覽器，點選流程，找到並修復一個 bug]

你:    /ship
        測試：42 → 51（+9 個新增）。PR：github.com/you/app/pull/42
```

你說「每日摘要 app」。代理人說「你在打造一個 AI 幕僚長」——因為它聆聽你的痛點，而不是你的功能需求。接著它挑戰你的前提，產生三種方案，建議最小化切入點，並撰寫了一份設計文件，直接傳入每個下游技能。八個指令。這不是副駕駛。這是一個團隊。

## 衝刺流程

gstack 是一個流程，不只是工具的集合。技能的排序方式就像一個衝刺的運作方式：

**思考 → 計畫 → 建造 → 審查 → 測試 → 出貨 → 反思**

每個技能都傳入下一個。`/office-hours` 寫的設計文件由 `/plan-ceo-review` 讀取。`/plan-eng-review` 寫的測試計畫由 `/qa` 接手。`/review` 發現的 bug 由 `/ship` 驗證已修復。沒有任何事情會漏掉，因為每個步驟都知道前一個步驟發生了什麼。

一個衝刺，一個人，一個功能——使用 gstack 大約需要 30 分鐘。但真正改變一切的是：你可以同時執行 10-15 個這樣的衝刺。不同功能、不同分支、不同代理人——全部同時進行。這就是我每天在做自己本職工作的同時，出貨超過 10,000 行正式產品程式碼的方式。

| 技能 | 你的專家 | 他們做什麼 |
|-------|----------------|--------------|
| `/office-hours` | **YC 辦公時間** | 從這裡開始。六個強制性問題，在你寫程式前重新框架你的產品。挑戰你的框架，質疑前提，產生實作替代方案。設計文件傳入每個下游技能。 |
| `/plan-ceo-review` | **CEO / 創辦人** | 重新思考問題。找出需求中藏著的 10 星產品。四種模式：擴展、選擇性擴展、保持範疇、縮減。 |
| `/plan-eng-review` | **工程主管** | 確立架構、資料流、圖表、邊界案例和測試。將隱藏的假設逼出來。 |
| `/plan-design-review` | **資深設計師** | 對每個設計維度評分 0-10，說明 10 分是什麼樣子，然後編輯計畫以達到該標準。AI 濫竽充數偵測。互動式——每個設計決策一個 AskUserQuestion。 |
| `/design-consultation` | **設計夥伴** | 從零建立完整設計系統。了解市場格局，提出創意冒險，產生逼真的產品模型。設計是所有其他階段的核心。 |
| `/review` | **資深工程師** | 找出通過 CI 卻在正式環境爆掉的 bug。自動修復明顯的問題。標記完整性缺口。 |
| `/investigate` | **除錯者** | 系統性根本原因除錯。鐵則：沒有調查就沒有修復。追蹤資料流，測試假設，在 3 次修復失敗後停止。 |
| `/design-review` | **會寫程式的設計師** | 與 /plan-design-review 相同的審查，然後修復所發現的問題。原子提交，前後截圖對比。 |
| `/qa` | **QA 主管** | 測試你的 app，找到 bug，用原子提交修復，重新驗證。為每次修復自動產生回歸測試。 |
| `/qa-only` | **QA 報告者** | 與 /qa 相同的方法，但只有報告。當你想要純粹的 bug 報告而不更動程式碼時使用。 |
| `/ship` | **發布工程師** | 同步 main，執行測試，審查覆蓋率，推送，開 PR。如果你沒有測試框架，會從零建立一個。一個指令。 |
| `/document-release` | **技術寫作者** | 更新所有專案文件以符合你剛發布的內容。自動抓出過時的 README。 |
| `/retro` | **工程主管** | 具有團隊意識的每週回顧。每人細分、出貨連勝、測試健康趨勢、成長機會。 |
| `/browse` | **QA 工程師** | 給代理人眼睛。真實 Chromium 瀏覽器、真實點擊、真實截圖。每個指令約 100ms。 |
| `/setup-browser-cookies` | **工作階段管理者** | 從你的真實瀏覽器（Chrome、Arc、Brave、Edge）匯入 Cookie 到無頭工作階段。測試已驗證的頁面。 |

### 強力工具

| 技能 | 功能說明 |
|-------|-------------|
| `/codex` | **第二意見**——來自 OpenAI Codex CLI 的獨立程式碼審查。三種模式：審查（通過/失敗閘門）、對抗性挑戰，以及開放諮詢。當 `/review` 和 `/codex` 都執行過後，提供跨模型分析。 |
| `/careful` | **安全護欄**——在執行破壞性指令前警告（rm -rf、DROP TABLE、force-push）。可覆蓋任何警告。啟用方式：說「be careful」。 |
| `/freeze` | **編輯鎖定**——將檔案編輯限制在一個目錄。在除錯時防止意外更動範圍外的檔案。 |
| `/guard` | **完整安全**——一個指令啟用 `/careful` + `/freeze`。正式環境作業的最高安全模式。 |
| `/unfreeze` | **解鎖**——移除 `/freeze` 邊界。 |
| `/gstack-upgrade` | **自我更新**——升級 gstack 到最新版本。偵測全域或本地安裝，同步兩者，顯示變更內容。 |

**[每個技能的深度介紹（含範例與理念） →](docs/skills.md)**

## 最新功能及其重要性

**`/office-hours` 在你寫程式前重新框架你的產品。** 你說「每日摘要 app」。它聆聽你真實的痛點，挑戰框架，告訴你你真正在打造的是個人 AI 幕僚長，質疑你的前提，並產生三種含工作量估算的實作方案。它撰寫的設計文件直接傳入 `/plan-ceo-review` 和 `/plan-eng-review`——讓每個下游技能從真正的清晰認識開始，而不是一個模糊的功能需求。

**設計是核心。** `/design-consultation` 不只是挑字體。它研究你所在領域已有什麼，提出安全選擇和創意冒險，產生你實際產品的逼真模型，並撰寫 `DESIGN.md`——然後 `/design-review` 和 `/plan-eng-review` 會讀取你的選擇。設計決策流貫整個系統。

**`/qa` 是重大突破。** 它讓我從 6 個並行工作者增加到 12 個。Claude Code 說「我看到問題了」，然後真正修復它、產生回歸測試並驗證修復——這改變了我的工作方式。代理人現在有眼睛了。

**智慧審查路由。** 就像一個運作良好的新創公司：CEO 不需要看基礎設施 bug 修復，設計審查不需要針對後端變更。gstack 追蹤執行了哪些審查，判斷什麼是合適的，然後做出聰明的決定。審查就緒儀表板告訴你在出貨前的狀態。

**測試一切。** `/ship` 如果你的專案沒有測試框架，會從零開始建立。每次 `/ship` 執行都會產生覆蓋率審查。每次 `/qa` 的 bug 修復都會產生回歸測試。100% 測試覆蓋率是目標——測試讓有感覺的程式設計變得安全，而不是任性亂搞。

**`/document-release` 是你從來沒有的工程師。** 它讀取你專案中的每個文件，交叉對照 diff，並更新所有漂移的內容。README、ARCHITECTURE、CONTRIBUTING、CLAUDE.md、TODOS——全部自動保持最新。而且現在 `/ship` 會自動呼叫它——不需要額外指令，文件就能保持最新。

**AI 卡住時的瀏覽器交接。** 遇到 CAPTCHA、身份驗證牆或 MFA 提示？`$B handoff` 在完全相同的頁面上開啟可見的 Chrome，帶有所有 Cookie 和分頁。解決問題，告訴 Claude 你完成了，`$B resume` 從中斷的地方繼續。代理人甚至會在連續 3 次失敗後自動建議這個方法。

**多 AI 第二意見。** `/codex` 從 OpenAI 的 Codex CLI 獲得獨立審查——一個完全不同的 AI 看著同一個 diff。三種模式：帶通過/失敗閘門的程式碼審查、積極嘗試破壞你程式碼的對抗性挑戰，以及帶工作階段連續性的開放諮詢。當 `/review`（Claude）和 `/codex`（OpenAI）都審查了同一個分支，你會得到跨模型分析，顯示哪些發現重疊，哪些是各自獨有的。

**隨需安全護欄。** 說「be careful」，`/careful` 會在任何破壞性指令前警告——rm -rf、DROP TABLE、force-push、git reset --hard。`/freeze` 在除錯時將編輯鎖定到一個目錄，這樣 Claude 就不會意外「修復」不相關的程式碼。`/guard` 同時啟用兩者。`/investigate` 自動凍結到正在調查的模組。

**主動技能建議。** gstack 注意你所在的階段——腦力激盪、審查、除錯、測試——並建議正確的技能。不喜歡？說「stop suggesting」，它會跨工作階段記住。

## 10-15 個並行衝刺

gstack 單獨一個衝刺就很強大。十個同時運行，則具有變革性。

[Conductor](https://conductor.build) 在並行中執行多個 Claude Code 工作階段——每個都在自己的隔離工作空間中。一個工作階段對新想法執行 `/office-hours`，另一個對 PR 執行 `/review`，第三個實作一個功能，第四個對 staging 執行 `/qa`，還有六個在其他分支上。全部同時進行。我經常執行 10-15 個並行衝刺——這是目前的實際上限。

衝刺結構是讓並行運作的關鍵。沒有流程，十個代理人就是十個混亂的來源。有了流程——思考、計畫、建造、審查、測試、出貨——每個代理人確切地知道該做什麼以及何時停止。你管理他們的方式就像 CEO 管理團隊：在重要的決策上跟進，讓其他事情自行運作。

---

## 加入浪潮

這是**免費、MIT 授權、開源、現在就可用。** 沒有付費版本。沒有候補名單。沒有附加條件。

我開源了我的開發方式，並且在這裡積極升級我自己的軟體工廠。你可以 fork 它並讓它成為你自己的工具。這就是整個重點。我希望每個人都能踏上這段旅程。

相同的工具，不同的結果——因為 gstack 給你結構化角色和審查閘門，而不是通用的代理人混亂。那種治理結構是快速出貨和魯莽出貨之間的差別。

模型進步得很快。那些現在就學會如何與它們合作的人——真正合作，不只是嘗試一下——將會擁有巨大的優勢。這就是那個視窗。我們走吧。

十五位專家加六種強力工具。全部都是斜線指令。全部都是 Markdown。全部免費。**[github.com/garrytan/gstack](https://github.com/garrytan/gstack)** — MIT 授權

> **我們正在招募。** 想要每天出貨 10K+ 行程式碼並協助強化 gstack？
> 來 YC 工作——[ycombinator.com/software](https://ycombinator.com/software)
> 極具競爭力的薪資和股權。舊金山，Dogpatch District。

## 文件

| 文件 | 涵蓋內容 |
|-----|---------------|
| [技能深度介紹](docs/skills.md) | 每個技能的理念、範例和工作流程（包含 Greptile 整合） |
| [架構](ARCHITECTURE.md) | 設計決策和系統內部原理 |
| [瀏覽器參考](BROWSER.md) | `/browse` 的完整指令參考 |
| [貢獻指南](CONTRIBUTING.md) | 開發設定、測試、貢獻者模式和開發模式 |
| [更新日誌](CHANGELOG.md) | 每個版本的新功能 |

## 隱私與遙測

gstack 包含**選擇性**使用遙測，以協助改進專案。以下是確切的運作方式：

- **預設為關閉。** 除非你明確同意，否則不會向任何地方傳送任何資料。
- **首次執行時，** gstack 會詢問你是否願意分享匿名使用資料。你可以說不。
- **如果你選擇加入，傳送的內容：** 技能名稱、執行時間、成功/失敗、gstack 版本、作業系統。就這些。
- **永遠不傳送：** 程式碼、檔案路徑、repo 名稱、分支名稱、提示詞或任何使用者產生的內容。
- **隨時更改：** `gstack-config set telemetry off` 立即停用一切。

資料儲存在 [Supabase](https://supabase.com)（開源的 Firebase 替代品）。結構描述在 [`supabase/migrations/001_telemetry.sql`](supabase/migrations/001_telemetry.sql)——你可以驗證確切收集了什麼。repo 中的 Supabase 可公開金鑰是公開金鑰（就像 Firebase API 金鑰）——資料列級安全政策將其限制為僅限插入存取。

**本地分析始終可用。** 執行 `gstack-analytics` 從本地 JSONL 檔案查看你的個人使用儀表板——不需要遠端資料。

## 疑難排解

**技能沒有出現？** `cd ~/.claude/skills/gstack && ./setup`

**`/browse` 失敗？** `cd ~/.claude/skills/gstack && bun install && bun run build`

**安裝過時？** 執行 `/gstack-upgrade`——或在 `~/.gstack/config.yaml` 中設定 `auto_upgrade: true`

**Claude 說它看不到技能？** 確保你的專案 `CLAUDE.md` 有一個 gstack 段落。加入這個：

```
## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review,
/setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful,
/freeze, /guard, /unfreeze, /gstack-upgrade.
```

## 授權

MIT。永久免費。去打造些什麼吧。
