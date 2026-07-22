'use strict';

/**
 * orderFormatter 測試（Session H H4）
 */

const assert = require('assert');
const { test } = require('node:test');

const orderFormatter = require('../src/order/orderFormatter');

test('calculatePrice 半隻雞單一', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 1 },
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 380);
  assert.strictEqual(r.delivery_fee, 0);
  assert.strictEqual(r.total_amount, 380);
});

test('calculatePrice 整隻雞單一（NT$820, chicken_count = 2）', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 玉米雞: 1 },
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 820);
  assert.strictEqual(r.delivery_fee, 0);
  assert.strictEqual(r.chicken_count, 2, '整隻雞 1 隻 = 2 盒');
  assert.strictEqual(r.total_boxes, 2);
});

test('calculatePrice 多項雞肉（半隻 + 半隻 = 3 盒）', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 2, 甘蔗煙燻雞: 1 },
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 380 * 2 + 380 * 1);
  assert.strictEqual(r.chicken_count, 3, '2 半隻 + 1 半隻 = 3 盒');
});

test('calculatePrice 半隻 + 整隻 = 3 盒', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 1, 玉米雞: 1 },
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 380 + 820);
  assert.strictEqual(r.chicken_count, 3, '1 半隻 + 1 整隻 = 1 + 2 = 3 盒');
});

test('calculatePrice 雞肉 + 小菜加總', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 1 },
    side_items: { 秘製黑胡椒蒜味毛豆: 2 },
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 380 + 70 * 2);
  assert.strictEqual(r.chicken_count, 1);
  assert.strictEqual(r.side_count, 2);
});

test('calculatePrice 純小菜未滿 350 收運費 80', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: {},
    side_items: { 秘製黑胡椒蒜味毛豆: 2 },
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 140);
  assert.strictEqual(r.delivery_fee, 80, '小菜未滿 350 收運費 80');
  assert.strictEqual(r.total_amount, 220);
});

test('calculatePrice 純小菜滿 350 免運', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: {},
    side_items: { 秘製麻油粉肝: 4 }, // 100 * 4 = 400
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 400);
  assert.strictEqual(r.delivery_fee, 0, '小菜滿 350 免運');
});

test('calculatePrice 加購品不影響運費判斷', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 1 },
    side_items: {},
    extra_items: { 雞脖子: 5 }, // 10 * 5 = 50
  });
  assert.strictEqual(r.subtotal, 380 + 50);
  assert.strictEqual(r.delivery_fee, 0, '有雞肉免運（加購品不影響）');
});

test('calculatePrice 純加購品（邊界）', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: {},
    side_items: {},
    extra_items: { 雞脖子: 3 },
  });
  assert.strictEqual(r.subtotal, 30);
  assert.strictEqual(r.delivery_fee, 0, '純加購品運費 = 0（邊界）');
});

test('calculatePrice 空訂單全部 = 0', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: {},
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 0);
  assert.strictEqual(r.delivery_fee, 0);
  assert.strictEqual(r.total_amount, 0);
  assert.strictEqual(r.chicken_count, 0);
  assert.strictEqual(r.side_count, 0);
  assert.strictEqual(r.total_boxes, 0);
});

test('calculatePrice 未知品項 fallback 為 0', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 神秘雞: 1 },
    side_items: {},
    extra_items: {},
  });
  assert.strictEqual(r.subtotal, 0, '未知品項價格 = 0');
});

test('calculatePrice total_boxes = chicken_count + side_count（不含加購）', () => {
  const r = orderFormatter.calculatePrice({
    chicken_items: { 鹽水雞: 2 },
    side_items: { 秘製黑胡椒蒜味毛豆: 3 },
    extra_items: { 雞脖子: 10 },
  });
  assert.strictEqual(r.total_boxes, r.chicken_count + r.side_count, 'total_boxes = chicken_count + side_count（不含加購）');
});

test('formatItemsDisplay 全空回傳「（未填寫品項）」', () => {
  assert.strictEqual(orderFormatter.formatItemsDisplay({}), '（未填寫品項）');
});

test('formatItemsDisplay 只有雞肉（含 🐔 emoji）', () => {
  const d = orderFormatter.formatItemsDisplay({
    chicken_items: { 鹽水雞: 2 },
    side_items: {},
    extra_items: {},
  });
  assert.ok(d.includes('🐔 鹽水雞 x2'));
});

test('formatItemsDisplay 只有小菜（含 🥒 emoji）', () => {
  const d = orderFormatter.formatItemsDisplay({
    chicken_items: {},
    side_items: { 秘製黑胡椒蒜味毛豆: 1 },
    extra_items: {},
  });
  assert.ok(d.includes('🥒 秘製黑胡椒蒜味毛豆 x1'));
});

