# 雞味客服 文件 INDEX（Round 37.32 大更新）

> **最後更新**：2026-08-06 20:15（Round 37.32 4 大 bug 修整後）
> **本檔為手動編輯**：docs/ 結構由 `scripts/sync-canonical.sh` 維護
> **對應 Round**：37.15 結構重整 + 37.20 內容更新 + 37.32 4 大生產 bug 修整

---

## 📊 Round 37.32 更新後結構

| 目錄 | 檔案數 | 用途 |
|------|-------|------|
| `docs/`（根目錄） | **4** | 永久常駐手冊 |
| `docs/reports/` | **15** | 歷史審計、測試報告、操作 SOP、開發指南（歸檔區） |
| `docs/adr/` | 5 | Architecture Decision Records |
| `docs/handoff/` | — | Session handoff 紀錄 |
| `docs/production-prompt/` | — | L3 runtime canonical 檔（AGENTS.md / SOUL.md / main_idea.md） |
| `memory/` | 1+ | 每日 session summary（2026-08-06 已有 Round 37.23-37.32 紀錄） |

## 🔥 必讀（4 個永久常駐手冊 · `docs/` 根目錄）

> 接手變更的單一入口。看完這 4 個就能上手。

| 檔案 | 用途 | 最後更新 |
|------|------|----------|
| **`docs/NEW_SESSION_HANDBOOK.md`** | 接手變更 SOP（架構 + 驗證 + 操作 + 陷阱 + 求助順序） | **Round 37.32**（20:12）|
| **`docs/OWNER_MANUAL.md`** | Hubert 日常操作 SOP（菜單、後台審核、sync-mirror、緊急聯絡） | **Round 37.32**（20:15）|
| **`docs/GMAIL_SHEETS_WORKFLOW.md`** | Gmail OAuth + Google Sheets 事件驅動同步架構 | Round 37.20（13:12） |
| **`docs/INDEX.md`**（本檔） | 單一文件入口 + Round 歷史 + 快速連結 | **Round 37.32**（20:15） |

> **Round 37.32 新發現**：3 個永久手冊都已同步本 session 變更（sync-kb.sh、fuzzyTriggers 縮窄、prompt leak 防護、dashboard URL 改正式域名）

---

## 📋 `docs/reports/` 歷史報告（15 個 · 歸檔區）

### 業務實測報告

| 檔案 | Round | 行數 |
|------|-------|------|
| `docs/reports/BUSINESS_FLOW_VERIFICATION.md` | 37.14 | 301 |
| `docs/reports/E2E_INTEGRATION_REPORT.md` | 35 | 269 |

### 操作 / 工程手冊

| 檔案 | 用途 |
|------|------|
| `docs/reports/OPERATIONS.md` | LINE bot + staging + secrets SOP |
| `docs/reports/DEVELOPMENT.md` | 測試 + 開發 + Troubleshooting |
| `docs/reports/ENGINEERING_HANDBOOK.md` | 完整工程手冊（架構 + 模組） |
| `docs/reports/CEO_DECISION_GUIDE.md` | 商業 / 戰略決策指南 |
| `docs/reports/PROJECT_INVENTORY.md` | 專案盤點 |
| `docs/reports/HUBERT_USER_GUIDE.md` | Hubert 操作指南（Dashboard + Cron） |

### SOP / 教學

| 檔案 | 用途 |
|------|------|
| `docs/reports/SESSION_END_SOP.md` | Session 結束 5 動作 SOP |
| `docs/reports/KNOWN_ISSUES.md` | 已知問題與 workaround |
| `docs/reports/EMAIL_SETUP.md` | Gmail OAuth setup 教學 |
| `docs/reports/GCP_ROTATION_SOP.md` | GCP service account key rotation |
| `docs/reports/API_CURL.md` | Dashboard API curl 範例 |
| `docs/reports/MULTI_TENANT_DESIGN.md` | 多租戶架構設計 |
| `docs/reports/NAMED_TUNNEL_MIGRATION.md` | Cloudflare Tunnel 遷移紀錄 |
| `docs/reports/TEST_MAP.md` | 測試套件與覆蓋率地圖 |

## 📜 Round 歷史紀錄（最近重大變更 · Round 37.23-37.32）

