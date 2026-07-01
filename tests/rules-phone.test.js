'use strict';

/**
 * Phone Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/phoneRule.js validatePhone() 行為
 *
 * 覆蓋：
 * - valid 案例（10 位 09 開頭）
 * - invalid 案例（非 10 位 / 非 09 開頭 / 空字串）
 * - 消毒行為（允許空格、-、()）
 */

const assert = require('assert');
const validatePhone = require('../src/rules/phoneRule');

console.log('\n=== Phone Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- valid 案例 ---');
['0912345678', '0987654321', '0900000000'].forEach((phone) => {
  const r = validatePhone(phone);
  check(`「${phone}」valid`, r.valid === true, `got valid=${r.valid}`);
});

console.log('\n--- invalid 案例（位數錯）---');
['091234567', '09123456789', '12345'].forEach((phone) => {
  const r = validatePhone(phone);
  check(`「${phone}」invalid`, r.valid === false, `got valid=${r.valid}`);
});

console.log('\n--- invalid 案例（非 09 開頭）---');
['0612345678', '0812345678', '0912345678'.replace('09', '88')].forEach((phone) => {
  const r = validatePhone(phone);
  check(`「${phone}」invalid`, r.valid === false, `got valid=${r.valid}`);
});

console.log('\n--- 消毒行為（允許空格、-、括號）---');
['0912-345-678', '0912 345 678', '(0912)345678'].forEach((phone) => {
  const r = validatePhone(phone);
  check(`「${phone}」valid (消毒後)`, r.valid === true, `got valid=${r.valid}`);
});

console.log('\n--- 邊界（空值）---');
['', ' ', null, undefined].forEach((phone) => {
  const r = validatePhone(phone);
  check(`「${phone}」invalid`, r.valid === false, `應回傳錯誤訊息`);
});

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
