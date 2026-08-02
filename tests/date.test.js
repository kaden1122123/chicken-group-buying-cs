'use strict';

/**
 * dateRule + timeSlotRule 完整測試（node:test 風格 · P1-3）
 *
 * 涵蓋 12+ 種時間 × 配送日 × 時段 邊界組合
 *
 * 核心規則（修補 Bug #1）：
 * - 配送日 = 今天 + 現在 13:00 後 → 不可下單
 * - 配送日 = 明天 + 現在 13:00 後 → 已過收單時間
 * - 配送日 = 明天 + 現在 14:00 後 + 上午 → 雞肉備料時間不足
 * - 配送日 = 明天 + 現在 18:00 後 + 下午 → 小菜無法追加
 */

const assert = require('assert');
const { test } = require('node:test');

const { validateDate, getNextOpenDate, getNextOrderableOpenDate, formatDateWithWeekday } = require('../src/rules/dateRule');
const { validateTimeSlotWithDate } = require('../src/rules/timeSlotRule');

const RealDate = Date;

/**
 * Mock 當前時間
 */
function mockTime(timeStr) {
  const mockNow = new RealDate(timeStr).getTime();
  function MockDate(...args) {
    if (args.length === 0) return new RealDate(mockNow);
    return new RealDate(...args);
  }
  MockDate.now = () => mockNow;
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  MockDate.prototype = RealDate.prototype;
  global.Date = MockDate;
}

/**
 * 還原真實 Date（避免污染其他 test）
 */
function restoreTime() {
  global.Date = RealDate;
}

// ═════════════════════════════════════════════════════════════════
// 1. getNextOpenDate
// ═════════════════════════════════════════════════════════════════

test('getNextOpenDate 邊界正確', () => {
  // Round 35 C4：open_dates 只剩 2026-08-04 / 08-07（清掉 past dates 後）
  assert.strictEqual(getNextOpenDate('2026-07-31'), '2026-08-04', '2026-07-31 應該推薦 2026-08-04');
  assert.strictEqual(getNextOpenDate('2026-08-04'), '2026-08-04', '2026-08-04 當天應回傳自己');
  assert.strictEqual(getNextOpenDate('2026-08-05'), '2026-08-07', '2026-08-05 應推薦 2026-08-07');
  assert.strictEqual(getNextOpenDate('2026-08-08'), null, '2026-08-08 應回 null（已過最後開團日）');
  assert.strictEqual(getNextOpenDate('2026-08-01'), '2026-08-04', '2026-08-01 應推薦 2026-08-04');
  assert.strictEqual(getNextOpenDate('2099-12-31'), null, '2099 之後無開團日');
});

// ═════════════════════════════════════════════════════════════════
// 2. formatDateWithWeekday
// ═════════════════════════════════════════════════════════════════

test('formatDateWithWeekday 7 個星期都正確', () => {
  assert.strictEqual(formatDateWithWeekday('2026-06-14'), '2026-06-14（週日）');
  assert.strictEqual(formatDateWithWeekday('2026-06-15'), '2026-06-15（週一）');
  assert.strictEqual(formatDateWithWeekday('2026-06-16'), '2026-06-16（週二）');
  assert.strictEqual(formatDateWithWeekday('2026-06-17'), '2026-06-17（週三）');
  assert.strictEqual(formatDateWithWeekday('2026-06-18'), '2026-06-18（週四）');
  assert.strictEqual(formatDateWithWeekday('2026-06-19'), '2026-06-19（週五）');
  assert.strictEqual(formatDateWithWeekday('2026-06-20'), '2026-06-20（週六）');
});

// ═════════════════════════════════════════════════════════════════
// 3. getNextOrderableOpenDate
// ═════════════════════════════════════════════════════════════════

