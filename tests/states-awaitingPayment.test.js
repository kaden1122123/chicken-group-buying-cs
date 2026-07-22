'use strict';

/**
 * AWAITING_PAYMENT State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/awaitingPayment.js 的 3 個 exports
 */

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

const {
  isPaymentConfirmed,
  isPaymentCancel,
  handleAwaitingPayment,
} = require('../src/states/awaitingPayment');
const { STATES } = require('../src/states/stateMachine');

const TEST_DATE = '2099-12-31';
const TEST_CSV_PATH = path.join(__dirname, '..', 'data', 'orders', 'chicken', `${TEST_DATE}.csv`);

test('isPaymentConfirmed — 7+ 種付款確認關鍵詞', () => {
  ['已轉帳', '已付款', '轉了', '付了', '轉帳完成', '付款完成', 'ok', '好'].forEach((msg) => {
    assert.strictEqual(isPaymentConfirmed(msg), true, `「${msg}」應 true`);
  });
});

test('isPaymentConfirmed — 非付款確認', () => {
  ['多少錢', '請問取消流程', '', null, undefined].forEach((msg) => {
    assert.strictEqual(isPaymentConfirmed(msg), false, `「${msg}」應 false`);
  });
});

test('isPaymentCancel — 3 種取消關鍵詞', () => {
  ['取消訂單', '不要了', '算了'].forEach((msg) => {
    assert.strictEqual(isPaymentCancel(msg), true, `「${msg}」應 true`);
  });
});

test('isPaymentCancel — 非取消', () => {
  ['已付款', '多少錢', '', null, undefined].forEach((msg) => {
    assert.strictEqual(isPaymentCancel(msg), false, `「${msg}」應 false`);
  });
});

test('handleAwaitingPayment — cancel 路徑 → IDLE', () => {
  const cancelResult = handleAwaitingPayment('user_1', '算了', { payment_method: 'cash' }, {});
  assert.strictEqual(cancelResult.newState, STATES.IDLE, `got ${cancelResult.newState}`);
  assert.ok(!cancelResult.orderData || Object.keys(cancelResult.orderData).length === 0, 'orderData 應清空');

  const cancelResult2 = handleAwaitingPayment('user_2', '不要了', { payment_method: 'transfer' }, {});
  assert.strictEqual(cancelResult2.newState, STATES.IDLE, `got ${cancelResult2.newState}`);
});

test('handleAwaitingPayment — payment_received（cash）→ COMPLETED + payment_status=confirmed', () => {
  const baseOrder = {
    user_line_name: 'H8測試用戶',
    user_phone: '0912345678',
    address: '台北市測試區測試路1號',
    delivery_date: TEST_DATE,
    time_slot: '上午',
    chicken_items: { 鹽水雞: 1 },
    chicken_count: 1,
    side_count: 0,
    total_boxes: 1,
    subtotal: 380,
    delivery_fee: 0,
    total_amount: 380,
  };
  const cashResult = handleAwaitingPayment('user_3', '已付款', { ...baseOrder, payment_method: 'cash' }, {});
  assert.strictEqual(cashResult.action, 'payment_received', `got ${cashResult.action}`);
  assert.strictEqual(cashResult.newState, STATES.COMPLETED, `got ${cashResult.newState}`);
  assert.strictEqual(cashResult.orderData.payment_status, 'confirmed', `got ${cashResult.orderData.payment_status}`);
  assert.ok(cashResult.orderData.order_id, 'order_id 應已產生');
  assert.ok(/^ORD-\d{8}-\d{3}$/.test(cashResult.orderData.order_id), `order_id 格式應為 ORD-YYYYMMDD-XXX, got ${cashResult.orderData.order_id}`);
  assert.ok(cashResult.orderData.created_at, 'created_at 應已設定');
  assert.strictEqual(cashResult.orderData.order_status, 'new', `got ${cashResult.orderData.order_status}`);
  assert.strictEqual(cashResult.orderData.source, 'line', `got ${cashResult.orderData.source}`);
  assert.strictEqual(cashResult.orderData.intent_confirmed, true, `got ${cashResult.orderData.intent_confirmed}`);

  // 驗證 CSV 檔案存在
  assert.ok(fs.existsSync(TEST_CSV_PATH), `csv path: ${TEST_CSV_PATH}`);
  if (fs.existsSync(TEST_CSV_PATH)) {
    const csvContent = fs.readFileSync(TEST_CSV_PATH, 'utf8');
    assert.ok(csvContent.includes(cashResult.orderData.order_id), 'CSV 應包含新建的 order_id');
    assert.ok(csvContent.includes('confirmed'), 'CSV 應包含 payment_status=confirmed');
  }
});

