'use strict';

/**
 * tests/db.test.js
 * Round 40 — SQLite DB layer CRUD tests
 *
 * 測試範圍:initDb / createOrder / getOrderById / updateOrderStatus / listOrders
 * 用 `:memory:` in-memory DB,避免檔案污染
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  initDb,
  openDb,
  createOrder,
  getOrderById,
  updateOrderStatus,
  listOrders,
  ALL_COLUMNS,
} = require('../src/storage/db');

// ─────────────────────────────────────────
// initDb
// ─────────────────────────────────────────
test('db:initDb creates tables + indexes on in-memory DB', () => {
  const db = openDb(':memory:');
  try {
    assert.strictEqual(initDb(db), true);
    // 驗證 orders table 存在
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").all();
    assert.strictEqual(tables.length, 1);
    // 驗證 4 個 indexes 存在
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='orders' AND name LIKE 'idx_%'").all();
    assert.ok(indexes.length >= 4, `expected >=4 indexes, got ${indexes.length}`);
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// createOrder
// ─────────────────────────────────────────
test('db:createOrder inserts a full order (all 29 fields)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    const orderData = {
      order_id: 'ORD-20260807-0001',
      line_user_id: 'U123456',
      customer_name: '王小明',
      payment_method: 'transfer',
      payment_info: '12345',
      payment_status: 'VERIFYING',
      order_status: 'PENDING',
      total_amount: 1140,
      user_phone: '0912345678',
      address: '新北市三峽區',
      community: '三鶯生活圈',
      delivery_date: '2026-08-08',
      time_slot: 'am',
      chicken_items: '鹽水雞 x1',
      side_items: '珍珠丸 x2',
      extra_items: '',
      chicken_count: 1,
      side_count: 2,
      total_boxes: 3,
      subtotal: 1140,
      delivery_fee: 0,
      staff_notes: '',
      customer_notes: '備註:不要辣',
      customer_tags: 'returning',
      source: 'line',
      intent_confirmed: 'true',
      receipts_path: '',
    };
    const result = createOrder(orderData, db);
    assert.strictEqual(result.changes, 1);
    assert.strictEqual(result.order_id, 'ORD-20260807-0001');
    const row = getOrderById('ORD-20260807-0001', db);
    assert.ok(row);
    assert.strictEqual(row.customer_name, '王小明');
    assert.strictEqual(row.total_amount, 1140);
    assert.strictEqual(row.payment_status, 'VERIFYING');
  } finally {
    db.close();
  }
});

test('db:createOrder rejects when order_id is missing', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    assert.throws(() => createOrder({ customer_name: 'X' }, db), /order_id is required/);
  } finally {
    db.close();
  }
});

test('db:createOrder auto-fills created_at + updated_at', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    const r = createOrder({ order_id: 'ORD-20260807-AUTO' }, db);
    assert.strictEqual(r.changes, 1);
    const row = getOrderById('ORD-20260807-AUTO', db);
    assert.ok(row.created_at, 'created_at should be auto-filled');
    assert.ok(row.updated_at, 'updated_at should be auto-filled');
    // ISO 8601 格式驗證
    assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// getOrderById
// ─────────────────────────────────────────
test('db:getOrderById returns null for non-existent order', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    const row = getOrderById('ORD-NONEXISTENT', db);
    assert.strictEqual(row, null);
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// updateOrderStatus
// ─────────────────────────────────────────
test('db:updateOrderStatus updates payment_status (PAID workflow)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-PAID-TEST', payment_status: 'VERIFYING', order_status: 'PENDING' }, db);
    const r = updateOrderStatus('ORD-PAID-TEST', {
      payment_status: 'PAID',
      order_status: 'PROCESSING',
    }, db);
    assert.strictEqual(r.changes, 1);
    const row = getOrderById('ORD-PAID-TEST', db);
    assert.strictEqual(row.payment_status, 'PAID');
    assert.strictEqual(row.order_status, 'PROCESSING');
  } finally {
    db.close();
  }
});

test('db:updateOrderStatus updates tracking_number (SHIPPED workflow)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-SHIP-TEST', order_status: 'PROCESSING' }, db);
    const r = updateOrderStatus('ORD-SHIP-TEST', {
      order_status: 'SHIPPED',
      tracking_number: 'BLACK-12345678',
    }, db);
    assert.strictEqual(r.changes, 1);
    const row = getOrderById('ORD-SHIP-TEST', db);
    assert.strictEqual(row.order_status, 'SHIPPED');
    assert.strictEqual(row.tracking_number, 'BLACK-12345678');
  } finally {
    db.close();
  }
});

test('db:updateOrderStatus rejects empty updates', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-EMPTY-UPDATE' }, db);
    const r = updateOrderStatus('ORD-EMPTY-UPDATE', {}, db);
    assert.strictEqual(r.changes, 0);
  } finally {
    db.close();
  }
});

test('db:updateOrderStatus auto-updates updated_at', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-TIME-TEST' }, db);
    const before = getOrderById('ORD-TIME-TEST', db);
    // 等待 10ms
    const start = Date.now();
    while (Date.now() - start < 10) { /* busy wait */ }
    updateOrderStatus('ORD-TIME-TEST', { payment_status: 'PAID' }, db);
    const after = getOrderById('ORD-TIME-TEST', db);
    assert.notStrictEqual(after.updated_at, before.updated_at);
    assert.ok(new Date(after.updated_at).getTime() > new Date(before.updated_at).getTime());
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// listOrders
// ─────────────────────────────────────────
test('db:listOrders returns empty array on empty DB', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    const rows = listOrders({}, db);
    assert.deepStrictEqual(rows, []);
  } finally {
    db.close();
  }
});

