# 雞肉團購客服 — 實作審查指南

> 快速審查 Phase 1 實作品
> 維護者：brtclaw
> 更新時間：2026-07-03（Hubert 17:18 drift 修整 + 49 套對齊）
> Single Source of Truth：`src/order/csvWriter.js` 第 17-44 行 `CSV_HEADERS`

---

## 審查前置確認

- ✅ **src/ 角色**：`src/` 是「設計驗證 + 測試對象」，**不是 production runtime**。
  Production 跑 `~/.openclaw/agents/external-user/`（OpenClaw agent）。
- ✅ **CSV 欄位數**：以 `csvWriter.js` 為準，目前 **28 欄**。
- ✅ **測試套數**：以 `tests/*.test.js` + `scripts/dashboard-server-test.js` 為準，目前 **49 套（48 unit + 1 integration）**
  - 2026-06-29 Session I 加 api-server-hardening.test.js + dashboard-server-yaml-patch.test.js（2 套 unit）
  - 2026-06-29 Session K 加 logger.test.js（15+ 測試 unit）
  - 2026-07-01 Session H8 補 13 個 src/ 模組專屬測試（4 commits）
  - 2026-07-01 Session X1/X3/X4/X5 各 1-2 套測試
  - 2026-07-01 Session J 加 session-j-architecture regression test
  - 2026-07-01 Session D3/D4 加 d3-payment-options-dynamic.test.js + d4-phase2-stub.test.js（2 套 unit）
  - 整合測試：`scripts/dashboard-server-test.js`（CSV 讀取 + dashboard server 啟動驗證,跑在 `npm run test:all`）
  - **驗證指令**：`ls tests/*.test.js | wc -l` 應輸出 48

---

## 審查清單（每項 5 分鐘內可確認）

### ✅ 1. 規則引擎（8 個）

| 規則 | 檔案 | 測試覆蓋 |
|------|------|---------|
| 地址驗證（三峽/鶯歌） | `src/rules/addressRule.js` | `tests/address-dynamic-keywords.test.js`、`tests/address-handoff.test.js` |
| 電話驗證（09 開頭 10 位） | `src/rules/phoneRule.js` | `tests/rules.test.js` |
| 品項驗證 | `src/rules/menuRule.js` | `tests/rules.test.js`、`tests/parse-items-dedup.test.js` |
| 日期驗證 | `src/rules/dateRule.js` | `tests/rules.test.js`、`tests/date.test.js` |
| 時段驗證 | `src/rules/timeSlotRule.js` | `tests/rules.test.js` |
| 付款驗證 | `src/rules/paymentRule.js` | `tests/rules.test.js` |
| 金額計算 | `src/rules/priceRule.js` | `tests/rules.test.js` |
| 規則總管 | `src/rules/index.js` | — |

**快速驗證：**
```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
node tests/rules.test.js
```
預期：`ALL RULES TESTS PASSED ✓`

---

### ✅ 2. Human Handoff 觸發（14 種條件）

**快速驗證：**
```bash
node tests/handoff.test.js
node tests/handoff-customer-reply.test.js
```
預期：`ALL HANDOFF TESTS PASSED ✓` + `ALL HANDOFF CUSTOMER REPLY TESTS PASSED ✓`

**14 種條件對照（與 `config.yaml` 同步）：**

| 等級 | 條件 | 觸發關鍵字範例 |
|------|------|--------------|
| L1 | 退款要求 | 「我要退款」、「退錢」、「退貨」 |
| L1 | 取消訂單 | 「不訂了」、「取消吧」 |
| L1 | 改天需求 | 「改到明天」、「換日期」 |
| L1 | 抱怨/客訴 | 「雞肉壞了」、「太慢」 |
| L1 | 態度激動 | 「叫你老闆來」 |
| L1 | 明確要求真人 | 「叫真人來」、「不要AI」 |
| L2 | 折扣請求 | 「便宜點」、「打個折」 |
| L2 | 配送範圍確認 | （地址驗證失敗時觸發） |
| L2 | 大批訂單 | 「公司訂購」、「大量採購」 |
| L2 | 金額異常（>NT$3,000） | （金額計算時觸發） |
| L3 | 付款異常 | 「金額不符」、「轉錯」 |
| L3 | LINE Pay 失敗 | 「LINE Pay 失敗」、「付不了」 |
| L3 | 開團日期確認 | 「這週有開嗎」 |
| L3 | 截單後變更 | 「再追加」、「加一盒」 |

---

### ✅ 3. 狀態機（7 個 state value，6 個獨立檔案）

```
IDLE → AWAITING_INFO → CONFIRMING → AWAITING_PAYMENT → COMPLETED
        ↓                                    ↓
        REASK_INFO                       HUMAN_HANDOFF
```

