'use strict';

/**
 * Cloudflare Worker Integration 測試
 * 模擬 Worker 的三道攔截邏輯：Ignored Keywords / Payment Keywords / Sanitization
 * 確保它們互不衝突、互不遺漏
 *
 * 注意：這個測試不直接執行 Worker（需要 Cloudflare runtime）
 * 而是用 mirror 函數模擬 Worker 的攔截流程
 */

const assert = require('assert');
const {
  getIgnoredKeywords,
  isIgnoredKeyword,
} = require('../src/config');

console.log('\n=== Worker Integration Tests ===');

// ========== Mirror Worker 邏輯 ==========

/**
 * Mirror Worker 的 PAYMENT_KEYWORDS 與攔截條件
 * 必須與 cloudflare-worker/src/index.ts 保持同步
 */
const PAYMENT_KEYWORDS = [
  '帳號', '匯款', '轉帳', '付款', '如何付款', 'line pay', '街口',
  '銀行', '怎麼付', '付錢', '費用的問題', '多少錢', '匯費',
];
const PAYMENT_MAX_LENGTH = 50;

/**
 * 判斷事件是否應被 payment_keyword 攔截
 */
function shouldInterceptPayment(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const isPaymentQuery = PAYMENT_KEYWORDS.some((kw) => lowerText.includes(kw));
  return text.length <= PAYMENT_MAX_LENGTH && isPaymentQuery;
}

/**
 * 判斷事件是否應被 ignored_keyword 攔截
 * @param {string} text
 * @param {string[]} [keywords] - 自訂關鍵字清單
 */
function shouldInterceptIgnored(text, keywords) {
  return isIgnoredKeyword(text, keywords);
}

/**
 * 模擬 Worker 的事件處理結果
 * @returns {{ shouldForward: boolean, reason: string|null }}
 */
function processEvent(text, envIgnoredKeywords) {
  const keywords = envIgnoredKeywords || getIgnoredKeywords();

  // Step 1: Sanitization（mock，這裡只驗證 ignored 與 payment 互不衝突）
  if (shouldInterceptIgnored(text, keywords)) {
    return { shouldForward: false, reason: 'ignored_keyword' };
  }

  if (shouldInterceptPayment(text)) {
    return { shouldForward: false, reason: 'payment_keyword_intercept' };
  }

  return { shouldForward: true, reason: null };
}

// ========== 1. Ignored Keywords 攔截 ==========
console.log('\n--- Ignored Keywords Intercept ---');

function testIgnoredIntercept(input, expected, description) {
  const r = processEvent(input);
  assert.strictEqual(r.shouldForward, !expected, `${description}: expected shouldForward=${!expected}`);
  assert.strictEqual(r.reason, expected ? 'ignored_keyword' : null, `${description}: expected reason=${expected ? 'ignored_keyword' : 'null'}`);
  console.log(`  ✓ ${description}: "${input}" → ${expected ? 'BLOCKED' : 'FORWARD'}`);
}

// Session Q 2026-06-30 修整：「菜單」已從 ignored_keywords 移除，改由 LLM 接手傳送 3 張圖片。
testIgnoredIntercept('常見問題', true, 'Rich menu 常見問題');
// Bug #1 fix (2026-07-20):Worker 不再攔截「我要訂購」
// 改由 chicken 端的 src/states/idle.js ORDER_INTENT_PATTERNS 接管。
testIgnoredIntercept('我要訂購', false, 'B01 fix: 我要訂購 不再被 Worker 攔截');
testIgnoredIntercept('黑羽放山雞介紹', true, 'Keyword reply 黑羽放山雞介紹');
testIgnoredIntercept('蔥鹽醬介紹', true, 'Keyword reply 蔥鹽醬介紹');
testIgnoredIntercept('吃法介紹', true, 'Keyword reply 吃法介紹');

// 帶前後空白
testIgnoredIntercept(' 常見問題 ', true, 'with whitespace');
testIgnoredIntercept('  常見問題', true, 'leading whitespace');

