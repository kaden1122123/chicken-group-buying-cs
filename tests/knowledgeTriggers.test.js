'use strict';

/**
 * knowledgeTriggers.test.js
 *
 * 測試 src/knowledge/triggers.js 的 9 大函數（Round 30 P1.5）
 *
 * 9 大群組：
 * - getKBFilesForIntent — intent → KB 檔案對照
 * - getKBFilesForState — state → KB 檔案對照
 * - guessIntent — 訊息內容猜測 intent
 * - listKnowledgeFiles — 列出所有 KB 檔案
 * - loadKnowledgeForIntent — 載入 intent 對應 KB（30s TTL 快取）
 * - loadKnowledgeForState — 載入 state 對應 KB（30s TTL 快取）
 * - clearKnowledgeCache — 清空快取
 * - INTENT_KB_MAP / STATE_KB_MAP 常數
 * - loadKBFile re-export from loader
 *
 * 測試策略：直接 require triggers，使用真實 KB 檔案
 */

const assert = require('assert');
const { test } = require('node:test');

const triggers = require('../src/knowledge/triggers');

// === Group 1：getKBFilesForIntent（4 tests）===

test('getKBFilesForIntent — order_start 回傳下單相關檔', () => {
  const files = triggers.getKBFilesForIntent('order_start');
  assert.ok(Array.isArray(files));
  assert.ok(files.includes('02_order_flow.md'));
  assert.ok(files.includes('03_payment.md'));
});

test('getKBFilesForIntent — product_query 回傳菜單檔', () => {
  const files = triggers.getKBFilesForIntent('product_query');
  assert.deepStrictEqual(files, ['01_product.md']);
});

test('getKBFilesForIntent — 不存在的 intent → []', () => {
  assert.deepStrictEqual(triggers.getKBFilesForIntent('nonexistent-intent-99999'), []);
});

test('getKBFilesForIntent — handoff 回傳 transfer rules', () => {
  const files = triggers.getKBFilesForIntent('handoff');
  assert.ok(files.includes('07_transfer_rules.md'));
});

// === Group 2：getKBFilesForState（3 tests）===

test('getKBFilesForState — AWAITING_PAYMENT 回傳付款規則', () => {
  const files = triggers.getKBFilesForState('AWAITING_PAYMENT');
  assert.ok(files.includes('03_payment.md'));
});

test('getKBFilesForState — IDLE / COMPLETED → []（無 KB）', () => {
  assert.deepStrictEqual(triggers.getKBFilesForState('IDLE'), []);
  assert.deepStrictEqual(triggers.getKBFilesForState('COMPLETED'), []);
});

test('getKBFilesForState — HUMAN_HANDOFF 回傳 transfer rules', () => {
  const files = triggers.getKBFilesForState('HUMAN_HANDOFF');
  assert.ok(files.includes('07_transfer_rules.md'));
});

// === Group 3：guessIntent（7 tests）===

test('guessIntent — 「你們有什麼菜單」/「商品」→ product_query', () => {
  assert.strictEqual(triggers.guessIntent('你們有什麼菜單'), 'product_query');
  assert.strictEqual(triggers.guessIntent('有什麼商品'), 'product_query');
  assert.strictEqual(triggers.guessIntent('請給我看商品'), 'product_query');
});

test('guessIntent — 「我要訂購」「下單」「購買」→ order_start', () => {
  assert.strictEqual(triggers.guessIntent('我要訂購'), 'order_start');
  assert.strictEqual(triggers.guessIntent('我要下單'), 'order_start');
  assert.strictEqual(triggers.guessIntent('購買雞肉'), 'order_start');
  assert.strictEqual(triggers.guessIntent('我要買'), 'order_start');
});

test('guessIntent — 「地址」+「配送」/「送」→ delivery_check', () => {
  assert.strictEqual(triggers.guessIntent('地址在哪裡配送？'), 'delivery_check');
  assert.strictEqual(triggers.guessIntent('可以送來我地址嗎'), 'delivery_check');
});

test('guessIntent — 「日期」/「時間」/「開團」→ date_check', () => {
  assert.strictEqual(triggers.guessIntent('開團日期'), 'date_check');
  assert.strictEqual(triggers.guessIntent('配送時間'), 'date_check');
});

test('guessIntent — 「付款」/「轉帳」/「現金」→ payment_info', () => {
  assert.strictEqual(triggers.guessIntent('付款方式'), 'payment_info');
  assert.strictEqual(triggers.guessIntent('可以轉帳嗎'), 'payment_info');
  assert.strictEqual(triggers.guessIntent('現金付款'), 'payment_info');
});

test('guessIntent — 空字串 / 無法識別 → null', () => {
  assert.strictEqual(triggers.guessIntent(''), null);
  assert.strictEqual(triggers.guessIntent(null), null);
  assert.strictEqual(triggers.guessIntent(undefined), null);
  assert.strictEqual(triggers.guessIntent('你好'), null);
});

