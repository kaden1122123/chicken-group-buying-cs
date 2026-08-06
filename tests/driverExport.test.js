'use strict';

/**
 * 司機出貨單匯出測試（Round 37.24 · Hubert 16:23）
 * 模擬 dashboard.html 內 exportDriverSheet() 的 CSV 產生邏輯
 * 測試欄位：到貨時段 | 客戶姓名 | 電話 | 配送地址(含社區) | 配送品項 | 應收金額
 */

const assert = require('assert');
const { test } = require('node:test');

// 模擬 exportDriverSheet 中的 CSV 產生（與 dashboard.html 邏輯一致）
function parseItemsField(field) {
  if (!field) return {};
  if (typeof field === 'object') return field;
  if (typeof field !== 'string') return {};
  const s = field.trim();
  if (!s || s === '{}' || s === '[]') return {};
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const obj = JSON.parse(s);
      if (typeof obj === 'object' && obj !== null) return obj;
    } catch (e) {}
  }
  const result = {};
  const parts = s.split('|');
  parts.forEach(function (part) {
    const m = part.match(/^(.+?)\s*[xX×]\s*(\d+)/);
    if (m) {
      const name = m[1].trim();
      const qty = parseInt(m[2], 10) || 0;
      if (name && qty > 0) result[name] = (result[name] || 0) + qty;
    }
  });
  return result;
}

function formatItemsForDisplay(ch, sd, ex) {
  const parts = [];
  Object.keys(ch).forEach((k) => parts.push('🐔 ' + k + 'x' + ch[k]));
  Object.keys(sd).forEach((k) => parts.push('🥒 ' + k + 'x' + sd[k]));
  Object.keys(ex).forEach((k) => parts.push('➕ ' + k + 'x' + ex[k]));
  return parts.length ? parts.join('、') : '—';
}

function buildDriverRow(order) {
  const timeSlot = (order.time_slot || '').toLowerCase() === 'morning' ? '上午 🌞' :
    ((order.time_slot || '').toLowerCase() === 'afternoon' ? '下午 🌛' : (order.time_slot || '—'));
  const amount = parseFloat(order.total_amount) || 0;
  const ps = (order.payment_status || '').toLowerCase();
  const amountStr = ps === 'paid' ?
    '已付 NT$ ' + Math.round(amount).toLocaleString('zh-TW') :
    'NT$ ' + Math.round(amount).toLocaleString('zh-TW');
  const address = (order.address || '') + (order.community ? ' (' + order.community + ')' : '');
  const itemsStr = formatItemsForDisplay(
    parseItemsField(order.chicken_items),
    parseItemsField(order.side_items),
    parseItemsField(order.extra_items),
  ).replace(/<br>/g, '、').replace(/<[^>]+>/g, '');
  return [
    timeSlot,
    order.user_line_name || '—',
    order.user_phone || '—',
    address,
    itemsStr || '—',
    amountStr,
  ];
}