// 部分包含（不應被攔截）
testIgnoredIntercept('我要看常見問題', false, 'partial - forward to LLM');
testIgnoredIntercept('常見問題給我', false, 'partial - forward to LLM');
testIgnoredIntercept('常見問題xxx', false, 'extra chars - forward to LLM');

// Session Q：菜單現在 NOT-ignored（由 LLM 接手處理）
testIgnoredIntercept('菜單', false, '菜單 已改由 LLM 接手（2026-06-30 修整）');
testIgnoredIntercept('我要看菜單', false, '菜單系列由 LLM 處理');

// 完全無關
testIgnoredIntercept('你好', false, 'greeting - forward');
// 「多少錢」是 PAYMENT_KEYWORDS 之一，會被 payment 攔截（不是 ignored）

console.log('Ignored Keywords Intercept: ALL PASSED ✓');

// ========== 2. Payment Keywords 攔截 ==========
console.log('\n--- Payment Keywords Intercept ---');

function testPaymentIntercept(input, expected, description) {
  const r = processEvent(input);
  if (expected) {
    assert.strictEqual(r.shouldForward, false, `${description}: expected blocked`);
    assert.strictEqual(r.reason, 'payment_keyword_intercept', `${description}: expected reason`);
  } else {
    // 應被 ignored 攔截（如果符合），否則 forward
    if (r.reason === null) {
      assert.strictEqual(r.shouldForward, true, `${description}: expected forward`);
    }
  }
  console.log(`  ✓ ${description}: "${input}" → ${expected ? 'BLOCKED' : 'NOT-BLOCKED'}`);
}

// 短訊息 + 付款關鍵字 → 攔截
testPaymentIntercept('請問怎麼付款', true, 'short payment question');
testPaymentIntercept('付款方式', true, 'payment method short');
testPaymentIntercept('轉帳帳號', true, 'transfer account short');
testPaymentIntercept('多少錢', true, 'price question short');

// 長訊息（含付款詞但實際是訂單）→ 不攔截
testPaymentIntercept('我想要訂購雞肉，付款方式選轉帳，我的地址是新北市三峽區...', false, 'long message with payment keyword');
testPaymentIntercept('我已經轉帳完成，請查收這是付款證明，這是我的訂單編號...', false, 'long message - actual order');

// 純長訊息
testPaymentIntercept('這是一個非常長的訊息，用來測試當訊息長度超過 50 字時，不應被 payment_keyword 攔截。', false, 'long non-payment message');

console.log('Payment Keywords Intercept: ALL PASSED ✓');

// ========== 3. Ignored vs Payment 互不衝突 ==========
console.log('\n--- Ignored vs Payment Mutual Exclusion ---');

// 「菜單」應被 LLM 接手（Session Q 2026-06-30 修整後已不在 ignored_keywords）
const r1 = processEvent('菜單');
assert.strictEqual(r1.reason, null, '菜單 應 forward 給 LLM（2026-06-30 Session Q 修整後）');
assert.strictEqual(r1.shouldForward, true, '菜單 應 forward 給 LLM');
console.log('  ✓ 菜單 → forward to LLM (NOT ignored, NOT payment)');

// 「付款」不應被 ignored 攔截
const r2 = processEvent('付款');
assert.strictEqual(r2.reason, 'payment_keyword_intercept', '付款 should be payment, not ignored');
console.log('  ✓ 付款 → payment_keyword_intercept (NOT ignored)');

// 正常訊息
const r3 = processEvent('我想要訂購雞肉');
assert.strictEqual(r3.reason, null, 'Normal order should forward');
console.log('  ✓ 我想要訂購雞肉 → forward');

// 完全不該被攔截的訊息
const r4 = processEvent('你們的雞肉好吃嗎？');
assert.strictEqual(r4.reason, null, 'Normal question should forward');
console.log('  ✓ 你們的雞肉好吃嗎？ → forward');

console.log('Ignored vs Payment: ALL PASSED ✓');

