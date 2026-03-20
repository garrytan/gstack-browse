# 更新日誌

## [0.9.0] - 2026-03-19 — 支援 Codex、Gemini CLI 與 Cursor

**gstack 現在可在任何支援開放 SKILL.md 標準的 AI 代理上運作。** 只需安裝一次，即可從 Claude Code、OpenAI Codex CLI、Google Gemini CLI 或 Cursor 使用。全部 21 個技能已提供於 `.agents/skills/` — 只需執行 `./setup --host codex` 或 `./setup --host auto`，您的代理即可自動探索它們。

- **一次安裝，四種代理。** Claude Code 從 `.claude/skills/` 讀取，其他代理則從 `.agents/skills/` 讀取。相同的技能、相同的提示詞，針對每個主機進行調整。基於 Hook 的安全技能（careful、freeze、guard）改為使用內嵌安全建議文字而非 Hook — 可在所有環境中運作。
- **自動偵測。** `./setup --host auto` 會偵測您已安裝的代理並一併設定。已使用 Claude Code？它仍然完全照常運作。
- **Codex 最佳化輸出。** Frontmatter 精簡為僅包含名稱與描述（Codex 不需要 allowed-tools 或 hooks）。路徑從 `~/.claude/` 改寫為 `~/.codex/`。`/codex` 技能本身被排除在 Codex 輸出之外 — 它是 Claude 對 `codex exec` 的封裝，若納入將形成自我參照。
- **CI 同時檢查兩個主機。** 新鮮度檢查現在會獨立驗證 Claude 和 Codex 的輸出。Codex 文件過時會和 Claude 文件過時一樣使建置失敗。

## [0.8.6] - 2026-03-19

### 新增

- **您現在可以查看自己如何使用 gstack。** 執行 `gstack-analytics` 查看個人使用儀表板 — 最常使用哪些技能、花費多少時間、成功率如何。所有資料保留在您的本機上。
- **選擇加入的社群遙測。** 首次執行時，gstack 會詢問您是否願意分享匿名使用資料（技能名稱、持續時間、當機資訊 — 絕不包含程式碼或檔案路徑）。選擇「是」即成為社群脈動的一部分。隨時可透過 `gstack-config set telemetry off` 變更設定。
- **社群健康儀表板。** 執行 `gstack-community-dashboard` 查看 gstack 社群正在建構的內容 — 最熱門技能、當機叢集、版本分佈。全部由 Supabase 驅動。
- **透過更新檢查追蹤安裝基數。** 啟用遙測後，gstack 在更新檢查期間會並行發送一個 Ping 至 Supabase — 提供安裝基數統計而不增加任何延遲。遵守您的遙測設定（預設關閉）。GitHub 仍為主要版本來源。
- **當機叢集化。** 錯誤會在 Supabase 後端依類型和版本自動分組，讓影響最大的問題優先浮現。
- **升級漏斗追蹤。** 我們現在可以看到有多少人看到升級提示與實際升級的比例 — 幫助我們發布更好的版本。
- **/retro 現在顯示您的 gstack 使用情況。** 每週回顧報告包含技能使用統計（使用了哪些技能、使用頻率、成功率），與您的提交記錄並列呈現。
- **工作階段專屬的待處理標記。** 若技能在執行中途當機，下次啟動時只會正確結束該工作階段 — 不再出現並發 gstack 工作階段之間的競態條件。

## [0.8.5] - 2026-03-19

### 修復

- **`/retro` 現在計算完整的日曆天數。** 在深夜執行回顧不再靜默遺漏當天早些時候的提交。Git 將裸日期（如 `--since="2026-03-11"`）在晚上 11 點執行時視為「3 月 11 日晚上 11 點」 — 現在我們改用 `--since="2026-03-11T00:00:00"`，確保始終從午夜開始計算。比較模式的時間窗口也獲得相同修復。
- **Review log 不再因帶有 `/` 的分支名稱而中斷。** 像 `garrytan/design-system` 這樣的分支名稱會導致 review log 寫入失敗，因為 Claude Code 將多行 bash 區塊作為獨立的 shell 呼叫執行，在命令之間遺失變數。新的 `gstack-review-log` 和 `gstack-review-read` 原子性輔助工具將整個操作封裝在單一命令中。
- **所有技能模板現在都是平台無關的。** 從 `/ship`、`/review`、`/plan-ceo-review` 和 `/plan-eng-review` 中移除 Rails 特定的模式（`bin/test-lane`、`RAILS_ENV`、`.includes()`、`rescue StandardError` 等）。Review 清單現在並排顯示 Rails、Node、Python 和 Django 的範例。
- **`/ship` 讀取 CLAUDE.md 來探索測試命令**，而不是硬編碼 `bin/test-lane` 和 `npm run test`。若找不到測試命令，會詢問使用者並將答案儲存到 CLAUDE.md。

### 新增

- **平台無關設計原則**已在 CLAUDE.md 中明文規定 — 技能必須讀取專案設定，絕不能硬編碼框架命令。
- **`## Testing` 章節**已加入 CLAUDE.md，供 `/ship` 測試命令探索使用。

## [0.8.4] - 2026-03-19

### 新增

- **`/ship` 現在自動同步您的文件。** 建立 PR 後，`/ship` 在步驟 8.5 執行 `/document-release` — README、ARCHITECTURE、CONTRIBUTING 和 CLAUDE.md 全部保持最新，無需額外命令。出貨後不再有過時的文件。
- **文件中新增六個技能。** README、docs/skills.md 和 BROWSER.md 現在涵蓋 `/codex`（多 AI 第二意見）、`/careful`（破壞性命令警告）、`/freeze`（目錄範圍編輯鎖定）、`/guard`（完整安全模式）、`/unfreeze` 和 `/gstack-upgrade`。衝刺技能表保留其 15 個專業工具；新的「Power tools」章節涵蓋其餘工具。
- **瀏覽器交接已記錄在各處。** BROWSER.md 命令表、docs/skills.md 深度說明以及 README「新功能」均說明 `$B handoff` 和 `$B resume` 在面對 CAPTCHA/MFA/認證牆時的用法。
- **主動建議功能了解所有技能。** 根層 SKILL.md.tmpl 現在在適當的工作流程階段建議 `/codex`、`/careful`、`/freeze`、`/guard`、`/unfreeze` 和 `/gstack-upgrade`。

## [0.8.3] - 2026-03-19

### 新增

- **計劃審查現在引導您進行下一步。** 執行 `/plan-ceo-review`、`/plan-eng-review` 或 `/plan-design-review` 後，您會獲得下一步操作的建議 — 始終建議將工程審查作為必要的出貨關卡，當偵測到 UI 變更時建議設計審查，大型產品變更則輕度提示 CEO 審查。不再需要自己記住工作流程。
- **審查功能現在知道自己是否過時。** 每次審查現在都會記錄執行時的提交。儀表板將其與您目前的 HEAD 比較，並精確告知已過了多少次提交 — 「工程審查可能已過時 — 自審查以來已有 13 次提交」，而非靠猜測。
- **`skip_eng_review` 在所有地方都得到尊重。** 若您已全域選擇退出工程審查，串鏈建議不會再因此打擾您。
- **簡易設計審查現在也追蹤提交。** 在 `/review` 和 `/ship` 中執行的輕量設計檢查獲得與完整審查相同的過時追蹤功能。

### 修復

- **瀏覽器不再導航至危險的 URL。** `goto`、`diff` 和 `newtab` 現在封鎖 `file://`、`javascript:`、`data:` 協定和雲端中繼資料端點（`169.254.169.254`、`metadata.google.internal`）。本機 QA 測試仍允許 localhost 和私有 IP。（修復 #17）
- **Setup 腳本現在告知缺少什麼。** 未安裝 `bun` 就執行 `./setup` 現在會顯示清晰的錯誤訊息與安裝說明，而非令人費解的「command not found」。（修復 #147）
- **`/debug` 更名為 `/investigate`。** Claude Code 有內建的 `/debug` 命令遮蔽了 gstack 技能。系統性根因除錯工作流程現在位於 `/investigate`。（修復 #190）
- **移除 Shell 注入攻擊面。** 所有技能模板現在使用 `source <(gstack-slug)` 而非 `eval $(gstack-slug)`。行為相同，沒有 `eval`。（修復 #133）
- **25 個新安全測試。** URL 驗證（16 個測試）和路徑遍歷驗證（14 個測試）現在有專用的單元測試套件，涵蓋協定封鎖、中繼資料 IP 封鎖、目錄逃脫和前綴衝突邊緣情況。

## [0.8.2] - 2026-03-19

### 新增

