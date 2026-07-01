'use strict';

/**
 * Menu Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/menuRule.js 主要 exports
 *   - validateMenu(text)
 *   - parseItems(text)
 *   - calculateChickenCount(items)
 */

const assert = require('assert');
const {
  validateMenu,
  parseItems,
  calculateChickenCount,
} = require('../src/rules/menuRule');

console.log('\n=== Menu Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- validateMenu: 有效菜單輸入 ---');
const validInputs = ['鹽水雞2盒', '甘蔗煙燻雞1盒', '玉米雞3盒', '鹽水雞1盒 秘製麻辣雞胗1份'];
validInputs.forEach((input) => {
  const r = validateMenu(input);
  check(`「${input}」valid`, r && r.valid === true, `got: ${JSON.stringify(r).slice(0, 80)}`);
});

console.log('\n--- validateMenu: 無效輸入 ---');
const invalidInputs = ['', '隨便', '我想要什麼呢', null];
invalidInputs.forEach((input) => {
  const r = validateMenu(input);
  check(`「${input}」回傳 result`, r !== undefined, '應有結果');
});

console.log('\n--- parseItems: 字串解析為品項 ---');
const parseResult = parseItems('鹽水雞2盒');
check('parseItems 回傳非空', parseResult !== null && parseResult !== undefined, '應有結果');
if (parseResult && typeof parseResult === 'object') {
  check('parseItems 解析出 items', Object.keys(parseResult).length > 0, '應有 items');
}

console.log('\n--- calculateChickenCount: 雞肉盒數計算 ---');
const items = [{ name: '鹽水雞', quantity: 1 }, { name: '雞腿', quantity: 2 }];
const count = calculateChickenCount(items);
check('calculateChickenCount 回傳數字', typeof count === 'number', `got ${typeof count}`);
check('count > 0', count > 0, `got ${count}`);

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
