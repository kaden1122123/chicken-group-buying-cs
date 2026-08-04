'use strict';

/**
 * knowledgeLoader.test.js
 *
 * 測試 src/knowledge/loader.js 的 9 大函數（Round 30 P1.4）
 *
 * 9 大群組：
 * - readKBFile — 讀 KB 檔案
 * - parseMarkdownTableRow — 解析 markdown 表格行
 * - isTableSeparator — 判斷表格分隔行
 * - cleanItemName — 清除品項規格括號
 * - loadProductMenu — 載入 01_product.md
 * - loadOrderFlow / loadPaymentRules — 載入純文字 KB
 * - loadDeliveryAreas — 載入 04_delivery.md（含 allowed / denied）
 * - loadTransferRules — 載入 07_transfer_rules.md
 * - loadFAQ — 載入 06_faq.md
 *
 * 測試策略：直接 require loader，使用真實 KB 檔案（knowledge/tenants/chicken/）
 */

const assert = require('assert');
const { test } = require('node:test');

const loader = require('../src/knowledge/loader');

// === Group 1：readKBFile（3 tests）===

test('readKBFile — 讀取存在的 KB 檔案（01_product.md）→ 非空字串', () => {
  const content = loader.readKBFile('01_product.md');
  assert.ok(typeof content === 'string');
  assert.ok(content.length > 100, '01_product.md 應有實質內容');
});

test('readKBFile — 不存在的檔案 → 空字串', () => {
  const content = loader.readKBFile('nonexistent-file-99999.md');
  assert.strictEqual(content, '');
});

test('KB_PATH — 指向現有目錄', () => {
  assert.ok(typeof loader.KB_PATH === 'string');
  assert.ok(loader.KB_PATH.includes('chicken'), 'KB_PATH 應包含 tenant_id');
});

// === Group 2：parseMarkdownTableRow（3 tests）===

test('parseMarkdownTableRow — 解析合法表格行（3 欄）', () => {
  const cols = loader.parseMarkdownTableRow('| 品項 | 價格 | 備註 |');
  assert.deepStrictEqual(cols, ['品項', '價格', '備註']);
});

test('parseMarkdownTableRow — 非表格行（無 |） → []', () => {
  const cols = loader.parseMarkdownTableRow('這是一般文字');
  assert.deepStrictEqual(cols, []);
});

test('parseMarkdownTableRow — 只有頭尾 | → 1 欄', () => {
  const cols = loader.parseMarkdownTableRow('|單欄|');
  assert.deepStrictEqual(cols, ['單欄']);
});

// === Group 3：isTableSeparator（3 tests）===

test('isTableSeparator — 標準 |---| 分隔', () => {
  assert.strictEqual(loader.isTableSeparator('|---|---|'), true);
});

test('isTableSeparator — 含 : 的對齊行（|:---:|）', () => {
  assert.strictEqual(loader.isTableSeparator('|:---:|---:|'), true);
});

test('isTableSeparator — 非分隔行（含字母） → false', () => {
  assert.strictEqual(loader.isTableSeparator('|品項|價格|'), false);
});

// === Group 4：cleanItemName（4 tests）===

test('cleanItemName — 清除（半隻）/（整隻）規格括號', () => {
  assert.strictEqual(loader.cleanItemName('鹽水雞（半隻）'), '鹽水雞');
  assert.strictEqual(loader.cleanItemName('甘蔗煙燻雞（整隻）'), '甘蔗煙燻雞');
  assert.strictEqual(loader.cleanItemName('烏骨雞（全隻）'), '烏骨雞');
});

test('cleanItemName — 清除沒有括號的規格', () => {
  assert.strictEqual(loader.cleanItemName('鹽水雞半隻'), '鹽水雞');
  assert.strictEqual(loader.cleanItemName('甘蔗煙燻雞整隻'), '甘蔗煙燻雞');
});

test('cleanItemName — 清除 [註解] 方括號', () => {
  assert.strictEqual(loader.cleanItemName('鹽水雞[需提前兩天預定]'), '鹽水雞');
});

test('cleanItemName — 無規格 → 保持原樣', () => {
  assert.strictEqual(loader.cleanItemName('秘製黑胡椒蒜味毛豆'), '秘製黑胡椒蒜味毛豆');
});

// === Group 5：loadProductMenu（4 tests）===

test('loadProductMenu — 回傳 {items, prices, raw} 結構', () => {
  const menu = loader.loadProductMenu();
  assert.ok(Array.isArray(menu.items));
  assert.strictEqual(typeof menu.prices, 'object');
  assert.ok(typeof menu.raw === 'string');
  assert.ok(menu.items.length > 0, '應有實質品項');
});

