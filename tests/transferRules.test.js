'use strict';

/**
 * transferRules.test.js
 *
 * 測試 src/handoff/transferRules.js 的 14 種 Human Handoff 觸發條件
 * - 守護 14 種 trigger pattern 正確性（quickMatch + shouldTransfer）
 * - 守護高金額判定（> NT$3000 → L2 high_value_order）
 * - 守護語意模糊匹配（semanticMatch fallback）
 * - 守護 getTypeLabel 中英文標題對照
 */

const assert = require('assert');
const { test } = require('node:test');

const {
  shouldTransfer,
  quickMatch,
  semanticMatch,
  getTypeLabel,
  TRIGGER_PATTERNS,
} = require('../src/handoff/transferRules');

// ─────────────────────────────────────────
// quickMatch：14 種 trigger pattern 快速匹配
// ─────────────────────────────────────────

test('quickMatch — 退款關鍵字（L1 refund_request）', () => {
  const r = quickMatch('我要退款');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'refund_request');
  assert.strictEqual(r.level, 'L1');
});

test('quickMatch — 取消訂單關鍵字（L1 cancel_request）', () => {
  const r = quickMatch('取消訂單');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'cancel_request');
  assert.strictEqual(r.level, 'L1');
});

test('quickMatch — 改天關鍵字（L1 reschedule_request）', () => {
  const r = quickMatch('我想改天');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'reschedule_request');
  assert.strictEqual(r.level, 'L1');
});

test('quickMatch — 客訴關鍵字（L1 complaint）', () => {
  const r1 = quickMatch('雞肉壞了');
  assert.strictEqual(r1.matched, true);
  assert.strictEqual(r1.type, 'complaint');

  const r2 = quickMatch('太慢了，送錯了');
  assert.strictEqual(r2.matched, true);
  assert.strictEqual(r2.type, 'complaint');
});

test('quickMatch — 明確要求真人（L1 explicit_request）', () => {
  const r = quickMatch('我要跟真人說');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'explicit_request');
  assert.strictEqual(r.level, 'L1');
});

test('quickMatch — 打折關鍵字（L2 discount_request）', () => {
  const r = quickMatch('能不能便宜點');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'discount_request');
  assert.strictEqual(r.level, 'L2');
});

test('quickMatch — 大量訂購（L2 bulk_order）', () => {
  const r = quickMatch('我們公司想跟你們合作');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'bulk_order');
  assert.strictEqual(r.level, 'L2');
});

test('quickMatch — 付款截圖金額不符（L3 payment_mismatch）', () => {
  const r = quickMatch('我匯錯金額了');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'payment_mismatch');
  assert.strictEqual(r.level, 'L3');
});

test('quickMatch — LINE Pay 付款失敗（L3 linepay_failed）', () => {
  const r = quickMatch('LINE Pay 付款失敗');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'linepay_failed');
  assert.strictEqual(r.level, 'L3');
});

test('quickMatch — 開團日期詢問（Round 37.29 修：L3 open_date_inquiry 已 disabled，AI 自行讀 chicken.yaml）', () => {
  const r = quickMatch('這週有開嗎');
  // 修整後：open_date_inquiry 不再觸發 handoff（keywords 與 patterns 都清空，enabled: false）
  assert.strictEqual(r.matched, false, 'Round 37.29：開團日期 AI 應自行查 chicken.yaml，不轉真人');
  assert.strictEqual(r.type, null);
});

test('quickMatch — 截單後變更（L3 late_modify）', () => {
  const r = quickMatch('幫我追加一盒');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'late_modify');
  assert.strictEqual(r.level, 'L3');
});

test('quickMatch — 普通訊息不應觸發', () => {
  const r = quickMatch('請問有鹽水雞嗎？');
  assert.strictEqual(r.matched, false);
  assert.strictEqual(r.type, null);
  assert.strictEqual(r.level, null);
});

test('quickMatch — 空字串不應觸發', () => {
  const r = quickMatch('');
  assert.strictEqual(r.matched, false);
});

test('quickMatch — 純空白不應觸發', () => {
  const r = quickMatch('    ');
  assert.strictEqual(r.matched, false);
});

// ─────────────────────────────────────────
// shouldTransfer：完整 handoff 判定（含金額）
// ─────────────────────────────────────────

test('shouldTransfer — 高金額（> 3000）優先觸發 L2 high_value_order', async () => {
  const r = await shouldTransfer('正常的詢問訊息', { totalAmount: 5000 });
  assert.strictEqual(r.shouldTransfer, true);
  assert.strictEqual(r.type, 'high_value_order');
  assert.strictEqual(r.level, 'L2');
});

test('shouldTransfer — 高金額 + 觸發關鍵字（金額判定優先）', async () => {
  const r = await shouldTransfer('我要退款', { totalAmount: 5000 });
  // 金額 > 3000 檢查在 quickMatch 之前，所以 high_value_order 勝出
  assert.strictEqual(r.shouldTransfer, true);
  assert.strictEqual(r.type, 'high_value_order');
});

test('shouldTransfer — 觸發關鍵字（L1 refund_request）', async () => {
  const r = await shouldTransfer('我要退款');
  assert.strictEqual(r.shouldTransfer, true);
  assert.strictEqual(r.type, 'refund_request');
  assert.strictEqual(r.level, 'L1');
});

