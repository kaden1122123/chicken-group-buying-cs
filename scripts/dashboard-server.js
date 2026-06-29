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
  };
  console.warn('[dashboard-server] js-yaml 未安裝，使用 src/config.js fallback parser');
}
// I5：即便 js-yaml 有 dump 也不再使用。改用字串 patch（P1-9 修整），保留原 yaml 格式。
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
 *
 * I5：使用字串 patch（不依賴 yaml.dump），避免 P1-9 - yaml.dump 會加引號、
 * 改格式（比如換行、引號、key 順序）破壞原 yaml 格式。
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

  // I5：字串 patch（取代 yaml.dump，保留原檔格式與註解）
  const original = fs.readFileSync(TENANT_YAML, 'utf-8');
  const patched = patchYamlContent(original, current);
  fs.writeFileSync(TENANT_YAML, patched, 'utf-8');
  return current;
}

// I5：字串 patch — 取代 yaml.dump，保留 yaml 原格式（縮排、引號風格、註解）

/**
 * 找 top-level `key:` 在 yaml 內容中的行範圍
 * top-level = 行首無縮排
 * @returns {{startLine, endLine}|null} 1-indexed，但傳 0-indexed 為 input
 */
function findTopLevelBlockRange(lines, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let startLine = -1;
  let endLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (startLine === -1) {
      // 找 `key:` 行首無縮排
      if (new RegExp(`^${escapedKey}:`).test(line)) {
        startLine = i;
      }
    } else {
      // 已找到起始。現在找下一個 top-level key（下一個非縮排且非空、非註解的行）
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
      const startsWithSpace = line.startsWith(' ') || line.startsWith('\t');
      if (!startsWithSpace) {
        // 下一個 top-level key（不包含我們要找的 key 自身）
        if (!new RegExp(`^${escapedKey}:`).test(line)) {
          endLine = i;
          break;
        }
      }
    }
  }
  if (startLine === -1) return null;
  if (endLine === -1) endLine = lines.length;
  return { startLine, endLine };
}

/**
 * 把 YAML 內容中 `${key}:` 開頭的 top-level block 替換為新內容
 * 用簡單的 list 格式重建（不會破壞其他區段、其他 keys、其他 top-level 註解）
 */
function replaceTopLevelBlock(content, key, newBlockLines) {
  const lines = content.split('\n');
  const range = findTopLevelBlockRange(lines, key);
  if (!range) return content;
  return [
    ...lines.slice(0, range.startLine),
    ...newBlockLines,
    ...lines.slice(range.endLine),
  ].join('\n');
}

/**
 * 把 delivery 物件序列化為完整 yaml block（替換原 delivery 區段）
 * 支援 hours / minimum_order / delivery_fee_short_fallback / areas
 */
function serializeDelivery(delivery) {
  const lines = ['delivery:'];
  if (delivery.hours && typeof delivery.hours === 'object') {
    lines.push('  hours:');
    for (const [k, v] of Object.entries(delivery.hours)) {
      lines.push(`    ${k}: "${String(v)}"`);
    }
  }
  if (delivery.minimum_order && typeof delivery.minimum_order === 'object') {
    lines.push('  minimum_order:');
    if (typeof delivery.minimum_order.chicken === 'string') {
      lines.push(`    chicken: "${delivery.minimum_order.chicken}"`);
    }
    if (typeof delivery.minimum_order.side_dish_ntd === 'number') {
      lines.push(`    side_dish_ntd: ${delivery.minimum_order.side_dish_ntd}`);
    }
  }
  if (typeof delivery.delivery_fee_short_fallback === 'number') {
    lines.push(`  delivery_fee_short_fallback: ${delivery.delivery_fee_short_fallback}`);
  }
  if (delivery.areas && typeof delivery.areas === 'object') {
    lines.push('  areas:');
    if (Array.isArray(delivery.areas.allowed)) {
      lines.push('    allowed:');
      for (const a of delivery.areas.allowed) lines.push(`      - "${a}"`);
    }
    if (Array.isArray(delivery.areas.denied)) {
      lines.push('    denied:');
      for (const a of delivery.areas.denied) lines.push(`      - "${a}"`);
    }
  }
  return lines;
}

/**
 * 把更新後的 config 套用到原 yaml 文字上（保留其他區段、其他 top-level keys、其他註解）
 */
function patchYamlContent(original, current) {
  let content = original;
  if (Array.isArray(current.open_dates)) {
    const newBlock = ['open_dates:'];
    if (current.open_dates.length === 0) {
      newBlock.push('  []');
    } else {
      for (const d of current.open_dates) newBlock.push(`  - "${d}"`);
    }
    content = replaceTopLevelBlock(content, 'open_dates', newBlock);
  }
  if (Array.isArray(current.ignored_keywords)) {
    const newBlock = ['ignored_keywords:'];
    if (current.ignored_keywords.length === 0) {
      newBlock.push('  []');
    } else {
      for (const k of current.ignored_keywords) newBlock.push(`  - "${k}"`);
    }
    content = replaceTopLevelBlock(content, 'ignored_keywords', newBlock);
  }
  if (current.delivery && typeof current.delivery === 'object') {
    const newBlock = serializeDelivery(current.delivery);
    content = replaceTopLevelBlock(content, 'delivery', newBlock);
  }
  return content;
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
