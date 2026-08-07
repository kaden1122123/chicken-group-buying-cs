'use strict';

/**
 * tests/tools-orderStatus.test.js
 * Round 40 (Hubert 14:40) Step 5 — OpenClaw Tool get_order_status tests
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  initDb,
  openDb,
  createOrder,
} = require('../src/storage/db');
const { get_order_status } = require('../src/tools/orderStatus');

test('orderStatus: rejects missing line_user_id', () => {
  const result = get_order_status();
  assert.strictEqual(result.found, false);
  assert.ok(result.error);
});

test('orderStatus: rejects non-string line_user_id', () => {
  const result = get_order_status(12345);
  assert.strictEqual(result.found, false);
  assert.ok(result.error);
});

test('orderStatus: returns not-found for empty DB', () => {
  const testDb = openDb(':memory:');
  initDb(testDb);
  try {
    createOrder({
      order_id: 'ORD-TEMP-001',
      line_user_id: 'U-other-user',
    }, testDb);

    const result = get_order_status('U-nonexistent-user', { db: testDb });
    assert.strictEqual(result.found, false);
    assert.match(result.message, /查無此用戶/);
  } finally {
    testDb.close();
  }
});

test('orderStatus: returns orders for existing line_user_id', () => {
  const testDb = openDb(':memory:');
  initDb(testDb);
  try {
    // 建立測試訂單
    createOrder({
      order_id: 'ORD-TOOL-001',
      line_user_id: 'U-alice',
      customer_name: 'Alice',
      payment_method: 'transfer',
      payment_status: 'PAID',
      order_status: 'PROCESSING',
      total_amount: 1140,
      delivery_date: '2026-08-08',
    }, testDb);
    createOrder({
      order_id: 'ORD-TOOL-002',
      line_user_id: 'U-alice',
      customer_name: 'Alice',
      payment_method: 'cash',
      payment_status: 'PAID',
      order_status: 'SHIPPED',
      tracking_number: 'BLACK-999',
      total_amount: 760,
      delivery_date: '2026-08-09',
    }, testDb);
    createOrder({
      order_id: 'ORD-TOOL-003',
      line_user_id: 'U-bob',
      customer_name: 'Bob',
    }, testDb);

    const result = get_order_status('U-alice', { db: testDb });
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.line_user_id, 'U-alice');
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.orders.length, 2);
    for (const o of result.orders) {
      assert.ok(o.order_id);
      assert.ok(o.payment_status);
      assert.ok(o.order_status);
      assert.ok(o.created_at);
    }
  } finally {
    testDb.close();
  }
});

test('orderStatus: respects limit parameter', () => {
  const testDb = openDb(':memory:');
  initDb(testDb);
  try {
    for (let i = 1; i <= 5; i++) {
      createOrder({
        order_id: `ORD-LIMIT-${i}`,
        line_user_id: 'U-multi',
        total_amount: 100 * i,
      }, testDb);
    }
    const result = get_order_status('U-multi', { limit: 3, db: testDb });
    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.orders.length, 3);
  } finally {
    testDb.close();
  }
});

test('orderStatus: SHIPPED order includes tracking_number', () => {
  const testDb = openDb(':memory:');
  initDb(testDb);
  try {
    createOrder({
      order_id: 'ORD-TRACK-001',
      line_user_id: 'U-tracker',
      order_status: 'SHIPPED',
      tracking_number: 'TEST-TRACK-XYZ',
    }, testDb);
    const result = get_order_status('U-tracker', { db: testDb });
    assert.strictEqual(result.found, true);
    const order = result.orders[0];
    assert.strictEqual(order.tracking_number, 'TEST-TRACK-XYZ');
  } finally {
    testDb.close();
  }
});
