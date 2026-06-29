'use strict';

/**
 * I5: dashboard-server 字串 patch 取代 yaml.dump
 *
 * 驗證 updateTenantConfig 寫回來的 yaml：
 * 1. 修改的 keys 換成新內容
 * 2. 其他區段、其他 top-level keys、其他註解全部保留
 * 3. 不會加 yaml.dump 風格的多餘引號 / 換行
 *
 * 技術：spawn 一個 dashboard-server，用獨立 tenant ID + fixture yaml。
 * test 結束（不論 pass / fail）都會清掉 fixture，不污染 config/tenants/。
 */

const assert = require('assert');
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
const PASSWORD = '***';

console.log('\n=== Dashboard Server YAML Patch Tests (Session I5) ===');

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
      if (r.status === 200 || r.status === 401) return; // 401 也是正常的（需要 auth）
    } catch (e) { /* not ready */ }
    await new Promise((r2) => { setTimeout(r2, 100); });
  }
  throw new Error('Server not ready');
}

function killProc(proc) {
  return new Promise((resolve) => {
    if (!proc || !proc.pid) { resolve(); return; }
    const childPid = proc.pid;
    proc.on('exit', () => { /* exit fired */ });
    // detached 模式下 proc.pid 是 process group leader，
    // kill -<pid> 等同 kill -pgid 把整個 group 一起殺
    function tryKillAll() {
      try { process.kill(-childPid, 'SIGKILL'); } catch (e) {
        try { proc.kill('SIGKILL'); } catch (_) { /* ignore */ }
      }
      // 二次確保：直接按 pid kill（group kill 可能漏 descendant）
      try { process.kill(childPid, 'SIGKILL'); } catch (e) { /* ignore */ }
    }
    tryKillAll();
    // 再二次確保（SIGKILL 後某些 descendants 可能隔 100-200ms 才反應）
    setTimeout(tryKillAll, 200).unref();
    setTimeout(resolve, 700).unref();
  });
}

(async () => {
  // 1. 寫 fixture（dashboard-server 啟動時 src/knowledge/loader.js 會檢查
  // knowledge/tenants/{tenant_id} 目錄存在，否則 throw）
  fs.mkdirSync(KB_FIXTURE_PATH, { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, FIXTURE_CONTENT, 'utf-8');
  console.log('  ✓ 寫 fixture ' + FIXTURE_TENANT_ID + '.yaml + ' + FIXTURE_TENANT_ID + '/ KB');

  let proc = null;
  let serverOutput = '';
  try {
    // 2. 啟動 server（detached 讓 spawn child 成為 process group leader，
    // 之後 kill -pgid 才能保證清乾淨）
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
    console.log('  ✓ dashboard-server 啟動 (port=' + PORT + ')');

    // 3. POST /api/config 改 open_dates
    const r1 = await httpReq({
      method: 'POST',
      path: '/api/config',
    }, { open_dates: ['2026-08-01', '2026-08-03', '2026-08-05'] });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.success, true);
    console.log('  ✓ POST /api/config 改 open_dates → 200');

    // 4. 讀回 fixture 驗證
    const contentAfter = fs.readFileSync(FIXTURE_PATH, 'utf-8');

    // 4a. 新日期進來了
    assert.ok(contentAfter.includes('"2026-08-01"'), '應包含 "2026-08-01"');
    assert.ok(contentAfter.includes('"2026-08-03"'), '應包含 "2026-08-03"');
    console.log('  ✓ 新 open_dates 三個日期都寫入');

    // 4b. 舊日期消失
    assert.ok(!contentAfter.includes('2026-07-29'), '舊日期 2026-07-29 不應殘留');
    assert.ok(!contentAfter.includes('2026-07-31'), '舊日期 2026-07-31 不應殘留');
    console.log('  ✓ 舊 open_dates 完全被取代');

    // 4c. open_dates 區段格式正確（仍是 2 空格縮排 + 引號包字串）
    assert.ok(
      /^open_dates:\n {2}- /m.test(contentAfter)
      || /^open_dates:\n {2}- /m.test(contentAfter),
      'open_dates 區段縮排應正確',
    );
    console.log('  ✓ open_dates 區段縮排格式正確');

    // 4d. 區塊間註解保留
    assert.ok(
      contentAfter.includes('# 保留這段區塊註解'),
      'open_dates 與 ignored_keywords 間的註解應保留',
    );
    console.log('  ✓ 區塊間註解完整保留');

    // 4e. ignored_keywords 沒被破壞（沒在我們 update 範圍內）
    assert.ok(contentAfter.includes('菜單'), 'ignored_keywords 不應被破壞');
    assert.ok(contentAfter.includes('FAQ'), 'ignored_keywords 不應被破壞');
    console.log('  ✓ ignored_keywords 區段完整保留');

    // 4f. delivery 沒被破壞
    assert.ok(contentAfter.includes('10:00~12:00'), 'delivery hours 不應被破壞');
    assert.ok(contentAfter.includes('半隻 NT$380 起'), 'delivery minimum_order 不應被破壞');
    assert.ok(contentAfter.includes('三鶯'), 'delivery areas 不應被破壞');
    console.log('  ✓ delivery 區段完整保留');

    // 4g. 不相干的 top-level key 保留
    assert.ok(contentAfter.includes('brand_name: test_brand'), 'brand_name 不應被破壞');
    console.log('  ✓ 不相干 top-level keys 完整保留');

    // 4h. 檔頭註解保留
    assert.ok(contentAfter.includes('# Test fixture for I5 yaml patch'), '檔頭註解應保留');
    assert.ok(contentAfter.includes('# 這個檔頭註解要完整保留'), '檔頭第二行註解應保留');
    console.log('  ✓ 檔頭註解完整保留');

    // 4i. 最後再 update delivery 子樹，驗證 delivery patch 路徑
    const r2 = await httpReq({
      method: 'POST',
      path: '/api/config',
    }, { delivery: { hours: { am: '09:00~11:00', pm: '15:00~17:00' } } });
    assert.strictEqual(r2.status, 200);
    const contentAfter2 = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    assert.ok(contentAfter2.includes('"09:00~11:00"'), 'delivery.hours.am 應被改為 09:00~11:00');
    assert.ok(!contentAfter2.includes('"10:00~12:00"'), '舊 hours am 10:00~12:00 不應殘留');
    assert.ok(contentAfter2.includes('半隻 NT$380 起'), 'delivery.minimum_order 不應被破壞');
    console.log('  ✓ delivery 子樹 patch 工作（hours 改、minimum_order 留）');

    console.log('\n========================================');
    console.log('ALL YAML PATCH TESTS PASSED ✓');
    console.log('========================================\n');
  } catch (e) {
    console.error('YAML patch test failed:', e.message);
    console.error(e.stack);
    if (typeof serverOutput !== 'undefined' && serverOutput) {
      console.error('--- server stdout/stderr ---');
      console.error(serverOutput);
      console.error('--- end server output ---');
    }
  } finally {
    if (proc) await killProc(proc);
    // 不論 pass/fail 都清 fixture
    if (fs.existsSync(FIXTURE_PATH)) {
      fs.unlinkSync(FIXTURE_PATH);
      console.log('  (cleanup: removed fixture)');
    }
    if (fs.existsSync(KB_FIXTURE_PATH)) {
      fs.rmdirSync(KB_FIXTURE_PATH, { recursive: false });
      console.log('  (cleanup: removed KB fixture)');
    }
  }
  // finally 跑完才真正 exit（確保 child 被殺、fixture 被刪）
  process.exit(0);
})();
