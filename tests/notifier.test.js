'use strict';

/**
 * notifier.test.js
 *
 * 測試 src/handoff/notifier.js 的核心流程
 * - getHubertLineUserId（fallback 預設 user ID）
 * - notifyHubertViaLine（feature flag + token check + HTTPS 呼叫）
 * - sendTextMessage / sendImageMessage（LINE Push API）
 * - notifyHubert（LINE + Email 並行）
 *
 * Mocks 策略：
 * - https.request 整個替換（測試前/後 restore）
 * - emailNotifier.sendEmail 直接改 module 上的方法
 * - config 用 require.cache 注入假值（因 notifier 在 require 時已 capture config exports）
 * - 每個 test 結束後 refresh notifier module，避免 state pollution
 */

const { test } = require('node:test');
const assert = require('assert');
const EventEmitter = require('events');
const https = require('https');

// Module paths
const cfgPath = require.resolve('../src/config');
const enPath = require.resolve('../src/handoff/emailNotifier');
const notPath = require.resolve('../src/handoff/notifier');

// === Mock utilities ===

function mockHttps(statusCode, body) {
  const orig = https.request;
  let capturedOptions = null;
  https.request = function (options, cb) {
    capturedOptions = options;
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => {};
    req.setTimeout = () => {};
    process.nextTick(() => {
      const res = new EventEmitter();
      res.statusCode = statusCode;
      cb(res);
      if (body) res.emit('data', body);
      res.emit('end');
    });
    return req;
  };
  return {
    capturedOptions: () => capturedOptions,
    restore: () => { https.request = orig; },
  };
}

function reloadNotifier(configOverrides = {}) {
  delete require.cache[cfgPath];
  delete require.cache[enPath];
  delete require.cache[notPath];
  const cfg = require(cfgPath);
  for (const [k, v] of Object.entries(configOverrides)) cfg[k] = v;
  const en = require(enPath);
  const notifier = require(notPath);
  return { cfg, en, notifier };
}

function restore() {
  delete require.cache[cfgPath];
  delete require.cache[enPath];
  delete require.cache[notPath];
}

// === Tests ===

// ---------------------------------------------------------------------------
// getHubertLineUserId
// ---------------------------------------------------------------------------

test('getHubertLineUserId — 從 config 取（config 有值時）', () => {
  const { notifier } = reloadNotifier({ getNotifyOwnerUserId: () => 'config-user-id-123' });
  assert.strictEqual(notifier.getHubertLineUserId(), 'config-user-id-123');
  restore();
});

test('getHubertLineUserId — config null/undefined → fallback DEFAULT', () => {
  const { notifier } = reloadNotifier({ getNotifyOwnerUserId: () => null });
  const id = notifier.getHubertLineUserId();
  assert.ok(id && typeof id === 'string', '應該 fallback 預設 user ID（字串）');
  // Default 是 'Uf56650056d35626deb64165926a26182'（Hubert LINE User ID）
  assert.ok(id.length > 20, '預設值是 LINE User ID（長 >20）');
  restore();
});

// ---------------------------------------------------------------------------
// notifyHubertViaLine — guards
// ---------------------------------------------------------------------------

test('notifyHubertViaLine — feature disabled → skip, return false', async () => {
  const { notifier } = reloadNotifier({ isFeatureEnabled: () => false });
  const result = await notifier.notifyHubertViaLine('test message');
  assert.strictEqual(result.success, false);
  assert.match(result.error || '', /disabled|enabled\s*=\s*false/);
  restore();
});

test('notifyHubertViaLine — token 缺失 → skip, return false', async () => {
  const { notifier } = reloadNotifier({
    isFeatureEnabled: () => true,
    getLineBotToken: () => null,
  });
  const result = await notifier.notifyHubertViaLine('test message');
  assert.strictEqual(result.success, false);
  assert.match(result.error || '', /Token/);
  restore();
});

// ---------------------------------------------------------------------------
// notifyHubertViaLine — HTTPS mock + success/failure paths
// ---------------------------------------------------------------------------

