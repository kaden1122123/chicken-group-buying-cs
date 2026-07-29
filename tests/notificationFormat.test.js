'use strict';

/**
 * notificationFormat 測試（Session H H6）
 *
 * 目的：驗證 src/handoff/notificationFormat.js 的 4 個 export
 */

const assert = require('assert');
const { test } = require('node:test');

const notificationFormat = require('../src/handoff/notificationFormat');
const transferRules = require('../src/handoff/transferRules');

test('formatLINENotification 完整訂單（含退款類型、品項、金額）', () => {
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
});

test('formatLINENotification 缺欄位不顯示對應行', () => {
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
});

test('formatLINENotification chicken_items / side_items JSON 字串格式正確解析', () => {
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
});

test('formatLINENotification general_inquiry → 【一般轉報】', () => {
  const order4 = { order_id: 'ORD-20260629-004', handoff_type: 'general_inquiry', user_line_name: 'B' };
  const msg4 = notificationFormat.formatLINENotification(order4, '測試訊息');
  assert.ok(msg4.includes('【一般轉報】'), 'general_inquiry → 【一般轉報】');
});

test('formatLINENotificationMessage 物件格式正確', () => {
  const order1 = {
    order_id: 'ORD-20260629-001',
    handoff_type: 'refund_request',
    user_line_name: '王小明',
    user_phone: '0912345678',
  };
  const obj1 = notificationFormat.formatLINENotificationMessage(order1, '我要退款');
  assert.strictEqual(obj1.type, 'text');
  assert.ok(typeof obj1.text === 'string' && obj1.text.length > 0);

  const msg1 = notificationFormat.formatLINENotification(order1, '我要退款');
  assert.strictEqual(obj1.text, msg1, 'text 內容應與 formatLINENotification 相同');
});

test('getHandoffTitle 已知 handoff_type 對應正確標題', () => {
  assert.strictEqual(notificationFormat.getHandoffTitle('refund_request'), '【退貨/退款】');
  assert.strictEqual(notificationFormat.getHandoffTitle('cancel_request'), '【取消訂單】');
  assert.strictEqual(notificationFormat.getHandoffTitle('complaint'), '【售後/客訴】');
  assert.strictEqual(notificationFormat.getHandoffTitle('escalation'), '【客訴/爭議】');
  assert.strictEqual(notificationFormat.getHandoffTitle('explicit_request'), '【明確要求真人】');
  assert.strictEqual(notificationFormat.getHandoffTitle('discount_request'), '【折扣請求】');
  assert.strictEqual(notificationFormat.getHandoffTitle('linepay_failed'), '【LINE Pay 付款失敗】');
  assert.strictEqual(notificationFormat.getHandoffTitle('high_value_order'), '【金額異常】');
});

test('getHandoffTitle 未知 type → 【一般轉報】+ logger.warn', () => {
  const originalStderr = process.stderr.write.bind(process.stderr);
  let warnCalled = false;
  let warnMessage = '';
  process.stderr.write = (msg) => {
    warnCalled = true;
    warnMessage += String(msg);
    return true;
  };
  try {
    const fallback = notificationFormat.getHandoffTitle('unknown_type_xyz');
    assert.strictEqual(fallback, '【一般轉報】', '未知 type → 【一般轉報】');
    assert.ok(warnCalled, '未知 type 應觸發 logger.warn');
    assert.ok(warnMessage.includes('unknown_type_xyz'), 'warn 應含未知 type 名稱');
  } finally {
    process.stderr.write = originalStderr;
  }
});

test('HANDOFF_TITLES 與 transferRules 同步 + 所有 title【xxx】格式', () => {
  const triggerTypes = [];
  if (transferRules.TRIGGER_PATTERNS && typeof transferRules.TRIGGER_PATTERNS === 'object') {
    for (const pattern of transferRules.TRIGGER_PATTERNS) {
      if (pattern.type) triggerTypes.push(pattern.type);
    }
  }
  const filteredTypes = [...new Set(triggerTypes)].filter((t) => t !== 'general');

  const missingTypes = filteredTypes.filter((t) => !(t in notificationFormat.HANDOFF_TITLES));
  assert.deepStrictEqual(missingTypes, [], `HANDOFF_TITLES 應涵蓋所有 triggerTypes, 缺: ${missingTypes.join(', ')}`);

  const titleKeys = Object.keys(notificationFormat.HANDOFF_TITLES);
  assert.ok(titleKeys.length >= 12, `HANDOFF_TITLES 應至少 12 個 type, 實際: ${titleKeys.length}`);

  for (const key of titleKeys) {
    const title = notificationFormat.HANDOFF_TITLES[key];
    assert.match(title, /^【.+】$/, `${key} → ${title} 應為【xxx】格式`);
  }
});

// === Round 29 P0.2 補強：邊界值 + 個別 handoff_type ===

test('formatLINENotification chicken_items 空物件 → 不顯示雞肉行', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A', chicken_items: {} };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  assert.ok(!msg.includes('🍗 雞肉'), '空物件不應顯示雞肉行');
});

test('formatLINENotification side_items 空物件 → 不顯示小菜行', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A', side_items: {} };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  assert.ok(!msg.includes('🥗 小菜'), '空物件不應顯示小菜行');
});

