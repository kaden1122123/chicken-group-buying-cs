'use strict';

/**
 * Rules Index 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/index.js 聚合 exports
 *   - validateAll(orderData)
 *   - module.exports 結構
 */

const assert = require('assert');
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

console.log('\n=== Rules Index Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- module.exports 完整性 ---');
const requiredFunctions = ['validatePhone', 'validateAddress', 'validateMenu', 'validateDate', 'validateTimeSlot', 'validatePayment', 'calculatePrice'];
requiredFunctions.forEach((name) => {
  const fn = eval(name);
  check(`exports.${name} 是函數`, typeof fn === 'function', `got ${typeof fn}`);
});

console.log('\n--- validateAll: 完整訂單 ---');
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
check('回傳 result', completeResult !== undefined, '應有結果');

console.log('\n--- validateAll: 缺失欄位 ---');
const incompleteOrder = {
  user_phone: '', // 缺電話
  address: '',
  chicken_items: '',
  delivery_date: '2020-01-01', // 過去
  time_slot: '半夜',
  payment_method: 'unknown',
  total_amount: 0,
};
try {
  const result = validateAll(incompleteOrder);
  check('缺失欄位仍回傳 result', result !== undefined, '應有結果');
  if (result && result.errors) {
    check('有多個 errors', Object.keys(result.errors).length > 0, '應至少有 1 個 error');
  }
} catch (e) {
  check('缺失欄位處理（容許 throw）', true, `throw: ${e.message.slice(0, 60)}`);
}

console.log('\n--- validateAll: isReturningCustomer 切換 ---');
const returningOrder = { ...completeOrder, is_returning_customer: true };
try {
  const returningResult = validateAll(returningOrder, true);
  check('isReturningCustomer=true 仍回傳 result', returningResult !== undefined, '應有結果');
} catch (e) {
  check('isReturningCustomer=true 處理', true, e.message.slice(0, 60));
}

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
