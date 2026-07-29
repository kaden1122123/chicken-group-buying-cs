'use strict';

/**
 * buildEmailContent.test.js
 *
 * 測試 src/handoff/notifier.js 的 buildEmailContent 函式
 * （v5 樣式：純文字大標題 + 分隔線 + emoji 中標題）
 *
 * 4 種 type 版型：
 * - handoff（含 trigger 變體：refund_request / delivery_confirm_needed）
 * - autoOrder（成功 / 失敗 / 錯誤訊息）
 * - digest（總筆數來源：meta.total / messageText.length / 預設「?」）
 * - system（預設 fallback，metadata.context 加 Context section）
 *
 * + 輔助測試：dashboard URL（env + order_id）、helper（fmtMoney 千分位）
 *
 * Mocks 策略：
 * - node:test + assert（無第三方 mock framework）
 * - notifier module reload pattern（清 cache → re-require）
 * - process.env.DASHBOARD_URL 控制（最後清理 env）
 */

const { test } = require('node:test');
const assert = require('assert');

const notifierPath = require.resolve('../src/handoff/notifier');

function reloadNotifier() {
  delete require.cache[notifierPath];
  return require(notifierPath);
}

// === Group 1: handoff type（9 tests）===

test('handoff — 基本欄位（trigger_label + customer + items + payment）', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('客戶原始訊息', {
    type: 'handoff',
    metadata: {
      trigger_label: '退貨/退款',
      order_id: 'ORD-001',
      user_line_name: '王小明',
      user_line_id: 'U123',
      user_phone: '0912345678',
      address: '三峽區學成路100號',
      chicken_items: { 鹽水雞: 2 },
      total_boxes: 2,
      total_amount: 760,
      payment_method: 'cash',
      payment_status: 'pending',
    },
  });
  assert.ok(result.subject.includes('轉真人通知'), 'subject 應含「轉真人通知」');
  assert.match(result.body, /🔔 雞味研究所 — 轉真人通知/);
  assert.match(result.body, /退貨\/退款/);
  assert.ok(result.body.includes('王小明'));
  assert.ok(result.body.includes('0912345678'));
  assert.ok(result.body.includes('三峽區學成路100號'));
  assert.ok(result.body.includes('客戶原始訊息'));
  assert.match(result.body, /🍗 雞肉：鹽水雞×2/);
  assert.match(result.body, /NT\$ 760/);
  assert.match(result.body, /現金/);
  assert.match(result.body, /pending|待處理/);
});

test('handoff — 缺欄位 fallback 為「—」', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: { trigger_label: 'test' },
  });
  // field() 函式使用 padEnd 加空格，regex 需要 \s+ 容許中間空格
  assert.match(result.body, /order_id：\s+—/);
  assert.match(result.body, /名稱：\s+—/);
  assert.match(result.body, /電話：\s+—/);
  assert.match(result.body, /地址：\s+—/);
  assert.match(result.body, /客戶訊息/, '應含「客戶訊息」section');
});

test('handoff — 無 chicken_items 不顯示品項 section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: { trigger_label: 'test', order_id: 'ORD-001' },
  });
  assert.ok(!result.body.includes('📦 訂單品項'));
  assert.ok(!result.body.includes('🍗 雞肉'));
});

test('handoff — chicken_items 字串 JSON 也能解析', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: 'test',
      order_id: 'ORD-001',
      chicken_items: JSON.stringify({ 鹽水雞: 3 }),
    },
  });
  assert.match(result.body, /🍗 雞肉：鹽水雞×3/);
});

test('handoff — chicken_items 無效 JSON → 不顯示', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: 'test',
      order_id: 'ORD-001',
      chicken_items: 'invalid json',
    },
  });
  assert.ok(!result.body.includes('🍗 雞肉'));
});

test('handoff — trigger_type refund_request 加退款 section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('我要退錢', {
    type: 'handoff',
    metadata: {
      trigger_type: 'refund_request',
      trigger_label: '退貨/退款',
      order_id: 'ORD-002',
      refund_amount: 760,
      refund_reason: '客戶不滿意',
    },
  });
  assert.match(result.body, /💸 退款資訊/);
  assert.match(result.body, /NT\$ 760/);
  assert.match(result.body, /客戶不滿意/);
});

test('handoff — refund_amount 存在但 trigger_type 沒設 → 仍加退款 section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: '退貨',
      order_id: 'ORD-002A',
      refund_amount: 500,
    },
  });
  assert.match(result.body, /💸 退款資訊/);
});

test('handoff — trigger_type delivery_confirm_needed 加地址 section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('地址不確定', {
    type: 'handoff',
    metadata: {
      trigger_type: 'delivery_confirm_needed',
      trigger_label: '配送範圍確認',
      order_id: 'ORD-003',
      address: '新北市林口區',
      address_difficulty: '偏遠',
      address_note: '需打電話確認',
    },
  });
  assert.match(result.body, /📍 地址確認/);
  assert.match(result.body, /新北市林口區/);
  assert.match(result.body, /偏遠/);
  assert.match(result.body, /需打電話確認/);
});

