'use strict';

/**
 * Phone Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/phoneRule.js validatePhone() 行為
 */

const assert = require('assert');
const { test } = require('node:test');
const validatePhone = require('../src/rules/phoneRule');

test('Phone Rule — valid 案例', () => {
  ['0912345678', '0987654321', '0900000000'].forEach((phone) => {
    assert.strictEqual(validatePhone(phone).valid, true, `「${phone}」應 valid`);
  });
});

test('Phone Rule — invalid 案例（位數錯）', () => {
  ['091234567', '09123456789', '12345'].forEach((phone) => {
    assert.strictEqual(validatePhone(phone).valid, false, `「${phone}」應 invalid`);
  });
});

test('Phone Rule — invalid 案例（非 09 開頭）', () => {
  ['0612345678', '0812345678', '0912345678'.replace('09', '88')].forEach((phone) => {
    assert.strictEqual(validatePhone(phone).valid, false, `「${phone}」應 invalid`);
  });
});

test('Phone Rule — 消毒行為（允許空格、-、括號）', () => {
  ['0912-345-678', '0912 345 678', '(0912)345678'].forEach((phone) => {
    assert.strictEqual(validatePhone(phone).valid, true, `「${phone}」應 valid (消毒後)`);
  });
});

test('Phone Rule — 邊界（空值）', () => {
  ['', ' ', null, undefined].forEach((phone) => {
    assert.strictEqual(validatePhone(phone).valid, false, `「${phone}」應 invalid`);
  });
});
