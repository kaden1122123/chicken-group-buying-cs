# Session H — 補 6 個 Helper Unit Test Prompt

> **業務問題（CEO 視角）**：6 個重要輔助模組（金額計算、訂單 ID、訂單讀取、時間處理、訊息格式）沒有專屬 unit test。如果有人改壞了，現有測試抓不到，客戶可能拿到錯誤金額或錯誤訊息。
> **影響**：🟡 中（影響品質）
> **推薦**：做（3-4 小時、中風險）

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session H：為 6 個 helper 模組補 unit test。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session H 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session H）
3. REVIEW_GUIDE.md：REVIEW_GUIDE.md（測試命名 + 風格）
4. MEMORY.md §I（SOP）

## Session H 任題（CEO 視角）

開始時問 CEO 決策：

「6 個重要模組沒有專屬測試，改壞了抓不到。
補 50+ 個 unit test，做 / 不做？」

如果「做」，執行 6 個項目（每個 1 commit）：

### H1：src/utils/timeUtils.js（119 行）
- 函數：getTimeSlot, formatDate, getCurrentOpenDates, isWithinOrderTime, getTodayString, parseDateInput
- 預估：15+ 測試
- 重點：邊界（今天/明天/過期/格式錯誤）

### H2：src/utils/lineReply.js（74 行）
- 函數：textReply, flexReply, quickReply, imageReply
- 預估：5+ 測試（驗證回傳結構）
- 重點：JSON 結構正確性

### H3：src/order/orderIdGenerator.js（73 行）
- 函數：generateOrderId, generatePendingOrderId, getMaxSequence
- 預估：5+ 測試
- 重點：訂單 ID 格式、序號遞增

### H4：src/order/orderFormatter.js（180 行）⚠️ 重要
- 函數：calculatePrice, formatItemsDisplay, formatOrderSummary, formatOrderDetail
- 預估：15+ 測試
- 重點：金額計算（整隻/半隻、加購、運費）

### H5：src/order/csvReader.js（152 行）⚠️ 重要
- 函數：getOrderById, getOrdersByDate, getCustomerByPhone, isReturningCustomer, getAllOrders, readCSV
- 預估：10+ 測試
- 重點：CSV 讀取正確性、回客識別

### H6：src/handoff/notificationFormat.js（122 行）
- 函數：formatLINENotification, formatLINENotificationMessage, getHandoffTitle, HANDOFF_TITLES
- 預估：5+ 測試
- 重點：Hubert 看到的訊息格式

## 必跑 SOP
- I-1：每個 H1~H6 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認無重複測試
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 H1~H6 一個獨立 commit
2. 每個測試檔寫完立即 npm test 驗證
3. 既有 19 套測試不能破壞
4. 測試風格：assert + console.log + ALL PASSED 結尾（參考既有測試）
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. H1 timeUtils.test.js → npm test → commit
4. H2 lineReply.test.js → npm test → commit
5. H3 orderIdGenerator.test.js → npm test → commit
6. H4 orderFormatter.test.js → npm test → commit
7. H5 csvReader.test.js → npm test → commit
8. H6 notificationFormat.test.js → npm test → commit
9. 跑完整 check-quality.sh + 連續 3 次 npm test 全綠
10. 統一 push + rsync
11. 更新 REVIEW_GUIDE.md + INDEX.md（測試套數 19 → 25）
12. 通知 Hubert

開始吧。
```
