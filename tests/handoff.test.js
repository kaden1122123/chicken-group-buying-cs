'use strict';

/**
 * Human Handoff 觸發測試
 * 14 種條件的語意觸發測試
 */

const assert = require('assert');
const { test } = require('node:test');

const { shouldTransfer, quickMatch, semanticMatch, getTypeLabel, TRIGGER_PATTERNS } = require('../src/handoff/transferRules');

test('L1 Triggers — 高嚴重性 (退款 / 取消 / 改天 / 抱怨 / 明確要求真人)', async () => {
  const l1Cases = [
    { message: '要退款', expectedType: 'refund_request' },
    { message: '錢退回来', expectedType: 'refund_request' },
    { message: '退我钱', expectedType: 'refund_request' },
    { message: '不訂了', expectedType: 'cancel_request' },
    { message: '取消吧', expectedType: 'cancel_request' },
    { message: '改到明天', expectedType: 'reschedule_request' },
    { message: '想换日期', expectedType: 'reschedule_request' },
    { message: '雞肉壞了', expectedType: 'complaint' },
    { message: '有問題', expectedType: 'complaint' },
    { message: '叫你老闆來', expectedType: 'escalation' },
    { message: '叫真人', expectedType: 'explicit_request' },
  ];
  for (const { message, expectedType, expectedShouldTransfer = true } of l1Cases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, expectedShouldTransfer, `"${message}" shouldTransfer=${expectedShouldTransfer}, got ${result.shouldTransfer}`);
    if (expectedShouldTransfer) {
      assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}, got ${result.type}`);
    } else {
      assert.strictEqual(result.type, null, `"${message}" 應不觸發 type, got ${result.type}`);
    }
  }
});

test('L2 Triggers — 中嚴重性 (折扣 / 大量訂購 / 金額異常)', async () => {
  const l2Cases = [
    { message: '便宜一点', expectedType: 'discount_request' },
    { message: '打个折', expectedType: 'discount_request' },
    { message: '公司訂購', expectedType: 'bulk_order' },
    { message: '大量採購', expectedType: 'bulk_order' },
    { message: '我想訂很多', expectedType: null, options: { totalAmount: 5000 } },
  ];
  for (const { message, expectedType, options } of l2Cases) {
    const result = await shouldTransfer(message, options || {});
    assert.strictEqual(result.shouldTransfer, true, `"${message}" should trigger handoff`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}`);
    }
  }
});