function buildDriverCSV(orders) {
  const headers = ['到貨時段', '客戶姓名', '電話', '配送地址(含社區)', '配送品項', '應收金額'];
  const rows = [headers];
  orders.forEach(function (o) { rows.push(buildDriverRow(o)); });
  return '\ufeff' + rows.map(function (r) {
    return r.map(function (cell) {
      const s = String(cell);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
}

function parseCSV(csv) {
  // 跳過 BOM
  const s = csv.startsWith('\ufeff') ? csv.slice(1) : csv;
  const lines = s.split('\n');
  return lines.map(function (line) {
    const result = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur);
    return result;
  });
}

// ===== Tests =====

test('buildDriverRow — 訂單各欄位正確', () => {
  const order = {
    delivery_date: '2026-08-05',
    time_slot: 'afternoon',
    user_line_name: '王小明',
    user_phone: '0912345678',
    address: '新北市三峽區學成路100號',
    community: '三峽大埔社區',
    chicken_items: '{"鹽水雞":1}',
    side_items: '{"毛豆":1}',
    extra_items: {},
    total_amount: 490,
    payment_status: 'pending_verify',
  };
  const row = buildDriverRow(order);
  assert.strictEqual(row[0], '下午 🌛');
  assert.strictEqual(row[1], '王小明');
  assert.strictEqual(row[2], '0912345678');
  assert.strictEqual(row[3], '新北市三峽區學成路100號 (三峽大埔社區)');
  assert.ok(row[4].includes('🐔 鹽水雞x1') && row[4].includes('🥒 毛豆x1'));
  assert.strictEqual(row[5], 'NT$ 490'); // 未付款無「已付」
});

test('buildDriverRow — 已付款顯示「已付」', () => {
  const order = {
    time_slot: 'morning',
    user_line_name: '林美玲',
    user_phone: '0923456789',
    address: '新北市鶯歌區中正一路50號',
    community: '',
    chicken_items: '{"甘蔗煙燻雞":2}',
    side_items: {},
    extra_items: {},
    total_amount: 760,
    payment_status: 'paid',
  };
  const row = buildDriverRow(order);
  assert.strictEqual(row[5], '已付 NT$ 760');
});

test('buildDriverRow — 金額千分位', () => {
  const order = {
    time_slot: 'afternoon',
    user_line_name: '張大衛',
    user_phone: '0934567890',
    address: '新北市三峽區介壽路二段88號',
    community: '三峽學成社區',
    chicken_items: '{"玉米雞":1}',
    side_items: '{"頂級魚子鮮燒賣":2}',
    extra_items: {},
    total_amount: 1020,
    payment_status: 'paid',
  };
  const row = buildDriverRow(order);
  assert.strictEqual(row[5], '已付 NT$ 1,020'); // 千分位
});

test('buildDriverRow — 缺社區不顯示括號', () => {
  const order = {
    time_slot: 'morning',
    user_line_name: 'A',
    user_phone: '0911111111',
    address: 'X',
    community: '',
    chicken_items: '{"鹽水雞":1}',
    side_items: {},
    extra_items: {},
    total_amount: 380,
    payment_status: 'paid',
  };
  const row = buildDriverRow(order);
  assert.strictEqual(row[3], 'X'); // 沒有 (community)
});

test('buildDriverRow — 上午/下午 emoji 正確', () => {
  const morning = buildDriverRow({ time_slot: 'morning', user_line_name: 'A', user_phone: '091', address: 'X', community: '', chicken_items: '{"鹽水雞":1}', side_items: {}, extra_items: {}, total_amount: 380, payment_status: 'paid' });
  const afternoon = buildDriverRow({ time_slot: 'afternoon', user_line_name: 'A', user_phone: '091', address: 'X', community: '', chicken_items: '{"鹽水雞":1}', side_items: {}, extra_items: {}, total_amount: 380, payment_status: 'paid' });
  assert.strictEqual(morning[0], '上午 🌞');
  assert.strictEqual(afternoon[0], '下午 🌛');
});

test('buildDriverCSV — 6 欄 header + 1 BOM', () => {
  const orders = [
    { time_slot: 'afternoon', user_line_name: '王小明', user_phone: '0912345678', address: 'X', community: '', chicken_items: '{"鹽水雞":1}', side_items: '{"毛豆":1}', extra_items: {}, total_amount: 490, payment_status: 'pending_verify' },
  ];
  const csv = buildDriverCSV(orders);
  assert.ok(csv.startsWith('\ufeff'), '必須有 BOM（Excel 中文不亂碼）');
  const parsed = parseCSV(csv);
  assert.strictEqual(parsed.length, 2); // header + 1 row
  assert.deepStrictEqual(parsed[0], ['到貨時段', '客戶姓名', '電話', '配送地址(含社區)', '配送品項', '應收金額']);
  assert.strictEqual(parsed[1].length, 6);
});

test('buildDriverCSV — 多筆訂單排序（delivery_date + time_slot 優先級）', () => {
  const orders = [
    { delivery_date: '2026-08-05', time_slot: 'afternoon', user_line_name: 'B', user_phone: '1', address: 'X', community: '', chicken_items: '{"鹽水雞":1}', side_items: {}, extra_items: {}, total_amount: 380, payment_status: 'paid' },
    { delivery_date: '2026-08-05', time_slot: 'morning', user_line_name: 'A', user_phone: '2', address: 'Y', community: '', chicken_items: '{"鹽水雞":1}', side_items: {}, extra_items: {}, total_amount: 380, payment_status: 'paid' },
  ];
  // 司機單按 date + time_slot 優先級排序：A 上午 → B 下午
  const slotPriority = { morning: 1, afternoon: 2, evening: 3 };
  orders.sort(function (a, b) {
    const da = (a.delivery_date || '').substring(0, 10);
    const db = (b.delivery_date || '').substring(0, 10);
    if (da !== db) return da.localeCompare(db);
    const sa = slotPriority[(a.time_slot || '').toLowerCase()] || 99;
    const sb = slotPriority[(b.time_slot || '').toLowerCase()] || 99;
    return sa - sb;
  });
  assert.strictEqual(orders[0].user_line_name, 'A');
  assert.strictEqual(orders[1].user_line_name, 'B');
});

test('buildDriverRow — 處理空品項（顯示「—」）', () => {
  const order = {
    time_slot: 'morning',
    user_line_name: 'Test',
    user_phone: '091',
    address: 'X',
    community: '',
    chicken_items: '{}',
    side_items: '{}',
    extra_items: {},
    total_amount: 0,
    payment_status: 'pending',
  };
  const row = buildDriverRow(order);
  assert.strictEqual(row[4], '—');
  assert.strictEqual(row[5], 'NT$ 0');
});
