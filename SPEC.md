# 雞肉團購 AI 客服 — Phase 1 實作規格書
更新時間：2026-06-13
維護者：brtclaw

---

## 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-06-13 | 初始規格書 |

---

## P1-1｜測試帳號白名單過濾

### 目標
只有白名單內的 LINE user ID 可以跟 Bot 互動，其他人回覆制式話術。

### config.yaml 新增欄位
```yaml
security:
  allowed_line_users:
    - "Uf56650056d35626deb64165926a26182"  # Hubert
  block_others: true
```

### 實作
- 新增 `src/middleware/whitelist.js`
  - 匯入 `allowed_line_users` + `block_others`
  - `checkWhitelist(userId)` → `true`=在白名單，`false`=阻擋
  - `block_others: true` 且不在白名單 → 回覆制式話術並 `return null`
- `src/index.js` 的 `handleWebhookEvent` 最前方插入 whitelist check

### 制式話術（阻擋回覆）
```
此服務目前僅供測試，感謝理解 🐔
有問題請聯繫：LINE 社群 @620boqol
```

---

## P1-2｜LINE Profile API 快取（TTL 10min）

### 目標
每次 webhook 事件取回真實 `lineDisplayName`，寫入 CSV/通知，不出現 `Unknown`。

### 新增檔案
`src/utils/lineProfileCache.js`

### 快取規格
- TTL: 10 分鐘（600,000 ms）
- Key: `userId`
- Value: `{ displayName, pictureUrl, cachedAt }`
- API 失敗時：回傳過期快取（即使過期），並在 log 標記 `warn`

### LINE Profile API
```
GET https://api.line.me/v2/bot/profile/{userId}
Authorization: Bearer {LINE_BOT_TOKEN}
```

### 應用場景
| 場景 | 應用方式 |
|------|---------|
| CSV寫入（`csvWriter.js`）| `orderData.lineDisplayName` 寫入 `user_line_name` 欄位 |
| 轉真人通知（`handoff.js`）| 通知抬頭「{lineDisplayName} 請求轉真人」 |
| 所有對話記錄 | 一律使用 `lineDisplayName`，禁止 `Unknown` fallback |

### 嚴禁 fallback 到 'Unknown'
所有使用 `lineDisplayName` 的地方，**禁止** fallback 到 `'Unknown'`。若 cache 和 API 都失敗，log `error` 並使用 `'LINE用戶'` 作為最後 fallback。

---

## P1-3｜取消意圖區分（取消產品 vs 取消訂單）

### 目標
區分「取消整筆訂單」（轉真人）vs「取消單一產品」（引導式回覆）。

### 判斷邏輯
```
IF (訊息包含「取消」意圖) THEN
  IF (目前狀態 == CONFIRMING 或 AWAITING_PAYMENT) THEN
    → 轉真人（已成立訂單，取消需人工處理）
  ELSE IF (目前狀態 == AWAITING_INFO 且 訂單內產品數 > 1) THEN
    → 回覆「請告訴我想移除哪一項」（引導式，不轉真人）
  ELSE IF (目前狀態 == AWAITING_INFO 且 訂單內產品數 == 1) THEN
    → 問「確定要取消嗎？」
  ELSE
    → 忽略
```

### cancel_request patterns 新增
```javascript
/我要取消（整筆|這個|全部）訂單/i
/想要取消（整筆|這個|全部）訂單/i
/取消整筆/i
/不訂了/i
```

### 移除過於模糊的 keyword
移除單獨的 `['取消']` keyword（太廣義，會誤觸「取消資格」等）。

---

## P1-4｜欄位命名統一

### 統一欄位名（所有模組強制使用）
| 意義 | 統一欄位名 | 備註 |
|------|-----------|------|
| LINE顯示名稱 | `lineDisplayName` | 從 Profile API |
| 電話 | `user_phone` | |
| 地址 | `address` | |
| 社區/公司 | `community` | |
| 開團日期 | `delivery_date` | |
| 時段 | `time_slot` | |
| 雞肉品項 | `chicken_items` | Array |
| 小菜品項 | `side_items` | Array |
| 加購品 | `extra_items` | Array |
| 商品小計 | `subtotal` | number |
| 運費 | `delivery_fee` | number |
| 訂單總金額 | `total_amount` | number |
| 付款方式 | `payment_method` | |
| 付款狀態 | `payment_status` | pending/paid/confirmed |
| 訂單狀態 | `order_status` | new/confirmed/preparing/delivered/completed/cancelled |
| 客戶備註 | `customer_notes` | |
| 員工備註 | `staff_notes` | |
| 轉真人類型 | `handoff_type` | |

### 錯誤：rules/index.js 使用 `orderData.phone`
**修正：** `orderData.phone` → `orderData.user_phone`

### 錯誤：index.js 使用 'Unknown' fallback
**修正：** 移除 `userProfile.lineDisplayName` 的 `'Unknown'` fallback，改由 `lineProfileCache.js` 處理。

### CSV Schema（`csvWriter.js`）
**27 欄位（2026-06-26 更新，與 csvWriter.js 完全對齊）：**
```
order_id, created_at, user_line_name, user_phone, address, community,
delivery_date, time_slot, chicken_items, side_items, extra_items,
chicken_count, side_count, total_boxes, subtotal, delivery_fee, total_amount,
payment_method, payment_status, order_status, staff_notes, customer_notes,
customer_tags, handoff_type, handoff_logged_at, handoff_resolved_at,
source, intent_confirmed
```

---

## P1-5｜知識庫觸發整合

### 目標
讓 `triggers.js` 的意圖偵測在 `index.js` 實際被使用。

### triggers.js 新增
```javascript
function loadKnowledgeForIntent(intent) {
  // 根據 intent 回傳對應知識庫檔案內容
  // 使用 fs.readFileSync lazy load
}
```

### index.js IDLE 狀態加強
```javascript
const intent = guessIntent(cleanMessage);
if (intent) {
  const kbContent = loadKnowledgeForIntent(intent);
  // 附加到 context，供後續狀態處理使用
}
```

### intent → 知識庫檔案對照
| intent | 知識庫檔案 |
|--------|----------|
| order_start | 02_order_flow.md, 03_payment.md |
| product_query | 01_product.md |
| delivery_check | 04_delivery.md, 02_order_flow.md |
| date_check | 02_order_flow.md |
| payment_info | 03_payment.md |
| faq | 06_faq.md |

---

## 實作順序
1. `lineProfileCache.js`（基礎設施）
2. `whitelist.js`（安全基本盤）
3. P1-4：欄位統一（rules/index.js + index.js fallback）
4. P1-2：整合 lineDisplayName 進 CSV + 通知
5. P1-3：cancel 意圖加強
6. P1-5：知識庫觸發整合
7. SPEC.md 本規格書寫入專案

---

## Git commit 規劃
```
P1-1: feat: add LINE profile cache (TTL 10min) + whitelist middleware
P1-2: feat: integrate lineDisplayName into CSV, handoff, notifications
P1-3: fix: tighten cancel_request patterns, distinguish cancel-order vs cancel-product
P1-4: refactor: unify orderData field names across all modules
P1-5: feat: integrate knowledge base triggers into index.js
```
