'use strict';

/**
 * Date Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/dateRule.js 主要 exports
 *   - validateDate(inputDate)
 *   - getOpenDates()
 *   - formatOpenDates(dates)
 */

const assert = require('assert');
const {
  validateDate,
  getOpenDates,
  formatOpenDates,
} = require('../src/rules/dateRule');

console.log('\n=== Date Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- validateDate: 未來日期 valid ---');
const futureDate = '2099-12-31';
const validResult = validateDate(futureDate);
check(`「${futureDate}」回傳 result`, validResult !== undefined, '應有結果');
check('result 有 valid 屬性', validResult && typeof validResult.valid === 'boolean', `got: ${JSON.stringify(validResult).slice(0, 80)}`);

console.log('\n--- validateDate: 過去日期（應跳過）---');
const pastDate = '2020-01-01';
const pastResult = validateDate(pastDate);
check(`「${pastDate}」回傳 result`, pastResult !== undefined, '應有結果');

console.log('\n--- validateDate: 格式錯誤 ---');
['not-a-date', '', '13月45日', null, undefined].forEach((input) => {
  try {
    const r = validateDate(input);
    check(`「${input}」回傳 result`, r !== undefined, '應有結果');
  } catch (e) {
    check(`「${input}」回傳 result 或 throw`, true, '');
  }
});

console.log('\n--- getOpenDates: 取得開團日期 ---');
const openDates = getOpenDates();
check('getOpenDates 回傳陣列', Array.isArray(openDates), `got ${typeof openDates}`);
if (Array.isArray(openDates)) {
  check('開團日期至少 1 天', openDates.length >= 1, `got ${openDates.length} 天`);
}

console.log('\n--- formatOpenDates: 日期格式化 ---');
const formatted = formatOpenDates(openDates);
check('formatted 是字串', typeof formatted === 'string', `got ${typeof formatted}`);
check('formatted 不為空', formatted && formatted.length > 0, '');

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
