'use strict';
const logger = require('../src/utils/logger');

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
const { getOrdersByDate, getRecentOrders } = require('../src/order/csvReader');
const { updateOrder } = require('../src/order/csvWriter'); // P5：Hubert 手動標記付款狀態
// Round 21 (2026-07-25 09:12+) Task 4: 客戶標籤自動判斷（直接 require，避免跨 server 請求）
const { buildTagContext, determineTags, loadOrderHistory } = require('./customer-tags');

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
  logger.warn('[dashboard-server] js-yaml 未安裝，使用 src/config.js fallback parser');
}
// I5：即便 js-yaml 有 dump 也不再使用。改用字串 patch（P1-9 修整），保留原 yaml 格式。
const _hasYamlDump = yaml && typeof yaml.dump === 'function';

// 環境變數
const PORT = parseInt(process.env.PORT || '3000', 10);
const USERNAME = process.env.DASHBOARD_USERNAME || 'admin';
let PASSWORD = process.env.DASHBOARD_PASSWORD || '';
// 密碼載入優先順序（修 2026-07-15 Tailscale auth loop）：
// 1. DASHBOARD_PASSWORD_FILE env（明確指定，避免 OpenClaw exec redact）
// 2. /tmp/dash-pwd 預設 fallback（任何啟動方式都讀得到，包括 dashboard-watchdog 重啟無 env 情況）
//
// 觸發 bug：dashboard-watchdog 透過 manage-tunnel.sh start 重啟時不一定帶 env，
//          原本只支援 DASHBOARD_PASSWORD_FILE → 重啟後密碼失效 → 客戶 auth loop。
//          加 /tmp/dash-pwd fallback 讓三種啟動方式（手動 nohup / manage-tunnel.sh / watchdog）都能找到密碼。
const PASSWORD_FILE_SOURCES = [
  process.env.DASHBOARD_PASSWORD_FILE,
  '/home/clawuser/.config/chicken/secrets/dashboard-pwd', // XDG 標準位置（reboot-safe）
  '/tmp/dash-pwd', // legacy fallback
];
for (const filePath of PASSWORD_FILE_SOURCES) {
  if (!filePath) continue;
  try {
    const trimmed = require('fs').readFileSync(filePath, 'utf8').trim();
    if (trimmed) {
      PASSWORD = trimmed;
      logger.info(`[dashboard-server] Password loaded from ${filePath} (${PASSWORD.length} chars)`);
      break;
    }
  } catch (e) {
    // 檔案不存在或讀不到，繼續下一個來源
  }
}
if (!PASSWORD) {
  logger.warn('[dashboard-server] 密碼未設定：所有 auth 將失敗。建議設 DASHBOARD_PASSWORD_FILE 或寫入 /tmp/dash-pwd');
}

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
 * 讀 api-token（用於 X-API-Token header 認證）
 * Round 37.19 (Hubert 12:50)：前端 dashboard 按钮需用 X-API-Token 而非 Basic Auth
 */
let _apiTokenCache = null;
function getApiToken() {
  if (_apiTokenCache !== null) return _apiTokenCache;
  try {
    _apiTokenCache = fs.readFileSync('/home/clawuser/.config/chicken/secrets/api-token', 'utf-8').trim();
  } catch (e) {
    logger.warn('[dashboard] 讀 api-token 失敗：', e.message);
    _apiTokenCache = '';
  }
  return _apiTokenCache;
}

/**
 * 檢查認證（Basic Auth 或 X-API-Token 二選一）
 * Round 37.19：加 X-API-Token 支援（前端 dashboard 按鈕 POST /api/orders/:id/status 用）
 */

// Round 37.10 (Hubert 21:55)：預設查詢日期 = 今日，若無訂單降級最新有訂單的日期
// Round 37.21 (Hubert 14:18) lint 修整：加底線前綴允許 unused（保留給未來 /admin UI 日期選擇器使用）
function _getDefaultDate() {
  const today = new Date().toISOString().slice(0, 10);
  const tenantDir = path.join(__dirname, '..', 'data', 'orders', getTenantId());
  if (!fs.existsSync(tenantDir)) return today;
  const todayPath = path.join(tenantDir, today + '.csv');
  if (fs.existsSync(todayPath)) return today;
  // 今日無訂單 → 找最新有訂單的日期
  const files = fs.readdirSync(tenantDir)
    .filter((f) => f.endsWith('.csv'))
    .map((f) => f.replace('.csv', ''))
    .sort()
    .reverse();
  return files[0] || today;
}

