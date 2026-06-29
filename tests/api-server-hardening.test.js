'use strict';

/**
 * Session I — API Server Hardening Tests
 *
 * 涵蓋 I1 (graceful shutdown)、I2 (CORS)、I3 (rate limit)、I4 (input validation)
 * 每段獨立 spawn 一個 server process，避免互相干擾。
 */

const assert = require('assert');
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
    delivery_date: '2026-06-18',
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

console.log('\n=== API Server Hardening Tests (Session I) ===');

// ─── 共用 helper ───

/**
 * 啟動 server，env 可覆寫
 */
function startServer(portOffset, extraEnv) {
  const port = PORT_BASE + portOffset;
  const env = Object.assign({}, process.env, {
    PORT: String(port),
    API_USERNAME: USERNAME,
    API_PASSWORD: PASSWORD,
    MOCK_TODAY: '2026-06-15T10:00:00+08:00',
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

// ─── 測試案例 ───

(async () => {
  // ===========================
  // I1: graceful shutdown
  // ===========================
  console.log('\n--- I1: graceful shutdown ---');
  {
    const h = startServer(0, { API_GRACEFUL_TIMEOUT_MS: '3000' });
    attachOutput(h);
    try {
      await waitForServer(h.port);
      console.log('  ✓ Server 啟動 (port=' + h.port + ')');

      // 一般 health 請求
      const r1 = await httpRequest({ port: h.port, path: '/api/health', method: 'GET' });
      assert.strictEqual(r1.status, 200);
      console.log('  ✓ shutdown 前 GET /api/health → 200');

      // 觸發 SIGTERM
      const exitCode = await killAndWait(h.process, 'SIGTERM');
      console.log('  ✓ 收到 SIGTERM');
      assert.strictEqual(exitCode, 0, 'SIGTERM 應 graceful exit (code 0)');
      assert.ok(
        h.serverOutput.includes('Received SIGTERM'),
        'log 應包含 Received SIGTERM',
      );
      assert.ok(
        h.serverOutput.includes('shutting down gracefully'),
        'log 應包含 shutting down gracefully',
      );
      console.log('  ✓ Process exit code = 0（graceful）');
    } catch (e) {
      try { h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
      throw e;
    }
  }

  // ===========================
  // I2: CORS from env（白名單）
  // ===========================
  console.log('\n--- I2: CORS white-list from env ---');
  {
    const allowedOrigin = 'https://chicken-worker.example.workers.dev';
    const h = startServer(1, { API_CORS_ORIGINS: allowedOrigin });
    attachOutput(h);
    try {
      await waitForServer(h.port);
      console.log('  ✓ Server 啟動 (allowed_origin=' + allowedOrigin + ')');

      // OPTIONS preflight 帶 Origin → 回 204 + Access-Control-Allow-Origin echo
      const pre = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'OPTIONS',
        headers: { Origin: allowedOrigin },
      });
      assert.strictEqual(pre.status, 204, 'OPTIONS preflight 應回 204');
      assert.strictEqual(pre.headers['access-control-allow-origin'], allowedOrigin);
      console.log('  ✓ OPTIONS preflight 帶白名單 Origin → 204 + echo origin');

      // GET 帶白名單 Origin → echo
      const r1 = await httpRequest({
        port: h.port,
        path: '/api/health',
        method: 'GET',
        headers: { Origin: allowedOrigin },
      });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r1.headers['access-control-allow-origin'], allowedOrigin);
      console.log('  ✓ GET 帶白名單 Origin → echo Access-Control-Allow-Origin');

      // GET 帶不在白名單的 Origin → 不應有 Access-Control-Allow-Origin
      const r2 = await httpRequest({
        port: h.port,
        path: '/api/health',
        method: 'GET',
        headers: { Origin: 'https://evil.com' },
      });
      assert.strictEqual(r2.status, 200, 'GET /api/health 仍可訪問（health 不需 auth）');
      assert.ok(
        !r2.headers['access-control-allow-origin']
        || r2.headers['access-control-allow-origin'] !== 'https://evil.com',
        '不在白名單的 Origin 不應被 echo',
      );
      console.log('  ✓ GET 帶非白名單 Origin → 不 echo');
    } catch (e) {
      try { h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
    }
  }

  // ===========================
  // I2b: CORS 沒設環境變數 → 預設關閉（不給 header）
  // ===========================
  console.log('\n--- I2b: CORS 預設關閉（沒設 API_CORS_ORIGINS）---');
  {
    const h = startServer(2);
    attachOutput(h);
    try {
      await waitForServer(h.port);

      const r = await httpRequest({
        port: h.port,
        path: '/api/health',
        method: 'GET',
        headers: { Origin: 'https://anywhere.example.com' },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(
        !r.headers['access-control-allow-origin']
        || r.headers['access-control-allow-origin'] === '',
        '沒設 env 預設不給 CORS header，避免 dev CORS 暴露上 prod',
      );
      console.log('  ✓ 沒設 API_CORS_ORIGINS → 不附 Access-Control-Allow-Origin');
    } catch (e) {
      try { h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
    }
  }

  // ===========================
  // I3: rate limiting
  // ===========================
  console.log('\n--- I3: rate limiting (3 req / 60s 快速觸發 429) ---');
  {
    const h = startServer(3, {
      API_RATE_LIMIT: '3',
      API_RATE_LIMIT_WINDOW_MS: '60000',
    });
    attachOutput(h);
    try {
      await waitForServer(h.port);
      console.log('  ✓ Server 啟動 (rate_limit=3/60s)');

      // 等過 1 個 window 讓子 bucket 重置，避免 waitForServer 的 poll 污染計數
      // 運作：rate_limit=3, window=60s，但 waitForServer 內 poll 也會進 bucket，
      // 所以這裡額外等 1 個 bucket reset 期：本 test 用 6 秒 window 才穩
      // （太短 sleep 不準）。改用一個 bucket-per-IP 的方法：發一個 dummy 請求
      // 把 window 內全部 fill，到 loop 跑時剛好 reset。

      const statusCodes = [];
      for (let i = 0; i < 8; i++) {
        const r = await httpRequest({ port: h.port, path: '/api/health', method: 'GET' });
        statusCodes.push(r.status);
        if (r.status === 429) break; // 第一個 429 之後都可以放心 rate-limit
      }
      console.log('  status code sequence:', statusCodes.join(', '));

      // 驗證：
      // 1. 前幾個請求有 200（rate limit 還沒滿）
      // 2. 最後幾個請求有 429（rate limit 觸發）
      const has200 = statusCodes.some((s) => s === 200);
      const has429 = statusCodes.some((s) => s === 429);
      assert.ok(has200, '應有至少一個 200 response');
      assert.ok(has429, '應有至少一個 429 response');
      // 後續的請求都應是 429（bucket 已滿）
      const first429Idx = statusCodes.findIndex((s) => s === 429);
      for (let i = first429Idx; i < statusCodes.length; i++) {
        assert.strictEqual(statusCodes[i], 429,
          '第一個 429 之後所有請求都應是 429，但 index ' + i + ' 是 ' + statusCodes[i]);
      }
      console.log('  ✓ Rate limit 工作：前 N 個 200，後續全部 429（first429Index=' + first429Idx + '）');
    } catch (e) {
      try { h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
    }
  }

  // ===========================
  // I4: input validation（schema + length）
  // ===========================
  console.log('\n--- I4: input validation (schema + length) ---');
  {
    const h = startServer(4, {
      API_INPUT_USER_LINE_NAME_MAX: '20',
      API_INPUT_ADDRESS_MAX: '50',
    });
    attachOutput(h);
    try {
      await waitForServer(h.port);
      console.log('  ✓ Server 啟動 (max_user_line_name=20, max_address=50)');

      // 缺欄位 → 400
      const r1 = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'POST',
        headers: { Authorization: authHeader() },
      }, { order_data: { user_line_name: 'X' } });
      assert.strictEqual(r1.status, 400);
      console.log('  ✓ 缺欄位 → 400');

      // 型別錯（total_amount 是字串）→ 400
      const r2 = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'POST',
        headers: { Authorization: authHeader() },
      }, {
        order_data: Object.assign({}, VALID_ORDER.order_data, { total_amount: 'not a number' }),
      });
      assert.strictEqual(r2.status, 400);
      console.log('  ✓ total_amount 型別錯（字串）→ 400');

      // 超長字串（user_line_name > 20）→ 400
      const r3 = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'POST',
        headers: { Authorization: authHeader() },
      }, {
        order_data: Object.assign({}, VALID_ORDER.order_data, {
          user_line_name: '這個名字超過二十個字元的長度限制了喔喔喔喔', // 21 字元 > 20
        }),
      });
      assert.strictEqual(r3.status, 400);
      console.log('  ✓ user_line_name 超長 → 400');

      // 超長 address → 400
      const r4 = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'POST',
        headers: { Authorization: authHeader() },
      }, {
        order_data: Object.assign({}, VALID_ORDER.order_data, {
          address: '新北市三峽區' + 'abc'.repeat(30),
        }),
      });
      assert.strictEqual(r4.status, 400);
      console.log('  ✓ address 超長 → 400');

      // happy path → 201
      const r5 = await httpRequest({
        port: h.port,
        path: '/api/orders',
        method: 'POST',
        headers: { Authorization: authHeader() },
      }, VALID_ORDER);
      assert.strictEqual(r5.status, 201);
      console.log('  ✓ 合法訂單 → 201');
    } catch (e) {
      try { h.process.kill('SIGKILL'); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      try { await killAndWait(h.process, 'SIGKILL'); } catch (_) { /* ignore */ }
    }
  }

  console.log('\n========================================');
  console.log('ALL HARDENING TESTS PASSED ✓');
  console.log('========================================\n');
  process.exit(0);
})().catch((e) => {
  console.error('Hardening test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
