# 雞味客服新 Session 接手手冊

> **最後更新**：2026-08-05 13:12（Round 37.20 docs 大更新）
> **必讀對象**：接手雞味客服專案的下一個 session（不管是你自己還是別人）
> **本檔定位**：接手變更的單一入口 — 看完本檔就能知道「現在系統長怎樣」「怎麼驗證」「怎麼跑」「不能做什麼」

---

## §1 環境驗證（5 步，30 秒）

接手段落專案前，先跑這 5 個驗證指令確認環境沒壞：

```bash
# 1. Git 狀態乾淨
git status --short   # 應為空或只有新檔

# 2. 最近 5 個 commit 確認 Round 序號
git log --oneline -5

# 3. npm test 60/60
timeout 180 npm test 2>&1 | tail -10
# 預期：
#   跑過:     60 個測試檔
#   通過:     60 個
#   失敗:     0 個

# 4. Dashboard /healthz
curl -s http://localhost:3000/healthz
# 預期：{"status":"ok","services":{"dashboard":"up","api_server":"up","worker":"up"}}

# 5. Sync drift
bash bin/check-drift 2>&1 | tail -10
# 預期：✅ Drift check 完成
# （AGENTS.md / SOUL.md / main_idea.md 0 Missing）
```

---

## §2 3 層位置架構

```
┌─────────────────────────────────────────────────────────────┐
│ 1. dev repo（你編輯的位置）                                │
│    ~/openclaw-workspace/others/chicken-group-buying-customer-service/│
│    - 開發、git commit、跑 npm test                          │
└────────────────────┬────────────────────────────────────────┘
                     │ sync-mirror.sh from-legacy
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. primary mirror（dashboard-server 跑的程式碼）           │
│    /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/│
│    - Dashboard 重啟後讀這裡的程式碼                          │
│    - 修改後必須重啟才生效                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ sync-canonical.sh
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. L3 runtime（external-user agent 讀的 canonical 檔）      │
│    /home/clawuser/.openclaw/agents/external-user/knowledge/│
│    - AGENTS.md / SOUL.md / main_idea.md                       │
│    - LLM 啟動時從這裡讀 persona / 工作方法論                │
└─────────────────────────────────────────────────────────────┘
```

**寫程式流程**：
1. 改 dev repo
2. `bash scripts/sync-mirror.sh from-legacy` → 推到 primary mirror
3. 重啟 dashboard-server → 載入新 code

**改 prompt 流程**：
1. 改 `docs/production-prompt/2026-08-04/{AGENTS,SOUL,main_idea}.md`
2. `bash scripts/sync-canonical.sh` → 推到 L3 runtime

---

## §3 5 必讀檔案（單一入口架構）

接手必讀順序（前 → 後）：

| # | 檔案 | 用途 |
|---|------|------|
| 1 | `docs/NEW_SESSION_HANDBOOK.md` | 本檔：現在系統長怎樣、怎麼驗證 |
| 2 | `docs/OWNER_MANUAL.md` | Hubert 日常操作 SOP（菜單、後台審核、sync-mirror） |
| 3 | `docs/GMAIL_SHEETS_WORKFLOW.md` | Gmail OAuth + Google Sheets 事件驅動同步 |
| 4 | `docs/INDEX.md` | 單一文件入口（自動生成） |
| 5 | `docs/adr/` | 5 個關鍵架構決策紀錄 |

---

## §4 已知陷阱（必看 · Round 35-37 累積）

### 4.1 `.env` 永遠不能動
- **永久邊界**（2026-08-01 Hubert 強調）
- 所有 secret / token / key 都在 `/home/clawuser/.config/chicken/secrets/`
- 唯一例外：明確取得 Hubert 同意後才能改

### 4.2 不要相信 placeholder / debug 假數據
- **2026-08-04 11:25 Hubert 教訓整合**
- ❌ Dashboard 圖表若 hardcoded labels = 靜態假圖，立即修
- ❌ Dashboard 按鈕若 onclick = alert() = 無效，立即修
- ❌ npm test 若 mock 出空 stub = 偽造綠燈，立即修
- ✅ **必須用真實 API / 數據驗證後才算完成**

