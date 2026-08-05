# Gmail + Google Sheets 工作流

> **最後更新**：2026-08-05 13:12（Round 37.20 docs 大更新）
> **本檔定位**：Gmail OAuth + Google Sheets 整合的完整工作流文件
> **範圍**：service account JWT、事件驅動同步、動態表頭映射

---

## §1 測試標準（強制 · Round 35+ 教訓整合）

### 1.1 禁止跑互動式 Setup 腳本作 health check

❌ **禁止**：
- `node scripts/gmail-auth.js`（會 block 等 browser OAuth callback）
- 任何 `readline` / `prompt()` / `open browser redirect` 的腳本

### 1.2 必須發送實體 API 測試呼叫

✅ **必須**：

| 服務 | 測試方式 | 預期 |
|------|----------|------|
| Gmail | `sendEmail()` 真實寄信 + 檢查 exit code / log | success + messageId |
| Sheets | `syncOrdersToSheets({dryRun:false})` 真實同步 | `rowsWritten > 0` + Sheet row 更新 |
| Dashboard API | `curl -H "X-API-Token: ..." /api/orders/:id/status` | `HTTP/1.1 200 OK` |

### 1.3 結果標示準則

- **Live Pass** ✅：真實 API 呼叫 + 收到 2xx + log 記錄
- **Fail** ❌：API 回 4xx/5xx 或連線錯誤 + 錯誤訊息
- **未驗證** ⚠️：不適用上面兩個（沒測就不能下結論）

### 1.4 錯誤回報必須附 raw output

- `ls -la` 完整結果
- `sendEmail()` 回傳值
- API response code + body
- 不接受「我覺得 Fail」/「看起來 fail」的臆測

---

## §2 Google Sheets 整合（Service Account JWT · Event-Driven · Dynamic Header）

**狀態**：✅ **Live Pass**（Round 37.17 事件驅動 + Round 37.18 動態表頭映射）

### 2.1 架構演進

| Round | 架構 | 觸發時機 |
|-------|------|----------|
| 37.6-37.16 | 手動 `node -e "syncOrdersToSheets()"` 觸發 | 開發者手動 |
| 37.17 | **事件驅動**（`csvWriter._triggerSheetsSync`） | writeOrder 後 `setImmediate` 自動背景觸發 |
| 37.18 | + **動態表頭映射**（`buildSheetRowsWithLiveHeader` + `headerMap`） | 每次 sync 前讀 Sheet 實際 Header Row 1 |

### 2.2 Service Account 認證（JWT · Round 37.6）

**位置**：`/home/clawuser/.config/chicken/secrets/google-service-account.json`

**內容**（service account JSON）：
```json
{
  "type": "service_account",
  "project_id": "chicken-customer-service",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "clawbrt@gmail.com",
  ...
}
```

**chicken.yaml 設定**：
```yaml
storage:
  phase2:
    enabled: false            # Round 37.18：預設 false，事件驅動繞過此檢查
    type: google_sheets
    spreadsheet_id: '12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA'
    sheet_name: '工作表1'    # ⚠️ 簡體（不是「工作表一」）
    auth:
      type: 'oauth_service_account'
      credentials_path: '/home/clawuser/.config/chicken/secrets/google-service-account.json'
```

**JWT 簽章流程**（`getAccessToken()`）：
1. Header: `{ alg: 'RS256', typ: 'JWT' }`
2. Payload: `{ iss, scope, aud, iat, exp }`
3. Signature: `RS256(header.payload, private_key)`
4. POST 到 `https://oauth2.googleapis.com/token` 換 `access_token`
5. `access_token` 1 小時過期，需 refresh

### 2.3 事件驅動同步（Round 37.17）

**檔案**：`src/order/csvWriter.js`

