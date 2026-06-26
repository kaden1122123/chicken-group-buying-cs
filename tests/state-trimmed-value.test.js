'use strict';

/**
 * P0-3: stateMachine 保留 trimmed 值驗證測試
 *
 * 原本 src/index.js AWAITING_INFO case 會呼叫：
 *   transition(userId, 'field_received', {
 *     fieldName: context.awaitingField,
 *     value: cleanMessage, // 未 trim 的用戶輸入
 *     ...
 *   });
 *
 * 而 stateMachine.js transition 內會用 value 覆蓋 updatedOrderData：
 *   updatedOrderData = { ...updatedOrderData, [fieldName]: fieldValue };
 *
 * 問題：
 * - awaitingInfo.handleAwaitingInfo 內已 value.trim() 並存到 updatedOrderData.address
 * - 但 transition 後又被未 trim 的 cleanMessage 覆蓋
 * - 結果 CSV 寫入時 address 帶前後空白
 *
 * 修整：
 * - index.js 改用 result.orderData[fieldName]（已 trimmed）作為 fieldValue 傳給 transition
 * - stateMachine.js 優先用 data.fieldValue，fallback 到 data.value（向後相容）
 *
 * 本測試驗證（聚焦 address 欄位，因為 FIELD_ORDER 與 orderData key 在該欄位一致）：
 * 1. 新邏輯：address 欄位 trimmed 後寫入 transition.orderData
 * 2. 向後相容：只用 value（沒 fieldValue）時仍能正常運作（既有測試風格）
 * 3. 既有測試：handleAwaitingInfo 內部已 trim
 */

const assert = require('assert');

const {
  STATES,
  getState,
  clearState,
  transition,
  setStateDirectly,
} = require('../src/states/stateMachine');
const { handleAwaitingInfo } = require('../src/states/awaitingInfo');

console.log('\n=== State Trimmed Value Tests (P0-3) ===');

// ─── 1. handleAwaitingInfo 內部已 trim ───
console.log('\n--- handleAwaitingInfo trims internally ---');

clearState('test-user-1');
setStateDirectly('test-user-1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const rawInput = '  三峽北大特區學成路100號  ';
const awaitingResult = handleAwaitingInfo('test-user-1', rawInput, {}, { awaitingField: 'address' });

assert.strictEqual(awaitingResult.orderData.address, '三峽北大特區學成路100號',
  'awaitingInfo 內部應已 trim');
console.log('  ✓ awaitingInfo 內部 trim 正確（address）');

// ─── 2. P0-3 核心：transition 用 trimmed 值（fieldValue 優先）───
console.log('\n--- transition preserves trimmed value (P0-3 core fix) ---');

clearState('test-user-2');
setStateDirectly('test-user-2', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const awaitingResult2 = handleAwaitingInfo('test-user-2', rawInput, {}, { awaitingField: 'address' });

// 模擬 index.js 改後的呼叫
const fieldValue = awaitingResult2.orderData.address; // 已 trimmed
const transitionResult = transition('test-user-2', 'field_received', {
  fieldName: 'address',
  fieldValue: fieldValue, // 已 trimmed 的值
  value: rawInput, // 未 trim 的值（向後相容用）
  nextField: awaitingResult2.context.awaitingField,
  validationFailed: false,
});

assert.strictEqual(
  transitionResult.orderData.address,
  '三峽北大特區學成路100號',
  'transition 應用 trimmed 後的值'
);
console.log('  ✓ transition 用 trimmed 值（fieldValue 優先）');
console.log(`    address: "${transitionResult.orderData.address}"`);

// ─── 3. 對照組：沒有 fieldValue，只用 value（既有測試行為）───
console.log('\n--- backward compat: only value (no fieldValue) ---');

clearState('test-user-3');
setStateDirectly('test-user-3', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const transitionResult3 = transition('test-user-3', 'field_received', {
  fieldName: 'address',
  value: '三峽北大特區',
  nextField: 'name',
  validationFailed: false,
});

assert.strictEqual(transitionResult3.orderData.address, '三峽北大特區',
  '向後相容：只用 value 仍能正常運作');
console.log('  ✓ 向後相容：既有測試風格呼叫仍能正確');

// ─── 4. 邊界：fieldValue 是 undefined 時 fallback 到 value ───
console.log('\n--- edge case: fieldValue undefined, fallback to value ---');

clearState('test-user-4');
setStateDirectly('test-user-4', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const transitionResult4 = transition('test-user-4', 'field_received', {
  fieldName: 'address',
  fieldValue: undefined, // 模擬 awaitingInfo 沒寫入此欄位的極端情境
  value: '三峽', // fallback
  nextField: 'name',
  validationFailed: false,
});

assert.strictEqual(transitionResult4.orderData.address, '三峽',
  'fieldValue undefined 時應 fallback 到 value');
console.log('  ✓ fieldValue undefined 時 fallback 到 value');

// ─── 5. 驗證失敗時 fieldValue 應為 undefined（不覆蓋已驗證值）───
console.log('\n--- validation failure: fieldValue undefined ---');

clearState('test-user-5');
setStateDirectly('test-user-5', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

// Step A: 正常輸入 address
const stepA = handleAwaitingInfo('test-user-5', '  三峽  ', {}, { awaitingField: 'address' });
const transitionA = transition('test-user-5', 'field_received', {
  fieldName: 'address',
  fieldValue: stepA.orderData.address,
  value: '  三峽  ',
  nextField: stepA.context.awaitingField,
  validationFailed: false,
});
assert.strictEqual(transitionA.orderData.address, '三峽');
console.log(`  ✓ Step A: 已寫入 trimmed address = "三峽"`);

// Step B: 假設下一個欄位 name 驗證失敗
const contextB = getState('test-user-5').context;
const orderDataB = getState('test-user-5').orderData;

const stepB = handleAwaitingInfo('test-user-5', '', orderDataB, contextB);
assert.strictEqual(stepB.action, 'validation_failed', '空 name 應驗證失敗');

// 模擬 index.js 的 transition 呼叫
const transitionB = transition('test-user-5', 'field_received', {
  fieldName: contextB.awaitingField, // 'name'
  fieldValue: stepB.orderData ? stepB.orderData[contextB.awaitingField] : undefined,
  value: '',
  nextField: stepB.context.awaitingField,
  validationFailed: true,
});

// transition 不應把空字串寫入已存在的 address
assert.strictEqual(
  transitionB.orderData.address,
  '三峽',
  '驗證失敗不應覆蓋已驗證的 address'
);
console.log('  ✓ 驗證失敗時 address 保持 trimmed 值');

// ─── 6. 與既有 states.test.js 行為一致 ───
console.log('\n--- compatibility with states.test.js ---');

clearState('test-user-6');
setStateDirectly('test-user-6', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

// 完全模仿 states.test.js 的呼叫方式（只有 value，沒 fieldValue）
const result6 = transition('test-user-6', 'field_received', {
  fieldName: 'address',
  value: '三峽北大特區',
  nextField: 'name',
  validationFailed: false,
});
assert.strictEqual(result6.newState, STATES.AWAITING_INFO);
assert.strictEqual(result6.orderData.address, '三峽北大特區');
console.log('  ✓ 既有 states.test.js 風格呼叫仍能正確');

console.log('\n========================================');
console.log('ALL STATE TRIMMED VALUE TESTS PASSED ✓');
console.log('========================================\n');