test('getNextOrderableOpenDate 根據現在時間推薦可訂購日期', () => {
  // Round 35 C4：open_dates 只剩 2026-08-04 / 08-07
  mockTime('2026-08-03T10:00:00+08:00'); // 配送前一日 10:00
  assert.strictEqual(getNextOrderableOpenDate(), '2026-08-04', '配送前一日 10:00 應推薦 2026-08-04');

  mockTime('2026-08-03T14:00:00+08:00'); // 配送前一日 14:00（已過 2026-08-04 收單）
  assert.strictEqual(getNextOrderableOpenDate(), '2026-08-07', '配送前一日 14:00 應跳過 2026-08-04 推薦 2026-08-07');

  mockTime('2026-08-03T20:00:00+08:00'); // 配送前一日晚上
  assert.strictEqual(getNextOrderableOpenDate(), '2026-08-07', '配送前一日 20:00 應跳過 2026-08-04 推薦 2026-08-07');

  restoreTime();
});

// ═════════════════════════════════════════════════════════════════
// 4. validateDate 12 種情境
// ═════════════════════════════════════════════════════════════════

test('validateDate 12 種情境', () => {
  function testValidateDate(time, date, expectedValid, expectedErrorType, description) {
    mockTime(time);
    const r = validateDate(date);
    assert.strictEqual(r.valid, expectedValid, `${description}: expected valid=${expectedValid}, got ${r.valid} (errorType=${r.errorType})`);
    if (!expectedValid && expectedErrorType) {
      assert.strictEqual(r.errorType, expectedErrorType, `${description}: expected errorType=${expectedErrorType}, got ${r.errorType}`);
    }
    if (!expectedValid) {
      assert.ok(r.suggestedDate, `${description}: should provide suggestedDate`);
    }
  }

  // Round 35 C4：open_dates 只剩 2026-08-04 / 08-07
  // 場景 1: 配送日 = 今天，現在 13:00 前（但仍是配送前一日之後的時段）
  testValidateDate('2026-08-04T10:00:00+08:00', '2026-08-04', false, 'past_order_cutoff', '今天 10:00 + 今天配送');
  // 場景 2: 配送日 = 今天，現在 13:00 後
  testValidateDate('2026-08-04T15:00:00+08:00', '2026-08-04', false, 'past_cutoff_today', '今天 15:00 + 今天配送');
  testValidateDate('2026-08-04T20:00:00+08:00', '2026-08-04', false, 'past_cutoff_today', '今天 20:00 + 今天配送');
  // 場景 3: 配送日 = 明天，現在 < 13:00
  testValidateDate('2026-08-03T10:00:00+08:00', '2026-08-04', true, null, '配送前一日 10:00 + 明天配送');
  testValidateDate('2026-08-03T12:30:00+08:00', '2026-08-04', true, null, '配送前一日 12:30 + 明天配送');
  // 場景 4: 配送日 = 明天，現在 13:00 後
  testValidateDate('2026-08-03T13:30:00+08:00', '2026-08-04', false, 'past_order_cutoff', '配送前一日 13:30 + 明天配送');
  testValidateDate('2026-08-03T15:00:00+08:00', '2026-08-04', false, 'past_order_cutoff', '配送前一日 15:00 + 明天配送');
  testValidateDate('2026-08-03T19:00:00+08:00', '2026-08-04', false, 'past_order_cutoff', '配送前一日 19:00 + 明天配送');
  // 場景 5: 配送日 = 後天或之後
  testValidateDate('2026-08-03T20:00:00+08:00', '2026-08-07', true, null, '配送前 4 日 20:00 + 後天配送');
  testValidateDate('2026-08-01T20:00:00+08:00', '2026-08-07', true, null, '配送前 6 日 20:00 + 後天配送');
  // 場景 6: 非開團日
  testValidateDate('2026-08-03T10:00:00+08:00', '2026-08-05', false, 'not_open_date', '非開團日（2026-08-05）');
  // 場景 7: 格式錯誤
  testValidateDate('2026-06-14T10:00:00+08:00', 'invalid-date', false, 'invalid_format', '格式錯誤');
  // 場景 8: 缺失
  testValidateDate('2026-06-14T10:00:00+08:00', null, false, 'missing', '缺失');

  restoreTime();
});

// ═════════════════════════════════════════════════════════════════
// 5. validateTimeSlotWithDate
// ═════════════════════════════════════════════════════════════════

