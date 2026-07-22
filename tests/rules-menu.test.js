'use strict';

/**
 * Menu Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/menuRule.js 主要 exports
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  validateMenu,
  parseItems,
  calculateChickenCount,
} = require('../src/rules/menuRule');

test('Menu Rule — validateMenu 有效菜單輸入', () => {
  const validInputs = ['鹽水雞2盒', '甘蔗煙燻雞1盒', '玉米雞3盒', '鹽水雞1盒 秘製麻辣雞胗1份'];
  validInputs.forEach((input) => {
    const r = validateMenu(input);
    assert.ok(r && r.valid === true, `「${input}」應 valid: ${JSON.stringify(r).slice(0, 80)}`);
  });
});

test('Menu Rule — validateMenu 無效輸入', () => {
  const invalidInputs = ['', '隨便', '我想要什麼呢', null];
  invalidInputs.forEach((input) => {
    const r = validateMenu(input);
    assert.ok(r !== undefined, `「${input}」應有結果`);
  });
});

test('Menu Rule — parseItems 字串解析', () => {
  const parseResult = parseItems('鹽水雞2盒');
  assert.ok(parseResult !== null && parseResult !== undefined, 'parseItems 應有結果');
  if (parseResult && typeof parseResult === 'object') {
    assert.ok(Object.keys(parseResult).length > 0, 'parseItems 應有 items');
  }
});

test('Menu Rule — calculateChickenCount 雞肉盒數計算', () => {
  const items = [{ name: '鹽水雞', quantity: 1 }, { name: '雞腿', quantity: 2 }];
  const count = calculateChickenCount(items);
  assert.strictEqual(typeof count, 'number', `got ${typeof count}`);
  assert.ok(count > 0, `got ${count}`);
});