**注意**：REASK_INFO 是 state **value**，不是獨立檔案。驗證失敗時由 `stateMachine.js` 的 REASK_INFO case 處理，不需要專屬檔案。

| State / 檔案 | 檔案 | 職責 |
|------|------|------|
| IDLE | `src/states/idle.js` | 偵測訂購意圖 |
| AWAITING_INFO | `src/states/awaitingInfo.js` | 收集欄位 + 驗證 |
| REASK_INFO | （由 `awaitingInfo.js` + `stateMachine.js` 共同處理）| 驗證失敗時的 state value |
| CONFIRMING | `src/states/confirming.js` | 展示摘要 + 確認 |
| AWAITING_PAYMENT | `src/states/awaitingPayment.js` | 等付款證明 |
| HUMAN_HANDOFF | `src/states/handoff.js` | 安全閘：寫 CSV → 回覆 → 通知 |
| COMPLETED | `src/states/completed.js` | 寫入 CSV + 感謝 |

**快速驗證：**
```bash
node tests/states.test.js
```
預期：`ALL STATE MACHINE TESTS PASSED ✓`

---

### ✅ 4. 訂單 CSV Schema（以 `csvWriter.js` 為 single source of truth）

**28 欄（從 `src/order/csvWriter.js` 第 17-44 行 `CSV_HEADERS` 複製）：**

| # | 欄位 | 用途 |
|---|------|------|
| 1 | `order_id` | 訂單唯一識別碼 |
| 2 | `created_at` | 建立時間 |
| 3 | `user_line_name` | LINE 顯示名稱 |
| 4 | `user_phone` | 電話 |
| 5 | `address` | 配送地址 |
| 6 | `community` | 社區/公司（選填） |
| 7 | `delivery_date` | 配送日期 |
| 8 | `time_slot` | 時段（上午/下午） |
| 9 | `chicken_items` | 雞肉品項 JSON |
| 10 | `side_items` | 小菜品項 JSON |
| 11 | `extra_items` | 加購品項 JSON |
| 12 | `chicken_count` | 雞肉總盒數 |
| 13 | `side_count` | 小菜總份數 |
| 14 | `total_boxes` | 總盒數 |
| 15 | `subtotal` | 小計 |
| 16 | `delivery_fee` | 配送費 |
| 17 | `total_amount` | 總金額 |
| 18 | `payment_method` | 付款方式 |
| 19 | `payment_status` | 付款狀態 |
| 20 | `order_status` | 訂單狀態 |
| 21 | `staff_notes` | 員工備註 |
| 22 | `customer_notes` | 客戶備註 |
| 23 | `customer_tags` | 客戶標籤 |
| 24 | `handoff_type` | Human Handoff 類型 |
| 25 | `handoff_logged_at` | Handoff 記錄時間 |
| 26 | `handoff_resolved_at` | Handoff 解決時間 |
| 27 | `source` | 訂單來源 |
| 28 | `intent_confirmed` | 意圖確認旗標 |

**驗證方式：**
```bash
head -1 data/orders/chicken/{date}.csv
# 或對照 src/order/csvWriter.js 的 CSV_HEADERS 常數
```

---

### ✅ 5. 安全機制

- 輸入消毒：`src/utils/sanitizer.js`
- 狀態單向前進：狀態機強制執行
- 禁止透露資訊：Hubert 電話、私人 LINE 等（見 `config.yaml` security.forbidden_info）
- CSV injection 防護：quotes + newlines 消毒（見 `csvWriter.js` `formatField`）
- 白名單機制：`src/middleware/whitelist.js`

**快速驗證：**
```bash
node tests/security.test.js
node tests/whitelist.test.js
node tests/state-trimmed-value.test.js
```

---

### ✅ 6. 設定檔介面（單一入口）

- **主要設定**：`config/tenants/chicken.yaml`（single source of truth）
- **Legacy fallback**：`config.yaml`（保留以防 loader 走 fallback 路徑，open_dates 已於 Session B B1 同步）
- **驗證介面**：`src/config.js`

**快速驗證：**
```bash
node tests/config.test.js
node tests/config-interface-adoption.test.js
node tests/dashboard-server-yaml-fallback.test.js
```

---

### ✅ 7. API Server 整合（integration）

**快速驗證：**
```bash
node tests/api-server.test.js
```
預期：`ALL API SERVER TESTS PASSED ✓`

啟動 API server：
```bash
node scripts/api-server.js
# 預設 port 3457
```

---

### ✅ 8. Cloudflare Worker 整合（integration）

