'use strict';

/**
 * dateRule + timeSlotRule 完整測試
 * 涵蓋 12+ 種時間 × 配送日 × 時段 邊界組合
 *
 * 核心規則（修補 Bug #1）：
 * - 配送日 = 今天 + 現在 13:00 後 → 不可下單
 * - 配送日 = 明天 + 現在 13:00 後 → 已過收單時間
 * - 配送日 = 明天 + 現在 14:00 後 + 上午 → 雞肉備料時間不足
 * - 配送日 = 明天 + 現在 18:00 後 + 下午 → 小菜無法追加
 */

const assert = require('assert');
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

console.log('\n=== Date Rule Tests ===');

// ========== 1. getNextOpenDate ==========
console.log('\n--- getNextOpenDate ---');

assert.strictEqual(getNextOpenDate('2026-06-14'), '2026-06-16', '2026-06-14 應該推薦 2026-06-16');
assert.strictEqual(getNextOpenDate('2026-06-16'), '2026-06-16', '2026-06-16 當天應回傳自己');
assert.strictEqual(getNextOpenDate('2026-06-17'), '2026-06-18', '2026-06-17 應推薦 2026-06-18');
assert.strictEqual(getNextOpenDate('2026-06-20'), '2026-06-23', '2026-06-20 應推薦 2026-06-23');
assert.strictEqual(getNextOpenDate('2026-07-01'), '2026-07-21', '2026-07-01 應推薦最近開團日 2026-07-21');
assert.strictEqual(getNextOpenDate('2099-12-31'), null, '2099 之後無開團日');
console.log('  ✓ getNextOpenDate 邊界正確');

console.log('getNextOpenDate: ALL PASSED ✓');

// ========== 2. formatDateWithWeekday ==========
console.log('\n--- formatDateWithWeekday ---');

assert.strictEqual(formatDateWithWeekday('2026-06-14'), '2026-06-14（週日）');
assert.strictEqual(formatDateWithWeekday('2026-06-15'), '2026-06-15（週一）');
assert.strictEqual(formatDateWithWeekday('2026-06-16'), '2026-06-16（週二）');
assert.strictEqual(formatDateWithWeekday('2026-06-17'), '2026-06-17（週三）');
assert.strictEqual(formatDateWithWeekday('2026-06-18'), '2026-06-18（週四）');
assert.strictEqual(formatDateWithWeekday('2026-06-19'), '2026-06-19（週五）');
assert.strictEqual(formatDateWithWeekday('2026-06-20'), '2026-06-20（週六）');
console.log('  ✓ 7 個星期都正確');

console.log('formatDateWithWeekday: ALL PASSED ✓');

// ========== 3. getNextOrderableOpenDate ==========
console.log('\n--- getNextOrderableOpenDate ---');

mockTime('2026-06-15T10:00:00+08:00'); // 配送前一日 10:00
assert.strictEqual(getNextOrderableOpenDate(), '2026-06-16', '配送前一日 10:00 應推薦 2026-06-16');
console.log('  ✓ 配送前一日 10:00 → 推薦 2026-06-16');

mockTime('2026-06-15T14:00:00+08:00'); // 配送前一日 14:00（已過 2026-06-16 收單）
assert.strictEqual(getNextOrderableOpenDate(), '2026-06-18', '配送前一日 14:00 應跳過 2026-06-16 推薦 2026-06-18');
console.log('  ✓ 配送前一日 14:00 → 推薦 2026-06-18（跳過已收單）');

mockTime('2026-06-15T20:00:00+08:00'); // 配送前一日晚上
assert.strictEqual(getNextOrderableOpenDate(), '2026-06-18', '配送前一日 20:00 應跳過 2026-06-16 推薦 2026-06-18');
console.log('  ✓ 配送前一日 20:00 → 推薦 2026-06-18');

console.log('getNextOrderableOpenDate: ALL PASSED ✓');

// ========== 4. validateDate 12 種情境 ==========
console.log('\n--- validateDate 12 種情境 ---');

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
  console.log(`  ${expectedValid ? '✅' : '❌'} ${description}`);
}

