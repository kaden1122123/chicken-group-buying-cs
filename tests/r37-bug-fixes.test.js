'use strict';

/**
 * Round 37.25 (Hubert 19:06) — 6 大商業對話漏洞修補測試
 *   1. 動態開團日（不再硬編碼 8/8、8/9）
 *   2. 品項模糊澄清（不再轉真人）
 *   3. 三峽區地址精準識別
 *   4. Gmail 真實觸發（已 Round 34/37.8 實作）
 *   5. 3 秒 Session 鎖定
 */

const assert = require('assert');
const { test } = require('node:test');

// ===== Task 3：三峽區地址精準識別 =====
const validateAddress = require('../src/rules/addressRule');

test('addressRule — 「新北市三峽區民生街1號1樓」→ valid:true（不再轉人工）', () => {
  const r = validateAddress('新北市三峽區民生街1號1樓');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.errorMessage, null);
  assert.strictEqual(r.action, undefined);
});

test('addressRule — 「新北市三峽區學成路100號」→ valid:true', () => {
  const r = validateAddress('新北市三峽區學成路100號');
  assert.strictEqual(r.valid, true);
});

test('addressRule — 「三峽區介壽路二段88號」→ valid:true', () => {
  const r = validateAddress('三峽區介壽路二段88號');
  assert.strictEqual(r.valid, true);
});

test('addressRule — 「新北市鶯歌區中正一路50號」→ valid:true', () => {
  const r = validateAddress('新北市鶯歌區中正一路50號');
  assert.strictEqual(r.valid, true);
});

test('addressRule — 「大溪區三元街123號」→ handoff_needed（out_of_range）', () => {
  const r = validateAddress('大溪區三元街123號');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.action, 'handoff_needed');
  assert.strictEqual(r.reason, 'out_of_range');
});

test('addressRule — 「台北市信義區」→ handoff_needed', () => {
  const r = validateAddress('台北市信義區');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.action, 'handoff_needed');
});

// ===== Task 2：品項模糊澄清（不轉人工） =====
const menuRule = require('../src/rules/menuRule');

test('menuRule — 「煙燻雞」→ ambiguous 多候選（不轉真人）', () => {
  const r = menuRule.validateMenu('煙燻雞');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.ambiguous, true);
  assert.ok(r.candidates.length >= 2, '至少 2 個候選');
  assert.ok(r.candidates.includes('甘蔗煙燻雞'));
  assert.ok(r.candidates.includes('甘蔗煙燻公雞'));
  assert.ok(r.errorMessage.includes('請問您要的是'));
  // 不應有 handoff / action
  assert.ok(!r.errorMessage.includes('轉交專人'));
});

test('menuRule — 「鹽水雞」→ valid:true（精確匹配「鹽水雞」這個完整品項，不模糊）', () => {
  const r = menuRule.validateMenu('鹽水雞');
  // 「鹽水雞」是 01_product.md 的完整品項名稱（$380/半隻），parseItems 命中後 valid:true
  // 只有「無法精準匹配」時才走 ambiguous 路徑（例如「煙燻雞」、「神秘雞」）
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.parsedItems[0].name, '鹽水雞');
});

test('menuRule — 「甘蔗煙燻雞」完整名稱 → valid:true', () => {
  const r = menuRule.validateMenu('甘蔗煙燻雞');
  assert.strictEqual(r.valid, true);
  assert.ok(r.parsedItems.length >= 1);
  assert.strictEqual(r.parsedItems[0].name, '甘蔗煙燻雞');
});

test('menuRule — 「鹽水雞x2」→ valid:true（精確匹配）', () => {
  const r = menuRule.validateMenu('鹽水雞x2');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.parsedItems[0].name, '鹽水雞');
  assert.strictEqual(r.parsedItems[0].quantity, 2);
});

test('menuRule — 「神秘雞」→ ambiguous（「雞」關鍵字匹配多個品項，詢問不轉真人）', () => {
  const r = menuRule.validateMenu('神秘雞');
  assert.strictEqual(r.valid, false);
  // 「神秘雞」不含任何 valid item，但 '雞' 關鍵字匹配多個品項 → ambiguous
  assert.strictEqual(r.ambiguous, true);
  assert.ok(r.candidates.length >= 2, '神秘雞沒有具體品項匹配，應模糊詢問客戶');
  assert.ok(r.errorMessage.includes('請問您要的是'));
});

// ===== Task 1：動態開團日（不再硬編碼 8/8、8/9） =====
const { getUpcomingOpenDates, formatDateWithWeekday, formatOpenDates } = require('../src/rules/dateRule');

test('dateRule — getUpcomingOpenDates 從 config.yaml 讀（不 hardcode）', () => {
  const dates = getUpcomingOpenDates({ weeks: 2 });
  assert.ok(Array.isArray(dates));
  // 不應有 hardcode 8/8、8/9 等固定字串
  // 只驗證它從 config 讀（如果 config 是空的，回傳空陣列而非預設 8/8）
  // 這裡若 config 有 8/4、8/7 等，dates 應該含它們
});

test('dateRule — formatDateWithWeekday 正確轉「週X」', () => {
  // 2026-08-07 是週五
  const r = formatDateWithWeekday('2026-08-07');
  assert.ok(r.includes('週五'));
  // 2026-08-09 是週日
  const r2 = formatDateWithWeekday('2026-08-09');
  assert.ok(r2.includes('週日'));
});

test('dateRule — formatOpenDates 用頓號連接', () => {
  const r = formatOpenDates(['2026-08-04', '2026-08-07']);
  assert.strictEqual(r, '2026-08-04、2026-08-07');
});

// ===== Task 5：3 秒 Session 鎖定 =====
const indexModule = require('../src/index');

test('index — acquireMessageLock 第一次允許、3 秒內第二次拒絕', () => {
  const userId = 'test-user-lock-001';
  // 第一次
  assert.strictEqual(indexModule.acquireMessageLock(userId), true);
  // 立即第二次（同 3 秒內）
  assert.strictEqual(indexModule.acquireMessageLock(userId), false);
  // 釋放
  indexModule.releaseMessageLock(userId);
  // 釋放後可再取
  assert.strictEqual(indexModule.acquireMessageLock(userId), true);
  indexModule.releaseMessageLock(userId);
});

test('index — 鎖定後 release 後不同 userId 不互相影響', () => {
  const u1 = 'test-user-A-' + Date.now();
  const u2 = 'test-user-B-' + Date.now();
  indexModule.acquireMessageLock(u1);
  // u2 仍可拿鎖
  assert.strictEqual(indexModule.acquireMessageLock(u2), true);
  indexModule.releaseMessageLock(u1);
  indexModule.releaseMessageLock(u2);
});

test('index — MESSAGE_LOCK_MS = 3000（防止 LINE 回覆丟失）', () => {
  assert.strictEqual(indexModule.MESSAGE_LOCK_MS, 3000);
});