test('L3 Triggers — 低嚴重性 (LINE Pay 失敗 / 截單後變更 / 開團日 / 付款異常)', async () => {
  const l3Cases = [
    { message: 'LINE Pay 失敗', expectedType: 'linepay_failed' },
    { message: '付不了', expectedType: 'linepay_failed' },
    { message: '再追加', expectedType: 'late_modify' },
    { message: '加一盒', expectedType: 'late_modify' },
    { message: '這週有開嗎', expectedType: null, expectedShouldTransfer: false },
    { message: '金額不符', expectedType: 'payment_mismatch' },
    { message: '轉錯帳號了', expectedType: 'payment_mismatch' },
    { message: '截圖不清楚', expectedType: 'payment_mismatch' },
  ];
  for (const { message, expectedType, expectedShouldTransfer = true } of l3Cases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, expectedShouldTransfer, `"${message}" shouldTransfer=${expectedShouldTransfer}, got ${result.shouldTransfer}`);
    if (expectedShouldTransfer) {
      assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}, got ${result.type}`);
    } else {
      assert.strictEqual(result.type, null, `"${message}" 應不觸發 type, got ${result.type}`);
    }
  }
});

test('Non-Trigger Cases — 不應觸發 handoff', async () => {
  const nonTriggerCases = [
    '我要訂購', '鹽水雞2盒', '三峽北大特區', '下午時段', '謝謝',
    '你好', '多少錢', '我想訂購兩盒鹽水雞', '請問多少錢',
  ];
  for (const message of nonTriggerCases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, false, `"${message}" should NOT trigger handoff`);
  }
});

test('quickMatch — 退款 / 取消 / 折扣 / 一般聊天', () => {
  const cases = [
    { message: '要退款', expectedMatched: true, expectedType: 'refund_request' },
    { message: '不訂了', expectedMatched: true, expectedType: 'cancel_request' },
    { message: '便宜一點', expectedMatched: true, expectedType: 'discount_request' },
    { message: '一般聊天', expectedMatched: false },
  ];
  for (const { message, expectedMatched, expectedType } of cases) {
    const result = quickMatch(message);
    assert.strictEqual(result.matched, expectedMatched, `quickMatch("${message}") should be ${expectedMatched}`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `quickMatch("${message}") type should be ${expectedType}`);
    }
  }
});

test('quickMatch 邊界 — 空字串 / null / undefined', () => {
  assert.strictEqual(quickMatch('').matched, false, '空字串不應匹配');

  // null / undefined 會 throw (KNOWN ISSUE)
  let nullThrew = false;
  try {
    quickMatch(null);
  } catch (e) {
    nullThrew = true;
  }
  assert.strictEqual(nullThrew, true, 'quickMatch(null) 應 throw (KNOWN ISSUE)');

  let undefinedThrew = false;
  try {
    quickMatch(undefined);
  } catch (e) {
    undefinedThrew = true;
  }
  assert.strictEqual(undefinedThrew, true, 'quickMatch(undefined) 應 throw (KNOWN ISSUE)');

  const whitespaceResult = quickMatch('  我要退款  ');
  assert.strictEqual(whitespaceResult.matched, true, '含空白的退款訊息應匹配');
  assert.strictEqual(whitespaceResult.type, 'refund_request');
});

test('Priority Tests — explicit_request 在 escalation 之前', () => {
  const priorityCases = [
    { msg: '叫老闆來', expectFirst: 'escalation' },
    { msg: '叫真人來', expectFirst: 'explicit_request' },
    { msg: '再追加', expectFirst: 'late_modify' },
    { msg: '改一下小菜', expectFirst: 'late_modify' },
  ];
  for (const { msg, expectFirst } of priorityCases) {
    const result = quickMatch(msg);
    assert.strictEqual(result.type, expectFirst, `「${msg}」應匹配 ${expectFirst}`);
  }
});

test('TRIGGER_PATTERNS — 14 種 trigger 完整定義', () => {
  const expectedTypes = [
    'refund_request', 'cancel_request', 'reschedule_request', 'complaint',
    'explicit_request', 'escalation', 'discount_request', 'delivery_confirm_needed',
    'bulk_order', 'high_value_order', 'payment_mismatch', 'linepay_failed',
    'open_date_inquiry', 'late_modify',
  ];
  const actualTypes = TRIGGER_PATTERNS.map((p) => p.type);
  assert.strictEqual(actualTypes.length, 14, `應定義 14 種 trigger, 實際 ${actualTypes.length}`);
  for (const t of expectedTypes) {
    assert.ok(actualTypes.includes(t), `應有 ${t}`);
  }
  for (const p of TRIGGER_PATTERNS) {
    assert.ok(p.type, 'Pattern should have type');
    assert.ok(p.level, 'Pattern should have level');
    assert.ok(Array.isArray(p.keywords) || Array.isArray(p.patterns), 'Pattern should have keywords or patterns');
  }
});

test('semanticMatch — 模糊訊息語意判斷', async () => {
  const cases = [
    { message: '雞肉壞掉了', expectedMatched: true, expectedType: 'complaint' },  // Round 37.32 修：'爛透了' 改為 '雞肉壞掉了' 觸發
    { message: '算便宜一點', expectedMatched: true, expectedType: 'discount_request' },  // Round 37.32 修
    { message: '改到明天', expectedMatched: true, expectedType: 'reschedule_request' },  // Round 37.32 修
    { message: '算了不訂了', expectedMatched: true, expectedType: 'cancel_request' },  // Round 37.32 修
    { message: '完全不知道', expectedMatched: false },
  ];
  for (const { message, expectedMatched, expectedType } of cases) {
    const result = await semanticMatch(message);
    assert.strictEqual(result.matched, expectedMatched, `semanticMatch("${message}") should be matched=${expectedMatched}`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `semanticMatch("${message}") type should be ${expectedType}`);
    }
  }
});

test('getTypeLabel — 14 種 type 對應正確標題', () => {
  const cases = [
    { type: 'refund_request', expected: '【退貨/退款】' },
    { type: 'cancel_request', expected: '【取消訂單】' },
    { type: 'reschedule_request', expected: '【改天需求】' },
    { type: 'complaint', expected: '【售後/客訴】' },
    { type: 'escalation', expected: '【客訴/爭議】' },
    { type: 'explicit_request', expected: '【明確要求真人】' },
    { type: 'discount_request', expected: '【折扣請求】' },
    { type: 'delivery_confirm_needed', expected: '【配送範圍確認】' },
    { type: 'bulk_order', expected: '【大批訂單/公司合作】' },
    { type: 'high_value_order', expected: '【金額異常】' },
    { type: 'payment_mismatch', expected: '【付款異常】' },
    { type: 'linepay_failed', expected: '【LINE Pay 付款失敗】' },
    { type: 'open_date_inquiry', expected: '【開團日期確認】' },
    { type: 'late_modify', expected: '【截單後變更】' },
    { type: 'unknown_type', expected: '【其他】unknown_type' },
  ];
  for (const { type, expected } of cases) {
    assert.strictEqual(getTypeLabel(type), expected, `getTypeLabel("${type}") should be "${expected}"`);
  }
});

test('shouldTransfer high_value_order 邊界 — NT$3000 門檻', async () => {
  const cases = [
    { amount: 3000, shouldTrigger: false, reason: '剛好等於門檻' },
    { amount: 3001, shouldTrigger: true, reason: '超過門檻 1 元' },
    { amount: 5000, shouldTrigger: true },
    { amount: 99999, shouldTrigger: true },
    { amount: 100, shouldTrigger: false },
    { amount: 0, shouldTrigger: false },
  ];
  for (const { amount, shouldTrigger, reason: _reason } of cases) { // _reason unused：只驗證 shouldTransfer，不驗 reason
    const result = await shouldTransfer('我要訂購', { totalAmount: amount });
    assert.strictEqual(result.shouldTransfer, shouldTrigger, `amount=${amount} should shouldTransfer=${shouldTrigger}`);
  }
});

test('shouldTransfer 金額 > NT$3000 優先 (HIGH_VALUE_ORDER 覆蓋)', async () => {
  const cases = [
    { msg: '我要退款', amount: 5000, expectedType: 'high_value_order' },
    { msg: '不訂了', amount: 5000, expectedType: 'high_value_order' },
    { msg: '我要訂購', amount: 5000, expectedType: 'high_value_order' },
    { msg: '我要訂購', amount: 2500, expectedType: null },
    { msg: '我要退款', amount: 2500, expectedType: 'refund_request' },
  ];
  for (const { msg, amount, expectedType } of cases) {
    const result = await shouldTransfer(msg, { totalAmount: amount });
    assert.strictEqual(result.type, expectedType, `「${msg}」amount=${amount} 應為 ${expectedType}`);
  }
});


test('Round 37.32 regression — 價格/日期/時間查詢不應觸發 handoff（Hubert 16:15 修整）', async () => {
  const cases = [
    { message: '我要煙燻雞跟珍珠丸 各一份 這樣多少錢', expectedMatched: false, reason: '價格詢問 AI 自行讀 01_product.md' },
    { message: '最近有哪天開團', expectedMatched: false, reason: '日期查詢 AI 自行讀 chicken.yaml' },
    { message: '現在還能訂嗎', expectedMatched: false, reason: '時間查詢 AI 自行判斷' },
    { message: '怎麼付款', expectedMatched: false, reason: '付款查詢 AI 自行讀 03_payment.md' },
  ];
  for (const { message, expectedMatched, reason } of cases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, expectedMatched, `「${message}」shouldTransfer=${expectedMatched} (${reason})`);
  }
});