### Round 37.32（2026-08-06 20:12）— fuzzyTriggers 縮窄 + 4 大 bug 修整
- `transferRules.js` semanticMatch fuzzyTriggers 改用完整詞組（`算便宜一點` / `改到明天` / `算了不訂`），避免「貴」「下次」「算了」單字關鍵字誤觸日常對話
- 新增 Round 37.32 regression test（`tests/handoff.test.js`）：驗證「多少錢」「最近有哪天開團」「現在還能訂嗎」「怎麼付款」都不再觸發 handoff
- **關鍵發現**：LLM 看到 SOUL.md 的轉報格式就會複製到客戶回覆，必須在 prompt 明確標註「此格式只給 manager 用」

### Round 37.31（2026-08-06 16:05）— `scripts/sync-kb.sh` 新增
- L3 runtime 缺 `knowledge/tenants/chicken/01_product.md` → LLM 說「菜單資料讀不到」
- 修法：rsync L1 → L3，12 個 KB .md 檔案同步
- **經驗教訓**：新增任何 sync 腳本前先 grep `scripts/sync_*.sh` 看誰覆蓋什麼

### Round 37.30（2026-08-06 14:40）— 4 大生產 bug 修整
- LLM「客服轉報通知」誤傳客戶 → `SOUL.md` + `main_idea.md` 加註「此格式只給 manager 用，客戶走 config.handoff.customer_reply」
- 開團日期沒讀 config → `main_idea.md` §三 修「開團日期/地址/配送/價格 AI 自讀 config/KB」
- Dashboard URL 改 `https://dashboard.brt1122.com/`（原本是內網 `100.114.197.9:3000/admin`）
- `emailNotifier.js` 復活 `path` import + `oauth2Client.on('tokens')` 補 .bak 同步 + `logTokenWrite` trace log

### Round 37.29（2026-08-06 13:21）— 6 大商業漏洞 + 4 深度修整
- `handoff.js` 改 `channels: ['line', 'email']`（之前只 email，Hubert LINE 端收不到）
- `index.js` HUMAN_HANDOFF webhook 鎖定 guard（OpenClaw 不在 handoff 狀態自動回覆）
- `emailNotifier.js` 路徑 import + .bak 同步 + trace log
- `transferRules.js` open_date_inquiry disabled（AI 自行讀 chicken.yaml）
- `config.js` 保留 config.yaml fallback + deprecation 註解

### Round 37.28（2026-08-06 12:31）— triggers.js 補 01_product.md + CSV 清 160 廢單
- `triggers.js` STATE_KB_MAP 新增 ORDERING state
- CONFIRMING / AWAITING_PAYMENT / order_confirm 全部加 01_product.md
- CSV 清 160 筆無品項廢單（PROTECTED 6/13 + 6/16 保留）

### Round 37.27（2026-08-06 11:50）— 全 11 檔 KB 意圖動態加載
- `triggers.js` INTENT_KB_MAP 涵蓋所有 11 個 KB .md
- `guessIntent` 永不返回 null（fallback → 載 INDEX.md）
- `loadKnowledgeForIntent/State` 安全網 fallback 讀 INDEX.md
- 解決「連不上資料庫」幻覺

### Round 37.26（2026-08-06 11:31）— 消除假動作/假轉真人/填空題問價/Emoji 卡片
- `menuRule.js` validateMenu ambiguous 自動帶入 01_product.md 價格（不再讓客戶自填金額）
- `orderFormatter.js` formatOrderSummary 重寫為 Emoji 純文字卡片
- 移掉 📋 標頭裝飾線（不混 LINE 不支援的 Markdown 表格）
- `handoff.js` 修 silent catch → 改 `.then()` 可見錯誤

### Round 37.25（2026-08-06 10:35）— 6 大對話漏洞外科手術
- 3 秒 session 鎖定（防止快速連發丟 LINE 回覆）
- `addressRule.js` 三峽區/鶯歌區直接 `valid: true`
- `main_idea.md` 加「轉真人應急措施」守則
- 客戶 LINE Push 5 秒 throttle 防 spam

### Round 37.24（2026-08-05 19:11）— 無品項廢單大清掃 + LINE 我的訂單
- 8/04 8/05 8/06 刪除 160 筆 PENDING-/TEST- + 空 chicken_items/side_items 廢單
- `idle.js` 加 MY_ORDER_QUERY_PATTERNS（『我的訂單』客戶自查）
- `dashboard.html` 加 🚚 匯出司機出貨單按鈕