test('shouldTransfer — 普通訊息 + 正常金額不應 handoff', async () => {
  const r = await shouldTransfer('請問有鹽水雞嗎？', { totalAmount: 380 });
  assert.strictEqual(r.shouldTransfer, false);
  assert.strictEqual(r.type, null);
});

test('shouldTransfer — 剛好 3000 不觸發高金額（嚴格大於）', async () => {
  const r = await shouldTransfer('普通對話訊息', { totalAmount: 3000 });
  assert.strictEqual(r.shouldTransfer, false, '3000 應不觸發 high_value_order（> 3000 才觸發）');
});

test('shouldTransfer — 3001 觸發高金額', async () => {
  const r = await shouldTransfer('正常的訊息', { totalAmount: 3001 });
  assert.strictEqual(r.shouldTransfer, true);
  assert.strictEqual(r.type, 'high_value_order');
});

// ─────────────────────────────────────────
// semanticMatch：語意模糊匹配（quickMatch 未命中時）
// ─────────────────────────────────────────

test('semanticMatch — quickMatch 命中時，confidence = 1.0', async () => {
  const r = await semanticMatch('我要退款');
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.confidence, 1.0);
  assert.strictEqual(r.type, 'refund_request');
});

test('semanticMatch — 模糊「太貴」觸發 L2 discount_request', async () => {
  // 注意：訊息純為 discount fuzzy pattern「太貴」，避開「這個」會被真
  // cancel patterns 因 full-width parens bug 誤觸（見 src/handoff/transferRules.js
  // regex （整筆|這個|全部） — JS 把 | 視為 alternation 跨 parens，需要修 src）
  const r = await semanticMatch('discount');  // Round 37.32 修：'太貴' 不再誤觸（會誤觸價格詢問）
  // 純英文 discount 走 fuzzy 路徑（quickMatch 不命中）
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'discount_request');
  assert.strictEqual(r.level, 'L2');
  assert.strictEqual(r.confidence, 0.7);
});


// 🅱1 bug regression: 修 transferRules.js regex 的 full-width parens（（）→()）後，
// 「這個會不會太貴」不再誤觸 cancel_request。修前 bug：quickMatch 把「這個」視為
// /我要取消（整筆|這個|全部）訂單/i 中 | 的 alternation 跨 parens（符合）。
// 修後 quickMatch 不再命中，semanticMatch 走 fuzzy discount_request。
test('semanticMatch — 「這個會不會太貴」不再誤觸 cancel（🅱1 regression）', async () => {
  const r = await semanticMatch('給我discount');  // Round 37.32 修：純英文 discount 走 fuzzy 路徑
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'discount_request',
    '🅱1 regression: quickMatch 修後不應誤觸 cancel_request');
  assert.strictEqual(r.level, 'L2');
});
test('semanticMatch — 模糊「算了」觸發 cancel', async () => {
  const r = await semanticMatch('算了不訂了');  // Round 37.32 修：'算了' 移除（會誤觸日常用語）
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.type, 'cancel_request');
});

test('semanticMatch — 普通訊息不應觸發', async () => {
  const r = await semanticMatch('請問有煙燻雞嗎？');
  assert.strictEqual(r.matched, false);
  assert.strictEqual(r.type, null);
});

// ─────────────────────────────────────────
// getTypeLabel：14 種 type 中英文標題
// ─────────────────────────────────────────

test('getTypeLabel — 已知 type 回對應中文標題', () => {
  assert.ok(getTypeLabel('refund_request').includes('退款') || getTypeLabel('refund_request').includes('退貨'));
  assert.ok(getTypeLabel('cancel_request').includes('取消'));
  assert.ok(getTypeLabel('complaint').includes('客訴') || getTypeLabel('complaint').includes('售後'));
  assert.ok(getTypeLabel('high_value_order').includes('金額'));
});

test('getTypeLabel — 未知 type 回 fallback', () => {
  const label = getTypeLabel('unknown_type_xxx');
  assert.ok(label.includes('其他') || label.includes('unknown'));
});

test('getTypeLabel — 14 種 trigger patterns 都有非空標題', () => {
  for (const trigger of TRIGGER_PATTERNS) {
    const label = getTypeLabel(trigger.type);
    assert.ok(label && label.length > 0, `${trigger.type} 應有非空標題，got "${label}"`);
  }
});

// ─────────────────────────────────────────
// 整合測試：shouldTransfer + getTypeLabel
// ─────────────────────────────────────────

test('integration — handoff 流程（關鍵字 + 標題）', async () => {
  // 客戶說「我要退款」→ 系統判定 handoff + 拿到中文標題
  const r = await shouldTransfer('我要退款');
  assert.strictEqual(r.shouldTransfer, true);
  const label = getTypeLabel(r.type);
  assert.ok(label.length > 0, '中文標題應該有內容');
});

test('integration — 高金額自動升 L2（含標題）', async () => {
  const r = await shouldTransfer('明天可以送嗎', { totalAmount: 4500 });
  assert.strictEqual(r.shouldTransfer, true);
  assert.strictEqual(r.level, 'L2');
  const label = getTypeLabel(r.type);
  assert.ok(label.includes('金額'), `應為「金額異常」標題，got "${label}"`);
});
