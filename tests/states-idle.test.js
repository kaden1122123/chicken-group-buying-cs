'use strict';

/**
 * IDLE State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/idle.js 的 4 個 exports
 */

const assert = require('assert');
const { test } = require('node:test');

const {
  isOrderIntent,
  isGreeting,
  handleIdle,
  buildOrderFormatReply,
} = require('../src/states/idle');
const { STATES } = require('../src/states/stateMachine');

test('isOrderIntent — 9 種訂購關鍵詞', () => {
  ['我要訂購', '我要下單', '我要買', '想訂一隻雞', '要訂雞肉', '我來下單', '想購買', '我來訂雞', '我要叫雞', '這是團購'].forEach((msg) => {
    assert.strictEqual(isOrderIntent(msg), true, `「${msg}」應 true`);
  });
});

test('isOrderIntent — 非訂購意圖', () => {
  ['你好', '多少錢', '', null, undefined].forEach((msg) => {
    assert.strictEqual(isOrderIntent(msg), false, `「${msg}」應 false`);
  });
});

test('isGreeting — 問候關鍵詞', () => {
  ['嗨', 'hi', 'Hello', 'hey', '你好', '您好', '早安', '午安', '晚安', '好', '  嗨  '].forEach((msg) => {
    assert.strictEqual(isGreeting(msg), true, `「${msg}」應 true`);
  });
});

test('isGreeting — 非問候', () => {
  ['多少錢', '我要訂購', '', null, undefined].forEach((msg) => {
    assert.strictEqual(isGreeting(msg), false, `「${msg}」應 false`);
  });
});

test('handleIdle — order_intent 分支', () => {
  const orderResult = handleIdle('user_1', '我要訂購', {});
  assert.strictEqual(orderResult.action, 'order_intent', `got ${orderResult.action}`);
  assert.strictEqual(orderResult.newState, STATES.AWAITING_INFO, `got ${orderResult.newState}`);
  assert.ok(orderResult.reply && orderResult.reply.type === 'text', 'reply 應有 type');
});

test('handleIdle — greeting 分支', () => {
  const greetResult = handleIdle('user_2', '嗨', {});
  assert.strictEqual(greetResult.action, 'greeting', `got ${greetResult.action}`);
  assert.strictEqual(greetResult.newState, STATES.IDLE, `got ${greetResult.newState}`);
  assert.notStrictEqual(greetResult.reply, null, 'reply 不應為 null');
});

test('handleIdle — kbContent 分支（knowledge lookup）', () => {
  const kbResult = handleIdle('user_3', '多少錢', { kbContent: '鹽水雞：NT$380' });
  assert.strictEqual(kbResult.action, 'kb_lookup', `got ${kbResult.action}`);
  assert.strictEqual(kbResult.newState, STATES.IDLE, `got ${kbResult.newState}`);
  assert.ok(kbResult.reply && /鹽水雞/.test(kbResult.reply.text), 'reply 應包含 kb 預覽');
});

test('handleIdle — kbContent 長度限制 (500 chars preview)', () => {
  const longKb = 'A'.repeat(800);
  const longKbResult = handleIdle('user_4', '多少錢', { kbContent: longKb });
  assert.ok(longKbResult.reply && longKbResult.reply.text.indexOf('AAAA') >= 0, '應包含預覽');
  const aaaCount = (longKbResult.reply.text.match(/A/g) || []).length;
  assert.ok(aaaCount <= 500, `A 字符數 ≤ 500, got ${aaaCount}`);
});

test('handleIdle — fallback 分支', () => {
  const fallbackResult = handleIdle('user_5', '隨便問', {});
  assert.strictEqual(fallbackResult.action, 'fallback', `got ${fallbackResult.action}`);
  assert.strictEqual(fallbackResult.newState, STATES.IDLE, `got ${fallbackResult.newState}`);
  assert.notStrictEqual(fallbackResult.reply, null, 'reply 不應為 null');
});

test('buildOrderFormatReply — quickReply 結構', () => {
  const formatReply = buildOrderFormatReply();
  assert.ok(formatReply && formatReply.type === 'text', '應有 type');
  assert.ok(formatReply && /訂購資訊|📌/.test(formatReply.text), 'text 應包含「📌 請填寫以下訂購資訊」');
  assert.ok(Array.isArray(formatReply.quickReply && formatReply.quickReply.items), 'items 應為 array');
  if (formatReply.quickReply && formatReply.quickReply.items) {
    assert.ok(formatReply.quickReply.items.length >= 2, `應至少 2 項, got ${formatReply.quickReply.items.length}`);
  }
});
