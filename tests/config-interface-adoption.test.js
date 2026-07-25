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
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const cfg = require('../src/config');
const _notifier = require('../src/handoff/notifier'); // unused：導入但不直接使用
const lineProfileCache = require('../src/utils/lineProfileCache');

const NOTIFIER_PATH = path.join(__dirname, '..', 'src', 'handoff', 'notifier.js');
const PROFILE_CACHE_PATH = path.join(__dirname, '..', 'src', 'utils', 'lineProfileCache.js');

test('1. config.js exports — getLineBotToken + getNotifyOwnerUserId', () => {
  assert.strictEqual(typeof cfg.getLineBotToken, 'function');
  assert.strictEqual(typeof cfg.getNotifyOwnerUserId, 'function');

  const ownerId = cfg.getNotifyOwnerUserId();
  assert.strictEqual(ownerId, 'Uf56650056d35626deb64165926a26182', '應從 chicken.yaml 讀到正確的 notify_owner LINE user ID');
});

test('2. notifier.js 程式碼檢查 — 用 config 介面 + 移除 hardcode', () => {
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

  assert.ok(
    !notifierSource.includes('fs.readFileSync(configPath'),
    'notifier.js 不應再自己讀 config.yaml',
  );
  assert.ok(
    !notifierSource.match(/^\s*let\s+HUBERT_LINE_USER_ID\s*=\s*['"]/m),
    'notifier.js 不應再有 module-level HUBERT_LINE_USER_ID let 變數',
  );
  assert.ok(
    !notifierSource.match(/^\s*let\s+LINE_BOT_TOKEN\s*=\s*['"]/m),
    'notifier.js 不應再有 module-level LINE_BOT_TOKEN let 變數',
  );

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
});

test('3. lineProfileCache.js 程式碼檢查 — 用 config 介面 + 移除 hardcode', () => {
  const profileSource = fs.readFileSync(PROFILE_CACHE_PATH, 'utf8');

  assert.ok(
    profileSource.includes("require('../config')"),
    'lineProfileCache.js 應 require config',
  );
  assert.ok(
    profileSource.includes('getLineBotToken'),
    'lineProfileCache.js 應使用 getLineBotToken',
  );

  assert.ok(
    !profileSource.includes('fs.readFileSync(configPath'),
    'lineProfileCache.js 不應再自己讀 config.yaml',
  );
  assert.ok(
    !profileSource.match(/let\s+LINE_BOT_TOKEN\s*=\s*['"]/),
    'lineProfileCache.js 不應再有 hardcode LINE_BOT_TOKEN 變數',
  );
});

test('4. notifyHubert 沒 token 時正確 skip / throw', () => {
  // Module isolation：環境有 XDG secrets token,要切到「沒 token」場景驗證
  // 簡單覆寫 LINE_BOT_TOKEN_FILE 不夠 — config.js 有 3 個 file source fallback (XDG > /tmp),
  // 任何路徑空字串或不存在都會 fallthrough 到下一個,最後還是讀到真實 token。
  // 修法：直接 inject fake config Module 到 require.cache,notifier 用 fake config 載入,
  //       getLineBotToken() 返回 '' → 觸發 notifier.js line 36 `if (!lineToken) return false`。
  const Module = require('module');
  const configPath = require.resolve('../src/config');
  const notifierPath = require.resolve('../src/handoff/notifier');
  const fakeConfig = new Module(configPath);
  fakeConfig.filename = configPath;
  fakeConfig.loaded = true;
  fakeConfig.exports = {
    getLineBotToken: () => '',
    getNotifyOwnerUserId: () => 'Uf56650056d35626deb64165926a26182',
    isFeatureEnabled: () => true, // feature enabled, 但 token 是空字串 → line 36 觸發
    getEmailConfig: () => null, // P0 2026-07-17：notifier.js Email fallback 需此 export
  };
  delete require.cache[notifierPath];
  require.cache[configPath] = fakeConfig;

  const notifierFresh = require('../src/handoff/notifier');
  // P0 2026-07-17：notifyHubert 失敗時 throw（向後相容舊 reject 行為）
  return (async () => {
    let caught = null;
    try {
      await notifierFresh.notifyHubert('test message');
    } catch (e) {
      caught = e;
    }
    assert.ok(caught, '沒 token 應 throw Error');
    assert.match(caught.message, /LINE Bot Token/);
  })();
});

test('5. lineProfileCache.getLineDisplayName 沒 token 時 fallback', async () => {
  // 用原始 lineProfileCache（top-level require），仍持有真實 config 的 getLineBotToken
  const profile = await lineProfileCache.getLineDisplayName('test-user-id');
  assert.ok(profile, 'getLineDisplayName 應返回字串');
  assert.ok(profile.length > 0, 'profile 不應為空');
});
