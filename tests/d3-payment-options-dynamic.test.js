'use strict';

/**
 * D3-4/D3-5 測試：驗證付款方式訊息從 config 動態生成
 *
 * 背景：
 * - src/index.js:151 與 src/states/confirming.js:61 原本 hardcode 銀行帳號 + LINE Pay ID
 * - Session D3-4 / D3-5 修整：改為讀 getPaymentConfig() + isFeatureEnabled()
 *
 * 測試情境：
 * 1. 兩個檔案都不再 hardcode 銀行帳號與 LINE Pay ID
 * 2. 兩個檔案都引用 config 介面（getPaymentConfig + isFeatureEnabled）
 * 3. 兩個檔案都檢查 5 個付款相關 flag
 * 4. config 介面回傳正確值（從 chicken.yaml 讀）
 * 5. 整合測試：handleMessage 在 CONFIRMING 收到「確認」時，回覆訊息正確
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n=== D3-4/D3-5: 付款方式動態生成測試 ===');

const SRC_INDEX = path.join(__dirname, '..', 'src', 'index.js');
const SRC_CONFIRMING = path.join(__dirname, '..', 'src', 'states', 'confirming.js');

const indexSource = fs.readFileSync(SRC_INDEX, 'utf8');
const confirmingSource = fs.readFileSync(SRC_CONFIRMING, 'utf8');

console.log('\n--- 1. src/index.js 不再 hardcode ---');
assert.ok(!/23257030422/.test(indexSource), 'src/index.js 不應再 hardcode 23257030422');
assert.ok(!/Willy0221/.test(indexSource), 'src/index.js 不應再 hardcode Willy0221');
assert.ok(/getPaymentConfig/.test(indexSource), 'src/index.js 應引用 getPaymentConfig');
assert.ok(/isFeatureEnabled/.test(indexSource), 'src/index.js 應引用 isFeatureEnabled');
console.log('  ✓ src/index.js 改用 config 動態生成');

console.log('\n--- 2. src/states/confirming.js 不再 hardcode ---');
assert.ok(!/23257030422/.test(confirmingSource), 'src/states/confirming.js 不應再 hardcode 23257030422');
assert.ok(!/Willy0221/.test(confirmingSource), 'src/states/confirming.js 不應再 hardcode Willy0221');
assert.ok(/getPaymentConfig/.test(confirmingSource), 'src/states/confirming.js 應引用 getPaymentConfig');
assert.ok(/isFeatureEnabled/.test(confirmingSource), 'src/states/confirming.js 應引用 isFeatureEnabled');
console.log('  ✓ src/states/confirming.js 改用 config 動態生成');

console.log('\n--- 3. 兩個檔案都檢查 5 個付款相關 flag ---');
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
console.log('  ✓ 兩個檔案都檢查全部 5 個付款 flag');

console.log('\n--- 4. config 介面回傳正確值 ---');
const { getPaymentConfig, isFeatureEnabled } = require('../src/config');
const paymentConfig = getPaymentConfig();

assert.strictEqual(paymentConfig.transfer.bank_code, '007', '銀行代碼應為 007');
assert.strictEqual(paymentConfig.transfer.account, '23257030422', '銀行帳號應為 23257030422');
assert.strictEqual(paymentConfig.linepay.line_id, 'Willy0221', 'LINE Pay ID 應為 Willy0221');
console.log('  ✓ 從 chicken.yaml 讀到正確值：007 / 23257030422 / Willy0221');

console.log('\n--- 5. feature flag 預設全部啟用 ---');
assert.strictEqual(isFeatureEnabled('payment.cash.enabled'), true);
assert.strictEqual(isFeatureEnabled('payment.transfer.enabled'), true);
assert.strictEqual(isFeatureEnabled('payment.jko.enabled'), true);
assert.strictEqual(isFeatureEnabled('payment.linepay.enabled'), true);
assert.strictEqual(isFeatureEnabled('official.line_pay.enabled'), true);
console.log('  ✓ 5 個付款 flag 預設啟用');

console.log('\n--- 6. 整合測試：CONFIRMING 收到「確認」時回覆訊息正確 ---');
const { handleMessage } = require('../src/index');
const { STATES, clearState, setState } = require('../src/states/stateMachine');

(async () => {
  try {
    clearState('test_d34_user');
    setState('test_d34_user', { state: STATES.CONFIRMING, orderData: {}, context: {} });
    const result = await handleMessage('test_d34_user', '確認', { lineDisplayName: 'Test' });
    const text = result.reply.text;

    assert.ok(text.includes('現金'), '應包含「現金」');
    assert.ok(text.includes('轉帳'), '應包含「轉帳」');
    assert.ok(text.includes('LINE Pay'), '應包含「LINE Pay」');
    assert.ok(text.includes('街口'), '應包含「街口」');
    assert.ok(text.includes('007'), '應包含銀行代碼 007');
    assert.ok(text.includes('23257030422'), '應包含銀行帳號 23257030422');
    assert.ok(text.includes('Willy0221'), '應包含 LINE Pay ID Willy0221');
    console.log('  ✓ 整合測試回覆訊息正確（4 種付款 + 正確銀行資訊）');

    console.log('\n=== D3-4/D3-5 測試: ALL PASSED ✓ ===');
  } catch (err) {
    console.error('Integration test failed:', err);
    process.exit(1);
  }
})();