test('guessIntent — 空白 / 純英文 / 純符號 → null（不誤判）', () => {
  // 修正觀念：source 只認中文關鍵字（菜單/商品/訂購等），toLowerCase 對中文無影響
  assert.strictEqual(triggers.guessIntent('   '), null, '純空白不應誤判');
  assert.strictEqual(triggers.guessIntent('hello'), null, '純英文不應誤判');
  assert.strictEqual(triggers.guessIntent('???'), null, '純符號不應誤判');
  assert.strictEqual(triggers.guessIntent('PRODUCT'), null, '英文人名不應誤判');
  assert.strictEqual(triggers.guessIntent('菜單'), 'product_query', '中文關鍵字仍正確');
});

// === Group 4：listKnowledgeFiles（2 tests）===

test('listKnowledgeFiles — 回傳 .md 檔案陣列', () => {
  const files = triggers.listKnowledgeFiles();
  assert.ok(Array.isArray(files));
  assert.ok(files.length > 0, '應有 KB 檔案');
  for (const f of files) {
    assert.ok(f.endsWith('.md'), `${f} 應為 .md`);
  }
});

test('listKnowledgeFiles — 含已知 KB 檔（01_product.md / 06_faq.md）', () => {
  const files = triggers.listKnowledgeFiles();
  assert.ok(files.includes('01_product.md'));
  assert.ok(files.includes('06_faq.md'));
});

// === Group 5：loadKnowledgeForIntent（2 tests）===

test('loadKnowledgeForIntent — 已知 intent 回傳合併內容（非空字串）', () => {
  triggers.clearKnowledgeCache();
  const content = triggers.loadKnowledgeForIntent('order_start');
  assert.strictEqual(typeof content, 'string');
  assert.ok(content.length > 100, 'order_start 應有實質內容');
  assert.ok(content.includes('---'), '合併內容應含 --- 分隔');
});

test('loadKnowledgeForIntent — 未知 intent → 空字串', () => {
  triggers.clearKnowledgeCache();
  assert.strictEqual(triggers.loadKnowledgeForIntent('nonexistent-intent-99999'), '');
});

// === Group 6：loadKnowledgeForState（2 tests）===

test('loadKnowledgeForState — 已知 state 回傳合併內容', () => {
  triggers.clearKnowledgeCache();
  const content = triggers.loadKnowledgeForState('AWAITING_INFO');
  assert.strictEqual(typeof content, 'string');
  assert.ok(content.length > 100, 'AWAITING_INFO 應有實質內容（4 個 KB 合併）');
});

test('loadKnowledgeForState — 未知 state → 空字串', () => {
  triggers.clearKnowledgeCache();
  assert.strictEqual(triggers.loadKnowledgeForState('NONEXISTENT_STATE'), '');
});

// === Group 7：clearKnowledgeCache（2 tests）===

test('clearKnowledgeCache — 不 throw', () => {
  assert.doesNotThrow(() => triggers.clearKnowledgeCache());
});

test('clearKnowledgeCache — 可連續呼叫（冪等）', () => {
  assert.doesNotThrow(() => {
    triggers.clearKnowledgeCache();
    triggers.clearKnowledgeCache();
    triggers.clearKnowledgeCache();
  });
  // 連續呼叫後仍可正常使用
  const content = triggers.loadKnowledgeForIntent('order_start');
  assert.ok(content.length > 0);
});

// === Group 8：INTENT_KB_MAP / STATE_KB_MAP 常數（2 tests）===

test('INTENT_KB_MAP — 含 12 種 intent（涵蓋主要業務）', () => {
  assert.ok(typeof triggers.INTENT_KB_MAP === 'object');
  const intents = Object.keys(triggers.INTENT_KB_MAP);
  assert.ok(intents.length >= 10, `應至少 10 種 intent，實際: ${intents.length}`);
  assert.ok(intents.includes('order_start'));
  assert.ok(intents.includes('product_query'));
  assert.ok(intents.includes('handoff'));
});

test('STATE_KB_MAP — 含 6 種 state', () => {
  assert.ok(typeof triggers.STATE_KB_MAP === 'object');
  const states = Object.keys(triggers.STATE_KB_MAP);
  assert.ok(states.includes('IDLE'));
  assert.ok(states.includes('AWAITING_INFO'));
  assert.ok(states.includes('CONFIRMING'));
  assert.ok(states.includes('AWAITING_PAYMENT'));
  assert.ok(states.includes('HUMAN_HANDOFF'));
  assert.ok(states.includes('COMPLETED'));
});

// === Group 9：loadKBFile re-export（1 test）===

test('loadKBFile — re-export 自 loader（讀取現有 KB 檔）', () => {
  const content = triggers.loadKBFile('01_product.md');
  assert.ok(typeof content === 'string');
  assert.ok(content.length > 100);
});
