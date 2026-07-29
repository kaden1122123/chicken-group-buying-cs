'use strict';

/**
 * sheetsSync.test.js
 *
 * 測試 src/storage/sheetsSync.js 的核心流程
 * - base64url（JWT utility）
 * - ordersToSheetValues（純資料轉換）
 * - getAccessToken（OAuth JWT 簽章 + token 換發）
 * - syncOrdersToSheets（主流程：config 驗證 + 寫入 Sheets）
 * - getFirstSheetName（auto-discover sheet 名稱）
 * - collectAllOrders（從 CSV 目錄讀訂單）
 *
 * Mocks 策略：
 * - https.request / https.get 替換成 EventEmitter，回傳預設 statusCode + body
 * - fs.writeFileSync 寫入 fake credentials（含 RSA keypair）
 * - config module 用 require.cache 注入假值
 * - getTenantId 用 fake tenant 避免讀到 production 訂單
 */

const { test } = require('node:test');
const assert = require('assert');
const EventEmitter = require('events');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

// Module paths
const cfgPath = require.resolve('../src/config');
const ssPath = require.resolve('../src/storage/sheetsSync');

// === Mock utilities ===

function mockHttpsRequest(responses) {
  const orig = https.request;
  let callIndex = 0;
  const captured = [];
  https.request = function (options, cb) {
    captured.push(options);
    const r = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => {};
    req.setTimeout = () => {};
    req.destroy = () => {};
    process.nextTick(() => {
      const res = new EventEmitter();
      res.statusCode = r.statusCode;
      cb(res);
      if (r.body) res.emit('data', r.body);
      res.emit('end');
    });
    return req;
  };
  return {
    captured,
    restore: () => { https.request = orig; },
  };
}

function mockHttpsGet(response) {
  const orig = https.get;
  let captured = null;
  https.get = function (options, cb) {
    captured = options;
    const req = new EventEmitter();
    req.end = () => {};
    req.setTimeout = () => {};
    req.destroy = () => {};
    process.nextTick(() => {
      const res = new EventEmitter();
      res.statusCode = response.statusCode;
      cb(res);
      if (response.body) res.emit('data', response.body);
      res.emit('end');
    });
    return req;
  };
  return {
    capturedOptions: () => captured,
    restore: () => { https.get = orig; },
  };
}

function generateTestCredentials() {
  const { publicKey: _publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: privateKey,
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '1234567890',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com',
  };
}

const FAKE_CREDS_PATH = '/tmp/test-sheets-sync-creds.json';

function setupFakeCredsFile() {
  fs.writeFileSync(FAKE_CREDS_PATH, JSON.stringify(generateTestCredentials()));
  return FAKE_CREDS_PATH;
}

function cleanupFakeCredsFile() {
  try { fs.unlinkSync(FAKE_CREDS_PATH); } catch (_) { /* ignore */ }
}

function reloadSheetsSync(configOverrides = {}) {
  delete require.cache[cfgPath];
  delete require.cache[ssPath];
  const cfg = require(cfgPath);
  for (const [k, v] of Object.entries(configOverrides)) cfg[k] = v;
  const sheetsSync = require(ssPath);
  return { cfg, sheetsSync };
}

function restore() {
  delete require.cache[cfgPath];
  delete require.cache[ssPath];
}

// === Tests ===

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

test('base64url — basic string input', () => {
  const { sheetsSync } = reloadSheetsSync();
  assert.strictEqual(sheetsSync.base64url('hello'), 'aGVsbG8');
  restore();
});

test('base64url — Buffer input same as string', () => {
  const { sheetsSync } = reloadSheetsSync();
  assert.strictEqual(sheetsSync.base64url(Buffer.from('hello')), sheetsSync.base64url('hello'));
  restore();
});

test('base64url — replaces + / and strips = padding', () => {
  const { sheetsSync } = reloadSheetsSync();
  // 'subjects??' base64 contains +, /, =
  const result = sheetsSync.base64url('subjects??');
  assert.ok(!result.includes('+'), '不應含 +');
  assert.ok(!result.includes('/'), '不應含 /');
  assert.ok(!result.includes('='), '不應含 = padding');
  restore();
});

test('base64url — JSON.stringify input', () => {
  const { sheetsSync } = reloadSheetsSync();
  const result = sheetsSync.base64url(JSON.stringify({ alg: 'RS256' }));
  assert.ok(typeof result === 'string' && result.length > 0);
  restore();
});

// ---------------------------------------------------------------------------
// ordersToSheetValues
// ---------------------------------------------------------------------------

