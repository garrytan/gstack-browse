# gstack — AI 工程工作流程

gstack 是一系列 SKILL.md 檔案，賦予 AI 代理人在軟體開發中扮演結構化角色。每個技能代表一位專家：CEO 審查者、工程主管、設計師、QA 主管、發布工程師、除錯者等。

## 可用技能

技能存放在 `.agents/skills/` 目錄。透過名稱呼叫（例如：`/office-hours`）。

| 技能 | 功能說明 |
|-------|-------------|
| `/office-hours` | 從這裡開始。在你寫程式前重新框架你的產品概念。 |
| `/plan-ceo-review` | CEO 層級審查：找出需求中藏著的 10 星產品。 |
| `/plan-eng-review` | 確立架構、資料流、邊界案例與測試。 |
| `/plan-design-review` | 為每個設計維度評分 0-10，說明 10 分的標準。 |
| `/design-consultation` | 從零建立完整設計系統。 |
| `/review` | 上線前 PR 審查。找出通過 CI 卻在正式環境崩壞的 bug。 |
| `/debug` | 系統性根本原因除錯。沒調查就沒修復。 |
| `/design-review` | 設計審查 + 修復迴圈，含原子提交。 |
| `/qa` | 開啟真實瀏覽器，找到 bug、修復並重新驗證。 |
| `/qa-only` | 與 /qa 相同，但僅產出報告——不更動程式碼。 |
| `/ship` | 執行測試、審查、推送、開 PR。一個指令完成。 |
| `/document-release` | 更新所有文件以符合你剛發布的內容。 |
| `/retro` | 每週回顧，含每人細分與出貨連勝紀錄。 |
| `/browse` | 無頭瀏覽器——真實 Chromium、真實點擊、~100ms/指令。 |
| `/setup-browser-cookies` | 從你的真實瀏覽器匯入 Cookie 以進行已驗證的測試。 |
| `/careful` | 在執行破壞性指令前警告（rm -rf、DROP TABLE、force-push）。 |
| `/freeze` | 將編輯鎖定到單一目錄。硬性封鎖，不只是警告。 |
| `/guard` | 同時啟用 careful + freeze。 |
| `/unfreeze` | 移除目錄編輯限制。 |
| `/gstack-upgrade` | 更新 gstack 到最新版本。 |

## 建置指令

```bash
bun install              # 安裝依賴
bun test                 # 執行測試（免費，<5 秒）
bun run build            # 產生文件 + 編譯二進位檔
bun run gen:skill-docs   # 從模板重新產生 SKILL.md 檔案
bun run skill:check      # 所有技能的健康儀表板
```

## 主要慣例

- SKILL.md 檔案是從 `.tmpl` 模板**產生**的。請編輯模板，不要編輯輸出檔案。
- 執行 `bun run gen:skill-docs --host codex` 以重新產生 Codex 專用輸出。
- browse 二進位檔提供無頭瀏覽器存取。在技能中使用 `$B <command>`。
- 安全技能（careful、freeze、guard）使用內嵌建議說明——在執行破壞性操作前請務必確認。
