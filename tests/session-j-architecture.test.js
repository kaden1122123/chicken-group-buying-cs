'use strict';

/**
 * Session J 完整度測試 — J1/J2/J3/J4 改動守住
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const SYNC_PATH = path.join(__dirname, '..', 'scripts', 'sync-mirror.sh');

test('J1: sync-mirror.sh --dry-run 旗號', () => {
  const syncSource = fs.readFileSync(SYNC_PATH, 'utf8');
  assert.ok(syncSource.includes('--dry-run'), '應支援 --dry-run 旗號');
  assert.ok(syncSource.includes('DRY_RUN=true'), '應有 DRY_RUN 變數');
  assert.ok(syncSource.includes('RSYNC_FLAGS=(-av --delete)'), '應有 RSYNC_FLAGS 起始');
  assert.ok(syncSource.includes('RSYNC_FLAGS+=(-n)'), '--dry-run 時應加 -n flag');
});

test('J2: .rsync-filter 存在 + sync-mirror.sh 使用', () => {
  const FILTER_PATH = path.join(__dirname, '..', '.rsync-filter');
  assert.ok(fs.existsSync(FILTER_PATH), '.rsync-filter 應存在');

  const filterContent = fs.readFileSync(FILTER_PATH, 'utf8');
  const syncSource = fs.readFileSync(SYNC_PATH, 'utf8');
  assert.ok(syncSource.includes('.rsync-filter'), 'sync-mirror.sh 應引用 .rsync-filter');
  assert.ok(syncSource.includes('--exclude-from'), 'sync-mirror.sh 應使用 --exclude-from');
  assert.ok(filterContent.includes('test-yaml-patch'), '.rsync-filter 應排除 test-yaml-patch fixtures');
});

test('J3: PRODUCTION_DATA_PROTECTED 單一來源（只有 tests/helpers/cleanup.js 定義）', () => {
  const allJsFiles = [
    'scripts/cleanup-test-orders.js',
    'scripts/cleanup-test-orders.sh',
    'tests/helpers/cleanup.js',
    'src/utils/logger.js',
    'src/config.js',
    'src/order/csvWriter.js',
  ];

  let definitionCount = 0;
  const definitionFiles = [];
  for (const f of allJsFiles) {
    const fullPath = path.join(__dirname, '..', f);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const defMatch = content.match(/(?:export\s+)?const\s+PRODUCTION_DATA_PROTECTED\s*=/);
    if (defMatch) {
      definitionCount++;
      definitionFiles.push(f);
    }
  }
  assert.strictEqual(definitionCount, 1, `PRODUCTION_DATA_PROTECTED 應只有 1 處定義, 發現 ${definitionCount} 處（${definitionFiles.join(', ')}）`);
  assert.ok(definitionFiles.includes('tests/helpers/cleanup.js'), '應在 tests/helpers/cleanup.js 定義');
});

test('J4: cleanup-test-orders 使用 helper 單一來源', () => {
  const CLEANUP_JS_PATH = path.join(__dirname, '..', 'scripts', 'cleanup-test-orders.js');
  const CLEANUP_SH_PATH = path.join(__dirname, '..', 'scripts', 'cleanup-test-orders.sh');

  const cleanupJsSource = fs.readFileSync(CLEANUP_JS_PATH, 'utf8');
  const cleanupShSource = fs.readFileSync(CLEANUP_SH_PATH, 'utf8');

  assert.ok(
    cleanupJsSource.includes("require('../tests/helpers/cleanup.js')"),
    'cleanup-test-orders.js 應 require helper',
  );
  assert.ok(
    !cleanupJsSource.match(/PRODUCTION_DATA_PROTECTED\s*=\s*\[/),
    'cleanup-test-orders.js 不應自己定義 PRODUCTION_DATA_PROTECTED array',
  );
  assert.ok(
    cleanupShSource.match(/exec\s+node\s+scripts\/cleanup-test-orders\.js/),
    'cleanup-test-orders.sh 應 exec node cleanup-test-orders.js',
  );
  assert.ok(
    !cleanupShSource.match(/PROTECTED.*2026-06-1[36]/),
    'cleanup-test-orders.sh 不應內嵌 PROTECTED 陣列',
  );
});

test('J5: helper 提供的 PROTECTED 含正確值', () => {
  const cleanup = require('../tests/helpers/cleanup.js');
  const protectedList = cleanup.listProtected();
  assert.ok(protectedList.includes('2026-06-13.csv'), '應保護 2026-06-13.csv');
  assert.ok(protectedList.includes('2026-06-16.csv'), '應保護 2026-06-16.csv');
  assert.strictEqual(protectedList.length, 2, `PROTECTED 應只含 2 個, 發現 ${protectedList.length} 個`);
});
