'use strict';

/**
 * Whitelist middleware 單元測試（node:test 風格 · P1-4）
 * 測試範圍：白名單讀取、isWhitelisted、checkWhitelist、reloadConfig
 */

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

const wl = require('../src/middleware/whitelist');

// ═════════════════════════════════════════════════════════════════
// 1. 模組載入
// ═════════════════════════════════════════════════════════════════

test('Whitelist 模組匯出所有必要函數', () => {
  assert.ok(wl.checkWhitelist, '應匯出 checkWhitelist');
  assert.ok(wl.isWhitelisted, '應匯出 isWhitelisted');
  assert.ok(wl.getAllowedUsers, '應匯出 getAllowedUsers');
  assert.ok(wl.reloadConfig, '應匯出 reloadConfig');
  assert.ok(wl.getBlockReply, '應匯出 getBlockReply');
  assert.ok(wl.isBlockOthers, '應匯出 isBlockOthers');
});

// ═════════════════════════════════════════════════════════════════
// 2. 從 config.yaml 載入白名單
// ═════════════════════════════════════════════════════════════════

test('從 config.yaml 載入白名單', () => {
  const allowedUsers = wl.getAllowedUsers();
  assert.ok(Array.isArray(allowedUsers), '應回傳陣列');
  assert.ok(allowedUsers.length > 0, '應至少有 1 個 user (Hubert)');
  assert.ok(allowedUsers.includes('Uf56650056d35626deb64165926a26182'), '應包含 Hubert user ID');
});

// ═════════════════════════════════════════════════════════════════
// 3. isWhitelisted
// ═════════════════════════════════════════════════════════════════

test('isWhitelisted 各種 user ID', () => {
  assert.strictEqual(wl.isWhitelisted('Uf56650056d35626deb64165926a26182'), true, 'Hubert 應在白名單');
  assert.strictEqual(wl.isWhitelisted('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), false, '隨機 user 不在白名單');
  assert.strictEqual(wl.isWhitelisted(''), false, '空字串');
  assert.strictEqual(wl.isWhitelisted(null), false, 'null');
  assert.strictEqual(wl.isWhitelisted(undefined), false, 'undefined');
});

test('isWhitelisted 邊界', () => {
  assert.strictEqual(wl.isWhitelisted('123'), false, '純數字字串');
  assert.strictEqual(wl.isWhitelisted('user-with-special-chars-!@#'), false, '特殊字元');
  assert.strictEqual(wl.isWhitelisted('U'.padEnd(33, 'x')), false, '33 字元 U-prefix 但不在白名單');
});

// ═════════════════════════════════════════════════════════════════
// 4. checkWhitelist（依 block_others 模式分支）
// ═════════════════════════════════════════════════════════════════

test('checkWhitelist depends on isBlockOthers()', () => {
  const isBlocking = wl.isBlockOthers();

  if (!isBlocking) {
    // block_others = false：全部通過
    const r1 = wl.checkWhitelist('Uf56650056d35626deb64165926a26182');
    assert.strictEqual(r1.blocked, false, 'Hubert 應通過當 block_others=false');
    assert.strictEqual(r1.reply, undefined, '允許時無 reply');

    const r2 = wl.checkWhitelist('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    assert.strictEqual(r2.blocked, false, '隨機 user 也通過 block_others=false');

    const r3 = wl.checkWhitelist('');
    assert.strictEqual(r3.blocked, false, '空 userId 也通過 block_others=false');
  } else {
    // block_others = true：攔截非白名單
    const r1 = wl.checkWhitelist('Uf56650056d35626deb64165926a26182');
    assert.strictEqual(r1.blocked, false, 'Hubert 應通過當 whitelisted');

    const r2 = wl.checkWhitelist('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    assert.strictEqual(r2.blocked, true, '隨機 user 應被攔截');
    assert.ok(r2.reply, '應有 block reply');

    const r3 = wl.checkWhitelist('');
    assert.strictEqual(r3.blocked, true, '空 userId 應被攔截');
    assert.ok(r3.reply, '空 userId 也應有 block reply');

    // reply 內容驗證
    const reply = r2.reply;
    assert.strictEqual(reply.type, 'text', 'Reply type 應為 text');
    assert.ok(reply.text.includes('測試') || reply.text.includes('雞'), 'Reply 應提及 test 或 chicken');
  }
});

// ═════════════════════════════════════════════════════════════════
// 5. getBlockReply
// ═════════════════════════════════════════════════════════════════

test('getBlockReply 回傳帶 text 的 reply 物件', () => {
  const blockReply = wl.getBlockReply();
  assert.ok(blockReply, '應回傳 reply 物件');
  assert.strictEqual(blockReply.type, 'text', 'Reply 應為 text type');
  assert.ok(blockReply.text, 'Reply 應有 text');
  assert.ok(blockReply.text.length > 0, 'Reply text 不應為空');
});

// ═════════════════════════════════════════════════════════════════
// 6. reloadConfig
// ═════════════════════════════════════════════════════════════════

test('reloadConfig 重新載入 config 且使用者數不變', () => {
  const before = wl.getAllowedUsers().length;
  wl.reloadConfig();
  const after = wl.getAllowedUsers().length;
  assert.strictEqual(before, after, 'reload 後使用者數應相同');
});

// ═════════════════════════════════════════════════════════════════
// 7. config.yaml 結構驗證
// ═════════════════════════════════════════════════════════════════

test('config.yaml 包含 whitelist 設定', () => {
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  assert.ok(content.includes('allowed_line_users:'), '應有 allowed_line_users 區塊');
  assert.ok(content.includes('block_others:'), '應有 block_others 設定');
});