test('formatItemsDisplay 只有加購（含 ➕ emoji）', () => {
  const d = orderFormatter.formatItemsDisplay({
    chicken_items: {},
    side_items: {},
    extra_items: { 雞脖子: 5 },
  });
  assert.ok(d.includes('➕ 雞脖子 x5'));
});

test('formatItemsDisplay 雞肉 + 小菜 + 加購（3 種 emoji 都有）', () => {
  const d = orderFormatter.formatItemsDisplay({
    chicken_items: { 鹽水雞: 1 },
    side_items: { 秘製黑胡椒蒜味毛豆: 2 },
    extra_items: { 雞脖子: 3 },
  });
  assert.ok(d.includes('🐔'));
  assert.ok(d.includes('🥒'));
  assert.ok(d.includes('➕'));
});

test('formatItemsDisplay 多個雞肉品項分行顯示', () => {
  const d = orderFormatter.formatItemsDisplay({
    chicken_items: { 鹽水雞: 2, 玉米雞: 1 },
    side_items: {},
    extra_items: {},
  });
  const lines = d.split('\n');
  assert.strictEqual(lines.length, 2, '應有 2 行');
});

test('formatOrderSummary 完整訂單（morning + 轉帳 + 免運）', () => {
  const s = orderFormatter.formatOrderSummary({
    user_line_name: '王小明',
    user_phone: '0912345678',
    address: '三峽北大特區學成路100號',
    community: '',
    delivery_date: '2026-06-19',
    time_slot: 'morning',
    chicken_items: { 鹽水雞: 2 },
    side_items: {},
    extra_items: {},
    payment_method: 'transfer',
  });
  assert.ok(s.includes('📋 訂單確認'));
  assert.ok(s.includes('王小明'));
  assert.ok(s.includes('0912345678'));
  assert.ok(s.includes('三峽北大特區學成路100號'));
  assert.ok(s.includes('2026-06-19'));
  assert.ok(s.includes('🌞 上午'));
  assert.ok(s.includes('轉帳') || s.includes('transfer'));
  assert.ok(s.includes('✔️ 免運') || s.includes('免運'));
});

test('formatOrderSummary afternoon 時段', () => {
  const s = orderFormatter.formatOrderSummary({
    user_line_name: '陳小姐',
    user_phone: '0987654321',
    address: '三峽老街48號',
    community: '',
    delivery_date: '2026-06-20',
    time_slot: 'afternoon',
    chicken_items: { 鹽水雞: 1 },
    side_items: {},
    extra_items: {},
    payment_method: 'linepay',
  });
  assert.ok(s.includes('🌛 下午'));
});

test('formatOrderSummary 缺欄位顯示「（未填寫）」', () => {
  const s = orderFormatter.formatOrderSummary({
    time_slot: 'morning',
    chicken_items: {},
    side_items: {},
    extra_items: {},
  });
  assert.ok(s.includes('（未填寫）'));
  assert.ok(s.includes('（未選擇）'));
});

test('formatOrderSummary 有社區時顯示', () => {
  const s = orderFormatter.formatOrderSummary({
    user_line_name: 'A',
    user_phone: '0911111111',
    address: 'X',
    community: '三峽大埔社區',
    delivery_date: '2026-06-19',
    time_slot: 'morning',
    chicken_items: { 鹽水雞: 1 },
    side_items: {},
    extra_items: {},
    payment_method: 'cash',
  });
  assert.ok(s.includes('🏢社區：三峽大埔社區'));
});

test('formatOrderSummary 包含「請回覆確認」CTA', () => {
  const s = orderFormatter.formatOrderSummary({
    time_slot: 'morning',
    chicken_items: { 鹽水雞: 1 },
    side_items: {},
    extra_items: {},
    payment_method: 'cash',
  });
  assert.ok(s.includes('請回覆「確認」完成訂購'));
});

test('formatOrderDetail 完整 detail 格式', () => {
  const detail = orderFormatter.formatOrderDetail({
    order_id: 'ORD-20260619-001',
    created_at: '2026-06-18T10:00:00+08:00',
    user_line_name: '王小明',
    user_phone: '0912345678',
    address: '三峽北大特區學成路100號',
    community: '',
    delivery_date: '2026-06-19',
    time_slot: 'morning',
    chicken_items: { 鹽水雞: 2 },
    side_items: {},
    extra_items: {},
    total_amount: 760,
    payment_method: 'transfer',
    payment_status: 'pending',
    order_status: 'awaiting_payment',
    staff_notes: '',
    customer_notes: '',
    customer_tags: '',
    handoff_type: '',
  });
  assert.ok(detail.includes('order_id: ORD-20260619-001'));
  assert.ok(detail.includes('user_line_name: 王小明'));
  assert.ok(detail.includes('chicken_items: {"鹽水雞":2}'));
  assert.ok(detail.includes('total_amount: 760'));
  assert.ok(detail.includes('payment_status: pending'));
  assert.ok(detail.includes('order_status: awaiting_payment'));
});