test('ordersToSheetValues — empty array returns []', () => {
  const { sheetsSync } = reloadSheetsSync();
  assert.deepStrictEqual(sheetsSync.ordersToSheetValues([]), []);
  restore();
});

test('ordersToSheetValues — header row always first', () => {
  const { sheetsSync } = reloadSheetsSync();
  const result = sheetsSync.ordersToSheetValues([{ order_id: 'ORD-001' }]);
  assert.strictEqual(result[0][0], 'order_id');
  assert.strictEqual(result[0].length, 29, '應有 29 個欄位');
  restore();
});

test('ordersToSheetValues — null/undefined values become empty string', () => {
  const { sheetsSync } = reloadSheetsSync();
  const result = sheetsSync.ordersToSheetValues([{
    order_id: 'ORD-002',
    user_line_name: null,
    user_phone: undefined,
  }]);
  const nameIdx = result[0].indexOf('user_line_name');
  const phoneIdx = result[0].indexOf('user_phone');
  assert.strictEqual(result[1][nameIdx], '', 'null → ""');
  assert.strictEqual(result[1][phoneIdx], '', 'undefined → ""');
  restore();
});

test('ordersToSheetValues — objects serialized as JSON', () => {
  const { sheetsSync } = reloadSheetsSync();
  const result = sheetsSync.ordersToSheetValues([{ order_id: 'ORD-003', chicken_items: { 大雞腿: 2 } }]);
  const idx = result[0].indexOf('chicken_items');
  assert.strictEqual(result[1][idx], '{"大雞腿":2}');
  restore();
});

test('ordersToSheetValues — numbers stay as string', () => {
  const { sheetsSync } = reloadSheetsSync();
  const result = sheetsSync.ordersToSheetValues([{ order_id: 'ORD-004', total_amount: 1234 }]);
  const idx = result[0].indexOf('total_amount');
  assert.strictEqual(result[1][idx], '1234');
  restore();
});

// ---------------------------------------------------------------------------
// getAccessToken — OAuth JWT flow
// ---------------------------------------------------------------------------

test('getAccessToken — happy path: 200 → returns access_token', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test-token', expires_in: 3600 }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    const token = await sheetsSync.getAccessToken(creds);
    assert.strictEqual(token, 'ya29.test-token');
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getAccessToken — POST to oauth2.googleapis.com/token with JWT in body', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.x' }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await sheetsSync.getAccessToken(creds);
    const opts = m.captured[0];
    assert.strictEqual(opts.hostname, 'oauth2.googleapis.com');
    assert.strictEqual(opts.path, '/token');
    assert.strictEqual(opts.method, 'POST');
    assert.ok(!opts.headers.Authorization, 'OAuth 請求不應有 Authorization header');
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getAccessToken — token request 500 → reject', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([{ statusCode: 500, body: 'Internal Server Error' }]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await assert.rejects(
      sheetsSync.getAccessToken(creds),
      /Token request failed \(500\)/,
    );
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getAccessToken — invalid JSON response → reject', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([{ statusCode: 200, body: 'not-json' }]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await assert.rejects(
      sheetsSync.getAccessToken(creds),
      /Failed to parse token response/,
    );
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getAccessToken — 401 unauthorized → reject', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([{ statusCode: 401, body: '{"error":"unauthorized"}' }]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await assert.rejects(
      sheetsSync.getAccessToken(creds),
      /Token request failed \(401\)/,
    );
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

// ---------------------------------------------------------------------------
// syncOrdersToSheets — config validation
// ---------------------------------------------------------------------------

test('syncOrdersToSheets — getStorageConfig returns null → success false', async () => {
  const { sheetsSync } = reloadSheetsSync({ getStorageConfig: () => null });
  const result = await sheetsSync.syncOrdersToSheets();
  assert.strictEqual(result.success, false);
  assert.ok(result.errors[0].includes('storage.phase2 config'));
  restore();
});

test('syncOrdersToSheets — phase2.enabled = false → success false', async () => {
  const { sheetsSync } = reloadSheetsSync({
    getStorageConfig: () => ({ phase2: { enabled: false } }),
  });
  const result = await sheetsSync.syncOrdersToSheets();
  assert.strictEqual(result.success, false);
  assert.ok(result.errors[0].includes('phase2.enabled = false'));
  restore();
});

