'use strict';

/**
 * notificationFormat 測試（Session H H6）
 *
 * 目的：驗證 src/handoff/notificationFormat.js 的 4 個 export
 *
 * 測試情境：
 * 1. formatLINENotification：完整 LINE 通知訊息（含品項、金額、缺欄位）
 * 2. formatLINENotificationMessage：包成 LINE message object
 * 3. getHandoffTitle：handoff_type 對應標題
 * 4. HANDOFF_TITLES：與 transferRules 觸發類型同步
 */

const assert = require('assert');

console.log('\n=== NotificationFormat Tests ===');

const notificationFormat = require('../src/handoff/notificationFormat');
// 載入 transferRules 驗證 HANDOFF_TITLES 是否涵蓋所有觸發類型
const transferRules = require('../src/handoff/transferRules');

console.log(`\n--- 情境 1: formatLINENotification 完整通知 ---`);

// 1.1 完整訂單
const order1 = {
  order_id: 'ORD-20260629-001',
  handoff_type: 'refund_request',
  user_line_name: '王小明',
  user_phone: '0912345678',
  address: '三峽區學成路100號',
  chicken_items: { 鹽水雞: 2 },
  side_items: {},
  total_amount: 760,
};
const msg1 = notificationFormat.formatLINENotification(order1, '我要退款');
assert.ok(msg1.includes('【退貨/退款】'), '應含退款類型標題');
assert.ok(msg1.includes('王小明'), '應含用戶名');
assert.ok(msg1.includes('0912345678'), '應含電話');
assert.ok(msg1.includes('三峽區學成路100號'), '應含地址');
assert.ok(msg1.includes('我要退款'), '應含客戶原始訊息');
assert.ok(msg1.includes('🍗 雞肉：鹽水雞x2'), '應含雞肉品項');
assert.ok(msg1.includes('NT$ 760'), '應含金額');
assert.ok(msg1.includes('order_id: ORD-20260629-001'), '應含 order_id 查詢');
assert.ok(msg1.includes('🔔 【AI 客服轉報通知】'), '應含標題開頭');
console.log('  ✓ 完整訂單通知（含退款類型、品項、金額）');

// 1.2 缺欄位（無 user_phone, address, chicken_items, total_amount）
const order2 = {
  order_id: 'ORD-20260629-002',
  handoff_type: 'general_inquiry',
  user_line_name: '測試',
};
const msg2 = notificationFormat.formatLINENotification(order2, '我想問');
assert.ok(msg2.includes('測試'), '應含用戶名');
assert.ok(!msg2.includes('電話：'), '無 user_phone 不應顯示電話行');
assert.ok(!msg2.includes('地址：'), '無 address 不應顯示地址行');
assert.ok(!msg2.includes('🍗 雞肉'), '無 chicken_items 不應顯示品項行');
assert.ok(!msg2.includes('💰 訂單金額'), '無 total_amount 不應顯示金額行');
console.log('  ✓ 缺欄位不顯示對應行');

// 1.3 chicken_items / side_items 是 JSON 字串格式（CSV 讀出來是字串）
const order3 = {
  order_id: 'ORD-20260629-003',
  handoff_type: 'complaint',
  user_line_name: 'A',
  chicken_items: '{"鹽水雞":1}',
  side_items: '{"秘製黑胡椒蒜味毛豆":2}',
};
const msg3 = notificationFormat.formatLINENotification(order3, '雞肉壞了');
assert.ok(msg3.includes('🍗 雞肉：鹽水雞x1'), 'JSON 字串 chicken_items 應解析');
assert.ok(msg3.includes('🥗 小菜：秘製黑胡椒蒜味毛豆x2'), 'JSON 字串 side_items 應解析');
console.log('  ✓ chicken_items / side_items JSON 字串格式正確解析');

// 1.4 一般轉報類型
const order4 = {
  order_id: 'ORD-20260629-004',
  handoff_type: 'general_inquiry',
  user_line_name: 'B',
};
const msg4 = notificationFormat.formatLINENotification(order4, '測試訊息');
assert.ok(msg4.includes('【一般轉報】'), 'general_inquiry → 【一般轉報】');
console.log('  ✓ general_inquiry → 【一般轉報】');

console.log(`\n--- 情境 2: formatLINENotificationMessage 物件格式 ---`);

