'use strict';

/**
 * P0-3: stateMachine 保留 trimmed 值驗證測試（node:test 風格 · P1-4）
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
 * 本測試驗證（聚焦 address 欄位）：
 * 1. 新邏輯：address 欄位 trimmed 後寫入 transition.orderData
 * 2. 向後相容：只用 value（沒 fieldValue）時仍能正常運作（既有測試風格）
 * 3. 既有測試：handleAwaitingInfo 內部已 trim
 * 4. 邊界：fieldValue undefined fallback 到 value
 * 5. 驗證失敗不覆蓋已驗證值
 * 6. 與既有 states.test.js 行為一致
 */

const assert = require('assert');
const { test } = require('node:test');

const {
  STATES,
  getState,
  clearState,
  transition,
  setStateDirectly,
} = require('../src/states/stateMachine');
const { handleAwaitingInfo } = require('../src/states/awaitingInfo');

// ═════════════════════════════════════════════════════════════════
// 1. handleAwaitingInfo 內部已 trim
// ═════════════════════════════════════════════════════════════════

test('handleAwaitingInfo trims internally (address)', () => {
  clearState('test-user-1');
  setStateDirectly('test-user-1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

  const rawInput = '  三峽北大特區學成路100號  ';
  const awaitingResult = handleAwaitingInfo('test-user-1', rawInput, {}, { awaitingField: 'address' });

  assert.strictEqual(awaitingResult.orderData.address, '三峽北大特區學成路100號',
    'awaitingInfo 內部應已 trim');
});

// ═════════════════════════════════════════════════════════════════
// 2. P0-3 核心：transition 用 trimmed 值（fieldValue 優先）
// ═════════════════════════════════════════════════════════════════

test('transition preserves trimmed value (P0-3 core fix)', () => {
  clearState('test-user-2');
  setStateDirectly('test-user-2', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

  const rawInput = '  三峽北大特區學成路100號  ';
  const awaitingResult2 = handleAwaitingInfo('test-user-2', rawInput, {}, { awaitingField: 'address' });

  // 模擬 index.js 改後的呼叫
  const fieldValue = awaitingResult2.orderData.address; // 已 trimmed
  const transitionResult = transition('test-user-2', 'field_received', {
    fieldName: 'address',
    fieldValue, // 已 trimmed 的值
    value: rawInput, // 未 trim 的值（向後相容用）
    nextField: awaitingResult2.context.awaitingField,
    validationFailed: false,
  });

  assert.strictEqual(transitionResult.orderData.address, '三峽北大特區學成路100號',
    'transition 應用 trimmed 後的值');
});

// ═════════════════════════════════════════════════════════════════
// 3. 向後相容：只用 value（沒 fieldValue）
// ═════════════════════════════════════════════════════════════════

test('backward compat: only value (no fieldValue)', () => {
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
});

// ═════════════════════════════════════════════════════════════════
// 4. 邊界：fieldValue undefined → fallback 到 value
// ═════════════════════════════════════════════════════════════════

test('edge case: fieldValue undefined fallback to value', () => {
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
});

// ═════════════════════════════════════════════════════════════════
// 5. 驗證失敗：fieldValue 應為 undefined（不覆蓋已驗證值）
// ═════════════════════════════════════════════════════════════════

test('validation failure preserves prior trimmed address', () => {
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

  // Step B: 跳過 community → name 驗證失敗
  const contextB = getState('test-user-5').context;
  const orderDataB = getState('test-user-5').orderData;

  const stepBCommunity = handleAwaitingInfo('test-user-5', '無', orderDataB, contextB);
  assert.strictEqual(stepBCommunity.context.awaitingField, 'name', '跳過 community 後 nextField 應為 name');

  const stepB = handleAwaitingInfo('test-user-5', '', stepBCommunity.orderData, stepBCommunity.context);
  assert.strictEqual(stepB.action, 'validation_failed', '空 name 應驗證失敗');

  // 模擬 index.js 的 transition 呼叫
  const transitionB = transition('test-user-5', 'field_received', {
    fieldName: stepBCommunity.context.awaitingField, // 'name'
    fieldValue: stepB.orderData ? stepB.orderData[stepBCommunity.context.awaitingField] : undefined,
    value: '',
    nextField: stepB.context.awaitingField,
    validationFailed: true,
  });

  // transition 不應把空字串寫入已存在的 address
  assert.strictEqual(transitionB.orderData.address, '三峽',
    '驗證失敗不應覆蓋已驗證的 address');
});

// ═════════════════════════════════════════════════════════════════
// 6. 與既有 states.test.js 行為一致
// ═════════════════════════════════════════════════════════════════

test('compatibility with states.test.js', () => {
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
});
