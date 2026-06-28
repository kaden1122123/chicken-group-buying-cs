# 雞味客服 — 已知問題清單（CEO 視角）

> **建立時間**：2026-06-28（Session P0）
> **維護者**：brtclaw
> **自動產生**：`bash scripts/check-quality.sh`（6 項檢查）
> **更新規則**：每次 Session 結束跑一次 check-quality.sh，更新本檔

---

## 如何使用本檔

- **CEO/Hubert**：看本檔「問題清單」段，知道哪些事需要決策
- **工程師**：看「技術細節」段，知道要改哪些檔

**每個問題都有 4 個資訊**：
1. **影響**：對 production / 客戶的影響
2. **建議修復**：哪個 Session 處理
3. **技術細節**：具體檔案與行號
4. **狀態**：🔴 嚴重 / 🟡 中等 / 🟢 輕微

---

## 問題清單（5 個失敗 + 10 個警告）

### 🔴 F1：客服收到大額現金訂單不會被擋下

**影響**：
- 新客戶拿 1001 元現金訂雞，系統會接受
- 你想擋掉「超過 1000 元現金不接」這個規則
- 但改 `chicken.yaml` 的 `payment.cash.new_customer_max: 1000` **沒用**，因為程式 hardcode `> 1000`

**建議修復**：Session D3（hardcode 統一用 config）

**技術細節**：
- `src/rules/paymentRule.js:57` 有 `totalAmount > 1000`
- 應改為讀 `config.getPaymentConfig().cash.new_customer_max`

---

### 🔴 F2：小菜運費規則無法調整

**影響**：
- 滿 350 元免運費，但你想改成滿 500 元才免
- 改 `chicken.yaml` 的 `delivery.minimum_order.side_dish_ntd: 350` **沒用**
- 程式 hardcode `350`，且運費 80 也是 hardcode

**建議修復**：Session D3

**技術細節**：
- `src/order/orderFormatter.js:56-57` 有 `sideSubtotal >= 350`
- `src/order/orderFormatter.js:59` 有 `deliveryFee = 80`
- 應改為讀 config（並新增 `delivery.delivery_fee_short_fallback`）

---

### 🔴 F3：配送範圍改不動

**影響**：
- 你想加「樹林區」到配送範圍
- 改 `chicken.yaml` 的 `delivery.areas.allowed` **沒用**（程式讀 04_delivery.md）
- addressRule 有 hardcode `['三峽','鶯歌']` 作 fallback

**建議修復**：Session D3 + Session D4（簡化 chicken.yaml）

**技術細節**：
- `src/rules/addressRule.js:30` hardcode
- `config/tenants/chicken.yaml:delivery.areas` 只有「三鶯生活圈」太簡
- `knowledge/tenants/chicken/04_delivery.md` 是實際 source

---

### 🔴 F4：銀行帳號 / LINE Pay ID 散落在程式

**影響**：
- 改銀行帳號或 LINE Pay ID 要改 src/ 程式碼（需 deploy）
- 風險：hardcode 出錯會送錯款項資訊給客戶

**建議修復**：Session D3

**技術細節**：
- `src/states/awaitingPayment.js` 多處 hardcode `Willy0221`、`23257030422`、`007`
- 應讀 `config.getPaymentConfig().{transfer,linepay}`

---

### 🟡 W1~W9：9 個設定開關無作用

**影響**：
- `chicken.yaml` 有 9 個「啟用/未啟用」旗標（payment.cash.enabled、storage.phase2.enabled 等）
- 全部「永遠當啟用處理」（程式沒讀）
- 改這些 config 沒效果，但你知道它存在 → 誤以為已控制

**建議修復**：Session D4（建立 feature flag 介面）

**技術細節**（9 個 dead flags）：
```
storage.phase1.enabled
storage.phase2.enabled
payment.cash.enabled
payment.transfer.enabled
payment.jko.enabled
payment.linepay.enabled
handoff.notify_owner.enabled
official.line_pay.enabled
security.input_sanitization
```

---

### 🟢 W10：working tree 有未提交變更

**影響**：
- 目前有 7 個未提交變更（P0 產出的文件）
- 解決方式：commit 這次 P0

**建議修復**：立即處理（commit P0）

---

## 排除的「正常」警告

這些是已知暫不處理，列出來避免混淆：

- ❌ **Cognee placeholder**（MEMORY.md 寫 ✅ 但實際是 placeholder）— 6/26 audit 已標記，待 Session F 刪除
- ~~❌ **6/16 訂單流程方向未定**~~ — ✅ **2026-06-28 Session E 決策完成**（D 純 postback + systemd），新架構見 `docs/architecture/NEW_ORDER_FLOW.md` v2，待 Session N 實作

---

## 自動更新

每次跑 `bash scripts/check-quality.sh` 會自動列出本檔的對應問題。

**手動更新規則**：
- 修了某問題 → 從「問題清單」移到「已修復」段
- 發現新問題 → 加進「問題清單」並標嚴重度

---

## 已修復問題

（目前尚無 — 開始修復後記錄）

---

_本檔由 check-quality.sh 自動驗證 + brtclaw 手動維護_
