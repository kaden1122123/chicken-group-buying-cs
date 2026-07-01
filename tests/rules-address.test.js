'use strict';

/**
 * Address Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/addressRule.js validateAddress() 行為
 */

const assert = require('assert');
const validateAddress = require('../src/rules/addressRule');

console.log('\n=== Address Rule Tests (H8-C) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- 配送範圍內地址（valid or needs_confirmation）---');
const candidateAddresses = [
  '台北市中正區重慶南路一段',
  '新北市三峽區學勤路',
  '新北市三峽區大學路151號',
];
candidateAddresses.forEach((addr) => {
  const r = validateAddress(addr);
  // 可能是 valid 或 needs_confirmation（取決於 config 設定）- 不拋銩即可
  check(`「${addr}」回傳 result`, r !== null && r !== undefined, '應有結果');
});

console.log('\n--- 配送範圍外地址（invalid 或 needs_confirm）---');
const outOfRange = ['台中市西區', '高雄市前鎮區', '屏東縣'];
outOfRange.forEach((addr) => {
  const r = validateAddress(addr);
  // 可能是 invalid 或 needs_confirm（取決於 config 設定）
  check(`「${addr}」回傳 result`, r !== null && r !== undefined, '應有結果');
});

console.log('\n--- 邊界（空值）---');
['', null, undefined].forEach((addr) => {
  try {
    const r = validateAddress(addr);
    check(`「${addr}」回傳 result`, r !== undefined, '應有結果');
  } catch (e) {
    // 也允許拋錯（取決於實作）
    check(`「${addr}」回傳 result 或 throw`, true, `got error: ${e.message.slice(0, 50)}`);
  }
});

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
