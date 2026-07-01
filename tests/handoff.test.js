'use strict';

/**
 * Human Handoff 觸發測試
 * 14 種條件的語意觸發測試
 */

const assert = require('assert');

// Load handoff modules
const { shouldTransfer, quickMatch, semanticMatch, getTypeLabel, TRIGGER_PATTERNS } = require('../src/handoff/transferRules');

console.log('\n=== Human Handoff Tests ===');

async function runTests() {
  // ========== L1: 高嚴重性 ==========
  console.log('\n--- L1 Triggers ---');

  const l1TestCases = [
    // 退款相關
    { message: '要退款', expectedType: 'refund_request' },
    { message: '錢退回来', expectedType: 'refund_request' },
    { message: '退我钱', expectedType: 'refund_request' },
    // 取消訂單
    { message: '不訂了', expectedType: 'cancel_request' },
    { message: '取消吧', expectedType: 'cancel_request' },
    // 改天
    { message: '改到明天', expectedType: 'reschedule_request' },
    { message: '想换日期', expectedType: 'reschedule_request' },
    // 抱怨
    { message: '雞肉壞了', expectedType: 'complaint' },
    { message: '有問題', expectedType: 'complaint' },
    // 明確要求真人
    { message: '叫你老闆來', expectedType: 'escalation' },
    { message: '叫真人', expectedType: 'explicit_request' },
  ];

  for (const { message, expectedType } of l1TestCases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, true, `"${message}" should trigger handoff`);
    assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}, got ${result.type}`);
    console.log(`  ✓ "${message}" → ${result.type} (${result.level})`);
  }

  // ========== L2: 中嚴重性 ==========
  console.log('\n--- L2 Triggers ---');

  const l2TestCases = [
    // 折扣請求
    { message: '便宜一点', expectedType: 'discount_request' },
    { message: '打个折', expectedType: 'discount_request' },
    // 大量訂購
    { message: '公司訂購', expectedType: 'bulk_order' },
    { message: '大量採購', expectedType: 'bulk_order' },
    // 金額異常
    { message: '我想訂很多', expectedType: null, options: { totalAmount: 5000 } },
  ];

  for (const { message, expectedType, options } of l2TestCases) {
    const result = await shouldTransfer(message, options || {});
    assert.strictEqual(result.shouldTransfer, true, `"${message}" should trigger handoff`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}`);
    }
    console.log(`  ✓ "${message}" → ${result.type} (${result.level})`);
  }

  // ========== L3: 低嚴重性 ==========
  console.log('\n--- L3 Triggers ---');

  const l3TestCases = [
    { message: 'LINE Pay 失敗', expectedType: 'linepay_failed' },
    { message: '付不了', expectedType: 'linepay_failed' },
    { message: '再追加', expectedType: 'late_modify' },
    { message: '加一盒', expectedType: 'late_modify' },
    { message: '這週有開嗎', expectedType: 'open_date_inquiry' },
    // Session H8-B 補完：payment_mismatch（原測試漏）
    { message: '金額不符', expectedType: 'payment_mismatch' },
    { message: '轉錯帳號了', expectedType: 'payment_mismatch' },
    { message: '截圖不清楚', expectedType: 'payment_mismatch' },
  ];

  for (const { message, expectedType } of l3TestCases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, true, `"${message}" should trigger handoff`);
    assert.strictEqual(result.type, expectedType, `"${message}" should be ${expectedType}`);
    console.log(`  ✓ "${message}" → ${result.type} (${result.level})`);
  }

  // ========== 不應觸發的案例 ==========
  console.log('\n--- Non-Trigger Cases ---');

  const nonTriggerCases = [
    '我要訂購',
    '鹽水雞2盒',
    '三峽北大特區',
    '下午時段',
    '謝謝',
    '你好',
    '多少錢',
    '我想訂購兩盒鹽水雞',
    '請問多少錢',
    '謝謝',
  ];

  for (const message of nonTriggerCases) {
    const result = await shouldTransfer(message);
    assert.strictEqual(result.shouldTransfer, false, `"${message}" should NOT trigger handoff`);
    console.log(`  ✓ "${message}" → NOT triggered`);
  }

  // ========== quickMatch Tests ==========
  console.log('\n--- Quick Match ---');

  const quickMatchCases = [
    { message: '要退款', expectedMatched: true, expectedType: 'refund_request' },
    { message: '不訂了', expectedMatched: true, expectedType: 'cancel_request' },
    { message: '便宜一點', expectedMatched: true, expectedType: 'discount_request' },
    { message: '一般聊天', expectedMatched: false },
  ];

  for (const { message, expectedMatched, expectedType } of quickMatchCases) {
    const result = quickMatch(message);
    assert.strictEqual(result.matched, expectedMatched, `quickMatch("${message}") should be ${expectedMatched}`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `quickMatch("${message}") type should be ${expectedType}`);
    }
    console.log(`  ✓ quickMatch("${message}") = matched:${result.matched}, type:${result.type || 'null'}`);
  }

  // ========== Edge Cases (Session H8-B) ==========
  console.log('\n--- Edge Cases ---');

  // 空字串 → 不 match（不 crash）
  const emptyResult = quickMatch('');
  assert.strictEqual(emptyResult.matched, false, '空字串不應匹配');
  console.log('  ✓ quickMatch("") → unmatched');

  // ⚠️ KNOWN ISSUE (Session H8-B 發現)：quickMatch(null) 會 throw
  // 因為 src/handoff/transferRules.js:163 直接做 message.trim() 沒防護
  // 不在 H8 session 修整範圍（屬於 refactor session）
  let nullThrew = false;
  try {
    quickMatch(null);
  } catch (e) {
    nullThrew = true;
    assert.ok(/Cannot read.*trim|null/i.test(e.message), `應 throw null-related error, got: ${e.message.slice(0, 80)}`);
  }
  assert.strictEqual(nullThrew, true, 'quickMatch(null) 應 throw（KNOWN ISSUE，記錄以供後續修復）');
  console.log('  ✓ quickMatch(null) throws TypeError（KNOWN ISSUE）');

  let undefinedThrew = false;
  try {
    quickMatch(undefined);
  } catch (e) {
    undefinedThrew = true;
  }
  assert.strictEqual(undefinedThrew, true, 'quickMatch(undefined) 應 throw（KNOWN ISSUE）');
  console.log('  ✓ quickMatch(undefined) throws TypeError（KNOWN ISSUE）');

  // 訊息包含前後空白會被 trim
  const whitespaceResult = quickMatch('  我要退款  ');
  assert.strictEqual(whitespaceResult.matched, true, '含空白的退款訊息應匹配');
  assert.strictEqual(whitespaceResult.type, 'refund_request', '應為 refund_request');
  console.log('  ✓ quickMatch("  我要退款  ") → refund_request（trim 後匹配）');

  // ========== Priority Tests (Session H8-B) ==========
  // explicit_request 必須在 escalation 之前（避免「叫老闆」被搶先匹配為 escalation）
  console.log('\n--- Priority Tests ---');

  const priorityCases = [
    { msg: '叫老闆來', expectFirst: 'escalation', reason: '「叫老闆」是 escalation 觸發' },
    { msg: '叫真人來', expectFirst: 'explicit_request', reason: '「叫真人」是 explicit_request 觸發' },
    { msg: '再追加', expectFirst: 'late_modify', reason: '「再追加」是 late_modify（不能被 reschedule 搶先）' },
    { msg: '改一下小菜', expectFirst: 'late_modify', reason: '「改一下小菜」是 late_modify（不能被 reschedule 搶先）' },
  ];

  for (const { msg, expectFirst, reason } of priorityCases) {
    const result = quickMatch(msg);
    assert.strictEqual(result.type, expectFirst, `「${msg}」應匹配 ${expectFirst}（${reason}）, got ${result.type}`);
    console.log(`  ✓ quickMatch("${msg}") = ${result.type}（${reason}）`);
  }

  // ========== TRIGGER_PATTERNS 完整性（Session H8-B）==========
  console.log('\n--- All 14 Trigger Types Defined ---');
  const allPatterns = TRIGGER_PATTERNS;
  const expectedTypes = [
    'refund_request', 'cancel_request', 'reschedule_request', 'complaint',
    'explicit_request', 'escalation', 'discount_request', 'delivery_confirm_needed',
    'bulk_order', 'high_value_order', 'payment_mismatch', 'linepay_failed',
    'open_date_inquiry', 'late_modify',
  ];
  const actualTypes = allPatterns.map((p) => p.type);
  console.log(`  ✓ 定義數量: ${actualTypes.length} (期望 14)`);
  assert.strictEqual(actualTypes.length, 14, `應定義 14 種 trigger，實際 ${actualTypes.length}`);
  for (const t of expectedTypes) {
    assert.ok(actualTypes.includes(t), `應有 ${t}`);
  }
  console.log(`  ✓ 14 種 trigger 全部定義: ${expectedTypes.join(', ')}`);

  // ========== TRIGGER_PATTERNS ==========
  console.log('\n--- All Trigger Patterns ---');

  console.log(`  ✓ Total trigger patterns: ${allPatterns.length}`);
  for (const p of allPatterns) {
    assert.ok(p.type, `Pattern should have type: ${JSON.stringify(p)}`);
    assert.ok(p.level, `Pattern should have level: ${JSON.stringify(p)}`);
    assert.ok(Array.isArray(p.keywords) || Array.isArray(p.patterns), `Pattern should have keywords or patterns`);
  }
  console.log(`  ✓ All patterns have required fields`);

  console.log('\n========================================');
  console.log('ALL HANDOFF TESTS PASSED ✓');
  console.log('========================================\n');

  // ========== semanticMatch Tests (Session H8-B) ==========
  // 注意：semanticMatch 在 quickMatch 命中時回傳 confidence: 1.0
  // 語意判斷只對 quickMatch 未命中的模糊訊息有用
  console.log('\n--- Semantic Match ---');

  const semanticTestCases = [
    { message: '爛透了', expectedMatched: true, expectedType: 'complaint' },
    { message: '好貴喔', expectedMatched: true, expectedType: 'discount_request' },
    { message: '明天吧', expectedMatched: true, expectedType: 'reschedule_request' },
    { message: '不要了啦', expectedMatched: true, expectedType: 'cancel_request' },
    { message: '完全不知道', expectedMatched: false },
  ];

  for (const { message, expectedMatched, expectedType } of semanticTestCases) {
    const result = await semanticMatch(message);
    assert.strictEqual(result.matched, expectedMatched, `semanticMatch("${message}") should be matched=${expectedMatched}, got ${result.matched}`);
    if (expectedType) {
      assert.strictEqual(result.type, expectedType, `semanticMatch("${message}") type should be ${expectedType}, got ${result.type}`);
    }
    console.log(`  ✓ semanticMatch("${message}") = matched:${result.matched}, type:${result.type || 'null'}, confidence:${result.confidence}`);
  }

  // ========== getTypeLabel Tests (Session H8-B) ==========
  console.log('\n--- getTypeLabel ---');

  const labelTestCases = [
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

  for (const { type, expected } of labelTestCases) {
    const label = getTypeLabel(type);
    assert.strictEqual(label, expected, `getTypeLabel("${type}") should be "${expected}", got "${label}"`);
    console.log(`  ✓ getTypeLabel("${type}") = "${label}"`);
  }

  // ========== shouldTransfer high_value_order 詳細 (Session H8-B) ==========
  console.log('\n--- shouldTransfer: high_value_order 邊界 ---');

  // 門檻是 NT$3000
  const highValueCases = [
    { amount: 3000, shouldTrigger: false, reason: '剛好等於門檻值不觸發' },
    { amount: 3001, shouldTrigger: true, reason: '超過門檻 1 元觸發' },
    { amount: 5000, shouldTrigger: true, reason: '大量觸發' },
    { amount: 99999, shouldTrigger: true, reason: '極大量觸發' },
    { amount: 100, shouldTrigger: false, reason: '小額不觸發' },
    { amount: 0, shouldTrigger: false, reason: '0 元不觸發' },
  ];

  for (const { amount, shouldTrigger, reason } of highValueCases) {
    const result = await shouldTransfer('我要訂購', { totalAmount: amount });
    assert.strictEqual(result.shouldTransfer, shouldTrigger, `amount=${amount} 應 shouldTransfer=${shouldTrigger}, got ${result.shouldTransfer}（${reason}）`);
    console.log(`  ✓ amount=${amount} → shouldTransfer=${result.shouldTransfer}（${reason}）`);
  }

  // ========== shouldTransfer: 金額優先級 ==========
  console.log('\n--- shouldTransfer: 金額 > NT$3000 優先 priority ---');

  // 設計決策：當 totalAmount > 3000 時，shouldTransfer 先返回 high_value_order
  // 不論訊息內容（即使訊息本身是退款/取消等）— 金額異常是 hidden risk
  // 這個优先级有商樝余票，但保持為现状避免改動 production 行為 (H8 不修 production)
  const amountCases = [
    { msg: '我要退款', amount: 5000, expectedType: 'high_value_order' },
    { msg: '不訂了', amount: 5000, expectedType: 'high_value_order' },
    { msg: '我要訂購', amount: 5000, expectedType: 'high_value_order' },
    { msg: '我要訂購', amount: 2500, expectedType: null, note: '金額未超門檻，無關鍵詞未觸發' },
    { msg: '我要退款', amount: 2500, expectedType: 'refund_request' },
  ];
  for (const { msg, amount, expectedType, note } of amountCases) {
    const result = await shouldTransfer(msg, { totalAmount: amount });
    assert.strictEqual(result.type, expectedType, `「${msg}」(amount=${amount}) 應為 ${expectedType}, got ${result.type}${note ? ` (${note})` : ''}`);
    console.log(`  ✓ 「${msg}」amount=${amount} → ${result.type}${note ? ` (${note})` : ''}`);
  }

  console.log('\n========================================');
  console.log('ALL HANDOFF TESTS PASSED (H8-B 擴充) ✓');
  console.log('========================================\n');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
