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
const { calculatePrice, DELIVERY_FEE } = require('../src/rules/priceRule');

console.log('\n=== Price Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- calculatePrice: 半隻雞單一 ---');
const halfChicken = calculatePrice([{ name: '鹽水雞', quantity: 1 }]);
check('回傳 result', halfChicken && typeof halfChicken === 'object', '應有結果');
check('有 subtotal', halfChicken && typeof halfChicken.subtotal === 'number', `got ${typeof halfChicken.subtotal}`);
check('subtotal > 0', halfChicken && halfChicken.subtotal > 0, `got ${halfChicken.subtotal}`);

console.log('\n--- calculatePrice: 整隻雞 = 2 盒 ---');
const wholeChicken = calculatePrice([{ name: '鹽水雞', quantity: 2 }]);
// 一次購 2 盒 = 2 * 半隻 subtotal
check('整隻 subtotal = 半隻 * 2', wholeChicken && halfChicken && wholeChicken.chickenSubtotal === halfChicken.chickenSubtotal * 2, `got ${wholeChicken.chickenSubtotal} vs ${halfChicken.chickenSubtotal * 2}`);
check('整隻 totalBoxes = 2', wholeChicken && wholeChicken.totalBoxes === 2, `got ${wholeChicken.totalBoxes}`);

console.log('\n--- calculatePrice: 加購小菜 ---');
const withSide = calculatePrice([{ name: '鹽水雞', quantity: 1 }, { name: '小菜', quantity: 1 }]);
check('有 side_subtotal', withSide && typeof withSide.sideSubtotal === 'number', `got ${typeof withSide.sideSubtotal}`);

console.log('\n--- calculatePrice: 空訂單（邊界）---');
const empty = calculatePrice([]);
check('空訂單回傳 result', empty && typeof empty === 'object', '應有結果');
check('空訂單 subtotal = 0', empty && empty.subtotal === 0, `got ${empty.subtotal}`);

console.log('\n--- DELIVERY_FEE 常數 ---');
check('DELIVERY_FEE 是數字', typeof DELIVERY_FEE === 'number', `got ${typeof DELIVERY_FEE}`);

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