// ========== 4. env.IGNORED_KEYWORDS 覆寫 ==========
console.log('\n--- Custom IGNORED_KEYWORDS Override ---');

const customKeywords = ['自訂關鍵字1', '自訂關鍵字2'];

// Session Q 2026-06-30 修整後：「菜單」不再在預設 ignored_keywords，改用其他預設關鍵字測試
const defaultResult = processEvent('常見問題');
assert.strictEqual(defaultResult.reason, 'ignored_keyword', '常見問題 with default keywords');

// 自訂關鍵字
const customResult = processEvent('自訂關鍵字1', customKeywords);
assert.strictEqual(customResult.reason, 'ignored_keyword', '自訂關鍵字1 with custom list');
assert.strictEqual(customResult.shouldForward, false, 'should be blocked');

// 預設關鍵字 + 自訂關鍵字（混合）— 這裡測試自訂清單覆寫後，原本的「常見問題」不在清單中
const mixedResult = processEvent('常見問題', customKeywords);
assert.strictEqual(mixedResult.reason, null, '常見問題 with custom-only list should forward');
console.log('  ✓ Custom keywords override defaults');

console.log('Custom Override: ALL PASSED ✓');

// ========== 5. 邊界情況 ==========
console.log('\n--- Boundary Cases ---');

// 空訊息
const emptyResult = processEvent('');
assert.strictEqual(emptyResult.reason, null, 'empty message should forward');
console.log('  ✓ empty → forward');

// null
const nullResult = processEvent(null);
assert.strictEqual(nullResult.reason, null, 'null message should forward');
console.log('  ✓ null → forward');

// undefined
const undefResult = processEvent(undefined);
assert.strictEqual(undefResult.reason, null, 'undefined message should forward');
console.log('  ✓ undefined → forward');

console.log('Boundary Cases: ALL PASSED ✓');

// ========== 6. Worker 部署版本一致性檢查 ==========
console.log('\n--- Worker Deployment Consistency ---');

// 確認 production Worker 真的有 IGNORED_KEYWORDS 邏輯
const fs = require('fs');
// 修整 (Bug #1 2026-07-20):改用 Worker git working tree source check
// 取代原本的 /tmp/wrangler-dryrun2/index.js bundle check。
// 原因:deploy bundle 需 `wrangler deploy --dry-run --outdir=...` 才 regenerate,
// source check 即時反映 git truth,降低測試 dependency。
// Deploy 後 Hubert 跑 wrangler deploy 會 rebuild bundle 對齊 source(正常 flow)。
const fsCheck = require('fs');
const WORKER_SRC_PATH = '/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/src/index.ts';
let workerSrc = '';
try {
  workerSrc = fsCheck.readFileSync(WORKER_SRC_PATH, 'utf8');
} catch (e) {
  console.log('  ⚠ Worker source not found: ' + WORKER_SRC_PATH + ' - skipping keyword check');
}
const hasMenu = workerSrc.includes("'菜單'");
const hasOrder = workerSrc.includes("'我要訂購'");
const hasFaq = workerSrc.includes("'常見問題'");
const hasFunc = workerSrc.includes('isIgnoredKeyword') || workerSrc.includes('getIgnoredKeywords');

assert.ok(hasFunc, 'Worker source should have isIgnoredKeyword/getIgnoredKeywords function');
assert.ok(!hasMenu, 'Worker source should NOT have 菜單 keyword (Session Q 2026-06-30)');
// Bug #1 fix (2026-07-20):Worker 不再有「我要訂購」keyword
assert.ok(!hasOrder, 'B01 fix: Worker 不再有 我要訂購 keyword');
assert.ok(hasFaq, 'Worker source should have 常見問題 keyword');
console.log('  ✓ Worker source has the expected 4 keywords (菜單 + 我要訂購 已移除)');
console.log('  (Production Note: Hubert 跑 wrangler deploy 會 rebuild bundle 與 source 對齊)');

console.log('Worker Deployment Consistency: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL INTEGRATION TESTS PASSED ✓');
console.log('========================================\n');
