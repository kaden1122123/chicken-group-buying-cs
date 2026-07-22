'use strict';

/**
 * COMPLETED State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/completed.js 的 handleCompleted
 */

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

const {
  handleCompleted,
} = require('../src/states/completed');
const { STATES } = require('../src/states/stateMachine');

test('handleCompleted — 訂購意圖 → AWAITING_INFO', () => {
  const intentResult = handleCompleted('user_1', '我要訂購', {}, {});
  assert.strictEqual(intentResult.action, 'new_order', `got ${intentResult.action}`);
  assert.strictEqual(intentResult.newState, STATES.AWAITING_INFO, `got ${intentResult.newState}`);
  assert.notStrictEqual(intentResult.reply, null, 'reply 應有內容');
  if (intentResult.reply) {
    assert.ok(/再次訂購|訂購資訊/.test(intentResult.reply.text), '應提示可再次訂購');
  }
});

test('handleCompleted — 各種訂購關鍵詞觸發 order_intent', () => {
  ['我要下單', '想訂', '要訂', '我來訂雞'].forEach((keyword) => {
    const result = handleCompleted('user_x', keyword, {}, {});
    assert.strictEqual(result.action, 'new_order', `「${keyword}」應 new_order, got ${result.action}`);
  });
});

test('handleCompleted — 非訂購意圖 → completed_idle', () => {
  const idleResult = handleCompleted('user_2', '你好', {}, {});
  assert.strictEqual(idleResult.action, 'completed_idle', `got ${idleResult.action}`);
  assert.strictEqual(idleResult.newState, STATES.COMPLETED, `got ${idleResult.newState}`);
  assert.strictEqual(idleResult.reply, null, 'reply 應為 null（不再主動回覆）');
});

test('handleCompleted — 非訂購訊息（多樣）→ completed_idle', () => {
  ['隨便聊聊', '你叫什麼', '天氣真好', '多少錢', '已付款嗎', '取消訂單'].forEach((msg) => {
    const result = handleCompleted('user_y', msg, {}, {});
    assert.strictEqual(result.action, 'completed_idle', `「${msg}」應 completed_idle, got ${result.action}`);
  });
});

test('handleCompleted — edge cases (null / undefined / empty)', () => {
  [
    { msg: null, label: 'null' },
    { msg: undefined, label: 'undefined' },
    { msg: '', label: 'empty string' },
  ].forEach(({ msg, label }) => {
    try {
      const result = handleCompleted('user_z', msg, {}, {});
      assert.strictEqual(result.action, 'completed_idle', `「${label}」應 completed_idle, got ${result.action}`);
    } catch (e) {
      assert.fail(`「${label}」不應 crash: ${e.message}`);
    }
  });
});

test('executeCompleted — KNOWN ISSUE 驗證（expect throw）', () => {
  // 這個測試「故意」驗證 executeCompleted 會 throw（防止 future regression 把 bug 修掉時沒注意）
  let executeThrew = false;
  let executeError = null;
  try {
    const { executeCompleted } = require('../src/states/completed');
    executeCompleted({
      user_line_name: 'H8測試',
      delivery_date: '2099-12-31',
      chicken_items: { 鹽水雞: 1 },
    });
    assert.fail('executeCompleted 應 throw 但沒 throw — bug 已修,請更新 test');
  } catch (e) {
    executeThrew = true;
    executeError = e;
    assert.ok(executeError instanceof TypeError, `got ${executeError.name}: ${executeError.message}`);
    assert.ok(/formatThankYou is not a function/.test(executeError.message), `got: ${executeError.message.slice(0, 80)}`);
  }
  assert.ok(executeThrew, 'executeCompleted 應 throw');
});

// teardown — cleanup 測試 CSV
test('teardown — cleanup 測試 CSV', () => {
  const testFiles = [
    path.join(__dirname, '..', 'data', 'orders', 'chicken', '2099-12-31.csv'),
  ];
  testFiles.forEach((f) => {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    } catch (e) {
      // 容忍清理失敗
    }
  });
});
