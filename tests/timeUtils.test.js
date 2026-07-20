'use strict';

/**
 * timeUtils 測試（node:test 風格 · Session H H1 → P1-4）
 *
 * 目的：驗證 src/utils/timeUtils.js 的 6 個函數
 *
 * 測試情境：
 * 1. getTimeSlot：中文/英文時段解析
 * 2. formatDate：Date → YYYY-MM-DD（邊界：無效輸入）
 * 3. getCurrentOpenDates：知識庫讀取（簡化版永遠回 []）
 * 4. isWithinOrderTime：13:00 前一天收單時間判斷
 * 5. getTodayString：當天日期
 * 6. parseDateInput：解析各種日期字串格式
 */

const assert = require('assert');
const { test } = require('node:test');

const timeUtils = require('../src/utils/timeUtils');

// Mock Date helper（從 tests/date.test.js 移植,沿用同樣風格）
// 解決 isWithinOrderTime 依賴「現在時間」的時間敏感性測試問題
const RealDate = Date;
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
function restoreTime() {
  global.Date = RealDate;
}

// 當前年份（MM-DD / MM/DD 補年份測試共用）
const currentYear = new RealDate().getFullYear();

// ═════════════════════════════════════════════════════════════════
// 1. getTimeSlot 時段解析
// ═════════════════════════════════════════════════════════════════

test('getTimeSlot 中文「上午」系列正確（morning）', () => {
  assert.strictEqual(timeUtils.getTimeSlot('上午'), 'morning');
  assert.strictEqual(timeUtils.getTimeSlot('早上'), 'morning');
  assert.strictEqual(timeUtils.getTimeSlot('上午配送'), 'morning');
});

test('getTimeSlot 中文「下午」系列正確（afternoon）', () => {
  assert.strictEqual(timeUtils.getTimeSlot('下午'), 'afternoon');
  assert.strictEqual(timeUtils.getTimeSlot('下午配送'), 'afternoon');
});

test('getTimeSlot 英文 am/pm/morning/afternoon 正確', () => {
  assert.strictEqual(timeUtils.getTimeSlot('am'), 'morning');
  assert.strictEqual(timeUtils.getTimeSlot('AM'), 'morning');
  assert.strictEqual(timeUtils.getTimeSlot('morning'), 'morning');
  assert.strictEqual(timeUtils.getTimeSlot('pm'), 'afternoon');
  assert.strictEqual(timeUtils.getTimeSlot('afternoon'), 'afternoon');
});

test('getTimeSlot 無對應時段回傳 null', () => {
  assert.strictEqual(timeUtils.getTimeSlot('晚上'), null);
  assert.strictEqual(timeUtils.getTimeSlot('中午'), null);
  assert.strictEqual(timeUtils.getTimeSlot(''), null);
  assert.strictEqual(timeUtils.getTimeSlot(null), null);
  assert.strictEqual(timeUtils.getTimeSlot(undefined), null);
});

// ═════════════════════════════════════════════════════════════════
// 2. formatDate 格式化
// ═════════════════════════════════════════════════════════════════

test('formatDate 正常日期格式化（含補 0）', () => {
  assert.strictEqual(timeUtils.formatDate(new Date(2026, 5, 15)), '2026-06-15', '6 月應補 0');
  assert.strictEqual(timeUtils.formatDate(new Date(2026, 0, 1)), '2026-01-01', '1 月應補 0');
  assert.strictEqual(timeUtils.formatDate(new Date(2026, 11, 31)), '2026-12-31', '12 月不補 0');
  assert.strictEqual(timeUtils.formatDate(new Date(2026, 8, 5)), '2026-09-05', '9/5 雙補 0');
});

test('formatDate 無效輸入回傳空字串', () => {
  assert.strictEqual(timeUtils.formatDate(null), '', 'null 應回傳空字串');
  assert.strictEqual(timeUtils.formatDate(undefined), '', 'undefined 應回傳空字串');
  assert.strictEqual(timeUtils.formatDate('2026-06-15'), '', '字串應回傳空字串');
  assert.strictEqual(timeUtils.formatDate(12345), '', '數字應回傳空字串');
  assert.strictEqual(timeUtils.formatDate(new Date('invalid')), '', '無效 Date 應回傳空字串');
});

// ═════════════════════════════════════════════════════════════════
// 3. getCurrentOpenDates 知識庫讀取
// ═════════════════════════════════════════════════════════════════

test('getCurrentOpenDates 回傳陣列（簡化版目前為空陣列）', () => {
  const dates = timeUtils.getCurrentOpenDates();
  assert.ok(Array.isArray(dates), '應回傳陣列');
});

// ═════════════════════════════════════════════════════════════════
// 4. isWithinOrderTime 收單時間判斷
// ═════════════════════════════════════════════════════════════════

