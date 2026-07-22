'use strict';

/**
 * config.js 單元測試
 * 測試範圍：YAML loader + isIgnoredKeyword + 邊界情況
 */

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

let cfg;
try {
  cfg = require('../src/config');
} catch (e) {
  console.error('Failed to load config:', e);
  process.exit(1);
}

test('1. YAML 載入 — parser + openDates + ignoredKeywords + Bug #1 fix', () => {
  assert.ok(cfg._yamlParser, 'Should have _yamlParser field');
  assert.ok(['js-yaml', 'fallback'].includes(cfg._yamlParser), `Parser should be js-yaml or fallback, got: ${cfg._yamlParser}`);

  const openDates = cfg.getOpenDates();
  assert.ok(Array.isArray(openDates), 'openDates should be array');
  assert.ok(openDates.length > 0, 'openDates should not be empty');
  for (const d of openDates) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d), `Date format should be YYYY-MM-DD, got: ${d}`);
  }

  const ignoredKeywords = cfg.getIgnoredKeywords();
  assert.ok(Array.isArray(ignoredKeywords), 'ignoredKeywords should be array');
  // Session Q 修整（2026-06-30）：「菜單」從 ignored_keywords 移除
  assert.ok(!ignoredKeywords.includes('菜單'), '菜單 應已從 ignored_keywords 移除');
  assert.ok(ignoredKeywords.includes('常見問題'), 'Should include 常見問題');
  // Bug #1 fix (2026-07-20):「我要訂購」從 ignored_keywords 移除
  assert.ok(!ignoredKeywords.includes('我要訂購'), 'Bug #1 fix: 我要訂購 不應再在 ignored_keywords');
  assert.ok(ignoredKeywords.includes('黑羽放山雞介紹'), 'Should include 黑羽放山雞介紹');
  assert.ok(ignoredKeywords.includes('蔥鹽醬介紹'), 'Should include 蔥鹽醬介紹');
  assert.ok(ignoredKeywords.includes('吃法介紹'), 'Should include 吃法介紹');
});

test('2. isIgnoredKeyword — exact match + whitespace + partial', () => {
  // 100% 完全比對 — 命中
  assert.strictEqual(cfg.isIgnoredKeyword('常見問題'), true);
  // Bug #1 fix (2026-07-20): 我要訂購 不再被攔截
  assert.strictEqual(cfg.isIgnoredKeyword('我要訂購'), false, 'B01 fix: 我要訂購 不再被攔截');
  assert.strictEqual(cfg.isIgnoredKeyword('黑羽放山雞介紹'), true);

  // 帶前後空白 → 應該 trim 後命中
  assert.strictEqual(cfg.isIgnoredKeyword(' 常見問題 '), true);
  assert.strictEqual(cfg.isIgnoredKeyword('  常見問題'), true);
  assert.strictEqual(cfg.isIgnoredKeyword('常見問題  '), true);
  assert.strictEqual(cfg.isIgnoredKeyword('\t常見問題\n'), true);

  // 不命中（部分包含）
  assert.strictEqual(cfg.isIgnoredKeyword('我要看常見問題'), false);
  assert.strictEqual(cfg.isIgnoredKeyword('常見問題給我'), false);
  assert.strictEqual(cfg.isIgnoredKeyword('給我常見問題喔'), false);
  assert.strictEqual(cfg.isIgnoredKeyword('常見問題xxx'), false);
  assert.strictEqual(cfg.isIgnoredKeyword('xxx常見問題'), false);

  // Session Q：菜單現在 NOT-ignored
  assert.strictEqual(cfg.isIgnoredKeyword('菜單'), false, '菜單 已被 LLM 接手');
  assert.strictEqual(cfg.isIgnoredKeyword('我要看菜單'), false);

  // 不命中（無關訊息）
  assert.strictEqual(cfg.isIgnoredKeyword('你好'), false);
  assert.strictEqual(cfg.isIgnoredKeyword('請問多少錢'), false);
  assert.strictEqual(cfg.isIgnoredKeyword(''), false);
  assert.strictEqual(cfg.isIgnoredKeyword('  '), false);
});

test('3. Open Date 邏輯', () => {
  const openDates = cfg.getOpenDates();
  if (openDates.length > 0) {
    const firstDate = openDates[0];
    assert.strictEqual(cfg.isOpenDate(firstDate), true, `${firstDate} should be open`);
    assert.strictEqual(cfg.isOpenDate('1999-12-31'), false, '1999-12-31 should not be open');
    assert.strictEqual(cfg.isOpenDate(''), false, 'empty should not be open');
    assert.strictEqual(cfg.isOpenDate(null), false, 'null should not be open');
  }
});

test('4. 白名單 API', () => {
  const allowedUsers = cfg.getAllowedLineUsers();
  assert.ok(Array.isArray(allowedUsers), 'allowed_line_users should be array');

  const blockOthers = cfg.getBlockOthers();
  assert.strictEqual(typeof blockOthers, 'boolean', 'block_others should be boolean');
});

test('5. 手動 YAML Parser（fallback parser）— simple / nested / list / bool / comment', () => {
  const { _parseYamlSimple } = cfg;
  assert.ok(typeof _parseYamlSimple === 'function', 'Should expose _parseYamlSimple');

  // 測試簡單 scalar
  const r1 = _parseYamlSimple('key: value');
  assert.strictEqual(r1.key, 'value');

  // 測試巢狀
  const r2 = _parseYamlSimple(`parent:
  child: hello
  child2: world`);
  assert.strictEqual(r2.parent.child, 'hello');
  assert.strictEqual(r2.parent.child2, 'world');

  // 測試 list
  const r3 = _parseYamlSimple(`mylist:
  - "item1"
  - "item2"
  - "item3"`);
  assert.ok(Array.isArray(r3.mylist));
  assert.strictEqual(r3.mylist.length, 3);
  assert.strictEqual(r3.mylist[0], 'item1');

  // 測試 boolean
  const r4 = _parseYamlSimple('enabled: true\ndisabled: false');
  assert.strictEqual(r4.enabled, true);
  assert.strictEqual(r4.disabled, false);

  // 測試註解
  const r5 = _parseYamlSimple('# 這是註解\nkey: value  # 行內註解');
  assert.strictEqual(r5.key, 'value');
});

test('6. 邊界情況 — null/undefined/非字串 isIgnoredKeyword', () => {
  assert.strictEqual(cfg.isIgnoredKeyword(null), false);
  assert.strictEqual(cfg.isIgnoredKeyword(undefined), false);
  assert.strictEqual(cfg.isIgnoredKeyword(123), false);
  assert.strictEqual(cfg.isIgnoredKeyword({}), false);
});

test('7. config.yaml 結構', () => {
  assert.ok(fs.existsSync(CONFIG_PATH), `${CONFIG_PATH} should exist`);
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  assert.ok(content.includes('open_dates:'), 'config.yaml should have open_dates section');
  assert.ok(content.includes('ignored_keywords:'), 'config.yaml should have ignored_keywords section');
  assert.ok(content.includes('security:'), 'config.yaml should have security section');
  assert.ok(content.includes('official:'), 'config.yaml should have official section');
});