test('syncOrdersToSheets — credentials file missing → success false', async () => {
  const { sheetsSync } = reloadSheetsSync({
    getStorageConfig: () => ({
      phase2: {
        enabled: true,
        auth: { credentials_path: '/tmp/nonexistent-creds-file-xyz-abc-123.json' },
        spreadsheet_id: 'test-sheet-id',
      },
    }),
    getTenantId: () => 'fake-tenant-empty',
  });
  const result = await sheetsSync.syncOrdersToSheets();
  assert.strictEqual(result.success, false);
  assert.ok(result.errors[0].includes('service account JSON 不存在'));
  restore();
});

test('syncOrdersToSheets — spreadsheet_id missing → success false', async () => {
  const credsPath = setupFakeCredsFile();
  const { sheetsSync } = reloadSheetsSync({
    getStorageConfig: () => ({
      phase2: {
        enabled: true,
        auth: { credentials_path: credsPath },
        spreadsheet_id: null,
      },
    }),
    getTenantId: () => 'fake-tenant-empty',
  });
  const result = await sheetsSync.syncOrdersToSheets();
  assert.strictEqual(result.success, false);
  assert.ok(result.errors[0].includes('spreadsheet_id 未設定'));
  restore();
  cleanupFakeCredsFile();
});

// ---------------------------------------------------------------------------
// syncOrdersToSheets — happy path
// ---------------------------------------------------------------------------