const obj1 = notificationFormat.formatLINENotificationMessage(order1, '我要退款');
assert.strictEqual(obj1.type, 'text', '應為 text 類型');
assert.ok(typeof obj1.text === 'string' && obj1.text.length > 0, '應含 text 內容');
assert.strictEqual(obj1.text, msg1, 'text 內容應與 formatLINENotification 相同');
console.log('  ✓ 物件格式正確（type=text, text=字串）');

console.log(`\n--- 情境 3: getHandoffTitle 標題對應 ---`);

// 3.1 已知 type
assert.strictEqual(notificationFormat.getHandoffTitle('refund_request'), '【退貨/退款】');
assert.strictEqual(notificationFormat.getHandoffTitle('cancel_request'), '【取消訂單】');
assert.strictEqual(notificationFormat.getHandoffTitle('complaint'), '【售後/客訴】');
assert.strictEqual(notificationFormat.getHandoffTitle('escalation'), '【客訴/爭議】');
assert.strictEqual(notificationFormat.getHandoffTitle('explicit_request'), '【明確要求真人】');
assert.strictEqual(notificationFormat.getHandoffTitle('discount_request'), '【折扣請求】');
assert.strictEqual(notificationFormat.getHandoffTitle('linepay_failed'), '【LINE Pay 付款失敗】');
assert.strictEqual(notificationFormat.getHandoffTitle('high_value_order'), '【金額異常】');
console.log('  ✓ 已知 handoff_type 對應正確標題');

// 3.2 未知 type → fallback「【一般轉報】」+ console.warn
// 攔截 console.warn
const originalWarn = console.warn;
let warnCalled = false;
let warnMessage = '';
console.warn = (msg) => {
  warnCalled = true;
  warnMessage = msg;
};
try {
  const fallback = notificationFormat.getHandoffTitle('unknown_type_xyz');
  assert.strictEqual(fallback, '【一般轉報】', '未知 type → 【一般轉報】');
  assert.ok(warnCalled, '未知 type 應觸發 console.warn');
  assert.ok(warnMessage.includes('unknown_type_xyz'), 'warn 應含未知 type 名稱');
  console.log('  ✓ 未知 type → 【一般轉報】+ console.warn 提醒開發者');
} finally {
  console.warn = originalWarn;
}

console.log(`\n--- 情境 4: HANDOFF_TITLES 與 transferRules 同步 ---`);

// 4.1 從 transferRules.TRIGGER_PATTERNS 取得所有 type，確保都在 HANDOFF_TITLES
// 注意：transferRules 是 internal，謹慎取出 type
// eslint-disable-next-line no-unused-vars
let triggerTypes = [];
if (transferRules.TRIGGER_PATTERNS && typeof transferRules.TRIGGER_PATTERNS === 'object') {
  for (const pattern of transferRules.TRIGGER_PATTERNS) {
    if (pattern.type) triggerTypes.push(pattern.type);
  }
}
// 移除 'general'（有些系統用 'general'，HANDOFF_TITLES 沒有 'general' 對應）
triggerTypes = [...new Set(triggerTypes)].filter((t) => t !== 'general');

const missingTypes = triggerTypes.filter((t) => !(t in notificationFormat.HANDOFF_TITLES));
assert.deepStrictEqual(missingTypes, [], `HANDOFF_TITLES 應涵蓋所有 transferRules 觸發類型，缺: ${missingTypes.join(', ')}`);
console.log(`  ✓ HANDOFF_TITLES 涵蓋所有 ${triggerTypes.length} 個 transferRules 觸發類型`);

// 4.2 HANDOFF_TITLES 至少 12 個 type（確保沒被意外刪減）
const titleKeys = Object.keys(notificationFormat.HANDOFF_TITLES);
assert.ok(titleKeys.length >= 12, `HANDOFF_TITLES 應至少 12 個 type，實際: ${titleKeys.length}`);
console.log(`  ✓ HANDOFF_TITLES 包含 ${titleKeys.length} 個 type`);

// 4.3 所有 title 都是【xxx】格式
for (const key of titleKeys) {
  const title = notificationFormat.HANDOFF_TITLES[key];
  assert.match(title, /^【.+】$/, `title 應為【xxx】格式，${key} → ${title}`);
}
console.log('  ✓ 所有 title 都是【xxx】格式');

console.log('\n=== NotificationFormat Tests: ALL PASSED ===');
