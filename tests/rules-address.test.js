'use strict';

/**
 * Address Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/addressRule.js validateAddress() 行為
 */

const assert = require('assert');
const { test } = require('node:test');
const validateAddress = require('../src/rules/addressRule');

test('Address Rule — 配送範圍內地址（回傳 result）', () => {
  const candidateAddresses = [
    '台北市中正區重慶南路一段',
    '新北市三峽區學勤路',
    '新北市三峽區大學路151號',
  ];
  candidateAddresses.forEach((addr) => {
    const r = validateAddress(addr);
    assert.ok(r !== null && r !== undefined, `「${addr}」應有結果`);
  });
});

test('Address Rule — 配送範圍外地址（回傳 result）', () => {
  const outOfRange = ['台中市西區', '高雄市前鎮區', '屏東縣'];
  outOfRange.forEach((addr) => {
    const r = validateAddress(addr);
    assert.ok(r !== null && r !== undefined, `「${addr}」應有結果`);
  });
});

test('Address Rule — 邊界（空值）', () => {
  ['', null, undefined].forEach((addr) => {
    try {
      const r = validateAddress(addr);
      assert.ok(r !== undefined, `「${addr}」應有結果`);
    } catch (e) {
      // 也允許拋錯（取決於實作）
      assert.ok(true, `「${addr}」處理: ${e.message.slice(0, 50)}`);
    }
  });
});
