# Session H8 — 補 13 個 src/ 模組專屬單元測試（Session H 延伸）

> **業務問題（CEO 視角）**：完整系統掃描（2026-07-01）發現 13 個 src/ 模組沒有專屬單元測試，只有部分被 bundle test 涵蓋。如果有人改壞了，現有測試抓不到：
> - 客戶可能拿到錯誤金額（rules/*.js）
> - 客戶可能誤觸轉真人條件（transferRules.js 14 觸發只測 3 個）
> - 客戶可能被當新客（csvReader.js isReturningCustomer）
> - 安全漏洞（sanitizer.js、whitelist.js）
>
> **影響**：🔴 高（影響品質 + 收入）
> **推薦**：做（1.5-2 小時、中風險）
> **狀態**：⏸ 待執行
> **優先**：🔴 高（掃描發現的 13 個 module 有 8 個無任何覆蓋）

---

## 與 Session H 關係

- **Session H**（6/28 完成 scope）：timeUtils / lineReply / orderIdGenerator / orderFormatter / csvReader / notificationFormat（6 個 helper）
- **Session H8**（本次新 session）：掃描發現其他 13 個 module 沒專屬測試，應與 H 互補

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session H8 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session H/H8）
3. MEMORY.md §I（SOP）

## Session H8 任務（CEO 視角）

開始時問 CEO 決策：

「13 個 src/ 模組沒專屬測試（idle / awaitingPayment / completed / transferRules / rules/*×8 / triggers / whitelist / sanitizer / lineProfileCache）。
補 80+ 單元測試守住，做 / 不做？」

如果「做」，執行：

### H8-A：3 個 state 模組（1 commit）
- **src/states/idle.js**（~70 行）：isOrderIntent / isGreeting / 閒置判斷
- **src/states/awaitingPayment.js**：isPaymentConfirmed / isPaymentCancel / handleAwaitingPayment 各 action 分支
- **src/states/completed.js**：handleCompleted 各 action

預估：30+ 測試
重點：handleXxx 各 action + edge cases（無訂單資料 / 欄位缺失）

### H8-B：handoff/transferRules.js（1 commit）⚠️ 重要
- **14 種觸發條件**完整覆蓋：
  - L1（5 種）：refund_request / cancel_request / reschedule_request / complaint / escalation / explicit_request
  - L2（5 種）：discount_request / delivery_confirm_needed / bulk_order / high_value_order
  - L3（3 種）：payment_mismatch / linepay_failed
- 現有 handoff.test.js 只測 3 個（"我想退錢"/"取消"/"付不了"），剩 11 個沒測

預估：15+ 測試（每個 trigger × 1-2 情境）
重點：keyword matching + priority sorting

### H8-C：rules/ 8 個模組（1 commit）— 拆出獨立 test
- **src/rules/menuRule.js**（CHICKEN_ITEMS / SIDE_ITEMS / PRICES 驗證）
- **src/rules/paymentRule.js**（validatePayment 各 method 分支 + 現金上限）
- **src/rules/addressRule.js**（地址 parsing / 配送範圍判斷）
- **src/rules/dateRule.js**（日期驗證）
- **src/rules/timeSlotRule.js**（時段判斷：AM/PM）
- **src/rules/phoneRule.js**（電話格式驗證）
- **src/rules/priceRule.js**（calculatePrice — 與 orderFormatter 對齊）
- **src/rules/index.js**（module exports）

預估：25+ 測試
重點：每個 rule 的 happy path + edge cases
備註：rules.test.js bundle 已存在，本任務是拆出獨立 test file

### H8-D：knowledge + middleware + utils（1 commit）
- **src/knowledge/triggers.js**：guessIntent / loadKnowledgeForIntent（intent → KB 章節 mapping）
- **src/middleware/whitelist.js**：checkWhitelist（allow / block / 環境變數）
- **src/utils/sanitizer.js**：完整 sanitization（XSS / SQL injection / prompt injection）
- **src/utils/lineProfileCache.js**：getLineDisplayName + cache 機制

預估：20+ 測試
重點：sanitizer 是安全關鍵，100% 覆蓋率目標
備註：security.test.js 已部分測 sanitizer，本任務補完

## 必跑 SOP（MEMORY.md §I）
- I-1：每個 H8-A~D commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點確認測試覆蓋變動模組
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. H8-A~D 4 個獨立 commit
2. 每個 test file 完成立即 npm test 驗證
3. 既有 32 套 unit test 不能破壞
4. 真實訂單保護：絕對不能刪 `data/orders/chicken/2026-06-13.csv` 或 `2026-06-16.csv`
5. 測試風格：assert + console.log + ALL PASSED 結尾
6. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. **H8-A** 寫 3 個 state test file → npm test 32 → 34 → commit
4. **H8-B** 補 transferRules 14 觸發 → npm test 34 → 35 → commit
5. **H8-C** 拆 rules 8 個獨立 test → npm test 35 → 36 → commit
6. **H8-D** knowledge + middleware + utils → npm test 36 → 38 → commit
7. 跑完整 check-quality.sh（全 9 項）
8. 統一 push + rsync
9. 更新 INDEX.md + REVIEW_GUIDE.md（測試套數 32 → 38）
10. 通知 Hubert

## 預期效益
- 測試套數：32 → 38（+6 套）
- 安全關鍵模組（sanitizer）覆蓋率 100%
- transferRules 14 觸發條件全覆蓋（避免「漏觸發送錯真人」bug）
- 模組契約守住，未來 refactor 不破壞行為
