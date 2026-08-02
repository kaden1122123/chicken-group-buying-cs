'use strict';

/**
 * Session I — API Server Hardening Tests
 *
 * 涵蓋 I1 (graceful shutdown)、I2 (CORS)、I3 (rate limit)、I4 (input validation)
 * 每段獨立 spawn 一個 server process，避免互相干擾。
 */

const assert = require('assert');
const { test } = require('node:test');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT_BASE = 3460;
const USERNAME = 'api-user';
const PASSWORD = 'chicken-test-pwd-9k2x';
const SERVER_PATH = path.join(__dirname, '..', 'scripts', 'api-server.js');
const VALID_ORDER = {
  order_data: {
    user_line_name: '測試用戶',
    user_phone: '0912345678',
    address: '新北市三峽區',
    delivery_date: '2026-08-04',  // Round 35 C4：改為新 open_dates（2026-08-04）
    time_slot: '上午',
    items: [{ name: '鹽水雞', qty: 1, total: 380 }],
    subtotal: 380,
    total_amount: 380,
    payment_method: '待定',
    payment_status: 'pending',
    order_status: 'confirmed',
  },
  source: 'hardening-test',
};

function startServer(portOffset, extraEnv) {
  const port = PORT_BASE + portOffset;
  const env = Object.assign({}, process.env, {
    PORT: String(port),
    API_USERNAME: USERNAME,
    API_PASSWORD: PASSWORD,
    MOCK_TODAY: '2026-08-03T10:00:00+08:00',  // Round 35 C4：改為 8 月（新 open_dates 2026-08-04 在本月）
  }, extraEnv || {});
  return {
    process: spawn('node', [SERVER_PATH], { env, stdio: ['ignore', 'pipe', 'pipe'] }),
    port,
    serverOutput: '',
  };
}

function attachOutput(handle) {
  handle.process.stdout.on('data', (d) => { handle.serverOutput += d.toString(); });
  handle.process.stderr.on('data', (d) => { handle.serverOutput += d.toString(); });
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = Object.assign({
      hostname: 'localhost',
      method: 'GET',
      headers: {},
    }, options);
    if (bodyStr) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data, json: null });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function waitForServer(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await httpRequest({ port, path: '/api/health', method: 'GET' });
      if (r.status === 200) return;
    } catch (e) { /* not ready */ }
    await new Promise((r2) => { setTimeout(r2, 100); });
  }
  throw new Error('Server not ready on port ' + port);
}

function killAndWait(proc, signal) {
  return new Promise((resolve) => {
    proc.on('exit', (code) => resolve(code));
    proc.kill(signal || 'SIGKILL');
  });
}

function authHeader() {
  return 'Basic ' + Buffer.from(USERNAME + ':' + PASSWORD).toString('base64');
}

test('I1: graceful shutdown', async () => {
  const h = startServer(0, { API_GRACEFUL_TIMEOUT_MS: '3000' });
  attachOutput(h);
  try {
    await waitForServer(h.port);

    // 一般 health 請求
    const r1 = await httpRequest({ port: h.port, path: '/api/health', method: 'GET' });
    assert.strictEqual(r1.status, 200);

    // 觸發 SIGTERM
    const exitCode = await killAndWait(h.process, 'SIGTERM');
    assert.strictEqual(exitCode, 0, 'SIGTERM 應 graceful exit (code 0)');
    assert.ok(h.serverOutput.includes('Received SIGTERM'), 'log 應包含 Received SIGTERM');
    assert.ok(h.serverOutput.includes('shutting down gracefully'), 'log 應包含 shutting down gracefully');
  } finally {
    try { if (!h.process.killed) h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
  }
});

test('I2: CORS white-list from env — 白名單 Origin echo', async () => {
  const allowedOrigin = 'https://chicken-worker.example.workers.dev';
  const h = startServer(1, { API_CORS_ORIGINS: allowedOrigin });
  attachOutput(h);
  try {
    await waitForServer(h.port);

    // OPTIONS preflight 帶 Origin → 回 204 + Access-Control-Allow-Origin echo
    const pre = await httpRequest({
      port: h.port, path: '/api/orders', method: 'OPTIONS',
      headers: { Origin: allowedOrigin },
    });
    assert.strictEqual(pre.status, 204, 'OPTIONS preflight 應回 204');
    assert.strictEqual(pre.headers['access-control-allow-origin'], allowedOrigin);

    // GET 帶白名單 Origin → echo
    const r1 = await httpRequest({
      port: h.port, path: '/api/health', method: 'GET',
      headers: { Origin: allowedOrigin },
    });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.headers['access-control-allow-origin'], allowedOrigin);

    // GET 帶不在白名單的 Origin → 不應 echo
    const r2 = await httpRequest({
      port: h.port, path: '/api/health', method: 'GET',
      headers: { Origin: 'https://evil.com' },
    });
    assert.strictEqual(r2.status, 200);
    assert.ok(!r2.headers['access-control-allow-origin'] || r2.headers['access-control-allow-origin'] !== 'https://evil.com');
  } finally {
    try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
  }
});