**快速驗證：**
```bash
node tests/integration.test.js
```
預期：`ALL INTEGRATION TESTS PASSED ✓`

> 此測試用 mirror 函數模擬 Worker 攔截流程（Ignored Keywords / Payment Keywords / Sanitization），不直接執行 Worker runtime。

---

## 測試總覽（2026-07-03 對齊 49 套）

**當前套數（`npm test` 跑）：48 unit + 1 integration = 49 套（與 `ls tests/*.test.js | wc -l` 輸出一致）**

> 1976-06-22 時只有 25 套 + 1 套 integration，下面保留歷史列表供參（標記為「歷史累積」），新讀者請以上方當前套數為準。完整套數清單見 `docs/INDEX.md`。

### Unit 全套（48 套。30 套為原始+歷史 + 18 套為後續 6 個 sessions 新增）

**歷史 25 套**（Phase 1 + Phase 2）
1. `tests/address-dynamic-keywords.test.js`
2. `tests/address-handoff.test.js`
3. `tests/community-field.test.js`
4. `tests/config-interface-adoption.test.js`
5. `tests/config.test.js`
6. `tests/dashboard-server-yaml-fallback.test.js`
7. `tests/date.test.js`
8. `tests/handoff-customer-reply.test.js`
9. `tests/handoff.test.js`
10. `tests/parse-items-dedup.test.js`
11. `tests/rules.test.js`
12. `tests/security.test.js`
13. `tests/states.test.js`
14. `tests/state-trimmed-value.test.js`
15. `tests/whitelist.test.js`
16. `tests/helpers/cleanup.test.js`（Session D D1）
17. `tests/csv-writer-concurrency.test.js`（Session D D2）
18. `tests/timezone.test.js`（Session G）
19. `tests/config-feature-flag.test.js`（Session D4）
20. `tests/timeUtils.test.js`（Session H H1）
21. `tests/lineReply.test.js`（Session H H2）
22. `tests/orderIdGenerator.test.js`（Session H H3）
23. `tests/orderFormatter.test.js`（Session H H4）
24. `tests/csvReader.test.js`（Session H H5）
25. `tests/notificationFormat.test.js`（Session H H6）

**Phase 3 新增 23 套**（X1~X5、H8、J、L、M、K）
26. `tests/integration.test.js`（Cloudflare Worker 攔截邏輯）
27. `tests/dashboard-server-yaml-patch.test.js`（Session I5）
28. `tests/api-server-hardening.test.js`（Session I6）
29. `tests/logger.test.js`（Session K）
30. `tests/csv-writer-retry.test.js`（Session X4-A）
31. `tests/triggers-cache.test.js`（Session X4-B）
32. `tests/session-j-architecture.test.js`（Session J regression）
33. `tests/states-idle.test.js`（Session H8-A）
34. `tests/states-awaitingPayment.test.js`（Session H8-A）
35. `tests/states-completed.test.js`（Session H8-A）
36. `tests/rules-phone.test.js`（Session H8-C 拆分）
37. `tests/rules-address.test.js`（Session H8-C 拆分）
38. `tests/rules-menu.test.js`（Session H8-C 拆分）
39. `tests/rules-date.test.js`（Session H8-C 拆分）
40. `tests/rules-timeSlot.test.js`（Session H8-C 拆分）
41. `tests/rules-payment.test.js`（Session H8-C 拆分）
42. `tests/rules-price.test.js`（Session H8-C 拆分）
43. `tests/rules-index.test.js`（Session H8-C 拆分）
44. `tests/triggers.test.js`（Session H8-B 補充）
45. `tests/lineProfileCache.test.js`（Session H8-D）
46. `tests/sanitizer-extended.test.js`（Session H8-D）
47. `tests/d3-payment-options-dynamic.test.js`（Session D3）
48. `tests/d4-phase2-stub.test.js`（Session D4 Phase 2）

### Integration（額外 1 套，於 `npm run test:api-server`）

- `tests/api-server.test.js`（HTTP server 端對端，需要 port 3457 可用）

### Integration（1 套，於 `npm run test:all`）

- `scripts/dashboard-server-test.js`（CSV 讀取 + dashboard server 啟動驗證）

### 全套執行

```bash
npm test                              # 48 套 unit 全綠（2026-07-03）
npm run test:all                      # 48 套 unit + dashboard-server-test.js 全綠（49 套）
npm run lint                          # 0 errors, 0 warnings
npm run lint:fix                      # auto-fix 風格問題
bash scripts/check-quality.sh         # 8 項品質檢查（6 + X1-D verify-kb-sources + X3-C log panel）
ls tests/*.test.js | wc -l            # 驗證指令：輸出應為 48
```

### Session H 新增 6 個 Helper Unit Test 對照