// 場景 1: 配送日 = 今天，現在 13:00 前（但仍是配送前一日之後的時段）
testValidateDate('2026-06-16T10:00:00+08:00', '2026-06-16', false, 'past_order_cutoff', '今天 10:00 + 今天配送');
// 場景 2: 配送日 = 今天，現在 13:00 後
testValidateDate('2026-06-16T15:00:00+08:00', '2026-06-16', false, 'past_cutoff_today', '今天 15:00 + 今天配送');
testValidateDate('2026-06-16T20:00:00+08:00', '2026-06-16', false, 'past_cutoff_today', '今天 20:00 + 今天配送');
// 場景 3: 配送日 = 明天，現在 < 13:00
testValidateDate('2026-06-15T10:00:00+08:00', '2026-06-16', true, null, '配送前一日 10:00 + 明天配送');
testValidateDate('2026-06-15T12:30:00+08:00', '2026-06-16', true, null, '配送前一日 12:30 + 明天配送');
// 場景 4: 配送日 = 明天，現在 13:00 後
testValidateDate('2026-06-15T13:30:00+08:00', '2026-06-16', false, 'past_order_cutoff', '配送前一日 13:30 + 明天配送');
testValidateDate('2026-06-15T15:00:00+08:00', '2026-06-16', false, 'past_order_cutoff', '配送前一日 15:00 + 明天配送');
testValidateDate('2026-06-15T19:00:00+08:00', '2026-06-16', false, 'past_order_cutoff', '配送前一日 19:00 + 明天配送');
// 場景 5: 配送日 = 後天或之後
testValidateDate('2026-06-15T20:00:00+08:00', '2026-06-18', true, null, '配送前 3 日 20:00 + 後天配送');
testValidateDate('2026-06-13T20:00:00+08:00', '2026-06-18', true, null, '配送前 5 日 20:00 + 後天配送');
// 場景 6: 非開團日
testValidateDate('2026-06-14T10:00:00+08:00', '2026-06-20', false, 'not_open_date', '非開團日（2026-06-20）');
// 場景 7: 格式錯誤
testValidateDate('2026-06-14T10:00:00+08:00', 'invalid-date', false, 'invalid_format', '格式錯誤');
// 場景 8: 缺失
testValidateDate('2026-06-14T10:00:00+08:00', null, false, 'missing', '缺失');

console.log('validateDate 12 種情境: ALL PASSED ✓');

// ========== 5. validateTimeSlotWithDate ==========
console.log('\n--- validateTimeSlotWithDate ---');

function testTimeSlotWithDate(time, date, slot, expectedValid, expectedErrorType, description) {
  mockTime(time);
  const r = validateTimeSlotWithDate(date, slot);
  assert.strictEqual(r.valid, expectedValid, `${description}: expected valid=${expectedValid}, got ${r.valid} (errorType=${r.errorType})`);
  if (!expectedValid && expectedErrorType) {
    assert.strictEqual(r.errorType, expectedErrorType, `${description}: expected errorType=${expectedErrorType}, got ${r.errorType}`);
  }
  console.log(`  ${expectedValid ? '✅' : '❌'} ${description}`);
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

console.log('validateTimeSlotWithDate: ALL PASSED ✓');

// ========== 6. 改進的錯誤訊息（突出下一個開團日） ==========
console.log('\n--- 改進的錯誤訊息 ---');

mockTime('2026-06-15T21:00:00+08:00');
const r1 = validateDate('2026-06-20'); // 非開團日
assert.ok(r1.errorMessage.includes('下次有開團的日期是 2026-06-18（週四）'), '應突出下一個開團日');
assert.ok(r1.errorMessage.includes('您要改訂這天嗎？'), '應有引導語');
console.log('  ✓ not_open_date 突出「下一個開團日」');

const r2 = validateDate('2026-06-16'); // 配送前一日 21:00 → 過了收單
assert.ok(r2.errorMessage.includes('下次有開團的日期是 2026-06-18（週四）'), '應突出下一個開團日');
console.log('  ✓ past_order_cutoff 突出「下一個開團日」');

mockTime('2026-06-16T20:00:00+08:00');
const r3 = validateDate('2026-06-16'); // 今天 + 20:00
assert.ok(r3.errorMessage.includes('下次有開團的日期是 2026-06-18'), 'past_cutoff_today 應突出下一個開團日');
console.log('  ✓ past_cutoff_today 突出「下一個開團日」');

const r4 = validateDate('2026-07-15'); // 跨月
assert.ok(r4.errorMessage.includes('不是本月的開團日'), 'not_this_month 應清楚說明');
console.log('  ✓ not_this_month 錯誤訊息清楚');

console.log('改進的錯誤訊息: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL DATE TESTS PASSED ✓');
console.log('========================================\n');
