'use strict';

/**
 * P0-1: addressRule 觸發 handoff 驗證測試
 *
 * 原本 src/rules/addressRule.js 對「超出配送範圍」只回 valid:false，
 * 訊息說「已轉交人工處理」但實際只停在 REASK_INFO。
 *
 * 修整：
 * - addressRule.js 對「超出配送範圍」回 valid:false + action:'handoff_needed' + reason:'out_of_range'
 * - addressRule.js 對「需人工確認」回 valid:false + action:'handoff_needed' + reason:'needs_confirmation'
 * - addressRule.js 對「地址錯誤」回 valid:false + action:'reask'
 * - awaitingInfo.js 對 handoff_needed 結果 return action:'handoff_needed'（不包成 validation_failed）
 * - index.js AWAITING_INFO case 對 handoff_needed 呼叫 handleHandoff → HUMAN_HANDOFF 狀態
 *
 * 本測試驗證：
 * 1. addressRule 對三種情境回傳正確的 action / reason
 * 2. awaitingInfo 把 handoff_needed 動作傳上去（不包成 validation_failed）
 * 3. handleMessage（index.js）對 handoff_needed 觸發 handleHandoff，狀態變 HUMAN_HANDOFF
 */

const assert = require('assert');

const validateAddress = require('../src/rules/addressRule');
const { handleAwaitingInfo } = require('../src/states/awaitingInfo');
const { STATES, setStateDirectly, getState, clearState } = require('../src/states/stateMachine');
const { handleMessage } = require('../src/index');

console.log('\n=== Address Handoff Tests (P0-1) ===');

// ─── 1. addressRule 對三種情境回傳正確的 action / reason ───
console.log('\n--- addressRule returns action ---');

function testAddress(input, expected) {
  const result = validateAddress(input);
  assert.strictEqual(result.valid, expected.valid, `valid mismatch for "${input}"`);
  if (expected.action) {
    assert.strictEqual(result.action, expected.action, `action mismatch for "${input}"`);
  }
  if (expected.reason) {
    assert.strictEqual(result.reason, expected.reason, `reason mismatch for "${input}"`);
  }
  if (expected.errorContains) {
    assert.ok(
      result.errorMessage && result.errorMessage.includes(expected.errorContains),
      `errorMessage should include "${expected.errorContains}" for "${input}"`,
    );
  }
  console.log(`  ✓ "${input}" → action=${result.action || 'none'}, reason=${result.reason || 'none'}`);
}

// 超出配送範圍
testAddress('大溪區三元街123號', {
  valid: false,
  action: 'handoff_needed',
  reason: 'out_of_range',
  errorContains: '超出配送範圍',
});
testAddress('新店區北新路200號', {
  valid: false,
  action: 'handoff_needed',
  reason: 'out_of_range',
  errorContains: '超出配送範圍',
});
testAddress('龍潭區中正路', {
  valid: false,
  action: 'handoff_needed',
  reason: 'out_of_range',
  errorContains: '超出配送範圍',
});

// 需人工確認（不在允許也不在拒絕）
testAddress('台北市信義區', {
  valid: false,
  action: 'handoff_needed',
  reason: 'needs_confirmation',
  errorContains: '需由客服進一步確認',
});

// 地址錯誤（空）
testAddress('', {
  valid: false,
  action: 'reask',
  errorContains: '地址為必填',
});

// 地址合法（valid:true，無 action）
testAddress('三峽北大特區學成路100號', { valid: true });

// ─── 2. awaitingInfo 把 handoff_needed 動作傳上去 ───
console.log('\n--- awaitingInfo forwards handoff_needed ---');

