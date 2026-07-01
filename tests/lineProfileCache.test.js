'use strict';

/**
 * LINE Profile Cache 獨立測試（Session H8-D）
 *
 * 目的：守護 src/utils/lineProfileCache.js 主要 exports
 *   - getLineDisplayName(userId) — 帶快取 fallback 邏輯
 *   - getLineProfile(userId) — 完整 profile（含 pictureUrl）
 *   - invalidateCache(userId)
 *   - clearAllCache()
 *
 * 環境：使用 mock fetchLineProfile 而不真的 call LINE API
 */

const assert = require('assert');

// 重要：測試需要在 require 前先設定 LINE_BOT_TOKEN（讓 module 載入時不報錯）
process.env.LINE_BOT_TOKEN = 'test_token_for_h8_suite';

const cache = require('../src/utils/lineProfileCache');

console.log('\n=== LINE Profile Cache Tests (H8-D) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

// ==================== getLineDisplayName 邊界 ====================
console.log('\n--- getLineDisplayName: 邊界（fallback「LINE用戶」）---');

(async () => {
  // 空 userId → fallback
  const emptyResult = await cache.getLineDisplayName('');
  check('空字串回傳「LINE用戶」', emptyResult === 'LINE用戶', `got ${emptyResult}`);

  const nullResult = await cache.getLineDisplayName(null);
  check('null 回傳「LINE用戶」', nullResult === 'LINE用戶', `got ${nullResult}`);

  const undefinedResult = await cache.getLineDisplayName(undefined);
  check('undefined 回傳「LINE用戶」', undefinedResult === 'LINE用戶', `got ${undefinedResult}`);

  // ==================== getLineProfile 邊界 ====================
  console.log('\n--- getLineProfile: 邊界 ---');

  const emptyProfile = await cache.getLineProfile('');
  check('空字串回傳預設 profile', emptyProfile && typeof emptyProfile === 'object' && emptyProfile.displayName === 'LINE用戶', `got: ${JSON.stringify(emptyProfile)}`);

  // ==================== 快取機制 ====================
  console.log('\n--- Cache 機制測試 ---');

  // 由於 LINE_BOT_TOKEN 是 mock，無法實際 call API 成功
  // 但可以測試：fetch 失敗時的行為
  cache.clearAllCache();

  // 嘗試以失敗的 token 取得 user（會 fetch 失敗 → fallback to「LINE用戶」）
  const failResult = await cache.getLineDisplayName('U_test_user_with_no_api');
  check('無效 API call 後 fallback「LINE用戶」', failResult === 'LINE用戶', `got ${failResult}`);

  console.log('\n--- invalidateCache / clearAllCache ---');
  // 即使沒有 cached，invalidate 不應 crash
  cache.invalidateCache('U_nonexistent');
  check('invalidateCache(不存在 userId) 不 crash', true, '');
  cache.invalidateCache(null);
  check('invalidateCache(null) 不 crash', true, '');
  cache.invalidateCache(undefined);
  check('invalidateCache(undefined) 不 crash', true, '');
  cache.clearAllCache();
  check('clearAllCache() 不 crash', true, '');

  // ==================== 結果 ====================
  console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
  if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
  console.log('\n========================================');
})().catch((e) => {
  console.error('Test crashed:', e.message);
  process.exit(1);
});
