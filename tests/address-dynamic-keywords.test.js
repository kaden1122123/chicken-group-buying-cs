'use strict';

/**
 * P1-2: addressRule 動態讀 loader 驗證測試
 *
 * 驗證 addressRule 用 loader.loadDeliveryAreas() 動態讀 + broad fallback
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const validateAddress = require('../src/rules/addressRule');
const { loadDeliveryAreas } = require('../src/knowledge/loader');

const DELIVERY_MD = path.join(__dirname, '..', 'knowledge', 'tenants', 'chicken', '04_delivery.md');

test('loader.loadDeliveryAreas() parses 04_delivery.md', () => {
  const areas = loadDeliveryAreas();
  assert.ok(areas.allowed.includes('北大特區'), '應抓到「北大特區」');
  assert.ok(areas.allowed.includes('介壽國小周邊'), '應抓到「介壽國小周邊」');
  assert.ok(areas.allowed.includes('安溪國中周邊'), '應抓到「安溪國中周邊」');
  assert.ok(!areas.allowed.some((k) => k.startsWith('#')), '不應包含 markdown 標題');
  assert.ok(areas.denied.includes('大溪方向'), '應抓到「大溪方向」');
  assert.ok(areas.denied.includes('新店方向'), '應抓到「新店方向」');
});

test('addressRule 04_delivery.md 內清單 — 全部 VALID', () => {
  const cases = [
    '三峽北大特區學成路100號',
    '北大特區大德路',
    '介壽國小周邊',
    '三峽安溪國中附近',
    '鶯歌安溪國中',
  ];
  for (const input of cases) {
    assert.strictEqual(validateAddress(input).valid, true, `「${input}」應 VALID`);
  }
});

test('addressRule fallback 區域 — VALID (三峽/鶯歌)', () => {
  const cases = [
    '三峽老街48號',
    '鶯歌區陶瓷路88號',
    '鶯歌全區',
  ];
  for (const input of cases) {
    assert.strictEqual(validateAddress(input).valid, true, `「${input}」應 VALID (fallback)`);
  }
});

test('addressRule 拒絕清單 — INVALID (broad 拒絕)', () => {
  const cases = [
    { input: '大溪區三元街123號', reason: 'out_of_range' },
    { input: '新店區北新路200號', reason: 'out_of_range' },
    { input: '龍潭區中正路', reason: 'out_of_range' },
    { input: '大溪方向', reason: 'out_of_range' },
    { input: '中壢區', reason: 'out_of_range' },
  ];
  for (const { input, reason } of cases) {
    const r = validateAddress(input);
    assert.strictEqual(r.valid, false, `「${input}」應 INVALID`);
    assert.strictEqual(r.reason, reason, `「${input}」應 ${reason}`);
  }
});

test('addressRule 台北信義 — needs_confirmation', () => {
  const r = validateAddress('台北市信義區');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, 'needs_confirmation');
});

test('addressRule 空字串 — INVALID', () => {
  assert.strictEqual(validateAddress('').valid, false);
});

test('04_delivery.md 存在且結構正確', () => {
  assert.ok(fs.existsSync(DELIVERY_MD), '04_delivery.md 必須存在');
  const mdContent = fs.readFileSync(DELIVERY_MD, 'utf8');
  assert.ok(mdContent.includes('配送範圍'), '應有「配送範圍」章節');
  assert.ok(mdContent.includes('不配送區域'), '應有「不配送區域」章節');
});

test('addressRule.js 動態載入 (無 hardcode)', () => {
  const addressRuleSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'rules', 'addressRule.js'),
    'utf8',
  );
  assert.ok(addressRuleSource.includes("require('../knowledge/loader')"), '應 require loader');
  assert.ok(addressRuleSource.includes('loadDeliveryAreas'), '應呼叫 loadDeliveryAreas');
  assert.ok(!addressRuleSource.match(/ALLOWED_KEYWORDS\s*=\s*\[/), '不應再有 hardcode ALLOWED_KEYWORDS 陣列');
});
