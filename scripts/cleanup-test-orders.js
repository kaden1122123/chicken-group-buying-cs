#!/usr/bin/env node
'use strict';
const logger = require('../src/utils/logger');

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

logger.info('=== 清理測試訂單 ===');
logger.info(`  Protected (從 tests/helpers/cleanup.js): ${PRODUCTION_DATA_PROTECTED.join(', ')}`);
logger.info(`  Data dir: ${DATA_DIR}`);
logger.info('');

if (!fs.existsSync(DATA_DIR)) {
  logger.info(`(資料目錄不存在，跳過)`);
  process.exit(0);
}

const before = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));
logger.info(`--- 處理前 (${before.length} 個 .csv) ---`);
for (const f of before) logger.info(`  ${f}`);
logger.info('');

let deleted = 0;
let kept = 0;
const protectedSet = new Set(listProtected());

for (const filename of before) {
  if (protectedSet.has(filename)) {
    logger.info(`  保留: ${filename}（真實訂單，git tracked）`);
    kept++;
  } else {
    try {
      safeUnlinkCSV(filename, DATA_DIR);
      logger.info(`  刪除: ${filename}（測試訂單）`);
      deleted++;
    } catch (e) {
      logger.error(`  錯誤: ${filename} - ${e.message}`);
    }
  }
}

logger.info('');
logger.info(`=== 結果：保留 ${kept} 個真實訂單，刪除 ${deleted} 個測試 CSV ===`);
logger.info('');
logger.info('=== 處理後 ===');
const after = fs.existsSync(DATA_DIR)
  ? fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'))
  : [];
if (after.length === 0) {
  logger.info('  (空)');
} else {
  for (const f of after) logger.info(`  ${f}`);
}