- **當無頭瀏覽器卡住時，交接給真實的 Chrome。** 遇到 CAPTCHA、認證牆或 MFA 提示？執行 `$B handoff "reason"`，一個可見的 Chrome 視窗會在完全相同的頁面開啟，並保留所有 Cookie 和分頁。解決問題後，告訴 Claude 您已完成，`$B resume` 會從您離開的地方繼續，並提供全新的快照。
- **連續 3 次失敗後自動提示交接。** 若瀏覽工具連續失敗 3 次，它會建議使用 `handoff` — 讓您不必浪費時間看著 AI 重試 CAPTCHA。
- **15 個針對交接功能的新測試。** 涵蓋狀態儲存/還原的單元測試、邊緣情況，以及完整的無頭到有頭流程（含 Cookie 和分頁保存）的整合測試。

### 變更

- `recreateContext()` 重構為使用共享的 `saveState()`/`restoreState()` 輔助函式 — 行為相同，程式碼更少，為未來的狀態持久化功能做好準備。
- `browser.close()` 現在有 5 秒逾時，防止在 macOS 上關閉有頭瀏覽器時發生掛起。

## [0.8.1] - 2026-03-19

### 修復

- **`/qa` 不再拒絕在僅後端變更時使用瀏覽器。** 以前，若您的分支只更改了提示詞模板、設定檔案或服務邏輯，`/qa` 會分析 diff，得出「沒有 UI 需要測試」的結論，並建議改跑 eval。現在它始終打開瀏覽器 — 當從 diff 中無法識別特定頁面時，退而採用快速模式煙霧測試（首頁 + 前 5 個導航目標）。

## [0.8.0] - 2026-03-19 — 多 AI 第二意見

**`/codex` — 從完全不同的 AI 獲取獨立的第二意見。**

三種模式。`/codex review` 對您的 diff 執行 OpenAI 的 Codex CLI 並給出通過/失敗判定 — 若 Codex 發現嚴重問題（`[P1]`），則失敗。`/codex challenge` 採取對抗性方式：它試圖找出您的程式碼在生產環境中失敗的方式，像攻擊者和混沌工程師那樣思考。`/codex <anything>` 與 Codex 開啟關於您程式碼庫的對話，工作階段連續性讓後續問題能記住上下文。

當 `/review`（Claude）和 `/codex review` 都執行後，您會獲得跨模型分析，顯示哪些發現重疊、哪些是各 AI 獨有的 — 培養您對何時信任哪個系統的直覺。

**整合至各處。** `/review` 完成後，它提供 Codex 第二意見。在 `/ship` 期間，您可以在推送前執行 Codex 審查作為可選關卡。在 `/plan-eng-review` 中，Codex 可以在工程審查開始前獨立批評您的計劃。所有 Codex 結果都顯示在 Review Readiness Dashboard 中。

**此版本同時新增：** 主動技能建議 — gstack 現在會注意您所在的開發階段並建議正確的技能。不喜歡？說「stop suggesting」，它會跨工作階段記住。

## [0.7.4] - 2026-03-18

### 變更

- **`/qa` 和 `/design-review` 現在詢問如何處理未提交的變更**，而不是拒絕啟動。當您的工作目錄有未提交內容時，您會獲得三個互動選項：提交變更、暫存或中止。不再有神秘的「ERROR: Working tree is dirty」後跟著大量說明文字。

## [0.7.3] - 2026-03-18

### 新增

- **一個命令即可開啟安全防護措施。** 說「be careful」或「safety mode」，`/careful` 就會在任何破壞性命令前警告您 — `rm -rf`、`DROP TABLE`、force-push、`kubectl delete` 等。您可以覆蓋每個警告。常見的建構產物清理（`rm -rf node_modules`、`dist`、`.next`）已列入白名單。
- **用 `/freeze` 將編輯鎖定在一個資料夾。** 正在除錯但不想讓 Claude「修復」無關的程式碼？`/freeze` 封鎖您選擇目錄之外的所有檔案編輯。是硬性封鎖，不只是警告。執行 `/unfreeze` 即可移除限制而無需結束工作階段。
- **`/guard` 一次啟動兩者。** 當接觸生產環境或即時系統時，一個命令提供最大安全保障 — 破壞性命令警告加上目錄範圍編輯限制。
- **`/debug` 現在自動凍結正在除錯模組的編輯。** 形成根因假設後，`/debug` 將編輯鎖定在受影響的最窄目錄。除錯期間不再意外「修復」無關的程式碼。
- **您現在可以查看使用哪些技能及使用頻率。** 每次技能調用都在本機記錄至 `~/.gstack/analytics/skill-usage.jsonl`。執行 `bun run analytics` 查看您的頂級技能、各專案分類，以及安全 Hook 實際攔截的頻率。資料保留在您的機器上。
- **每週回顧現在包含技能使用情況。** `/retro` 在回顧時間窗口內顯示您使用的技能，與您平常的提交分析和指標並排呈現。

## [0.7.2] - 2026-03-18

### 修復

- `/retro` 日期範圍現在對齊午夜而非當前時間。下午 9 點執行 `/retro` 不再靜默遺漏開始日期的上午時段 — 您獲得完整的日曆天。
- `/retro` 時間戳記現在使用您的本地時區而非硬編碼的太平洋時間。美西海岸以外的用戶在直方圖、工作階段偵測和連續記錄中可獲得正確的本地時間。

## [0.7.1] - 2026-03-19

### 新增

- **gstack 現在在自然時機建議技能。** 您不需要知道斜線命令 — 只需談論您在做什麼。腦力激盪一個想法？gstack 建議 `/office-hours`。有東西壞了？它建議 `/debug`。準備部署？它建議 `/ship`。每個工作流程技能現在都有主動觸發器，在時機成熟時啟動。
- **生命週期地圖。** gstack 的根技能描述現在包含一個開發者工作流程指南，將 12 個階段（腦力激盪 → 計劃 → 審查 → 程式碼 → 除錯 → 測試 → 出貨 → 文件 → 回顧）對應到正確的技能。Claude 在每次工作階段中都能看到這個。
- **用自然語言退出。** 若主動建議感覺太積極，只需說「stop suggesting things」 — gstack 跨工作階段記住。說「be proactive again」重新啟用。
- **11 個旅程階段 E2E 測試。** 每個測試模擬開發者生命週期中的真實時刻，包含實際的專案上下文（plan.md、錯誤日誌、git 歷史、程式碼），並驗證正確的技能僅從自然語言就能觸發。11/11 通過。
- **觸發短語驗證。** 靜態測試驗證每個工作流程技能都有「Use when」和「Proactively suggest」短語 — 免費攔截退化。

### 修復

- `/debug` 和 `/office-hours` 對自然語言完全不可見 — 根本沒有觸發短語。現在兩者都有完整的被動 + 主動觸發器。

## [0.7.0] - 2026-03-18 — YC Office Hours

**`/office-hours` — 在寫第一行程式碼之前，與 YC 合夥人坐下來談。**

兩種模式。若您在建立新創公司，您會獲得六個從 YC 評估產品方式提煉出的強制性問題：需求現實、現狀、迫切的具體性、最窄的切入點、觀察與驚喜，以及未來適配性。若您在黑客馬拉松、學習寫程式或開發副業專案，您會獲得一個熱情的腦力激盪夥伴，幫助您找到想法最酷的版本。

兩種模式都會撰寫一份設計文件，直接供 `/plan-ceo-review` 和 `/plan-eng-review` 使用。工作階段結束後，技能會反映它對您思考方式的觀察 — 具體的觀察，而非泛泛的稱讚。

**`/debug` — 找到根本原因，而非症狀。**

當有東西壞了而您不知道原因時，`/debug` 是您的系統性除錯工具。它遵循鐵律：在根因調查之前不進行修復。追蹤資料流，與已知的錯誤模式（競態條件、nil 傳播、過時快取、設定漂移）比對，並逐一測試假設。若 3 次修復失敗，它會停下來質疑架構，而不是繼續嘗試。

## [0.6.4.1] - 2026-03-18

### 新增

- **技能現在可透過自然語言探索。** 所有 12 個缺少明確觸發短語的技能現在都已補充 — 說「deploy this」Claude 就能找到 `/ship`，說「check my diff」它就能找到 `/review`。遵循 Anthropic 的最佳實踐：「description 欄位不是摘要 — 而是觸發時機。」

## [0.6.4.0] - 2026-03-17

### 新增

