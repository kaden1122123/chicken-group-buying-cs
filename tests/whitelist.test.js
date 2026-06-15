'use strict';

/**
 * Whitelist middleware 單元測試
 * 測試範圍：白名單讀取、isWhitelisted、checkWhitelist、reloadConfig
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

console.log('\n=== Whitelist Tests ===');

let wl;
try {
  wl = require('../src/middleware/whitelist');
} catch (e) {
  console.error('Failed to load whitelist module:', e);
  process.exit(1);
}

// ========== 1. 模組載入 ==========
console.log('\n--- Module Loading ---');

assert.ok(wl.checkWhitelist, 'Should export checkWhitelist');
assert.ok(wl.isWhitelisted, 'Should export isWhitelisted');
assert.ok(wl.getAllowedUsers, 'Should export getAllowedUsers');
assert.ok(wl.reloadConfig, 'Should export reloadConfig');
assert.ok(wl.getBlockReply, 'Should export getBlockReply');
assert.ok(wl.isBlockOthers, 'Should export isBlockOthers');
console.log('  ✓ All required functions exported');

console.log('Module Loading: ALL PASSED ✓');

// ========== 2. 從 config.yaml 載入白名單 ==========
console.log('\n--- Load Whitelist from config.yaml ---');

const allowedUsers = wl.getAllowedUsers();
assert.ok(Array.isArray(allowedUsers), 'Should return array');
assert.ok(allowedUsers.length > 0, 'Should have at least 1 user (Hubert)');
assert.ok(allowedUsers.includes('Uf56650056d35626deb64165926a26182'), 'Should include Hubert user ID');
console.log(`  ✓ Loaded ${allowedUsers.length} allowed users: ${allowedUsers.join(', ')}`);

console.log('Load Whitelist: ALL PASSED ✓');

// ========== 3. isWhitelisted ==========
console.log('\n--- isWhitelisted ---');

function testWhitelisted(userId, expected, description) {
  const result = wl.isWhitelisted(userId);
  assert.strictEqual(result, expected, `${description}: "${userId}" expected ${expected} but got ${result}`);
  console.log(`  ✓ ${description}: "${userId}" → ${result}`);
}

testWhitelisted('Uf56650056d35626deb64165926a26182', true, 'Hubert (whitelisted)');
testWhitelisted('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', false, 'random user (not whitelisted)');
testWhitelisted('', false, 'empty string');
testWhitelisted(null, false, 'null');
testWhitelisted(undefined, false, 'undefined');

console.log('isWhitelisted: ALL PASSED ✓');

// ========== 4. checkWhitelist (block_others = false 模式) ==========
console.log('\n--- checkWhitelist (block_others: false) ---');

// 預設 block_others = false，應該全部通過
const isBlocking = wl.isBlockOthers();
console.log(`  ℹ️  isBlockOthers() = ${isBlocking}`);

if (!isBlocking) {
  const r1 = wl.checkWhitelist('Uf56650056d35626deb64165926a26182');
  assert.strictEqual(r1.blocked, false, 'Hubert should pass when block_others=false');
  assert.strictEqual(r1.reply, undefined, 'No reply when allowed');
  console.log('  ✓ Hubert passes');

  const r2 = wl.checkWhitelist('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  assert.strictEqual(r2.blocked, false, 'Anyone passes when block_others=false');
  console.log('  ✓ Random user also passes (block_others=false)');

  const r3 = wl.checkWhitelist('');
  assert.strictEqual(r3.blocked, false, 'Empty passes when block_others=false');
  console.log('  ✓ Empty userId passes (block_others=false)');
} else {
  // block_others = true 模式
  const r1 = wl.checkWhitelist('Uf56650056d35626deb64165926a26182');
  assert.strictEqual(r1.blocked, false, 'Hubert should pass when whitelisted');
  console.log('  ✓ Hubert passes (whitelisted)');

  const r2 = wl.checkWhitelist('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  assert.strictEqual(r2.blocked, true, 'Random user should be blocked');
  assert.ok(r2.reply, 'Should have block reply');
  console.log('  ✓ Random user is blocked');

  const r3 = wl.checkWhitelist('');
  assert.strictEqual(r3.blocked, true, 'Empty userId should be blocked');
  assert.ok(r3.reply, 'Should have block reply for empty');
  console.log('  ✓ Empty userId is blocked');

  // reply 內容驗證
  const reply = r2.reply;
  assert.strictEqual(reply.type, 'text', 'Reply type should be text');
  assert.ok(reply.text.includes('測試') || reply.text.includes('雞'), 'Reply should mention test or chicken');
  console.log('  ✓ Block reply has correct format');
}

console.log('checkWhitelist: ALL PASSED ✓');

// ========== 5. getBlockReply ==========
console.log('\n--- getBlockReply ---');

const blockReply = wl.getBlockReply();
assert.ok(blockReply, 'Should return reply object');
assert.strictEqual(blockReply.type, 'text', 'Reply should be text type');
assert.ok(blockReply.text, 'Reply should have text');
assert.ok(blockReply.text.length > 0, 'Reply text should not be empty');
console.log(`  ✓ getBlockReply() = ${JSON.stringify(blockReply.text)}`);

console.log('getBlockReply: ALL PASSED ✓');

// ========== 6. reloadConfig ==========
console.log('\n--- reloadConfig ---');

const before = wl.getAllowedUsers().length;
wl.reloadConfig();
const after = wl.getAllowedUsers().length;
assert.strictEqual(before, after, 'After reload, same number of users');
console.log(`  ✓ reloadConfig() works (${before} → ${after} users)`);

console.log('reloadConfig: ALL PASSED ✓');

// ========== 7. 邊界測試 ==========
console.log('\n--- Boundary Cases ---');

// 模擬不存在的 user ID 格式
testWhitelisted('123', false, 'numeric string');
testWhitelisted('user-with-special-chars-!@#', false, 'special chars');
testWhitelisted('U'.padEnd(33, 'x'), false, '33-char U-prefix but not in list');

console.log('Boundary Cases: ALL PASSED ✓');

// ========== 8. config.yaml 結構驗證 ==========
console.log('\n--- config.yaml Structure ---');

const content = fs.readFileSync(CONFIG_PATH, 'utf8');
assert.ok(content.includes('allowed_line_users:'), 'config.yaml should have allowed_line_users section');
assert.ok(content.includes('block_others:'), 'config.yaml should have block_others setting');
console.log('  ✓ config.yaml has whitelist settings');

console.log('config.yaml Structure: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL WHITELIST TESTS PASSED ✓');
console.log('========================================\n');
