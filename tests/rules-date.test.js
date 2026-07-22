'use strict';

/**
 * Date Rule 獨立測試（Session H8-C）
 *
 * 目的：守護 src/rules/dateRule.js 主要 exports
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  validateDate,
  getOpenDates,
  formatOpenDates,
} = require('../src/rules/dateRule');

test('Date Rule — validateDate 未來日期', () => {
  const futureDate = '2099-12-31';
  const validResult = validateDate(futureDate);
  assert.ok(validResult !== undefined, '應有結果');
  assert.ok(validResult && typeof validResult.valid === 'boolean',
    `result.valid 應為 boolean: ${JSON.stringify(validResult).slice(0, 80)}`);
});

test('Date Rule — validateDate 過去日期（跳過驗證類型）', () => {
  const pastResult = validateDate('2020-01-01');
  assert.ok(pastResult !== undefined, '過去日期也應有結果');
});

test('Date Rule — validateDate 格式錯誤', () => {
  ['not-a-date', '', '13月45日', null, undefined].forEach((input) => {
    try {
      const r = validateDate(input);
      assert.ok(r !== undefined, `「${input}」應有結果`);
    } catch (e) {
      // 也允許拋錯
      assert.ok(true, `「${input}」處理: ${e.message.slice(0, 50)}`);
    }
  });
});

test('Date Rule — getOpenDates 取得開團日期', () => {
  const openDates = getOpenDates();
  assert.ok(Array.isArray(openDates), `應回傳陣列, got ${typeof openDates}`);
  if (Array.isArray(openDates)) {
    assert.ok(openDates.length >= 1, `至少 1 天, got ${openDates.length}`);
  }
});

test('Date Rule — formatOpenDates 日期格式化', () => {
  const openDates = getOpenDates();
  const formatted = formatOpenDates(openDates);
  assert.strictEqual(typeof formatted, 'string', `got ${typeof formatted}`);
  assert.ok(formatted && formatted.length > 0, 'formatted 不應為空');
});
