# 雞味客服 — 已知問題清單（CEO 視角）

> **建立時間**：2026-06-28（Session P0）
> **維護者**：brtclaw
> **自動產生**：`bash scripts/check-quality.sh`（6 項檢查）
> **更新規則**：每次 Session 結束跑一次 check-quality.sh，更新本檔
> **last_updated**：2026-07-27（Round 27 確認仍適用，無改動）

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

## 問題清單（0 個失敗 + 0 個警告）

> **2026-07-18 Session 整理**：W10 已修復（commit `97cb3af` 08:09 已收尾）。
> 全部問題移到「已修復問題」段，當前 working tree 乾淨。
> 下一輪 audit 跑 `bash scripts/check-quality.sh` 後，本檔會自動驗證狀態。

---

## 排除的「正常」警告

這些是已知暫不處理，列出來避免混淆：

- ❌ **Cognee placeholder**（MEMORY.md 寫 ✅ 但實際是 placeholder）— 6/26 audit 已標記，待 Session F 刪除
- ~~❌ **6/16 訂單流程方向未定**~~ — ✅ **2026-06-28 Session E 決策完成**（D 純 postback + systemd），新架構見 `NEW_SESSION_README.md` §4，待 Session N 實作

---

## 自動更新

每次跑 `bash scripts/check-quality.sh` 會自動列出本檔的對應問題。

**手動更新規則**：
- 修了某問題 → 從「問題清單」移到「已修復」段
- 發現新問題 → 加進「問題清單」並標嚴重度

---

## 已修復問題

### ✅ F1：客服收到大額現金訂單不會被擋下（2026-07-01 Session D3 修整）

**修法**：`src/rules/paymentRule.js` 改為讀 `getPaymentConfig().cash?.new_customer_max`
**commit**：（pre Session Q，已存在）
**驗證**：`check-quality.sh` Check 2/6 + config-feature-flag.test.js

---

### ✅ F2：小菜運費規則無法調整（2026-07-01 Session D3 修整）

**修法**：`src/order/orderFormatter.js` 改為讀 `deliveryRules.minimum_order?.side_dish_ntd` + `delivery_fee_short_fallback`
**commit**：（pre Session Q，已存在）
**驗證**：`check-quality.sh` Check 2/6 + orderFormatter.test.js

---

### ✅ F3：配送範圍改不動（2026-07-01 Session D3 修整）

**修法**：`src/rules/addressRule.js` 改為讀 `deliveryRules.areas?.allowed`（從 chicken.yaml 動態載入）
**commit**：（pre Session Q，已存在）
**驗證**：`check-quality.sh` Check 2/6 + address-dynamic-keywords.test.js

---

### ✅ F4：銀行帳號 / LINE Pay ID 散落在程式（2026-07-01 Session D3-4/D3-5 修整）

**修法**：
- `src/index.js` CONFIRMING handler 改為讀 `getPaymentConfig()` + `isFeatureEnabled()`
- `src/states/confirming.js` 同上
- 5 個付款相關 flag 全部檢查（cash / transfer / jko / linepay + official.line_pay）

**commits**：
- `335e9e16 fix(d3-4): src/index.js CONFIRMING handler 動態生成付款方式訊息`
- `2fbde28c fix(d3-5): src/states/confirming.js CONFIRMING handler 動態生成付款方式訊息`

**驗證**：`tests/d3-payment-options-dynamic.test.js`（6 個情境）

---

### ✅ W1~W9：9 個設定開關無作用（2026-07-01 Session D4 修整）

**修法**：
- `src/config.js` 新增 `isFeatureEnabled(path)` 統一介面（pre Session Q 已有）
- 8 個 flag 在對應的 module 內檢查：
  - `payment.cash/transfer/jko/linepay.enabled` + `official.line_pay.enabled` → `awaitingPayment.js`
  - `storage.phase1.enabled` → `csvWriter.js`
  - `handoff.notify_owner.enabled` → `handoff/notifier.js`
  - `security.input_sanitization` → `utils/sanitizer.js`
- `storage.phase2.enabled` → stub 拋錯防誤啟用（**commit `06fea372`**，見 F4-7）

**commits**：
- 多個 pre-Session Q commits（feature flag 介面 + 4 個 module 整合）
- `06fea372 feat(d4-7): storage.phase2.enabled stub`

**驗證**：
- `tests/config-feature-flag.test.js`（4 個情境）
- `tests/d4-phase2-stub.test.js`（5 個 assertion）
- `check-quality.sh` Check 3/6

---

### ✅ Bonus D3-6：check-quality.sh 盲點（2026-07-01 修整）

**問題**：原 Check 2/6 只查 5 個特定檔案，造成 src/index.js:151 / src/states/confirming.js:61 的 hardcode 漏網
**修法**：改為 `grep -r` 掃描整個 src/，採用具體值檢查（23257030422 / Willy0221 / '三峽','鶯歌'）
**commit**：`a6de28cc fix(d3-6): 擴展 check-quality.sh hardcode 檢查為 grep -r 全 src/ 掃描`

---

### ✅ W10：working tree 有未提交變更（2026-07-18 Session 整理修復）

**問題**：Session 結束時未 push / rsync 的 commits 仍在本機（不影響 production）
**修法**：commit `97cb3af`（08:09）docs 全檔收尾後 working tree 乾淨，sync-mirror.sh 已同步
**commit**：`97cb3af docs: 全面更新狀態檔案 + 當日總結（Hubert 08:07）`
**驗證**：`git status` 無未提交變更

---

_本檔由 check-quality.sh 自動驗證 + brtclaw 手動維護_
_最後更新：2026-07-18 08:30 Session 整理（W10 移到已修復 + 全面對齊）_
