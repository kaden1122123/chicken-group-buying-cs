# Session D3 — 修 5 個 Hardcode Prompt

> **業務問題（CEO 視角）**：你改 `chicken.yaml` 的業務規則（運費、現金上限、配送範圍、銀行帳號）**沒效果**，因為程式碼寫死了。要調整業務規則要請工程師改 code 才能 deploy。
> **影響**：🔴 高（影響營運彈性）
> **推薦**：做

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session D3：把 5 個 hardcode 改成讀 config。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session D3 段）
2. 已知問題：docs/KNOWN_ISSUES.md（看 F1~F4）
3. 變數對照表：docs/CONFIG_VARIABLES_TABLE.md（hardcode 清單）
4. config.js：src/config.js（目前有哪些 getter）
5. chicken.yaml：config/tenants/chicken.yaml（要讀的欄位）
6. MEMORY.md §I（SOP）

## Session D3 任務（CEO 視角）

開始時問 CEO 決策：

「你改 chicken.yaml 的業務規則（運費、現金上限、配送範圍、銀行帳號）現在沒效果，
要工程師改 code 才能動。改 5 個 hardcode 讓 config 生效，做 / 不做？」

如果「做」，執行：

### 5 個 hardcode 改為讀 config

#### Hardcode 1：現金上限（src/rules/paymentRule.js）
- 現況：`if (!isReturningCustomer && totalAmount > 1000 && methodKey === 'cash')`
- 改為：讀 `config.getPaymentConfig().cash.new_customer_max`
- chicken.yaml：`payment.cash.new_customer_max: 1000`

#### Hardcode 2：滿額免運（src/order/orderFormatter.js）
- 現況：`} else if (hasSide && sideSubtotal >= 350) { deliveryFee = 0; ...} else { deliveryFee = 80; }`
- 改為：讀 `config.getDeliveryRules().minimum_order.side_dish_ntd`
- 需新增：`delivery.delivery_fee_short_fallback: 80` 到 chicken.yaml
- chicken.yaml：
  ```
  delivery.minimum_order.side_dish_ntd: 350
  delivery.delivery_fee_short_fallback: 80  # 新增
  ```

#### Hardcode 3：配送範圍（src/rules/addressRule.js）
- 現況：`'三峽', '鶯歌'` 作 fallback
- 改為：讀 `config.getDeliveryRules().areas.allowed`（與 04_delivery.md 一致）
- 注意：knowledge/tenants/chicken/04_delivery.md 才是 single source of truth
- chicken.yaml：`delivery.areas.allowed` 從 `['三鶯生活圈']` 改為更詳細清單（從 04_delivery.md 同步）

#### Hardcode 4：銀行帳號（src/states/awaitingPayment.js）
- 現況：`銀行代碼007 / 帳號23257030422` 寫死在訊息模板
- 改為：讀 `config.getPaymentConfig().transfer.bank_code` + `.account`
- chicken.yaml：`payment.transfer.bank_code: '007'` + `payment.transfer.account: '23257030422'`

#### Hardcode 5：LINE Pay ID（src/states/awaitingPayment.js）
- 現況：`請加入老闆 LINE（ID：Willy0221）` 寫死
- 改為：讀 `config.getPaymentConfig().linepay.line_id`
- chicken.yaml：`payment.linepay.line_id: 'Willy0221'`

### 需要新增到 src/config.js 的 getter
- `getPaymentConfig()`：回傳 `{ cash: {...}, transfer: {...}, jko: {...}, linepay: {...} }`
- `getDeliveryRules()`：回傳完整 delivery 物件（含 minimum_order、delivery_fee_short_fallback）

## 必跑 SOP
- I-1：每個 hardcode 改完 commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點，dead code 與 active 分開
- I-3：每個 hardcode 改的方案必含「會連帶改 X、Y、Z」

## 約束
1. 每個 hardcode 一個 commit（5 commits 預期）
2. 每個 commit 前跑 bash scripts/check-quality.sh 確認沒壞其他 hardcode
3. 既有 19 套測試不能破壞
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. 執行 Hardcode 1 → npm test → check-quality.sh → commit
4. 執行 Hardcode 2 → npm test → check-quality.sh → commit
5. 執行 Hardcode 3 → npm test → check-quality.sh → commit
6. 執行 Hardcode 4 → npm test → check-quality.sh → commit
7. 執行 Hardcode 5 → npm test → check-quality.sh → commit
8. 跑完整 check-quality.sh（預期 hardcode 失敗從 5 → 0）
9. 統一 push + rsync
10. 更新 KNOWN_ISSUES.md（F1~F4 移到已修復）
11. 通知 Hubert

## 結束時
- 5 個 commit，每個 hardcode 一個
- check-quality.sh 從 5 個失敗變 0 個
- KNOWN_ISSUES.md 更新
- 統一 push + rsync

開始吧。
```
