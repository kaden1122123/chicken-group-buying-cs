'use strict';

/**
 * 時區統一管理測試（Session G.2）
 */

const assert = require('assert');
const { test } = require('node:test';

const originalTZ = process.env.TZ;
const originalAllowOverride = process.env.ALLOW_TIMEZONE_OVERRIDE;

const timezone = require('../src/utils/timezone');

test('業務時區永遠是 Asia/Taipei', () => {
  assert.strictEqual(timezone.BUSINESS_TIMEZONE, 'Asia/Taipei');
  assert.strictEqual(timezone.getBusinessTimezone(), 'Asia/Taipei');
  assert.strictEqual(process.env.TZ, 'Asia/Taipei', `require 後 process.env.TZ 應為 Asia/Taipei, 實際: ${process.env.TZ}`);
  assert.strictEqual(timezone.getCurrentTimezone(), 'Asia/Taipei');
});

test('業務時區下的 getHours/getDate 正確', () => {
  process.env.TZ = 'Asia/Taipei';
  const tpDate = new Date('2026-06-15T14:00:00+08:00');
  assert.strictEqual(tpDate.getHours(), 14);
  assert.strictEqual(tpDate.getDate(), 15);
});

test('formatBusinessDate 正確', () => {
  process.env.TZ = 'Asia/Taipei';
  const d1 = new Date('2026-06-15T14:30:00+08:00');
  assert.strictEqual(timezone.formatBusinessDate(d1), '2026-06-15');

  const d2 = new Date('2026-06-15T23:30:00+08:00');
  assert.strictEqual(timezone.formatBusinessDate(d2), '2026-06-15');

  const d3 = new Date('2026-06-16T00:30:00+08:00');
  assert.strictEqual(timezone.formatBusinessDate(d3), '2026-06-16');

  assert.strictEqual(timezone.formatBusinessDate(null), '');
  assert.strictEqual(timezone.formatBusinessDate(undefined), '');
  assert.strictEqual(timezone.formatBusinessDate(new Date('invalid')), '');
});

test('getBusinessHours 正確反映業務時區', () => {
  process.env.TZ = 'Asia/Taipei';
  assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T14:30:00+08:00')), 14);
  assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T02:00:00+08:00')), 2);
  assert.strictEqual(timezone.getBusinessHours(new Date('2026-06-15T23:59:00+08:00')), 23);
});

test('isTimezoneOverrideAllowed — 預設 false + 設 ALLOW_TIMEZONE_OVERRIDE=1 後 true', () => {
  delete process.env.ALLOW_TIMEZONE_OVERRIDE;
  assert.strictEqual(timezone.isTimezoneOverrideAllowed(), false, '預設不允許覆蓋');

  process.env.ALLOW_TIMEZONE_OVERRIDE = '1';
  assert.strictEqual(timezone.isTimezoneOverrideAllowed(), true, '設為 1 後應允許');
});

// teardown — restore env
test('teardown — restore env', () => {
  process.env.TZ = originalTZ;
  process.env.ALLOW_TIMEZONE_OVERRIDE = originalAllowOverride;
});
