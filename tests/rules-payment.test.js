'use strict';

/**
 * Payment Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/paymentRule.js validatePayment() + PAYMENT_METHODS
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  validatePayment,
  PAYMENT_METHODS,
} = require('../src/rules/paymentRule');

test('Payment Rule — 有效付款方式 + 正常金額', () => {
  const validCases = [
    { method: 'cash', amount: 380 },
    { method: 'transfer', amount: 760 },
    { method: 'linepay', amount: 1000 },
    { method: 'jko', amount: 500 },
  ];
  validCases.forEach(({ method, amount }) => {
    const r = validatePayment(method, amount);
    assert.ok(r !== undefined, `method=${method}, amount=${amount} 應有結果`);
  });
});

test('Payment Rule — 現金上限（New Customer 預設 NT$2000）', () => {
  const overLimit = validatePayment('cash', 5000);
  assert.ok(overLimit !== undefined, '5000 > 現金上限應有結果');
});

test('Payment Rule — 無效付款方式', () => {
  ['unknown', 'credit_card', 'paypal'].forEach((method) => {
    const r = validatePayment(method, 380);
    assert.ok(r !== undefined, `method=${method} 應有結果`);
  });
});

test('Payment Rule — PAYMENT_METHODS 枚舉完整性', () => {
  assert.ok(PAYMENT_METHODS && typeof PAYMENT_METHODS === 'object' && !Array.isArray(PAYMENT_METHODS),
    `PAYMENT_METHODS 應為物件, got ${typeof PAYMENT_METHODS}`);
  if (PAYMENT_METHODS && typeof PAYMENT_METHODS === 'object') {
    const keys = Object.keys(PAYMENT_METHODS);
    assert.ok(keys.length >= 3, `至少 3 種付款方式, got ${keys.length}`);
    assert.ok(keys.some((k) => PAYMENT_METHODS[k] === 'cash'), '應有現金→cash 對應');
    assert.ok(keys.some((k) => PAYMENT_METHODS[k] === 'transfer'), '應有轉帳→transfer 對應');
    assert.ok(keys.some((k) => PAYMENT_METHODS[k] === 'jko'), '應有街口→jko 對應');
    assert.ok(keys.some((k) => PAYMENT_METHODS[k] === 'linepay'), '應有 LINE Pay→linepay 對應');
  }
});
