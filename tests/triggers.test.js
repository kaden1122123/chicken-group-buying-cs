'use strict';

/**
 * Knowledge Triggers 獨立測試（Session H8-D）
 */

const assert = require('assert');
const { test } = require('node:test');

const {
  guessIntent,
  getKBFilesForIntent,
  getKBFilesForState,
  loadKnowledgeForIntent,
  loadKnowledgeForState,
  listKnowledgeFiles,
  INTENT_KB_MAP,
  STATE_KB_MAP,
} = require('../src/knowledge/triggers');

test('guessIntent: 各 intent 觸發', () => {
  const cases = [
    { msg: '有什麼菜單', expected: 'product_query' },
    { msg: '看一下商品', expected: 'product_query' },
    { msg: '我要訂購', expected: 'order_start' },
    { msg: '我要下單', expected: 'order_start' },
    { msg: '想購買', expected: 'order_start' },
    { msg: '我地址配送嗎', expected: 'delivery_check' },
    { msg: '什麼日期開團', expected: 'date_check' },
    { msg: '付款方式？', expected: 'payment_info' },
    { msg: '怎麼轉帳', expected: 'payment_info' },
    { msg: '現金付款', expected: 'payment_info' },
  ];
  for (const { msg, expected } of cases) {
    assert.strictEqual(guessIntent(msg), expected, `「${msg}」應 ${expected}`);
  }
});

test('guessIntent: 無匹配 → fallback（Round 37.27 永不返回 null，保證知識庫 fallback）', () => {
  const { FALLBACK_INTENT } = require('../src/knowledge/triggers');
  for (const msg of ['hello world', 'random text', '完全不對']) {
    assert.strictEqual(guessIntent(msg), FALLBACK_INTENT, `「${msg}」應 ${FALLBACK_INTENT}`);
  }
});

test('guessIntent: 邊界 — 不 crash（null / undefined / 空字串都給 fallback）', () => {
  const { FALLBACK_INTENT } = require('../src/knowledge/triggers');
  for (const msg of ['', null, undefined]) {
    const intent = guessIntent(msg);
    assert.strictEqual(intent, FALLBACK_INTENT, `「${msg}」應 ${FALLBACK_INTENT}`);
  }
});

test('getKBFilesForIntent — 已定義的 intent 都回傳陣列', () => {
  const intentKeys = Object.keys(INTENT_KB_MAP);
  assert.ok(intentKeys.length >= 5, `應至少 5 種 intent, got ${intentKeys.length}`);
  for (const intent of intentKeys) {
    const files = getKBFilesForIntent(intent);
    assert.ok(Array.isArray(files), `${intent} 應回傳陣列`);
    assert.ok(files.every((f) => typeof f === 'string'), `${intent} files 應為 string[]`);
    assert.ok(files.length >= 1, `${intent} 至少 1 個檔案, got ${files.length}`);
  }
});

test('getKBFilesForIntent: 未知 intent 回傳空陣列', () => {
  const files = getKBFilesForIntent('unknown_intent_xyz');
  assert.ok(Array.isArray(files) && files.length === 0);
});

test('getKBFilesForState — 已定義的 state 都回傳陣列', () => {
  const stateKeys = Object.keys(STATE_KB_MAP);
  assert.ok(stateKeys.length >= 6, `應至少 6 種 state, got ${stateKeys.length}`);
  for (const state of stateKeys) {
    const files = getKBFilesForState(state);
    assert.ok(Array.isArray(files), `${state} 應回傳陣列`);
  }
});

test('getKBFilesForState: 未知 state 回傳空陣列', () => {
  const files = getKBFilesForState('UNKNOWN_STATE_XYZ');
  assert.ok(Array.isArray(files) && files.length === 0);
});

test('loadKnowledgeForIntent — 真實讀取 KB 內容', () => {
  const content = loadKnowledgeForIntent('order_start');
  assert.strictEqual(typeof content, 'string');
  assert.ok(content.length > 0, '應有內容');
  assert.ok(content.includes('---'), '應有檔案間分隔');
});

test('loadKnowledgeForState — 真實讀取 KB 內容', () => {
  const content = loadKnowledgeForState('AWAITING_INFO');
  assert.strictEqual(typeof content, 'string');
  assert.ok(content.length > 100, `AWAITING_INFO 內容應豐富, got ${content.length} 字`);
});

test('loadKnowledgeForIntent: 未知 intent 內容為空字串', () => {
  const content = loadKnowledgeForIntent('unknown_intent');
  assert.ok(content.length > 0, 'Round 37.27：未知 intent 應 fallback 讀 INDEX.md 不返回空');
});

test('listKnowledgeFiles', () => {
  const files = listKnowledgeFiles();
  assert.ok(Array.isArray(files));
  if (Array.isArray(files)) {
    assert.ok(files.length >= 5, `應至少 5 個檔案, got ${files.length}`);
    assert.ok(files.every((f) => f.endsWith('.md')), '應都是 .md');
  }
});