test('handoff — payment_method 未知 → 顯示原值', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: 'test',
      order_id: 'ORD-004',
      payment_method: 'unknown_method',
    },
  });
  assert.match(result.body, /付款方式：\s+unknown_method/);
});

test('handoff — trigger_label fallback 順序: trigger_label > handoff_type > 轉真人', () => {
  const notifier = reloadNotifier();
  const r1 = notifier.buildEmailContent('x', {
    type: 'handoff',
    metadata: { trigger_label: 'MyLabel' },
  });
  assert.match(r1.body, /handoff（MyLabel）/);

  const r2 = notifier.buildEmailContent('x', {
    type: 'handoff',
    metadata: { handoff_type: 'TypeB' },
  });
  assert.match(r2.body, /handoff（TypeB）/);

  const r3 = notifier.buildEmailContent('x', { type: 'handoff', metadata: {} });
  assert.match(r3.body, /handoff（轉真人）/);
});

test('handoff — side_items + extra_items 解析', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: 't',
      order_id: 'ORD-005',
      chicken_items: { 雞腿: 1 },
      side_items: { 涼拌小黃瓜: 2 },
      extra_items: { 加辣: 1 },
    },
  });
  assert.match(result.body, /🍗 雞肉：雞腿×1/);
  assert.match(result.body, /🥗 小菜：涼拌小黃瓜×2/);
  assert.match(result.body, /➕ 加購：加辣×1/);
});

// === Group 2: autoOrder type（6 tests）===

test('autoOrder — 成功建單', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-A001',
      success: true,
      user_line_name: '王小明',
      user_line_id: 'U123',
      user_phone: '0912345678',
      address: '三峽區',
      chicken_items: { 雞腿: 1 },
      delivery_date: '2026-08-01',
      time_slot: '10:00~12:00',
      community: '三鶯',
      subtotal: 600,
      delivery_fee: 80,
      total_amount: 680,
      payment_method: 'transfer',
      payment_status: 'confirmed',
    },
  });
  assert.match(result.body, /🤖 雞味研究所 — B 方案自動建單/);
  assert.match(result.body, /✅ 成功/);
  assert.match(result.body, /NT\$ 680/);
  assert.match(result.body, /轉帳/);
  assert.match(result.body, /confirmed|已確認/);
});

test('autoOrder — 失敗建單', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-A002',
      success: false,
      user_line_name: '王小明',
      error: 'API timeout',
    },
  });
  assert.match(result.body, /❌ 失敗/);
  assert.match(result.body, /API timeout/);
});

test('autoOrder — failure_reason 顯示', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-A003',
      success: false,
      failure_reason: 'Payment gateway down',
    },
  });
  assert.match(result.body, /Payment gateway down/);
});

test('autoOrder — 缺金額顯示「—」', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: { order_id: 'ORD-A004' },
  });
  assert.match(result.body, /小計：\s+NT\$ —/);
  assert.match(result.body, /總計：\s+NT\$ —/);
});

test('autoOrder — 無品項不顯示品項 section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: { order_id: 'ORD-A005' },
  });
  assert.ok(!result.body.includes('🍗 品項詳情'));
  assert.ok(!result.body.includes('🍗 雞肉'));
});

test('autoOrder — 含配送資訊', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-X',
      delivery_date: '2026-08-01',
      time_slot: 'AM',
      community: '三鶯',
    },
  });
  assert.match(result.body, /📦 配送資訊/);
  assert.match(result.body, /2026-08-01/);
  assert.match(result.body, /AM/);
  assert.match(result.body, /三鶯/);
});

// === Group 3: digest type（4 tests）===

test('digest — meta.total 顯示總筆數', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('order details here', {
    type: 'digest',
    metadata: { total: 42 },
  });
  assert.match(result.body, /總筆數：42/);
  // title 函式插了 `雞味研究所 — ` 中間
  assert.match(result.body, /📊 雞味研究所 — 訂單彙總/);
  assert.match(result.body, /order details here/);
});

test('digest — 無 meta.total 用 messageText.length', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('abc', { type: 'digest' });
  assert.match(result.body, /總筆數：3/);
});

test('digest — 都沒有 → 顯示「?」', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('', { type: 'digest' });
  assert.match(result.body, /總筆數：\?/);
});

test('digest — subject 含 📊 prefix', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', { type: 'digest' });
  assert.match(result.subject, /📊 訂單彙總/);
});

// === Group 4: system type（5 tests）===

