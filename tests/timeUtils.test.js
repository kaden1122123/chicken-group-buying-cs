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

// 收單時間：配送日的前一天 13:00
// cutoff = deliveryDate - 1天 + 13:00
// isWithinOrderTime 回傳 now < cutoff（true = 還可下單，false = 已過收單）

// 構造「今天 15:00」配送：cutoff = 昨天 13:00，現在 > cutoff → 已過
const today = new Date();
today.setHours(15, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(today), false, '今天 15:00 配送，cutoff = 昨天 13:00 已過（false）');
console.log('  ✓ 今天配送已過收單（false）');

// 構造「昨天 10:00」配送：cutoff = 前天 13:00，更早就過了
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(10, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(yesterday), false, '昨天配送已過收單（false）');
console.log('  ✓ 昨天配送已過收單（false）');

// 構造「明天 14:00」配送：cutoff = 明天 13:00，現在 < 明天 13:00 → 還可下單
const tomorrowAfternoon = new Date();
tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
tomorrowAfternoon.setHours(14, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowAfternoon), true, '明天 14:00 配送，cutoff = 明天 13:00 還在收單（true）');
console.log('  ✓ 明天 14:00 配送還在收單（true）');

// 構造「明天 12:00」配送：cutoff = 明天 13:00，還可下單
const tomorrowMorning = new Date();
tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
tomorrowMorning.setHours(12, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(tomorrowMorning), true, '明天 12:00 配送在收單時間內（true）');
console.log('  ✓ 明天 12:00 配送在收單時間內（true）');

// 後天配送：cutoff = 明天 13:00，一定還可下單
const dayAfterTomorrow = new Date();
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
dayAfterTomorrow.setHours(10, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(dayAfterTomorrow), true, '後天配送一定在收單時間內（true）');
console.log('  ✓ 後天配送在收單時間內（true）');

// 一週後配送：未過
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
nextWeek.setHours(10, 0, 0, 0);
assert.strictEqual(timeUtils.isWithinOrderTime(nextWeek), true, '一週後配送在收單時間內（true）');
console.log('  ✓ 一週後配送在收單時間內（true）');

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
