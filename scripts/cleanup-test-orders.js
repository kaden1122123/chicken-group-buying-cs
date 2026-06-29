#!/usr/bin/env node
'use strict';

/**
 * cleanup-test-orders.js — Session J3/J4
 *
 * 清理測試建立的 CSV 訂單（不含真實訂單）。
 *
 * 之前是 bash script（cleanup-test-orders.sh）內嵌 PROTECTED 陣列，
 * 跟 tests/helpers/cleanup.js 的 PRODUCTION_DATA_PROTECTED 雙重定義，
 * 容易 drift。Session J3 重構成：
 *   - 從 tests/helpers/cleanup.js require() listProtected()（single source of truth）
 *   - 真正的刪除邏輯也走 helper 的 safeUnlinkCSV()
 *
 * 用途：
 *   - npm test 跑完後執行，清理留下的測試 CSV
 *   - shell 用法：bash scripts/cleanup-test-orders.sh（向後相容 wrapper）
 *   - node 用法：node scripts/cleanup-test-orders.js
 */

const fs = require('fs');
const {
  PRODUCTION_DATA_PROTECTED,
  listProtected,
  safeUnlinkCSV,
  getDataDir,
} = require('../tests/helpers/cleanup.js');

const DATA_DIR = getDataDir();

console.log('=== 清理測試訂單 ===');
console.log(`  Protected (從 tests/helpers/cleanup.js): ${PRODUCTION_DATA_PROTECTED.join(', ')}`);
console.log(`  Data dir: ${DATA_DIR}`);
console.log('');

if (!fs.existsSync(DATA_DIR)) {
  console.log(`(資料目錄不存在，跳過)`);
  process.exit(0);
}

const before = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));
console.log(`--- 處理前 (${before.length} 個 .csv) ---`);
for (const f of before) console.log(`  ${f}`);
console.log('');

let deleted = 0;
let kept = 0;
const protectedSet = new Set(listProtected());

for (const filename of before) {
  if (protectedSet.has(filename)) {
    console.log(`  保留: ${filename}（真實訂單，git tracked）`);
    kept++;
  } else {
    try {
      safeUnlinkCSV(filename, DATA_DIR);
      console.log(`  刪除: ${filename}（測試訂單）`);
      deleted++;
    } catch (e) {
      console.error(`  錯誤: ${filename} - ${e.message}`);
    }
  }
}

console.log('');
console.log(`=== 結果：保留 ${kept} 個真實訂單，刪除 ${deleted} 個測試 CSV ===`);
console.log('');
console.log('=== 處理後 ===');
const after = fs.existsSync(DATA_DIR)
  ? fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'))
  : [];
if (after.length === 0) {
  console.log('  (空)');
} else {
  for (const f of after) console.log(`  ${f}`);
}
