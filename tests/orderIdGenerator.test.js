'use strict';

/**
 * orderIdGenerator 測試（Session H H3）
 *
 * 目的：驗證 src/order/orderIdGenerator.js 的 3 個函數
 *
 * 測試情境：
 * 1. getMaxSequence：讀 CSV 取最大序號
 * 2. generateOrderId：ORD-YYYYMMDD-XXX 格式 + 序號遞增
 * 3. generatePendingOrderId：PENDING-{timestamp} 格式
 *
 * 策略：
 * - 使用「偽日期」2099-12-31 避免污染真實 CSV
 * - 測試結束後清理測試檔案
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n=== OrderIdGenerator Tests ===');

const orderIdGenerator = require('../src/order/orderIdGenerator');

// 測試用偽日期（避免與真實訂單衝突）
const TEST_DATE = '2099-12-31';
const TEST_FILENAME = `${TEST_DATE}.csv`;
const DATA_DIR = path.join(__dirname, '../data/orders/chicken');
const TEST_CSV_PATH = path.join(DATA_DIR, TEST_FILENAME);

// 清理函式
function cleanupTestFile() {
  if (fs.existsSync(TEST_CSV_PATH)) {
    fs.unlinkSync(TEST_CSV_PATH);
  }
}

// 開始前先清理
cleanupTestFile();

console.log(`\n--- 情境 1: getMaxSequence 讀 CSV 取最大序號 ---`);

// 檔案不存在 → 回傳 0
assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '檔案不存在應回傳 0');
console.log('  ✓ 檔案不存在回傳 0');

// 寫一個有 ORD-XXX 的測試 CSV
fs.writeFileSync(
  TEST_CSV_PATH,
  'order_id,created_at\nORD-20991231-001,2099-12-31T10:00:00+08:00\nORD-20991231-002,2099-12-31T11:00:00+08:00\nORD-20991231-005,2099-12-31T12:00:00+08:00\n',
  'utf8'
);
assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 5, '最大序號應為 5');
console.log('  ✓ 從 CSV 解析最大序號 = 5');

// 空檔案（只有 header）
fs.writeFileSync(TEST_CSV_PATH, 'order_id,created_at\n', 'utf8');
assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '空檔案應回傳 0');
console.log('  ✓ 只有 header 的空檔案回傳 0');

// 寫一個無 ORD 開頭的內容
fs.writeFileSync(TEST_CSV_PATH, 'order_id,note\nPENDING-123,pending\nOTHER-1,other\n', 'utf8');
assert.strictEqual(orderIdGenerator.getMaxSequence(TEST_DATE), 0, '無 ORD- 開頭應回傳 0');
console.log('  ✓ 無 ORD- 開頭的內容回傳 0');

// 清理測試檔
cleanupTestFile();

console.log(`\n--- 情境 2: generateOrderId 格式驗證 ---`);

// 沒有檔案時應回傳 ORD-{today}-001
const id1 = orderIdGenerator.generateOrderId();
assert.match(id1, /^ORD-\d{8}-\d{3}$/, `應符合 ORD-YYYYMMDD-XXX 格式，實際: ${id1}`);
console.log(`  ✓ 格式正確: ${id1}`);

// 序號應為 001（檔案不存在時）
// 但若當天已有真實訂單，可能 > 001，所以只驗證格式不驗證具體值

// 同一個 process 內序號不會自動遞增（每次都讀檔重算）
const id2 = orderIdGenerator.generateOrderId();
assert.strictEqual(id2, id1, '同一 process 內不寫檔則序號不變');
console.log('  ✓ 同一 process 內序號不變（不寫檔）');

// 寫一個測試檔模擬當天已有 003
// 但 generateOrderId 用當天日期，所以這個測試用當天日期
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
  // 沒有當天檔案，建立一個
  fs.writeFileSync(
    todayCsvPath,
    `order_id,created_at\nORD-${yyyy}${mm}${dd}-003,${todayStr}T10:00:00+08:00\n`,
    'utf8'
  );
  createdTodayFile = true;
} else {
  // 已有當天檔案，記住內容
  originalContent = fs.readFileSync(todayCsvPath, 'utf8');
  const lines = originalContent.trim().split('\n');
  const header = lines[0];
  fs.writeFileSync(todayCsvPath, `${header}\nORD-${yyyy}${mm}${dd}-003,${todayStr}T10:00:00+08:00\n`, 'utf8');
}

const id3 = orderIdGenerator.generateOrderId();
assert.match(id3, /^ORD-\d{8}-004$/, `當天已有 003 時應產生 004，實際: ${id3}`);
console.log(`  ✓ 當天已有 003 時正確遞增為 004: ${id3}`);

// 清理測試干擾
if (createdTodayFile) {
  fs.unlinkSync(todayCsvPath);
} else if (originalContent !== null) {
  fs.writeFileSync(todayCsvPath, originalContent, 'utf8');
}

console.log(`\n--- 情境 3: generatePendingOrderId 格式 ---`);

const pid1 = orderIdGenerator.generatePendingOrderId();
assert.match(pid1, /^PENDING-\d+$/, `應符合 PENDING-{timestamp} 格式，實際: ${pid1}`);
console.log(`  ✓ 格式正確: ${pid1}`);

// timestamp 部分應為 13 位數字（毫秒級）
const ts = parseInt(pid1.split('-')[1]);
assert.ok(ts > 1.7e12, `timestamp 應為毫秒級（>1.7e12），實際: ${ts}`);
console.log(`  ✓ timestamp 為毫秒級（${ts}）`);

// 連續呼叫的 ID 仍應符合 PENDING- 格式（同毫秒內可能 ID 相同，這是 Date.now() 解析度的限制）
const pid2 = orderIdGenerator.generatePendingOrderId();
assert.match(pid2, /^PENDING-\d+$/, '連續呼叫的 ID 仍應符合 PENDING- 格式');
console.log('  ✓ 連續呼叫仍產生合法 PENDING- 格式（不保證跨毫秒唯一）');

// 最終清理
cleanupTestFile();

console.log('\n=== OrderIdGenerator Tests: ALL PASSED ===');