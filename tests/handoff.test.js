'use strict';

/**
 * Human Handoff 觸發測試
 * 14 種條件的語意觸發測試
 */

const assert = require('assert');

// Load handoff modules
const { shouldTransfer, quickMatch, TRIGGER_PATTERNS } = require('../src/handoff/transferRules');

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

  // ========== TRIGGER_PATTERNS ==========
  console.log('\n--- All Trigger Patterns ---');

  const allPatterns = TRIGGER_PATTERNS;
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
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