### 4.3 靜態分析 ≠ 實機驗證
- 「代碼看起來對」不等於「功能 work」
- 必須跑 `curl /api/...` / 看 Sheet 實際 row / 看 CSV 實際 status
- 每次 commit 前必跑 `npm test` + curl + 看 Sheet

### 4.4 互斥路由偵測
- Round 37.13 教訓：兩條路由（舊 P0.4 + 新 R2）會搶同一個 `菜單` query
- 修法：grep `菜單 / menu` 在所有 `new Chart()` / `if (...) { ... }`，刪舊留新

---

## §5 服務入口速查

| 服務 | URL | 認證 |
|------|-----|------|
| Dashboard | `https://dashboard.brt1122.com` | HTTP Basic Auth (`admin` + `dashboard-pwd`) 或 **X-API-Token** |
| Cloudflare Worker | `https://external-user-line-security.kaden1122123.workers.dev` | （公開） |
| OpenClaw Gateway | `https://openclaw.brt1122.com` | （internal） |
| Google Sheet | `https://docs.google.com/spreadsheets/d/12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA` | service account `clawbrt@gmail.com` |

### Dashboard API Token 認證（Round 37.19）
- 從 `/home/clawuser/.config/chicken/secrets/api-token` 讀取
- Dashboard HTML 自動注入 `window.__API_TOKEN__`
- 前端 fetch 帶 `X-API-Token` header
- 後端 `checkAuth()` middleware 接受 X-API-Token 或 Basic Auth
- curl 範例：
  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -H "X-API-Token: $(cat /home/clawuser/.config/chicken/secrets/api-token)" \
    -d '{"date":"2026-08-05","status":"CONFIRMED"}' \
    http://localhost:3000/api/orders/ORD-20260805-001/status
  ```

---

## §6 部署與同步指令

```bash
# 程式碼改完
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/sync-mirror.sh from-legacy   # dev → primary mirror

# 重啟 dashboard（讓新 code 生效）
pkill -9 -f "node.*dashboard-server"
sleep 2
cd /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service
nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
sleep 3
curl -s http://localhost:3000/healthz   # 確認 up

# Prompt 改完
bash scripts/sync-canonical.sh           # dev → L3 runtime
bash bin/check-drift 2>&1 | tail -5     # 0 Missing

# Sheets 事件驅動同步（每次 csvWriter.writeOrder 自動觸發）
# 不需手動跑，但如果資料 drift 可手動：
node -e "require('./src/storage/sheetsSync').syncOrdersToSheets({dryRun:false, forceSync:true})"
```

---

## §7 外部服務 ID 速查

| 服務 | ID |
|------|-----|
| LINE Channel | @620boqol |
| Google Spreadsheet | `12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA` |
| Sheet 名稱 | `工作表1`（簡體，**不是** `工作表一`） |
| Bank | 007 第一銀行 / `23257030422` |
| Dashboard 域名 | dashboard.brt1122.com |
| Cloudflare Tunnel | brt1122-System-09 |
| 主管 LINE ID | `Uf56650056d35626deb64165926a26182` (Hubert) |
| 客服 LINE ID | `Willy0221` |

---

## §8 檢測規範（防盲目假警報 · 2026-08-04 11:25 Hubert 教訓整合）

### 禁止跑會等待 Terminal 輸入的 Setup 腳本當 health check
- ❌ `node scripts/gmail-auth.js`（會 block 等 browser OAuth callback）
- ❌ 任何 `readline` / `prompt()` / `open browser redirect` 的腳本

### 必須發送實體 API 測試呼叫
- ✅ Gmail：`sendEmail()` 真實寄信 + 檢查 exit code / log
- ✅ Sheets：`sheetsSync.syncOrdersToSheets({dryRun:false})` 真實同步
- ✅ Dashboard：用 curl 帶 X-API-Token 對 `/api/orders/:id/status` 發 POST，驗 200 OK

### 結果標示準則
- **Live Pass** ✅：真實 API 呼叫 + 收到 2xx + log 記錄
- **Fail** ❌：API 回 4xx/5xx 或連線錯誤 + 錯誤訊息
- **未驗證** ⚠️：不適用上面兩個（沒測就不能下結論，標示「未測」）

### 錯誤回報時必須附 raw output
- `ls -la` 完整結果、`sendEmail()` 回傳值、API response code
- 不接受「我覺得 Fail」/「看起來 fail」的臆測

---

## §9 Session 結束必跑（5 動作 · 2026-08-01 SOP）

```bash
# 1. 跑品質檢查
bash scripts/check-quality.sh

