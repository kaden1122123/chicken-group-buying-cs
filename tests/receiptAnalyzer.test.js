'use strict';

/**
 * receiptAnalyzer.js 單元測試（Hubert 07:53「細心、完整做完剩餘待辦」）
 *
 * 涵蓋：
 *  - isAmountMatch：金額匹配邏輯（±1 元容差）
 *  - buildVisionPrompt：vision API prompt 生成
 *  - analyzeReceipt：純函數測試（不 mock analyzeWithVision — 內部 closure binding）
 *    - 現金付款跳過分析（confidence=1.0, likely_paid=false）
 *    - 沒 imagePath 回 error
 *    - 圖片不存在回 error
 *
 * 注意：analyzeWithVision 是內部 closure binding（production code 直接呼叫 `analyzeWithVision(...)`，不透過 module.exports），
 *       所以 mock `module.exports.analyzeWithVision` 不會影響內部呼叫。要測 vision 整合需用 proxyquire 或 require.cache 注入。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const receiptAnalyzer = require('../src/handoff/receiptAnalyzer');

// ===================
// isAmountMatch 純函數測試
// ===================
test('isAmountMatch — 完全相等', () => {
  assert.strictEqual(receiptAnalyzer.isAmountMatch(380, 380), true);
});

test('isAmountMatch — ±1 元容差（內）', () => {
  assert.strictEqual(receiptAnalyzer.isAmountMatch(379, 380), true);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(381, 380), true);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(380.5, 380), true);
});

test('isAmountMatch — 超過 ±1 元容差', () => {
  assert.strictEqual(receiptAnalyzer.isAmountMatch(378, 380), false);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(382, 380), false);
});

test('isAmountMatch — 非 number 輸入', () => {
  assert.strictEqual(receiptAnalyzer.isAmountMatch(null, 380), false);
  assert.strictEqual(receiptAnalyzer.isAmountMatch('380', 380), false);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(380, null), false);
});

test('isAmountMatch — expected = 0（容差 ±1）', () => {
  assert.strictEqual(receiptAnalyzer.isAmountMatch(0, 0), true);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(1, 0), true);
  assert.strictEqual(receiptAnalyzer.isAmountMatch(2, 0), false);
});

// ===================
// buildVisionPrompt 純函數測試
// ===================
test('buildVisionPrompt — 含訂單金額', () => {
  const prompt = receiptAnalyzer.buildVisionPrompt({ total_amount: 380 });
  assert.match(prompt, /380/);
  assert.match(prompt, /預期訂單金額/);
  assert.match(prompt, /NT\$/);
});

test('buildVisionPrompt — 沒金額時 fallback 0', () => {
  const prompt = receiptAnalyzer.buildVisionPrompt({});
  assert.match(prompt, /0/);
});

test('buildVisionPrompt — JSON 格式要求', () => {
  const prompt = receiptAnalyzer.buildVisionPrompt({ total_amount: 100 });
  assert.match(prompt, /json/);
  assert.match(prompt, /detected_amount/);
  assert.match(prompt, /detected_account_last5/);
  assert.match(prompt, /confidence/);
});

test('buildVisionPrompt — 付款方式標籤映射（內含 transfer / jko / linepay 提示）', () => {
  const prompt = receiptAnalyzer.buildVisionPrompt({ total_amount: 100 });
  assert.match(prompt, /transfer/);
  assert.match(prompt, /jko/);
  assert.match(prompt, /linepay/);
});

// ===================
// analyzeReceipt 純函數測試（不 mock vision API）
// ===================
test('analyzeReceipt — 沒 imagePath 回 error', async () => {
  const result = await receiptAnalyzer.analyzeReceipt({});
  assert.strictEqual(result.likely_paid, false);
  assert.match(result.error, /image_path_required/);
});

test('analyzeReceipt — 沒 imagePath 也沒 orderContext（全部 default）', async () => {
  const result = await receiptAnalyzer.analyzeReceipt({});
  assert.strictEqual(result.likely_paid, false);
  assert.strictEqual(result.detected_amount, null);
  assert.strictEqual(result.detected_account_last5, null);
  assert.strictEqual(result.confidence, 0); // makeResult default
});

test('analyzeReceipt — 圖片不存在回 error', async () => {
  const result = await receiptAnalyzer.analyzeReceipt({
    imagePath: '/tmp/non-existent-test-image-12345.png',
    orderContext: { payment_method: 'transfer', total_amount: 380 },
  });
  assert.strictEqual(result.likely_paid, false);
  assert.match(result.error, /image_not_found/);
});

// 現金付款測試（用現有臨時檔案）
test('analyzeReceipt — 現金付款（需先建臨時檔）', async () => {
  const tmpFile = path.join(os.tmpdir(), `receipt-test-cash-${Date.now()}.png`);
  fs.writeFileSync(tmpFile, 'mock', 'utf8');
  try {
    const result = await receiptAnalyzer.analyzeReceipt({
      imagePath: tmpFile,
      orderContext: { payment_method: 'cash', total_amount: 380 },
    });
    assert.strictEqual(result.likely_paid, false);
    assert.strictEqual(result.detected_amount, null);
    assert.strictEqual(result.confidence, 1.0);
    assert.strictEqual(result.source, 'cash_skip');
    assert.match(result.note, /現金/);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// 注意：vision API 整合測試需要 mock analyzeWithVision（內部 closure binding），
//       這需要 proxyquire 或 require.cache 注入，本測試套件不包含。
//       實際 vision 整合測試留待 integration test 階段。
test.skip('analyzeReceipt — vision API 整合測試（需 proxyquire 或 integration test）', async () => {
  // 待 proxyquire 安裝後補上
});