### Round 37.23（2026-08-05 16:07）— Dashboard 企業級大暴修
- 分頁（每頁 20/50/100/500 筆）
- 搜尋（姓名/電話/訂單號）
- 狀態篩選（全部/待對帳/已對帳/已出貨/已取消）
- Top 10 圖表 Y 軸商品 13px + X 軸整數刻度
- 金額千分位（zh-TW locale）

---

### Round 37.19（2026-08-05 12:50）— Dashboard API Token 注入 + checkAuth X-API-Token
- `scripts/dashboard-server.js` serve dashboard.html 時注入 `window.__API_TOKEN__`
- `checkAuth()` middleware 加 X-API-Token header 認證（與 Basic Auth 並列）
- **驗證**：curl 帶 X-API-Token 對 `/api/orders/:id/status` POST → `HTTP/1.1 200 OK`

### Round 37.18（2026-08-05 12:19）— Dashboard 按鈕 + Toast + Sheets 動態表頭
- `dashboard.html` 加 `showToast()` 右上角飄出（slide-in/fade-out）
- `src/storage/sheetsSync.js` 加 `buildSheetRowsWithLiveHeader()` + `headerMap` 動態映射
- `dryRun` check 移到 `getAccessToken` 之前（避免 dryRun 觸發 HTTPS）
- Top 10 圖表 X 軸整數刻度（stepSize=1, precision=0）

### Round 37.17（2026-08-05 11:47）— 事件驅動 Sheets 同步 + Dashboard 動態圖表
- `src/order/csvWriter.js` 加 `_triggerSheetsSync('writeOrder')`（setImmediate 背景觸發）
- `src/storage/sheetsSync.js` 加 `forceSync` option 跳過 phase2 阻擋
- `dashboard.html` 靜態假圖 → 動態圖表（`calcDailyCounts` / `calcStatusDist` / `calcTopItems` / `renderCharts`）
- 操作按鈕：✓ PAID / 🚚 SHIPPED / ✕ CANCEL → POST `/api/orders/:id/status`

### Round 37.16（2026-08-05 11:17）— 付款白名單 + CSV 多品項格式
- `src/rules/paymentRule.js` 加 `normalizePayment(input)`（無法識別 → 自動降級為「轉帳」）
- `src/order/orderFormatter.js` 加 `formatItemsForCsv()` / `formatChickenForCsv()` / `formatSidesForCsv()`
- `main_idea.md` 加 §三-3a 價格回答鐵律（客戶問價格 → 必讀 01_product.md）

### Round 37.15（2026-08-05 09:45）— Dashboard 30s 自動輪詢 + docs 歸檔大清掃
- `dashboard.html` 加 `setInterval(loadRecentOrders, 30000)` + `loadRecentOrders(true)` 手動按鈕
- 建立 `docs/reports/` 目錄，15 個歷史報告歸檔
- docs/ 根目錄只保留 4 個永久手冊

### Round 37.14（2026-08-05 09:03）— 4 大業務模組端到端實測
- `docs/reports/BUSINESS_FLOW_VERIFICATION.md`：paymentRule / emailNotifier / sheetsSync / dashboard-server
- Gmail LIVE TEST（Message ID `19fcf6e49b2ea3f7`）
- Google Sheets 同步 678 rows（29 欄對齊）

### Round 37.13（2026-08-05 08:33）— main_idea.md 加價格回答鐵律
- `docs/production-prompt/2026-08-04/main_idea.md` §三-3a：客戶問價格必須讀 01_product.md

### Round 37.11（2026-08-04 22:42）— npm test 0 missing + check-drift 0 missing
- `package.json` test script 改為 `--test-timeout=15000`（避免 hang）
- `docs/production-prompt/2026-08-04/{AGENTS,main_idea}.md` 補齊

### Round 37.10（2026-08-04 21:55）— Sheets 同步 + 多項 hotfix
- `src/storage/sheetsSync.js` Sheets API 整合
- `csvWriter._triggerSheetsSync` 第一次版本（cron 觸發）