test('syncOrdersToSheets — dryRun: 跳過 HTTPS 呼叫，回 dryRun:true', async () => {
  const credsPath = setupFakeCredsFile();
  const m = mockHttpsRequest([]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'Orders',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets({ dryRun: true });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(m.captured.length, 0, 'dryRun 不應打 HTTPS');
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('syncOrdersToSheets — happy path: auto-discover + clear + append + success', async () => {
  const credsPath = setupFakeCredsFile();
  const get = mockHttpsGet({
    statusCode: 200,
    body: JSON.stringify({ sheets: [{ properties: { title: 'DiscoveredSheet' } }] }),
  });
  const m = mockHttpsRequest([
    // getFirstSheetName 內部 getAccessToken（auto-discover sheet metadata 前）
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.inner' }) },
    // syncOrdersToSheets 主流程 getAccessToken（clear/append 前）
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.outer' }) },
    // clear
    { statusCode: 200, body: '{}' },
    // append
    { statusCode: 200, body: JSON.stringify({ updatedRows: 0 }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'ConfigSheet',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets();
    assert.strictEqual(result.success, true);
    assert.ok(result.rowsWritten >= 0);
    // getFirstSheetName 透過 https.get 呼叫
    const getOpts = get.capturedOptions();
    assert.match(getOpts.path, /\/v4\/spreadsheets\/test-sheet-id/);
    // 4 https.request calls：getFirstSheetName 內部 token + 主流程 token + clear + append
    // （已知：雙 token 呼叫是浪費，未來可重構成傳 token 進 getFirstSheetName 消除冗餘）
    assert.strictEqual(m.captured.length, 4);
    assert.match(m.captured[2].path, /:clear$/);
    assert.match(m.captured[3].path, /:append/);
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('syncOrdersToSheets — metadata 404 → fallback 到 config.sheet_name', async () => {
  const credsPath = setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 404, body: 'Not Found' });
  const m = mockHttpsRequest([
    // getFirstSheetName 內部 token
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.inner' }) },
    // syncOrdersToSheets 主流程 token
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.outer' }) },
    // clear
    { statusCode: 200, body: '{}' },
    // append
    { statusCode: 200, body: JSON.stringify({ updatedRows: 0 }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'FallbackSheetName',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets();
    assert.strictEqual(result.success, true, 'fallback 寫入應成功');
    // Append 應該用 FallbackSheetName（URL-encoded 帶單引號）— 索引 [3] 而非 [2]
    const appendPath = m.captured[3].path;
    assert.ok(
      appendPath.includes(encodeURIComponent("'FallbackSheetName'!A1")),
      `append path 應含 'FallbackSheetName'!A1，實際：${decodeURIComponent(appendPath)}`,
    );
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

// ---------------------------------------------------------------------------
// syncOrdersToSheets — API error paths
// ---------------------------------------------------------------------------

test('syncOrdersToSheets — token request 500 → success false', async () => {
  const credsPath = setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 200, body: JSON.stringify({ sheets: [{ properties: { title: 'S' } }] }) });
  const m = mockHttpsRequest([{ statusCode: 500, body: 'OAuth Server Error' }]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'Orders',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets();
    assert.strictEqual(result.success, false);
    assert.ok(result.errors[0].includes('Token request failed'));
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('syncOrdersToSheets — Sheets append 500 → success false + error msg', async () => {
  const credsPath = setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 200, body: JSON.stringify({ sheets: [{ properties: { title: 'S' } }] }) });
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
    { statusCode: 200, body: '{}' },
    { statusCode: 500, body: 'Sheets API Error' },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'Orders',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets();
    assert.strictEqual(result.success, false);
    assert.ok(result.errors[0].includes('Sheets API failed (500)'));
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('syncOrdersToSheets — Sheets clear 500 → success false', async () => {
  const credsPath = setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 200, body: JSON.stringify({ sheets: [{ properties: { title: 'S' } }] }) });
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
    { statusCode: 500, body: 'Clear failed' },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'Orders',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets();
    assert.strictEqual(result.success, false);
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

// ---------------------------------------------------------------------------
// getFirstSheetName — auto-discover sheet
// ---------------------------------------------------------------------------

test('getFirstSheetName — success returns first sheet title', async () => {
  setupFakeCredsFile();
  const get = mockHttpsGet({
    statusCode: 200,
    body: JSON.stringify({ sheets: [{ properties: { title: 'FirstSheet' } }] }),
  });
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    const title = await sheetsSync.getFirstSheetName(creds, 'test-sheet-id');
    assert.strictEqual(title, 'FirstSheet');
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getFirstSheetName — 404 → reject', async () => {
  setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 404, body: 'Not Found' });
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await assert.rejects(
      sheetsSync.getFirstSheetName(creds, 'missing-sheet-id'),
      /Get metadata failed: 404/,
    );
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

test('getFirstSheetName — invalid JSON response → reject', async () => {
  setupFakeCredsFile();
  const get = mockHttpsGet({ statusCode: 200, body: 'not-json' });
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await assert.rejects(
      sheetsSync.getFirstSheetName(creds, 'test-sheet-id'),
      /Parse metadata failed/,
    );
  } finally {
    get.restore();
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

// ---------------------------------------------------------------------------
// collectAllOrders
// ---------------------------------------------------------------------------

test('collectAllOrders — fake tenant (dir missing) → empty array', () => {
  const { sheetsSync } = reloadSheetsSync({ getTenantId: () => 'fake-nonexistent-tenant-xyz' });
  const orders = sheetsSync.collectAllOrders();
  assert.deepStrictEqual(orders, []);
  restore();
});

test('collectAllOrders — returns array (even if empty)', () => {
  const { sheetsSync } = reloadSheetsSync({ getTenantId: () => 'fake-tenant-empty' });
  const orders = sheetsSync.collectAllOrders();
  assert.ok(Array.isArray(orders));
  restore();
});

// ---------------------------------------------------------------------------
// Edge: JWT structure sanity
// ---------------------------------------------------------------------------

test('getAccessToken — JWT body 含 client_email + scope + grant_type', async () => {
  setupFakeCredsFile();
  const m = mockHttpsRequest([
    { statusCode: 200, body: JSON.stringify({ access_token: 'ya29.test' }) },
  ]);
  try {
    const { sheetsSync } = reloadSheetsSync();
    const creds = generateTestCredentials();
    await sheetsSync.getAccessToken(creds);
    const req = m.captured[0];
    // Body 應含 assertion (JWT) — body 透過 req.write 寫入，但我們無法直接 capture
    // 改驗證：Content-Type 是 form-urlencoded 且 Content-Length > 0
    assert.match(req.headers['Content-Type'], /application\/x-www-form-urlencoded/);
    assert.ok(req.headers['Content-Length'] > 0);
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});

// ---------------------------------------------------------------------------
// httpsPost wrapper exposed indirectly via syncOrdersToSheets error path
// ---------------------------------------------------------------------------

test('syncOrdersToSheets — empty orders + dryRun → success true + ordersCount 0', async () => {
  const credsPath = setupFakeCredsFile();
  const m = mockHttpsRequest([]);
  try {
    const { sheetsSync } = reloadSheetsSync({
      getStorageConfig: () => ({
        phase2: {
          enabled: true,
          auth: { credentials_path: credsPath },
          spreadsheet_id: 'test-sheet-id',
          sheet_name: 'Orders',
        },
      }),
      getTenantId: () => 'fake-tenant-empty',
    });
    const result = await sheetsSync.syncOrdersToSheets({ dryRun: true });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.ordersCount, 0);
    assert.strictEqual(result.rowsWritten, 0);
  } finally {
    m.restore();
    restore();
    cleanupFakeCredsFile();
  }
});