test('notifyHubertViaLine — LINE API 回 200 → success', async () => {
  const m = mockHttps(200, JSON.stringify({ sentAt: '2026-07-29T12:00:00Z' }));
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
      getNotifyOwnerUserId: () => 'test-user-id',
    });
    const result = await notifier.notifyHubertViaLine('hello line');
    assert.strictEqual(result.success, true);
    // 確認 HTTPS request 確實呼叫，且帶正確 method/host
    const opts = m.capturedOptions();
    assert.strictEqual(opts.method, 'POST');
    assert.match(opts.hostname, /api\.line\.me/);
    assert.match(opts.path, /\/v2\/bot\/message\/push/);
  } finally {
    m.restore();
    restore();
  }
});

test('notifyHubertViaLine — LINE API 回 500 → success false', async () => {
  const m = mockHttps(500, 'Internal Server Error');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
      getNotifyOwnerUserId: () => 'test-user-id',
    });
    const result = await notifier.notifyHubertViaLine('hello');
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /500/);
  } finally {
    m.restore();
    restore();
  }
});

// ---------------------------------------------------------------------------
// sendTextMessage — 直接測試（公開 API）
// ---------------------------------------------------------------------------

test('sendTextMessage — POST 帶 access token 在 header', async () => {
  const m = mockHttps(200, '{"sentAt":"2026-07-29T12:00:00Z"}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'my-access-token-xyz',
      getNotifyOwnerUserId: () => 'user-id-abc',
    });
    const result = await notifier.sendTextMessage('test text', 'user-id-abc');
    assert.strictEqual(result.success, true);
    const opts = m.capturedOptions();
    // Confirm Authorization header has the token
    const authHeader = opts.headers.Authorization || opts.headers.authorization;
    assert.ok(authHeader && authHeader.includes('my-access-token-xyz'),
      'Authorization header 應含 token');
  } finally {
    m.restore();
    restore();
  }
});

// ---------------------------------------------------------------------------
// notifyHubert — LINE + Email 並行
// ---------------------------------------------------------------------------

test('notifyHubert — LINE + Email 都成功 → result 有 line.email 兩個欄位', async () => {
  const m = mockHttps(200, JSON.stringify({ sentAt: '2026-07-29T12:00:00Z' }));
  let emailCalled = false;
  try {
    const { notifier, en } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
      getNotifyOwnerUserId: () => 'user-id',
      getEmailConfig: () => ({ enabled: true, digest_to: 'test@example.com' }),
    });
    const _origSendEmail = en.sendEmail;
    en.sendEmail = async () => { emailCalled = true; return { success: true, messageId: 'stub' }; };

    const result = await notifier.notifyHubert('test', { orderId: 'ORD-001' });
    assert.ok(result.line, 'result.line 應存在');
    assert.strictEqual(result.line.success, true);
    assert.ok(result.email, 'result.email 應存在');
    assert.strictEqual(result.email.success, true);
    assert.ok(emailCalled, 'sendEmail 應被呼叫');
  } finally {
    m.restore();
    restore();
  }
});

test('notifyHubert — LINE 500 → LINE fail + Email fallback', async () => {
  const m = mockHttps(500, 'Server Error');
  let emailCalled = false;
  let emailParam = null;
  try {
    const { notifier, en } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
      getNotifyOwnerUserId: () => 'user-id',
      getEmailConfig: () => ({ enabled: true, digest_to: 'test@example.com' }),
    });
    const _origSendEmail = en.sendEmail;
    en.sendEmail = async (params) => { emailCalled = true; emailParam = params; return { success: true }; };

    const result = await notifier.notifyHubert('test', { orderId: 'ORD-002' });
    assert.strictEqual(result.line.success, false);
    assert.strictEqual(result.email.success, true);
    assert.ok(emailCalled, 'LINE 失敗時應該 fallback 寄 Email');
    assert.ok(emailParam, 'Email 應收到 message 參數');
  } finally {
    m.restore();
    restore();
  }
});

// ---------------------------------------------------------------------------
// Edge case: 缺少 recipient
// ---------------------------------------------------------------------------

test('sendTextMessage — 沒有 recipientUserId → success false', async () => {
  const { notifier } = reloadNotifier({
    isFeatureEnabled: () => true,
    getLineBotToken: () => 'test-token',
  });
  const result = await notifier.sendTextMessage('hello', '');
  assert.strictEqual(result.success, false);
  assert.match(result.error || '', /recipient|user/);
  restore();
});
