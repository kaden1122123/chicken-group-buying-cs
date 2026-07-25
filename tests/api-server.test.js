'use strict';

/**
 * API Server Integration Tests
 *
 * 測試目標：spawn api-server.js 子行程 + 用 HTTP client 測 endpoint
 */

const assert = require('assert');
const { test } = require('node:test');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3457;
const USERNAME = 'api-user';
const PASSWORD = 'chicke…9k2x';
const SERVER_PATH = path.join(__dirname, '..', 'scripts', 'api-server.js');

let _serverOutput = ''; // unused：subprocess stdout/stderr 原本要 capture 但現在未 assertion
let serverProcess;

function httpRequest(p, method, body, auth) {
  return new Promise(function (resolve, reject) {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: p,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    if (auth) {
      options.headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
    }
    const req = http.request(options, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          resolve({ status: res.statusCode, body: data, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, json: null });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await httpRequest('/api/health', 'GET');
      if (r.status === 200) return;
    } catch (e) { /* ignore health check errors */ }
    await new Promise(function (r2) { setTimeout(r2, 200); });
  }
  throw new Error('Server not ready');
}

// 全套測試（spawn server + 跑所有 endpoint 測試 + cleanup）
test('API Server integration tests', async () => {
  serverProcess = spawn('node', [SERVER_PATH], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      API_USERNAME: USERNAME,
      API_PASSWORD: PASSWORD,
      // 決策 4：MOCK_TODAY 讓測試用 delivery_date: '2026-06-18' 過驗證
      MOCK_TODAY: '2026-06-15T10:00:00+08:00',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  _serverOutput = '';
  serverProcess.stdout.on('data', function (d) { _serverOutput += d.toString(); });
  serverProcess.stderr.on('data', function (d) { _serverOutput += d.toString(); });

  try {
    await waitForServer();

    const r1 = await httpRequest('/api/health', 'GET');
    assert.strictEqual(r1.status, 200);

    const r2 = await httpRequest('/api/orders', 'POST', {});
    assert.strictEqual(r2.status, 401);

    const validOrder = {
      order_data: {
        user_line_name: '測試用戶',
        user_phone: '0912345678',
        address: '新北市三峽區',
        delivery_date: '2026-06-18',
        time_slot: '上午',
        items: [{ name: '鹽水雞', qty: 1, total: 380 }],
        subtotal: 380,
        total_amount: 380,
        payment_method: '待定',
        payment_status: 'pending',
        order_status: 'confirmed',
      },
      source: 'integration-test',
    };
    const r3 = await httpRequest('/api/orders', 'POST', validOrder, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r3.status, 201);
    assert.ok(r3.json.order_id);
    assert.strictEqual(r3.json.success, true);
    const createdOrderId = r3.json.order_id;
    const deliveryDate = validOrder.order_data.delivery_date;

    const r4 = await httpRequest('/api/orders', 'POST', {
      order_data: { user_line_name: 'X' },
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r4.status, 400);

    const r5 = await httpRequest('/api/orders', 'POST', {
      order_data: Object.assign({}, validOrder.order_data, { user_phone: '1234' }),
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r5.status, 400);

    const r6 = await httpRequest('/api/orders', 'POST', {
      order_data: Object.assign({}, validOrder.order_data, { delivery_date: '2099-12-31' }),
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r6.status, 400);

    const r7 = await httpRequest('/api/orders', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r7.status, 200);
    assert.ok(r7.json.count >= 1);

    const r8 = await httpRequest('/api/orders/' + createdOrderId, 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r8.status, 200);
    assert.strictEqual(r8.json.order.order_id, createdOrderId);

    const r9 = await httpRequest('/api/orders/INVALID-12345', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r9.status, 404);

    const r10 = await httpRequest('/api/orders/' + createdOrderId, 'PATCH', {
      payment_status: 'paid',
      payment_method: 'transfer',
      delivery_date: deliveryDate,
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r10.status, 200);

    const r11 = await httpRequest('/api/orders/INVALID-99999', 'PATCH', {
      payment_status: 'paid',
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r11.status, 404);

    const r12 = await httpRequest('/api/orders', 'GET', null, 'wrong:password');
    assert.strictEqual(r12.status, 401);

    const r13 = await httpRequest('/nonexistent', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r13.status, 404);
  } finally {
    // 確保 server process 被殺掉
    if (serverProcess) {
      try { serverProcess.kill('SIGKILL'); } catch (_) { /* ignore */ }
    }
  }
});
