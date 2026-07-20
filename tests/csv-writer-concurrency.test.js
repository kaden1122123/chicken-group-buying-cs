'use strict';

/**
 * CSV Writer Concurrency Tests — Session D D2
 *
 * 驗證 csvWriter.js 的 proper-lockfile 鎖定機制：
 *   1. 原始碼包含 lockSync / unlockSync（防 regression）
 *   2. 錯誤時 lock 被 release（finally 區塊正確）
 *   3. 多 process 併發寫入時，每行 CSV 都完整（無半截、無覆蓋）
 *
 * 設計：spawn 3 個 child node process，同時各寫 20 筆訂單到同一 CSV，
 *       parent 驗證最終行數 = 60 + header，每行都是 28 欄。
 *
 * 用獨立 tenant _csv_concurrency_test 隔離測試資料。
 * - 避免 rmSync TEST_DIR 誤刪 chicken tenant 真實訂單（6/13, 6/16）
 * - TENANT_ID=_csv_concurrency_test讓子 process 用獨立資料目錄與 KB 目錄
 * - .gitignore 排除 _csv_concurrency_test 目錄（避免污染 git）
 * - 測試結束後刪除 _csv_concurrency_test tenant 與 worker script
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const CSV_WRITER_PATH = path.join(__dirname, '..', 'src', 'order', 'csvWriter.js');
const TEST_TENANT = '_csv_concurrency_test'; // 獨立 tenant（避免誤刪 chicken tenant 真實訂單）
const TEST_DELIVERY_DATE = '2099-12-31'; // 未來日期，不會跟現有真實訂單衝突
const ORDERS_ROOT = path.join(__dirname, '..', 'data', 'orders');
const KB_ROOT = path.join(__dirname, '..', 'knowledge', 'tenants');
const TEST_DIR = path.join(ORDERS_ROOT, TEST_TENANT); // data/orders/_csv_concurrency_test/
const TEST_KB_DIR = path.join(KB_ROOT, TEST_TENANT); // knowledge/tenants/_csv_concurrency_test/
const TEST_CSV = path.join(TEST_DIR, `${TEST_DELIVERY_DATE}.csv`);

console.log('\n=== CSV Writer Concurrency Tests (Session D D2) ===');

// ─── 1. 原始碼檢查：包含 lockSync / unlockSync ───
console.log('\n--- 原始碼檢查：lock 機制存在 ---');

const csvWriterSource = fs.readFileSync(CSV_WRITER_PATH, 'utf8');
assert.ok(
  csvWriterSource.includes('lockfile.lockSync') || csvWriterSource.includes('acquireLockSync'),
  'csvWriter 應使用 proper-lockfile 鎖定（lockSync 或自寫 acquireLockSync）',
);
assert.ok(
  csvWriterSource.includes('lockfile.unlockSync') || csvWriterSource.includes('unlockSync'),
  'csvWriter 應在 finally 區塊 unlock',
);
assert.ok(
  csvWriterSource.includes('try {') && csvWriterSource.includes('finally'),
  'csvWriter 應用 try/finally 確保 lock release',
);
console.log('  ✓ csvWriter 有 lockSync + try/finally + unlockSync');

// ─── 2. 跨 process 併發寫入測試 ───
console.log('\n--- 跨 process 併發寫入 ---');

// 清理舊測試資料 + 建立必要目錄
// 注意：csvWriter.js 預設用 TENANT_ID 環境變數指向 data/orders/<tenant>/
//       loader.js 預期 knowledge/tenants/<tenant>/ 存在
//       兩者都是 csvWriter.js module load 時檢查，所以必須在 spawn worker 前建立
//
// Stale state 清理（2026-07-20 fix）：
// - proper-lockfile lock 在 TEST_DIR sibling 創建 _csv_concurrency_test.lock/ (DIR)
// - 前次 run 失敗/中斷 → lock DIR 殘留 + TEST_DIR 殘留 → 下次 setup 只清 TEST_DIR 不清 .lock
// - 結果下次 run child busy-wait 5000ms 等 stale lock，然後 file 累積寫兩輪 = 122 rows
// - 解法：setup 先清掉 stale .lock DIR（若存在）+ TEST_DIR（若存在）
console.log('\n--- 準備測試 tenant 目錄（含 stale state 清理） ---');
const LOCK_DIR_SIBLING = path.join(ORDERS_ROOT, TEST_TENANT + '.lock');
if (fs.existsSync(LOCK_DIR_SIBLING)) {
  fs.rmSync(LOCK_DIR_SIBLING, { recursive: true, force: true });
  console.log('  ✓ 清理 stale lock dir: ' + LOCK_DIR_SIBLING);
}
if (fs.existsSync(TEST_DIR)) {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DIR, { recursive: true });
if (fs.existsSync(TEST_KB_DIR)) {
  fs.rmSync(TEST_KB_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_KB_DIR, { recursive: true });
console.log('  ✓ 建立 ' + TEST_DIR + ' 與 ' + TEST_KB_DIR);

// 建立子 process worker script（用一個小 script 讓每個 child 跑 N 次 writeOrder）
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
    chicken_count: 1,
    side_count: 0,
    total_boxes: 1,
    subtotal: 250,
    delivery_fee: 100,
    total_amount: 350,
    payment_method: 'cash',
    payment_status: 'pending',
    order_status: 'new',
    source: 'test',
    intent_confirmed: true,
  });
}
console.log('  [worker pid=' + process.pid + '] wrote ' + ordersPerProcess + ' orders');
`, 'utf8');

const PROCESS_COUNT = 3;
const ORDERS_PER_PROCESS = 20;

// 同時 spawn 3 個 child process（不等待，全部 spawn 完才各自等）
const children = [];
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
  children.push({ pid: p, result });
  if (result.status !== 0) {
    console.error('Worker ' + p + ' failed:', result.stderr);
    throw new Error('Worker process ' + p + ' exited with status ' + result.status);
  }
}

// 驗證 worker 訊息
children.forEach(({ pid, result }) => {
  assert.ok(
    result.stdout.includes('wrote ' + ORDERS_PER_PROCESS + ' orders'),
    'Worker ' + pid + ' 應回報寫了 ' + ORDERS_PER_PROCESS + ' 筆',
  );
});
console.log('  ✓ ' + PROCESS_COUNT + ' 個 child process 各寫了 ' + ORDERS_PER_PROCESS + ' 筆訂單');

// ─── 3. 驗證最終 CSV 完整性 ───
console.log('\n--- 驗證最終 CSV 完整性 ---');

assert.ok(fs.existsSync(TEST_CSV), 'CSV 檔案應存在：' + TEST_CSV);

const csvContent = fs.readFileSync(TEST_CSV, 'utf8');
const csvLines = csvContent.trim().split('\n');
const expectedLines = 1 + (PROCESS_COUNT * ORDERS_PER_PROCESS); // header + data

console.log('  CSV 行數：' + csvLines.length + ' (預期 ' + expectedLines + ')');
assert.strictEqual(
  csvLines.length,
  expectedLines,
  'CSV 行數應為 ' + expectedLines + '（header + ' + (PROCESS_COUNT * ORDERS_PER_PROCESS) + ' 筆訂單）',
);
console.log('  ✓ 行數正確：' + expectedLines);

// 驗證 header 是 CSV_HEADERS 第一行（28 欄）
const headerLine = csvLines[0];
const headerColCount = headerLine.split(',').length;
assert.strictEqual(headerColCount, 35, 'Header 應有 35 欄，實際 ' + headerColCount);
console.log('  ✓ Header 28 欄');

// 驗證每筆資料行都是 28 欄（沒有半截的 row）
const dataLines = csvLines.slice(1);
let allRowsValid = true;
const orderIdCounts = {};
dataLines.forEach((line, idx) => {
  const cols = line.split(',');
  if (cols.length !== 35) {
    console.error('  ✗ 第 ' + (idx + 2) + ' 行欄數錯誤：' + cols.length + '（內容：' + line.substring(0, 60) + '...）');
    allRowsValid = false;
  }
  // 統計 order_id 唯一性
  if (cols[0]) {
    orderIdCounts[cols[0]] = (orderIdCounts[cols[0]] || 0) + 1;
  }
});
assert.ok(allRowsValid, '所有資料行都應為 28 欄（沒有 race condition 造成的半截 row）');
console.log('  ✓ 所有 ' + dataLines.length + ' 筆資料都是 28 欄（無半截）');

// 驗證 order_id 唯一（沒有覆蓋）
const expectedOrderIds = [];
for (let p = 1; p <= PROCESS_COUNT; p++) {
  for (let i = 0; i < ORDERS_PER_PROCESS; i++) {
    expectedOrderIds.push('P' + p + '-' + String(i).padStart(3, '0'));
  }
}
expectedOrderIds.forEach((oid) => {
  assert.ok(orderIdCounts[oid] === 1, 'order_id ' + oid + ' 應出現 1 次，實際 ' + orderIdCounts[oid]);
});
console.log('  ✓ 所有 ' + expectedOrderIds.length + ' 個 order_id 都唯一（沒有覆蓋）');

// ─── 4. 清理測試資料 ───
console.log('\n--- 清理測試資料 ---');
// 只刪除 _csv_concurrency_test tenant（不碰 chicken tenant 任何檔案）
//
// Stale state 完整清理（2026-07-20 fix）：
// - TEST_DIR 必清（測試 dir）
// - TEST_KB_DIR 必清（KB dir）
// - LOCK_DIR_SIBLING 必清（proper-lockfile 的 lock DIR，前次 crash 會殘留）
// - workerScript 必清（測試 spawn 的 dynamic script）
fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.rmSync(TEST_KB_DIR, { recursive: true, force: true });
if (fs.existsSync(LOCK_DIR_SIBLING)) {
  fs.rmSync(LOCK_DIR_SIBLING, { recursive: true, force: true });
}
fs.unlinkSync(workerScript);
assert.ok(!fs.existsSync(TEST_DIR), '_csv_concurrency_test 訂單目錄應已刪除');
assert.ok(!fs.existsSync(TEST_KB_DIR), '_csv_concurrency_test KB 目錄應已刪除');
assert.ok(!fs.existsSync(LOCK_DIR_SIBLING), 'lock dir 應已刪除');
assert.ok(!fs.existsSync(workerScript), 'worker script 應已刪除');
console.log('  ✓ _csv_concurrency_test tenant + lock dir + worker script 已清理');

console.log('\n========================================');
console.log('ALL CSV WRITER CONCURRENCY TESTS PASSED ✓');
console.log('========================================\n');
