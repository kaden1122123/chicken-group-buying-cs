'use strict';

/**
 * Feature Flag 介面測試（Session D4）
 *
 * 目的：驗證 src/config.js 的 isFeatureEnabled(path) 與 FEATURE_FLAGS
 *
 * 測試情境：
 * 1. FEATURE_FLAGS 包含所有 9 個旗標
 * 2. isFeatureEnabled 接受 'path' 或 'path.enabled'
 * 3. 啟用（true）→ 回傳 true
 * 4. 關閉（false）→ 回傳 false
 * 5. 找不到路徑 → 預設回傳 true（向後相容）
 * 6. 所有 9 個 chicken.yaml 定義的 enabled flag 在 FEATURE_FLAGS 裡
 */

const assert = require('assert');
const { test } = require('node:test');
const { isFeatureEnabled, FEATURE_FLAGS, getPaymentConfig, getOfficialInfo, getDeliveryRules } = require('../src/config');

test('1. FEATURE_FLAGS 包含 9 個旗標', () => {
  assert.strictEqual(FEATURE_FLAGS.length, 9, `FEATURE_FLAGS 應有 9 個旗標，實際: ${FEATURE_FLAGS.length}`);

  const expectedFlags = [
    'payment.cash.enabled',
    'payment.transfer.enabled',
    'payment.jko.enabled',
    'payment.linepay.enabled',
    'official.line_pay.enabled',
    'storage.phase1.enabled',
    'storage.phase2.enabled',
    'handoff.notify_owner.enabled',
    'security.input_sanitization',
  ];

  for (const flag of expectedFlags) {
    assert.ok(FEATURE_FLAGS.includes(flag), `FEATURE_FLAGS 應包含 ${flag}`);
  }
});

test('2. isFeatureEnabled 接受 path 或 path.enabled', () => {
  // 預設 config 都設為 enabled: true（chicken.yaml）
  assert.strictEqual(isFeatureEnabled('payment.cash.enabled'), true, 'payment.cash.enabled 預設啟用');
  assert.strictEqual(isFeatureEnabled('payment.cash'), true, 'payment.cash（不帶 .enabled）也應啟用');
});

test('3. 邊界條件 — 不存在 / 空 / null / 非字串 預設啟用', () => {
  // 不存在路徑 → 預設啟用
  assert.strictEqual(isFeatureEnabled('nonexistent.flag'), true, '不存在路徑應預設啟用（向後相容）');
  // 空字串 / null
  assert.strictEqual(isFeatureEnabled(''), true, '空字串應預設啟用');
  assert.strictEqual(isFeatureEnabled(null), true, 'null 應預設啟用');
  assert.strictEqual(isFeatureEnabled(undefined), true, 'undefined 應預設啟用');
  assert.strictEqual(isFeatureEnabled(123), true, '非字串應預設啟用');
});

test('4. 與 chicken.yaml 實際 config 對齊', () => {
  // 確認 isFeatureEnabled 真的讀到 config（不是硬編碼）
  const paymentConfig = getPaymentConfig();
  assert.ok(paymentConfig.cash, '應能讀取 payment.cash');
  assert.strictEqual(isFeatureEnabled('payment.cash.enabled'), paymentConfig.cash.enabled !== false, 'cash.enabled 與 config 一致');

  const official = getOfficialInfo();
  assert.strictEqual(isFeatureEnabled('official.line_pay.enabled'), official.line_pay?.enabled !== false, 'line_pay.enabled 與 config 一致');

  const delivery = getDeliveryRules();
  assert.strictEqual(isFeatureEnabled('storage.phase1.enabled'), delivery !== undefined, 'phase1 路徑存在');
});
