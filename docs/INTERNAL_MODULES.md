# 內部模組說明（P6 + P9 + P5）

> **建立**：2026-07-25（Round 26）
> **維護者**：brtclaw
> **last_updated**：2026-07-25
> **範圍**：`src/storage/sheetsSync.js`、`src/handoff/receiptAnalyzer.js`、`src/handoff/autoOrder.js` 三個非核心流程模組

---

## 1. `src/storage/sheetsSync.js`（P9 · 2026-07-16 加）

### 用途
讀取雞味訂單 CSV → 寫入 Google Sheets，用於 Hubert 從 Sheets 看訂單總覽（非客服即時流程）。

### 觸發方式
- **手動**：`node scripts/sheets-sync-cron.js`（CLI）
- **Cron**：`0 3 * * *` 每日 03:00（OpenClaw cron `6033de71`）

### 認證
- OAuth 2.0 service account（JSON key file）
- **獨立 Google 帳號**：`clawbrt@gmail.com`（不與 `kaden1122123@gmail.com` 共用，避免個人帳號污染）
- Key 位置：`/home/clawuser/.config/chicken/secrets/google-service-account.json`（mode 600）

### Setup
```bash
bash scripts/setup-google-sheets.sh   # 首次設定（取得 service account JSON）
```

### 為何獨立帳號
- 服務帳號（service account）≠ 個人 Google 帳號
- 個人帳號綁定 LINE 通知、Drive 個人檔案
- 服務帳號只負責 Sheets 寫入，隔離污染風險

### 健康檢查
- 每月 1 號 09:00 自動檢查 key age（OpenClaw cron `356045d8` + `scripts/key_age_check.sh`）
- 結果通知 Discord channel `1528418702167638016`

---

## 2. `src/handoff/receiptAnalyzer.js`（P6 · 2026-07-16 加）

### 用途
分析顧客上傳的轉帳/街口支付截圖，提取金額、帳號末五碼，用於對比訂單 `expected_amount` 並標記 `likely_paid`。

### 支援 4 種支付方式
| 方式 | 是否走 OCR | 流程 |
|------|-----------|------|
| 現金 | ❌ | 依現金規則，後續貨到付款（標記 `source: 'cash_skip'`）|
| 轉帳 | ✅ | 客戶轉帳後回傳截圖 → 對比 expected amount → likely_paid |
| 街口支付 | ✅ | P4 推 QR code 後，客戶付款回傳截圖 → 對比 → likely_paid |
| LINE Pay | ✅ | 落後選項不主動提供，客戶詢問才給老闆 LINE ID |

### Vision Provider
- **目前**：`minimax`（透過 OpenClaw Gateway，預設 `http://127.0.0.1:18789`）
- **抽象層**：`analyzeWithVision()` 函式
- **換 provider**：只需改 `analyzeWithVision()` 實作，不影響 `analyzeReceipt()` 介面

### Stub Mode
- 若 vision API 失敗 → 回傳 `confidence: 0` → 標記人工審核（避免誤判）
- 失敗原因：Gateway 離線、timeout、provider 配額滿

### 結果欄位（CSV）
```js
{
  likely_paid: true/false,
  detected_amount: 380,
  detected_account_last5: '12345',
  confidence: 0.92,        // 0 = 人工審核, 1 = 完全相符
  source: 'minimax_vision',
  note: '...'
}
```

### 用法
```js
const { analyzeReceipt } = require('./src/handoff/receiptAnalyzer');
const result = await analyzeReceipt({
  imagePath: 'data/receipts/PENDING-123/transfer.png',
  orderContext: { total_amount: 380, payment_method: 'transfer' }
});
```

---

## 3. `src/handoff/autoOrder.js`（P5 · 2026-07-14 加）

### 用途
當客戶確認訂單訊息觸發「是 / 對 / 確認」等關鍵字時，自動呼叫 `csvWriter.writeOrderWithRetry()` 寫入訂單 CSV，無需人工介入。

### 觸發關鍵字（strict confirmation）
- 「是」「對」「確認」「ok」「好」「可以」「沒問題」「OK」等
- 詳見 `src/handoff/autoOrder.js` 的 `isStrictConfirmation()`

### 安全機制
- **冪等**：同一訂單重複確認不會重複寫入（`order_id` 唯一）
- **retry**：CSV 寫入失敗自動 retry 3 次（`writeOrderWithRetry`）
- **fallback**：retry 仍失敗 → 進入 `pending_handoff` 狀態 + 通知 Hubert

### 用法
```js
const { triggerAutoOrder, isStrictConfirmation } = require('./src/handoff/autoOrder');

if (isStrictConfirmation(userMessage)) {
  const result = await triggerAutoOrder(orderData);
  // result: { written: true, order_id, csv_path } 或 { written: false, reason: 'pending_handoff' }
}
```

---

## 三者關係圖

```
客戶訊息 (LINE)
   ↓
[autoOrder]    ─── 確認關鍵字 ──→  [csvWriter]  ──→ data/orders/chicken/YYYY-MM-DD.csv
   ↓ 截圖                                ↓
[receiptAnalyzer] ──→ 對比金額 ──→ mark likely_paid
                                          ↓
                                  [sheetsSync]（每日 03:00）──→ Google Sheets
```

---

## 相關文件
- `docs/OPERATIONS.md` §1 — 3 層位置架構（secrets 位置）
- `docs/EMAIL_SETUP.md` — Gmail OAuth 流程（與 Sheets 認證類似）
- `docs/CEO_DECISION_GUIDE.md` — 4 個關鍵決策
- `docs/KNOWN_ISSUES.md` F1~F4 — hardcode 問題（與本模組無關，但供未來參考）

---

_本檔由 brtclaw 維護，Round 26 2026-07-25 建立_
