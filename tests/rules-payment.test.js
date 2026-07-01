'use strict';

/**
 * Payment Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/paymentRule.js validatePayment() + PAYMENT_METHODS
 */

const assert = require('assert');
const {
  validatePayment,
  PAYMENT_METHODS,
} = require('../src/rules/paymentRule');

console.log('\n=== Payment Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- validatePayment: 有效付款方式 + 正常金額 ---');
const validCases = [
  { method: 'cash', amount: 380 },
  { method: 'transfer', amount: 760 },
  { method: 'linepay', amount: 1000 },
  { method: 'jko', amount: 500 },
];
validCases.forEach(({ method, amount }) => {
  const r = validatePayment(method, amount);
  check(`method=${method}, amount=${amount} 回傳 result`, r !== undefined, '應有結果');
});

console.log('\n--- validatePayment: 現金上限（New Customer 預設 NT$2000）---');
const overLimit = validatePayment('cash', 5000);
check('5000 > 現金上限回傳 result', overLimit !== undefined, '應有結果');

console.log('\n--- validatePayment: 無效付款方式 ---');
['unknown', 'credit_card', 'paypal'].forEach((method) => {
  const r = validatePayment(method, 380);
  check(`method=${method} 回傳 result`, r !== undefined, '應有結果');
});

console.log('\n--- PAYMENT_METHODS 枚舉 ---');
check('PAYMENT_METHODS 是物件', PAYMENT_METHODS && typeof PAYMENT_METHODS === 'object' && !Array.isArray(PAYMENT_METHODS), `got ${typeof PAYMENT_METHODS}`);
if (PAYMENT_METHODS && typeof PAYMENT_METHODS === 'object') {
  const keys = Object.keys(PAYMENT_METHODS);
  check('至少 3 種付款方式對應', keys.length >= 3, `got ${keys.length} 種`);
  check('包含現金對應', keys.some((k) => PAYMENT_METHODS[k] === 'cash'), '應有現金→cash 對應');
  check('包含轉帳對應', keys.some((k) => PAYMENT_METHODS[k] === 'transfer'), '應有轉帳→transfer 對應');
  check('包含街口對應', keys.some((k) => PAYMENT_METHODS[k] === 'jko'), '應有街口→jko 對應');
  check('包含 LINE Pay 對應', keys.some((k) => PAYMENT_METHODS[k] === 'linepay'), '應有 LINE Pay→linepay 對應');
}

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