- **`/plan-design-review` 現在是互動式的 — 評分 0-10，並修復計劃。** 設計師不再產生帶有字母評級的報告，而是像 CEO 和工程審查一樣運作：對每個設計維度評分 0-10，說明 10 分是什麼樣子，然後編輯計劃以達到該分數。每個設計選擇一個 AskUserQuestion。輸出是一個更好的計劃，而不是關於計劃的文件。
- **CEO 審查現在會召喚設計師。** 當 `/plan-ceo-review` 在計劃中偵測到 UI 範疇時，它會啟動設計與 UX 章節（第 11 節），涵蓋資訊架構、互動狀態覆蓋率、AI 陳腔濫調風險和響應式設計意圖。對於深度設計工作，它建議使用 `/plan-design-review`。
- **15 個技能中有 14 個現在有完整測試覆蓋率（E2E + LLM 評判 + 驗證）。** 為 10 個缺少它們的技能新增了 LLM 評判品質評估：ship、retro、qa-only、plan-ceo-review、plan-eng-review、plan-design-review、design-review、design-consultation、document-release、gstack-upgrade。為 gstack-upgrade 新增了真實的 E2E 測試（原為 `.todo`）。將 design-consultation 加入命令驗證。
- **Bisect 提交風格。** CLAUDE.md 現在要求每次提交都是單一邏輯變更 — 重新命名與改寫分開，測試基礎設施與測試實作分開。

### 變更

- `/qa-design-review` 重命名為 `/design-review` — 「qa-」前綴在 `/plan-design-review` 是計劃模式的情況下令人困惑。已在所有 22 個檔案中更新。

## [0.6.3.0] - 2026-03-17

### 新增

- **每個觸及前端程式碼的 PR 現在都自動獲得設計審查。** `/review` 和 `/ship` 針對已變更的 CSS、HTML、JSX 和視圖檔案應用 20 項設計清單。攔截 AI 陳腔濫調模式（紫色漸層、三欄圖示網格、泛泛的 hero 文案）、排版問題（body 文字 < 16px、黑名單字型）、無障礙設計缺口（`outline: none`）和 `!important` 濫用。機械性 CSS 修復自動應用；設計判斷呼叫會先詢問您。
- **`gstack-diff-scope` 分類您分支中的變更內容。** 執行 `source <(gstack-diff-scope main)` 並獲得 `SCOPE_FRONTEND=true/false`、`SCOPE_BACKEND`、`SCOPE_PROMPTS`、`SCOPE_TESTS`、`SCOPE_DOCS`、`SCOPE_CONFIG`。設計審查使用它在後端專屬 PR 上靜默跳過。出貨前檢查使用它在觸及前端檔案時建議設計審查。
- **設計審查顯示在 Review Readiness Dashboard 中。** 儀表板現在區分「LITE」（程式碼層級，在 /review 和 /ship 中自動執行）和「FULL」（透過 /plan-design-review 與 browse binary 的視覺審核）。兩者都以設計審查條目顯示。
- **設計審查偵測的 E2E eval。** 包含 7 個已知反模式的 CSS/HTML 測試固件（Papyrus 字型、14px body 文字、`outline: none`、`!important`、紫色漸層、泛泛的 hero 文案、三欄功能網格）。eval 驗證 `/review` 至少攔截 7 個中的 4 個。

## [0.6.2.0] - 2026-03-17

### 新增

- **計劃審查現在像世界頂尖人士那樣思考。** `/plan-ceo-review` 應用來自 Bezos（單行道門、第一天代理人懷疑論）、Grove（偏執掃描）、Munger（反轉）、Horowitz（戰時意識）、Chesky/Graham（創辦人模式）和 Altman（槓桿迷戀）的 14 種認知模式。`/plan-eng-review` 應用來自 Larson（團隊狀態診斷）、McKinley（預設無趣）、Brooks（本質 vs 偶然複雜性）、Beck（讓變更變得容易）、Majors（在生產中擁有您的程式碼）和 Google SRE（錯誤預算）的 15 種模式。`/plan-design-review` 應用來自 Rams（減法預設）、Norman（時間跨度設計）、Zhuo（有原則的品味）、Gebbia（為信任而設計、故事板旅程）和 Ive（關懷是可見的）的 12 種模式。
- **潛在空間啟動，而非清單。** 認知模式透過提及框架和人物，讓 LLM 能汲取其對他們實際思維方式的深刻知識。指令是「內化這些，不要列舉它們」— 使每次審查都成為真正的視角轉換，而非更長的清單。

## [0.6.1.0] - 2026-03-17

### 新增

- **E2E 和 LLM 評判測試現在只執行您變更的部分。** 每個測試聲明其依賴的來源檔案。當您執行 `bun run test:e2e` 時，它會檢查您的 diff 並跳過依賴項未被觸及的測試。只更改 `/retro` 的分支現在執行 2 個測試而非 31 個。使用 `bun run test:e2e:all` 強制執行所有測試。
- **`bun run eval:select` 預覽哪些測試會執行。** 在花費 API 額度之前，查看您的 diff 會觸發哪些測試。支援 `--json` 進行腳本編寫，以及 `--base <branch>` 覆蓋基礎分支。
- **完整性防護措施攔截遺忘的測試條目。** 一個免費的單元測試驗證 E2E 和 LLM 評判測試檔案中的每個 `testName` 在 TOUCHFILES 映射中都有對應條目。沒有條目的新測試立即使 `bun test` 失敗 — 沒有靜默的始終執行退化。

### 變更

- `test:evals` 和 `test:e2e` 現在根據 diff 自動選擇（原為：全部或全不）
- 新增 `test:evals:all` 和 `test:e2e:all` 腳本以明確執行完整測試

## 0.6.1 — 2026-03-17 — 煮沸整個湖

每個 gstack 技能現在都遵循**完整性原則**：當 AI 使邊際成本接近零時，始終建議完整實作。當選項 A 只多 70 行程式碼時，不再建議「選 B，因為它有 90% 的價值」。

閱讀哲學理念：https://garryslist.org/posts/boil-the-ocean

- **完整性評分**：每個 AskUserQuestion 選項現在顯示完整性評分（1-10），偏向完整解決方案
- **雙時間估算**：工作量估算同時顯示人類團隊和 CC+gstack 時間（例如：「人類：約 2 週 / CC：約 1 小時」），附帶任務類型壓縮參考表
- **反模式範例**：前言中具體的「不要這樣做」示例庫，使原則不再抽象
- **首次使用者導覽**：新用戶看到一次性介紹，連結到文章，可選擇在瀏覽器中開啟
- **審查完整性缺口**：`/review` 現在標記捷徑實作，其中完整版本的 CC 時間成本不到 30 分鐘
- **Lake Score**：CEO 和工程審查完成摘要顯示有多少建議選擇了完整選項 vs 捷徑
- **CEO + 工程審查雙重時間**：時間審訊、工作量估算和令人愉悅的機會均顯示人類和 CC 兩種時間尺度

## 0.6.0.1 — 2026-03-17

- **`/gstack-upgrade` 現在自動攔截過時的供應商副本。** 若您的全域 gstack 是最新的，但專案中的供應商副本已落後，`/gstack-upgrade` 會偵測不一致並同步。不再需要手動詢問「我們有供應商化嗎？」— 它直接告訴您並提供更新。
- **升級同步更安全。** 若在同步供應商副本時 `./setup` 失敗，gstack 會從備份還原之前的版本，而不是留下損壞的安裝。

### 貢獻者須知

- `gstack-upgrade/SKILL.md.tmpl` 中的獨立使用章節現在參照步驟 2 和 4.5（DRY），而非複製偵測/同步 bash 區塊。新增了一個版本比較 bash 區塊。
- 獨立模式中的更新檢查回退現在與前言模式（全域路徑 → 本地路徑 → `|| true`）匹配。

## 0.6.0 — 2026-03-17

- **100% 測試覆蓋率是優質 vibe coding 的關鍵。** gstack 現在在您的專案沒有測試框架時從頭建立。偵測您的執行環境、研究最佳框架、請您選擇、安裝它、為您的實際程式碼撰寫 3-5 個真實測試、設定 CI/CD（GitHub Actions）、建立 TESTING.md，並在 CLAUDE.md 中加入測試文化指令。之後每個 Claude Code 工作階段都會自然地撰寫測試。
- **每個錯誤修復現在都獲得一個迴歸測試。** 當 `/qa` 修復一個錯誤並驗證後，步驟 8e.5 自動產生一個捕獲確切損壞場景的迴歸測試。測試包含完整的追蹤歸因，連結回 QA 報告。自動遞增的檔案名稱防止工作階段間的衝突。
- **有信心地出貨 — 覆蓋率審計顯示什麼已測試、什麼未測試。** `/ship` 步驟 3.4 從您的 diff 建立程式碼路徑映射，搜尋對應的測試，並產生帶有品質星級的 ASCII 覆蓋率圖（★★★ = 邊緣情況 + 錯誤，★★ = 快樂路徑，★ = 煙霧測試）。缺口自動產生測試。PR 說明顯示「Tests: 42 → 47 (+5 new)」。
- **您的回顧追蹤測試健康狀況。** `/retro` 現在顯示測試檔案總數、本期新增的測試、迴歸測試提交和趨勢差異。若測試比例降至 20% 以下，它將其標記為成長領域。
- **設計審查也產生迴歸測試。** `/qa-design-review` 步驟 8e.5 跳過僅 CSS 的修復（這些由重新執行設計審計捕獲），但為 JavaScript 行為變更（如損壞的下拉選單或動畫失敗）撰寫測試。

