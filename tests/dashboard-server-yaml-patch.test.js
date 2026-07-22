'use strict';

/**
 * I5: dashboard-server 字串 patch 取代 yaml.dump
 */

const assert = require('assert');
const { test } = require('node:test');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3470 + Math.floor(Math.random() * 100);
const FIXTURE_TENANT_ID = 'test-yaml-patch-i5';
const FIXTURE_PATH = path.join(__dirname, '..', 'config', 'tenants', `${FIXTURE_TENANT_ID}.yaml`);
const KB_FIXTURE_PATH = path.join(__dirname, '..', 'knowledge', 'tenants', FIXTURE_TENANT_ID);
const SERVER_PATH = path.join(__dirname, '..', 'scripts', 'dashboard-server.js');

const FIXTURE_CONTENT =
  '# Test fixture for I5 yaml patch\n' +
  '# 這個檔頭註解要完整保留\n' +
  '\n' +
  'open_dates:\n' +
  '  - "2026-07-29"\n' +
  '  - "2026-07-31"\n' +
  '\n' +
  '# 保留這段區塊註解 - open_dates 跟 ignored_keywords 中間\n' +
  '\n' +
  'ignored_keywords:\n' +
  '  - 菜單\n' +
  '  - FAQ\n' +
  '\n' +
  'delivery:\n' +
  '  hours:\n' +
  '    am: "10:00~12:00"\n' +
  '    pm: "16:00~18:00"\n' +
  '  minimum_order:\n' +
  '    chicken: "半隻 NT$380 起"\n' +
  '  areas:\n' +
  '    allowed:\n' +
  '      - "三鶯"\n' +
  '  delivery_fee_short_fallback: 80\n' +
  '\n' +
  '# 這個區段不該被破壞\n' +
  'brand_name: test_brand\n';

const USERNAME = 'admin';
const PASSWORD_FILE = process.env.DASHBOARD_PASSWORD_FILE || '/home/clawuser/.config/chicken/secrets/dashboard-pwd';
const PASSWORD = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = Object.assign({
      hostname: 'localhost',
      port: PORT,
      method: 'GET',
      headers: {},
    }, options);
    if (bodyStr) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
      opts.headers['Authorization'] = 'Basic ' + Buffer.from(USERNAME + ':' + PASSWORD).toString('base64');
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
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
  for (let i = 0; i < 50; i++) {
    try {
      const r = await httpReq({ path: '/', method: 'GET' });
      if (r.status === 200 || r.status === 401) return;
    } catch (e) { /* not ready */ }
    await new Promise((r2) => { setTimeout(r2, 100); });
  }
  throw new Error('Server not ready');
}

function killProc(proc) {
  return new Promise((resolve) => {
    if (!proc || !proc.pid) { resolve(); return; }
    const childPid = proc.pid;
    proc.on('exit', () => { resolve(); });
    function tryKillAll() {
      try { process.kill(-childPid, 'SIGKILL'); } catch (e) {
        try { proc.kill('SIGKILL'); } catch (_) { /* ignore */ }
      }
      try { process.kill(childPid, 'SIGKILL'); } catch (e) { /* ignore */ }
    }
    tryKillAll();
    setTimeout(tryKillAll, 200);
    setTimeout(resolve, 700);
  });
}

test('I5: dashboard-server yaml 字串 patch — 修改 keys + 保留其他區段 + 保留註解', async () => {
  fs.mkdirSync(KB_FIXTURE_PATH, { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, FIXTURE_CONTENT, 'utf-8');

  let proc = null;
  let serverOutput = '';
  try {
    proc = spawn('node', [SERVER_PATH], {
      env: Object.assign({}, process.env, {
        TENANT_ID: FIXTURE_TENANT_ID,
        DASHBOARD_USERNAME: USERNAME,
        DASHBOARD_PASSWORD: PASSWORD,
        PORT: String(PORT),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    proc.stdout.on('data', (d) => { serverOutput += d.toString(); });
    proc.stderr.on('data', (d) => { serverOutput += d.toString(); });

    await waitForServer();

    // 改 open_dates
    const r1 = await httpReq({
      method: 'POST', path: '/api/config',
    }, { open_dates: ['2026-08-01', '2026-08-03', '2026-08-05'] });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.success, true);

    const contentAfter = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    assert.ok(contentAfter.includes('"2026-08-01"'), '應包含新日期');
    assert.ok(contentAfter.includes('"2026-08-03"'), '應包含新日期');
    assert.ok(!contentAfter.includes('2026-07-29'), '舊日期應消失');
    assert.ok(!contentAfter.includes('2026-07-31'), '舊日期應消失');
    assert.ok(contentAfter.includes('# 保留這段區塊註解'), '區塊間註解應保留');
    assert.ok(contentAfter.includes('菜單'), 'ignored_keywords 不應被破壞');
    assert.ok(contentAfter.includes('FAQ'), 'ignored_keywords 不應被破壞');
    assert.ok(contentAfter.includes('10:00~12:00'), 'delivery hours 不應被破壞');
    assert.ok(contentAfter.includes('半隻 NT$380 起'), 'delivery minimum_order 不應被破壞');
    assert.ok(contentAfter.includes('三鶯'), 'delivery areas 不應被破壞');
    assert.ok(contentAfter.includes('brand_name: test_brand'), '不相干 top-level keys 應保留');
    assert.ok(contentAfter.includes('# Test fixture for I5 yaml patch'), '檔頭註解應保留');
    assert.ok(contentAfter.includes('# 這個檔頭註解要完整保留'), '檔頭第二行註解應保留');

    // delivery 子樹 patch
    const r2 = await httpReq({
      method: 'POST', path: '/api/config',
    }, { delivery: { hours: { am: '09:00~11:00', pm: '15:00~17:00' } } });
    assert.strictEqual(r2.status, 200);
    const contentAfter2 = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    assert.ok(contentAfter2.includes('"09:00~11:00"'), 'delivery.hours.am 應被改為 09:00~11:00');
    assert.ok(!contentAfter2.includes('"10:00~12:00"'), '舊 hours am 10:00~12:00 不應殘留');
    assert.ok(contentAfter2.includes('半隻 NT$380 起'), 'delivery.minimum_order 不應被破壞');
  } finally {
    if (proc) await killProc(proc);
    if (fs.existsSync(FIXTURE_PATH)) {
      fs.unlinkSync(FIXTURE_PATH);
    }
    if (fs.existsSync(KB_FIXTURE_PATH)) {
      fs.rmdirSync(KB_FIXTURE_PATH, { recursive: false });
    }
  }
});
