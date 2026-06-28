# Session D4 — 修 9 個 Dead Config Flag Prompt

> **業務問題（CEO 視角）**：雞味客服 `chicken.yaml` 有 9 個「啟用/未啟用」開關，但程式永遠當啟用處理。你以為某功能已關閉（看 config 寫 false），實際是開的。想暫停某付款方式、改 config 沒用，要工程師改 code。
> **影響**：🔴 高（影響控制能力）
> **推薦**：做

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session D4：把 9 個 dead config flag 變成真正生效。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session D4 段）
2. 已知問題：docs/KNOWN_ISSUES.md（看 W1~W9）
3. 變數對照表：docs/CONFIG_VARIABLES_TABLE.md（dead config 清單）
4. chicken.yaml：config/tenants/chicken.yaml
5. MEMORY.md §I（SOP）

## Session D4 任務（CEO 視角）

開始時問 CEO 決策：

「chicken.yaml 有 9 個開關（payment.cash.enabled 等），
但程式永遠當啟用處理，改了沒效果。要讓這些開關真正生效，做 / 不做？」

如果「做」，執行：

### 9 個 dead config flag

#### 業務相關（5 個）
1. `payment.cash.enabled` → 暫停現金收款
2. `payment.transfer.enabled` → 暫停轉帳
3. `payment.jko.enabled` → 暫停街口支付
4. `payment.linepay.enabled` → 暫停 LINE Pay
5. `official.line_pay.enabled` → 暫停 LINE Pay 整合（與 4 重疊，確認是否冗餘）

#### 系統相關（4 個）
6. `storage.phase1.enabled` → 暫停 CSV 儲存（測試用）
7. `storage.phase2.enabled` → 啟用 Google Sheets（未來）
8. `handoff.notify_owner.enabled` → 暫停通知 Hubert
9. `security.input_sanitization` → 暫停輸入消毒（危險，不建議關閉）

### 設計方案

#### 新增 src/config.js getter：isFeatureEnabled(path)
```js
/**
 * 檢查 feature flag 是否啟用
 * @param {string} featurePath - 例如 'payment.cash' 或 'storage.phase1'
 * @returns {boolean}
 */
function isFeatureEnabled(featurePath) {
  const parts = featurePath.split('.');
  let current = _rawConfig;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return true; // 找不到時預設啟用（向後相容）
    }
  }
  return current && current.enabled !== false;
}
```

#### 使用範例
```js
// src/states/awaitingPayment.js
if (!config.isFeatureEnabled('payment.cash')) {
  return { reply: textReply('現金付款暫停，請選其他方式') };
}

// src/handoff/notifier.js
if (!config.isFeatureEnabled('handoff.notify_owner')) {
  return; // 跳過通知
}
```

### 影響範圍（會改哪些檔）

預期：
- src/config.js：新增 `isFeatureEnabled()`
- src/states/awaitingPayment.js：4 個 payment enabled 檢查
- src/handoff/notifier.js：notify_owner.enabled 檢查
- src/order/csvWriter.js：storage.phase1.enabled 檢查（測試環境可用）
- src/utils/sanitizer.js：security.input_sanitization 檢查（保留，但加 log）

## 必跑 SOP
- I-1：每個 flag 改完 commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點，dead code 與 active 分開
- I-3：每個方案必含「會連帶改 X、Y、Z」

## 約束
1. 每個 flag 一個 commit（9 commits 預期）或分批（如 payment 5 個一組）
2. 既有 19 套測試不能破壞
3. check-quality.sh 從 9 個 dead config 警告 → 0
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. 新增 src/config.js 的 isFeatureEnabled() + 加 unit test → commit
4. 改 src/states/awaitingPayment.js 4 個 payment flag → npm test → commit
5. 改 src/handoff/notifier.js handoff.notify_owner → npm test → commit
6. 改 src/order/csvWriter.js storage.phase1 → npm test → commit
7. 改 src/utils/sanitizer.js security.input_sanitization → npm test → commit
8. 跑完整 check-quality.sh（預期 dead config 警告從 9 → 0）
9. 統一 push + rsync
10. 更新 KNOWN_ISSUES.md
11. 通知 Hubert

## 結束時
- 5-9 個 commit
- check-quality.sh 從 9 個警告變 0 個
- 你改 chicken.yaml 的 enabled: true/false 真正生效

開始吧。
```