test('handleAwaitingPayment — payment_received（transfer）→ payment_status=pending', () => {
  const baseOrder = {
    user_line_name: 'H8測試用戶',
    user_phone: '0912345678',
    address: '台北市測試區測試路1號',
    delivery_date: TEST_DATE,
    time_slot: '上午',
    chicken_items: { 鹽水雞: 1 },
    chicken_count: 1,
    side_count: 0,
    total_boxes: 1,
    subtotal: 380,
    delivery_fee: 0,
    total_amount: 380,
  };
  const transferResult = handleAwaitingPayment('user_4', '已轉帳', { ...baseOrder, payment_method: 'transfer' }, {});
  assert.strictEqual(transferResult.orderData.payment_status, 'pending', `got ${transferResult.orderData.payment_status}`);
});

test('handleAwaitingPayment — payment_received（jko）→ payment_status=pending', () => {
  const baseOrder = {
    user_line_name: 'H8測試用戶',
    user_phone: '0912345678',
    address: '台北市測試區測試路1號',
    delivery_date: TEST_DATE,
    time_slot: '上午',
    chicken_items: { 鹽水雞: 1 },
    chicken_count: 1,
    side_count: 0,
    total_boxes: 1,
    subtotal: 380,
    delivery_fee: 0,
    total_amount: 380,
  };
  const jkoResult = handleAwaitingPayment('user_5', '已付款', { ...baseOrder, payment_method: 'jko' }, {});
  assert.strictEqual(jkoResult.orderData.payment_status, 'pending', `got ${jkoResult.orderData.payment_status}`);
});

test('handleAwaitingPayment — paymentProofReceived context 旗標觸發', () => {
  const baseOrder = {
    user_line_name: 'H8測試用戶',
    user_phone: '0912345678',
    address: '台北市測試區測試路1號',
    delivery_date: TEST_DATE,
    time_slot: '上午',
    chicken_items: { 鹽水雞: 1 },
    chicken_count: 1,
    side_count: 0,
    total_boxes: 1,
    subtotal: 380,
    delivery_fee: 0,
    total_amount: 380,
  };
  const proofResult = handleAwaitingPayment('user_6', '訊息但無付款詞', { ...baseOrder }, { paymentProofReceived: true });
  assert.strictEqual(proofResult.action, 'payment_received', `got ${proofResult.action}`);
});

test('handleAwaitingPayment — 各付款方式 instructions（cash / transfer / jko / linepay）', () => {
  // cash
  const cashInst = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: 'cash' }, {}).reply.text;
  assert.ok(/現金.*付款.*外送/.test(cashInst), `cash 應含「現金付款給外送人員」, got: ${cashInst.slice(0, 60)}`);
  assert.strictEqual(handleAwaitingPayment('user_inst', '問個問題', { payment_method: 'cash' }, {}).newState, STATES.AWAITING_PAYMENT);

  // transfer
  const transferInst = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: 'transfer' }, {}).reply.text;
  assert.ok(/銀行代碼/.test(transferInst), `transfer 應含「銀行代碼」, got: ${transferInst.slice(0, 60)}`);
  assert.ok(/帳號/.test(transferInst), `transfer 應含「帳號」, got: ${transferInst.slice(0, 60)}`);

  // jko
  const jkoInst = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: 'jko' }, {}).reply.text;
  assert.ok(/街口支付/.test(jkoInst), `jko 應含「街口支付」, got: ${jkoInst.slice(0, 60)}`);

  // linepay
  try {
    const linepayInst = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: 'linepay' }, {}).reply.text;
    assert.ok(/LINE/.test(linepayInst), `linepay 應含 LINE, got: ${linepayInst.slice(0, 60)}`);
  } catch (e) {
    assert.fail(`linepay 測試失敗: ${e.message}`);
  }

  // default (unknown)
  const defaultInst = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: 'unknown_method_xyz' }, {}).reply.text;
  assert.ok(/付款方式/.test(defaultInst), `default 應含「付款方式」, got: ${defaultInst.slice(0, 60)}`);
  assert.strictEqual(handleAwaitingPayment('user_inst', '問個問題', { payment_method: 'unknown' }, {}).newState, STATES.AWAITING_PAYMENT);
});

// teardown — cleanup 測試 CSV
test('teardown — cleanup 測試 CSV', () => {
  try {
    if (fs.existsSync(TEST_CSV_PATH)) {
      fs.unlinkSync(TEST_CSV_PATH);
    }
  } catch (e) {
    // 容忍清理失敗
  }
});