```javascript
function _triggerSheetsSync(reason) {
  setImmediate(() => {
    const sheetsSync = getSheetsSync();
    sheetsSync.syncOrdersToSheets({ dryRun: false, forceSync: true })
      .then((result) => logger.info(`Sheets 同步 (${reason}) 完成: ${result.rowsWritten} rows`))
      .catch((err) => logger.error(`Sheets 同步 (${reason}) 失敗:`, err.message));
  });
}

function writeOrder(orderData) {
  // ... 寫 CSV ...
  _triggerSheetsSync('writeOrder');  // ← 5 秒內自動同步到 Sheet
  return result;
}
```

**觸發時機**：
1. `csvWriter.writeOrder()` 每次成功 → 背景 `setImmediate` 觸發
2. `dashboard-server` POST `/api/orders/:id/status` → 透過 writeOrder 觸發
3. `scripts/sync-mirror.sh` → cron `P9 Sheets 同步` 6033de71（每天 03:00）

### 2.4 動態表頭映射（Round 37.18 · 杜絕固定 offset）

**檔案**：`src/storage/sheetsSync.js`

```javascript
// 1. ordersToSheetValues(orders, liveHeader) — sync 函式
function ordersToSheetValues(orders, liveHeader) {
  const SHEET_HEADER = [/* 29 欄 */];
  const useHeader = liveHeader || SHEET_HEADER;
  
  // 2. 建立 headerMap[colName] = columnIndex
  const headerMap = {};
  useHeader.forEach((colName, idx) => { headerMap[colName] = idx; });
  
  // 3. 動態填入（CSV 多出欄位 → 丟棄）
  const rows = [useHeader];
  for (const o of orders) {
    const row = new Array(useHeader.length).fill('');
    Object.keys(o).forEach((key) => {
      if (!(key in headerMap)) return;   // 丟棄
      const idx = headerMap[key];
      row[idx] = (v === null) ? '' : ...;
    });
    rows.push(row);
  }
  return rows;
}

// 4. async wrapper — 讀 Sheet 實際 Header + 呼叫 ordersToSheetValues
async function buildSheetRowsWithLiveHeader(orders, accessToken, spreadsheetId, sheetTitle) {
  const headerRes = await getSheetHeader(accessToken, spreadsheetId, sheetTitle);
  const liveHeader = headerRes?.values?.[0] || null;  // ['order_id', 'created_at', ...]
  return ordersToSheetValues(orders, liveHeader);
}
```

**29 欄 Header 順序**：
```
order_id, created_at, user_line_name, user_phone, address, community,
delivery_date, time_slot, chicken_items, side_items, extra_items,
chicken_count, side_count, total_boxes, subtotal, delivery_fee,
total_amount, payment_method, payment_status, order_status, staff_notes,
customer_notes, customer_tags, handoff_type, handoff_logged_at,
handoff_resolved_at, source, intent_confirmed, receipts_path
```

### 2.5 強制同步指令（手動 trigger）

```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
node -e "require('./src/storage/sheetsSync').syncOrdersToSheets({dryRun:false, forceSync:true})"
```

---

## §3 Gmail 整合（OAuth 2.0 Loopback Flow）

**狀態**：✅ **Live Pass**（Round 37.9 token 自動還原 + Round 37.17 handoff email trigger）

### 3.1 OAuth 認證流程

**位置**：`/home/clawuser/.config/chicken/secrets/gmail-credentials.json` + `gmail-token.json`

**Setup 流程**（一次性，需要 GUI 環境）：
1. 確認有 `gmail-credentials.json`（OAuth client_id / client_secret）
2. 跑 `node scripts/gmail-auth.js`（會彈瀏覽器 OAuth 同意畫面）
3. 取得 `gmail-token.json`（含 refresh_token + access_token）
4. **不要 commit 到 git**（gitignore 已排除）

**Refresh 機制**（Round 37.9 終極結案）：
- access_token 過期 → 用 refresh_token 自動換新 + 存回 token.json
- 主 token 檔不存在 → 自動從 `.bak` 還原
- 每次 saveToken 都同步備份 `.bak`（雙重防護）

