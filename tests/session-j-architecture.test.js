'use strict';

/**
 * Session J 完整度測試 — J1/J2/J3/J4 改動守住
 *
 * J 原本 4 個項目已在先前 session 完成，本測試確保未來不會 drift：
 * 1. J1: sync-mirror.sh --dry-run 旗號要能 avoid real rsync
 * 2. J2: .rsync-filter 要存在 + sync-mirror.sh 要 --exclude-from 它
 * 3. J3: PRODUCTION_DATA_PROTECTED 單一來源（只有 tests/helpers/cleanup.js 定義）
 * 4. J4: cleanup-test-orders.* 必須 require helper（不能自己內嵌 array）
 *
 * 測試策略：source code grep（不執行 rsync，避免副作用）
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n=== Session J 完整度測試 ===');

// ========== J1: sync-mirror.sh --dry-run ==========
console.log('\n--- J1: sync-mirror.sh --dry-run 旗號 ---');
const SYNC_PATH = path.join(__dirname, '..', 'scripts', 'sync-mirror.sh');
const syncSource = fs.readFileSync(SYNC_PATH, 'utf8');

assert.ok(syncSource.includes('--dry-run'), 'sync-mirror.sh 應支援 --dry-run 旗號');
assert.ok(syncSource.includes('DRY_RUN=true'), 'sync-mirror.sh 應有 DRY_RUN 變數');
assert.ok(syncSource.includes('RSYNC_FLAGS=(-av --delete)'), 'sync-mirror.sh 應有 RSYNC_FLAGS 起始');
assert.ok(syncSource.includes("RSYNC_FLAGS+=(-n)"), '--dry-run 時應加 -n flag');
console.log('  ✓ J1: sync-mirror.sh --dry-run 旗號實作正確');

// ========== J2: .rsync-filter ==========
console.log('\n--- J2: .rsync-filter 存在 + sync-mirror.sh 使用 ---');
const FILTER_PATH = path.join(__dirname, '..', '.rsync-filter');
assert.ok(fs.existsSync(FILTER_PATH), '.rsync-filter 應存在');
const filterContent = fs.readFileSync(FILTER_PATH, 'utf8');

assert.ok(syncSource.includes('.rsync-filter'), 'sync-mirror.sh 應引用 .rsync-filter');
assert.ok(syncSource.includes('--exclude-from'), 'sync-mirror.sh 應使用 --exclude-from');
// 從原位置 sync 時排除 test fixtures
assert.ok(
  filterContent.includes('test-yaml-patch'),
  '.rsync-filter 應排除 test-yaml-patch fixtures',
);
console.log('  ✓ J2: .rsync-filter 存在且 sync-mirror.sh 正確使用');

// ========== J3: PRODUCTION_DATA_PROTECTED 單一來源 ==========
console.log('\n--- J3: PRODUCTION_DATA_PROTECTED 單一來源 ---');

// 確認只有 tests/helpers/cleanup.js 定義 PRODUCTION_DATA_PROTECTED
const allJsFiles = [
  'scripts/cleanup-test-orders.js',
  'scripts/cleanup-test-orders.sh',
  'tests/helpers/cleanup.js',
  'src/utils/logger.js',  // random
  'src/config.js',
  'src/order/csvWriter.js',
];

let definitionCount = 0;
let definitionFiles = [];
for (const f of allJsFiles) {
  const fullPath = path.join(__dirname, '..', f);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  // 匹配 const PRODUCTION_DATA_PROTECTED 定義（export 或 const）
  const defMatch = content.match(/(?:export\s+)?const\s+PRODUCTION_DATA_PROTECTED\s*=/);
  if (defMatch) {
    definitionCount++;
    definitionFiles.push(f);
  }
}
assert.strictEqual(
  definitionCount,
  1,
  `PRODUCTION_DATA_PROTECTED 應只有 1 處定義，發現 ${definitionCount} 處（${definitionFiles.join(', ')}）`,
);
assert.ok(definitionFiles.includes('tests/helpers/cleanup.js'), 'PRODUCTION_DATA_PROTECTED 應在 tests/helpers/cleanup.js 定義');
console.log('  ✓ J3: PRODUCTION_DATA_PROTECTED 只有 tests/helpers/cleanup.js 定義');

// ========== J4: cleanup-test-orders.js 用 helper ==========
console.log('\n--- J4: cleanup-test-orders 使用 helper 單一來源 ---');
const CLEANUP_JS_PATH = path.join(__dirname, '..', 'scripts', 'cleanup-test-orders.js');
const CLEANUP_SH_PATH = path.join(__dirname, '..', 'scripts', 'cleanup-test-orders.sh');

const cleanupJsSource = fs.readFileSync(CLEANUP_JS_PATH, 'utf8');
const cleanupShSource = fs.readFileSync(CLEANUP_SH_PATH, 'utf8');

// J4: .js 版本必須 require helper
assert.ok(
  cleanupJsSource.includes("require('../tests/helpers/cleanup.js')"),
  'cleanup-test-orders.js 應 require helper',
);
// 不能自己內嵌 array 定義
assert.ok(
  !cleanupJsSource.match(/PRODUCTION_DATA_PROTECTED\s*=\s*\[/),
  'cleanup-test-orders.js 不應自己定義 PRODUCTION_DATA_PROTECTED array',
);

// J4: .sh 版本必須是 wrapper（不能自己內嵌 logic）
assert.ok(
  cleanupShSource.match(/exec\s+node\s+scripts\/cleanup-test-orders\.js/),
  'cleanup-test-orders.sh 應 exec node cleanup-test-orders.js',
);
// 也不能內嵌 PROTECTED array（drift 防護）
assert.ok(
  !cleanupShSource.match(/PROTECTED.*2026-06-1[36]/),
  'cleanup-test-orders.sh 不應內嵌 PROTECTED 陣列（應透傳給 .js）',
);
console.log('  ✓ J4: cleanup-test-orders.{js,sh} 正確使用 helper 單一來源');

// ========== J5: 實際行為驗證（require helper 能拿到正確 PROTECTED）==========
console.log('\n--- J5: helper 提供的 PROTECTED 含 6/13 + 6/16 ---');
const cleanup = require('../tests/helpers/cleanup.js');
const protectedList = cleanup.listProtected();
assert.ok(protectedList.includes('2026-06-13.csv'), '應保護 2026-06-13.csv');
assert.ok(protectedList.includes('2026-06-16.csv'), '應保護 2026-06-16.csv');
assert.strictEqual(protectedList.length, 2, `PROTECTED 應只含 2 個，發現 ${protectedList.length} 個`);
console.log('  ✓ helper 提供的 PROTECTED 含正確值');

console.log('\n=== Session J 完整度測試: ALL PASSED ✓ ===');