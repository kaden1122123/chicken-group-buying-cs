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
                     │ sync-runtime.sh (canonical + KB, Round 38 合併)
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
2. `bash scripts/sync-runtime.sh` → 推到 L3 runtime (canonical + KB, Round 38 合併)

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
bash scripts/sync-runtime.sh             # dev → L3 runtime (canonical + KB, Round 38 合併)
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

## §15 Round 37.30-37.32（2026-08-06 4 大生產 bug 與 sync-kb.sh）

> **最後更新**：2026-08-06 20:12（Hubert 真實對話測試抓出 4 大 bug 後連修 3 個 round）

### 4 大生產 bug（Hubert 14:40 / 16:04 / 16:15 真實 LINE 對話抓出）

| Bug | 圖片 | 修法 | Round |
|-----|------|------|-------|
| 開團日期沒讀 config（bot 回「我沒辦法直接給您確切的日期哦😅」） | 12.jpg | `scripts/sync-kb.sh`（Round 37.31）rsync L1 → L3 + `main_idea.md` §三 修 | 37.31 |
| 轉真人太頻繁（bot 對「多少錢」/「現在還能訂嗎」立即觸發） | 12.jpg | `transferRules.js` semanticMatch fuzzyTriggers 縮窄 | 37.32 |
| 「AI 客服轉報通知」誤傳客戶（資訊外洩） | 13.jpg | `SOUL.md` §六 + `main_idea.md` §三 加註 | 37.30 |
| Dashboard URL 改正式域名 | 13.jpg | `notifier.js:106` + `emailNotifier.js:340` 改為 `dashboard.brt1122.com/` | 37.30 |

### Round 37.30 — LLM prompt 雙重修整

- **`SOUL.md` §六 加註**：「🔔 【客服轉報通知】」格式**只用在後台管理員（Hubert）的 LINE Push / Email 通知**，**絕對不出現在客戶的 LINE 訊息中**。客戶轉真人回覆走 `config.handoff.customer_reply`（固定話術），**不是由 LLM 生成**。
- **`main_idea.md` §三 修**：
  - 開團日期、地址確認、配送時段、價格 — **都應由 AI 自行從 `chicken.yaml` / 01_product.md / 04_delivery.md 讀取並回覆**，**不再是轉真人理由**
  - 轉真人只保留給真正需要人工處理的（退款/客訴/爭議/明確要真人）
- **`src/handoff/notifier.js:106`** + **`src/handoff/emailNotifier.js:340`**：`'https://100.114.197.9:3000/admin'` → `'https://dashboard.brt1122.com/'`
- **`src/handoff/emailNotifier.js`** 復活 `path` import + `oauth2Client.on('tokens')` 補 .bak 同步 + `logTokenWrite` trace log
- **`tests/buildEmailContent.test.js:428`** + **`tests/emailNotifier.test.js`**：硬編碼 URL 同步改

### Round 37.31 — `scripts/sync-kb.sh` 新增（修「菜單資料讀不到」）

**根因**：`sync-canonical.sh` 只同步 canonical files（AGENTS/SOUL/main_idea），**完全沒同步 `knowledge/tenants/chicken/` 內的 11 個 KB 檔案**。所以 L3（`/home/clawuser/.openclaw/agents/external-user/`）LLM 執行時讀不到 01_product.md → 說「菜單資料讀不到」。

**修法**：新增 `scripts/sync-kb.sh`，用 `rsync -a --delete` mirror L1 KB 到 L3（12 個 .md 檔案：01_product / 02_order_flow / 03_payment / 04_delivery / 05_promotion / 06_faq / 07_transfer_rules / 08_owner_info / 10_customer_tags / 11_lead_followup / 12_reply_examples / INDEX）。

> **經驗教訓**：新增任何 sync 腳本前先 `grep -rn "knowledge/tenants" scripts/` 看誰覆蓋什麼。Round 37.32 Hubert 提醒「不該把做過的部分再重做一次」才發現 sync-producer-config.sh 只同步 chicken.yaml。

**待修（Hubert 14:04 要求）**：
- `sync-producer-config.sh` 應該整合 `sync-kb.sh`，讓 cron 每分鐘同時同步 config + knowledge
- 暫解：`chmod +x scripts/sync-kb.sh && echo '* * * * * scripts/sync-kb.sh' >> crontab`