test('validateTimeSlotWithDate 各種時段 × 時間組合', () => {
  function testTimeSlotWithDate(time, date, slot, expectedValid, expectedErrorType, description) {
    mockTime(time);
    const r = validateTimeSlotWithDate(date, slot);
    assert.strictEqual(r.valid, expectedValid, `${description}: expected valid=${expectedValid}, got ${r.valid} (errorType=${r.errorType})`);
    if (!expectedValid && expectedErrorType) {
      assert.strictEqual(r.errorType, expectedErrorType, `${description}: expected errorType=${expectedErrorType}, got ${r.errorType}`);
    }
  }

  // 場景 A: 配送日 = 今天
  testTimeSlotWithDate('2026-06-16T10:00:00+08:00', '2026-06-16', '上午', false, 'past_order_cutoff', '今天 10:00 + 今天配送 + 上午');
  testTimeSlotWithDate('2026-06-16T15:00:00+08:00', '2026-06-16', '上午', false, 'past_cutoff_today', '今天 15:00 + 今天配送 + 上午');
  testTimeSlotWithDate('2026-06-16T15:00:00+08:00', '2026-06-16', '下午', false, 'past_cutoff_today', '今天 15:00 + 今天配送 + 下午');
  testTimeSlotWithDate('2026-06-16T20:00:00+08:00', '2026-06-16', '下午', false, 'past_cutoff_today', '今天 20:00 + 今天配送 + 下午');

  // 場景 B: 配送日 = 明天，現在 < 13:00
  testTimeSlotWithDate('2026-06-15T10:00:00+08:00', '2026-06-16', '上午', true, null, '配送前一日 10:00 + 明天配送 + 上午');
  testTimeSlotWithDate('2026-06-15T10:00:00+08:00', '2026-06-16', '下午', true, null, '配送前一日 10:00 + 明天配送 + 下午');

  // 場景 C: 配送日 = 明天，現在 13:00-14:00（過了收單時間）
  testTimeSlotWithDate('2026-06-15T13:30:00+08:00', '2026-06-16', '上午', false, 'past_order_cutoff', '配送前一日 13:30 + 明天配送 + 上午');
  testTimeSlotWithDate('2026-06-15T13:30:00+08:00', '2026-06-16', '下午', false, 'past_order_cutoff', '配送前一日 13:30 + 明天配送 + 下午');

  // 場景 D: 配送日 = 明天，現在 14:00-18:00（雞肉已不能追加）
  testTimeSlotWithDate('2026-06-15T15:00:00+08:00', '2026-06-16', '上午', false, 'past_order_cutoff', '配送前一日 15:00 + 明天配送 + 上午');
  testTimeSlotWithDate('2026-06-15T15:00:00+08:00', '2026-06-16', '下午', false, 'past_order_cutoff', '配送前一日 15:00 + 明天配送 + 下午');

  // 場景 E: 配送日 = 明天，現在 >= 18:00
  testTimeSlotWithDate('2026-06-15T19:00:00+08:00', '2026-06-16', '下午', false, 'past_order_cutoff', '配送前一日 19:00 + 明天配送 + 下午');

  // 場景 F: 配送日 = 後天或之後
  testTimeSlotWithDate('2026-06-15T20:00:00+08:00', '2026-06-18', '上午', true, null, '配送前 3 日 20:00 + 後天配送 + 上午');
  testTimeSlotWithDate('2026-06-15T20:00:00+08:00', '2026-06-18', '下午', true, null, '配送前 3 日 20:00 + 後天配送 + 下午');

  // 場景 G: 時段本身不合法
  testTimeSlotWithDate('2026-06-15T10:00:00+08:00', '2026-06-18', '晚上', false, 'invalid_slot', '不合法時段（晚上）');

  // 場景 H: 指定精準時間（valid 但有 warning）
  testTimeSlotWithDate('2026-06-15T10:00:00+08:00', '2026-06-18', '10:30', true, null, '指定時間 10:30（warning）');
  assert.strictEqual(validateTimeSlotWithDate('2026-06-18', '10:30').warning, true, '指定時間應有 warning');

  restoreTime();
});