test('isWithinOrderTime 各種配送日判斷', () => {
  // 先建好所有測試用的 deliveryDate（用 RealDate,確保日期是「真實今天 + N 天」）
  const todayDelivery = new RealDate();
  todayDelivery.setHours(15, 0, 0, 0);
  const yesterdayDelivery = new RealDate();
  yesterdayDelivery.setDate(yesterdayDelivery.getDate() - 1);
  yesterdayDelivery.setHours(10, 0, 0, 0);
  const tomorrowAfternoonDelivery = new RealDate();
  tomorrowAfternoonDelivery.setDate(tomorrowAfternoonDelivery.getDate() + 1);
  tomorrowAfternoonDelivery.setHours(14, 0, 0, 0);
  const tomorrowMorningDelivery = new RealDate();
  tomorrowMorningDelivery.setDate(tomorrowMorningDelivery.getDate() + 1);
  tomorrowMorningDelivery.setHours(12, 0, 0, 0);
  const dayAfterTomorrowDelivery = new RealDate();
  dayAfterTomorrowDelivery.setDate(dayAfterTomorrowDelivery.getDate() + 2);
  dayAfterTomorrowDelivery.setHours(10, 0, 0, 0);
  const nextWeekDelivery = new RealDate();
  nextWeekDelivery.setDate(nextWeekDelivery.getDate() + 7);
  nextWeekDelivery.setHours(10, 0, 0, 0);

  // Mock「現在」到今天 10:00
  const mockTodayStr = new RealDate().toISOString().slice(0, 10);
  mockTime(`${mockTodayStr}T10:00:00+08:00`);

  // 「今天 15:00」配送：cutoff = 昨天 13:00，now > cutoff → 已過
  assert.strictEqual(timeUtils.isWithinOrderTime(todayDelivery), false, '今天 15:00 配送已過收單');

  // 「昨天 10:00」配送：cutoff = 前天 13:00，更早就過了
  assert.strictEqual(timeUtils.isWithinOrderTime(yesterdayDelivery), false, '昨天配送已過收單');

  // 「明天 14:00」配送：cutoff = 今天 13:00，now (今天 10:00) < today 13:00 → 還可下單
  assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowAfternoonDelivery), true, '明天 14:00 配送在收單時間內');

  // 「明天 12:00」配送：cutoff = 今天 13:00，還可下單
  assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowMorningDelivery), true, '明天 12:00 配送在收單時間內');

  // 後天配送：cutoff = 明天 13:00，一定還可下單
  assert.strictEqual(timeUtils.isWithinOrderTime(dayAfterTomorrowDelivery), true, '後天配送在收單時間內');

  // 一週後配送：cutoff = 6 天後 13:00，還可下單
  assert.strictEqual(timeUtils.isWithinOrderTime(nextWeekDelivery), true, '一週後配送在收單時間內');

  restoreTime();
});

// ═════════════════════════════════════════════════════════════════
// 5. getTodayString 當天日期
// ═════════════════════════════════════════════════════════════════

test('getTodayString 回傳 YYYY-MM-DD 格式', () => {
  const todayStr = timeUtils.getTodayString();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, `應符合 YYYY-MM-DD 格式，實際: ${todayStr}`);
});

test('getTodayString 與 formatDate(new Date()) 一致', () => {
  const todayStr = timeUtils.getTodayString();
  assert.strictEqual(todayStr, timeUtils.formatDate(new Date()), '應與 formatDate(new Date()) 一致');
});

// ═════════════════════════════════════════════════════════════════
// 6. parseDateInput 解析日期字串
// ═════════════════════════════════════════════════════════════════

test('parseDateInput YYYY-MM-DD 格式解析正確', () => {
  const d1 = timeUtils.parseDateInput('2026-06-15');
  assert.ok(d1 instanceof Date, '應回傳 Date 物件');
  assert.strictEqual(d1.getFullYear(), 2026);
  assert.strictEqual(d1.getMonth(), 5); // 月份 0-indexed
  assert.strictEqual(d1.getDate(), 15);
});

test('parseDateInput YYYY/MM/DD 格式解析正確', () => {
  const d2 = timeUtils.parseDateInput('2026/12/25');
  assert.ok(d2 instanceof Date);
  assert.strictEqual(d2.getFullYear(), 2026);
  assert.strictEqual(d2.getMonth(), 11);
  assert.strictEqual(d2.getDate(), 25);
});

test('parseDateInput MM-DD 格式補當前年份', () => {
  const d3 = timeUtils.parseDateInput('07-08');
  assert.ok(d3 instanceof Date);
  assert.strictEqual(d3.getMonth(), 6);
  assert.strictEqual(d3.getDate(), 8);
  assert.strictEqual(d3.getFullYear(), currentYear, 'MM-DD 應補當前年份');
});

test('parseDateInput MM/DD 格式補當前年份', () => {
  const d4 = timeUtils.parseDateInput('03/20');
  assert.ok(d4 instanceof Date);
  assert.strictEqual(d4.getMonth(), 2);
  assert.strictEqual(d4.getDate(), 20);
  assert.strictEqual(d4.getFullYear(), currentYear);
});

test('parseDateInput 無效輸入回傳 null', () => {
  assert.strictEqual(timeUtils.parseDateInput(''), null, '空字串應為 null');
  assert.strictEqual(timeUtils.parseDateInput(null), null, 'null 應為 null');
  assert.strictEqual(timeUtils.parseDateInput(undefined), null, 'undefined 應為 null');
  assert.strictEqual(timeUtils.parseDateInput('garbage'), null, '無法解析應為 null');
  assert.strictEqual(timeUtils.parseDateInput('abc'), null, '純文字應為 null');
});
