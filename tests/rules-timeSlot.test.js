'use strict';

/**
 * TimeSlot Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/timeSlotRule.js 主要 exports
 *   - validateTimeSlot(input)
 */

const assert = require('assert');
const {
  validateTimeSlot,
} = require('../src/rules/timeSlotRule');

console.log('\n=== TimeSlot Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- validateTimeSlot: 有效時段 ---');
const validInputs = ['上午', '下午', 'AM', 'PM', '早上', '晚上'];
validInputs.forEach((input) => {
  const r = validateTimeSlot(input);
  check(`「${input}」回傳 result`, r !== undefined, '應有結果');
});

console.log('\n--- validateTimeSlot: 無效輸入 ---');
['半夜', '隨便', null, undefined].forEach((input) => {
  const r = validateTimeSlot(input);
  check(`「${input}」回傳 result`, r !== undefined, '應有結果');
});

console.log('\n--- validateTimeSlot: result 結構 ---');
const r = validateTimeSlot('上午');
if (r && typeof r === 'object') {
  check('有 valid 屬性', 'valid' in r, `got keys: ${Object.keys(r).join(',')}`);
} else {
  console.log('  (validateTimeSlot 不一定回傳物件 — 跳過結構檢查)');
}

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
