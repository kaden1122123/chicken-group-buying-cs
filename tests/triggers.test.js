'use strict';

/**
 * Knowledge Triggers 獨立測試（Session H8-D）
 *
 * 目的：守護 src/knowledge/triggers.js 主要 exports
 *   - guessIntent(message)
 *   - getKBFilesForIntent(intent)
 *   - getKBFilesForState(state)
 *   - loadKnowledgeForIntent(intent)
 *   - loadKnowledgeForState(state)
 *   - listKnowledgeFiles()
 */

const assert = require('assert');
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

console.log('\n=== Knowledge Triggers Tests (H8-D) ===');

let pass = 0; let fail = 0;
function check(label, condition, msg) {
  if (condition) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label} — ${msg}`); fail++; }
}

console.log('\n--- guessIntent: 各 intent 觸發 ---');
const intentCases = [
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

intentCases.forEach(({ msg, expected }) => {
  const intent = guessIntent(msg);
  check(`「${msg}」 → ${expected}`, intent === expected, `got ${intent}`);
});

console.log('\n--- guessIntent: 無匹配 ---');
const noMatchCases = ['hello world', 'random text', '完全不對'];
noMatchCases.forEach((msg) => {
  const intent = guessIntent(msg);
  check(`「${msg}」 → null`, intent === null, `got ${intent}`);
});

console.log('\n--- guessIntent: 邊界 ---');
['', null, undefined].forEach((msg) => {
  const intent = guessIntent(msg);
  check(`「${msg}」不 crash`, intent === null || typeof intent === 'string', `got ${intent}`);
});

console.log('\n--- getKBFilesForIntent: 已定義的 intent ---');
const intentKeys = Object.keys(INTENT_KB_MAP);
check('至少有 5 種 intent 定義', intentKeys.length >= 5, `got ${intentKeys.length} 種`);
intentKeys.forEach((intent) => {
  const files = getKBFilesForIntent(intent);
  check(`${intent} 回傳陣列`, Array.isArray(files), `got ${typeof files}`);
  if (Array.isArray(files)) {
    check(`${intent} 每個檔案是字串`, files.every((f) => typeof f === 'string'), 'files 應為 string[]');
    check(`${intent} 至少 1 個檔案`, files.length >= 1, `got ${files.length}`);
  }
});

console.log('\n--- getKBFilesForIntent: 未知 intent ---');
const unknownFiles = getKBFilesForIntent('unknown_intent_xyz');
check('未知 intent 回傳空陣列', Array.isArray(unknownFiles) && unknownFiles.length === 0, `got ${JSON.stringify(unknownFiles)}`);

console.log('\n--- getKBFilesForState: 已定義的 state ---');
const stateKeys = Object.keys(STATE_KB_MAP);
check('至少有 6 種 state 定義', stateKeys.length >= 6, `got ${stateKeys.length} 種`);
stateKeys.forEach((state) => {
  const files = getKBFilesForState(state);
  check(`${state} 回傳陣列`, Array.isArray(files), `got ${typeof files}`);
});

console.log('\n--- getKBFilesForState: 未知 state ---');
const unknownStateFiles = getKBFilesForState('UNKNOWN_STATE_XYZ');
check('未知 state 回傳空陣列', Array.isArray(unknownStateFiles) && unknownStateFiles.length === 0, '');

console.log('\n--- loadKnowledgeForIntent: 真實讀取 ---');
const orderStartContent = loadKnowledgeForIntent('order_start');
check('order_start 載入 KB 內容', typeof orderStartContent === 'string', `got ${typeof orderStartContent}`);
check('order_start 內容不為空', orderStartContent.length > 0, '應有內容');
check('order_start 含分隔符', orderStartContent.includes('---'), '應有檔案間分隔');

console.log('\n--- loadKnowledgeForState: 真實讀取 ---');
const awaitingInfoContent = loadKnowledgeForState('AWAITING_INFO');
check('AWAITING_INFO 載入 KB 內容', typeof awaitingInfoContent === 'string', '');
check('AWAITING_INFO 內容豐富', awaitingInfoContent.length > 100, `got ${awaitingInfoContent.length} 字`);

console.log('\n--- loadKnowledgeForIntent: 未知 intent 回空字串 ---');
const unknownContent = loadKnowledgeForIntent('unknown_intent');
check('未知 intent 內容為空字串', unknownContent === '', `got ${JSON.stringify(unknownContent).slice(0, 50)}`);

console.log('\n--- listKnowledgeFiles ---');
const files = listKnowledgeFiles();
check('listKnowledgeFiles 是陣列', Array.isArray(files), `got ${typeof files}`);
if (Array.isArray(files)) {
  check('KB 至少 5 個檔案', files.length >= 5, `got ${files.length} 個`);
  check('每個檔案是 .md', files.every((f) => f.endsWith('.md')), '應都是 .md');
}

console.log(`\n--- 結果: ${pass} 通過 / ${fail + pass} 總計 ---`);
if (fail > 0) { console.error(`✗ 失敗: ${fail}`); process.exit(1); }
console.log('\n========================================');
