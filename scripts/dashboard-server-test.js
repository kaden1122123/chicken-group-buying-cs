'use strict';
const logger = require('../src/utils/logger');

/**
 * Dashboard Server 整合測試
 * 啟動 server，發送 HTTP 請求，驗證回應
 */

const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3456;
const USERNAME = 'admin';
const PASSWORD = 'test123';

logger.info('\n=== Dashboard Server Integration Tests ===');

// 啟動 server
const serverProcess = spawn('node', [path.join(__dirname, 'dashboard-server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DASHBOARD_USERNAME: USERNAME,
    DASHBOARD_PASSWORD: PASSWORD,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
serverProcess.stdout.on('data', (d) => { serverOutput += d.toString(); });
serverProcess.stderr.on('data', (d) => { serverOutput += d.toString(); });

function httpRequest(path, method, body, auth) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (auth) {
      options.headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port: PORT, path: '/', method: 'GET' }, (_res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(500, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
      });
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('Server not ready');
}

(async () => {
  try {
    await waitForServer();
    logger.info('  ✓ Server 啟動');

    // 1. GET / 公開
    const r1 = await httpRequest('/', 'GET');
    assert.ok([200, 500].includes(r1.status), `GET / status: ${r1.status}`);
    logger.info('  ✓ GET / 公開（不需要 auth）');

    // 2. GET /api/data 需 auth
    const r2 = await httpRequest('/api/data', 'GET');
    assert.strictEqual(r2.status, 401, '未認證應該 401');
    logger.info('  ✓ GET /api/data 未認證 → 401');

    // 3. GET /api/data 認證後
    const r3 = await httpRequest('/api/data', 'GET', null, `${USERNAME}:${PASSWORD}`);
    assert.strictEqual(r3.status, 200, `認證後 status: ${r3.status}`);
    const data3 = JSON.parse(r3.body);
    assert.ok(data3.metrics, '應包含 metrics');
    assert.ok(typeof data3.metrics.total_orders === 'number', 'total_orders 應為數字');
    logger.info('  ✓ GET /api/data 認證後 → 200 with metrics');

    // 4. GET /api/config 認證後
    const r4 = await httpRequest('/api/config', 'GET', null, `${USERNAME}:${PASSWORD}`);
    assert.strictEqual(r4.status, 200, `GET /api/config status: ${r4.status}`);
    const data4 = JSON.parse(r4.body);
    assert.ok(data4.config, '應包含 config');
    logger.info('  ✓ GET /api/config 認證後 → 200 with config');

    // 5. POST /api/config 更新開團日期
    const newDates = ['2026-07-01', '2026-07-03', '2026-07-06'];
    const r5 = await httpRequest('/api/config', 'POST', { open_dates: newDates }, `${USERNAME}:${PASSWORD}`);
    assert.strictEqual(r5.status, 200, `POST status: ${r5.status}`);
    const data5 = JSON.parse(r5.body);
    assert.strictEqual(data5.success, true, 'success 應為 true');
    assert.deepStrictEqual(data5.config.open_dates, newDates, '新日期應一致');
    logger.info('  ✓ POST /api/config 更新開團日期 → 200');

    // 6. 驗證 GET 回來確實是新日期
    const r6 = await httpRequest('/api/config', 'GET', null, `${USERNAME}:${PASSWORD}`);
    const data6 = JSON.parse(r6.body);
    assert.deepStrictEqual(data6.config.open_dates, newDates, 'GET 回來應是新日期');
    logger.info('  ✓ GET /api/config 回來是新日期');

    // 7. 復原
    const r7 = await httpRequest('/api/config', 'POST', {
      open_dates: ['2026-06-16', '2026-06-18', '2026-06-23', '2026-06-26'],
    }, `${USERNAME}:${PASSWORD}`);
    assert.strictEqual(r7.status, 200, '復原應該 200');
    logger.info('  ✓ 復原 open_dates 成功');

    // 8. POST /api/config 錯誤密碼
    const r8 = await httpRequest('/api/config', 'GET', null, 'admin:wrong');
    assert.strictEqual(r8.status, 401, '錯誤密碼 → 401');
    logger.info('  ✓ 錯誤密碼 → 401');

    logger.info('\n========================================');
    logger.info('ALL DASHBOARD SERVER TESTS PASSED ✓');
    logger.info('========================================\n');
  } catch (e) {
    logger.error('Test failed:', e.message);
    logger.error('Server output:', serverOutput);
    process.exit(1);
  } finally {
    serverProcess.kill();
    setTimeout(() => process.exit(0), 100);
  }
})();
