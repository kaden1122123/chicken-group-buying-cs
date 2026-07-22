'use strict';

/**
 * Knowledge Triggers 快取測試（Session X4-B）
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const {
  loadKnowledgeForIntent,
  loadKnowledgeForState,
  clearKnowledgeCache,
} = require('../src/knowledge/triggers');

test('Cache hit（30 秒 TTL 內）— 第二次讀取 == 第一次', () => {
  clearKnowledgeCache();
  const first = loadKnowledgeForIntent('order_start');
  assert.ok(typeof first === 'string' && first.length > 0, `got length=${typeof first === 'string' ? first.length : 'N/A'}`);

  const second = loadKnowledgeForIntent('order_start');
  assert.strictEqual(first, second, '應回傳同字串（cache hit）');

  const third = loadKnowledgeForState('AWAITING_INFO');
  assert.ok(typeof third === 'string' && third.length > 0, `got length=${typeof third === 'string' ? third.length : 'N/A'}`);

  const fourth = loadKnowledgeForState('AWAITING_INFO');
  assert.strictEqual(third, fourth, '應回傳同字串（cache hit）');
});

test('不同 key 各別 cache', () => {
  clearKnowledgeCache();
  const intentA = loadKnowledgeForIntent('product_query');
  const intentB = loadKnowledgeForIntent('order_start');
  assert.notStrictEqual(intentA, intentB, '不同 intent 不應共用 cache');

  const stateC = loadKnowledgeForState('IDLE');
  const stateD = loadKnowledgeForState('AWAITING_INFO');
  assert.notStrictEqual(stateC, stateD, '不同 state 不應共用 cache');
});

test('clearKnowledgeCache — 之後新讀仍 cache', () => {
  clearKnowledgeCache();
  const afterClear = loadKnowledgeForIntent('order_start');
  assert.ok(typeof afterClear === 'string' && afterClear.length > 0, '應重新讀');

  const afterClearSecond = loadKnowledgeForIntent('order_start');
  assert.strictEqual(afterClear, afterClearSecond, 'clear 後新讀仍應 cached');
});

test('TTL 環境變數覆寫 — 源碼支援', () => {
  const sourceCode = fs.readFileSync(path.join(__dirname, '..', 'src/knowledge/triggers.js'), 'utf8');
  assert.ok(/process\.env\.KNOWLEDGE_CACHE_TTL_MS/.test(sourceCode), '源碼應讀 env var');
  assert.ok(/30\s*\*\s*1000/.test(sourceCode), '應有 30*1000 預設 30 秒');
  assert.ok(/knowledgeCache/.test(sourceCode), '應有 knowledgeCache');
  assert.ok(/cachedLoadKnowledge/.test(sourceCode), '應有 wrapper');
  assert.ok(/expiresAt\s*>\s*Date\.now\(\)/.test(sourceCode), '應檢查 expiresAt');
});