### 貢獻者須知

- 在 `gen-skill-docs.ts` 中新增 `generateTestBootstrap()` 解析器（約 155 行）。在 RESOLVERS 映射中註冊為 `{{TEST_BOOTSTRAP}}`。插入 qa、ship（步驟 2.5）和 qa-design-review 模板中。
- 步驟 8e.5 迴歸測試產生新增至 `qa/SKILL.md.tmpl`（46 行）和 `qa-design-review/SKILL.md.tmpl` 的 CSS 感知變體（12 行）。規則 13 修訂為允許建立新的測試檔案。
- 步驟 3.4 測試覆蓋率審計新增至 `ship/SKILL.md.tmpl`（88 行），附帶品質評分標準和 ASCII 圖表格式。
- 測試健康追蹤新增至 `retro/SKILL.md.tmpl`：3 個新的資料收集命令、指標列、敘述章節、JSON 結構描述欄位。
- `qa-only/SKILL.md.tmpl` 在未偵測到測試框架時獲得建議備注。
- `qa-report-template.md` 新增含延遲測試規格的迴歸測試章節。
- ARCHITECTURE.md 佔位符表格以 `{{TEST_BOOTSTRAP}}` 和 `{{REVIEW_DASHBOARD}}` 更新。
- WebSearch 新增至 qa、ship、qa-design-review 的 allowed-tools。
- 26 個新驗證測試，2 個新 E2E eval（bootstrap + 覆蓋率審計）。
- 2 個新 P3 TODO：非 GitHub 提供商的 CI/CD、自動升級弱測試。

## 0.5.4 — 2026-03-17

- **工程審查現在始終是完整審查。** `/plan-eng-review` 不再要求您在「大型變更」和「小型變更」模式之間選擇。每個計劃都獲得完整的互動式逐步審查（架構、程式碼品質、測試、效能）。只有當複雜度檢查實際觸發時才建議縮減範疇 — 而非作為固定的選單選項。
- **出貨停止在您回答後詢問審查事宜。** 當 `/ship` 詢問缺失的審查而您說「ship anyway」或「not relevant」時，該決定會為該分支儲存。不再在預登陸修復後重新執行 `/ship` 時被再次詢問。

### 貢獻者須知

- 從 `plan-eng-review/SKILL.md.tmpl` 中移除 SMALL_CHANGE / BIG_CHANGE / SCOPE_REDUCTION 選單。範疇縮減現在是主動性的（由複雜度檢查觸發），而非選單項目。
- 在 `ship/SKILL.md.tmpl` 中新增 review gate 覆蓋持久性 — 將 `ship-review-override` 條目寫入 `$BRANCH-reviews.jsonl`，讓後續 `/ship` 執行跳過該關卡。
- 更新 2 個 E2E 測試提示以符合新流程。

## 0.5.3 — 2026-03-17

- **您始終在掌控中 — 即使在大膽構想時。** `/plan-ceo-review` 現在將每個範疇擴展作為您選擇加入的個別決定呈現。EXPANSION 模式熱情地建議，但您對每個想法說是或否。不再有「代理瘋狂地添加了我沒有要求的 5 個功能」。
- **新模式：SELECTIVE EXPANSION。** 將您目前的範疇作為基準，但看看還有什麼可能。代理逐一提出擴展機會並給予中性建議 — 您挑選值得做的那些。非常適合在現有功能上迭代，您希望嚴格把關但也想被相鄰改進所吸引的情況。
- **您的 CEO 審查願景被儲存，而非遺失。** 擴展想法、挑選決定和 10 倍願景現在以結構化設計文件的形式持久保存至 `~/.gstack/projects/{repo}/ceo-plans/`。過時的計劃會自動歸檔。若某個願景特別出色，您可以將其推廣至您的專案中的 `docs/designs/` 供團隊參考。

- **更智慧的出貨關卡。** `/ship` 不再在 CEO 和設計審查不相關時煩擾您。工程審查是唯一必要的關卡（甚至可以用 `gstack-config set skip_eng_review true` 停用）。CEO 審查建議用於大型產品變更；設計審查用於 UI 工作。儀表板仍然顯示所有三個 — 只是不會因為可選項目而阻擋您。

### 貢獻者須知

- 在 `plan-ceo-review/SKILL.md.tmpl` 中新增 SELECTIVE EXPANSION 模式，包含挑選儀式、中性建議姿態和 HOLD SCOPE 基準。
- 改寫 EXPANSION 模式的步驟 0D，加入選擇加入儀式 — 將願景提煉為離散提案，每個作為 AskUserQuestion 呈現。
- 新增 CEO 計劃持久性（0D-POST 步驟）：帶有 YAML frontmatter 的結構化 Markdown（`status: ACTIVE/ARCHIVED/PROMOTED`）、範疇決定表、歸檔流程。
- 在 Review Log 後新增 `docs/designs` 推廣步驟。
- 模式快速參考表擴展為 4 欄。
- Review Readiness Dashboard：工程審查為必要（可透過 `skip_eng_review` 設定覆蓋），CEO/設計為可選，由代理判斷。
- 新測試：CEO 審查模式驗證（4 種模式、持久性、推廣）、SELECTIVE EXPANSION E2E 測試。

## 0.5.2 — 2026-03-17

- **您的設計顧問現在承擔創意風險。** `/design-consultation` 不只是提出安全、連貫的系統 — 它明確列出安全選擇（類別基準）與風險（您的產品如何脫穎而出）。您選擇要打破哪些規則。每個風險都附帶為何有效的理由和代價。
- **在選擇之前看清全貌。** 當您選擇研究時，代理會瀏覽您所在領域的真實網站並提供截圖和無障礙樹狀分析 — 而非僅靠網路搜尋結果。在做設計決定之前，您能看到外面有什麼。
- **預覽看起來像您產品的頁面。** 預覽頁面現在呈現逼真的產品模型 — 帶有側邊欄導航和資料表格的儀表板、帶有 hero 區段的行銷頁面、帶有表單的設定頁面 — 而非只是字型樣本和色板。

## 0.5.1 — 2026-03-17
- **出貨前掌握您的進度。** 每個 `/plan-ceo-review`、`/plan-eng-review` 和 `/plan-design-review` 現在都將結果記錄到審查追蹤器。每次審查結束時，您會看到一個**Review Readiness Dashboard**，顯示哪些審查已完成、何時執行，以及是否通過 — 附有清晰的「已準備好出貨」或「尚未準備好」判定。
- **`/ship` 在建立 PR 之前檢查您的審查。** 起飛前檢查現在讀取儀表板，並在審查缺失時詢問您是否要繼續。僅供參考 — 它不會阻擋您，但您會知道跳過了什麼。
- **少一件需要複製貼上的事。** SLUG 計算（那個用於從 git remote 計算 `owner-repo` 的神秘 sed pipeline）現在是一個共享的 `bin/gstack-slug` 輔助工具。所有 14 個跨模板的內嵌副本替換為 `source <(gstack-slug)`。如果格式改變，只需修復一處。
- **截圖現在在 QA 和瀏覽工作階段中可見。** 當 gstack 截圖時，它們現在以可點擊的圖片元素顯示在您的輸出中 — 不再有看不到的 `/tmp/browse-screenshot.png` 路徑。適用於 `/qa`、`/qa-only`、`/plan-design-review`、`/qa-design-review`、`/browse` 和 `/gstack`。

### 貢獻者須知

- 在 `gen-skill-docs.ts` 中新增 `{{REVIEW_DASHBOARD}}` 解析器 — 共享儀表板讀取器注入 4 個模板（3 個審查技能 + ship）。
- 新增 `bin/gstack-slug` 輔助工具（5 行 bash），附帶單元測試。輸出 `SLUG=` 和 `BRANCH=` 行，將 `/` 替換為 `-`。
- 新 TODO：智慧審查相關性偵測（P3）、`/merge` 技能用於審查門控的 PR 合併（P2）。

## 0.5.0 — 2026-03-16