test('I2b: CORS 預設關閉（沒設 env）', async () => {
  const h = startServer(2);
  attachOutput(h);
  try {
    await waitForServer(h.port);
    const r = await httpRequest({
      port: h.port, path: '/api/health', method: 'GET',
      headers: { Origin: 'https://anywhere.example.com' },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(!r.headers['access-control-allow-origin'] || r.headers['access-control-allow-origin'] === '');
  } finally {
    try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
  }
});

test('I3: rate limiting (3 req / 60s 快速觸發 429)', async () => {
  const h = startServer(3, {
    API_RATE_LIMIT: '3',
    API_RATE_LIMIT_WINDOW_MS: '60000',
  });
  attachOutput(h);
  try {
    await waitForServer(h.port);

    const statusCodes = [];
    for (let i = 0; i < 8; i++) {
      const r = await httpRequest({ port: h.port, path: '/api/health', method: 'GET' });
      statusCodes.push(r.status);
      if (r.status === 429) break;
    }

    const has200 = statusCodes.some((s) => s === 200);
    const has429 = statusCodes.some((s) => s === 429);
    assert.ok(has200, '應有至少一個 200');
    assert.ok(has429, '應有至少一個 429');
    const first429Idx = statusCodes.findIndex((s) => s === 429);
    for (let i = first429Idx; i < statusCodes.length; i++) {
      assert.strictEqual(statusCodes[i], 429, `first429Idx=${first429Idx} 之後 index ${i} 應 429`);
    }
  } finally {
    try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
  }
});

test('I4: input validation (schema + length)', async () => {
  const h = startServer(4, {
    API_INPUT_USER_LINE_NAME_MAX: '20',
    API_INPUT_ADDRESS_MAX: '50',
  });
  attachOutput(h);
  try {
    await waitForServer(h.port);

    // 缺欄位 → 400
    const r1 = await httpRequest({
      port: h.port, path: '/api/orders', method: 'POST',
      headers: { Authorization: authHeader() },
    }, { order_data: { user_line_name: 'X' } });
    assert.strictEqual(r1.status, 400);

    // 型別錯 → 400
    const r2 = await httpRequest({
      port: h.port, path: '/api/orders', method: 'POST',
      headers: { Authorization: authHeader() },
    }, {
      order_data: Object.assign({}, VALID_ORDER.order_data, { total_amount: 'not a number' }),
    });
    assert.strictEqual(r2.status, 400);

    // 超長 user_line_name → 400
    const r3 = await httpRequest({
      port: h.port, path: '/api/orders', method: 'POST',
      headers: { Authorization: authHeader() },
    }, {
      order_data: Object.assign({}, VALID_ORDER.order_data, {
        user_line_name: '這個名字超過二十個字元的長度限制了喔喔喔喔',
      }),
    });
    assert.strictEqual(r3.status, 400);

    // 超長 address → 400
    const r4 = await httpRequest({
      port: h.port, path: '/api/orders', method: 'POST',
      headers: { Authorization: authHeader() },
    }, {
      order_data: Object.assign({}, VALID_ORDER.order_data, {
        address: '新北市三峽區' + 'abc'.repeat(30),
      }),
    });
    assert.strictEqual(r4.status, 400);

    // happy path → 201
    const r5 = await httpRequest({
      port: h.port, path: '/api/orders', method: 'POST',
      headers: { Authorization: authHeader() },
    }, VALID_ORDER);
    assert.strictEqual(r5.status, 201);
  } finally {
    try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
  }
});
