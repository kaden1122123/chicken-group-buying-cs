'use strict';

/**
 * Price Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/priceRule.js calculatePrice() 行為
 *   - 整隻雞 = 2 盒（Hubert 指示）
 *   - 半隻雞 = 1 盒
 *   - 小菜 + 運費 計算
 */

const assert = require('assert');
const { test } = require('node:test');
const { calculatePrice, DELIVERY_FEE } = require('../src/rules/priceRule');

test('Price Rule — 半隻雞單一', () => {
  const halfChicken = calculatePrice([{ name: '鹽水雞', quantity: 1 }]);
  assert.ok(halfChicken && typeof halfChicken === 'object', '應有結果');
  assert.ok(halfChicken && typeof halfChicken.subtotal === 'number', `subtotal 應為 number, got ${typeof halfChicken.subtotal}`);
  assert.ok(halfChicken && halfChicken.subtotal > 0, `subtotal > 0, got ${halfChicken.subtotal}`);
});

test('Price Rule — 整隻雞 = 2 盒', () => {
  const halfChicken = calculatePrice([{ name: '鹽水雞', quantity: 1 }]);
  const wholeChicken = calculatePrice([{ name: '鹽水雞', quantity: 2 }]);
  assert.ok(wholeChicken && halfChicken && wholeChicken.chickenSubtotal === halfChicken.chickenSubtotal * 2,
    `整隻 subtotal = 半隻 * 2, got ${wholeChicken.chickenSubtotal} vs ${halfChicken.chickenSubtotal * 2}`);
  assert.ok(wholeChicken && wholeChicken.totalBoxes === 2, `整隻 totalBoxes = 2, got ${wholeChicken.totalBoxes}`);
});

test('Price Rule — 加購小菜', () => {
  const withSide = calculatePrice([{ name: '鹽水雞', quantity: 1 }, { name: '小菜', quantity: 1 }]);
  assert.ok(withSide && typeof withSide.sideSubtotal === 'number', `side_subtotal 應為 number, got ${typeof withSide.sideSubtotal}`);
});

test('Price Rule — 空訂單（邊界）', () => {
  const empty = calculatePrice([]);
  assert.ok(empty && typeof empty === 'object', '空訂單應有結果');
  assert.ok(empty && empty.subtotal === 0, `空訂單 subtotal = 0, got ${empty.subtotal}`);
});

test('Price Rule — DELIVERY_FEE 常數', () => {
  assert.strictEqual(typeof DELIVERY_FEE, 'number', `got ${typeof DELIVERY_FEE}`);
});
