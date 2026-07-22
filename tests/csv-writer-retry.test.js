'use strict';

/**
 * csvWriter writeOrderWithRetry 測試（Session X4-A）
 *
 * 目的：守護 retry 機制
 *   - 源碼結構（9 項 grep 檢查）
 *   - 成功情境（直接調用 writeOrderWithRetry 真實寫入）
 *
 * 設計說明：
 *   writeOrder 是 closure，不易 monkey patch（writeOrderWithRetry 函式內部
 *   引用的是 module-load 時的原始 writeOrder，而非 exports.writeOrder），
 *   所以 retry-after-fail 的行為測試較難建構。本測試聚焦於：
 *   1. 源碼結構正確（grep 檢查 retry 邏輯存在）
 *   2. 實際成功寫入（驗證 export 與 sync API 正常）
 *   retry 行為的整合測試留給 production 觀察。
 */

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

const csvWriterPath = path.join(__dirname, '..', 'src', 'order', 'csvWriter.js');
const csvWriterSource = fs.readFileSync(csvWriterPath, 'utf8');

test('1. csvWriter 匯出 writeOrderWithRetry', () => {
  assert.ok(/writeOrderWithRetry\s*,/.test(csvWriterSource), 'exports 應有 writeOrderWithRetry');
});

test('2. writeOrderWithRetry 函數定義存在', () => {
  assert.ok(/function\s+writeOrderWithRetry\s*\(/.test(csvWriterSource), '應有 function writeOrderWithRetry');
});

test('3. 有 retry loop（for let attempt）', () => {
  assert.ok(/for\s*\(\s*(let|const)\s+attempt/.test(csvWriterSource), '應有 for (let attempt...)');
});

test('4. 有 busy-wait backoff 函數（syncSleep）', () => {
  assert.ok(/function\s+syncSleep\s*\(/.test(csvWriterSource), '應有 syncSleep()');
});

test('5. maxRetries 預設 3', () => {
  assert.ok(/DEFAULT_MAX_RETRIES\s*=\s*3/.test(csvWriterSource), '應有 DEFAULT_MAX_RETRIES = 3');
});

test('6. backoff 線性遞增（RETRY_BACKOFF_BASE_MS * attempt）', () => {
  assert.ok(/RETRY_BACKOFF_BASE_MS\s*\*\s*attempt/.test(csvWriterSource), '應有 RETRY_BACKOFF_BASE_MS * attempt');
});

test('7. retry 成功後 log info', () => {
  assert.ok(/succeeded after retry/.test(csvWriterSource), '應 log success info');
});

test('8. retry 失敗 log warn', () => {
  assert.ok(/attempt failed/.test(csvWriterSource), '應 log warn');
});

test('9. 最終 throw 含 retries 訊息', () => {
  assert.ok(/failed after.*retries/.test(csvWriterSource), 'throw 訊息含 retries');
});

test('10. 行為：成功情境 — writeOrderWithRetry 成功返回 order_id + < 1000ms', () => {
  const { writeOrderWithRetry } = require('../src/order/csvWriter');
  const start = Date.now();
  let orderId, elapsed;
  let threw = false;
  try {
    orderId = writeOrderWithRetry({
      user_line_name: 'X4-A成功測試',
      user_phone: '0912345678',
      address: '台北市',
      delivery_date: '2099-12-31',
      time_slot: '上午',
      chicken_items: '鹽水雞1盒',
      chicken_count: 1,
      side_count: 0,
      total_boxes: 1,
      subtotal: 380,
      delivery_fee: 0,
      total_amount: 380,
      payment_method: 'cash',
      order_id: 'TEST-X4A-SUCCESS',
    });
    elapsed = Date.now() - start;
  } catch (e) {
    threw = true;
  }
  assert.ok(!threw, '成功情境不應 throw');
  assert.ok(typeof orderId === 'string' && orderId.length > 0, `order_id 應回傳非空字串, got ${orderId}`);
  assert.ok(elapsed < 1000, `執行時間應 < 1000ms, got ${elapsed}ms`);

  // Cleanup 測試 CSV
  const testCsvFiles = [
    path.join(__dirname, '..', 'data', 'orders', 'chicken', '2099-12-31.csv'),
  ];
  for (const f of testCsvFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    } catch (e) {
      // 容忍清理失敗
    }
  }
});
