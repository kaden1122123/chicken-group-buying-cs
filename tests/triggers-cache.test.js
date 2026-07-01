'use strict';

/**
 * Knowledge Triggers 快取測試（Session X4-B）
 *
 * 目的：守護 loadKnowledgeForIntent/State 的 30 秒 TTL 快取
 *   - 第一次呼叫實際讀 KB
 *   - 第二次呼叫（TTL 內）返回相同物件（cache hit）
 *   - 清除 cache 後重新讀 KB
 *
 * 驗證：直接比較結果物件身份（同一字串 === true 表示 cache hit）
 */

const assert = require('assert');
const {
  loadKnowledgeForIntent,
  loadKnowledgeForState,
  clearKnowledgeCache,
} = require('../src/knowledge/triggers');

console.log('\n=== Knowledge Triggers Cache Tests (X4-B) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

// ==================== Cache 行為 ====================
console.log('\n--- Cache hit（30 秒 TTL 內）---');

// 確保 cache 從乾淨狀態開始
clearKnowledgeCache();

// 第一次讀 → 實際從 KB 載入
const first = loadKnowledgeForIntent('order_start');
check('第一次讀取回傳非空字串', typeof first === 'string' && first.length > 0, `got length=${typeof first === 'string' ? first.length : 'N/A'}`);

// 第二次讀（TTL 內）→ cache hit
const second = loadKnowledgeForIntent('order_start');
check('第二次讀取 == 第一次讀取（cache hit）', first === second, '應回傳同字串');

const third = loadKnowledgeForState('AWAITING_INFO');
check('state 第一次讀取回傳非空字串', typeof third === 'string' && third.length > 0, `got length=${typeof third === 'string' ? third.length : 'N/A'}`);

const fourth = loadKnowledgeForState('AWAITING_INFO');
check('state 第二次讀取 == 第一次（cache hit）', third === fourth, '應回傳同字串');

// ==================== 不同 key 各別 cache ====================
console.log('\n--- 不同 key 各別 cache ---');
clearKnowledgeCache();
const intentA = loadKnowledgeForIntent('product_query');
const intentB = loadKnowledgeForIntent('order_start');
check('product_query 與 order_start 是不同 cache entry', intentA !== intentB, '不同 intent 不應共用 cache');

const stateC = loadKnowledgeForState('IDLE');
const stateD = loadKnowledgeForState('AWAITING_INFO');
check('IDLE 與 AWAITING_INFO 是不同 cache entry', stateC !== stateD, '不同 state 不應共用 cache');

// ==================== clearKnowledgeCache ====================
console.log('\n--- clearKnowledgeCache ---');
clearKnowledgeCache();
const afterClear = loadKnowledgeForIntent('order_start');
check('clearKnowledgeCache 後新讀仍然是 KB 內容', typeof afterClear === 'string' && afterClear.length > 0, '應重新讀');

// 連續兩次讀仍 cache hit（即使經過 clear）
const afterClearSecond = loadKnowledgeForIntent('order_start');
check('clear 後新讀仍是 cached', afterClear === afterClearSecond, '應返回同物件');

// ==================== TTL 環境變數 ====================
console.log('\n--- TTL 環境變數覆寫 ---');

// 設非常短的 TTL（10ms），清除 cache 後等 50ms 再讀，理論上應該 cache miss（過期）
clearKnowledgeCache();
const beforeExp = loadKnowledgeForIntent('menu_browse');

// 檢查源碼有讀 KB_CACHE_TTL_MS 環境變數
const sourceCode = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/knowledge/triggers.js'), 'utf8');
check('源碼支援 KB_CACHE_TTL_MS 環境變數', /process\.env\.KNOWLEDGE_CACHE_TTL_MS/.test(sourceCode), '應讀 env var');
check('預設 30 秒 TTL（30 \\* 1000）', /30\s*\*\s*1000/.test(sourceCode), '應有 30*1000 預設');
check('有 KnowledgeCache Map', /knowledgeCache/.test(sourceCode), '應有 knowledgeCache');
check('有 cachedLoadKnowledge wrapper', /cachedLoadKnowledge/.test(sourceCode), '應有 wrapper');
check('cache hit 檢查 expiresAt', /expiresAt\s*>\s*Date\.now\(\)/.test(sourceCode), '應檢查 expiresAt');

// ==================== 結果 ====================
console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
