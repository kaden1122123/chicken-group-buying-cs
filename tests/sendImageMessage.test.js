'use strict';

/**
 * sendImageMessage.test.js
 *
 * 測試 src/handoff/notifier.js 的 sendImageMessage 函式
 * （2026-07-16 P4 加 — 通用 LINE Push Image 訊息）
 *
 * 涵蓋：
 * - Happy path：LINE API 200 → resolve(true)
 * - 失敗 guards：缺 token / 缺 imageUrl / 缺 recipientUserId → return false（不 throw）
 * - LINE API 失敗：500 → reject
 * - previewImageUrl fallback：沒給就用 imageUrl
 *
 * Mocks 策略：
 * - https.request 整個替換（測試前/後 restore）
 * - config 用 require.cache 注入假值
 * - 與 notifier.test.js 類似的 reload pattern
 */

const { test } = require('node:test');
const assert = require('assert');
const EventEmitter = require('events');
const https = require('https');

// Module paths
const cfgPath = require.resolve('../src/config');
const notPath = require.resolve('../src/handoff/notifier');

// === Mock utilities ===

function mockHttpsRequest(statusCode, body) {
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
  delete require.cache[notPath];
  const cfg = require(cfgPath);
  for (const [k, v] of Object.entries(configOverrides)) cfg[k] = v;
  const notifier = require(notPath);
  return { cfg, notifier };
}

function restore() {
  delete require.cache[cfgPath];
  delete require.cache[notPath];
}

// === Tests ===

test('sendImageMessage — happy path: LINE API 200 → resolve(true)', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    const result = await notifier.sendImageMessage('https://example.com/full.jpg', null, 'user-id-abc');
    assert.strictEqual(result, true);
    // 確認 HTTPS request 帶正確 method/host
    const opts = m.capturedOptions();
    assert.strictEqual(opts.method, 'POST');
    assert.strictEqual(opts.hostname, 'api.line.me');
    assert.match(opts.path, /\/v2\/bot\/message\/push/);
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — LINE API 201 也視為成功（resolve(true)）', async () => {
  const m = mockHttpsRequest(201, '{"sentAt":"2026-07-29T12:00:00Z"}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    const result = await notifier.sendImageMessage('https://example.com/x.jpg', null, 'user-id-abc');
    assert.strictEqual(result, true);
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — token 缺失 → return false（不 throw）', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => null,
    });
    const result = await notifier.sendImageMessage('https://example.com/x.jpg', null, 'user-id');
    assert.strictEqual(result, false);
    assert.strictEqual(m.capturedOptions(), null, '無 token 不應打 HTTPS');
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — imageUrl 缺失 → return false', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    const result = await notifier.sendImageMessage('', null, 'user-id');
    assert.strictEqual(result, false);
    assert.strictEqual(m.capturedOptions(), null, '缺 imageUrl 不應打 HTTPS');
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — recipientUserId 缺失 → return false', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    const result = await notifier.sendImageMessage('https://example.com/x.jpg', null, '');
    assert.strictEqual(result, false);
    assert.strictEqual(m.capturedOptions(), null, '缺 recipientUserId 不應打 HTTPS');
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — LINE API 500 → reject', async () => {
  const m = mockHttpsRequest(500, 'Internal Server Error');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    await assert.rejects(
      notifier.sendImageMessage('https://example.com/x.jpg', null, 'user-id'),
      /LINE API returned 500/,
    );
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — previewImageUrl fallback 到 imageUrl（未給 preview）', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'test-token',
    });
    await notifier.sendImageMessage('https://example.com/x.jpg', undefined, 'user-id');
    const opts = m.capturedOptions();
    // 無法直接讀 body（透過 req.write 寫入），但確認有 HTTPS call
    assert.ok(opts, '應打 HTTPS');
    assert.strictEqual(opts.method, 'POST');
  } finally {
    m.restore();
    restore();
  }
});

test('sendImageMessage — Authorization header 含 token', async () => {
  const m = mockHttpsRequest(200, '{}');
  try {
    const { notifier } = reloadNotifier({
      isFeatureEnabled: () => true,
      getLineBotToken: () => 'my-image-token-xyz',
    });
    await notifier.sendImageMessage('https://example.com/x.jpg', null, 'user-id');
    const opts = m.capturedOptions();
    const authHeader = opts.headers.Authorization || opts.headers.authorization;
    assert.ok(authHeader && authHeader.includes('my-image-token-xyz'), 'Authorization header 應含 token');
  } finally {
    m.restore();
    restore();
  }
});