- **您的網站剛剛獲得了設計審查。** `/plan-design-review` 打開您的網站，像資深產品設計師一樣審查它 — 排版、間距、層次結構、色彩、響應式、互動設計和 AI 陳腔濫調偵測。按類別獲得字母評級（A-F）、「Design Score」+「AI Slop Score」雙重標題，以及不拐彎抹角的結構化第一印象。
- **它也能修復發現的問題。** `/qa-design-review` 執行相同的設計師視角審計，然後在您的原始碼中以原子式 `style(design):` 提交和前後截圖迭代修復設計問題。預設 CSS 安全，附帶針對樣式變更調整的更嚴格自我調節啟發式。
- **了解您實際的設計系統。** 兩個技能都通過 JS 提取您即時網站的字型、顏色、標題比例和間距模式 — 然後提供將推斷的系統儲存為 `DESIGN.md` 基準的選項。終於知道您實際使用了多少字型。
- **AI 陳腔濫調偵測是標題指標。** 每份報告都以兩個分數開頭：設計分數和 AI 陳腔濫調分數。AI 陳腔濫調清單攔截 10 個最容易辨識的 AI 生成模式 — 三欄功能網格、紫色漸層、裝飾性 blob、表情符號項目符號、泛泛的 hero 文案。
- **設計迴歸追蹤。** 報告寫入 `design-baseline.json`。下次執行自動比較：各類別評級差異、新發現、已解決的發現。隨時間觀察您的設計分數提升。
- **80 項設計審計清單**，涵蓋 10 個類別：視覺層次結構、排版、色彩/對比度、間距/佈局、互動狀態、響應式、動態效果、內容/文案、AI 陳腔濫調和效能即設計。提煉自 Vercel 的 100+ 條規則、Anthropic 的前端設計技能和其他 6 個設計框架。

### 貢獻者須知

- 在 `gen-skill-docs.ts` 中新增 `{{DESIGN_METHODOLOGY}}` 解析器 — 共享設計審計方法論注入 `/plan-design-review` 和 `/qa-design-review` 兩個模板，遵循 `{{QA_METHODOLOGY}}` 模式。
- 將 `~/.gstack-dev/plans/` 新增為長期願景文件的本地計劃目錄（不納入版本控制）。CLAUDE.md 和 TODOS.md 已更新。
- 在 TODOS.md 中新增 `/setup-design-md`（P2），用於從頭開始互動式建立 DESIGN.md。

## 0.4.5 — 2026-03-16

- **Review 發現現在真正被修復，而不只是被列出。** `/review` 和 `/ship` 以前會印出資訊性發現（死程式碼、測試缺口、N+1 查詢），然後忽略它們。現在每個發現都採取行動：明顯的機械性修復自動應用，真正模糊的問題批量成一個問題而非 8 個單獨的提示。您會為每個自動修復看到 `[AUTO-FIXED] file:line Problem → what was done`。
- **您控制「直接修復」和「先問我」之間的界線。** 死程式碼、過時的注釋、N+1 查詢自動修復。安全問題、競態條件、設計決策則提交給您判斷。分類存在於一個地方（`review/checklist.md`），讓 `/review` 和 `/ship` 保持同步。

### 修復

- **`$B js "const x = await fetch(...); return x.status"` 現在可以運作。** `js` 命令以前將所有內容包裝為表達式 — 因此 `const`、分號和多行程式碼都會損壞。現在它偵測語句並使用區塊包裝器，就像 `eval` 已經在做的那樣。
- **點擊下拉選項不再永久掛起。** 若代理在快照中看到 `@e3 [option] "Admin"` 並執行 `click @e3`，gstack 現在自動選擇該選項而非在不可能的 Playwright 點擊上掛起。正確的事情就這樣發生了。
- **當點擊是錯誤的工具時，gstack 告訴您。** 通過 CSS 選擇器點擊 `<option>` 以前會以神秘的 Playwright 錯誤超時。現在您獲得：`"Use 'browse select' instead of 'click' for dropdown options."`

### 貢獻者須知

- Gate Classification → Severity Classification 重新命名（嚴重性決定呈現順序，而非是否顯示提示）。
- 在 `review/checklist.md` 中新增 Fix-First Heuristic 章節 — 典範 AUTO-FIX vs ASK 分類。
- 新驗證測試：`Fix-First Heuristic 存在於清單中並被 review + ship 參照`。
- 在 `read-commands.ts` 中提取 `needsBlockWrapper()` 和 `wrapForEvaluate()` 輔助函式 — 由 `js` 和 `eval` 命令共享（DRY）。
- 在 `BrowserManager` 中新增 `getRefRole()` — 為 ref 選擇器公開 ARIA 角色，而不改變 `resolveRef` 返回類型。
- 點擊處理器通過父 `<select>` 自動將 `[role=option]` refs 路由至 `selectOption()`，附帶 DOM `tagName` 檢查以避免阻擋自訂 listbox 元件。
- 6 個新測試：多行 js、分號、語句關鍵字、簡單表達式、選項自動路由、CSS 選項錯誤指導。

## 0.4.4 — 2026-03-16

- **新版本在不到一小時內偵測到，而非半天。** 更新檢查快取設定為 12 小時，這意味著您整天都可能停留在舊版本而新版本已發布。現在「您是最新的」在 60 分鐘後過期，所以您會在一小時內看到升級。「升級可用」仍然持續 12 小時提示（這才是重點）。
- **`/gstack-upgrade` 始終進行真實檢查。** 直接執行 `/gstack-upgrade` 現在繞過快取並對 GitHub 進行全新檢查。不再有「您已是最新版本」而實際上並不是的情況。

### 貢獻者須知

- 分割 `last-update-check` 快取 TTL：`UP_TO_DATE` 為 60 分鐘，`UPGRADE_AVAILABLE` 為 720 分鐘。
- 為 `bin/gstack-update-check` 新增 `--force` 標記（在檢查前刪除快取檔案）。
- 3 個新測試：`--force` 清除 UP_TO_DATE 快取、`--force` 清除 UPGRADE_AVAILABLE 快取、使用 `utimesSync` 的 60 分鐘 TTL 邊界測試。

## 0.4.3 — 2026-03-16

- **新的 `/document-release` 技能。** 在 `/ship` 之後、合併之前執行它 — 它讀取您專案中的每個文件檔案，交叉參照 diff，並更新 README、ARCHITECTURE、CONTRIBUTING、CHANGELOG 和 TODOS 以符合您實際出貨的內容。有風險的變更以問題形式提交；其他一切都是自動的。
- **每個問題現在都清晰明瞭，每次都是。** 您以前需要 3 次以上的工作階段才能讓 gstack 給您完整的上下文和簡單的英文解釋。現在每個問題 — 即使在單一工作階段中 — 都告訴您專案、分支和正在發生的事情，說明簡單到足以在上下文切換中理解。不再有「對不起，請更簡單地解釋給我聽」。
- **分支名稱始終正確。** gstack 現在在執行時偵測您目前的分支，而非依賴對話開始時的快照。在工作階段中間切換分支？gstack 跟上。

### 貢獻者須知

- 將 ELI16 規則合併到基礎 AskUserQuestion 格式 — 一種格式而非兩種，沒有 `_SESSIONS >= 3` 條件式。
- 在前言 bash 區塊中新增 `_BRANCH` 偵測（帶有回退的 `git branch --show-current`）。
- 新增分支偵測和簡化規則的迴歸防護測試。

## 0.4.2 — 2026-03-16

- **`$B js "await fetch(...)"` 現在可以直接運作。** `$B js` 或 `$B eval` 中的任何 `await` 表達式都會自動包裝在非同步上下文中。不再有 `SyntaxError: await is only valid in async functions`。單行 eval 檔案直接返回值；多行檔案使用明確的 `return`。
- **貢獻者模式現在反思，而不只是反應。** 不只是在出問題時提交報告，貢獻者模式現在提示定期反思：「給您的 gstack 體驗評分 0-10。不是 10 分？想想為什麼。」攔截被動偵測遺漏的生活品質問題和摩擦。報告現在包含 0-10 評分和「什麼能讓這個成為 10 分」以聚焦於可行的改進。
- **技能現在尊重您的分支目標。** `/ship`、`/review`、`/qa` 和 `/plan-ceo-review` 偵測您的 PR 實際目標的分支，而非假設是 `main`。堆疊分支、Conductor 工作區指向功能分支，以及使用 `master` 的儲存庫現在都可以正常運作。
- **`/retro` 在任何預設分支上都能運作。** 使用 `master`、`develop` 或其他預設分支名稱的儲存庫被自動偵測 — 不再因分支名稱錯誤而有空白的回顧。
- **新的 `{{BASE_BRANCH_DETECT}}` 佔位符**，供技能作者使用 — 將其放入任何模板，免費獲得 3 步驟分支偵測（PR base → repo default → fallback）。
- **3 個新的 E2E 煙霧測試**，驗證 base branch 偵測在 ship、review 和 retro 技能中端到端正確運作。