clearState('test-user-1');
setStateDirectly('test-user-1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const r1 = handleAwaitingInfo('test-user-1', '大溪區三元街123號', {}, { awaitingField: 'address' });

assert.strictEqual(r1.action, 'handoff_needed', '應傳上 handoff_needed action');
assert.strictEqual(r1.reason, 'out_of_range', '應傳上 out_of_range reason');
assert.ok(r1.reply, '應有 reply');
assert.strictEqual(r1.reply.type, 'text', 'reply type 應為 text');
assert.ok(r1.reply.text.includes('超出配送範圍'), 'reply 應包含「超出配送範圍」');
console.log(`  ✓ 超出範圍 → action='handoff_needed', reply="${r1.reply.text.substring(0, 30)}..."`);

// 需人工確認
clearState('test-user-2');
setStateDirectly('test-user-2', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const r2 = handleAwaitingInfo('test-user-2', '台北市信義區', {}, { awaitingField: 'address' });

assert.strictEqual(r2.action, 'handoff_needed', '應傳上 handoff_needed action');
assert.strictEqual(r2.reason, 'needs_confirmation', '應傳上 needs_confirmation reason');
console.log(`  ✓ 需人工確認 → action='handoff_needed', reason='needs_confirmation'`);

// 地址錯誤（空）→ 仍走 validation_failed（action='reask'，不是 handoff_needed）
clearState('test-user-3');
setStateDirectly('test-user-3', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const r3 = handleAwaitingInfo('test-user-3', '', {}, { awaitingField: 'address' });

assert.strictEqual(r3.action, 'validation_failed', '空地址仍應走 validation_failed');
console.log(`  ✓ 空地址 → action='validation_failed'（不入 handoff）`);

// ─── 3. handleMessage（index.js）對 handoff_needed 觸發 handleHandoff ───
console.log('\n--- handleMessage triggers handleHandoff ---');

(async () => {
  try {
    clearState('integration-user');
    setStateDirectly('integration-user', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const r = await handleMessage(
      'integration-user',
      '大溪區三元街123號',
      { lineDisplayName: '測試用戶' },
    );

    assert.ok(r.reply, '應有 reply');
    assert.strictEqual(r.reply.type, 'text', 'reply 應是 text');
    // reply 文字應來自 config.getHandoffCustomerReply()（驗證 P0-2 整合）
    const { getHandoffCustomerReply } = require('../src/config');
    assert.strictEqual(
      r.reply.text,
      getHandoffCustomerReply(),
      'reply 應是 config 的 customer_reply',
    );
    assert.strictEqual(r.newState, STATES.HUMAN_HANDOFF, '狀態應為 HUMAN_HANDOFF');
    console.log(`  ✓ handleMessage 觸發 handoff，新狀態 = HUMAN_HANDOFF`);
    console.log(`  ✓ reply 來自 config.getHandoffCustomerReply()`);

    // 邊界：台北市信義區（需人工確認）
    clearState('integration-user-2');
    setStateDirectly('integration-user-2', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const r2 = await handleMessage(
      'integration-user-2',
      '台北市信義區',
      { lineDisplayName: '測試用戶2' },
    );

    assert.strictEqual(r2.newState, STATES.HUMAN_HANDOFF, '需人工確認也應轉 HUMAN_HANDOFF');
    console.log(`  ✓ 「台北市信義區」（需人工確認）也轉 HUMAN_HANDOFF`);

    // 反例：合法地址不應觸發 handoff
    clearState('integration-user-3');
    setStateDirectly('integration-user-3', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const r3 = await handleMessage(
      'integration-user-3',
      '三峽北大特區學成路100號',
      { lineDisplayName: '測試用戶3' },
    );

    assert.notStrictEqual(
      r3.newState,
      STATES.HUMAN_HANDOFF,
      '合法地址不應觸發 handoff',
    );
    console.log(`  ✓ 合法地址不觸發 handoff，新狀態 = ${r3.newState}`);

    // ─── 4. 決策 6：reason 寫入 staff_notes ───
    console.log('\n--- 決策 6：handoff reason 寫入 staff_notes ---');

    clearState('reason-user-1');
    setStateDirectly('reason-user-1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const r4 = await handleMessage(
      'reason-user-1',
      '大溪區三元街123號',
      { lineDisplayName: '測試用戶4' },
    );
    assert.strictEqual(r4.newState, STATES.HUMAN_HANDOFF);
    // 從 state machine 讀回 handoffOrderData
    const state4 = getState('reason-user-1');
    assert.ok(state4.orderData, '應有 orderData');
    assert.ok(
      state4.orderData.staff_notes && state4.orderData.staff_notes.includes('地址超出配送範圍'),
      `staff_notes 應包含「地址超出配送範圍」，實際：${state4.orderData.staff_notes}`,
    );
    console.log(`  ✓ out_of_range reason 寫入 staff_notes: "${state4.orderData.staff_notes}"`);

    // 需人工確認
    clearState('reason-user-2');
    setStateDirectly('reason-user-2', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const r5 = await handleMessage(
      'reason-user-2',
      '台北市信義區',
      { lineDisplayName: '測試用戶5' },
    );
    assert.strictEqual(r5.newState, STATES.HUMAN_HANDOFF);
    const state5 = getState('reason-user-2');
    assert.ok(
      state5.orderData.staff_notes && state5.orderData.staff_notes.includes('配送範圍需人工確認'),
      `staff_notes 應包含「配送範圍需人工確認」，實際：${state5.orderData.staff_notes}`,
    );
    console.log(`  ✓ needs_confirmation reason 寫入 staff_notes: "${state5.orderData.staff_notes}"`);

    // 反例：一般 handoff（不是 address 觸發）不應有 reason
    clearState('reason-user-3');
    setStateDirectly('reason-user-3', STATES.IDLE, {}, {});

    const r6 = await handleMessage(
      'reason-user-3',
      '我要退款',
      { lineDisplayName: '測試用戶6' },
    );
    assert.strictEqual(r6.newState, STATES.HUMAN_HANDOFF);
    // 「我要退款」不來自 address handoff，staff_notes 要不是空字串、undefined、要不就是
    // 不含「地址超出 / 配送範圍」字樣。
    const state6 = getState('reason-user-3');
    const note6 = state6.orderData && state6.orderData.staff_notes;
    assert.ok(
      !note6 || (!note6.includes('地址超出') && !note6.includes('配送範圍需人工確認')),
      `一般 handoff 不應有 address reason，實際 staff_notes: ${JSON.stringify(note6)}`,
    );
    console.log(`  ✓ 一般 handoff（退款）staff_notes 不含 address reason（"${note6 || '(無)'}"）`);

    console.log('\n========================================');
    console.log('ALL ADDRESS HANDOFF TESTS PASSED ✓');
    console.log('========================================\n');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
})();