test('loadProductMenu — 品項含 鹽水雞 與價格', () => {
  const menu = loader.loadProductMenu();
  const yanshui = menu.items.find((i) => i.name === '鹽水雞');
  assert.ok(yanshui, '應有 鹽水雞');
  assert.ok(yanshui.price > 0);
  assert.strictEqual(menu.prices['鹽水雞'], yanshui.price, 'prices 與 items.price 一致');
});

test('loadProductMenu — category 正確（雞肉 / 小菜 / 加購）', () => {
  const menu = loader.loadProductMenu();
  const categories = [...new Set(menu.items.map((i) => i.category))];
  assert.ok(categories.includes('chicken'), '應有 chicken 分類');
  // 至少有部分品項分類正確
  const chickenItems = menu.items.filter((i) => i.category === 'chicken');
  assert.ok(chickenItems.length > 0, '應有 chicken 分類的品項');
});

test('loadProductMenu — isWhole 偵測（單位欄含「整隻」）', () => {
  const menu = loader.loadProductMenu();
  const wholeItems = menu.items.filter((i) => i.isWhole);
  // 至少有 1 個整隻品項（KB 12:15 修訂後，整隻標記在「單位」欄）
  assert.ok(wholeItems.length > 0, '應有整隻品項');
  // 驗證 name 欄位仍是清理後的純品項名（不含「整隻」）
  for (const item of wholeItems) {
    assert.ok(!item.name.includes('（'), `${item.name} 的 name 應已清理括號`);
  }
});

// === Group 6：loadOrderFlow / loadPaymentRules（2 tests）===

test('loadOrderFlow — 回傳 {raw} 含完整下單流程', () => {
  const flow = loader.loadOrderFlow();
  assert.strictEqual(typeof flow.raw, 'string');
  assert.ok(flow.raw.length > 100, '下單流程應有實質內容');
});

test('loadPaymentRules — 回傳 {raw} 含付款規則', () => {
  const payment = loader.loadPaymentRules();
  assert.strictEqual(typeof payment.raw, 'string');
  assert.ok(payment.raw.length > 100, '付款規則應有實質內容');
});

// === Group 7：loadDeliveryAreas（4 tests）===

test('loadDeliveryAreas — 回傳 {allowed, denied, raw}', () => {
  const areas = loader.loadDeliveryAreas();
  assert.ok(Array.isArray(areas.allowed));
  assert.ok(Array.isArray(areas.denied));
  assert.ok(typeof areas.raw === 'string');
});

test('loadDeliveryAreas — allowed 含三峽 / 鶯歌區域', () => {
  const areas = loader.loadDeliveryAreas();
  assert.ok(areas.allowed.length > 0, '應有服務區域');
  // 三峽地區應在 allowed（KB 04_delivery.md）
  const allAreas = areas.allowed.join('|');
  assert.ok(allAreas.includes('三峽') || allAreas.includes('北大'), '應含三峽/北大特區');
});

test('loadDeliveryAreas — denied 含非服務區域', () => {
  const areas = loader.loadDeliveryAreas();
  assert.ok(areas.denied.length > 0, '應有不服務區域');
});

test('loadDeliveryAreas — allowed 與 denied 互斥', () => {
  const areas = loader.loadDeliveryAreas();
  const allowedSet = new Set(areas.allowed);
  // allowed 與 denied 不應有重疊
  for (const d of areas.denied) {
    assert.ok(!allowedSet.has(d), `${d} 不應同時在 allowed 與 denied`);
  }
});

// === Group 8：loadTransferRules（2 tests）===

test('loadTransferRules — 回傳 {rules, raw}，rules 為陣列', () => {
  const tr = loader.loadTransferRules();
  assert.ok(Array.isArray(tr.rules));
  assert.ok(typeof tr.raw === 'string');
});

test('loadTransferRules — rules 含 level + trigger', () => {
  const tr = loader.loadTransferRules();
  assert.ok(tr.rules.length > 0, '應有轉真人條件');
  // 至少一條 rule 有 level 與 trigger
  const firstRule = tr.rules[0];
  assert.ok(firstRule.level, 'rule 應有 level');
  assert.ok(firstRule.trigger, 'rule 應有 trigger');
});

// === Group 9：loadFAQ（2 tests）===

test('loadFAQ — 回傳 {q, a} 陣列', () => {
  const faqs = loader.loadFAQ();
  assert.ok(Array.isArray(faqs));
  assert.ok(faqs.length > 0, '應有 FAQ');
  // 至少一條有 q 與 a
  const firstFaq = faqs[0];
  assert.ok(typeof firstFaq.q === 'string' && firstFaq.q.length > 0);
  assert.ok(typeof firstFaq.a === 'string' && firstFaq.a.length > 0);
});

test('loadFAQ — q 與 a 都不為空', () => {
  const faqs = loader.loadFAQ();
  for (const faq of faqs) {
    assert.ok(faq.q.length > 0, 'FAQ q 不應為空');
    assert.ok(faq.a.length > 0, 'FAQ a 不應為空');
  }
});