test('formatLINENotification total_amount = 0 → 不顯示金額行（falsy）', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A', total_amount: 0 };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  assert.ok(!msg.includes('💰 訂單金額'), 'total_amount=0 不顯示金額行');
});

test('formatLINENotification handoff_type 缺 → 預設 general_inquiry', () => {
  const order = { order_id: 'X', user_line_name: 'A' };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  assert.ok(msg.includes('【一般轉報】'), '缺 handoff_type → 【一般轉報】');
});

test('formatLINENotification chicken_items 無效 JSON → 拋出（不靜默吞）', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A', chicken_items: 'invalid' };
  // source 對字串直接 JSON.parse，無效會 throw — 確認這個行為（未來可能要改成容錯）
  assert.throws(
    () => notificationFormat.formatLINENotification(order, 'msg'),
    SyntaxError,
  );
});

test('formatLINENotification 各 handoff_type 標題正確（8 種 + general fallback）', () => {
  const cases = [
    ['refund_request', '【退貨/退款】'],
    ['cancel_request', '【取消訂單】'],
    ['reschedule_request', '【改天需求】'],
    ['complaint', '【售後/客訴】'],
    ['escalation', '【客訴/爭議】'],
    ['explicit_request', '【明確要求真人】'],
    ['discount_request', '【折扣請求】'],
    ['high_value_order', '【金額異常】'],
  ];
  for (const [type, expectedTitle] of cases) {
    const order = { order_id: 'X', handoff_type: type, user_line_name: 'A' };
    const msg = notificationFormat.formatLINENotification(order, 'msg');
    assert.ok(msg.includes(expectedTitle), `${type} 應含 ${expectedTitle}`);
  }
});

test('formatLINENotificationMessage 缺欄位 → text 還是 string 且不 crash', () => {
  const order = {};
  const obj = notificationFormat.formatLINENotificationMessage(order, 'test');
  assert.strictEqual(obj.type, 'text');
  assert.strictEqual(typeof obj.text, 'string');
  assert.ok(obj.text.length > 0);
});

test('getHandoffTitle 全部 16 個 HANDOFF_TITLES key 都對應正確 title', () => {
  const expected = {
    refund_request: '【退貨/退款】',
    cancel_request: '【取消訂單】',
    reschedule_request: '【改天需求】',
    complaint: '【售後/客訴】',
    escalation: '【客訴/爭議】',
    explicit_request: '【明確要求真人】',
    discount_request: '【折扣請求】',
    delivery_confirm_needed: '【配送範圍確認】',
    bulk_order: '【大批訂單/公司合作】',
    high_value_order: '【金額異常】',
    payment_mismatch: '【付款異常】',
    linepay_failed: '【LINE Pay 付款失敗】',
    open_date_inquiry: '【開團日期確認】',
    late_modify: '【截單後變更】',
    general: '【一般轉報】',
    general_inquiry: '【一般轉報】',
  };
  for (const [type, title] of Object.entries(expected)) {
    assert.strictEqual(notificationFormat.getHandoffTitle(type), title, `${type} → ${title}`);
  }
});

test('getHandoffTitle null → 【一般轉報】+ warn', () => {
  const originalStderr = process.stderr.write.bind(process.stderr);
  let warnCalled = false;
  process.stderr.write = (_msg) => { warnCalled = true; return true; };
  try {
    assert.strictEqual(notificationFormat.getHandoffTitle(null), '【一般轉報】');
    assert.ok(warnCalled, 'null 應觸發 logger.warn');
  } finally {
    process.stderr.write = originalStderr;
  }
});

test('getHandoffTitle undefined → 【一般轉報】+ warn', () => {
  const originalStderr = process.stderr.write.bind(process.stderr);
  let warnCalled = false;
  process.stderr.write = (_msg) => { warnCalled = true; return true; };
  try {
    assert.strictEqual(notificationFormat.getHandoffTitle(undefined), '【一般轉報】');
    assert.ok(warnCalled, 'undefined 應觸發 logger.warn');
  } finally {
    process.stderr.write = originalStderr;
  }
});

test('getHandoffTitle 空字串 → 【一般轉報】+ warn', () => {
  const originalStderr = process.stderr.write.bind(process.stderr);
  let warnCalled = false;
  process.stderr.write = (_msg) => { warnCalled = true; return true; };
  try {
    assert.strictEqual(notificationFormat.getHandoffTitle(''), '【一般轉報】');
    assert.ok(warnCalled, '空字串應觸發 logger.warn');
  } finally {
    process.stderr.write = originalStderr;
  }
});

test('formatLINENotification AI 已回覆內容是固定字串', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A' };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  assert.ok(msg.includes('目前老闆再忙，後續會再回覆您，請留意 LINE 通知，謝謝！'));
  assert.ok(msg.includes('🤖 AI 已回覆內容'));
});

test('formatLINENotification 時間格式 zh-TW', () => {
  const order = { order_id: 'X', handoff_type: 'general_inquiry', user_line_name: 'A' };
  const msg = notificationFormat.formatLINENotification(order, 'msg');
  // 包含「⏰ 發生時間：」+ zh-TW locale 格式（年/月/日 時:分）
  assert.match(msg, /⏰ 發生時間：\d{4}\/\d{1,2}\/\d{1,2}/);
});

