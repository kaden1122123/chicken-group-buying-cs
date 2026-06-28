'use strict';

/**
 * P2-5: notifier / lineProfileCache 改用 config 介面驗證測試
 *
 * 原本 src/handoff/notifier.js 跟 src/utils/lineProfileCache.js 都自己
 * regex 解析 config.yaml，跟 src/config.js 介面不同步。多租戶時不支援。
 *
 * 修整：
 * - src/handoff/notifier.js 改用 require('../config') 拿 getLineBotToken + getNotifyOwnerUserId
 * - src/utils/lineProfileCache.js 改用 require('../config') 拿 getLineBotToken
 * - src/config.js 加 getNotifyOwnerUserId() 介面
 *
 * 本測試驗證：
 * 1. config.js 有 getNotifyOwnerUserId 函數
 * 2. notifier.js 程式碼改用 require('../config')
 * 3. lineProfileCache.js 程式碼改用 require('../config')
 * 4. 既有 handoff 行為不退步
 * 5. notifier.js / lineProfileCache.js 不再有自己 regex 解析 config.yaml
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cfg = require('../src/config');
const notifier = require('../src/handoff/notifier');
const lineProfileCache = require('../src/utils/lineProfileCache');

const NOTIFIER_PATH = path.join(__dirname, '..', 'src', 'handoff', 'notifier.js');
const PROFILE_CACHE_PATH = path.join(__dirname, '..', 'src', 'utils', 'lineProfileCache.js');

console.log('\n=== Config Interface Adoption Tests (P2-5) ===');

// ─── 1. config.js 介面存在 ───
console.log('\n--- config.js exports ---');

assert.strictEqual(typeof cfg.getLineBotToken, 'function');
assert.strictEqual(typeof cfg.getNotifyOwnerUserId, 'function');
console.log('  ✓ getLineBotToken() 存在');
console.log('  ✓ getNotifyOwnerUserId() 存在');

const ownerId = cfg.getNotifyOwnerUserId();
assert.strictEqual(ownerId, 'Uf56650056d35626deb64165926a26182', '應從 chicken.yaml 讀到正確的 notify_owner LINE user ID');
console.log(`  ✓ getNotifyOwnerUserId() = "${ownerId}"`);

// ─── 2. notifier.js 程式碼檢查 ───
console.log('\n--- notifier.js 程式碼檢查 ---');

const notifierSource = fs.readFileSync(NOTIFIER_PATH, 'utf8');

assert.ok(
  notifierSource.includes("require('../config')"),
  'notifier.js 應 require config',
);
assert.ok(
  notifierSource.includes('getLineBotToken') || notifierSource.includes('getLineToken'),
  'notifier.js 應使用 getLineBotToken 或 getLineToken',
);
assert.ok(
  notifierSource.includes('getNotifyOwnerUserId') || notifierSource.includes('getHubertLineUserId'),
  'notifier.js 應使用 getNotifyOwnerUserId',
);
console.log('  ✓ notifier.js 用 config 介面');

assert.ok(
  !notifierSource.includes('fs.readFileSync(configPath'),
  'notifier.js 不應再自己讀 config.yaml',
);
// 原始 hardcode 是 module-level let HUBERT_LINE_USER_ID = '...'
// 修整後只剩 DEFAULT_HUBERT_LINE_USER_ID 常數（fallback 用途，config 沒設才使用）
assert.ok(
  !notifierSource.match(/^\s*let\s+HUBERT_LINE_USER_ID\s*=\s*['"]/m),
  'notifier.js 不應再有 module-level HUBERT_LINE_USER_ID let 變數',
);
assert.ok(
  !notifierSource.match(/^\s*let\s+LINE_BOT_TOKEN\s*=\s*['"]/m),
  'notifier.js 不應再有 module-level LINE_BOT_TOKEN let 變數',
);
console.log('  ✓ notifier.js 移除 module-level hardcode 變數（保留 DEFAULT_ fallback）');

assert.ok(
  !notifierSource.includes('module.exports') ||
    !notifierSource.match(/module\.exports[\s\S]{0,500}/)?.[0].includes('HUBERT_LINE_USER_ID'),
  'notifier.js 不應 export HUBERT_LINE_USER_ID',
);
assert.ok(
  !notifierSource.includes('module.exports') ||
    !notifierSource.match(/module\.exports[\s\S]{0,500}/)?.[0].includes('LINE_BOT_TOKEN'),
  'notifier.js 不應 export LINE_BOT_TOKEN',
);
console.log('  ✓ notifier.js 移除 export 變數');

// ─── 3. lineProfileCache.js 程式碼檢查 ───
console.log('\n--- lineProfileCache.js 程式碼檢查 ---');

const profileSource = fs.readFileSync(PROFILE_CACHE_PATH, 'utf8');

assert.ok(
  profileSource.includes("require('../config')"),
  'lineProfileCache.js 應 require config',
);
assert.ok(
  profileSource.includes('getLineBotToken'),
  'lineProfileCache.js 應使用 getLineBotToken',
);
console.log('  ✓ lineProfileCache.js 用 config 介面');

assert.ok(
  !profileSource.includes('fs.readFileSync(configPath'),
  'lineProfileCache.js 不應再自己讀 config.yaml',
);
assert.ok(
  !profileSource.match(/let\s+LINE_BOT_TOKEN\s*=\s*['"]/),
  'lineProfileCache.js 不應再有 hardcode LINE_BOT_TOKEN 變數',
);
console.log('  ✓ lineProfileCache.js 移除 hardcode');

// ─── 4. 既有 notifier 行為不退步 ───
console.log('\n--- notifier 行為 ---');

assert.strictEqual(typeof notifier.notifyHubert, 'function');
console.log('  ✓ notifyHubert 函數存在');

(async () => {
  // 沒設 token 時應該 skip
  const r = await notifier.notifyHubert('test message');
  assert.strictEqual(r, false, '沒 token 應 return false');
  console.log('  ✓ notifyHubert 沒 token 時正確 skip');

  // lineProfileCache 也能用（沒 token 時 getLineDisplayName fallback）
  const profile = await lineProfileCache.getLineDisplayName('test-user-id');
  assert.ok(profile, 'getLineDisplayName 應返回字串');
  assert.ok(profile.length > 0, 'profile 不應為空');
  console.log(`  ✓ lineProfileCache.getLineDisplayName 正常運作: "${profile}"`);

  console.log('\n========================================');
  console.log('ALL CONFIG INTERFACE ADOPTION TESTS PASSED ✓');
  console.log('========================================\n');
})().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