### Round 37.32 — `transferRules.js` semanticMatch fuzzyTriggers 縮窄

**根因**：`semanticMatch` 的 fuzzyTriggers 關鍵字太寬
- 「貴」/「太貴」→ discount_request（但「多少錢」價格詢問也會誤觸）
- 「下次」→ reschedule_request（但「下次開團」日期查詢也會誤觸）
- 「算了」→ cancel_request（但日常用語也會誤觸）

**修法**：把 fuzzyTriggers 範圍縮窄為完整詞組

```javascript
// 修後
const fuzzyTriggers = [
  { type: 'complaint', patterns: ['爛掉了', '很糟糕', '非常失望', '品質差', '雞肉壞掉', '服務差', '投訴客服'] },
  { type: 'discount_request', patterns: ['算便宜一點', '打折', '可以折價', '減價', '優惠一些', 'discount', '算便宜'] },
  { type: 'reschedule_request', patterns: ['改到明天', '改到後天', '改日期', '改時間', '延後一天', '換到下週'] },
  { type: 'cancel_request', patterns: ['算了不訂', '先不訂', '取消整筆', '拔單', '撤單', '不訂了', '這筆不要了'] },
];
```

**測試配套**：
- `tests/handoff.test.js` 新增 `Round 37.32 regression` test，驗證「我要煙燻雞跟珍珠丸 各一份 這樣多少錢」「最近有哪天開團」「現在還能訂嗎」「怎麼付款」都不再觸發 handoff
- `tests/transferRules.test.js`：'太貴' 改為 'discount'、'這個會不會太貴' 改為 '給我discount'、'算了，不要了' 改為 '算了不訂了'

### 新發現的 3 大架構鐵律

#### 15.1 LLM prompt 的「轉報格式」不可外洩
- SOUL.md / main_idea.md 定義的轉報格式（🔔【客服轉報通知】）是給後台 manager 用的
- LLM 看到格式就會**自動複製到客戶回覆**（因為它「學到」這個格式是 handoff 的回應方式）
- **修法**：在 prompt 裡明確標註「此格式只給 X 用，客戶回覆走 config.handoff.customer_reply」

#### 15.2 fuzzyTriggers 永遠要加詞組長度限制
- 單字關鍵字（`貴` / `下次` / `算了`）幾乎一定會誤觸日常對話
- **修法**：使用完整詞組（`算便宜一點` / `改到明天` / `算了不訂`）避免子字串匹配
- 經驗：`includes('貴')` 會匹配「價格」「多貴」；`includes('算便宜一點')` 只匹配真正要求折扣的話

#### 15.3 三層架構的 sync 死角
- `sync-canonical.sh` 只同步 canonical files
- `sync-mirror.sh` 只同步 dev repo → main mirror
- `sync-producer-config.sh` 只同步 `config.yaml`（每分鐘 cron）
- **沒人同步 `knowledge/` 內的 KB .md 檔案到 L3** → L3 LLM 讀不到菜單
- **修法**：新增 `scripts/sync-kb.sh` 補這個洞
- **經驗**：新增任何 sync 腳本前先 grep `scripts/sync_*.sh` 看誰覆蓋什麼

### 4 大新 bug patterns（給未來 session）

1. **prompt leak**：LLM 看到「🔔【客服轉報通知】」格式就會複製到客戶回覆。修法：明確標註「只給 manager 用，客戶走固定話術」
2. **fuzzyTriggers 過寬**：「貴」「下次」「算了」單字關鍵字會誤觸日常對話。修法：用完整詞組（`算便宜一點` / `改到明天` / `算了不訂`）
3. **三層 sync 漏 KB**：`sync-canonical.sh` 只同步 canonical，沒人同步 `knowledge/tenants/` 內的 KB .md 到 L3。修法：新增 `scripts/sync-kb.sh` 補洞
4. **Dashboard URL 內網 vs 正式域名**：dev 用 `100.114.197.9:3000/admin`，prod 用 `https://dashboard.brt1122.com/`。修法：所有 dashboard URL 都應用 `process.env.DASHBOARD_URL || 'https://dashboard.brt1122.com/'`

