'use strict';

/**
 * timeUtils 測試（Session H H1）
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

console.log('\n=== TimeUtils Tests ===');

const timeUtils = require('../src/utils/timeUtils');

console.log(`\n--- 情境 1: getTimeSlot 時段解析 ---`);

// 中文「上午」系列
assert.strictEqual(timeUtils.getTimeSlot('上午'), 'morning', '「上午」應為 morning');
assert.strictEqual(timeUtils.getTimeSlot('早上'), 'morning', '「早上」應為 morning');
assert.strictEqual(timeUtils.getTimeSlot('上午配送'), 'morning', '「上午配送」應為 morning');
console.log('  ✓ 中文「上午」系列正確（morning）');

// 中文「下午」系列
assert.strictEqual(timeUtils.getTimeSlot('下午'), 'afternoon', '「下午」應為 afternoon');
assert.strictEqual(timeUtils.getTimeSlot('下午配送'), 'afternoon', '「下午配送」應為 afternoon');
console.log('  ✓ 中文「下午」系列正確（afternoon）');

// 英文
assert.strictEqual(timeUtils.getTimeSlot('am'), 'morning', '「am」應為 morning');
assert.strictEqual(timeUtils.getTimeSlot('AM'), 'morning', '「AM」(大寫) 應為 morning');
assert.strictEqual(timeUtils.getTimeSlot('morning'), 'morning', '「morning」應為 morning');
assert.strictEqual(timeUtils.getTimeSlot('pm'), 'afternoon', '「pm」應為 afternoon');
assert.strictEqual(timeUtils.getTimeSlot('afternoon'), 'afternoon', '「afternoon」應為 afternoon');
console.log('  ✓ 英文 am/pm/morning/afternoon 正確');

// 不符合
assert.strictEqual(timeUtils.getTimeSlot('晚上'), null, '「晚上」應為 null');
assert.strictEqual(timeUtils.getTimeSlot('中午'), null, '「中午」應為 null');
assert.strictEqual(timeUtils.getTimeSlot(''), null, '空字串應為 null');
assert.strictEqual(timeUtils.getTimeSlot(null), null, 'null 應為 null');
assert.strictEqual(timeUtils.getTimeSlot(undefined), null, 'undefined 應為 null');
console.log('  ✓ 無對應時段回傳 null');

console.log(`\n--- 情境 2: formatDate 格式化 ---`);

// 正常情況
assert.strictEqual(timeUtils.formatDate(new Date(2026, 5, 15)), '2026-06-15', '6 月應補 0');
assert.strictEqual(timeUtils.formatDate(new Date(2026, 0, 1)), '2026-01-01', '1 月應補 0');
assert.strictEqual(timeUtils.formatDate(new Date(2026, 11, 31)), '2026-12-31', '12 月不補 0');
assert.strictEqual(timeUtils.formatDate(new Date(2026, 8, 5)), '2026-09-05', '9/5 雙補 0');
console.log('  ✓ 正常日期格式化（含補 0）');

// 邊界：無效輸入
assert.strictEqual(timeUtils.formatDate(null), '', 'null 應回傳空字串');
assert.strictEqual(timeUtils.formatDate(undefined), '', 'undefined 應回傳空字串');
assert.strictEqual(timeUtils.formatDate('2026-06-15'), '', '字串應回傳空字串');
assert.strictEqual(timeUtils.formatDate(12345), '', '數字應回傳空字串');
assert.strictEqual(timeUtils.formatDate(new Date('invalid')), '', '無效 Date 應回傳空字串');
console.log('  ✓ 無效輸入回傳空字串');

console.log(`\n--- 情境 3: getCurrentOpenDates 知識庫讀取 ---`);

// 目前是簡化版，永遠回 []
const dates = timeUtils.getCurrentOpenDates();
assert.ok(Array.isArray(dates), '應回傳陣列');
console.log('  ✓ 回傳陣列（簡化版目前為空陣列）');

console.log(`\n--- 情境 4: isWithinOrderTime 收單時間判斷 ---`);

// 收單時間規則：配送日的前一天 13:00
// cutoff = deliveryDate - 1天 + 13:00
// isWithinOrderTime 回傳 now < cutoff（true = 還可下單，false = 已過收單）
//
// 注意：此情境需 mock 「現在」才能穩定測試（時間敏感）
// 策略：先建好所有 deliveryDate（用 RealDate），再 mock 固定的「現在」

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

// Mock「現在」到今天 10:00（所有 cutoff 都還沒過,除了「今天/昨天配送」的）
const mockTodayStr = new RealDate().toISOString().slice(0, 10);
mockTime(`${mockTodayStr}T10:00:00+08:00`);

// 「今天 15:00」配送：cutoff = 昨天 13:00，now > cutoff → 已過
assert.strictEqual(timeUtils.isWithinOrderTime(todayDelivery), false, '今天 15:00 配送已過收單（cutoff = 昨天 13:00）');
console.log('  ✓ 今天配送已過收單（false）');

// 「昨天 10:00」配送：cutoff = 前天 13:00，更早就過了
assert.strictEqual(timeUtils.isWithinOrderTime(yesterdayDelivery), false, '昨天配送已過收單（cutoff = 前天 13:00）');
console.log('  ✓ 昨天配送已過收單（false）');

// 「明天 14:00」配送：cutoff = 今天 13:00，now (今天 10:00) < today 13:00 → 還可下單
assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowAfternoonDelivery), true, '明天 14:00 配送在收單時間內（cutoff = 今天 13:00）');
console.log('  ✓ 明天 14:00 配送在收單時間內（true）');

// 「明天 12:00」配送：cutoff = 今天 13:00，還可下單
assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowMorningDelivery), true, '明天 12:00 配送在收單時間內（cutoff = 今天 13:00）');
console.log('  ✓ 明天 12:00 配送在收單時間內（true）');

// 後天配送：cutoff = 明天 13:00，一定還可下單
assert.strictEqual(timeUtils.isWithinOrderTime(dayAfterTomorrowDelivery), true, '後天配送在收單時間內（cutoff = 明天 13:00）');
console.log('  ✓ 後天配送在收單時間內（true）');

// 一週後配送：cutoff = 6 天後 13:00，還可下單
assert.strictEqual(timeUtils.isWithinOrderTime(nextWeekDelivery), true, '一週後配送在收單時間內（cutoff = 6 天後 13:00）');
console.log('  ✓ 一週後配送在收單時間內（true）');

// 情境 4 結束,還原 Date 避免影響後續情境 5/6
restoreTime();

console.log(`\n--- 情境 5: getTodayString 當天日期 ---`);

const todayStr = timeUtils.getTodayString();
assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, `應符合 YYYY-MM-DD 格式，實際: ${todayStr}`);
console.log(`  ✓ 回傳 YYYY-MM-DD 格式（${todayStr}）`);

// 應與 formatDate(new Date()) 一致
assert.strictEqual(todayStr, timeUtils.formatDate(new Date()), '應與 formatDate(new Date()) 一致');
console.log('  ✓ 與 formatDate(new Date()) 一致');

console.log(`\n--- 情境 6: parseDateInput 解析日期字串 ---`);

// YYYY-MM-DD 格式
const d1 = timeUtils.parseDateInput('2026-06-15');
assert.ok(d1 instanceof Date, '應回傳 Date 物件');
assert.strictEqual(d1.getFullYear(), 2026);
assert.strictEqual(d1.getMonth(), 5); // 月份 0-indexed
assert.strictEqual(d1.getDate(), 15);
console.log('  ✓ YYYY-MM-DD 格式解析正確');

// YYYY/MM/DD 格式
const d2 = timeUtils.parseDateInput('2026/12/25');
assert.ok(d2 instanceof Date);
assert.strictEqual(d2.getFullYear(), 2026);
assert.strictEqual(d2.getMonth(), 11);
assert.strictEqual(d2.getDate(), 25);
console.log('  ✓ YYYY/MM/DD 格式解析正確');

// MM-DD 格式（補今年）
const d3 = timeUtils.parseDateInput('07-08');
assert.ok(d3 instanceof Date);
assert.strictEqual(d3.getMonth(), 6);
assert.strictEqual(d3.getDate(), 8);
const currentYear = new Date().getFullYear();
assert.strictEqual(d3.getFullYear(), currentYear, 'MM-DD 應補當前年份');
console.log('  ✓ MM-DD 格式補當前年份');

// MM/DD 格式
const d4 = timeUtils.parseDateInput('03/20');
assert.ok(d4 instanceof Date);
assert.strictEqual(d4.getMonth(), 2);
assert.strictEqual(d4.getDate(), 20);
assert.strictEqual(d4.getFullYear(), currentYear);
console.log('  ✓ MM/DD 格式補當前年份');

// 無效輸入
assert.strictEqual(timeUtils.parseDateInput(''), null, '空字串應為 null');
assert.strictEqual(timeUtils.parseDateInput(null), null, 'null 應為 null');
assert.strictEqual(timeUtils.parseDateInput(undefined), null, 'undefined 應為 null');
assert.strictEqual(timeUtils.parseDateInput('garbage'), null, '無法解析應為 null');
assert.strictEqual(timeUtils.parseDateInput('abc'), null, '純文字應為 null');
console.log('  ✓ 無效輸入回傳 null');

console.log('\n=== TimeUtils Tests: ALL PASSED ===');