### 貢獻者須知

- 新增帶有注釋去除的 `hasAwait()` 輔助函式，以避免 `// await` 中的誤判。
- 智慧 eval 包裝：單行 → 表達式 `(...)`，多行 → 區塊 `{...}` 含明確 `return`。
- 6 個新非同步包裝單元測試，40 個新貢獻者模式前言驗證測試。
- 校準範例框架為歷史（「以前失敗」）以避免在修復後暗示存在即時錯誤。
- 在 CLAUDE.md 中新增「撰寫 SKILL 模板」章節 — 自然語言優先於 bash-ism、動態分支偵測、自含式程式碼區塊的規則。
- 硬編碼 main 迴歸測試掃描所有 `.tmpl` 檔案中帶有硬編碼 `main` 的 git 命令。
- QA 模板清理：移除 `REPORT_DIR` shell 變數，將端口偵測簡化為文字說明。
- gstack-upgrade 模板：bash 區塊之間變數引用的明確跨步驟文字說明。

## 0.4.1 — 2026-03-16

- **gstack 現在注意到自己出錯。** 開啟貢獻者模式（`gstack-config set gstack_contributor true`），gstack 自動記錄發生了什麼問題 — 您在做什麼、什麼損壞了、重現步驟。下次有什麼讓您惱火的，錯誤報告已經寫好了。Fork gstack 自己修復它。
- **同時處理多個工作階段？gstack 跟上。** 當您有 3 個以上的 gstack 視窗開啟時，每個問題現在都告訴您是哪個專案、哪個分支，以及您在做什麼。不再盯著問題想「等等，這是哪個視窗？」
- **每個問題現在都帶有建議。** gstack 不再把選項傾倒在您身上讓您思考，而是告訴您它會選什麼以及為什麼。在所有技能中使用相同的清晰格式。
- **/review 現在攔截遺忘的 enum 處理器。** 新增一個新的狀態、層級或類型常數？/review 通過您程式碼庫中的每個 switch 語句、白名單和過濾器追蹤它 — 不只是您變更的檔案。在出貨之前攔截「新增了值但忘記處理它」這類錯誤。

### 貢獻者須知

- 在所有 11 個技能模板中將 `{{UPDATE_CHECK}}` 重命名為 `{{PREAMBLE}}` — 現在一個啟動區塊處理更新檢查、工作階段追蹤、貢獻者模式和問題格式化。
- 將 plan-ceo-review 和 plan-eng-review 問題格式化進行 DRY 處理，參照前言基準而非複製規則。
- 在 CLAUDE.md 中新增 CHANGELOG 風格指南和供應商符號連結意識文件。

## 0.4.0 — 2026-03-16

### 新增
- **QA-only 技能**（`/qa-only`）— 僅報告 QA 模式，找到並記錄錯誤而不進行修復。將乾淨的錯誤報告交給您的團隊，代理不會碰您的程式碼。
- **QA 修復循環** — `/qa` 現在執行發現-修復-驗證循環：發現錯誤、修復它們、提交、重新導航以確認修復已生效。一個命令從損壞到出貨。
- **計劃到 QA 的構件流** — `/plan-eng-review` 寫入測試計劃構件，`/qa` 自動取用。您的工程審查現在直接供 QA 測試使用，無需手動複製貼上。
- **`{{QA_METHODOLOGY}}` DRY 佔位符** — 共享 QA 方法論區塊注入 `/qa` 和 `/qa-only` 兩個模板。當您更新測試標準時，兩個技能保持同步。
- **Eval 效率指標** — 迴合次數、持續時間和成本現在顯示在所有 eval 介面中，附帶自然語言**Takeaway**評論。一眼看出您的提示詞變更是否讓代理更快或更慢。
- **`generateCommentary()` 引擎** — 解讀比較差異，讓您不必：標記退化、記錄改進，並產生整體效率摘要。
- **Eval 清單欄位** — `bun run eval:list` 現在顯示每次執行的迴合次數和持續時間。立即發現昂貴或緩慢的執行。
- **Eval 摘要每測試效率** — `bun run eval:summary` 顯示各執行中每個測試的平均迴合次數/持續時間/成本。識別哪些測試長期花費您最多。
- **`judgePassed()` 單元測試** — 提取並測試通過/失敗判斷邏輯。
- **3 個新 E2E 測試** — qa-only 無修復防護措施、qa 修復循環含提交驗證、plan-eng-review 測試計劃構件。
- **瀏覽器 ref 過時偵測** — `resolveRef()` 現在檢查元素計數以偵測頁面突變後的過時 ref。SPA 導航不再在缺失元素上導致 30 秒逾時。
- ref 過時的 3 個新快照測試。

### 變更
- QA 技能提示詞重構，包含明確的兩階段工作流程（發現 → 修復 → 驗證）。
- `formatComparison()` 現在顯示每個測試的迴合次數和持續時間差異以及成本。
- `printSummary()` 顯示迴合次數和持續時間欄位。
- `eval-store.test.ts` 修復了預先存在的 `_partial` 檔案斷言錯誤。

### 修復
- 瀏覽器 ref 過時 — 在頁面突變（如 SPA 導航）之前收集的 ref 現在被偵測並重新收集。消除動態網站上一類不穩定的 QA 失敗。

## 0.3.9 — 2026-03-15

### 新增
- **`bin/gstack-config` CLI** — 用於 `~/.gstack/config.yaml` 的簡單 get/set/list 介面。被更新檢查和升級技能用於持久設定（auto_upgrade、update_check）。
- **智慧更新檢查** — 12 小時快取 TTL（原為 24 小時），當用戶拒絕升級時指數級暫停退避（24 小時 → 48 小時 → 1 週），`update_check: false` 設定選項可完全停用檢查。發布新版本時暫停重置。
- **自動升級模式** — 在設定中設定 `auto_upgrade: true` 或設定 `GSTACK_AUTO_UPGRADE=1` 環境變數，以跳過升級提示並自動更新。
- **4 選項升級提示** — 「是，立即升級」、「始終保持最新」、「現在不要」（暫停）、「不再詢問」（停用）。
- **供應商副本同步** — `/gstack-upgrade` 現在在升級主要安裝後偵測並更新當前專案中的本地供應商副本。
- 25 個新測試：11 個用於 gstack-config CLI，14 個用於更新檢查中的暫停/設定路徑。

### 變更
- README 升級/疑難排解章節簡化，改為參照 `/gstack-upgrade` 而非長段貼上命令。
- 升級技能模板升級至 v1.1.0，附帶 `Write` 工具權限用於設定編輯。
- 所有 SKILL.md 前言以新的升級流程描述更新。

## 0.3.8 — 2026-03-14

### 新增
- **TODOS.md 作為單一真實來源** — 將 `TODO.md`（路線圖）和 `TODOS.md`（近期）合併為一個按技能/元件組織的檔案，附帶 P0-P4 優先級排序和已完成章節。
- **`/ship` 步驟 5.5：TODOS.md 管理** — 從 diff 自動偵測已完成的項目，用版本標注標記為完成，若 TODOS.md 缺失或未結構化則提供建立/重組。
- **跨技能 TODOS 意識** — `/plan-ceo-review`、`/plan-eng-review`、`/retro`、`/review` 和 `/qa` 現在讀取 TODOS.md 作為專案上下文。`/retro` 新增 Backlog Health 指標（開放計數、P0/P1 項目、流失率）。
- **共享 `review/TODOS-format.md`** — 被 `/ship` 和 `/plan-ceo-review` 參照的典範 TODO 項目格式，防止格式漂移（DRY）。
- **Greptile 2 層回覆系統** — 第 1 層（友好、內嵌 diff + 解釋）用於首次回覆；第 2 層（堅定、完整證據鏈 + 重新排序請求）當 Greptile 在之前回覆後重新標記時。
- **Greptile 回覆模板** — `greptile-triage.md` 中用於修復（內嵌 diff）、已修復（所做的事情）和誤報（證據 + 建議重新排序）的結構化模板。取代模糊的單行回覆。
- **Greptile 升級偵測** — 明確算法偵測評論串上的先前 GStack 回覆並自動升級至第 2 層。
- **Greptile 嚴重性重新排序** — 回覆現在在 Greptile 錯誤分類問題嚴重性時包含 `**Suggested re-rank:**`。
- 跨技能的 `TODOS-format.md` 參照靜態驗證測試。