// ═════════════════════════════════════════════════════════════════
// 6. 改進的錯誤訊息（突出下一個開團日）
// ═════════════════════════════════════════════════════════════════

test('錯誤訊息突出下一個開團日（Round 31 P0.3 變更格式）', () => {
  // Round 35 C4：open_dates 只剩 2026-08-04 / 08-07
  mockTime('2026-08-03T21:00:00+08:00');
  const r1 = validateDate('2026-08-05'); // 非開團日
  // mock 2026-08-03 21:00（已過 8/4 收單 13:00）→ getNextOrderableOpenDate 推薦 8/7
  assert.ok(r1.errorMessage.includes('下次可下單日期是 2026-08-07（週五）'), '應突出下一個可下單日期（已過 8/4 收單，推薦 8/7）');
  assert.ok(r1.errorMessage.includes('您要改訂這天嗎？'), '應有引導語');
  // Round 33 Bug 2 (Hubert 11:55)：改用未來兩週（14 天）開團日
  assert.ok(r1.errorMessage.includes('未來兩週開團日：'), '應列出未來兩週開團日');
  assert.ok(!r1.errorMessage.includes('本月開團日期：'), '不應再列整個本月開團日清單（Hubert 12:33 要修）');

  const r2 = validateDate('2026-08-04'); // 配送前一日 21:00 → 過了收單
  assert.ok(r2.errorMessage.includes('下次可下單日期是 2026-08-07（週五）'), '應突出下一個可下單日期');

  mockTime('2026-08-04T20:00:00+08:00');
  const r3 = validateDate('2026-08-04'); // 今天 + 20:00
  assert.ok(r3.errorMessage.includes('下次可下單日期是 2026-08-07'), 'past_cutoff_today 應突出下一個可下單日期');

  const r4 = validateDate('2026-09-15'); // 跨月
  assert.ok(r4.errorMessage.includes('不是本月的開團日'), 'not_this_month 應清楚說明');

  restoreTime();
});

test('錯誤訊息只列未來兩週開團日（Round 33 Bug 2）', () => {
  // Round 35 C4：open_dates 只剩 2026-08-04 / 08-07
  mockTime('2026-08-03T21:00:00+08:00');
  // 今天 2026-08-03 → 未來 14 天 = 2026-08-17 截止
  // 過濾後的 upcoming 包含 2026-08-04（週二）、2026-08-07（週五）
  const r = validateDate('2026-08-05');
  // Round 33 Bug 2 (Hubert 11:55)：未來兩週（含這週 + 下週 = 14 天）
  const upcomingMatch = r.errorMessage.match(/未來兩週開團日：(.+?)。/);
  assert.ok(upcomingMatch, '應有「未來兩週開團日：」段');
  const upcomingDates = upcomingMatch[1].split('、');
  assert.ok(upcomingDates.length >= 1, `至少 1 個開團日，實際 ${upcomingDates.length} 個：${upcomingMatch[1]}`);
  // 應過濾掉過去日期
  assert.ok(!upcomingMatch[1].startsWith('2026-08-02'), '不應包含今天之前的日期');
  assert.ok(upcomingDates[0].includes('週'), `每個日期應含 weekday：${upcomingDates[0]}`);
  restoreTime();
});

test('buildErrorMessage fallback 邏輯（Round 33 Bug 2：未來兩週）', () => {
  // Round 33 Bug 2 (Hubert 11:55)：改用「未來兩週」字串
  const buildHint = (upcoming) => upcoming
    ? `未來兩週開團日：${upcoming}。`
    : '未來兩週沒有開團日。';
  assert.strictEqual(buildHint(''), '未來兩週沒有開團日。', '空 upcoming 應回 fallback');
  assert.strictEqual(buildHint('2026-08-04（週二）、2026-08-07（週四）'), '未來兩週開團日：2026-08-04（週二）、2026-08-07（週四）。', '非空 upcoming 應列出');
});
