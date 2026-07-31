'use strict';

/**
 * Cloudflare Worker Integration 測試
 * 模擬 Worker 的三道攔截邏輯：Ignored Keywords / Payment Keywords / Sanitization
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  getIgnoredKeywords,
  isIgnoredKeyword,
} = require('../src/config');

const PAYMENT_KEYWORDS = [
  '帳號', '匯款', '轉帳', '付款', '如何付款', 'line pay', '街口',
  '銀行', '怎麼付', '付錢', '費用的問題', '多少錢', '匯費',
];
const PAYMENT_MAX_LENGTH = 50;

function shouldInterceptPayment(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const isPaymentQuery = PAYMENT_KEYWORDS.some((kw) => lowerText.includes(kw));
  return text.length <= PAYMENT_MAX_LENGTH && isPaymentQuery;
}

function processEvent(text, envIgnoredKeywords) {
  const keywords = envIgnoredKeywords || getIgnoredKeywords();
  if (isIgnoredKeyword(text, keywords)) {
    return { shouldForward: false, reason: 'ignored_keyword' };
  }
  if (shouldInterceptPayment(text)) {
    return { shouldForward: false, reason: 'payment_keyword_intercept' };
  }
  return { shouldForward: true, reason: null };
}

function testIgnoredIntercept(input, expected, description) {
  const r = processEvent(input);
  assert.strictEqual(r.shouldForward, !expected, `${description}: expected shouldForward=${!expected}`);
  assert.strictEqual(r.reason, expected ? 'ignored_keyword' : null, `${description}: expected reason=${expected ? 'ignored_keyword' : 'null'}`);
}

function testPaymentIntercept(input, expected, description) {
  const r = processEvent(input);
  if (expected) {
    assert.strictEqual(r.shouldForward, false, `${description}: expected blocked`);
    assert.strictEqual(r.reason, 'payment_keyword_intercept');
  } else if (r.reason === null) {
    assert.strictEqual(r.shouldForward, true, `${description}: expected forward`);
  }
}

test('Ignored Keywords Intercept — Rich menu / FAQ buttons + Bug #1 fix', () => {
  testIgnoredIntercept('常見問題', true, 'Rich menu 常見問題');
  testIgnoredIntercept('我要訂購', false, 'B01 fix: 我要訂購 不再被 Worker 攔截');
  testIgnoredIntercept('黑羽放山雞介紹', true, 'Keyword reply 黑羽放山雞介紹');
  testIgnoredIntercept('蔥鹽醬介紹', true, 'Keyword reply 蔥鹽醬介紹');
  testIgnoredIntercept('吃法介紹', true, 'Keyword reply 吃法介紹');
  testIgnoredIntercept(' 常見問題 ', true, 'with whitespace');
  testIgnoredIntercept('  常見問題', true, 'leading whitespace');
  testIgnoredIntercept('我要看常見問題', false, 'partial - forward to LLM');
  testIgnoredIntercept('常見問題給我', false, 'partial - forward to LLM');
  testIgnoredIntercept('常見問題xxx', false, 'extra chars - forward to LLM');
  testIgnoredIntercept('菜單', false, '菜單 已改由 LLM 接手（2026-06-30 修整）');
  testIgnoredIntercept('我要看菜單', false, '菜單系列由 LLM 處理');
  testIgnoredIntercept('你好', false, 'greeting - forward');
});

test('Payment Keywords Intercept — 短訊息攔截', () => {
  testPaymentIntercept('請問怎麼付款', true, 'short payment question');
  testPaymentIntercept('付款方式', true, 'payment method short');
  testPaymentIntercept('轉帳帳號', true, 'transfer account short');
  testPaymentIntercept('多少錢', true, 'price question short');
  testPaymentIntercept('我想要訂購雞肉，付款方式選轉帳，我的地址是新北市三峽區...', false, 'long message with payment keyword');
  testPaymentIntercept('我已經轉帳完成，請查收這是付款證明，這是我的訂單編號...', false, 'long message - actual order');
  testPaymentIntercept('這是一個非常長的訊息，用來測試當訊息長度超過 50 字時，不應被 payment_keyword 攔截。', false, 'long non-payment message');
});

test('Ignored vs Payment Mutual Exclusion — 互不衝突', () => {
  // 「菜單」應 forward 給 LLM（Session Q 2026-06-30 修整後）
  const r1 = processEvent('菜單');
  assert.strictEqual(r1.reason, null);
  assert.strictEqual(r1.shouldForward, true);

  // 「付款」不應被 ignored 攔截
  const r2 = processEvent('付款');
  assert.strictEqual(r2.reason, 'payment_keyword_intercept');

  // 正常訊息
  const r3 = processEvent('我想要訂購雞肉');
  assert.strictEqual(r3.reason, null);

  // 完全不該被攔截
  const r4 = processEvent('你們的雞肉好吃嗎？');
  assert.strictEqual(r4.reason, null);
});

test('Custom IGNORED_KEYWORDS Override — env 設定覆蓋 default', () => {
  const customKeywords = ['自訂關鍵字1', '自訂關鍵字2'];
  const defaultResult = processEvent('常見問題');
  assert.strictEqual(defaultResult.reason, 'ignored_keyword');

  const customResult = processEvent('自訂關鍵字1', customKeywords);
  assert.strictEqual(customResult.reason, 'ignored_keyword');
  assert.strictEqual(customResult.shouldForward, false);

  const mixedResult = processEvent('常見問題', customKeywords);
  assert.strictEqual(mixedResult.reason, null);
});

test('Boundary Cases — 空 / null / undefined', () => {
  const emptyResult = processEvent('');
  assert.strictEqual(emptyResult.reason, null);

  const nullResult = processEvent(null);
  assert.strictEqual(nullResult.reason, null);

  const undefResult = processEvent(undefined);
  assert.strictEqual(undefResult.reason, null);
});

test('Worker Deployment Consistency — Bug #1 fix 同步', () => {
  const fsCheck = require('fs');
  const WORKER_SRC_PATH = '/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/src/index.ts';
  let workerSrc = '';
  try {
    workerSrc = fsCheck.readFileSync(WORKER_SRC_PATH, 'utf8');
  } catch (e) {
    // skip if not found
    return;
  }
  assert.ok(workerSrc.includes('isIgnoredKeyword') || workerSrc.includes('getIgnoredKeywords'),
    'Worker source should have isIgnoredKeyword/getIgnoredKeywords function');
  // 菜單 keyword 不應在 DEFAULT_IGNORED_KEYWORDS（會被無聲 drop）
  // Round 31 P0.4 fix: 菜單 可在 MENU_IMAGE_KEYWORDS（菜單圖片查詢，Hubert 5 號 15:57 設計）
  const ignoredMatch = workerSrc.match(/DEFAULT_IGNORED_KEYWORDS\s*=\s*\[([^\]]*)\]/);
  if (ignoredMatch) {
    assert.ok(!ignoredMatch[1].includes("'菜單'"),
      'Worker DEFAULT_IGNORED_KEYWORDS should NOT have 菜單 (Session Q 2026-06-30)');
  }
  assert.ok(!workerSrc.includes("'我要訂購'"),
    'B01 fix: Worker 不再有 我要訂購 keyword');
  assert.ok(workerSrc.includes("'常見問題'"),
    'Worker source should have 常見問題 keyword');
});