### 修復
- **`.gitignore` 附加失敗被靜默吞噬** — `ensureStateDir()` 的裸 `catch {}` 替換為僅 ENOENT 靜默；非 ENOENT 錯誤（EACCES、ENOSPC）記錄至 `.gstack/browse-server.log`。

### 變更
- `TODO.md` 刪除 — 所有項目合併至 `TODOS.md`。
- `/ship` 步驟 3.75 和 `/review` 步驟 5 現在參照 `greptile-triage.md` 中的回覆模板和升級偵測。
- `/ship` 步驟 6 提交順序在最終提交中包含 TODOS.md，與 VERSION + CHANGELOG 並列。
- `/ship` 步驟 8 PR 說明包含 TODOS 章節。

## 0.3.7 — 2026-03-14

### 新增
- **截圖元素/區域裁剪** — `screenshot` 命令現在支援通過 CSS 選擇器或 @ref 進行元素裁剪（`screenshot "#hero" out.png`、`screenshot @e3 out.png`）、區域裁剪（`screenshot --clip x,y,w,h out.png`）和僅視口模式（`screenshot --viewport out.png`）。使用 Playwright 原生的 `locator.screenshot()` 和 `page.screenshot({ clip })`。全頁面仍為預設值。
- 10 個新測試，涵蓋所有截圖模式（視口、CSS、@ref、裁剪）和錯誤路徑（未知標記、互斥、無效座標、路徑驗證、不存在的選擇器）。

## 0.3.6 — 2026-03-14

### 新增
- **E2E 可觀測性** — 心跳檔案（`~/.gstack-dev/e2e-live.json`）、每次執行的日誌目錄（`~/.gstack-dev/e2e-runs/{runId}/`）、progress.log、每測試 NDJSON 記錄、持久性失敗記錄。所有 I/O 非致命性。
- **`bun run eval:watch`** — 即時終端儀表板每 1 秒讀取心跳 + 部分 eval 檔案。顯示已完成的測試、帶有迴合/工具資訊的當前測試、過時偵測（>10 分鐘）、progress.log 的 `--tail`。
- **增量 eval 儲存** — `savePartial()` 在每個測試完成後寫入 `_partial-e2e.json`。抵抗崩潰：部分結果在執行被殺死後仍存在。永不清理。
- **機器可讀診斷** — eval JSON 中的 `exit_reason`、`timeout_at_turn`、`last_tool_call` 欄位。啟用 `jq` 查詢用於自動化修復循環。
- **API 連通性預檢** — E2E 套件在燒掉測試預算之前立即在 ConnectionRefused 時拋出。
- **`is_error` 偵測** — `claude -p` 在 API 失敗時可能回傳 `subtype: "success"` 帶 `is_error: true`。現在正確分類為 `error_api`。
- **Stream-json NDJSON 解析器** — 用於 `claude -p --output-format stream-json --verbose` 即時 E2E 進度的 `parseNDJSON()` 純函式。
- **Eval 持久性** — 結果儲存至 `~/.gstack-dev/evals/`，與上次執行自動比較。
- **Eval CLI 工具** — `eval:list`、`eval:compare`、`eval:summary` 用於檢查 eval 歷史。
- **所有 9 個技能轉換為 `.tmpl` 模板** — plan-ceo-review、plan-eng-review、retro、review、ship 現在使用 `{{UPDATE_CHECK}}` 佔位符。更新檢查前言的單一真實來源。
- **3 層 eval 套件** — 第 1 層：靜態驗證（免費），第 2 層：通過 `claude -p` 的 E2E（約 $3.85/次），第 3 層：LLM 評判（約 $0.15/次）。由 `EVALS=1` 控制。
- **植入錯誤的結果測試** — 包含已知錯誤的 eval 固件，LLM 評判分數偵測。
- 15 個可觀測性單元測試，涵蓋心跳結構、progress.log 格式、NDJSON 命名、savePartial、finalize、watcher 渲染、過時偵測、非致命性 I/O。
- plan-ceo-review、plan-eng-review、retro 技能的 E2E 測試。
- 更新檢查退出碼迴歸測試。
- `test/helpers/skill-parser.ts` — 用於 git remote 偵測的 `getRemoteSlug()`。

### 修復
- **代理的瀏覽器二進位發現損壞** — 以明確的 `browse/dist/browse` 路徑取代 SKILL.md 設定區塊中的 `find-browse` 間接層。
- **更新檢查退出碼 1 誤導代理** — 新增 `|| true` 以防止在無更新可用時退出代碼非零。
- **browse/SKILL.md 缺少設定區塊** — 新增 `{{BROWSE_SETUP}}` 佔位符。
- **plan-ceo-review 逾時** — 在測試目錄中初始化 git 儲存庫、跳過程式碼庫探索、將逾時增加至 420 秒。
- 植入錯誤的 eval 可靠性 — 簡化提示詞、降低偵測基準、對 max_turns 閃爍有韌性。

### 變更
- **模板系統擴展** — `gen-skill-docs.ts` 中的 `{{UPDATE_CHECK}}` 和 `{{BROWSE_SETUP}}` 佔位符。所有使用瀏覽器的技能從單一真實來源生成。
- 以特定的參數格式、有效值、錯誤行為和返回類型豐富了 14 個命令描述。
- 設定區塊先檢查工作區本地路徑（用於開發），回退至全域安裝。
- LLM eval 評判從 Haiku 升級至 Sonnet 4.6。
- `generateHelpText()` 從 COMMAND_DESCRIPTIONS 自動生成（取代手動維護的說明文字）。

## 0.3.3 — 2026-03-13

### 新增
- **SKILL.md 模板系統** — 帶有 `{{COMMAND_REFERENCE}}` 和 `{{SNAPSHOT_FLAGS}}` 佔位符的 `.tmpl` 檔案，在建置時從原始碼自動生成。結構性防止文件和程式碼之間的命令漂移。
- **命令登錄檔**（`browse/src/commands.ts`）— 所有 browse 命令的單一真實來源，附帶類別和豐富描述。無副作用，可從建置腳本和測試安全導入。
- **快照標記元數據**（`browse/src/snapshot.ts` 中的 `SNAPSHOT_FLAGS` 陣列）— 元數據驅動的解析器取代手工編碼的 switch/case。在一處新增標記更新解析器、文件和測試。
- **第 1 層靜態驗證** — 43 個測試：從 SKILL.md 程式碼區塊解析 `$B` 命令，對命令登錄檔和快照標記元數據進行驗證
- **第 2 層 E2E 測試**，通過 Agent SDK — 生成真實的 Claude 工作階段、執行技能、掃描 browse 錯誤。由 `SKILL_E2E=1` 環境變數控制（約 $0.50/次）
- **第 3 層 LLM 評判 eval** — Haiku 在清晰度/完整性/可行性上為生成的文件評分（閾值 ≥4/5），加上對手動維護基準的迴歸測試。由 `ANTHROPIC_API_KEY` 控制
- **`bun run skill:check`** — 顯示所有技能、命令計數、驗證狀態、模板新鮮度的健康儀表板
- **`bun run dev:skill`** — 監視模式，在每次模板或原始碼檔案變更時重新生成並驗證 SKILL.md
- **CI 工作流程**（`.github/workflows/skill-docs.yml`）— 在 push/PR 時執行 `gen:skill-docs`，若生成輸出與已提交檔案不同則失敗
- `bun run gen:skill-docs` 腳本用於手動重新生成
- `bun run test:eval` 用於 LLM 評判 eval
- `test/helpers/skill-parser.ts` — 從 Markdown 提取並驗證 `$B` 命令
- `test/helpers/session-runner.ts` — 帶有錯誤模式掃描和記錄儲存的 Agent SDK 包裝器
- **ARCHITECTURE.md** — 設計決策文件，涵蓋 daemon 模型、安全性、ref 系統、日誌、崩潰恢復
- **Conductor 整合**（`conductor.json`）— 工作區設定/拆除的生命週期 Hook
- **`.env` 傳播** — `bin/dev-setup` 自動從主工作樹複製 `.env` 到 Conductor 工作區
- 用於 API 金鑰設定的 `.env.example` 模板

### 變更
- 建置現在在編譯二進位之前執行 `gen:skill-docs`
- `parseSnapshotArgs` 由元數據驅動（迭代 `SNAPSHOT_FLAGS` 而非 switch/case）
- `server.ts` 從 `commands.ts` 導入命令集，而非內聯聲明
- SKILL.md 和 browse/SKILL.md 現在是生成的檔案（請編輯 `.tmpl` 而非直接編輯）

## 0.3.2 — 2026-03-13

