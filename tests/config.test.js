'use strict';

/**
 * config.js 單元測試
 * 測試範圍：YAML loader + isIgnoredKeyword + 邊界情況
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

console.log('\n=== Config Tests ===');

let cfg;
try {
  cfg = require('../src/config');
} catch (e) {
  console.error('Failed to load config:', e);
  process.exit(1);
}

// ========== 1. YAML 載入 ==========
console.log('\n--- YAML Loading ---');

assert.ok(cfg._yamlParser, 'Should have _yamlParser field');
assert.ok(['js-yaml', 'fallback'].includes(cfg._yamlParser), `Parser should be js-yaml or fallback, got: ${cfg._yamlParser}`);
console.log(`  ✓ YAML parser: ${cfg._yamlParser}`);

const openDates = cfg.getOpenDates();
assert.ok(Array.isArray(openDates), 'openDates should be array');
assert.ok(openDates.length > 0, 'openDates should not be empty');
for (const d of openDates) {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d), `Date format should be YYYY-MM-DD, got: ${d}`);
}
console.log(`  ✓ Loaded ${openDates.length} open dates`);

const ignoredKeywords = cfg.getIgnoredKeywords();
assert.ok(Array.isArray(ignoredKeywords), 'ignoredKeywords should be array');
assert.ok(ignoredKeywords.includes('菜單'), 'Should include 菜單');
assert.ok(ignoredKeywords.includes('常見問題'), 'Should include 常見問題');
assert.ok(ignoredKeywords.includes('我要訂購'), 'Should include 我要訂購');
assert.ok(ignoredKeywords.includes('黑羽放山雞介紹'), 'Should include 黑羽放山雞介紹');
assert.ok(ignoredKeywords.includes('蔥鹽醬介紹'), 'Should include 蔥鹽醬介紹');
assert.ok(ignoredKeywords.includes('吃法介紹'), 'Should include 吃法介紹');
console.log(`  ✓ Loaded ${ignoredKeywords.length} ignored keywords`);

console.log('YAML Loading: ALL PASSED ✓');

// ========== 2. isIgnoredKeyword ==========
console.log('\n--- isIgnoredKeyword ---');

function testIgnored(input, expected, description) {
  const result = cfg.isIgnoredKeyword(input);
  assert.strictEqual(result, expected, `${description}: "${input}" expected ${expected} but got ${result}`);
  console.log(`  ✓ ${description}: "${input}" → ${result}`);
}

// 100% 完全比對 — 命中
testIgnored('菜單', true, 'exact match');
testIgnored('常見問題', true, 'exact match');
testIgnored('我要訂購', true, 'exact match');
testIgnored('黑羽放山雞介紹', true, 'exact match');

// 帶前後空白 → 應該 trim 後命中
testIgnored(' 菜單 ', true, 'with whitespace');
testIgnored('  菜單', true, 'leading whitespace');
testIgnored('菜單  ', true, 'trailing whitespace');
testIgnored('\t菜單\n', true, 'mixed whitespace');

// 不命中（部分包含）
testIgnored('我要看菜單', false, 'partial match (substr at end)');
testIgnored('菜單給我', false, 'partial match (substr at start)');
testIgnored('給我菜單喔', false, 'partial match (middle)');
testIgnored('菜單xxx', false, 'extra chars');
testIgnored('xxx菜單', false, 'extra chars prefix');

// 不命中（無關訊息）
testIgnored('你好', false, 'random greeting');
testIgnored('請問多少錢', false, 'normal question');
testIgnored('', false, 'empty string');
testIgnored('  ', false, 'whitespace only');

console.log('isIgnoredKeyword: ALL PASSED ✓');

// ========== 3. Open Date 邏輯 ==========
console.log('\n--- Open Date ---');

if (openDates.length > 0) {
  const firstDate = openDates[0];
  assert.strictEqual(cfg.isOpenDate(firstDate), true, `${firstDate} should be open`);
  console.log(`  ✓ isOpenDate("${firstDate}") = true`);

  assert.strictEqual(cfg.isOpenDate('1999-12-31'), false, '1999-12-31 should not be open');
  console.log(`  ✓ isOpenDate("1999-12-31") = false`);

  assert.strictEqual(cfg.isOpenDate(''), false, 'empty should not be open');
  console.log(`  ✓ isOpenDate("") = false`);

  assert.strictEqual(cfg.isOpenDate(null), false, 'null should not be open');
  console.log(`  ✓ isOpenDate(null) = false`);
}
console.log('Open Date: ALL PASSED ✓');

// ========== 4. 白名單 API ==========
console.log('\n--- Whitelist API ---');

const allowedUsers = cfg.getAllowedLineUsers();
assert.ok(Array.isArray(allowedUsers), 'allowed_line_users should be array');
console.log(`  ✓ getAllowedLineUsers() = ${JSON.stringify(allowedUsers)}`);

const blockOthers = cfg.getBlockOthers();
assert.strictEqual(typeof blockOthers, 'boolean', 'block_others should be boolean');
console.log(`  ✓ getBlockOthers() = ${blockOthers}`);

console.log('Whitelist API: ALL PASSED ✓');

// ========== 5. 手動 YAML Parser（fallback parser） ==========
console.log('\n--- Manual YAML Parser ---');

const { _parseYamlSimple } = cfg;
assert.ok(typeof _parseYamlSimple === 'function', 'Should expose _parseYamlSimple');

// 測試簡單 scalar
const r1 = _parseYamlSimple('key: value');
assert.strictEqual(r1.key, 'value', 'simple key:value');
console.log(`  ✓ simple key:value parsed`);

// 測試巢狀
const r2 = _parseYamlSimple(`parent:
  child: hello
  child2: world`);
assert.strictEqual(r2.parent.child, 'hello', 'nested child');
assert.strictEqual(r2.parent.child2, 'world', 'nested child2');
console.log(`  ✓ nested object parsed`);

// 測試 list
const r3 = _parseYamlSimple(`mylist:
  - "item1"
  - "item2"
  - "item3"`);
assert.ok(Array.isArray(r3.mylist), 'should be array');
assert.strictEqual(r3.mylist.length, 3, 'should have 3 items');
assert.strictEqual(r3.mylist[0], 'item1', 'first item');
console.log(`  ✓ list of strings parsed`);

// 測試 boolean
const r4 = _parseYamlSimple('enabled: true\ndisabled: false');
assert.strictEqual(r4.enabled, true, 'true should be boolean');
assert.strictEqual(r4.disabled, false, 'false should be boolean');
console.log(`  ✓ booleans parsed correctly`);

// 測試註解
const r5 = _parseYamlSimple('# 這是註解\nkey: value  # 行內註解');
assert.strictEqual(r5.key, 'value', 'comments should be ignored');
console.log(`  ✓ comments ignored`);

console.log('Manual YAML Parser: ALL PASSED ✓');

// ========== 6. 邊界情況 ==========
console.log('\n--- Boundary Cases ---');

// isIgnoredKeyword 對 null/undefined/非字串
assert.strictEqual(cfg.isIgnoredKeyword(null), false, 'null input should not match');
assert.strictEqual(cfg.isIgnoredKeyword(undefined), false, 'undefined input should not match');
assert.strictEqual(cfg.isIgnoredKeyword(123), false, 'number input should not match');
assert.strictEqual(cfg.isIgnoredKeyword({}), false, 'object input should not match');
console.log('  ✓ non-string inputs handled safely');

console.log('Boundary Cases: ALL PASSED ✓');

// ========== 7. config.yaml 結構 ==========
console.log('\n--- config.yaml Structure ---');

assert.ok(fs.existsSync(CONFIG_PATH), `${CONFIG_PATH} should exist`);
const content = fs.readFileSync(CONFIG_PATH, 'utf8');
assert.ok(content.includes('open_dates:'), 'config.yaml should have open_dates section');
assert.ok(content.includes('ignored_keywords:'), 'config.yaml should have ignored_keywords section');
assert.ok(content.includes('security:'), 'config.yaml should have security section');
assert.ok(content.includes('official:'), 'config.yaml should have official section');
console.log('  ✓ config.yaml structure is valid');

console.log('config.yaml Structure: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL CONFIG TESTS PASSED ✓');
console.log('========================================\n');