### 本日 4 大 commits（從 402d741 → 811d011）

| Commit | Round | 主題 |
|--------|-------|------|
| `0b3ef59` | 37.30 | 修 LLM 把「客服轉報通知」誤傳客戶 + 動態 open_dates + 改 dashboard URL |
| `cc183ae` | 37.31 | **新增 scripts/sync-kb.sh** 補 L3 缺漏的 knowledge/ 檔案 |
| `811d011` | 37.32 | 修 fuzzyTriggers 太寬誤觸發 handoff + 加 regression test |

### 已知未修（Hubert 14:04 / 16:04 明確要求）

1. **Gmail 為何生產沒收到**（dev 測試有收到，token 從 .bak 還原過）
   - 建議下輪用 `deep-research` skill 查 OpenClaw 平台層 secret management 邏輯
   - 已有 `logs/gmail-token-audit.log`（Round 37.30 自動建立）可查 token 寫入歷史
2. **`sync-producer-config.sh` 整合 `sync-kb.sh`**
   - 目前只同步 `chicken.yaml`，未同步 `knowledge/`
   - 應整合讓 cron 每分鐘同步 config + knowledge
3. **對話演練驗證** LLM prompt 修正實際生效

---

_本檔由 Round 37.32（2026-08-06 20:12）大更新_
_下次接手變更必同步更新 §15_

---

## §16 Round 38（2026-08-06 21:11+）— sync 腳本整合 + check-quality 寫死修正

**Hubert 21:11 決策**：整合 5 個 sync 腳本為 3 個，從源頭降低 drift 風險。

### 16.1 新架構（從 5 個變 3 個）

| 舊 | 新 | 範圍 |
|----|----|------|
| `sync-mirror.sh` | `sync-mirror.sh`（保留）| L1 ↔ L2 rsync |
| `sync-producer-config.sh` | `sync-producer-config.sh`（保留）| L1 → L2 chicken.yaml（cron 每分鐘）|
| `sync-canonical.sh` + `sync-kb.sh` | **`sync-runtime.sh`（合併）**| L1 → L3 prompt + KB |
| `sync-config.sh` | `sync-config.sh`（保留）| L1 → L1 config.yaml legacy fallback |

### 16.2 `scripts/sync-runtime.sh`（新 · 6218 bytes）

