'use strict';

/**
 * P0-2: handoff.js customer_reply 讀 config 驗證測試
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'tenants', 'chicken.yaml');
const HANDOFF_SOURCE = path.join(__dirname, '..', 'src', 'states', 'handoff.js');

test('config.js exports — getHandoffCustomerReply() 函數存在', () => {
  const cfg = require('../src/config');
  assert.strictEqual(typeof cfg.getHandoffCustomerReply, 'function', 'getHandoffCustomerReply should be a function');
});

test('Read from current config — getHandoffCustomerReply() 回傳預期字串', () => {
  const cfg = require('../src/config');
  const reply = cfg.getHandoffCustomerReply();
  assert.ok(reply.length > 0, 'customer_reply should not be empty');
  assert.ok(reply.includes('轉交給老闆處理'), 'reply should contain "轉交給老闆處理"');
  assert.ok(reply.includes('LINE 通知'), 'reply should contain "LINE 通知"');
});

test('YAML source check — chicken.yaml 有 customer_reply field', () => {
  const yamlContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  assert.ok(yamlContent.includes('customer_reply'), 'chicken.yaml should have customer_reply field');
  assert.ok(yamlContent.includes('轉交給老闆處理'), 'chicken.yaml should contain the expected text');
});

test('handoff.js source check — require config + 使用 getHandoffCustomerReply + DEFAULT fallback', () => {
  const handoffSource = fs.readFileSync(HANDOFF_SOURCE, 'utf8');

  assert.ok(
    handoffSource.includes("require('../config')") || handoffSource.includes('require("../config")'),
    'handoff.js should require config',
  );
  assert.ok(handoffSource.includes('getHandoffCustomerReply'), 'handoff.js should use getHandoffCustomerReply');
  assert.ok(handoffSource.includes('DEFAULT_HANDOFF_CUSTOMER_REPLY'), 'handoff.js should define DEFAULT_HANDOFF_CUSTOMER_REPLY');

  const defaultMatch = handoffSource.match(/DEFAULT_HANDOFF_CUSTOMER_REPLY\s*=\s*['"`]([^'"`]+)['"`]/);
  assert.ok(defaultMatch, 'DEFAULT_HANDOFF_CUSTOMER_REPLY should be defined as string literal');
  const defaultValue = defaultMatch[1];
  assert.ok(defaultValue.includes('老闆'), 'DEFAULT value should mention 老闆');
});

test('handleHandoff behavior — uses config reply string + newState = HUMAN_HANDOFF', async () => {
  const cfg = require('../src/config');
  const { handleHandoff } = require('../src/states/handoff');

  const result = await handleHandoff(
    'test-user-id',
    '要退款',
    {},
    { lineDisplayName: '測試用戶' },
  );
  assert.ok(result.reply, 'should return reply');
  assert.strictEqual(result.reply.type, 'text');
  assert.ok(result.reply.text);

  const expectedText = cfg.getHandoffCustomerReply();
  assert.strictEqual(result.reply.text, expectedText, 'reply text should match config');
  assert.strictEqual(result.newState, 'HUMAN_HANDOFF');
});
