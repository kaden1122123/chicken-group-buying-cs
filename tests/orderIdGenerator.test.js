'use strict';

/**
 * orderIdGenerator 測試（Session H H3）
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const orderIdGenerator = require('../src/order/orderIdGenerator');

const TEST_DATE = '2099-12-31';
const TEST_FILENAME = `${TEST_DATE}.csv`;
const DATA_DIR = path.join(__dirname, '../data/orders/chicken');
const TEST_CSV_PATH = path.join(DATA_DIR, TEST_FILENAME);

function cleanupTestFile() {
  if (fs.existsSync(TEST_CSV_PATH)) {
    fs.unlinkSync(TEST_CSV_PATH);
  }
}

test('getMaxSequence — 檔案不存在回傳 0', () => {
  cleanupTestFile();
  assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '檔案不存在應回傳 0');
});

test('getMaxSequence — 從 CSV 解析最大序號', () => {
  fs.writeFileSync(
    TEST_CSV_PATH,
    'order_id,created_at\nORD-20991231-001,2099-12-31T10:00:00+08:00\nORD-20991231-002,2099-12-31T11:00:00+08:00\nORD-20991231-005,2099-12-31T12:00:00+08:00\n',
    'utf8',
  );
  assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 5, '最大序號應為 5');

  fs.writeFileSync(TEST_CSV_PATH, 'order_id,created_at\n', 'utf8');
  assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '只有 header 的空檔案回傳 0');

  fs.writeFileSync(TEST_CSV_PATH, 'order_id,note\nPENDING-123,pending\nOTHER-1,other\n', 'utf8');
  assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '無 ORD- 開頭的內容回傳 0');

  cleanupTestFile();
});

test('generateOrderId — 格式驗證', () => {
  const id1 = orderIdGenerator.generateOrderId();
  assert.match(id1, /^ORD-\d{8}-\d{3}$/, `應符合 ORD-YYYYMMDD-XXX 格式, 實際: ${id1}`);

  const id2 = orderIdGenerator.generateOrderId();
  assert.strictEqual(id2, id1, '同一 process 內不寫檔則序號不變');

  // 當天已有 003 → 產生 004
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const todayFilename = `${todayStr}.csv`;
  const todayCsvPath = path.join(DATA_DIR, todayFilename);

  let createdTodayFile = false;
  let originalContent = null;
  if (!fs.existsSync(todayCsvPath)) {
    fs.writeFileSync(
      todayCsvPath,
      `order_id,created_at\nORD-${yyyy}${mm}${dd}-003,${todayStr}T10:00:00+08:00\n`,
      'utf8',
    );
    createdTodayFile = true;
  } else {
    originalContent = fs.readFileSync(todayCsvPath, 'utf8');
    const lines = originalContent.trim().split('\n');
    const header = lines[0];
    fs.writeFileSync(todayCsvPath, `${header}\nORD-${yyyy}${mm}${dd}-003,${todayStr}T10:00:00+08:00\n`, 'utf8');
  }

  const id3 = orderIdGenerator.generateOrderId();
  assert.match(id3, /^ORD-\d{8}-004$/, `當天已有 003 時應產生 004, 實際: ${id3}`);

  if (createdTodayFile) {
    fs.unlinkSync(todayCsvPath);
  } else if (originalContent !== null) {
    fs.writeFileSync(todayCsvPath, originalContent, 'utf8');
  }
});

test('generatePendingOrderId — PENDING-{timestamp} 格式', () => {
  const pid1 = orderIdGenerator.generatePendingOrderId();
  assert.match(pid1, /^PENDING-\d+$/, `應符合 PENDING-{timestamp} 格式, 實際: ${pid1}`);

  const ts = parseInt(pid1.split('-')[1]);
  assert.ok(ts > 1.7e12, `timestamp 應為毫秒級（>1.7e12）, 實際: ${ts}`);

  const pid2 = orderIdGenerator.generatePendingOrderId();
  assert.match(pid2, /^PENDING-\d+$/, '連續呼叫的 ID 仍應符合 PENDING- 格式');

  cleanupTestFile();
});
