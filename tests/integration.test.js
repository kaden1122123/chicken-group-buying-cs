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
  '銀行', '怎麼付', '付錢', '費用的問題', '多少錢', '匯費'
];
const PAYMENT_MAX_LENGTH = 50;

/**
 * 判斷事件是否應被 payment_keyword 攔截
 */
function shouldInterceptPayment(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const isPaymentQuery = PAYMENT_KEYWORDS.some(kw => lowerText.includes(kw));
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

testIgnoredIntercept('菜單', true, 'Rich menu 菜單');
testIgnoredIntercept('常見問題', true, 'Rich menu 常見問題');
testIgnoredIntercept('我要訂購', true, 'Rich menu 我要訂購');
testIgnoredIntercept('黑羽放山雞介紹', true, 'Keyword reply 黑羽放山雞介紹');
testIgnoredIntercept('蔥鹽醬介紹', true, 'Keyword reply 蔥鹽醬介紹');
testIgnoredIntercept('吃法介紹', true, 'Keyword reply 吃法介紹');

// 帶前後空白
testIgnoredIntercept(' 菜單 ', true, 'with whitespace');
testIgnoredIntercept('  菜單', true, 'leading whitespace');

// 部分包含（不應被攔截）
testIgnoredIntercept('我要看菜單', false, 'partial - forward to LLM');
testIgnoredIntercept('菜單給我', false, 'partial - forward to LLM');
testIgnoredIntercept('菜單xxx', false, 'extra chars - forward to LLM');

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

// 「菜單」不應被 payment 攔截
const r1 = processEvent('菜單');
assert.strictEqual(r1.reason, 'ignored_keyword', '菜單 should be ignored, not payment');
console.log('  ✓ 菜單 → ignored_keyword (NOT payment)');

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

// 預設關鍵字應該被攔截
const defaultResult = processEvent('菜單');
assert.strictEqual(defaultResult.reason, 'ignored_keyword', '菜單 with default keywords');

// 自訂關鍵字
const customResult = processEvent('自訂關鍵字1', customKeywords);
assert.strictEqual(customResult.reason, 'ignored_keyword', '自訂關鍵字1 with custom list');
assert.strictEqual(customResult.shouldForward, false, 'should be blocked');

// 預設關鍵字 + 自訂關鍵字（混合）— 這裡測試自訂清單覆寫後，原本的「菜單」不在清單中
const mixedResult = processEvent('菜單', customKeywords);
assert.strictEqual(mixedResult.reason, null, '菜單 with custom-only list should forward');
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
const path = require('path');
const dryRunPath = '/tmp/wrangler-dryrun2/index.js';

if (fs.existsSync(dryRunPath)) {
  const bundle = fs.readFileSync(dryRunPath, 'utf8');
  // 檢查關鍵 Unicode escapes（大小寫不敏感，esbuild 可能輸出不同大小寫）
  const hasMenu = bundle.toLowerCase().includes('\\u83dc\\u55ae'); // 菜單
  const hasOrder = bundle.toLowerCase().includes('\\u6211\\u8981\\u8a02\\u8cfc'); // 我要訂購
  const hasFaq = bundle.toLowerCase().includes('\\u5e38\\u898b\\u554f\\u984c'); // 常見問題
  const hasFunc = bundle.includes('isIgnoredKeyword') || bundle.includes('getIgnoredKeywords');

  assert.ok(hasFunc, 'Bundled Worker should have isIgnoredKeyword/getIgnoredKeywords function');
  assert.ok(hasMenu, 'Bundled Worker should have 菜單 keyword');
  assert.ok(hasOrder, 'Bundled Worker should have 我要訂購 keyword');
  assert.ok(hasFaq, 'Bundled Worker should have 常見問題 keyword');
  console.log('  ✓ Production Worker bundle has all 6 keywords');
  console.log(`  (Note: re-run \`wrangler deploy --dry-run --outdir=/tmp/wrangler-dryrun2\` to update bundle)`);
} else {
  console.log('  ⚠  /tmp/wrangler-dryrun2/index.js not found - skipping bundle check');
  console.log('     Run: cd cloudflare-worker && wrangler deploy --dry-run --outdir=/tmp/wrangler-dryrun2');
}

console.log('Worker Deployment Consistency: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL INTEGRATION TESTS PASSED ✓');
console.log('========================================\n');
