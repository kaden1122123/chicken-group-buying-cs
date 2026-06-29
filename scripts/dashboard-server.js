'use strict';

/**
 * 雞味研究所 LINE 客服 — 儀表板 Server
 *
 * 提供：
 * - GET  /                  → 儀表板主頁（dashboard.html）
 * - GET  /admin             → 管理員後台（admin.html）
 * - GET  /api/data          → 訂單資料（從 CSV）
 * - GET  /api/config        → 目前 config（從 yaml）
 * - POST /api/config        → 更新 config（JSON body）
 *
 * 安全性：
 * - HTTP Basic Auth（環境變數 DASHBOARD_USERNAME / DASHBOARD_PASSWORD）
 * - 不對外暴露檔案系統
 *
 * 使用方式：
 *   DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD=your_password \
 *   PORT=3000 \
 *   node scripts/dashboard-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getTenantId } = require('../src/config');
const { getOrdersByDate } = require('../src/order/csvReader');

// P1-8：js-yaml fallback。Production 環境遺漏 npm install 時不會 crash。
// 讀取優先用 js-yaml，失敗時用 src/config.js 的 _parseYamlSimple。
let yaml = null;
try {
  yaml = require('js-yaml');
} catch (e) {
  // js-yaml 不可用，用 src/config.js 的 fallback
  const config = require('../src/config');
  yaml = {
    load: (s) => config._parseYamlSimple(s),
    dump: null, // 寫入仍需 js-yaml
  };
  console.warn('[dashboard-server] js-yaml 未安裝，使用 src/config.js fallback parser（讀取模式）');
}
const _hasYamlDump = yaml && typeof yaml.dump === 'function';

// 環境變數
const PORT = parseInt(process.env.PORT || '3000', 10);
const USERNAME = process.env.DASHBOARD_USERNAME || 'admin';
const PASSWORD = process.env.DASHBOARD_PASSWORD || '';

// 路徑
const ROOT = path.join(__dirname, '..');
const DASHBOARD_HTML = path.join(ROOT, 'dashboard.html');
const ADMIN_HTML = path.join(ROOT, 'scripts', 'admin.html');
const TENANT_YAML = path.join(ROOT, 'config', 'tenants', `${getTenantId()}.yaml`);
const ORDERS_DIR = path.join(ROOT, 'data', 'orders', getTenantId());

// ========== HTTP 工具 ==========

/**
 * 解析 HTTP Basic Auth
 */
function parseAuth(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) return null;
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
  const [user, pass] = decoded.split(':');
  return { user, pass };
}

/**
 * 檢查 Basic Auth
 */
function checkAuth(req, res) {
  if (!PASSWORD) {
    // 未設定密碼 → 允許全部（不安全，但方便測試）
    return true;
  }
  const auth = parseAuth(req);
  if (auth && auth.user === USERNAME && auth.pass === PASSWORD) {
    return true;
  }
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Chicken Dashboard"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('401 Unauthorized - 請提供正確的帳號密碼');
  return false;
}

/**
 * 解析 POST body（application/json 或 application/x-www-form-urlencoded）
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      try {
        if (ct.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          const obj = {};
          body.split('&').forEach((kv) => {
            if (!kv) return;
            const [k, v] = kv.split('=');
            obj[decodeURIComponent(k)] = decodeURIComponent(v || '');
          });
          resolve(obj);
        } else {
          resolve({});
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * 回傳 JSON
 */
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * 回傳 HTML
 */
function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * 回傳 404
 */
function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

// ========== 業務邏輯 ==========

/**
 * 讀取訂單資料
 */
