'use strict';

const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3457;
const USERNAME = 'api-user';
const PASSWORD = 'chicken-test-pwd-9k2x';
const SERVER_PATH = path.join(__dirname, '..', 'scripts', 'api-server.js');

console.log('\n=== API Server Integration Tests ===');

const serverProcess = spawn('node', [SERVER_PATH], {
  env: Object.assign({}, process.env, {
    PORT: String(PORT),
    API_USERNAME: USERNAME,
    API_PASSWORD: PASSWORD,
    // 決策 4：MOCK_TODAY 讓測試用 delivery_date: '2026-06-18' 過驗證
    // （原本 6/14 寫的測試，用當下時間是 6/14，所以 6/18 還算明天 + 上午）
    MOCK_TODAY: '2026-06-15T10:00:00+08:00',
  }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
serverProcess.stdout.on('data', function(d) { serverOutput += d.toString(); });
serverProcess.stderr.on('data', function(d) { serverOutput += d.toString(); });

function httpRequest(p, method, body, auth) {
  return new Promise(function(resolve, reject) {
    var bodyStr = body ? JSON.stringify(body) : '';
    var options = {
      hostname: 'localhost',
      port: PORT,
      path: p,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    if (auth) {
      options.headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
    }
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
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
  for (var i = 0; i < 30; i++) {
    try {
      var r = await httpRequest('/api/health', 'GET');
      if (r.status === 200) return;
    } catch (e) {}
    await new Promise(function(r2) { setTimeout(r2, 200); });
  }
  throw new Error('Server not ready');
}

(async () => {
  try {
    await waitForServer();
    console.log('  ✓ Server 啟動');

    var r1 = await httpRequest('/api/health', 'GET');
    assert.strictEqual(r1.status, 200);
    console.log('  ✓ GET /api/health 公開 → 200');

    var r2 = await httpRequest('/api/orders', 'POST', {});
    assert.strictEqual(r2.status, 401);
    console.log('  ✓ POST /api/orders 未認證 → 401');

    var validOrder = {
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
    var r3 = await httpRequest('/api/orders', 'POST', validOrder, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r3.status, 201);
    assert.ok(r3.json.order_id);
    assert.strictEqual(r3.json.success, true);
    console.log('  ✓ POST /api/orders 合法 → 201 order_id=' + r3.json.order_id);
    var createdOrderId = r3.json.order_id;
    var deliveryDate = validOrder.order_data.delivery_date;  // 記住建立時的日期

    var r4 = await httpRequest('/api/orders', 'POST', {
      order_data: { user_line_name: 'X' },
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r4.status, 400);
    console.log('  ✓ POST /api/orders 缺欄位 → 400');

    var r5 = await httpRequest('/api/orders', 'POST', {
      order_data: Object.assign({}, validOrder.order_data, { user_phone: '1234' }),
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r5.status, 400);
    console.log('  ✓ POST /api/orders 不合法電話 → 400');

    var r6 = await httpRequest('/api/orders', 'POST', {
      order_data: Object.assign({}, validOrder.order_data, { delivery_date: '2099-12-31' }),
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r6.status, 400);
    console.log('  ✓ POST /api/orders 不合法日期 → 400');

    var r7 = await httpRequest('/api/orders', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r7.status, 200);
    assert.ok(r7.json.count >= 1);
    console.log('  ✓ GET /api/orders → 200 (count=' + r7.json.count + ')');

    var r8 = await httpRequest('/api/orders/' + createdOrderId, 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r8.status, 200);
    assert.strictEqual(r8.json.order.order_id, createdOrderId);
    console.log('  ✓ GET /api/orders/:id 查單筆 → 200');

    var r9 = await httpRequest('/api/orders/INVALID-12345', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r9.status, 404);
    console.log('  ✓ GET /api/orders/:id 不存在 → 404');

    // 修：傳 delivery_date 確保找對檔案
    var r10 = await httpRequest('/api/orders/' + createdOrderId, 'PATCH', {
      payment_status: 'paid',
      payment_method: 'transfer',
      delivery_date: deliveryDate,
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r10.status, 200);
    console.log('  ✓ PATCH /api/orders/:id 更新 → 200');

    var r11 = await httpRequest('/api/orders/INVALID-99999', 'PATCH', {
      payment_status: 'paid',
    }, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r11.status, 404);
    console.log('  ✓ PATCH /api/orders/:id 不存在 → 404');

    var r12 = await httpRequest('/api/orders', 'GET', null, 'wrong:password');
    assert.strictEqual(r12.status, 401);
    console.log('  ✓ 錯誤密碼 → 401');

    var r13 = await httpRequest('/nonexistent', 'GET', null, USERNAME + ':' + PASSWORD);
    assert.strictEqual(r13.status, 404);
    console.log('  ✓ 不存在端點 → 404');

    console.log('\n========================================');
    console.log('ALL API SERVER TESTS PASSED ✓');
    console.log('========================================\n');
  } catch (e) {
    console.error('Test failed:', e.message);
    console.error('Server output:', serverOutput);
    // 確保 server process 被殺掉
    try { serverProcess.kill('SIGKILL'); } catch (e2) {}
    process.exit(1);
  } finally {
    // 確保 server process 被殺掉
    try { serverProcess.kill('SIGKILL'); } catch (e2) {}
    setTimeout(function() { process.exit(0); }, 100);
  }
})();