function checkAuth(req, res) {
  if (!PASSWORD) {
    // 未設定密碼 → 允許全部（不安全，但方便測試）
    return true;
  }

  // ===== Round 37.19：X-API-Token header 認證（前端 dashboard 按鈕用） =====
  const apiTokenHeader = req.headers['x-api-token'];
  if (apiTokenHeader && apiTokenHeader === getApiToken()) {
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
  res.end('401 Unauthorized - 請提供正確的帳號密碼或 X-API-Token');
  return false;
}

/**
 * Session X5：ping api-server（localhost:3001）
 * 回傳 'up' 或 'down: <reason>'
 */
function pingApiServer() {
  const apiPort = process.env.API_SERVER_PORT || '3001';
  // Session X5-B（2026-07-15 修）：dashboard ping 用正確路徑（api-server 公開端點是 /api/health 不是 /healthz）
  // 順便加 Basic auth 給 api-server 用（api-server checkAuth 設為 true if API_PASSWORD 為空 → 但有密碼時需要 auth）
  const apiUser = process.env.API_USERNAME || 'api-user';
  const apiPwd = process.env.API_PASSWORD || (process.env.API_PASSWORD_FILE ? require('fs').readFileSync(process.env.API_PASSWORD_FILE, 'utf8').trim() : '');

  return new Promise((resolve) => {
    const auth = apiPwd ? Buffer.from(`${apiUser}:${apiPwd}`).toString('base64') : null;
    const req2 = http.request(
      {
        hostname: '127.0.0.1',
        port: parseInt(apiPort, 10),
        path: '/api/health',
        method: 'GET',
        timeout: 2000,
        headers: auth ? { Authorization: `Basic ${auth}` } : {},
      },
      (res2) => {
        if (res2.statusCode >= 200 && res2.statusCode < 400) {
          resolve('up');
        } else {
          resolve(`down: status ${res2.statusCode}`);
        }
        res2.resume();
      },
    );
    req2.on('error', (e) => resolve(`down: ${e.code || e.message}`));
    req2.on('timeout', () => {
      req2.destroy();
      resolve('down: timeout');
    });
    req2.end();
  });
}

/**
 * Session X5：ping Cloudflare Worker
 * GET https://external-user-line-security.kaden1122123.workers.dev/webhook
 * 失敗不報錯，只回應 down: reason
 */
function pingWorker() {
  return new Promise((resolve) => {
    const workerUrl = process.env.WORKER_HEALTH_URL
      || 'https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats';
    const lib = workerUrl.startsWith('https') ? require('https') : require('http');
    const req2 = lib.request(
      workerUrl,
      { method: 'GET', timeout: 3000 },
      (res2) => {
        if (res2.statusCode >= 200 && res2.statusCode < 400) {
          resolve('up');
        } else {
          resolve(`down: status ${res2.statusCode}`);
        }
        res2.resume();
      },
    );
    req2.on('error', (e) => resolve(`down: ${e.code || e.message}`));
    req2.on('timeout', () => {
      req2.destroy();
      resolve('down: timeout');
    });
    req2.end();
  });
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
 *
 * 保留舊區段的 separator（在 list items 後、下個 top-level key 前的空行 / 註解），
 * 避免刪除原檔的裝飾註解。
 */
function replaceTopLevelBlock(content, key, newBlockLines) {
  const lines = content.split('\n');
  const range = findTopLevelBlockRange(lines, key);
  if (!range) return content;
  // 找舊區段的「內容結束行」— list/內容的最後一行（不含空行/註解 separator）
  let contentEnd = range.startLine + 1;
  for (let i = range.startLine + 1; i < range.endLine; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      // separator 開始（空行 / 註解）
      break;
    }
    contentEnd = i + 1;
  }
  // 把 [contentEnd, endLine) 之間的 separator 內容保留下來
  return [
    ...lines.slice(0, range.startLine),
    ...newBlockLines,
    ...lines.slice(contentEnd, range.endLine), // separator（空行 + 裝飾註解）
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

    // ===== Round 37.19 (Hubert 12:50) 注入 API Token 到 HTML =====
    // 讓前端 window.__API_TOKEN__ 有值，按鈕 POST /api/orders/:id/status 能帶上 X-API-Token
    // 從 /home/clawuser/.config/chicken/secrets/api-token 讀取
    let apiToken = '';
    try {
      apiToken = fs.readFileSync('/home/clawuser/.config/chicken/secrets/api-token', 'utf-8').trim();
    } catch (e) {
      logger.error('[dashboard] 讀 api-token 失敗:', e.message);
    }
    const injectedHtml = html.replace(
      '</head>',
      '<script>window.__API_TOKEN__ = ' + JSON.stringify(apiToken) + ';</script></head>',
    );
    sendHtml(res, 200, injectedHtml);
    return;
  }

  // GET /healthz - Session X5：統一健康檢查端點（**公開**，不需 auth）
  // 用於 watchdog / Dashboard 連線檢查 / 外部監控
  if (url === '/healthz' && method === 'GET') {
    const apiServerStatus = await pingApiServer();
    const workerStatus = await pingWorker();
    const services = {
      dashboard: 'up', // 這個請求能走動表示 dashboard 自己 up
      api_server: apiServerStatus,
      worker: workerStatus,
    };
    const allUp = Object.values(services).every((s) => s === 'up');
    sendJson(res, allUp ? 200 : 503, {
      status: allUp ? 'ok' : 'degraded',
      services,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
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

  // GET /api/recent-orders - Session X3-A：最近 N 筆訂單（limit 預設 20）
  if (url.startsWith('/api/recent-orders') && method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10);
    const safeLimit = Math.min(Math.max(limit, 1), 100); // 限 1-100
    const recent = getRecentOrders(safeLimit);
    sendJson(res, 200, { tenant: getTenantId(), count: recent.length, orders: recent });
    return;
  }

  // Round 21 (2026-07-25) Task 4: GET /api/customer-tags/:userId
  // 客戶標籤自動判斷（直接 require customer-tags.js，不需跨 server 請求）
  const tagMatch = url.match(/^\/api\/customer-tags\/([^/]+)$/);
  if (tagMatch && method === 'GET') {
    const userLineId = decodeURIComponent(tagMatch[1]);
    try {
      const orderHistory = loadOrderHistory(userLineId);
      const currentOrder = orderHistory[orderHistory.length - 1] || null;
      const ctx = buildTagContext(userLineId, orderHistory, currentOrder);
      const tags = determineTags(ctx);
      const byCategory = {};
      tags.forEach((t) => {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t.tag);
      });
      sendJson(res, 200, {
        success: true,
        userLineId,
        orderCount: orderHistory.length,
        currentOrder: currentOrder
          ? {
            order_id: currentOrder.order_id,
            total_amount: currentOrder.total_amount,
            payment_status: currentOrder.payment_status,
          }
          : null,
        tags,
        tagCount: tags.length,
        byCategory,
      });
    } catch (e) {
      logger.error('[/api/customer-tags] error:', e);
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // GET /api/logs - Session X3-B：結構化日誌查詢（?date=YYYY-MM-DD&level=warn|error|all）
  if (url.startsWith('/api/logs') && method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const date = urlObj.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const level = urlObj.searchParams.get('level') || 'all';
    const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
    const safeLimit = Math.min(Math.max(limit, 1), 500);

    const logFilePath = path.join(process.env.LOG_DIR || path.join(__dirname, '..', 'logs'), `${date}.log`);
    const logs = [];
    if (fs.existsSync(logFilePath)) {
      const lines = fs.readFileSync(logFilePath, 'utf8').split('\n').filter((l) => l);
      for (const line of lines.slice(-safeLimit).reverse()) {
        try {
          const entry = JSON.parse(line);
          if (level === 'all' || entry.level === level) {
            logs.push(entry);
          }
        } catch (e) {
          // 容忍單行壞檔
        }
      }
    }

    sendJson(res, 200, {
      date,
      level,
      count: logs.length,
      logs,
      logFile: logFilePath,
    });
    return;
  }

  // GET /api/log-stats - Session X3-C：错误率計算（最近 N 天）
  if (url.startsWith('/api/log-stats') && method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const days = parseInt(urlObj.searchParams.get('days') || '7', 10);
    const safeDays = Math.min(Math.max(days, 1), 30);
    const logDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

    const stats = [];
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const logPath = path.join(logDir, `${d}.log`);
      let warn = 0, error = 0;
      if (fs.existsSync(logPath)) {
        fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l).forEach((line) => {
          try {
            const entry = JSON.parse(line);
            if (entry.level === 'warn') warn++;
            else if (entry.level === 'error') error++;
          } catch (e) {}
        });
      }
      stats.push({ date: d, warn, error });
    }

    sendJson(res, 200, { days: safeDays, stats: stats.reverse() });
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


  // Round 37.10 (Hubert 21:55)：POST /api/orders/:orderId/status — 變更訂單狀態
  const statusMatch = url.match(/^\/api\/orders\/([^\/]+)\/status$/);
  if (statusMatch && method === 'POST') {
    try {
      const orderId = decodeURIComponent(statusMatch[1]);
      const body = await parseBody(req);
      const validStatuses = ['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED'];
      if (!validStatuses.includes(body.status)) {
        sendJson(res, 400, { success: false, error: 'status 必須是 ' + validStatuses.join('/') });
        return;
      }
      const csvPath = path.join(__dirname, '..', 'data', 'orders', 'chicken', body.date + '.csv');
      if (!fs.existsSync(csvPath)) {
        sendJson(res, 404, { success: false, error: '該日期無訂單 CSV: ' + body.date });
        return;
      }
      const csv = fs.readFileSync(csvPath, 'utf8');
      const lines = csv.split('\n');
      const header = lines[0].split(',');
      const idIdx = header.indexOf('order_id');
      const statusIdx = header.indexOf('order_status');
      let updated = false;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols[idIdx] === orderId) {
          cols[statusIdx] = body.status;
          lines[i] = cols.join(',');
          updated = true;
          break;
        }
      }
      if (updated) {
        fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
        sendJson(res, 200, { success: true, message: '訂單狀態已更新', order_id: orderId, status: body.status });
      } else {
        sendJson(res, 404, { success: false, error: '找不到訂單: ' + orderId });
      }
    } catch (e) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // Round 37.10 (Hubert 21:55)：GET /api/config/open-dates — 讀取 chicken.yaml 當前開團日期
  if (url === '/api/config/open-dates' && method === 'GET') {
    try {
      const config = readTenantConfig();
      const openDates = (config.storage && config.storage.open_dates) || [];
      const today = new Date().toISOString().slice(0, 10);
      sendJson(res, 200, {
        tenant: getTenantId(),
        today,
        open_dates: openDates,
        count: openDates.length,
        next_open_date: openDates.find((d) => d >= today) || null,
      });
    } catch (e) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // P5：POST /api/orders/:orderId/mark-paid — Hubert 手動標記訂單為「已收款」
  const markPaidMatch = url.match(/^\/api\/orders\/([^/]+)\/mark-paid$/);
  if (markPaidMatch && method === 'POST') {
    const orderId = decodeURIComponent(markPaidMatch[1]);
    try {
      // 跨檔案查找訂單所在日期檔案 — csvWriter.updateOrder 用 delivery_date 定位 CSV 檔
      // 如果沒傳 delivery_date，預設用 today，會找不到舊訂單 → 需預先 lookup 訂單所屬檔案日期
      const allOrders = readAllOrders();
      const order = allOrders.find((o) => o.order_id === orderId);
      if (!order) {
        sendJson(res, 404, { success: false, error: '找不到訂單', order_id: orderId });
        return;
      }
      const updates = { payment_status: 'confirmed' };
      if (order._file_date) updates.delivery_date = order._file_date;
      const success = updateOrder(orderId, updates);
      if (success) {
        sendJson(res, 200, { success: true, message: '訂單已標記為已收款', order_id: orderId, file_date: order._file_date });
      } else {
        sendJson(res, 500, { success: false, error: '更新 CSV 失敗', order_id: orderId });
      }
    } catch (e) {
      sendJson(res, 500, { success: false, error: `標記失敗: ${e.message}` });
    }
    return;
  }

  // P0 #2: POST /api/orders/:orderId/clear-handoff — 解除 HUMAN_HANDOFF state
  // 流程:從 handoffOrderIndex 找 userId → clearState(userId) → 更新 CSV order_status 為 confirmed (Hubert 已手動處理)
  const clearHandoffMatch = url.match(/^\/api\/orders\/([^/]+)\/clear-handoff$/);
  if (clearHandoffMatch && method === 'POST') {
    const orderId = decodeURIComponent(clearHandoffMatch[1]);
    try {
      const { getUserIdByHandoffOrder, clearState, clearHandoffOrderIndex } = require('../src/states/stateMachine');
      const allOrders = readAllOrders();
      const order = allOrders.find((o) => o.order_id === orderId);
      if (!order) {
        sendJson(res, 404, { success: false, error: '找不到訂單', order_id: orderId });
        return;
      }
      // 從 reverse index 找 userId,清掉該 user 的 state machine state
      const userId = getUserIdByHandoffOrder(orderId);
      if (userId) {
        clearState(userId);
        clearHandoffOrderIndex(orderId);
      }
      // 更新 CSV:order_status 從 pending_handoff 變 confirmed,加 staff_notes 紀錄
      const updates = {
        order_status: 'confirmed',
        delivery_date: order._file_date,
      };
      updates.staff_notes = (order.staff_notes || '') + '; [Hubert 解除轉真人]';
      const success = updateOrder(orderId, updates);
      if (success) {
        sendJson(res, 200, {
          success: true,
          message: '已解除轉真人,Hubert 已處理完成',
          order_id: orderId,
          userId: userId || null,
        });
      } else {
        sendJson(res, 500, { success: false, error: '更新 CSV 失敗', order_id: orderId });
      }
    } catch (e) {
      sendJson(res, 500, { success: false, error: `解除轉真人失敗: ${e.message}` });
    }
    return;
  }

  // P2：POST /api/orders/:orderId/approve — Hubert 手動核准訂單（從 pending_handoff → confirmed）
  const approveMatch = url.match(/^\/api\/orders\/([^/]+)\/approve$/);
  if (approveMatch && method === 'POST') {
    const orderId = decodeURIComponent(approveMatch[1]);
    try {
      // 同 P5：跨檔案查找訂單所屬檔案日期，才能定位 CSV 檔
      const allOrders = readAllOrders();
      const order = allOrders.find((o) => o.order_id === orderId);
      if (!order) {
        sendJson(res, 404, { success: false, error: '找不到訂單', order_id: orderId });
        return;
      }
      const updates = { order_status: 'confirmed' };
      if (order._file_date) updates.delivery_date = order._file_date;
      const success = updateOrder(orderId, updates);
      if (success) {
        sendJson(res, 200, { success: true, message: '訂單已核准', order_id: orderId, file_date: order._file_date, new_status: 'confirmed' });
      } else {
        sendJson(res, 500, { success: false, error: '更新 CSV 失敗', order_id: orderId });
      }
    } catch (e) {
      sendJson(res, 500, { success: false, error: `核准失敗: ${e.message}` });
    }
    return;
  }

  // GET /admin - 管理員後台

  // GET /log-panel - Session X3-C：Log Panel + 錯誤率儀表板
  if (url === '/log-panel' || url.startsWith('/log-panel?')) {
    const panelPath = path.join(__dirname, 'log-panel.html');
    if (fs.existsSync(panelPath)) {
      const content = fs.readFileSync(panelPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } else {
      send404(res);
    }
    return;
  }

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
  logger.info(`[dashboard-server] 啟動於 http://0.0.0.0:${PORT}（同網路/Cloudflare Tunnel 可訪問）`);
  logger.info(`[dashboard-server] Tenant: ${getTenantId()}`);
  if (PASSWORD) {
    logger.info(`[dashboard-server] HTTP Basic Auth: ${USERNAME} / ********`);
  } else {
    logger.info(`[dashboard-server] ⚠️  未設定 DASHBOARD_PASSWORD — 全部可訪問（不安全）`);
  }
  logger.info(`[dashboard-server] 路由：`);
  logger.info(`  GET  /            → 儀表板（公開）`);
  logger.info(`  GET  /admin       → 管理後台（需 auth）`);
  logger.info(`  GET  /api/data    → 訂單資料（需 auth）`);
  logger.info(`  GET  /api/config  → 目前 config（需 auth）`);
  logger.info(`  POST /api/config  → 更新 config（需 auth）`);
});

// 優雅關閉
process.on('SIGINT', () => {
  logger.info('\n[dashboard-server] 關閉中...');
  server.close(() => process.exit(0));
});
