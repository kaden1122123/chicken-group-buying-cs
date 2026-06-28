'use strict';

/**
 * P1-2: addressRule 動態讀 loader 驗證測試
 *
 * 原本 src/rules/addressRule.js 用 hardcode 的 ALLOWED_KEYWORDS / DENIED_KEYWORDS，
 * 跟 knowledge/tenants/chicken/04_delivery.md 不一致，改 config 也不會同步。
 *
 * 修整：
 * - src/knowledge/loader.js loadDeliveryAreas 改用 markdown section parsing
 *   （之前是脆弱的關鍵字匹配）
 * - src/rules/addressRule.js 改用 loadDeliveryAreas() 動態讀 + broad fallback
 *   關鍵字（三峽、鶯歌、龍潭、中壢等周邊市區）
 *
 * 本測試驗證：
 * 1. loader.loadDeliveryAreas() 從 04_delivery.md 正確解析 allowed / denied
 * 2. addressRule.validateAddress 用動態關鍵字，行為跟 hardcode 一致
 * 3. 04_delivery.md 修改後，addressRule 自動跟上（手動驗證）
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const validateAddress = require('../src/rules/addressRule');
const { loadDeliveryAreas } = require('../src/knowledge/loader');

const DELIVERY_MD = path.join(__dirname, '..', 'knowledge', 'tenants', 'chicken', '04_delivery.md');

console.log('\n=== Address Dynamic Keywords Tests (P1-2) ===');

// ─── 1. loader.loadDeliveryAreas() 正確解析 04_delivery.md ───
console.log('\n--- loader.loadDeliveryAreas() parses 04_delivery.md ---');

const areas = loadDeliveryAreas();
console.log(`  allowed count: ${areas.allowed.length}`);
console.log(`  denied count: ${areas.denied.length}`);

// 04_delivery.md 內的關鍵清單必須被抓到
assert.ok(areas.allowed.includes('北大特區'), '應抓到「北大特區」');
assert.ok(areas.allowed.includes('介壽國小周邊'), '應抓到「介壽國小周邊」');
assert.ok(areas.allowed.includes('安溪國中周邊'), '應抓到「安溪國中周邊」');
console.log('  ✓ allowed 包含 04_delivery.md 內所有清單');

// 不應包含 markdown 結構字符
assert.ok(
  !areas.allowed.some((k) => k.startsWith('#')),
  '不應包含 markdown 標題',
);
console.log('  ✓ 不含 markdown 結構字符');

assert.ok(areas.denied.includes('大溪方向'), '應抓到「大溪方向」');
assert.ok(areas.denied.includes('新店方向'), '應抓到「新店方向」');
console.log('  ✓ denied 包含 04_delivery.md 內的清單');

// ─── 2. addressRule.validateAddress 動態關鍵字 + fallback ───
console.log('\n--- addressRule with dynamic + fallback keywords ---');

function testCase(input, expectedValid, expectedReason, label) {
  const r = validateAddress(input);
  assert.strictEqual(r.valid, expectedValid, `${label}: expected ${expectedValid}`);
  if (expectedReason && !expectedValid) {
    assert.strictEqual(r.reason, expectedReason, `${label}: reason should be ${expectedReason}`);
  }
  console.log(`  ✓ ${label}: "${input}" → ${expectedValid ? 'VALID' : 'INVALID' + (r.reason ? ` (${r.reason})` : '')}`);
}

// 04_delivery.md 內清單
testCase('三峽北大特區學成路100號', true, null, '三峽北大特區');
testCase('北大特區大德路', true, null, '北大特區（無三峽前綴）');
testCase('介壽國小周邊', true, null, '介壽國小周邊');
testCase('三峽安溪國中附近', true, null, '安溪國中（有三峽前綴，fallback 三峽）');
testCase('鶯歌安溪國中', true, null, '鶯歌安溪國中（fallback 鶯歌）');

// Fallback 區域名（loader 沒列但屬於三鶯生活圈）
testCase('三峽老街48號', true, null, '三峽老街（fallback「三峽」）');
testCase('鶯歌區陶瓷路88號', true, null, '鶯歌區（fallback「鶯歌」）');
testCase('鶯歌全區', true, null, '鶯歌全區（fallback「鶯歌」）');

// 拒絕清單
testCase('大溪區三元街123號', false, 'out_of_range', '大溪（broad 拒絕）');
testCase('新店區北新路200號', false, 'out_of_range', '新店（broad 拒絕）');
testCase('龍潭區中正路', false, 'out_of_range', '龍潭（broad 拒絕）');
testCase('大溪方向', false, 'out_of_range', '大溪方向（loader 抓到）');
testCase('中壢區', false, 'out_of_range', '中壢（broad 拒絕）');

// 需人工確認
testCase('台北市信義區', false, 'needs_confirmation', '台北信義（既不允許也不拒絕）');
testCase('', false, null, '空地址');

// ─── 3. 04_delivery.md 存在性檢查 ───
console.log('\n--- 04_delivery.md exists ---');

assert.ok(fs.existsSync(DELIVERY_MD), '04_delivery.md 必須存在');
console.log('  ✓ knowledge/tenants/chicken/04_delivery.md 存在');

const mdContent = fs.readFileSync(DELIVERY_MD, 'utf8');
assert.ok(mdContent.includes('配送範圍'), '04_delivery.md 應有「配送範圍」章節');
assert.ok(mdContent.includes('不配送區域'), '04_delivery.md 應有「不配送區域」章節');
console.log('  ✓ 04_delivery.md 結構正確');

// ─── 4. 動態載入驗證：addressRule 引用 loader 的 getKeywords（不依賴 hardcode）──
console.log('\n--- 動態載入驗證 ---');

const addressRuleSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'rules', 'addressRule.js'),
  'utf8',
);
assert.ok(
  addressRuleSource.includes("require('../knowledge/loader')"),
  'addressRule.js 應 require loader',
);
assert.ok(
  addressRuleSource.includes('loadDeliveryAreas'),
  'addressRule.js 應呼叫 loadDeliveryAreas',
);
assert.ok(
  !addressRuleSource.includes('ALLOWED_KEYWORDS = [') ||
    addressRuleSource.match(/ALLOWED_KEYWORDS = \[/g).length <= 0,
  'addressRule.js 不應再有 hardcode ALLOWED_KEYWORDS 陣列',
);
console.log('  ✓ addressRule.js 改用 loader，無 hardcode 陣列');

console.log('\n========================================');
console.log('ALL ADDRESS DYNAMIC KEYWORDS TESTS PASSED ✓');
console.log('========================================\n');