# 2. 查文件 drift
bash bin/check-drift 2>&1 | tail -10
grep -rn "待執行\|未完成\|TODO" docs/   # 找過時的狀態欄

# 3. 修文件（按需）
#    - SESSION_*.md 狀態欄（待執行 → ✅ 已完成）
#    - KNOWN_ISSUES.md（已修的移到「已修復」段）
#    - INDEX.md（套數/檔案清單從 29 → 60 套測試等）
#    - docs/adr/*（架構變更要寫 ADR）

# 4. 1-3 步驟的修改 → 1 個 commit
git add -A
git commit -m "docs(session-close): 文件一致性收尾"

# 5. 統一 push + sync-mirror
git push origin main
bash scripts/sync-mirror.sh from-legacy
```

---

## §10 不要做的事 🚫

- ❌ **不要跑會 block 等 OAuth 的互動式腳本作 health check**（見 §8）
- ❌ **不要相信靜態圖表的 hardcoded labels = 真實數據**（見 §4.2）
- ❌ **不要相信 onclick = alert() = 功能 work**（見 §4.2）
- ❌ **不要寫 `.env` 或 secrets 到程式碼**（見 §4.1）
- ❌ **不要用 `rm -f` 暴力刪 CSV**（可能誤刪真實訂單）
- ❌ **不要相信 mock 出空 stub 的測試**（見 §4.3）
- ❌ **不要相信「看起來對」的代碼**（必須實機驗證）
- ❌ **不要相信舊的 NEW_SESSION_HANDBOOK.md**（每次 Round 必更新）

---

## §11 文件同步鐵律（2026-08-03 Round 36 新增 · 2026-08-05 Round 37.20 大更新）

每次 commit 後必須檢查 5 個文件是否還合用：

| 檔案 | 檢查項目 |
|------|----------|
| `docs/NEW_SESSION_HANDBOOK.md`（本檔） | §5 服務入口速查、§4 陷阱、§6 部署指令、最新架構變更 |
| `docs/OWNER_MANUAL.md` | §2 審核訂單（新按鈕）、§5 檔案位置 |
| `docs/GMAIL_SHEETS_WORKFLOW.md` | §1-§4 整合狀態 |
| `docs/INDEX.md` | 必讀清單、Round 記錄 |
| `docs/production-prompt/2026-08-04/main_idea.md` | 業務邏輯變更（價格鐵律、事件驅動同步） |

---

## §12 最近 4 大 Round 架構變更（Round 37.16-37.19）

### Round 37.16 — 付款白名單 + CSV 多品項格式
- `src/rules/paymentRule.js`：新增 `normalizePayment(input)`，任何無法識別的付款文字自動降級為「轉帳」
- `src/order/orderFormatter.js`：新增 `formatItemsForCsv()` / `formatChickenForCsv()` / `formatSidesForCsv()`，格式 `品項 x 數量 | 品項 x 數量`
- main_idea.md 加 §三-3a 價格回答鐵律：客戶問價格必須讀 01_product.md 並列出所有品項

### Round 37.17 — 事件驅動 Sheets 同步 + Dashboard 動態圖表
- **`src/order/csvWriter.js`**：新增 `_triggerSheetsSync()`，writeOrder 後背景觸發 Sheets 同步（5 秒內寫入）
- **`src/storage/sheetsSync.js`**：新增 `forceSync` option 跳過 phase2 阻擋（事件驅動專用）
- **`dashboard.html`**：靜態假圖 → 動態圖表
  - `calcDailyCounts(orders)` — 最近 7 天每日訂單數
  - `calcStatusDist(orders)` — 訂單狀態分佈（PENDING/CONFIRMED/PAID/CANCELLED/PENDING_HANDOFF/NEW）
  - `calcTopItems(orders, 10)` — Top 10 品項銷售總量
  - `renderCharts(orders)` — 3 個 Chart.js 實例
- **`dashboard.html`** 操作按鈕：✓ PAID / 🚚 SHIPPED / ✕ CANCEL → POST /api/orders/:id/status

### Round 37.18 — Dashboard 按鈕實體化 + Sheets 動態表頭映射
- **`dashboard.html`** 新增 CSS + JS：
  - `showToast(message, type)` 右上角飄出提示框（slide-in/fade-out 3 秒）
- **`src/storage/sheetsSync.js`** 動態表頭映射：
  - `ordersToSheetValues(orders, liveHeader)` sync 函式（接受 liveHeader 參數）
  - `buildSheetRowsWithLiveHeader()` async wrapper（讀 Sheet 實際 Header Row 1）
  - `getSheetHeader()` 函式（讀 Sheet `工作表1!A1:AC1`）
  - `headerMap[colName] = index` 動態填入（**杜絕固定 offset 硬編碼**）
  - `syncOrdersToSheets` 改用 `require('../config').getStorageConfig()` 直讀（繞過 LOCAL wrapper cache 問題）
  - `dryRun` check 移到 `getAccessToken` 之前（避免 dryRun 觸發 HTTPS）

### Round 37.19 — Dashboard API Token 注入 + checkAuth X-API-Token 支援
- **`scripts/dashboard-server.js`** 後端注入：
  - serve dashboard.html 時讀 `/home/clawuser/.config/chicken/secrets/api-token`
  - 注入 `<script>window.__API_TOKEN__ = '...'</script></head>`
- **`scripts/dashboard-server.js`** checkAuth middleware：
  - 加 `getApiToken()` 函式（cache 機制）
  - checkAuth() 加 X-API-Token header 認證（與 Basic Auth 並列）
  - 401 訊息改為「請提供正確的帳號密碼或 X-API-Token」
- **`dashboard.html`** Top 10 圖表軸：
  - Y 軸（category）：顯示商品名稱（字體 13px）
  - X 軸（linear）：`type='linear', beginAtZero, ticks.stepSize=1, precision=0, Math.round`，杜絕小數點
  - X 軸標題：「銷售總數量（盒）」
- **驗證**：curl 帶 X-API-Token 對 `/api/orders/ORD-20260804-001/status` POST → `HTTP/1.1 200 OK` + `success: true`

---

## §13 求助順序（出問題時依序問）

1. **先看 npm test**：知道是測試錯還是 production 錯
2. **先看 /healthz**：知道哪個 service 掛了
3. **先看 sync drift**：知道檔案是否 sync
4. **先看最近 5 個 commit log**：知道最近改了什麼
5. **再看具體檔案**：上述都不夠才挖源碼
6. **最後才問 Hubert**：先自己 debug 過，不要一開始就問

---

## §14 git 操作 SOP

```bash
# Commit 前必跑
git status --short
git diff --cached --stat

# Commit 訊息格式（強制）
git commit -m "type(scope): Round N.M — 簡短描述

Hubert HH:MM prompt.txt N 大任務：

【Task 1】... 描述
【Task 2】... 描述
..."

# Commit 後必跑
git log --1 --stat     # 確認 commit 範圍
git push origin main   # 推送
```

**禁止**：
- ❌ `git add <file>` 單檔（除非真的只想 commit 一個檔）
- ❌ commit 後不驗證就繼續下一步
- ❌ commit 訊息寫「更新」、「fix bug」（要寫具體內容）

---

_本檔由 Round 37.20（2026-08-05 13:12）大更新_
_下次接手變更必同步更新 §12_