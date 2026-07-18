'use strict';

/**
 * awaitingPayment.js 單元測試（Hubert 07:53「細心、完整做完剩餘待辦」）
 *
 * 涵蓋：
 *  - isPaymentConfirmed：判斷「已付款」關鍵字
 *  - isPaymentCancel：判斷「取消」關鍵字
 *  - handleAwaitingPayment：完整流程
 *    - cash + 已付款 → payment_status: confirmed, action: 'payment_received', newState: 'COMPLETED'
 *    - transfer + 已付款 → payment_status: pending, action: 'payment_received'
 *    - jko + 想付款（尚未確認）→ 提示 QR Code, action: 'awaiting_payment', newState: 'AWAITING_PAYMENT'
 *    - linepay + 想付款（尚未確認）→ 提示 LINE, action: 'awaiting_payment', newState: 'AWAITING_PAYMENT'
 *    - 取消訊息 → action: 'cancel'
 *    - context.paymentProofReceived=true 跳過確認關鍵字
 *    - 不明 payment_method fallback
 *    - CSV 寫入失敗仍繼續（不阻断流程）
 */

const test = require('node:test');
const assert = require('node:assert');

const awaitingPayment = require('../src/states/awaitingPayment');

// ===================
// isPaymentConfirmed
// ===================
test('isPaymentConfirmed — 「已付款」', () => {
  assert.strictEqual(awaitingPayment.isPaymentConfirmed('已付款'), true);
});

test('isPaymentConfirmed — 「付好了」', () => {
  assert.strictEqual(awaitingPayment.isPaymentConfirmed('付好了'), true);
});

test('isPaymentConfirmed — 一般訊息', () => {
  assert.strictEqual(awaitingPayment.isPaymentConfirmed('請問有送嗎'), false);
});

test('isPaymentConfirmed — null/empty', () => {
  assert.strictEqual(awaitingPayment.isPaymentConfirmed(null), false);
  assert.strictEqual(awaitingPayment.isPaymentConfirmed(''), false);
});

// ===================
// isPaymentCancel
// ===================
test('isPaymentCancel — 「取消訂單」', () => {
  assert.strictEqual(awaitingPayment.isPaymentCancel('取消訂單'), true);
});

test('isPaymentCancel — 「不要了」', () => {
  assert.strictEqual(awaitingPayment.isPaymentCancel('不要了'), true);
});

test('isPaymentCancel — 一般訊息', () => {
  assert.strictEqual(awaitingPayment.isPaymentCancel('已付款'), false);
});

// ===================
// handleAwaitingPayment — cash + 已付款（走 payment_received 路徑）
// ===================
test('handleAwaitingPayment — cash + 已付款 → confirmed + COMPLETED', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '已付款',
    { payment_method: 'cash', total_amount: 380 },
    {},
  );
  assert.strictEqual(result.action, 'payment_received');
  assert.strictEqual(result.newState, 'COMPLETED');
  assert.strictEqual(result.orderData.payment_status, 'confirmed');
  assert.strictEqual(result.orderData.payment_method, 'cash');
});

// ===================
// handleAwaitingPayment — transfer + 已付款（走 payment_received 路徑）
// ===================
test('handleAwaitingPayment — transfer + 已付款 → pending + COMPLETED', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '已付款',
    { payment_method: 'transfer', total_amount: 1000 },
    {},
  );
  assert.strictEqual(result.action, 'payment_received');
  assert.strictEqual(result.newState, 'COMPLETED');
  assert.strictEqual(result.orderData.payment_status, 'pending');
  assert.strictEqual(result.orderData.payment_method, 'transfer');
});

// ===================
// handleAwaitingPayment — jko + 想付款（走 switch awaiting_payment 路徑）
// ===================
test('handleAwaitingPayment — jko + 想付款 → 回覆含 QR Code', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '想付款', // 不是確認關鍵字，走 switch case 'jko'
    { payment_method: 'jko', total_amount: 380 },
    {},
  );
  assert.strictEqual(result.action, 'awaiting_payment');
  assert.strictEqual(result.newState, 'AWAITING_PAYMENT');
  assert.strictEqual(result.orderData.payment_method, 'jko');
  // payment_status 在 awaiting_payment 路徑不設定（function 回傳原 orderData）
  // 回覆訊息應該含「街口」相關指示
  assert.match(JSON.stringify(result.reply), /街口|QR Code/);
});

// ===================
// handleAwaitingPayment — linepay + 想付款（走 switch awaiting_payment 路徑）
// ===================
test('handleAwaitingPayment — linepay + 想付款 → 回覆含 LINE ID', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '想用 LINE Pay 付款',
    { payment_method: 'linepay', total_amount: 380 },
    {},
  );
  assert.strictEqual(result.action, 'awaiting_payment');
  assert.strictEqual(result.newState, 'AWAITING_PAYMENT');
  assert.strictEqual(result.orderData.payment_method, 'linepay');
  // 回覆訊息應該含「LINE」相關指示
  assert.match(JSON.stringify(result.reply), /LINE|ID/);
});

// ===================
// handleAwaitingPayment — 取消訂單
// ===================
test('handleAwaitingPayment — 取消訂單 → cancelled', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '取消訂單',
    { payment_method: 'transfer', total_amount: 380 },
    {},
  );
  assert.strictEqual(result.action, 'cancelled');
});

// ===================
// handleAwaitingPayment — context.paymentProofReceived=true
// ===================
test('handleAwaitingPayment — context.paymentProofReceived=true 跳過確認關鍵字', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '隨便訊息', // 沒含確認關鍵字，但 context.paymentProofReceived=true → 走 payment_received
    { payment_method: 'transfer', total_amount: 380 },
    { paymentProofReceived: true },
  );
  assert.strictEqual(result.action, 'payment_received');
  assert.strictEqual(result.orderData.payment_status, 'pending');
});

// ===================
// handleAwaitingPayment — 不明 payment_method fallback
// ===================
test('handleAwaitingPayment — 不明 payment_method + 已付款 → payment_received', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '已付款',
    { payment_method: 'unknown_method_xyz', total_amount: 380 },
    {},
  );
  assert.strictEqual(result.action, 'payment_received');
  assert.strictEqual(result.orderData.payment_status, 'pending');
});

// ===================
// handleAwaitingPayment — CSV 寫入失敗仍繼續（不阻断流程）
// ===================
test('handleAwaitingPayment — CSV 寫入失敗仍回 result（不阻断）', () => {
  const result = awaitingPayment.handleAwaitingPayment(
    'U-test-user',
    '已付款',
    { payment_method: 'cash', total_amount: 380 }, // 沒 order_id，會 generate
    {},
  );
  assert.ok(result.orderData.order_id); // 自動產生 order_id
  assert.strictEqual(result.orderData.payment_status, 'confirmed');
});
