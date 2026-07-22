'use strict';

/**
 * D3-4/D3-5 測試：驗證付款方式訊息從 config 動態生成
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const SRC_INDEX = path.join(__dirname, '..', 'src', 'index.js');
const SRC_CONFIRMING = path.join(__dirname, '..', 'src', 'states', 'confirming.js');

const indexSource = fs.readFileSync(SRC_INDEX, 'utf8');
const confirmingSource = fs.readFileSync(SRC_CONFIRMING, 'utf8');

test('1. src/index.js 不再 hardcode 銀行帳號 + LINE Pay ID', () => {
  assert.ok(!/23257030422/.test(indexSource), 'src/index.js 不應再 hardcode 23257030422');
  assert.ok(!/Willy0221/.test(indexSource), 'src/index.js 不應再 hardcode Willy0221');
  assert.ok(/getPaymentConfig/.test(indexSource), 'src/index.js 應引用 getPaymentConfig');
  assert.ok(/isFeatureEnabled/.test(indexSource), 'src/index.js 應引用 isFeatureEnabled');
});

test('2. src/states/confirming.js 不再 hardcode', () => {
  assert.ok(!/23257030422/.test(confirmingSource), 'src/states/confirming.js 不應再 hardcode 23257030422');
  assert.ok(!/Willy0221/.test(confirmingSource), 'src/states/confirming.js 不應再 hardcode Willy0221');
  assert.ok(/getPaymentConfig/.test(confirmingSource), 'src/states/confirming.js 應引用 getPaymentConfig');
  assert.ok(/isFeatureEnabled/.test(confirmingSource), 'src/states/confirming.js 應引用 isFeatureEnabled');
});

test('3. 兩個檔案都檢查 5 個付款相關 flag', () => {
  const expectedFlags = [
    'payment.cash.enabled',
    'payment.transfer.enabled',
    'payment.linepay.enabled',
    'official.line_pay.enabled',
    'payment.jko.enabled',
  ];
  for (const flag of expectedFlags) {
    assert.ok(indexSource.includes(flag), `src/index.js 應檢查 ${flag}`);
    assert.ok(confirmingSource.includes(flag), `src/states/confirming.js 應檢查 ${flag}`);
  }
});

test('4. config 介面回傳正確值（從 chicken.yaml 讀）', () => {
  const { getPaymentConfig } = require('../src/config');
  const paymentConfig = getPaymentConfig();
  assert.strictEqual(paymentConfig.transfer.bank_code, '007');
  assert.strictEqual(paymentConfig.transfer.account, '23257030422');
  assert.strictEqual(paymentConfig.linepay.line_id, 'Willy0221');
});

test('5. 5 個付款 flag 預設啟用', () => {
  const { isFeatureEnabled } = require('../src/config');
  assert.strictEqual(isFeatureEnabled('payment.cash.enabled'), true);
  assert.strictEqual(isFeatureEnabled('payment.transfer.enabled'), true);
  assert.strictEqual(isFeatureEnabled('payment.jko.enabled'), true);
  assert.strictEqual(isFeatureEnabled('payment.linepay.enabled'), true);
  assert.strictEqual(isFeatureEnabled('official.line_pay.enabled'), true);
});

test('6. 整合測試：CONFIRMING 收到「確認」時回覆訊息正確（含 4 種付款 + 銀行資訊）', async () => {
  const { handleMessage } = require('../src/index');
  const { STATES, clearState, setState } = require('../src/states/stateMachine');

  clearState('test_d34_user');
  setState('test_d34_user', { state: STATES.CONFIRMING, orderData: {}, context: {} });
  const result = await handleMessage('test_d34_user', '確認', { lineDisplayName: 'Test' });
  const text = result.reply.text;

  assert.ok(text.includes('現金'));
  assert.ok(text.includes('轉帳'));
  assert.ok(text.includes('LINE Pay'));
  assert.ok(text.includes('街口'));
  assert.ok(text.includes('007'));
  assert.ok(text.includes('23257030422'));
  assert.ok(text.includes('Willy0221'));
});
