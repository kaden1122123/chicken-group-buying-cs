'use strict';

/**
 * calcTopItems parser 測試（Round 37.23 · Hubert 16:07 Dashboard 重構）
 *
 * 測試 dashboard.html 內的 parseItemsField 強健品項解析器：
 * 支援 3 種格式：
 *   (1) JSON 物件：{"鹽水雞":1}
 *   (2) 字串 "品項x數量|品項x數量"：鹽水雞x1|毛豆x2
 *   (3) 字串 "品項(說明) x 數量"：鹽水雞(半隻) x 2
 *
 * 因 dashboard.html 是前端檔，無法直接 require，故把 parseItemsField 邏輯
 * 重複到這裡測試（與 dashboard.html 內的版本保持同步，see `_dashboardParserReference`）
 */

const assert = require('assert');
const { test } = require('node:test');

// ===== 與 dashboard.html 內 parseItemsField 同步的參考實作（for unit test） =====
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
  parts.forEach(function(part) {
    const m = part.match(/^(.+?)\s*[xX×]\s*(\d+)/);
    if (m) {
      const name = m[1].trim();
      const qty = parseInt(m[2], 10) || 0;
      if (name && qty > 0) result[name] = (result[name] || 0) + qty;
    }
  });
  return result;
}

function calcTopItems(orders, topN) {
  topN = topN || 10;
  const counts = {};
  orders.forEach(function(o) {
    ['chicken_items', 'side_items', 'extra_items'].forEach(function(k) {
      const parsed = parseItemsField(o[k]);
      Object.keys(parsed).forEach(function(name) {
        counts[name] = (counts[name] || 0) + (parseInt(parsed[name]) || 0);
      });
    });
  });
  const sorted = Object.keys(counts)
    .map(function(k) { return [k, counts[k]]; })
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, topN);
  return {
    labels: sorted.map(function(e) { return e[0]; }),
    data: sorted.map(function(e) { return e[1]; }),
  };
}

// ===== Tests =====

test('parseItemsField — empty / null / undefined', () => {
  assert.deepStrictEqual(parseItemsField(null), {});
  assert.deepStrictEqual(parseItemsField(undefined), {});
  assert.deepStrictEqual(parseItemsField(''), {});
  assert.deepStrictEqual(parseItemsField('{}'), {});
  assert.deepStrictEqual(parseItemsField('[]'), {});
});

test('parseItemsField — JSON object 直接返回', () => {
  assert.deepStrictEqual(parseItemsField({ '鹽水雞': 1 }), { '鹽水雞': 1 });
});

test('parseItemsField — JSON 字串解析', () => {
  assert.deepStrictEqual(parseItemsField('{"鹽水雞":1}'), { '鹽水雞': 1 });
  assert.deepStrictEqual(parseItemsField('{"甘蔗煙燻雞":2,"毛豆":1}'), { '甘蔗煙燻雞': 2, '毛豆': 1 });
});

test('parseItemsField — "品項x數量" 單項', () => {
  assert.deepStrictEqual(parseItemsField('鹽水雞x1'), { '鹽水雞': 1 });
  assert.deepStrictEqual(parseItemsField('鹽水雞x3'), { '鹽水雞': 3 });
});

test('parseItemsField — "品項x數量|品項x數量" 多品項', () => {
  const result = parseItemsField('鹽水雞x1|毛豆x2');
  assert.deepStrictEqual(result, { '鹽水雞': 1, '毛豆': 2 });
});

test('parseItemsField — "品項 x 數量" 帶空格', () => {
  const result = parseItemsField('鹽水雞 x 2 | 甘蔗煙燻雞 x 1');
  assert.deepStrictEqual(result, { '鹽水雞': 2, '甘蔗煙燻雞': 1 });
});

test('parseItemsField — "品項(半隻) x 數量" 帶括號說明', () => {
  const result = parseItemsField('鹽水雞(半隻) x 2');
  assert.deepStrictEqual(result, { '鹽水雞(半隻)': 2 });
});

test('parseItemsField — 大寫 X 與 × 都支援', () => {
  const a = parseItemsField('鹽水雞X3');
  const b = parseItemsField('鹽水雞×3');
  assert.deepStrictEqual(a, { '鹽水雞': 3 });
  assert.deepStrictEqual(b, { '鹽水雞': 3 });
});

test('parseItemsField — 同品項多筆加總', () => {
  const result = parseItemsField('鹽水雞x1|鹽水雞x2');
  assert.deepStrictEqual(result, { '鹽水雞': 3 });
});

test('calcTopItems — 空訂單回傳空', () => {
  const result = calcTopItems([]);
  assert.deepStrictEqual(result.labels, []);
  assert.deepStrictEqual(result.data, []);
});

test('calcTopItems — 多筆訂單加總並排序 Top 10', () => {
  const orders = [
    { chicken_items: '{"鹽水雞":2}', side_items: '毛豆x1', extra_items: {} },
    { chicken_items: '甘蔗煙燻雞x3', side_items: '{"毛豆":2}', extra_items: {} },
    { chicken_items: '{"鹽水雞":1}', side_items: {}, extra_items: '雞脖子x5' },
  ];
  const result = calcTopItems(orders, 10);
  // 預期：鹽水雞 3, 毛豆 3, 甘蔗煙燻雞 3, 雞脖子 5
  assert.strictEqual(result.labels[0], '雞脖子');
  assert.strictEqual(result.data[0], 5);
  // 鹽水雞/毛豆/甘蔗煙燻雞 各 3 筆，順序不一定但都在 Top 4
  assert.deepStrictEqual(result.labels.slice(1, 4).sort(), ['毛豆', '甘蔗煙燻雞', '鹽水雞'].sort());
  assert.deepStrictEqual(result.data.slice(1, 4).sort(), [3, 3, 3]);
});

test('calcTopItems — Top 10 限制', () => {
  const orders = [];
  for (let i = 0; i < 20; i++) {
    orders.push({ chicken_items: { ['品項_' + i]: i + 1 }, side_items: {}, extra_items: {} });
  }
  const result = calcTopItems(orders, 10);
  assert.strictEqual(result.labels.length, 10);
  assert.strictEqual(result.data.length, 10);
  assert.strictEqual(result.data[0], 20);  // 品項_19 最大
});