| # | 模組 | 測試檔 | 重點 |
|---|------|--------|------|
| H1 | `src/utils/timeUtils.js` | `tests/timeUtils.test.js` | 6 函數全覆蓋：getTimeSlot / formatDate / getCurrentOpenDates / isWithinOrderTime / getTodayString / parseDateInput（含邊界：今天/明天/過期/格式錯誤） |
| H2 | `src/utils/lineReply.js` | `tests/lineReply.test.js` | 4 LINE 回覆格式：textReply / flexReply / quickReply / imageReply（結構正確性） |
| H3 | `src/order/orderIdGenerator.js` | `tests/orderIdGenerator.test.js` | 訂單 ID 格式：generateOrderId (ORD-YYYYMMDD-XXX) / generatePendingOrderId (PENDING-{ts}) / getMaxSequence（序號遞增） |
| H4 | `src/order/orderFormatter.js` | `tests/orderFormatter.test.js` | 金額計算：calculatePrice（半隻/整隻/小菜/加購/運費門檻） + formatItemsDisplay / formatOrderSummary / formatOrderDetail |
| H5 | `src/order/csvReader.js` | `tests/csvReader.test.js` | CSV 讀取：readCSV（JSON 欄位解析）+ 5 查詢函數（getOrderById / getOrdersByDate / getCustomerByPhone / isReturningCustomer / getAllOrders） |
| H6 | `src/handoff/notificationFormat.js` | `tests/notificationFormat.test.js` | LINE 通知格式：formatLINENotification（基本/缺欄位/JSON字串）+ formatLINENotificationMessage + getHandoffTitle（含未知 type fallback + console.warn） + HANDOFF_TITLES 與 transferRules 同步 |

**盒數規則**（2026-06-29 Hubert 明確）：
- 半隻 = 1 盒
- 一隻（整隻） = 2 盒
- 來源：`loadProductMenu().items[i].isWhole`（loader.js 已有正確判斷：`originalName.includes('整隻')`）

### CI/CD（GitHub Actions）

`.github/workflows/test.yml` 在 push / PR 自動跑 `npm test` + `npm run lint`（Node 22，從 `.nvmrc` 讀取）。

---

## 審查不通過的處理方式

若發現問題，記錄在 `knowledge/learned/` 並回報：
- 問題描述
- 預期行為
- 實際行為
- 截圖或 log

---

## 全部通過後

1. ✅ 確認 `config/tenants/chicken.yaml` 與 `config.yaml` 同步（已完成於 Session B B1）
2. ✅ 確認 `SPEC.md` 完整（待 Session C C5 決策）
3. ✅ 建立 GitHub Repo：`chicken-group-buying-cs`
4. ✅ Initial Commit
5. ⏸ 設定 LINE Bot Token 環境變數
6. ⏸ 對接真實 LINE Bot 測試

---

## 變更歷史

- **2026-06-12**：初版（16 欄 CSV、8 套測試）
- **2026-06-27**：Session B B2 重寫
  - CSV 欄位：16 → 28（以 csvWriter.js 為準）
  - 測試套數：8 → 17（15 unit + 2 integration）
  - 新增 src/ 角色說明（設計驗證+測試對象，非 production runtime）
  - 新增測試總覽、安全機制、設定檔介面、API Server、Worker 整合章節
  - 新增變更歷史
- **2026-06-29 16:50**：Housekeeping（本檔修整）
  - 測試套數 26 → 30（Session I/K 新增 4 套 unit + 1 套 integration）
  - 補上 `scripts/dashboard-server-test.js` 整合測試說明
  - 補上 Session I/K/L/M 變更歷史摘要
- **2026-06-29**：Session H 補 6 個 helper unit test
  - 測試套數：20 → 26（+6 helper unit）
  - 新增對照表：6 個 helper 模組測試
  - check-quality.sh：動態計算測試套數（避免硬寫）
  - H4 發現的 `isWhole` 判斷現象已在 09:50 修整（`isWholeMap` 讀 `loadProductMenu().items[i].isWhole`）
  - 補上 `r3b` 測試：1 半隻 + 1 整隻 = 3 盒（驗證整隻 = 2 盒）
  - **11:00 修整 ESLint 警告**：64 warnings → 0 warnings（0 errors 維持）
    - 自動修：40 errors（`npm run lint:fix`，含 eol-last / quote-props 中文 key / comma-dangle）
    - 手動修：64 warnings（unused imports + no-useless-escape + no-case-declarations）
    - 補完後 `npm test` 3 次連跑全綠、`check-quality` 7/7 通過

---

_本檔由 brtclaw 維護，以 src/ 程式碼為 single source of truth_