### Round 37.9（2026-08-04 21:09）— Gmail token 自動還原
- 主 token 檔不存在 → 自動從 `.bak` 還原
- 每次 saveToken 都同步備份 `.bak`（雙重防護）

### Round 37.8（2026-08-04 20:41）— Sheets 同步精準對齊
- `sheetsSync.syncOrdersToSheets({dryRun:false})` 寫入 678 rows
- SHEET_HEADER 29 欄精準對齊

### Round 37.6（2026-08-04 19:30）— Phase 2 Sheets 啟用
- chicken.yaml `phase2.enabled: true`
- `sheetsSync.syncOrdersToSheets()` 第一次成功寫入

### Round 37.5（2026-08-04 ~18:00）— 雞肉品項「累計」計算
- orderHandler 累計訂單雞肉品項

### Round 37.4（2026-08-04 16:00）— Check quality 教訓整合
- §4.2 「不要相信靜態假數據」

### Round 37.3（2026-08-04 14:30）— 後台儀表板 30s 自動刷新

### Round 37.2（2026-08-04 12:00）— Line Bot 整合 + 訂單處理

### Round 37.1（2026-08-04 10:00）— Hubert 抓包 Gmail OAuth

---

## 🤖 System-level 狀態（`~/.openclaw/workspace/`）

| 檔案 | 用途 |
|------|------|
| `HEARTBEAT.md` | Cron jobs + 系統狀態（最後更新：2026-08-02 20:00） |
| `MEMORY.md` | brtclaw 長期記憶 + 工作方法論 |
| `SOUL.md` | brtclaw 人格設定 |
| `AGENTS.md` | brtclaw 工作手冊 |
| `memory/YYYY-MM-DD.md` | 每日 session summary（2026-08-05 已記錄 Round 37.15-37.19） |

---

## 🔧 Worker repo（`external-user-line-security`）

- **原始碼**：`src/index.ts`（TypeScript）
- **部署**：Cloudflare Workers + R2 public URLs
- **Round 37.10-37.13 變更**：
  - 移除 Greeting canned reply（Hubert 21:55 大翻修）
  - Workers AI 移除
  - 菜單圖片 P0.4 改為 R2 4 張（移除 P0.6 P0.5）
  - FAQ 圖片 R2 1 張
  - 100% 放行所有訊息到 OpenClaw Gateway

---

## 🔗 快速連結

### 服務 URL
- **Dashboard**：https://dashboard.brt1122.com
- **Cloudflare Worker (prod)**：https://external-user-line-security.kaden1122123.workers.dev
- **Cloudflare Worker (staging)**：https://external-user-line-security-staging.kaden1122123.workers.dev
- **OpenClaw Gateway**：https://openclaw.brt1122.com
- **Google Sheet（訂單）**：`12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA`
  - 直接開：https://docs.google.com/spreadsheets/d/12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA

### Console / Dashboard
- LINE Developer Console：https://developers.line.biz/console/
- Cloudflare Dashboard：https://dash.cloudflare.com/
- GitHub：
  - Chicken：https://github.com/kaden1122123/chicken-group-buying-cs
  - Worker：https://github.com/kaden1122123/external-user-line-security

### 官方 IDs 速查
- LINE Channel：`@620boqol`
- LINE Bot ID：`@620boqol` (與 Channel 相同)
- LINE 社群：`@620boqol`
- Google Spreadsheet ID：`12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA`
- Sheet 名稱：`工作表1`（簡體）
- Bank：007 第一銀行 / `23257030422`
- 主管 LINE ID（Hubert）：`Uf56650056d35626deb64165926a26182`
- 客服 LINE ID：`Willy0221`

---

## 📚 文件變更歷史

| 日期 | 變更 |
|------|------|
| 2026-08-05 13:12 | **Round 37.20 docs 大更新**：4 個永久手冊全部反映 Round 37.16-37.19 變更 |
| 2026-08-05 09:46 | Round 37.15 結構重整（docs 歸檔，建立 docs/reports/，根目錄只留 4 個永久手冊） |
| 2026-08-03 07:45 | docs/INDEX.md 自動生成腳本（scripts/generate-docs-index.sh）|
| 2026-08-01 | Session End SOP 5 動作建立 |

---

_本檔由 Round 37.20（2026-08-05 13:12）手動重整_
_下次 docs/ 結構變動請同步更新本檔 + 4 個永久手冊_