'use strict';

/**
 * CSV Writer Concurrency Tests — Session D D2
 */

const assert = require('assert');
const { test, after } = require('node:test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const CSV_WRITER_PATH = path.join(__dirname, '..', 'src', 'order', 'csvWriter.js');
const TEST_TENANT = '_csv_concurrency_test';
const TEST_DELIVERY_DATE = '2099-12-31';
const ORDERS_ROOT = path.join(__dirname, '..', 'data', 'orders');
const KB_ROOT = path.join(__dirname, '..', 'knowledge', 'tenants');
const TEST_DIR = path.join(ORDERS_ROOT, TEST_TENANT);
const TEST_KB_DIR = path.join(KB_ROOT, TEST_TENANT);
const TEST_CSV = path.join(TEST_DIR, `${TEST_DELIVERY_DATE}.csv`);
const LOCK_DIR_SIBLING = path.join(ORDERS_ROOT, TEST_TENANT + '.lock');

function cleanupAll() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  if (fs.existsSync(TEST_KB_DIR)) fs.rmSync(TEST_KB_DIR, { recursive: true, force: true });
  if (fs.existsSync(LOCK_DIR_SIBLING)) fs.rmSync(LOCK_DIR_SIBLING, { recursive: true, force: true });
  const workerScript = path.join(__dirname, 'fixtures', 'csv-writer-concurrency-worker.js');
  if (fs.existsSync(workerScript)) fs.unlinkSync(workerScript);
}

test('1. csvWriter 原始碼包含 lockSync / unlockSync / try-finally', () => {
  const csvWriterSource = fs.readFileSync(CSV_WRITER_PATH, 'utf8');
  assert.ok(csvWriterSource.includes('lockfile.lockSync') || csvWriterSource.includes('acquireLockSync'),
    '應使用 proper-lockfile 鎖定');
  assert.ok(csvWriterSource.includes('lockfile.unlockSync') || csvWriterSource.includes('unlockSync'),
    '應在 finally 區塊 unlock');
  assert.ok(csvWriterSource.includes('try {') && csvWriterSource.includes('finally'),
    '應用 try/finally 確保 lock release');
});

test('2. 跨 process 併發寫入 — 3 process 各寫 20 筆, 共 61 行', () => {
  cleanupAll();

  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_KB_DIR, { recursive: true });

  const workerScript = path.join(__dirname, 'fixtures', 'csv-writer-concurrency-worker.js');
  fs.writeFileSync(workerScript, `
'use strict';
const csvWriter = require('${CSV_WRITER_PATH}');
const ordersPerProcess = parseInt(process.env.ORDERS_PER_PROCESS || '20', 10);
const tenantId = process.env.TENANT_ID;
const deliveryDate = process.env.DELIVERY_DATE;
const processId = process.env.PROCESS_ID;
for (let i = 0; i < ordersPerProcess; i++) {
  csvWriter.writeOrder({
    order_id: 'P' + processId + '-' + String(i).padStart(3, '0'),
    created_at: new Date().toISOString(),
    user_line_name: 'Process' + processId + ' Order' + i,
    delivery_date: deliveryDate,
    chicken_items: { '鹽水雞': 1 },
    side_items: {},
    extra_items: {},
    chicken_count: 1, side_count: 0, total_boxes: 1,
    subtotal: 250, delivery_fee: 100, total_amount: 350,
    payment_method: 'cash', payment_status: 'pending', order_status: 'new',
    source: 'test', intent_confirmed: true,
  });
}
console.log('  [worker pid=' + process.pid + '] wrote ' + ordersPerProcess + ' orders');
`, 'utf8');

  const PROCESS_COUNT = 3;
  const ORDERS_PER_PROCESS = 20;

  for (let p = 1; p <= PROCESS_COUNT; p++) {
    const result = spawnSync('node', [workerScript], {
      env: Object.assign({}, process.env, {
        TENANT_ID: TEST_TENANT,
        DELIVERY_DATE: TEST_DELIVERY_DATE,
        ORDERS_PER_PROCESS: String(ORDERS_PER_PROCESS),
        PROCESS_ID: String(p),
      }),
      encoding: 'utf-8',
      timeout: 30000,
    });
    assert.strictEqual(result.status, 0, `Worker ${p} 應成功: stderr=${result.stderr.slice(0, 200)}`);
    assert.ok(result.stdout.includes(`wrote ${ORDERS_PER_PROCESS} orders`), `Worker ${p} 應寫 ${ORDERS_PER_PROCESS} 筆`);
  }

  assert.ok(fs.existsSync(TEST_CSV), 'CSV 應存在');
  const csvContent = fs.readFileSync(TEST_CSV, 'utf8');
  const csvLines = csvContent.trim().split('\n');
  const expectedLines = 1 + (PROCESS_COUNT * ORDERS_PER_PROCESS); // header + data

  assert.strictEqual(csvLines.length, expectedLines, `應 ${expectedLines} 行 (header + ${PROCESS_COUNT * ORDERS_PER_PROCESS} 筆)`);

  // 驗證 header 是 35 欄
  const headerColCount = csvLines[0].split(',').length;
  assert.strictEqual(headerColCount, 35, `Header 應有 35 欄, got ${headerColCount}`);

  // 驗證每筆資料行都是 35 欄
  const dataLines = csvLines.slice(1);
  let allRowsValid = true;
  dataLines.forEach((line, idx) => {
    const cols = line.split(',');
    if (cols.length !== 35) {
      console.error(`第 ${idx + 2} 行欄數錯誤: ${cols.length}`);
      allRowsValid = false;
    }
  });
  assert.ok(allRowsValid, '所有資料行應為 35 欄');

  // 驗證 order_id 唯一
  const orderIdCounts = {};
  dataLines.forEach((line) => {
    const orderId = line.split(',')[0];
    if (orderId) orderIdCounts[orderId] = (orderIdCounts[orderId] || 0) + 1;
  });

  for (let p = 1; p <= PROCESS_COUNT; p++) {
    for (let i = 0; i < ORDERS_PER_PROCESS; i++) {
      const expectedOid = `P${p}-${String(i).padStart(3, '0')}`;
      assert.strictEqual(orderIdCounts[expectedOid], 1, `order_id ${expectedOid} 應出現 1 次`);
    }
  }
});

after(() => {
  cleanupAll();
});
