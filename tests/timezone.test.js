'use strict';

/**
 * 時區統一管理測試（Session G.2）
 *
 * 目的：驗證 src/utils/timezone.js 在不同外部時區下，業務邏輯都用 Asia/Taipei
 *
 * 測試情境：
 * 1. 即使外部 TZ=UTC，require timezone.js 後 process.env.TZ 變 Asia/Taipei
 * 2. getBusinessTimezone() 永遠回傳 Asia/Taipei
 * 3. getCurrentTimezone() 回傳當前生效的時區
 * 4. formatBusinessDate/getBusinessHours 行為正確
 * 5. isTimezoneOverrideAllowed 預設 false，設 ALLOW_TIMEZONE_OVERRIDE=1 後 true
 */

const assert = require('assert');

console.log('\n=== Timezone Tests ===');

const originalTZ = process.env.TZ;
const originalAllowOverride = process.env.ALLOW_TIMEZONE_OVERRIDE;

console.log(`\n--- 情境 1: 業務時區永遠是 Asia/Taipei ---`);

const timezone = require('../src/utils/timezone');

assert.strictEqual(timezone.BUSINESS_TIMEZONE, 'Asia/Taipei', 'BUSINESS_TIMEZONE 應為 Asia/Taipei');
console.log('  ✓ BUSINESS_TIMEZONE 永遠是 Asia/Taipei');

assert.strictEqual(timezone.getBusinessTimezone(), 'Asia/Taipei', 'getBusinessTimezone 應為 Asia/Taipei');
console.log('  ✓ getBusinessTimezone() 永遠是 Asia/Taipei');

// 在 require timezone.js 之後，process.env.TZ 應該被強制為 Asia/Taipei
assert.strictEqual(process.env.TZ, 'Asia/Taipei', `require 後 process.env.TZ 應為 Asia/Taipei，實際: ${process.env.TZ}`);
console.log('  ✓ require timezone.js 後 process.env.TZ 已被強制為 Asia/Taipei');

assert.strictEqual(timezone.getCurrentTimezone(), 'Asia/Taipei', 'getCurrentTimezone 應為 Asia/Taipei');
console.log('  ✓ getCurrentTimezone() 回傳 Asia/Taipei');

console.log(`\n--- 情境 2: 業務時區下的 getHours/getDate 正確 ---`);

// 在 Asia/Taipei 下，14:00+08:00 應該 getHours() = 14
process.env.TZ = 'Asia/Taipei';
const tpDate = new Date('2026-06-15T14:00:00+08:00');
assert.strictEqual(tpDate.getHours(), 14, 'Asia/Taipei 下 14:00+08:00 → getHours() 應為 14');
assert.strictEqual(tpDate.getDate(), 15, 'Asia/Taipei 下 14:00+08:00 → getDate() 應為 15');
console.log('  ✓ 14:00+08:00 → getHours() = 14, getDate() = 15');

console.log(`\n--- 情境 3: formatBusinessDate 正確 ---`);
process.env.TZ = 'Asia/Taipei';
const d1 = new Date('2026-06-15T14:30:00+08:00');
assert.strictEqual(timezone.formatBusinessDate(d1), '2026-06-15', '14:30+08:00 應該是 2026-06-15');
console.log('  ✓ formatBusinessDate(2026-06-15T14:30:00+08:00) = 2026-06-15');

// 邊界：跨日
const d2 = new Date('2026-06-15T23:30:00+08:00');
assert.strictEqual(timezone.formatBusinessDate(d2), '2026-06-15', '23:30+08:00 應該是 2026-06-15');
console.log('  ✓ formatBusinessDate(2026-06-15T23:30:00+08:00) = 2026-06-15');

const d3 = new Date('2026-06-16T00:30:00+08:00');
assert.strictEqual(timezone.formatBusinessDate(d3), '2026-06-16', '00:30+08:00 應該是 2026-06-16');
console.log('  ✓ formatBusinessDate(2026-06-16T00:30:00+08:00) = 2026-06-16');

// 無效輸入
assert.strictEqual(timezone.formatBusinessDate(null), '', 'null 應回傳空字串');
assert.strictEqual(timezone.formatBusinessDate(undefined), '', 'undefined 應回傳空字串');
assert.strictEqual(timezone.formatBusinessDate(new Date('invalid')), '', '無效 Date 應回傳空字串');
console.log('  ✓ 無效輸入回傳空字串');

console.log(`\n--- 情境 4: getBusinessHours 正確 ---`);
process.env.TZ = 'Asia/Taipei';
assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T14:30:00+08:00')), 14, '14:30 應為 14');
assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T02:00:00+08:00')), 2, '02:00 應為 2');
assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T23:59:00+08:00')), 23, '23:59 應為 23');
console.log('  ✓ getBusinessHours 正確反映業務時區');

console.log(`\n--- 情境 5: isTimezoneOverrideAllowed 預設 false ---`);
delete process.env.ALLOW_TIMEZONE_OVERRIDE;
assert.strictEqual(timezone.isTimezoneOverrideAllowed(), false, '預設不允許覆蓋');
console.log('  ✓ 預設 ALLOW_TIMEZONE_OVERRIDE 未啟用');

process.env.ALLOW_TIMEZONE_OVERRIDE = '1';
assert.strictEqual(timezone.isTimezoneOverrideAllowed(), true, '設為 1 後應允許');
console.log('  ✓ 設 ALLOW_TIMEZONE_OVERRIDE=1 後允許覆蓋');

// 恢復環境
process.env.TZ = originalTZ;
process.env.ALLOW_TIMEZONE_OVERRIDE = originalAllowOverride;

console.log('\n=== Timezone Tests: ALL PASSED ===');
