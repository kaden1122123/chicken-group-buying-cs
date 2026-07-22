'use strict';

/**
 * LINE Profile Cache 獨立測試（Session H8-D）
 */

const assert = require('assert');
const { test } = require('node:test');

// 重要：測試需要在 require 前先設定 LINE_BOT_TOKEN（讓 module 載入時不報錯）
process.env.LINE_BOT_TOKEN = 'test_token_for_h8_suite';

const cache = require('../src/utils/lineProfileCache');

test('getLineDisplayName: 邊界 fallback「LINE用戶」', async () => {
  assert.strictEqual(await cache.getLineDisplayName(''), 'LINE用戶', '空字串回傳「LINE用戶」');
  assert.strictEqual(await cache.getLineDisplayName(null), 'LINE用戶', 'null 回傳「LINE用戶」');
  assert.strictEqual(await cache.getLineDisplayName(undefined), 'LINE用戶', 'undefined 回傳「LINE用戶」');
});

test('getLineProfile: 邊界 — 空字串回傳預設 profile', async () => {
  const emptyProfile = await cache.getLineProfile('');
  assert.ok(emptyProfile && typeof emptyProfile === 'object' && emptyProfile.displayName === 'LINE用戶', `got: ${JSON.stringify(emptyProfile)}`);
});

test('Cache 機制 — 無效 API call 後 fallback「LINE用戶」', async () => {
  cache.clearAllCache();
  const failResult = await cache.getLineDisplayName('U_test_user_with_no_api');
  assert.strictEqual(failResult, 'LINE用戶', `got ${failResult}`);
});

test('invalidateCache / clearAllCache — 不 crash', () => {
  cache.invalidateCache('U_nonexistent');
  cache.invalidateCache(null);
  cache.invalidateCache(undefined);
  cache.clearAllCache();
  // 都沒 throw 即通過
  assert.ok(true);
});
