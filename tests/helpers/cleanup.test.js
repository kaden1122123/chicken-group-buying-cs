'use strict';

/**
 * Test Cleanup Helper 單元測試
 *
 * 驗證：
 *   1. isProtected 對 git tracked 真實訂單回傳 true
 *   2. isProtected 對其他檔案回傳 false
 *   3. assertNotProtected 對 protected 拋錯
 *   4. assertNotProtected 對非 protected 不拋錯
 *   5. safeUnlinkCSV 拒絕刪 protected（6/13 仍在磁碟上）
 *   6. safeUnlinkCSV 可刪非 protected 檔
 *   7. listProtected 返回正確清單
 *   8. getDataDir 返回正確路徑
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const cleanup = require('./cleanup');

console.log('\n=== Test Cleanup Helper Tests ===');

// ─── 1. isProtected 對 protected 檔案回傳 true ───
console.log('\n--- isProtected: protected 檔案 ---');
assert.strictEqual(cleanup.isProtected('2026-06-13.csv'), true, '6/13 應為 protected');
assert.strictEqual(cleanup.isProtected('2026-06-16.csv'), true, '6/16 應為 protected');
console.log('  ✓ 6/13 + 6/16 都是 protected');

// ─── 2. isProtected 對非 protected 檔案回傳 false ───
console.log('\n--- isProtected: 非 protected 檔案 ---');
assert.strictEqual(cleanup.isProtected('2026-06-27.csv'), false, '6/27（測試產物）應放行');
assert.strictEqual(cleanup.isProtected('test-order.csv'), false, '任意測試檔應放行');
assert.strictEqual(cleanup.isProtected(''), false, '空字串應放行');
console.log('  ✓ 非 protected 檔案正確放行');

// ─── 3. assertNotProtected 對 protected 拋錯 ───
console.log('\n--- assertNotProtected: protected 應拋錯 ---');
assert.throws(
  () => cleanup.assertNotProtected('2026-06-13.csv'),
  /REFUSED.*2026-06-13\.csv.*PRODUCTION/,
  '應拋出明確 REFUSED 錯誤',
);
console.log('  ✓ 對 6/13 拋出明確 REFUSED 錯誤');

// ─── 4. assertNotProtected 對非 protected 不拋錯 ───
console.log('\n--- assertNotProtected: 非 protected 不拋錯 ---');
assert.doesNotThrow(() => cleanup.assertNotProtected('test.csv'), 'test.csv 應放行');
assert.doesNotThrow(() => cleanup.assertNotProtected('2026-06-27.csv'), '6/27 應放行');
console.log('  ✓ 非 protected 不拋錯');

// ─── 5. safeUnlinkCSV 拒絕刪 protected（6/13 真實訂單保護）───
console.log('\n--- safeUnlinkCSV: 拒絕刪 protected ---');
const protectedPath = path.join(cleanup.getDataDir(), '2026-06-13.csv');
const wasProtected = fs.existsSync(protectedPath);
assert.ok(wasProtected, 'precondition: 6/13 真實訂單必須在磁碟上');

assert.throws(
  () => cleanup.safeUnlinkCSV('2026-06-13.csv'),
  /REFUSED/,
  'safeUnlinkCSV 對 protected 應拋錯',
);

assert.ok(fs.existsSync(protectedPath), 'postcondition: 6/13 真實訂單必須仍在磁碟上');
console.log('  ✓ safeUnlinkCSV 拒絕刪 6/13，6/13 真實訂單仍在');

// ─── 6. safeUnlinkCSV 可刪非 protected 檔（建立→刪除流程）───
console.log('\n--- safeUnlinkCSV: 可刪非 protected ---');
const tmpFilename = '_cleanup_test_temp.csv';
const tmpPath = path.join(cleanup.getDataDir(), tmpFilename);
fs.writeFileSync(tmpPath, 'order_id,created_at\nTEST-123,2026-06-28T00:00:00Z\n', 'utf8');
assert.ok(fs.existsSync(tmpPath), 'precondition: 暫存 CSV 應已建立');

const deleted = cleanup.safeUnlinkCSV(tmpFilename);
assert.strictEqual(deleted, true, 'safeUnlinkCSV 應回傳 true');
assert.ok(!fs.existsSync(tmpPath), 'postcondition: 暫存 CSV 應已刪除');
console.log('  ✓ safeUnlinkCSV 正確刪除非 protected 檔');

// ─── 7. listProtected 返回正確清單 ───
console.log('\n--- listProtected ---');
const protectedList = cleanup.listProtected();
assert.ok(Array.isArray(protectedList), '應回傳陣列');
assert.ok(protectedList.includes('2026-06-13.csv'), '應含 6/13');
assert.ok(protectedList.includes('2026-06-16.csv'), '應含 6/16');
assert.strictEqual(protectedList.length, 2, '目前 protected 清單應為 2 筆');

// 驗證回傳的是 copy（改 protectedList 不應影響原陣列）
protectedList.push('hacked.csv');
assert.ok(!cleanup.isProtected('hacked.csv'), '修改 listProtected 回傳值不應影響原陣列');
protectedList.pop(); // 還原
console.log('  ✓ listProtected 正確返回清單（且為 copy）');

// ─── 8. getDataDir 返回正確路徑 ───
console.log('\n--- getDataDir ---');
const dataDir = cleanup.getDataDir();
assert.ok(dataDir.endsWith('data/orders/chicken'), '應指向 data/orders/chicken');
console.log(`  ✓ getDataDir = ${dataDir}`);

console.log('\n========================================');
console.log('ALL TEST CLEANUP HELPER TESTS PASSED ✓');
console.log('========================================\n');