### 3.2 發信 API（`emailNotifier.js`）

```javascript
const { sendEmail } = require('./src/handoff/emailNotifier');

sendEmail({
  to: 'k.chang.8844@gmail.com',
  subject: '【雞味研究所】🔔 轉真人通知',
  body: '...',
}).then(r => console.log(r.messageId));   // r.success === true
```

### 3.3 Handoff 觸發（`notifier.js` Round 37.18）

客戶訊息命中 14 種 handoff 觸發詞（退款 / 品質問題 / 配送異常 等）→ 自動寄信 + 寫 CSV handoff 列。

### 3.4 測試（不需 GUI）

```bash
# 不需真實寄信（會被 testSafeHttps 攔截）
NODE_ENV=test npm test -- --test-name-pattern="emailNotifier"
```

---

## §4 整合現況對照表

| 整合 | 狀態 | 觸發 | 認證 | 最後驗證 |
|------|------|------|------|----------|
| **Sheets 寫入** | ✅ Live Pass | 事件驅動（writeOrder 後）+ cron 03:00 | service account JWT | Round 37.17 LIVE TEST（TEST-LIVE-R3717v3 → Sheet row 731） |
| **Sheets 讀取（Header）** | ✅ Live Pass | syncOrdersToSheets 每次執行前 | service account JWT | Round 37.18 動態表頭映射 |
| **Gmail 寄信** | ✅ Live Pass | Handoff 觸發 + 手動 | OAuth 2.0 refresh_token | Round 37.17 LIVE TEST（Message ID 19fcf6e49b2ea3f7） |
| **Dashboard API 寫入** | ✅ Live Pass | Dashboard 按鈕 + curl X-API-Token | Basic Auth + X-API-Token | Round 37.19 LIVE TEST（curl 200 OK） |

---

## §5 歷史教訓（為何這份文件存在）

### Round 35 教訓：Hubert 抓包 brtclaw 跑互動式 OAuth 當 health check
- 互動式 OAuth script block = 等待 ≠ 損壞
- 必須用真實 API 呼叫驗證（不是看 process 沒死就算成功）

### Round 37.4 教訓：Hubert 抓包 Claude Code 靜態假圖
- Dashboard 圖表若 hardcoded labels = 靜態假圖，立即修
- 必須用真實 API / 數據驗證後才算完成

### Round 37.8 教訓：客戶問價格，AI 沒讀 01_product.md
- main_idea.md §三-3a 價格回答鐵律（Round 37.16 新增）
- 客戶問價格 → 必讀 01_product.md → 列所有品項

### Round 37.9 教訓：Gmail token 自動還原
- 主 token 檔不存在 → 自動從 .bak 還原
- saveToken 每次都同步備份 .bak
- `loadCredentials` / `loadToken` 失敗時妥善處理

### Round 37.13 教訓：兩條菜單路由衝突
- 靜態 P0.4 路由 vs 新 R2 路由搶同一 query
- 修法：刪舊留新，用 grep 互斥路由偵測

### Round 37.17 教訓：事件驅動 Sheets 同步
- 原本 `phase2.enabled = false` 阻擋 sync
- 解法：加 `forceSync` option 跳過阻擋（事件驅動專用）
- 維持「預設行為仍遵守 phase2 開關」（向後相容）

### Round 37.18 教訓：fixed offset 硬編碼
- 原本 Sheet 寫入用 `SHEET_HEADER.indexOf('order_id')` 固定索引
- 風險：Sheet header 順序變 → 資料錯位
- 解法：讀 Sheet 實際 Header Row 1 + 動態 `headerMap[colName] = index`

### Round 37.19 教訓：API Token 注入
- 前端 `window.__API_TOKEN__` 為空 → POST 401
- 解法：dashboard-server serve HTML 時注入 + checkAuth 接受 X-API-Token header

---

_本檔由 Round 37.20（2026-08-05 13:12）大更新_
_下次整合變更必同步更新 §4 狀態表 + §5 教訓_