# 雞肉團購 AI 客服 — Phase 1 實作規格書
更新時間：2026-06-27（v1.1 partial update）
維護者：brtclaw
last_updated：2026-07-27（Round 27 確認仍適用，無改動）

> ⚠️ **本文件為 Phase 1 規格書**，最新進度見 [`docs/.archive/PHASE1_PROGRESS.md`](./docs/.archive/PHASE1_PROGRESS.md)（已歸檔）。
> **Source of truth**：`src/order/csvWriter.js`（CSV schema）、`config/tenants/chicken.yaml`（狀態值）、`src/knowledge/loader.js`（知識庫路徑）。

---

## 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-06-13 | 初始規格書 |
| v1.1 | 2026-06-27 | **Session C C5 partial update**：CSV 27→28 欄、補 order_status 6 個狀態、補 src/ 角色修正、補 v1.1 known deviations |

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
**28 欄位（2026-06-27 v1.1 update，以 csvWriter.js CSV_HEADERS 為準）：**
```
order_id, created_at, user_line_name, user_phone, address, community,
delivery_date, time_slot,
chicken_items, side_items, extra_items,
chicken_count, side_count, total_boxes,
subtotal, delivery_fee, total_amount,
payment_method, payment_status, order_status,
staff_notes, customer_notes, customer_tags,
handoff_type, handoff_logged_at, handoff_resolved_at,
source, intent_confirmed
```

> **v1.1 修正**：v1.0 為 27 欄位，2026-06-13 改為 28 欄位（加 `intent_confirmed`）。本檔原寫 27 欄位為誤，已修正。Source of truth：`src/order/csvWriter.js` 的 `CSV_HEADERS`。

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

## v1.1 Known Deviations（2026-06-27 Session C C5）

> 本段記錄 v1.0 (2026-06-13) 之後到 v1.1 (2026-06-27) 之間的結構性變更，與 v1.0 規格的偏差。

### src/ 角色（2026-06-27 Session B B3 修正）
- **v1.0 描述**：`src/` 是 production runtime
- **v1.1 修正**：`src/` 是「設計驗證 + 測試對象」，**不是** production runtime
- **Production runtime**：`~/.openclaw/agents/external-user/` 的 OpenClaw agent（SOUL.md + AGENTS.md + knowledge/main_idea.md 驅動）
- **src/ 用途**：把 prompt 邏輯模組化拆解為可 unit test 的程式碼

### 多租戶架構（2026-06-15 階段 3）
- 設定路徑：`config/tenants/{tenant_id}.yaml`（預設 `chicken`）
- 知識庫路徑：`knowledge/tenants/{tenant_id}/`（**Session C C2 後**：移除 `knowledge/base/` fallback）
- 環境變數 `TENANT_ID` 切換租戶
- 多租戶設計詳見 `docs/MULTI_TENANT_DESIGN.md`

### Config 介面化（2026-06-26 P2-5）
- `src/config.js` 提供統一介面（`getOpenDates()`、`getLineBotToken()` 等）
- 取代過去各模組自己 regex 解析 `config.yaml`
- 詳見 `tests/config-interface-adoption.test.js`

### order_status 狀態值（6 個，與 config.yaml 對齊）
```
new → confirmed → preparing → delivered → completed
                            └→ cancelled（任何階段可取消）
```

### payment_status 狀態值（3 個）
```
pending → paid → confirmed
```

### 其他 v1.0 → v1.1 變更
- 知識庫重構：`main_idea.md` 內容遷移至 `knowledge/tenants/chicken/*.md`（2026-06-11）
- Cloudflare Worker 部署：Version `ef63e075`（6/14）→ `190c15e1`（6/16，含 postback 處理）
- 新訂單流程（6/16）：API server + Worker postback + 刪除 order-listener
- 雙位置架構（6/15）：原位置 = git + 開發入口；主位置 = production runtime。詳見 `NEW_SESSION_README.md`

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