### 修復
- Cookie 導入選擇器現在返回 JSON 而非 HTML — `jsonResponse()` 引用了超出範圍的 `url`，導致每個 API 呼叫崩潰
- `help` 命令正確路由（由於 META_COMMANDS 分派排序而無法到達）
- 來自全域安裝的過時伺服器不再遮蔽本地變更 — 從 `resolveServerScript()` 中移除了舊的 `~/.claude/skills/gstack` 回退
- 崩潰日誌路徑參照從 `/tmp/` 更新至 `.gstack/`

### 新增
- **差異感知 QA 模式** — 功能分支上的 `/qa` 自動分析 `git diff`、識別受影響的頁面/路由、偵測 localhost 上的執行中應用程式，並只測試變更的內容。不需要 URL。
- **專案本地 browse 狀態** — 狀態檔案、日誌和所有伺服器狀態現在存在於專案根目錄的 `.gstack/` 中（通過 `git rev-parse --show-toplevel` 偵測）。不再有 `/tmp` 狀態檔案。
- **共享設定模組**（`browse/src/config.ts`）— 集中 CLI 和伺服器的路徑解析，消除重複的端口/狀態邏輯
- **隨機端口選擇** — 伺服器選取 10000-60000 的隨機端口，而非掃描 9400-9409。不再有 CONDUCTOR_PORT 魔術偏移量。不再有跨工作區的端口衝突。
- **二進位版本追蹤** — 狀態檔案包含 `binaryVersion` SHA；CLI 在二進位重建時自動重啟伺服器
- **舊版 /tmp 清理** — CLI 掃描並移除舊的 `/tmp/browse-server*.json` 檔案，在發送信號前驗證 PID 所有權
- **Greptile 整合** — `/review` 和 `/ship` 獲取並分類 Greptile bot 評論；`/retro` 跨週追蹤 Greptile 打擊率
- **本地開發模式** — `bin/dev-setup` 從儲存庫符號連結技能用於就地開發；`bin/dev-teardown` 還原全域安裝
- `help` 命令 — 代理可自我探索所有命令和快照標記
- 帶有 META 信號協議的版本感知 `find-browse` — 偵測過時的二進位並提示代理更新
- `browse/dist/find-browse` 編譯二進位，帶有 git SHA 與 origin/main 的比較（4 小時快取）
- 建置時寫入的 `.version` 檔案，用於二進位版本追蹤
- cookie 選擇器（13 個測試）和 find-browse 版本檢查（10 個測試）的路由層級測試
- 設定解析測試（14 個測試），涵蓋 git root 偵測、BROWSE_STATE_FILE 覆蓋、ensureStateDir、readVersionHash、resolveServerScript 和版本不符偵測
- CLAUDE.md 中的瀏覽器互動指南 — 防止 Claude 使用 mcp\_\_claude-in-chrome\_\_\* 工具
- CONTRIBUTING.md，附帶快速開始、開發模式說明以及在其他儲存庫中測試分支的指令

### 變更
- 狀態檔案位置：`.gstack/browse.json`（原為 `/tmp/browse-server.json`）
- 日誌檔案位置：`.gstack/browse-{console,network,dialog}.log`（原為 `/tmp/browse-*.log`）
- 原子性狀態檔案寫入：`.json.tmp` → 重命名（防止部分讀取）
- CLI 將 `BROWSE_STATE_FILE` 傳遞給生成的伺服器（伺服器從中衍生所有路徑）
- SKILL.md 設定檢查解析 META 信號並處理 `META:UPDATE_AVAILABLE`
- `/qa` SKILL.md 現在描述四種模式（差異感知、完整、快速、迴歸），以差異感知作為功能分支的預設值
- `jsonResponse`/`errorResponse` 使用選項物件以防止位置參數混淆
- 建置腳本編譯 `browse` 和 `find-browse` 兩個二進位，清理 `.bun-build` 臨時檔案
- README 以 Greptile 設定說明、差異感知 QA 範例和修訂的演示記錄更新

### 移除
- `CONDUCTOR_PORT` 魔術偏移量（`browse_port = CONDUCTOR_PORT - 45600`）
- 端口掃描範圍 9400-9409
- 舊版回退至 `~/.claude/skills/gstack/browse/src/server.ts`
- `DEVELOPING_GSTACK.md`（重命名為 CONTRIBUTING.md）

## 0.3.1 — 2026-03-12

### 第 3.5 階段：瀏覽器 Cookie 導入

- `cookie-import-browser` 命令 — 解密並從真實 Chromium 瀏覽器（Comet、Chrome、Arc、Brave、Edge）導入 Cookie
- 從 browse 伺服器提供的互動式 Cookie 選擇器 Web UI（深色主題、兩欄佈局、域名搜尋、導入/移除）
- 使用 `--domain` 標記的直接 CLI 導入，用於非互動式使用
- Claude Code 整合的 `/setup-browser-cookies` 技能
- macOS 鑰匙圈存取，附帶 10 秒非同步逾時（無事件循環阻塞）
- 每個瀏覽器的 AES 金鑰快取（每個工作階段每個瀏覽器一次鑰匙圈提示）
- 資料庫鎖定回退：複製已鎖定的 Cookie 資料庫至 /tmp 以安全讀取
- 18 個帶有加密 Cookie 固件的單元測試

## 0.3.0 — 2026-03-12

### 第 3 階段：/qa 技能 — 系統性 QA 測試

- 新的 `/qa` 技能，帶有 6 階段工作流程（初始化、認證、定向、探索、記錄、收尾）
- 三種模式：完整（系統性，5-10 個問題）、快速（30 秒煙霧測試）、迴歸（與基準比較）
- 問題分類：7 個類別、4 個嚴重性級別、每頁探索清單
- 帶有健康分數的結構化報告模板（0-100，跨 7 個類別加權）
- Next.js、Rails、WordPress 和 SPA 的框架偵測指南
- `browse/bin/find-browse` — 使用 `git rev-parse --show-toplevel` 的 DRY 二進位探索

### 第 2 階段：增強型瀏覽器

- 對話框處理：自動接受/關閉、對話框緩衝區、提示文字支援
- 檔案上傳：`upload <sel> <file1> [file2...]`
- 元素狀態檢查：`is visible|hidden|enabled|disabled|checked|editable|focused <sel>`
- 帶有 ref 標籤覆蓋的標注截圖（`snapshot -a`）
- 與前一個快照的快照差異比較（`snapshot -D`）
- 游標互動元素掃描，用於非 ARIA 可點擊元素（`snapshot -C`）
- `wait --networkidle` / `--load` / `--domcontentloaded` 標記
- `console --errors` 過濾器（僅錯誤 + 警告）
- `cookie-import <json-file>`，帶有從頁面 URL 自動填入域名
- CircularBuffer O(1) 環形緩衝區，用於控制台/網路/對話框緩衝區
- 使用 Bun.write() 的非同步緩衝區刷新
- 帶有 page.evaluate + 2 秒逾時的健康檢查
- Playwright 錯誤包裝 — 為 AI 代理提供可行的訊息
- 上下文重建保留 Cookie/儲存/URL（使用者代理修復）
- SKILL.md 改寫為以 QA 為導向的操作手冊，包含 10 個工作流程模式
- 166 個整合測試（原為約 63 個）

## 0.0.2 — 2026-03-12

- 修復專案本地 `/browse` 安裝 — 編譯後的二進位現在從其自身目錄解析 `server.ts`，而非假設存在全域安裝
- `setup` 重建過時的二進位（不只是缺失的）並在建置失敗時以非零退出
- 修復 `chain` 命令吞噬寫入命令的真實錯誤（例如：導航逾時被報告為「Unknown meta command」）
- 修復 CLI 在同一命令上伺服器反覆崩潰時的無界重啟循環
- 將控制台/網路緩衝區上限設為 50k 條目（環形緩衝區），而非無限增長
- 修復在緩衝區達到 50k 上限後磁碟刷新靜默停止的問題
- 修復設定中的 `ln -snf` 以避免在升級時建立巢狀符號連結
- 使用 `git fetch && git reset --hard` 而非 `git pull` 進行升級（處理 force-push）
- 簡化安裝：全域優先，附帶可選的專案副本（取代 submodule 方法）
- 重構 README：hero、前後對比、演示記錄、疑難排解章節
- 六個技能（新增 `/retro`）

## 0.0.1 — 2026-03-11

初始版本。

- 五個技能：`/plan-ceo-review`、`/plan-eng-review`、`/review`、`/ship`、`/browse`
- 無頭瀏覽器 CLI，帶有 40+ 命令、基於 ref 的互動、持久性 Chromium daemon
- 以 Claude Code 技能形式一鍵安裝（submodule 或全域 clone）
- 用於二進位編譯和技能符號連結的 `setup` 腳本
