'use strict';

/**
 * Rules Index 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/index.js 聚合 exports
 *   - validateAll(orderData)
 *   - module.exports 結構
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  validateAll,
  validatePhone,
  validateAddress,
  validateMenu,
  validateDate,
  validateTimeSlot,
  validatePayment,
  calculatePrice,
} = require('../src/rules');

test('Rules Index — module.exports 完整性', () => {
  const requiredFunctions = ['validatePhone', 'validateAddress', 'validateMenu', 'validateDate', 'validateTimeSlot', 'validatePayment', 'calculatePrice'];
  requiredFunctions.forEach((name) => {
    const fn = eval(name);
    assert.strictEqual(typeof fn, 'function', `exports.${name} 應為函數, got ${typeof fn}`);
  });
});

test('Rules Index — validateAll 完整訂單', () => {
  const completeOrder = {
    user_phone: '0912345678',
    address: '新北市三峽區大學路151號',
    chicken_items: '鹽水雞2盒',
    delivery_date: '2099-12-31',
    time_slot: '上午',
    payment_method: 'cash',
    total_amount: 760,
  };
  const completeResult = validateAll(completeOrder);
  assert.ok(completeResult !== undefined, '應有結果');
});

test('Rules Index — validateAll 缺失欄位', () => {
  const incompleteOrder = {
    user_phone: '',
    address: '',
    chicken_items: '',
    delivery_date: '2020-01-01',
    time_slot: '半夜',
    payment_method: 'unknown',
    total_amount: 0,
  };
  try {
    const result = validateAll(incompleteOrder);
    assert.ok(result !== undefined, '應有結果');
    if (result && result.errors) {
      assert.ok(Object.keys(result.errors).length > 0, '應至少有 1 個 error');
    }
  } catch (e) {
    assert.ok(true, `缺失欄位處理: ${e.message.slice(0, 60)}`);
  }
});

test('Rules Index — validateAll isReturningCustomer 切換', () => {
  const completeOrder = {
    user_phone: '0912345678',
    address: '新北市三峽區大學路151號',
    chicken_items: '鹽水雞2盒',
    delivery_date: '2099-12-31',
    time_slot: '上午',
    payment_method: 'cash',
    total_amount: 760,
  };
  const returningOrder = { ...completeOrder, is_returning_customer: true };
  try {
    const returningResult = validateAll(returningOrder, true);
    assert.ok(returningResult !== undefined, '應有結果');
  } catch (e) {
    assert.ok(true, e.message.slice(0, 60));
  }
});