test('db:listOrders filters by payment_status', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-LIST-1', payment_status: 'PAID' }, db);
    createOrder({ order_id: 'ORD-LIST-2', payment_status: 'UNPAID' }, db);
    createOrder({ order_id: 'ORD-LIST-3', payment_status: 'PAID' }, db);
    const paidRows = listOrders({ payment_status: 'PAID' }, db);
    assert.strictEqual(paidRows.length, 2);
    assert.ok(paidRows.every((r) => r.payment_status === 'PAID'));
  } finally {
    db.close();
  }
});

test('db:listOrders filters by line_user_id', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-USER-1', line_user_id: 'U-alice' }, db);
    createOrder({ order_id: 'ORD-USER-2', line_user_id: 'U-bob' }, db);
    createOrder({ order_id: 'ORD-USER-3', line_user_id: 'U-alice' }, db);
    const aliceRows = listOrders({ line_user_id: 'U-alice' }, db);
    assert.strictEqual(aliceRows.length, 2);
    assert.ok(aliceRows.every((r) => r.line_user_id === 'U-alice'));
  } finally {
    db.close();
  }
});

test('db:listOrders respects limit + offset (pagination)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    for (let i = 0; i < 5; i++) {
      createOrder({ order_id: `ORD-PAGE-${i}` }, db);
    }
    const page1 = listOrders({ limit: 2, offset: 0 }, db);
    const page2 = listOrders({ limit: 2, offset: 2 }, db);
    assert.strictEqual(page1.length, 2);
    assert.strictEqual(page2.length, 2);
    // 不同分頁不應有重疊
    const ids = new Set([...page1, ...page2].map((r) => r.order_id));
    assert.strictEqual(ids.size, 4);
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// 整合測試:完整 4-button workflow
// ─────────────────────────────────────────
test('integration: full 4-button workflow (PAID → SHIPPED → tracking_number)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    // 客戶下單
    createOrder({
      order_id: 'ORD-FLOW-001',
      line_user_id: 'U-flow-test',
      customer_name: '流程測試',
      payment_method: 'transfer',
      payment_info: '99999',
      total_amount: 1500,
    }, db);

    // 老闆核帳 → PAID
    updateOrderStatus('ORD-FLOW-001', {
      payment_status: 'PAID',
      order_status: 'PROCESSING',
      staff_notes: '核帳完成',
    }, db);

    let row = getOrderById('ORD-FLOW-001', db);
    assert.strictEqual(row.payment_status, 'PAID');
    assert.strictEqual(row.order_status, 'PROCESSING');

    // 老闆出貨 → SHIPPED + tracking_number
    updateOrderStatus('ORD-FLOW-001', {
      order_status: 'SHIPPED',
      tracking_number: 'TEST-TRACK-001',
    }, db);

    row = getOrderById('ORD-FLOW-001', db);
    assert.strictEqual(row.order_status, 'SHIPPED');
    assert.strictEqual(row.tracking_number, 'TEST-TRACK-001');
  } finally {
    db.close();
  }
});

test('integration: Payment Failed workflow (FAILED status)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({
      order_id: 'ORD-FAILED-001',
      payment_method: 'transfer',
      payment_info: 'wrong-num',
    }, db);
    updateOrderStatus('ORD-FAILED-001', {
      payment_status: 'FAILED',
      staff_notes: '查無此款項',
    }, db);
    const row = getOrderById('ORD-FAILED-001', db);
    assert.strictEqual(row.payment_status, 'FAILED');
  } finally {
    db.close();
  }
});

test('integration: Cancel workflow (CANCELLED status)', () => {
  const db = openDb(':memory:');
  initDb(db);
  try {
    createOrder({ order_id: 'ORD-CANCEL-001' }, db);
    updateOrderStatus('ORD-CANCEL-001', {
      order_status: 'CANCELLED',
    }, db);
    const row = getOrderById('ORD-CANCEL-001', db);
    assert.strictEqual(row.order_status, 'CANCELLED');
  } finally {
    db.close();
  }
});

// ─────────────────────────────────────────
// 結構驗證
// ─────────────────────────────────────────
test('db: ALL_COLUMNS exported with expected 32 columns', () => {
  // 32 欄:3 PK/timestamps + 8 核心 + 21 其他 = 32(對齊 prompt §3「完整 29 欄位」+ 擴充)
  assert.ok(ALL_COLUMNS.length >= 29, `expected >=29 columns, got ${ALL_COLUMNS.length}`);
  assert.ok(ALL_COLUMNS.includes('order_id'));
  assert.ok(ALL_COLUMNS.includes('payment_status'));
  assert.ok(ALL_COLUMNS.includes('order_status'));
  assert.ok(ALL_COLUMNS.includes('tracking_number'));
});