test('system — 無 metadata 只有 messageText', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('Hello system', { type: 'system' });
  assert.match(result.body, /⚙️ 雞味研究所 — 系統通知/);
  assert.match(result.body, /Hello system/);
  assert.ok(!result.body.includes('🔍 Context'));
});

test('system — metadata.context 加 Context section', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('Hello', {
    type: 'system',
    metadata: { context: 'extra debug info' },
  });
  assert.match(result.body, /🔍 Context/);
  assert.match(result.body, /extra debug info/);
});

test('system — message object → JSON.stringify 2-space', () => {
  const notifier = reloadNotifier();
  const obj = { foo: 'bar', n: 42 };
  const result = notifier.buildEmailContent(obj, { type: 'system' });
  assert.match(result.body, /"foo": "bar"/);
  assert.match(result.body, /"n": 42/);
});

test('system — 沒傳 options.type → 預設 system', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test');
  assert.match(result.body, /⚙️ 雞味研究所 — 系統通知/);
});

test('system — 空 message → 空 section 不 crash', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('', { type: 'system' });
  assert.ok(typeof result.body === 'string');
  assert.ok(result.body.length > 0);
});

// === Group 5: helper functions（3 tests，透過 output 驗證）===

test('helper — fmtMoney 千分位', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: { order_id: 'X', subtotal: 1234567 },
  });
  assert.match(result.body, /NT\$ 1,234,567/);
});

test('helper — fmtMoney null → 「—」', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: { order_id: 'X', subtotal: null },
  });
  assert.match(result.body, /NT\$ —/);
});

test('helper — fmtMoney 非數字 → 原字串', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'autoOrder',
    metadata: { order_id: 'X', subtotal: 'free' },
  });
  assert.match(result.body, /NT\$ free/);
});

// === Group 6: dashboard URL（3 tests）===

test('dashboard URL — 有 order_id → 加 ?order=X', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff', // system type 不含 dashboard URL，用 handoff
    metadata: { trigger_label: 't', order_id: 'ORD-XYZ' },
  });
  assert.match(result.body, /\?order=ORD-XYZ/);
});

test('dashboard URL — 無 order_id → 只有 base', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff', // system type 不含 dashboard URL，用 handoff
    metadata: { trigger_label: 't' },
  });
  assert.ok(result.body.includes('https://100.114.197.9:3000/admin'));
  assert.ok(!result.body.includes('?order='));
});

test('dashboard URL — DASHBOARD_URL env 覆蓋預設', () => {
  const originalUrl = process.env.DASHBOARD_URL;
  process.env.DASHBOARD_URL = 'https://custom.example.com/dashboard';
  try {
    const notifier = reloadNotifier();
    const result = notifier.buildEmailContent('test', {
      type: 'handoff', // system type 不含 dashboard URL，用 handoff
      metadata: { trigger_label: 't' },
    });
    assert.match(result.body, /https:\/\/custom\.example\.com\/dashboard/);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.DASHBOARD_URL;
    } else {
      process.env.DASHBOARD_URL = originalUrl;
    }
  }
});

// === Group 7: misc（3 tests）===

test('subject — 統一 prefix【雞味研究所】4 種 type 都成立', () => {
  const notifier = reloadNotifier();
  const types = ['handoff', 'autoOrder', 'digest', 'system'];
  for (const t of types) {
    const result = notifier.buildEmailContent('x', { type: t, metadata: {} });
    assert.match(result.subject, /【雞味研究所】/, `type=${t} subject 應有 prefix`);
  }
});

test('return shape — {subject, body} 兩欄位都是 string', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', { type: 'system' });
  assert.strictEqual(typeof result.subject, 'string');
  assert.strictEqual(typeof result.body, 'string');
  assert.ok(result.subject.length > 0);
  assert.ok(result.body.length > 0);
});

test('buildEmailContent 是 notifier module 的 export', () => {
  const notifier = reloadNotifier();
  assert.strictEqual(typeof notifier.buildEmailContent, 'function');
});

// === Group 8: edge cases（3 tests）===

test('handoff — message 空字串 → 顯示「（無）」', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('', {
    type: 'handoff',
    metadata: { trigger_label: 't', order_id: 'ORD-X' },
  });
  assert.match(result.body, /（無）/);
});

test('handoff — total_amount=0 但 payment_method 有值 → 付款 section 仍顯示', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', {
    type: 'handoff',
    metadata: {
      trigger_label: 't',
      order_id: 'ORD-Z',
      total_amount: 0,
      payment_method: 'cash',
    },
  });
  // source: `if (meta.total_amount || meta.payment_method)` — 任一 truthy 即顯示
  assert.ok(result.body.includes('💰 付款資訊'));
});

test('subject — 含 ts 時間戳', () => {
  const notifier = reloadNotifier();
  const result = notifier.buildEmailContent('test', { type: 'system' });
  // ts 格式 YYYY-MM-DD HH:MM:SS
  assert.match(result.subject, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});
