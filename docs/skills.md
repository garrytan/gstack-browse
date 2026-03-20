# 技能深入說明

每個 gstack 技能的詳細指南——設計理念、工作流程與使用範例。

| 技能 | 你的專家 | 他們的職責 |
|-------|----------------|--------------|
| [`/office-hours`](#office-hours) | **YC Office Hours** | 從這裡開始。六個逼出真相的問題，在你寫程式碼之前重新框架你的產品。挑戰你的前提假設，質疑思維框架，產生實作替代方案。設計文件直接串接每個下游技能。 |
| [`/plan-ceo-review`](#plan-ceo-review) | **CEO / 創辦人** | 重新思考問題。找出藏在需求背後的十星級產品。四種模式：擴展、選擇性擴展、維持範疇、縮減。 |
| [`/plan-eng-review`](#plan-eng-review) | **工程經理** | 確立架構、資料流、流程圖、邊緣情況與測試。把隱藏的假設逼到檯面上。 |
| [`/plan-design-review`](#plan-design-review) | **資深設計師** | 互動式計畫模式設計審查。對每個維度評分 0-10，說明 10 分長什麼樣，然後修正計畫。在計畫模式下運作。 |
| [`/design-consultation`](#design-consultation) | **設計夥伴** | 從零開始建立完整的設計系統。了解全貌，提出有創意的冒險，生成逼真的產品原型。讓設計成為所有其他階段的核心。 |
| [`/review`](#review) | **Staff 工程師** | 找出通過 CI 卻在生產環境爆炸的 bug。自動修復顯而易見的問題。標記完整性缺口。 |
| [`/investigate`](#investigate) | **除錯專家** | 系統化的根本原因除錯。鐵律：沒有調查就不修復。追蹤資料流，測試假設，三次修復失敗後停手。 |
| [`/design-review`](#design-review) | **會寫程式的設計師** | 線上網站視覺審計與修復迴圈。80 項審計，然後修復發現的問題。原子提交，附前後對比截圖。 |
| [`/qa`](#qa) | **QA 負責人** | 測試你的應用程式，找出 bug，用原子提交修復，再驗證。為每個修復自動生成回歸測試。 |
| [`/qa-only`](#qa) | **QA 報告員** | 方法論與 /qa 相同，但僅輸出報告。當你只想要純粹的 bug 報告而不希望變更程式碼時使用。 |
| [`/ship`](#ship) | **發佈工程師** | 同步 main、執行測試、審計覆蓋率、推送、開啟 PR。如果你沒有測試框架，它會幫你建立。一個指令搞定。 |
| [`/document-release`](#document-release) | **技術作家** | 更新所有專案文件，使其符合你剛剛發佈的內容。自動捕捉過時的 README。 |
| [`/retro`](#retro) | **工程經理** | 具備團隊意識的每週回顧。逐人分析、出貨連勝紀錄、測試健康趨勢、成長機會。 |
| [`/browse`](#browse) | **QA 工程師** | 給 AI 代理裝上眼睛。真實的 Chromium 瀏覽器、真實的點擊、真實的截圖。每個指令約 100ms。 |
| [`/setup-browser-cookies`](#setup-browser-cookies) | **Session 管理員** | 從你的真實瀏覽器（Chrome、Arc、Brave、Edge）匯入 cookies 到無頭 session。測試需要登入的頁面。 |
| | | |
| **多 AI** | | |
| [`/codex`](#codex) | **第二意見** | 來自 OpenAI Codex CLI 的獨立審查。三種模式：程式碼審查（通過/失敗關卡）、對抗性挑戰，以及具有 session 連續性的開放諮詢。當 `/review` 與 `/codex` 都執行過後，進行跨模型分析。 |
| | | |
| **安全性與實用工具** | | |
| [`/careful`](#safety--guardrails) | **安全護欄** | 在執行破壞性指令前發出警告（rm -rf、DROP TABLE、force-push、git reset --hard）。可覆蓋任何警告。常見的建置清理操作已列入白名單。 |
| [`/freeze`](#safety--guardrails) | **編輯鎖定** | 將所有檔案編輯限制在單一目錄內。阻止在邊界外執行 Edit 和 Write。用於除錯時防止意外修改。 |
| [`/guard`](#safety--guardrails) | **完整安全模式** | 一個指令結合 /careful + /freeze。用於生產環境作業的最高安全等級。 |
| [`/unfreeze`](#safety--guardrails) | **解除鎖定** | 移除 /freeze 邊界，再次允許在任何地方進行編輯。 |
| [`/gstack-upgrade`](#gstack-upgrade) | **自我更新器** | 將 gstack 升級至最新版本。偵測全域安裝與 vendored 安裝，同步兩者，顯示變更內容。 |

---

## `/office-hours`

這是每個專案應該開始的地方。

在你規劃、審查或寫程式碼之前——先坐下來，與 YC 風格的夥伴一起思考你究竟在打造什麼。不是你以為自己在打造的東西。而是你*實際上*在打造的東西。

### 重新框架

以下是一個真實專案的案例。使用者說：「我想建立一個每日行事曆簡報應用程式。」這是個合理的需求。然後它詢問了痛點——具體的例子，而非假設情境。使用者描述了助理遺漏事項的問題、多個 Google 帳號中的行事曆資訊過時、AI 產出的準備文件品質低落、活動地點錯誤導致花了很長時間確認的情況。

它的回應是：*「我要對這個框架提出質疑，因為我認為你已經超越它了。你說的是『多 Google 行事曆管理的每日簡報應用程式』。但你實際描述的是一個個人首席幕僚 AI。」*

然後它提取了使用者未曾意識到自己在描述的五項能力：

1. **監看你的行事曆**——跨所有帳號，偵測過時資訊、遺漏地點、權限缺口
2. **產生真正的準備工作**——不是後勤摘要，而是*智識上的工作*——為董事會會議、播客、募資活動做準備
3. **管理你的 CRM**——你在見誰、關係如何、他們想要什麼、過去的歷史
4. **優先排序你的時間**——標記何時需要提前準備、主動封鎖時間、按重要性排列活動
5. **用金錢換取槓桿**——主動尋找委外或自動化的方式

這個重新框架改變了整個專案。他們原本要建立一個行事曆應用程式。現在他們在建立一個價值高出十倍的東西——因為這個技能傾聽的是他們的痛點，而非他們的功能需求。

### 前提挑戰

重新框架之後，它會呈現前提讓你驗證。不是「這聽起來好嗎？」——而是關於產品的可驗證主張：

1. 行事曆是錨定資料來源，但價值在於其上的智慧層
2. 助理不會被取代——他們會被賦予超能力
3. 最窄的切入點是一個真正有效的每日簡報
4. CRM 整合是必備功能，而非錦上添花

你同意、不同意或調整。你接受的每個前提都會成為設計文件的支柱。

### 實作替代方案

然後它會生成 2-3 個具體的實作方案，附上誠實的工時估計：

- **方案 A：每日簡報優先**——最窄切入點，明天就能出貨，M 規模（人工團隊：約 3 週 / CC：約 2 天）
- **方案 B：CRM 優先**——先建立關係圖譜，L 規模（人工團隊：約 6 週 / CC：約 4 天）
- **方案 C：完整願景**——一次到位，XL 規模（人工團隊：約 3 個月 / CC：約 1.5 週）

推薦方案 A，因為你可以從真實使用中學習。CRM 資料在第二週自然呈現。

### 兩種模式

**新創模式**——適合創辦人和內部創業者，正在打造一門生意。你會得到六個逼出真相的問題，這些問題是從 YC 夥伴評估產品的方式中提煉出來的：需求現實、現狀、迫切的具體性、最窄切入點、觀察與意外、以及未來適配性。這些問題刻意讓你感到不舒服。如果你說不出哪個具體的人需要你的產品，那就是你在寫任何程式碼之前最重要的事情。

**打造者模式**——適合黑客松、側專案、開源、學習和享受樂趣。你會得到一個熱情的協作夥伴，幫你找出想法中最酷的版本。什麼樣的東西會讓人說「哇」？最快能分享出去的路徑是什麼？這些問題是生成式的，而非審問式的。

### 設計文件

兩種模式都以寫入 `~/.gstack/projects/` 的設計文件作結——而那份文件會直接串接到 `/plan-ceo-review` 和 `/plan-eng-review`。完整的生命週期現在是：`office-hours → plan → implement → review → QA → ship → retro`。

設計文件獲得批准後，`/office-hours` 會反思它注意到的關於你思維方式的觀察——不是空泛的讚美，而是針對你在 session 中說過的話的具體回饋。這些觀察也會出現在設計文件中，讓你日後重新閱讀時再次遇見它們。

---

## `/plan-ceo-review`

這是我的**創辦人模式**。

這是我希望模型以品味、雄心、使用者同理心和長遠視野來思考的地方。我不希望它照字面接受需求。我希望它先問一個更重要的問題：

**這個產品究竟是為了什麼？**

我把這稱為 **Brian Chesky 模式**。

重點不在於實作顯而易見的任務。重點在於從使用者的角度重新思考問題，找到那個感覺是必然的、令人愉悅的、甚至有點神奇的版本。

### 範例

假設我在建立一個類似 Craigslist 的分類廣告應用程式，我說：

> 「讓賣家上傳商品照片。」

一個弱的助理會新增一個檔案選擇器並儲存圖片。

這不是真正的產品。

在 `/plan-ceo-review` 中，我希望模型質疑「照片上傳」是否真的是這個功能。也許真正的功能是幫助某人建立一個真正能賣出去的商品清單。

如果那才是真正的工作，整個計畫就會改變。

現在模型應該問：

* 我們能從照片中辨識商品嗎？
* 我們能推斷 SKU 或型號嗎？
* 我們能搜尋網路並自動起草標題和描述嗎？
* 我們能抓取規格、分類和競品定價嗎？
* 我們能建議哪張照片最適合作為主圖嗎？
* 我們能偵測上傳的照片是否醜陋、昏暗、雜亂或缺乏信任感嗎？
* 我們能讓這個體驗感覺高端，而不是像 2007 年死氣沉沉的表單嗎？

這就是 `/plan-ceo-review` 為我做的事。

它不只是問「我如何新增這個功能？」
它問的是，**「這個需求背後藏著什麼樣的十星級產品？」**

### 四種模式

- **範疇擴展**——大膽夢想。AI 代理提出野心勃勃的版本。每個擴展都作為個別決策呈現，讓你選擇是否加入。充滿熱情地推薦。
- **選擇性擴展**——以你目前的範疇作為基準，但看看還有什麼可能。AI 代理逐一呈現機會，並給出中立建議——你自己挑選值得做的。
- **維持範疇**——對現有計畫進行最嚴格的審查。不呈現任何擴展。
- **範疇縮減**——找到最小可行版本。砍掉其他一切。

願景和決策會持久保存到 `~/.gstack/projects/`，超越對話存活。傑出的願景可以升格到你的 repo 中的 `docs/designs/`，供團隊共用。

---

## `/plan-eng-review`

這是我的**工程經理模式**。

一旦產品方向正確，我需要一種完全不同的智慧。我不需要更多天馬行空的創意發散。我不需要更多「如果……那就太酷了」。我希望模型成為我最好的技術負責人。

這個模式應該精準處理：

* 架構
* 系統邊界
* 資料流
* 狀態轉換
* 失敗模式
* 邊緣情況
* 信任邊界
* 測試覆蓋率

還有一個對我來說意想不到的重大突破：**流程圖**。

強迫 LLM 畫出系統時，它們的完整性會大幅提升。時序圖、狀態圖、元件圖、資料流圖，甚至測試矩陣。流程圖把隱藏的假設逼到檯面上。它們讓含糊的規劃更難發生。

所以 `/plan-eng-review` 是我希望模型建立技術支柱的地方，能夠承載產品願景。

### 範例

以同一個分類廣告應用程式為例。

假設 `/plan-ceo-review` 已經完成了它的工作。我們決定真正的功能不只是照片上傳。而是一個智慧商品清單流程，它能：

* 上傳照片
* 辨識商品
* 從網路豐富化商品清單
* 起草強而有力的標題和描述
* 建議最佳主圖

現在 `/plan-eng-review` 接手。

現在我希望模型回答以下問題：

* 上傳、分類、豐富化和起草生成的架構是什麼？
* 哪些步驟同步執行，哪些進入背景工作？
* 應用伺服器、物件儲存、視覺模型、搜尋/豐富化 API 和商品清單資料庫之間的邊界在哪裡？
* 如果上傳成功但豐富化失敗，會發生什麼？
* 如果商品辨識信心度很低，會發生什麼？
* 重試機制如何運作？
* 我們如何防止重複工作？
* 什麼時候持久化什麼，哪些可以安全地重新計算？

這就是我需要流程圖的地方——架構圖、狀態模型、資料流圖、測試矩陣。流程圖把隱藏的假設逼到檯面上。它們讓含糊的規劃更難發生。

這就是 `/plan-eng-review`。

不是「讓想法變小」。
而是**「讓想法變得可以建造」**。

### 審查就緒儀表板

每次審查（CEO、Eng、Design）都會記錄其結果。在每次審查結束時，你會看到一個儀表板：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  1   | 2026-03-16 14:30    | CLEAR     | no       |
| Design Review   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

Eng Review 是唯一的必要關卡（使用 `gstack-config set skip_eng_review true` 停用）。CEO 和 Design 是資訊性的——分別建議用於產品和 UI 變更。

### 計畫到 QA 的流程

當 `/plan-eng-review` 完成測試審查部分後，它會將測試計畫工件寫入 `~/.gstack/projects/`。之後當你執行 `/qa` 時，它會自動取用那個測試計畫——你的工程審查直接串接到 QA 測試，無需手動複製貼上。

---

## `/plan-design-review`

這是我的**資深設計師在你寫任何一行程式碼之前審查你的計畫**的模式。

大多數計畫描述了後端要做什麼，卻從未具體說明使用者實際上看到什麼。空白狀態？錯誤狀態？載入狀態？行動版面？AI 濫用風險？這些決策都被推遲到「實作時再想辦法」——然後工程師把「No items found.」當作空白狀態出貨，因為沒有人指定更好的版本。

`/plan-design-review` 在規劃階段就捕捉這一切，這時修正的成本是最低的。

它的運作方式與 `/plan-ceo-review` 和 `/plan-eng-review` 相同——互動式、一次處理一個問題，採用 **STOP + AskUserQuestion** 模式。它對每個設計維度評分 0-10，說明 10 分長什麼樣，然後編輯計畫使其達標。評分驅動工作量：分數低 = 大量修復，分數高 = 快速通過。

對計畫進行七個輪次的審查：資訊架構、互動狀態覆蓋率、使用者旅程、AI 濫用風險、設計系統一致性、響應式/無障礙性，以及未解決的設計決策。對於每個輪次，它會找出缺口，然後直接修復（明顯的問題）或請你做出設計選擇（真正的取捨）。

### 範例

```
You:   /plan-design-review

Claude: Initial Design Rating: 4/10

        "This plan describes a user dashboard but never specifies
         what the user sees first. It says 'cards with icons' —
         which looks like every SaaS template. It mentions zero
         loading states, zero empty states, and no mobile behavior."

        Pass 1 (Info Architecture): 3/10
        "A 10 would define primary/secondary/tertiary content
         hierarchy for every screen."
        → Added information hierarchy section to plan

        Pass 2 (Interaction States): 2/10
        "The plan has 4 UI features but specifies 0 out of 20
         interaction states (4 features × 5 states each)."
        → Added interaction state table to plan

        Pass 4 (AI Slop): 4/10
        "The plan says 'clean, modern UI with cards and icons'
         and 'hero section with gradient'. These are the top 2
         AI-generated-looking patterns."
        → Rewrote UI descriptions with specific, intentional alternatives

        Overall: 4/10 → 8/10 after fixes
        "Plan is design-complete. Run /design-review after
         implementation for visual QA."
```

重新執行時，已達 8 分以上的部分會快速通過。低於 8 分的部分會得到完整處理。針對實作後的線上網站視覺審計，請使用 `/design-review`。

---

## `/design-consultation`

這是我的**設計夥伴模式**。

`/plan-design-review` 審計已經存在的網站。`/design-consultation` 適用於你完全沒有任何東西的時候——沒有設計系統、沒有字型選擇、沒有色彩調色盤。你從零開始，你希望一位資深設計師坐下來與你一起建立整個視覺識別。

這是一段對話，而非一張表單。AI 代理詢問你的產品、使用者和受眾。它思考你的產品需要傳達什麼——信任、速度、工藝、溫暖，或任何合適的東西——並從中推導出具體的選擇。然後它提出一個完整、連貫的設計系統：美學方向、字型排版（3 種以上字型，各自有明確角色）、附 hex 值的色彩調色盤、間距比例、版面配置方式以及動態策略。每個建議都附有理由。每個選擇都強化其他選擇。

但連貫性只是基本要求。每個開發工具儀表板看起來都一樣——乾淨的無襯線字型、柔和的灰色、藍色強調色。它們都是連貫的。它們都令人忘懷。讓產品看起來「不錯」和讓人真正記住的差異在於**刻意的創意冒險**：出人意料的標題襯線字型、你所在類別中沒有人使用的大膽強調色、讓你的資料感覺更有權威而非空曠飄渺的緊湊間距。

這才是 `/design-consultation` 真正關於的事。它不只是提出一個安全的系統。它提出安全選擇與冒險選擇——並告訴你哪個是哪個。「這些是讓你在你的類別中保持可讀性的選擇。這是我認為你應該打破慣例的地方，以及原因。」你挑選要承擔哪些風險。AI 代理確保無論如何整個系統仍然保持連貫。

如果你想要，AI 代理會研究你的領域中已有什麼——截取真實網站的截圖，分析它們的字型、顏色和間距——讓你在做選擇之前能看到全局。這不是為了模仿。而是為了進入那個範圍，讓你知道慣例是什麼，然後決定哪些值得打破。

你們對設計系統達成共識後，它會生成一個互動式 HTML 預覽頁面——不只是色票和字型樣本，而是逼真的產品頁面。如果你在建立儀表板，你會看到一個有側邊欄、資料表和統計卡的儀表板。如果你在建立行銷網站，你會看到一個有真實文案和 CTA 的英雄區塊。所有內容都以你的設計系統呈現，使用你的產品名稱，並附有淺色和深色模式。你在寫下任何一行生產程式碼之前，就能感受到你的產品的樣貌。

然後它會將 `DESIGN.md` 寫入你的 repo 根目錄——你的專案設計真相來源——並更新 `CLAUDE.md`，讓每個未來的 Claude Code session 都遵守這個系統。從那時起，`/design-review` 可以對其進行審計，任何處理你前端的 AI 代理都知道規則。

### 範例

```
You:   /design-consultation

Claude: From the README, this looks like a developer analytics dashboard
        for engineering teams. Sound right? Tell me about the feeling
        you want — and would you like me to look at what's out there
        first so we can see the landscape?

You:    Yes, it's for eng managers. Show me what's out there.

Claude: [browses Linear, Vercel, Datadog, Posthog — takes screenshots]

        Here's the landscape. They all converge on clean sans-serifs
        and muted blue-gray palettes. Linear stands out with dark-first
        and tight spacing. The rest feel interchangeable.

        Here's my proposal — and where I'd play it safe vs. take risks:

        AESTHETIC: Industrial/Utilitarian — data-first, every pixel earns its place
        TYPOGRAPHY: Geist (body + UI), Instrument Serif (display), JetBrains Mono (data)
        COLOR: Restrained — slate neutrals, single teal accent (#0D9488)
        SPACING: 4px base, compact density
        LAYOUT: Grid-disciplined, 12-column
        MOTION: Minimal-functional — only transitions that aid comprehension

        SAFE CHOICES (match category expectations):
          Geist for body — your users already know this font from Vercel
          Slate neutrals — warm grays feel right for data-heavy UIs
          Grid-disciplined layout — dashboards need predictable alignment

        RISKS (where you'd stand out):
          Instrument Serif for display headings — nobody in dev tools
            uses a serif. It creates instant hierarchy contrast and
            signals "we care about craft" in a space full of sans-serifs.
          Single teal accent instead of blue — everyone else in this space uses blue.
            Teal is close enough to feel trustworthy, different enough
            to be recognizable.
          4px compact density — tighter than Linear, says "we respect
            your screen real estate."

        The safe choices keep you literate. The risks are where your
        product gets its own face. Which risks appeal to you?

You:    Love the serif risk. Let's see it.

Claude: Preview opened in your browser.
        [/tmp/design-consultation-preview-1710000000.html]

        The page shows a realistic dashboard: sidebar nav, header with
        avatar, stat cards, data table — all in your design system.
        Instrument Serif at hero scale, Geist in body text, JetBrains
        Mono in the data table. Teal accent on buttons and active states.
        Light and dark mode toggle in the corner.

        How does it feel? Want to adjust anything before I write DESIGN.md?

You:    Ship it.

Claude: Wrote DESIGN.md (typography, color, spacing, layout, motion).
        Updated CLAUDE.md with design system guidelines.
        All future sessions will respect these choices.
```

---

## `/design-review`

這是我的**會寫程式的設計師模式**。

`/plan-design-review` 在實作前審查你的計畫。`/design-review` 則是在實作後審計和修復線上網站。

它對你的線上網站執行 80 項視覺審計，然後進入修復迴圈：對於每個設計發現，它定位源碼檔案，進行最小化的 CSS/樣式變更，以 `style(design): FINDING-NNN` 提交，重新導航以驗證，並拍攝前後對比截圖。每次修復一個提交，完全可二分法。

自我調節啟發法專為設計工作調整——僅 CSS 的變更可以免費通過（它們本質上是安全且可逆的），但對元件 JSX/TSX 檔案的變更會計入風險預算。修復上限為 30 個。如果風險分數超過 20%，它會停下來詢問。

### 範例

```
You:   /design-review https://myapp.com

Claude: [Runs full 80-item visual audit on the live site]
        Design Score: C  |  AI Slop Score: D
        12 findings (4 high, 5 medium, 3 polish)

        Fixing 9 design issues...

        style(design): FINDING-001 — replace 3-column icon grid with asymmetric layout
        style(design): FINDING-002 — add heading scale 48/32/24/18/16
        style(design): FINDING-003 — remove gradient hero, use bold typography
        style(design): FINDING-004 — add second font for headings
        style(design): FINDING-005 — vary border-radius by element role
        style(design): FINDING-006 — left-align body text, reserve center for headings
        style(design): FINDING-007 — add hover/focus states to all interactive elements
        style(design): FINDING-008 — add prefers-reduced-motion media query
        style(design): FINDING-009 — set max content width to 680px for body text

        Final audit:
        Design Score: C → B+  |  AI Slop Score: D → A
        9 fixes applied (8 verified, 1 best-effort). 3 deferred.

        [Report with before/after screenshots saved to .gstack/design-reports/]
```

九個提交，每個處理一個問題。AI 濫用分數從 D 升到 A，因為三個最易識別的模式（漸層英雄區塊、三欄格線、統一圓角）都消失了。

---

## `/review`

這是我的**偏執 Staff 工程師模式**。

通過測試不代表分支是安全的。

`/review` 的存在是因為有一整類 bug 能夠通過 CI 卻仍然在生產環境爆炸。這個模式不是關於夢想更大的事。它不是關於讓計畫更漂亮。它是在問：

**還有什麼會壞掉？**

這是一個結構性審計，而非風格挑剔式的審查。我希望模型尋找以下這類問題：

* N+1 查詢
* 過期讀取
* 競爭條件
* 不良的信任邊界
* 缺少索引
* 跳脫 bug
* 破壞的不變量
* 不良的重試邏輯
* 通過測試卻遺漏真正失敗模式的測試
* 被遺忘的枚舉處理器——新增一個新的狀態或類型常數，`/review` 會追蹤它通過你程式碼庫中的每個 switch 語句和允許清單，而不只是你變更的檔案

### 先修復

發現的問題會採取行動，而非只是列出清單。明顯的機械式修復（死程式碼、過時注解、N+1 查詢）會自動套用——你會看到每個修復的 `[AUTO-FIXED] file:line Problem → what was done`。真正有爭議的問題（安全性、競爭條件、設計決策）會提交給你做決定。

### 完整性缺口

`/review` 現在會標記快捷實作，當完整版本所需的 CC 時間不到 30 分鐘時。如果你選擇了 80% 的解決方案，而 100% 的解決方案是一個湖泊而非海洋，審查會指出來。

### 範例

假設智慧商品清單流程已實作，測試都是綠燈。

`/review` 還是應該問：

* 當渲染商品清單照片或草稿建議時，我有引入 N+1 查詢嗎？
* 我是在信任客戶端提供的檔案中繼資料，而非驗證實際檔案嗎？
* 兩個分頁能競爭並覆寫封面照片選擇或商品詳情嗎？
* 失敗的上傳會永遠在儲存空間留下孤兒檔案嗎？
* 「恰好一張主圖」的規則在並發情況下會破壞嗎？
* 如果豐富化 API 部分失敗，我能優雅降級還是保存垃圾資料？
* 我是否透過將網路資料引入草稿生成，意外製造了提示注入或信任邊界問題？

這就是 `/review` 的意義。

我在這裡不需要奉承。
我希望模型在生產事故發生之前就想像它。

---

## `/investigate`

當某些東西壞了而你不知道為什麼，`/investigate` 是你的系統化除錯員。它遵循鐵律：**沒有根本原因調查就不能修復。**

它不是猜測和修補，而是追蹤資料流，與已知的 bug 模式比對，一次測試一個假設。如果三次修復嘗試失敗，它會停下來質疑架構，而不是持續亂試。這防止了浪費數小時的「讓我再試一件事」螺旋。

---

## `/qa`

這是我的 **QA 負責人模式**。

`/browse` 給了 AI 代理眼睛。`/qa` 給了它一套測試方法論。

最常見的使用情境：你在功能分支上，剛寫完程式碼，想驗證一切正常。只要說 `/qa`——它會讀取你的 git diff，識別你的變更影響哪些頁面和路由，啟動瀏覽器，然後逐一測試。不需要 URL。不需要手動測試計畫。

四種模式：

- **差異感知**（在功能分支上自動執行）——讀取 `git diff main`，識別受影響的頁面，針對性地測試它們
- **完整**——系統性地探索整個應用程式。5-15 分鐘。記錄 5-10 個有充分依據的問題。
- **快速**（`--quick`）——30 秒的冒煙測試。首頁 + 前 5 個導航目標。
- **回歸**（`--regression baseline.json`）——執行完整模式，然後與之前的基準比對。

### 自動回歸測試

當 `/qa` 修復一個 bug 並驗證後，它會自動生成一個回歸測試，能夠捕捉導致問題的確切情境。測試包含完整的歸因追蹤，指向 QA 報告。

### 範例

```
You:   /qa https://staging.myapp.com

Claude: [Explores 12 pages, fills 3 forms, tests 2 flows]

        QA Report: staging.myapp.com — Health Score: 72/100

        Top 3 Issues:
        1. CRITICAL: Checkout form submits with empty required fields
        2. HIGH: Mobile nav menu doesn't close after selecting an item
        3. MEDIUM: Dashboard chart overlaps sidebar below 1024px

        [Full report with screenshots saved to .gstack/qa-reports/]
```

**測試需要登入的頁面：** 先使用 `/setup-browser-cookies` 匯入你的真實瀏覽器 session，然後 `/qa` 就能測試登入後的頁面。

---

## `/ship`

這是我的**發佈機器模式**。

一旦我決定了要建立什麼、確定了技術計畫、進行了嚴肅的審查，我就不想再多說廢話了。我要執行。

`/ship` 是最後一哩路。它適用於已就緒的分支，而非決定要建立什麼。

這是模型應該停止表現得像腦力激盪夥伴，開始表現得像紀律嚴明的發佈工程師的地方：與 main 同步、執行正確的測試、確保分支狀態正常、更新 changelog 或 versioning（如果 repo 有需要）、推送並建立或更新 PR。

### 測試框架自動建立

如果你的專案沒有測試框架，`/ship` 會幫你建立一個——偵測你的執行環境、研究最佳框架、安裝它、為你的實際程式碼編寫 3-5 個真實測試、設置 CI/CD（GitHub Actions），並建立 TESTING.md。100% 測試覆蓋率是目標——測試讓氛圍式撰碼變得安全，而非亂槍打鳥式撰碼。

### 覆蓋率審計

每次 `/ship` 執行都會從你的 diff 建立一個程式碼路徑圖，搜尋對應的測試，並產生附有品質星級的 ASCII 覆蓋率圖。缺口會自動生成測試。你的 PR 主體顯示覆蓋率：`Tests: 42 → 47 (+5 new)`。

### 審查關卡

`/ship` 在建立 PR 之前會檢查[審查就緒儀表板](#review-readiness-dashboard)。如果缺少 Eng Review，它會詢問——但不會阻止你。決策按分支儲存，所以你不會被重複詢問。

很多分支在有趣的工作完成後就死去了，因為只剩下無聊的發佈工作。人類會拖延那個部分。AI 不應該。

---

## `/document-release`

這是我的**技術作家模式**。

在 `/ship` 建立 PR 之後，但在合併之前，`/document-release` 會讀取專案中的每個文件檔案，並與 diff 進行交叉比對。它更新檔案路徑、指令列表、專案結構樹，以及任何其他出現偏差的內容。有風險或主觀的變更會作為問題提出——其他一切都自動處理。

```
You:   /document-release

Claude: Analyzing 21 files changed across 3 commits. Found 8 documentation files.

        README.md: updated skill count from 9 to 10, added new skill to table
        CLAUDE.md: added new directory to project structure
        CONTRIBUTING.md: current — no changes needed
        TODOS.md: marked 2 items complete, added 1 new item

        All docs updated and committed. PR body updated with doc diff.
```

它也會潤色 CHANGELOG 的語氣（從不覆寫現有條目）、清理已完成的 TODOS、檢查跨文件一致性，並在適當時詢問 VERSION 升版的問題。

---

## `/retro`

這是我的**工程經理模式**。

在週末我想知道實際發生了什麼。不是感覺——是資料。`/retro` 分析提交歷史、工作模式和出貨速度，並撰寫一份坦誠的回顧。

它具有團隊意識。它識別執行指令的人，對你自己的工作給予最深入的處理，然後對每位貢獻者進行具體的讚美和成長機會分析。它計算提交數、程式碼行數、測試比率、PR 大小和修復比率等指標。它從提交時間戳記偵測撰碼 session，找出熱點檔案，追蹤出貨連勝，並識別當週最大的出貨。

它也追蹤測試健康狀況：測試檔案總數、本期新增的測試、回歸測試提交以及趨勢增減。如果測試比率低於 20%，它會標記為成長領域。

### 範例

```
You:   /retro

Claude: Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d

        ## Your Week
        32 commits, +2.4k LOC, 41% tests. Peak hours: 9-11pm.
        Biggest ship: cookie import system (browser decryption + picker UI).
        What you did well: shipped a complete feature with encryption, UI, and
        18 unit tests in one focused push...

        ## Team Breakdown

        ### Alice
        12 commits focused on app/services/. Every PR under 200 LOC — disciplined.
        Opportunity: test ratio at 12% — worth investing before payment gets more complex.

        ### Bob
        3 commits — fixed the N+1 query on dashboard. Small but high-impact.
        Opportunity: only 1 active day this week — check if blocked on anything.

        [Top 3 team wins, 3 things to improve, 3 habits for next week]
```

它會將 JSON 快照儲存到 `.context/retros/`，讓下次執行時能顯示趨勢。

---

## `/browse`

這是我的 **QA 工程師模式**。

`/browse` 是閉合迴圈的技能。在它出現之前，AI 代理能思考和撰寫程式碼，但仍是半盲的。它必須猜測 UI 狀態、身份驗證流程、重定向、主控台錯誤、空白狀態和破損版面。現在它可以直接去看。

它是一個與持久化 Chromium 常駐程式通訊的編譯二進位——建立在 Microsoft 的 [Playwright](https://playwright.dev/) 之上。第一次呼叫啟動瀏覽器（約 3 秒）。之後每次呼叫：約 100-200ms。瀏覽器在指令之間保持運行，因此 cookies、分頁和 localStorage 會延續。

### 範例

```
You:   /browse staging.myapp.com — log in, test the signup flow, and check
       every page I changed in this branch

Claude: [18 tool calls, ~60 seconds]

        > browse goto https://staging.myapp.com/signup
        > browse snapshot -i
        > browse fill @e2 "test@example.com"
        > browse fill @e3 "password123"
        > browse click @e5                    (Submit)
        > browse screenshot /tmp/signup.png
        > Read /tmp/signup.png

        Signup works. Redirected to onboarding. Now checking changed pages.

        > browse goto https://staging.myapp.com/dashboard
        > browse screenshot /tmp/dashboard.png
        > Read /tmp/dashboard.png
        > browse console

        Dashboard loads. No console errors. Charts render with sample data.

        All 4 pages load correctly. No console errors. No broken layouts.
        Signup → onboarding → dashboard flow works end to end.
```

18 個工具呼叫，約一分鐘。完整的 QA 通過。沒有開啟瀏覽器。

### 瀏覽器交接

當無頭瀏覽器卡住時——CAPTCHA、MFA、複雜的身份驗證——交接給使用者：

```
Claude: I'm stuck on a CAPTCHA at the login page. Opening a visible
        Chrome so you can solve it.

        > browse handoff "Stuck on CAPTCHA at login page"

        Chrome opened at https://app.example.com/login with all your
        cookies and tabs intact. Solve the CAPTCHA and tell me when
        you're done.

You:    done

Claude: > browse resume

        Got a fresh snapshot. Logged in successfully. Continuing QA.
```

瀏覽器在交接過程中保留所有狀態（cookies、localStorage、分頁）。`resume` 之後，AI 代理會獲得你離開位置的最新快照。如果 browse 工具連續失敗 3 次，它會自動建議使用 `handoff`。

**安全注意事項：** `/browse` 執行一個持久化的 Chromium session。Cookies、localStorage 和 session 狀態在指令之間會延續。除非你有意這樣做，否則不要針對敏感的生產環境使用它——它是一個有真實狀態的真實瀏覽器。Session 在閒置 30 分鐘後自動關閉。

完整的指令參考，請參見 [BROWSER.md](../BROWSER.md)。

---

## `/setup-browser-cookies`

這是我的 **Session 管理員模式**。

在 `/qa` 或 `/browse` 能測試需要登入的頁面之前，它們需要 cookies。`/setup-browser-cookies` 不需要每次都透過無頭瀏覽器手動登入，而是直接從你的日常瀏覽器匯入你的真實 session。

它自動偵測已安裝的 Chromium 瀏覽器（Comet、Chrome、Arc、Brave、Edge），透過 macOS Keychain 解密 cookies，並將它們載入 Playwright session。互動式選擇器 UI 讓你精確選擇要匯入哪些網域——cookie 值永遠不會顯示。

```
You:   /setup-browser-cookies

Claude: Cookie picker opened — select the domains you want to import
        in your browser, then tell me when you're done.

        [You pick github.com, myapp.com in the browser UI]

You:    done

Claude: Imported 2 domains (47 cookies). Session is ready.
```

或完全跳過 UI：

```
You:   /setup-browser-cookies github.com

Claude: Imported 12 cookies for github.com from Comet.
```

---

## `/codex`

這是我的**第二意見模式**。

當 `/review` 從 Claude 的角度捕捉 bug 時，`/codex` 帶來一個完全不同的 AI——OpenAI 的 Codex CLI——來審查同一個 diff。不同的訓練、不同的盲點、不同的優勢。兩者的重疊告訴你什麼肯定是真實的。每個獨有的發現是你找到任何一方單獨都抓不到的 bug 的地方。

### 三種模式

**審查**——對當前 diff 執行 `codex review`。Codex 讀取每個變更的檔案，按嚴重程度分類發現（P1 嚴重、P2 高、P3 中），並返回 PASS/FAIL 判決。任何 P1 發現 = FAIL。審查完全獨立——Codex 看不到 Claude 的審查。

**挑戰**——對抗模式。Codex 主動嘗試破壞你的程式碼。它尋找邊緣情況、競爭條件、安全漏洞，以及在負載下會失敗的假設。使用最大推理力度（`xhigh`）。把它想成是對你的邏輯進行滲透測試。

**諮詢**——具有 session 連續性的開放對話。詢問 Codex 任何關於程式碼庫的問題。後續問題重用同一個 session，因此上下文會延續。非常適合「我這樣想是對的嗎？」的時刻。

### 跨模型分析

當 `/review`（Claude）和 `/codex`（OpenAI）都審查了同一個分支後，你會得到一個跨模型比較：哪些發現重疊（高信心度）、哪些是 Codex 獨有的（不同視角），以及哪些是 Claude 獨有的。這是對程式碼審查採取「兩位醫生，同一個病患」的方法。

```
You:   /codex review

Claude: Running independent Codex review...

        CODEX REVIEW: PASS (3 findings)
        [P2] Race condition in payment handler — concurrent charges
             can double-debit without advisory lock
        [P3] Missing null check on user.email before downcase
        [P3] Token comparison not using constant-time compare

        Cross-model analysis (vs /review):
        OVERLAP: Race condition in payment handler (both caught it)
        UNIQUE TO CODEX: Token comparison timing attack
        UNIQUE TO CLAUDE: N+1 query in listing photos
```

---

## 安全性與護欄

四個技能，為任何 Claude Code session 添加安全護欄。它們透過 Claude Code 的 PreToolUse hooks 運作——透明、session 範疇、無需配置檔案。

### `/careful`

當你在生產環境附近工作、執行破壞性指令，或只是想要一個安全網時，說「be careful」或執行 `/careful`。每個 Bash 指令都會根據已知的危險模式進行檢查：

- `rm -rf` / `rm -r`——遞迴刪除
- `DROP TABLE` / `DROP DATABASE` / `TRUNCATE`——資料遺失
- `git push --force` / `git push -f`——歷史覆寫
- `git reset --hard`——丟棄提交
- `git checkout .` / `git restore .`——丟棄未提交的工作
- `kubectl delete`——生產資源刪除
- `docker rm -f` / `docker system prune`——容器/映像遺失

常見的建置工件清理（`rm -rf node_modules`、`dist`、`.next`、`__pycache__`、`build`、`coverage`）已列入白名單——日常操作不會有誤報。

你可以覆蓋任何警告。護欄是防止意外，而非存取控制。

### `/freeze`

將所有檔案編輯限制在單一目錄內。當你在除錯帳單 bug 時，你不希望 Claude 意外地「修復」`src/auth/` 中不相關的程式碼。`/freeze src/billing` 阻止所有在該路徑外的 Edit 和 Write 操作。

`/investigate` 會自動啟動這個功能——它偵測被除錯的模組，並將編輯凍結在那個目錄。

```
You:   /freeze src/billing

Claude: Edits restricted to src/billing/. Run /unfreeze to remove.

        [Later, Claude tries to edit src/auth/middleware.ts]

Claude: BLOCKED — Edit outside freeze boundary (src/billing/).
        Skipping this change.
```

注意：這只阻止 Edit 和 Write 工具。像 `sed` 這樣的 Bash 指令仍然可以修改邊界外的檔案——這是防止意外，而非安全沙箱。

### `/guard`

完整安全模式——一個指令結合 `/careful` + `/freeze`。破壞性指令警告加上目錄範疇的編輯。在接觸生產環境或除錯線上系統時使用。

### `/unfreeze`

移除 `/freeze` 邊界，再次允許在任何地方進行編輯。hooks 在 session 中保持已登錄狀態——它們只是允許一切。重新執行 `/freeze` 以設定新的邊界。

---

## `/gstack-upgrade`

一個指令讓 gstack 保持最新。它偵測你的安裝類型（全域在 `~/.claude/skills/gstack` 還是 vendored 在你的專案的 `.claude/skills/gstack`），執行升級，如果你有雙重安裝則同步兩者，並顯示變更內容。

```
You:   /gstack-upgrade

Claude: Current version: 0.7.4
        Latest version: 0.8.2

        What's new:
        - Browse handoff for CAPTCHAs and auth walls
        - /codex multi-AI second opinion
        - /qa always uses browser now
        - Safety skills: /careful, /freeze, /guard
        - Proactive skill suggestions

        Upgraded to 0.8.2. Both global and project installs synced.
```

在 `~/.gstack/config.yaml` 中設定 `auto_upgrade: true` 可完全跳過提示——當新版本可用時，gstack 會在每個 session 開始時靜默升級。

---

## Greptile 整合

[Greptile](https://greptile.com) 是一家 YC 公司，能自動審查你的 PR。它捕捉真實的 bug——競爭條件、安全問題、通過 CI 卻在生產環境爆炸的事情。它確實不只一次救了我。我很喜歡這些人。

### 設定

在 [greptile.com](https://greptile.com) 將 Greptile 安裝到你的 GitHub repo——大約需要 30 秒。一旦它在審查你的 PR，gstack 會自動取用它的評論。無需額外配置。

### 運作方式

任何自動化審查工具的問題在於分類。Greptile 很好，但不是每條評論都是真實問題。有些是誤報。有些標記了你三個提交前就已經修復的事情。沒有分類層，評論會堆積如山，你開始忽視它們——這違背了目的。

gstack 解決了這個問題。`/review` 和 `/ship` 現在具有 Greptile 意識。它們讀取 Greptile 的評論，分類每一條，並採取行動：

- **有效問題**被加入嚴重發現清單，並在出貨前修復
- **已修復的問題**得到自動回覆，確認捕捉到了
- **誤報**被推回——你確認，然後一個解釋原因的回覆發出去

結果是兩層審查：Greptile 在 PR 上非同步捕捉問題，然後 `/review` 和 `/ship` 將這些發現作為正常工作流程的一部分進行分類。沒有任何東西會漏網。

### 從歷史中學習

你確認的每個誤報都會儲存到 `~/.gstack/greptile-history.md`。未來的執行會自動跳過你程式碼庫的已知誤報模式。`/retro` 也會追蹤 Greptile 隨時間的命中率——讓你能看到信噪比是否在改善。

### 範例

```
You:   /ship

Claude: [syncs main, runs tests, pre-landing review...]

        Greptile found 3 comments on this PR:

        [VALID] app/services/payment_service.rb:47 — Race condition:
        concurrent charges can double-debit. Recommend DB-level advisory
        lock around the charge block.

        [ALREADY FIXED] app/models/user.rb:12 — Missing null check
        on email before downcase.
        → Already fixed in commit abc1234. Auto-replying.

        [FALSE POSITIVE] lib/auth.rb:88 — "Token comparison should
        use constant-time comparison." We already use
        ActiveSupport::SecurityUtils.secure_compare here.

        Fixing the race condition in payment_service.rb...

        The auth token comment is a false positive.
        Options: A) Reply to Greptile explaining  B) Fix anyway  C) Ignore

You:    A

Claude: Replied to Greptile. All tests pass.
        PR: github.com/you/app/pull/42
```

三條 Greptile 評論。一個真實修復。一個自動確認。一個誤報被推回並附上回覆。額外花費的總時間：約 30 秒。