function readAllOrders() {
  if (!fs.existsSync(ORDERS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.csv'));
  const orders = [];
  for (const file of files) {
    const date = file.replace('.csv', '');
    const list = getOrdersByDate(date);
    for (const o of list) {
      orders.push({ ...o, _file_date: date });
    }
  }
  return orders;
}

/**
 * 計算指標
 */
function calculateMetrics(orders) {
  const total = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  const avgOrder = total > 0 ? totalRevenue / total : 0;
  const uniquePhones = new Set(orders.map((o) => o.user_phone).filter(Boolean)).size;
  const customerOrderCount = {};
  for (const o of orders) {
    if (o.user_phone) {
      customerOrderCount[o.user_phone] = (customerOrderCount[o.user_phone] || 0) + 1;
    }
  }
  const newCustomers = Object.values(customerOrderCount).filter((c) => c === 1).length;
  const returningCustomers = Object.values(customerOrderCount).filter((c) => c > 1).length;

  const byStatus = {};
  for (const o of orders) {
    const s = o.order_status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  return {
    total_orders: total,
    total_revenue: totalRevenue,
    avg_order: avgOrder,
    unique_customers: uniquePhones,
    new_customers: newCustomers,
    returning_customers: returningCustomers,
    by_status: byStatus,
  };
}

/**
 * 讀取目前 tenant config（從 yaml）
 */
function readTenantConfig() {
  if (!fs.existsSync(TENANT_YAML)) {
    return {};
  }
  const content = fs.readFileSync(TENANT_YAML, 'utf-8');
  try {
    return yaml.load(content) || {};
  } catch (e) {
    return {};
  }
}

/**
 * 更新 tenant config（支援 open_dates / ignored_keywords / delivery）
 */
function updateTenantConfig(updates) {
  const current = readTenantConfig();

  if (Array.isArray(updates.open_dates)) {
    current.open_dates = updates.open_dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  }
  if (Array.isArray(updates.ignored_keywords)) {
    current.ignored_keywords = updates.ignored_keywords
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0);
  }
  if (updates.delivery) {
    current.delivery = {
      ...current.delivery,
      ...updates.delivery,
    };
  }

  // 寫回 yaml（需 js-yaml 提供 dump）
  if (!_hasYamlDump) {
    throw new Error('js-yaml 未安裝，無法寫入 config。請跑 npm install。');
  }
  const yamlStr = yaml.dump(current, {
    lineWidth: 120,
    noRefs: true,
  });
  fs.writeFileSync(TENANT_YAML, yamlStr, 'utf-8');
  return current;
}

// ========== 路由 ==========

const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 公開路由（不需要 auth）
  if (url === '/' || url.startsWith('/?')) {
    if (!fs.existsSync(DASHBOARD_HTML)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error - dashboard.html 不存在。請先跑 `node scripts/dashboard.js` 生成。');
      return;
    }
    const html = fs.readFileSync(DASHBOARD_HTML, 'utf-8');
    sendHtml(res, 200, html);
    return;
  }

  // 需 auth 的路由
  if (!checkAuth(req, res)) return;

  // GET /api/data - 訂單資料
  if (url === '/api/data' && method === 'GET') {
    const orders = readAllOrders();
    const metrics = calculateMetrics(orders);
    sendJson(res, 200, {
      tenant: getTenantId(),
      metrics,
      recent_orders: orders.slice(-20).reverse(),
    });
    return;
  }

  // GET /api/config - 目前 config
  if (url === '/api/config' && method === 'GET') {
    const config = readTenantConfig();
    sendJson(res, 200, { tenant: getTenantId(), config });
    return;
  }

  // POST /api/config - 更新 config
  if (url === '/api/config' && method === 'POST') {
    try {
      const updates = await parseBody(req);
      const newConfig = updateTenantConfig(updates);
      sendJson(res, 200, { success: true, config: newConfig, message: 'Config 已更新' });
    } catch (e) {
      sendJson(res, 400, { success: false, error: e.message });
    }
    return;
  }

  // GET /admin - 管理員後台
  if (url === '/admin' || url.startsWith('/admin?')) {
    if (!fs.existsSync(ADMIN_HTML)) {
      sendJson(res, 404, { error: 'admin.html 尚未建立' });
      return;
    }
    const html = fs.readFileSync(ADMIN_HTML, 'utf-8');
    sendHtml(res, 200, html);
    return;
  }

  // 404
  send404(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dashboard-server] 啟動於 http://0.0.0.0:${PORT}（同網路/Cloudflare Tunnel 可訪問）`);
  console.log(`[dashboard-server] Tenant: ${getTenantId()}`);
  if (PASSWORD) {
    console.log(`[dashboard-server] HTTP Basic Auth: ${USERNAME} / ********`);
  } else {
    console.log(`[dashboard-server] ⚠️  未設定 DASHBOARD_PASSWORD — 全部可訪問（不安全）`);
  }
  console.log(`[dashboard-server] 路由：`);
  console.log(`  GET  /            → 儀表板（公開）`);
  console.log(`  GET  /admin       → 管理後台（需 auth）`);
  console.log(`  GET  /api/data    → 訂單資料（需 auth）`);
  console.log(`  GET  /api/config  → 目前 config（需 auth）`);
  console.log(`  POST /api/config  → 更新 config（需 auth）`);
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n[dashboard-server] 關閉中...');
  server.close(() => process.exit(0));
});
