'use strict';

/**
 * P1-3: menuRule.parseItems 去重驗證測試
 */

const assert = require('assert');
const { test } = require('node:test');

const { parseItems, validateMenu } = require('../src/rules/menuRule');

test('兩個 pattern 對同一輸入去重', () => {
  const r1 = parseItems('鹽水雞x2、甘蔗煙燻雞1');
  assert.strictEqual(r1.length, 2, '應只有 2 個 items, 無重複');
  assert.ok(r1.some((it) => it.name === '鹽水雞' && it.quantity === 2));
  assert.ok(r1.some((it) => it.name === '甘蔗煙燻雞' && it.quantity === 1));
});

test('空格+數字 格式', () => {
  const r2 = parseItems('鹽水雞 2');
  assert.strictEqual(r2.length, 1);
  assert.strictEqual(r2[0].name, '鹽水雞');
  assert.strictEqual(r2[0].quantity, 2);

  const r2b = parseItems('鹽水雞 2盒');
  assert.strictEqual(r2b.length, 1);
  assert.strictEqual(r2b[0].quantity, 2);
});

test('同品項不同數量保留', () => {
  const r3 = parseItems('鹽水雞x2 鹽水雞x3');
  assert.strictEqual(r3.length, 2);
  assert.ok(r3.some((it) => it.name === '鹽水雞' && it.quantity === 2));
  assert.ok(r3.some((it) => it.name === '鹽水雞' && it.quantity === 3));

  const r3b = parseItems('鹽水雞 1 鹽水雞 2');
  assert.strictEqual(r3b.length, 2);
});

test('三品項混合無重複', () => {
  const r4 = parseItems('鹽水雞x2、甘蔗煙燻雞1、秘製黑胡椒蒜味毛豆 3');
  assert.strictEqual(r4.length, 3, '應有 3 個 items');
});

test('validateMenu 既有行為 — 有效/無效品項', () => {
  function testMenu(input, expectedValid) {
    const result = validateMenu(input);
    assert.strictEqual(result.valid, expectedValid, `「${input}」應 ${expectedValid ? 'VALID' : 'INVALID'}`);
  }

  testMenu('鹽水雞2', true);
  testMenu('甘蔗煙燻雞 1', true);
  testMenu('秘製黑胡椒蒜味毛豆 2', true);
  testMenu('鹽水雞x2、甘蔗煙燻雞1', true);
  testMenu('玉米雞', true);
  testMenu('土雞', true);
  testMenu('雞脖子5', true);
  testMenu('珍珠奶茶', false);
  testMenu('炸雞排', false);
  testMenu('', false);
});