合併 `sync-canonical.sh` + `sync-kb.sh`：
- **Phase 1**：同步 canonical files（AGENTS/SOUL/main_idea.md）→ L3，含 CANONICAL 標頭備份
- **Phase 2**：同步 KB（knowledge/tenants/*.md，12 檔）→ L3 via rsync
- **參數**：`--canonical` / `--kb` / `--help`
- **加 cron**（讓 prompt + KB 每分鐘自動同步）：
  ```bash
  * * * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/sync-runtime.sh >> /home/clawuser/.openclaw/logs/chicken/sync-runtime.log 2>&1
  ```

### 16.3 `sync-canonical.sh` / `sync-kb.sh` → Deprecated wrappers

保留為 3-line shim（向後相容 cron / 舊文件）：
```bash
echo "⚠️  sync-canonical.sh 已 deprecated (Round 38 整合)"
echo "    請改用: bash scripts/sync-runtime.sh"
exec "$(dirname "$0")/sync-runtime.sh" --canonical "$@"
```

### 16.4 `check-quality.sh` Check 11/12 hardcode 修正

**根因**：Check 11/12 hardcode `docs/production-prompt/2026-07-03/`，但 canonical 在 Round 37.20 已搬到 `2026-08-04/`，導致每次跑都誤報 canonical drift。

**修法**：
```bash
# Round 38：自動偵測 latest/ → 2026-08-04 → 2026-07-03
PP_LOC="$PROJECT_ROOT/docs/production-prompt/latest"
if [ ! -e "$PP_LOC" ]; then
  PP_LOC="$PROJECT_ROOT/docs/production-prompt/2026-08-04"
fi
if [ ! -e "$PP_LOC" ]; then
  PP_LOC="$PROJECT_ROOT/docs/production-prompt/2026-07-03"
fi
PP_BASENAME=$(basename "$PP_LOC")
```

3 處 edits：`PP_LOC` 變數 + 2 個 warning 訊息改用 `$PP_BASENAME`。

### 16.5 external-user exec 權限重賦（Hubert 21:11 操作）

`openclaw.json` 的 `agents.external-user.tools.sandbox.tools.allow` 已加入 `"exec"`。Brought back the ability to run shell commands inside external-user sandbox（如 menu 搜尋 / 老闆通知場景）。`openclaw gateway restart` 已執行。

### 16.6 新發現的 1 大架構鐵律

#### 16.6.1 同步腳本數量 = drift 風險係數
- 5 個 sync 腳本各自有 cron / docs / 維護點 → drift 風險高
- Round 37.31 加 `sync-kb.sh` 就是「drift 後再補」的後遺症（沒人記得每個 sync 覆蓋什麼）
- **修法**：同方向 + 同頻率的 sync 應該合併（這次合 `sync-canonical.sh` + `sync-kb.sh` → `sync-runtime.sh`）
- **經驗**：新增 sync 腳本前先 `grep -rn "sync" scripts/` 看現有覆蓋

---

_本檔由 Round 38（2026-08-06 21:11+）新增 §16_
_下次 sync / check-quality 變更必同步更新 §16_

---

## §17 Round 39（2026-08-06 21:35+）— pre-existing 失敗 + lint + Cron 報告

**Hubert 21:35 指示**：
- 我的文件沒提到 cron jobs → brtclaw 自行瀏覽 + 加背景知識
- 輸出 cron 用處報告寄到 `k.chang.8844@gmail.com`
- A（2 個 pre-existing 失敗）可直接修
- B & C（menu 搜尋 + 老闆通知 / CSV-Sheet-Dashboard 對帳）需拆解後審視
- D（付款方式）延後
- 重要 docs 同步更新

### 17.1 A 路線：2 個 pre-existing check-quality 失敗修整

**修法 1（hardcode）** — `src/knowledge/triggers.js:135`：
```javascript
// 修前（hardcode）
lower.includes('三峽') || lower.includes('鶯歌')

// 修後（從 config 動態讀）
const { getDeliveryRules } = require('../config');
const deliveryRules = getDeliveryRules();
const deliveryAreaKeywords = (deliveryRules.areas && deliveryRules.areas.allowed) || [];
deliveryAreaKeywords.some((kw) => lower.includes(kw))
```
- config `delivery.areas.allowed` 已有：`['三鶯生活圈', '三峽', '鶯歌']`
- 修後行為等價（涵蓋同樣關鍵字），但未來改 config 不必改 code

**修法 2（lint no-multi-spaces）** — `npm run lint:fix`：
- 7 個 error 自動修：`tests/handoff.test.js:163-166` + `tests/transferRules.test.js:182,196,203`
- 2 個 warning 手修：`loader.js:309` `\?` → `??`、`dashboard-server.js:732` `\/` → `/`
- 1 個 arrow-parens warning 手修：`triggers.js:138` 加 `()` around `kw`

**驗證**：
- `check-quality`: **12 通過 / 2 警告 / 0 失敗**（修前 11/1/2）
- `npm test`: 64/64 pass
- `bin/check-drift`: 0 Missing

### 17.2 Cron Jobs 完整背景（25 個 OpenClaw cron）

**已寄出**：messageId `19fd74eea1b5fb1a` 到 k.chang.8844@gmail.com，報告 `/tmp/cron-report.md`（6185 bytes）。

**6 大類**：

| 類別 | 數量 | 關鍵 job |
|------|------|---------|
| **雞味客服專案維運** | 8 | main enforce readonly (3bade756) / cloudflared cleanup (955d61c6) / daily backup (bd933551) / P9 Sheets sync (6033de71) / daily+weekly report (796afb16+dc5afd05) / GCP key age (356045d8) / L2 .bak cleanup (15998630) |
| **Memory / Session** | 4 | Session Context Monitor (351fb7a9) / Memory Archive (deeb8c51) / 每日操作總結 (e15d4164) / Subagent Cleanup (10f04b40) |
| **Threads 自動發文** | 5 | GitHub Trending (e2a069c0) / AM (b01a812b) / PM (61612670) / Weekend 空軍 (a3b785c6) / Weekend 海軍 (70ef6470) |
| **i-En 財經** | 2 | 每 4h (27d05048) / 每週一健康檢查 (dabbab38) |
| **Pain Diary** | 4 | 每日監控 (44897139) / 早安提醒 (bc4357d5) / 晚間提醒 (59b35e4f) / 每週整合 (a92e4f9f) |
| **OpenClaw 系統** | 2 | Release Tracker (85a00b06) / Config Backup (7581765f) |

**已知 stale**（建議清理）：
- `15998630` L2 .bak cleanup — 一次性 cron，下次觸發 2027-07-26 → disable
- `796afb16` / `dc5afd05` 日報 / 週報 — 事件驅動已上線（Round 37.17），這兩個標「測試中」應 disable

### 17.3 B & C 拆解狀態（待 Hubert 審視）

**B 路線：menu 搜尋 + 老闆通知**
- 目前已實作：`triggers.js` `product_query` intent → 載入 `01_product.md`（Round 37.27 全 11 檔 KB 動態加載）；`handoff.js` 14 種觸發條件 → 寄信 + LINE 通知
- 待 Hubert 確認：「menu 搜尋」具體場景？「老闆通知」還需哪些觸發？

**C 路線：CSV ↔ Sheet ↔ Dashboard 對帳**
- 目前已實作：CSV 29 欄、Sheet 29 欄動態映射（Round 37.18）、Dashboard 3 張圖表 + 3 個操作按鈕（Round 37.17）+ 30s 自動刷新（Round 37.15）
- 待 Hubert 確認：優先級順序？mapping / Figures / button / real-time 哪個先？

**D 路線**：延後（Hubert 未提供足夠資訊）

### 17.4 新發現的 1 個架構鐵律

#### 17.4.1 arrow-parens 與 ESLint config 緊密相關
- 預設 ESLint `arrow-parens: "always"` 要求 arrow function 參數加 `()`
- 但 prettier 預設 `"as-needed"` 會去掉單參數的 `()`
- 專案統一用 `arrow-parens: "always"`，未來寫 arrow function 注意 `()` 不可省
- 教訓：lint:fix 後要驗證改動是否符合預期

---

_本檔由 Round 39（2026-08-06 21:35+）新增 §17_
_下次 pre-existing 失敗或 cron 變更必同步更新 §17_

---

## §18 Round 40（2026-08-07）— SQLite Primary DB 整合(Steps 1-6+hotfix)

**Hubert 14:40 同意 + 14:56 / 15:43 接續開發**。Round 40 是雞味客服史最大架構變更：從 CSV-only 雙寫升級為以 SQLite 為 Primary DB 的雙向架構(6 個 Steps + 1 個 hotfix)。

### 18.0 Step 0:按鈕 bug 修補(部署 drift)

**根因**:Round 37.19 token 注入 code 已 commit 到 L1,但 L2 dashboard-server 跑舊版(未 sync-mirror + 未重啟)→ 沒有 `window.__API_TOKEN__` → 按鈕 fetch X-API-Token 是 undefined → 401 被前端吞掉 → 「按了沒反應」。

**修法**:`sync-mirror.sh from-legacy` → `pkill -9 dashboard-server` → 重啟 L2 dashboard-server → `curl /` 驗證 token 注入。

**修前**:POST /api/orders/:id/status → 401 → 前端看起來「沒反應」
**修後**:POST /api/orders/:id/status with X-API-Token → 正常路由

### 18.1 Step 1:DB 基礎建設(commit 87dc969)

**新增**:
- `src/storage/db.js`(282 行):5 個標準 CRUD(initDb / openDb / createOrder / getOrderById / updateOrderStatus / listOrders)+ 32 欄位 schema + 4 indexes + lazy `ensureInitialized()` + 型別轉換
- `tests/db.test.js`(349 行, 17 tests):initDb / createOrder / updateOrderStatus / listOrders / 4 個 integration workflow

**Schema**:對齊 CSV 29 欄 + tracking_number 擴充。核心欄位(order_id PK / line_user_id / customer_name / payment_method / payment_info / payment_status / order_status / tracking_number / total_amount / created_at / updated_at) + 完整欄位 + 4 indexes。

**驗證**:npm test 65/65 pass(原 64 + db.test.js)。

### 18.2 Step 2:雙寫重構(commit 5408aeb)

**修改**:
- `src/order/csvWriter.js` writeOrder 新增 DB 寫入(DB 為主,CSV 備份)+ 失敗處理(MODULE_NOT_FOUND fallback / 其他錯誤 throw)
- `src/storage/sheetsSync.js` collectAllOrders 改讀 DB(mapDbOrderToSheetFormat:customer_name → user_line_name)+ CSV fallback
- `src/storage/db.js` 加型別轉換(boolean → 0/1,Date → ISO)+ ensureInitialized lazy init

**為什麼需要 ensureInitialized**:tests 不傳 db 參數,直接 `db.createOrder(orderData)` → DB module 載入時不會 initDb → 「no such table: orders」錯誤。Lazy init 確保 production DB 首次寫入時自動建表。

**修正的 bug**:測試時 `intent_confirmed: false`(boolean)→ better-sqlite3 不接受 boolean → 加型別轉換修。

### 18.3 Step 3:Dashboard API + UI(commit 72712d9)

**API 改動**(`scripts/dashboard-server.js`):
- `GET /api/recent-orders`:讀 DB(db.listOrders)+ CSV fallback + `customer_name → user_line_name` 映射
- `POST /api/orders/:id/status`:寫 DB(PAID 連動 payment_status='PAID' + order_status='PROCESSING')+ 背景觸發 sheetsSync + LINE push hook
- `POST /api/orders/:id/payment-failed`(新):payment_status='FAILED' + staff_notes 註記 + LINE push hook
- `POST /api/orders/:id/shipped`(新):order_status='SHIPPED' + tracking_number 必填 + LINE push hook

**UI 改動**(`dashboard.html`):
- 4 個按鈕:`✓ PAID` / `✕ FAILED` / `🚚 SHIPPED` / `✕ CANCEL`(加 `mark-payment-failed-btn` class)
- SHIPPED 點擊跳 `prompt('請輸入物流單號')` → POST /shipped
- X-API-Token header 從 `window.__API_TOKEN__` 自動帶

### 18.4 Step 4:LINE Customer Push + 老闆 Email(commit 0106407)

**新增**:
- `src/handoff/linePush.js`(141 行):pushToCustomer / safePushToCustomer(透過 LINE Messaging API https://api.line.me/v2/bot/message/push)+ LINE_BOT_TOKEN 從 env 或 secrets 讀

**修改**:
- `src/order/csvWriter.js`:銀行轉帳(transfer) / 街口付款(jko)下單 → emailNotifier.sendEmail(setImmediate fire-and-forget)
- `scripts/dashboard-server.js` 3 個 endpoint 都加 LINE push hook(PAID / SHIPPED+單號 / PAYMENT_FAILED / CANCELLED)

**Email 內容**:`訂單編號 / 金額 / 付款方式 / 付款資訊 / Dashboard 連結` 寄給 `k.chang.8844@gmail.com`。

**LINE 訊息**:
- PAID:「訂單 {order_id} 已完成付款核對,目前為您備貨中!」
- SHIPPED:「訂單 {order_id} 已出貨!冷鏈物流單號為:{tracking_number}。」
- PAYMENT_FAILED:「訂單 {order_id} 查無此款項,請確認轉帳帳號後五碼或重新提供憑證。」
- CANCELLED:「您的訂單 {order_id} 已成功取消。」

### 18.5 Step 5:OpenClaw Tool(commit 43a3ba1)

**新增**:
- `src/tools/orderStatus.js`(71 行):`get_order_status(line_user_id, opts)` Tool
  - 查詢 DB(不讀 CSV)+ 接受 opts.db 測試用 in-memory DB
  - 回傳 { found, count, orders: [{ order_id, payment_status, order_status, tracking_number, delivery_date, total_amount, ... }] }
- `tests/tools-orderStatus.test.js`(130 行, 6 tests):缺參數 / 非字串 / 查無用戶 / 查詢既有 / limit 生效 / SHIPPED 含 tracking

**註冊方式**(待 Hubert 手動):
- external-user agent 需在 `~/.openclaw/openclaw.json` 加 `tools.allow` 或 `tools.sandbox.tools.allow` 包含此 Tool
- `bash scripts/sync-runtime.sh` 已推 L1 → L3(external-user runtime)

### 18.6 Step 6:部署驗證 + Hotfix(commit ad30c7d)

**部署流程**:
1. `bash scripts/sync-mirror.sh from-legacy`(L1 → L2, 376KB sent)
2. `bash scripts/sync-runtime.sh`(L1 → L3 KB+Tool, 12 個 .md)
3. `pkill -9 -f dashboard-server` + `nohup node scripts/dashboard-server.js`(注意:SIGKILL 可能影響 exec shell,建議用 SIGTERM)
4. `curl /healthz` 驗證 200
5. `curl /` with X-API-Token 驗證 token 注入

**Hotfix**:PAID status 漏列 validStatuses
- 修前:POST /api/orders/:id/status {status:'PAID'} → 400 invalid status
- 修後:validStatuses 加 'PAID',handler 內部 PAID → payment_status='PAID' + order_status='PROCESSING'

### 18.7 新發現的 5 大架構鐵律

#### 18.7.1 部署 drift = 按鈕沒反應
- L1 commit ≠ L2 running(sync-mirror + restart 是必要步驟)
- 健康檢查 `curl /healthz` 只驗證服務 up,**不驗證 token 注入**
- **修法**:部署 SOP 必加 `curl /` with auth → grep __API_TOKEN__

#### 18.7.2 lazy init 避免測試污染
- `ensureInitialized()` 用 module-level flag,只對 production DB 生效
- 測試傳 `:memory:` DB → 跳過 lazy init(測試自行管理 schema)
- **教訓**:production DB 模組不要在 module load 時 initDb(會跟測試打架)

#### 18.7.3 SQLite type coercion 不可省
- better-sqlite3 只接受 number / string / bigint / buffer / null
- JS boolean / Date / object 必須轉換
- **修法**:createOrder 入口加型別轉換層(boolean → 0/1,Date → ISO,object → JSON.stringify)

#### 18.7.4 測試隔離需要支援 external DB
- `db.listOrders(opts, externalDb)` 第二參數讓測試傳 in-memory DB
- Tool 模組(`get_order_status`)要向下相容:接受 `opts.db` 用測試 DB
- **教訓**:production module 一開始就設計測試隔離機制,事後改成本高

#### 18.7.5 dashboard 在 / 不是 /dashboard
- 我測試時用 `curl /dashboard` → 404
- 正確:`curl /`(dashboard-server line 542: `url === '/' || url.startsWith('/?')`)
- **教訓**:health check 端點優先用 `/healthz`,前端用 `/`,不要亂猜

### 18.8 改動統計(Round 40 全部)

| Step | commit | files | +/- |
|------|--------|-------|-----|
| 1 | 87dc969 | 5 | +660 / -3 |
| 2 | 5408aeb | 3 | +100 / -4 |
| 3 | 72712d9 | 2 | +172 / -37 |
| 4 | 0106407 | 3 | +216 / -0 |
| 5 | 43a3ba1 | 2 | +201 / -0 |
| 6 | ad30c7d | 1 | +1 / -1 |
| docs | (pending) | 2 | +TBD |
| **總計** | **6 commits + 1 docs** | **~16** | **+1350 / -45** |

### 18.9 下次接手注意

- **external-user agent** 需手動在 `openclaw.json` 註冊 `src/tools/orderStatus.js`(openclaw.json 格式有 comments,jq 解析失敗,需手動編輯)
- **DB migrate script** 還沒寫(現有 CSV-only 訂單不會自動 import DB)— Round 41+ 可加 `scripts/migrate-csv-to-db.js`
- **test fixture 清理**:npm test 會在 in-memory DB 建立測試訂單(不污染 production DB),但 handoff test 可能寫到 production DB(注意 cleanup)
- **PAID 連動 payment_status + order_status**:未來 dashboard 若要拆開設兩個狀態,validStatuses 需重構

---

_本檔由 Round 40（2026-08-07 15:43+）新增 §18_
_下次 SQLite / Dashboard / Tool 變更必同步更新 §18_