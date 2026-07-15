'use strict';
const logger = require('../src/utils/logger');

/**
 * 雞味研究所 LINE 客服 — API Server
 *
 * 提供 HTTP API 給 Cloudflare Worker 呼叫（取代 order-listener 監聽）：
 * - POST /api/orders          — 建立訂單（從 LINE postback 來）
 * - PATCH /api/orders/:id     — 更新訂單（付款狀態等）
 * - GET  /api/orders          — 查詢訂單（給 dashboard 用）
 * - GET  /api/orders/:id      — 查單筆訂單
 * - GET  /api/health          — 健康檢查
 *
 * 安全：HTTP Basic Auth
 *
 * 使用方式：
 *   API_USERNAME=api-user API_PASSWORD=*** PORT=3001 \
 *     node scripts/api-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getTenantId } = require('../src/config');
const { writeOrderWithRetry, updateOrder } = require('../src/order/csvWriter');
const { getOrdersByDate } = require('../src/order/csvReader');

// 決策 4：MOCK_TODAY 環境變數支援，讓測試可以控制「今天」是哪一天
// 用途：api-server.test.js 用 delivery_date: '2026-06-18'，但今天是 2026-06-26
// 過期，設 MOCK_TODAY=2026-06-15T10:00:00+08:00 可讓 validateDate 認為是配送前一日 10 點
// 重要：production 環境絕對不要設 MOCK_TODAY
if (process.env.MOCK_TODAY) {
  const RealDate = Date;
  const mockNow = new RealDate(process.env.MOCK_TODAY).getTime();
  const MockDate = function (...args) {
    if (args.length === 0) return new RealDate(mockNow);
    return new RealDate(...args);
  };
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  MockDate.now = () => mockNow;
  MockDate.prototype = RealDate.prototype;
  global.Date = MockDate;
  logger.info('[api-server] MOCK_TODAY=' + process.env.MOCK_TODAY + ' (測試模式)');
}
const { validateDate } = require('../src/rules/dateRule');
const { validateTimeSlotWithDate } = require('../src/rules/timeSlotRule');
const { validateMenu } = require('../src/rules/menuRule');
const { validatePhone, validateAddress } = require('../src/rules');

// 環境變數
const PORT = parseInt(process.env.PORT || '3001', 10);
const API_USERNAME = process.env.API_USERNAME || 'api-user';
let API_PASSWORD = process.env.API_PASSWORD || '';
// 支援 API_PASSWORD_FILE：避免密碼出現在 process.env 或命令列
// 觸發場景：OpenClaw exec 會自動 redact process.env 密碼字面值
// 與 dashboard-server.js 同步 Pattern (2026-07-15)
if (process.env.API_PASSWORD_FILE) {
  try {
    const trimmed = require('fs').readFileSync(process.env.API_PASSWORD_FILE, 'utf8').trim();
    if (trimmed) {
      API_PASSWORD = trimmed;
      logger.info(`[api-server] Password loaded from ${process.env.API_PASSWORD_FILE} (${API_PASSWORD.length} chars)`);
    }
  } catch (e) {
    // 檔案不存在就繼續 fallback
  }
}
// I1：graceful shutdown timeout（毫秒）。超過則強制退出，避免永遠卡住。
const API_GRACEFUL_TIMEOUT_MS = parseInt(process.env.API_GRACEFUL_TIMEOUT_MS || '10000', 10);
// I2：CORS 白名單（逗號分隔 origin，例如 'https://worker.example.workers.dev,https://admin.example.com'）
// 預設空字串 → 不附 Access-Control-Allow-Origin（避免 dev `*` 上 prod）
const API_CORS_ORIGINS = (process.env.API_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// I3：IP-based token bucket rate limit
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '60', 10);
const API_RATE_LIMIT_WINDOW_MS = parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '60000', 10);
// I4：input validation length 上限（程式常數 + env 可改）
const INPUT_USER_LINE_NAME_MAX = parseInt(process.env.API_INPUT_USER_LINE_NAME_MAX || '100', 10);
const INPUT_ADDRESS_MAX = parseInt(process.env.API_INPUT_ADDRESS_MAX || '500', 10);
const INPUT_COMMUNITY_MAX = parseInt(process.env.API_INPUT_COMMUNITY_MAX || '200', 10);
const INPUT_TIME_SLOT_MAX = parseInt(process.env.API_INPUT_TIME_SLOT_MAX || '50', 10);
const INPUT_PAYMENT_METHOD_MAX = parseInt(process.env.API_INPUT_PAYMENT_METHOD_MAX || '50', 10);
const INPUT_PAYMENT_STATUS_MAX = parseInt(process.env.API_INPUT_PAYMENT_STATUS_MAX || '50', 10);
const INPUT_ORDER_STATUS_MAX = parseInt(process.env.API_INPUT_ORDER_STATUS_MAX || '50', 10);
const INPUT_CUSTOMER_NOTES_MAX = parseInt(process.env.API_INPUT_CUSTOMER_NOTES_MAX || '1000', 10);
const INPUT_STAFF_NOTES_MAX = parseInt(process.env.API_INPUT_STAFF_NOTES_MAX || '1000', 10);
const INPUT_DELIVERY_DATE_MAX = 20; // YYYY-MM-DD
const INPUT_USER_PHONE_MAX = 30;
const INPUT_ITEM_NAME_MAX = 100;
const INPUT_ITEMS_MAX = 100;
// 每個 IP 一個 bucket，{ count, resetAt } (記憶體 in-memory，不持久化)
// 重啟 server 會清空（可接受，客戶端正確 retry 即可）
const rateLimitBuckets = new Map();

// 定期清理過期 bucket（避免記憶體成長無上限）
// 每 10 分鐘清一次超過 window 的桶
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(ip);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`[api-server] Rate limit cleanup: removed ${cleaned} expired buckets (size now ${rateLimitBuckets.size})`);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
rateLimitCleanupTimer.unref();

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + API_RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(ip, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= API_RATE_LIMIT,
    remaining: Math.max(0, API_RATE_LIMIT - bucket.count),
    resetSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

// 路徑
const ROOT = path.join(__dirname, '..');
const TENANT = getTenantId();
const ORDERS_DIR = path.join(ROOT, 'data', 'orders', TENANT);
// Session L2：openapi.yaml 檔案路徑（serve Swagger UI 用）
const OPENAPI_FILE = path.join(ROOT, 'openapi.yaml');

// ========== HTTP 工具 ==========

function parseAuth(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) return null;
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
  const [user, pass] = decoded.split(':');
  return { user, pass };
}

function checkAuth(req, res) {
  if (!API_PASSWORD) {
    return true; // 沒設密碼 → 全部允許（不安全，測試用）
  }
  const auth = parseAuth(req);
  if (auth && auth.user === API_USERNAME && auth.pass === API_PASSWORD) {
    return true;
  }
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Chicken API"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('401 Unauthorized');
  return false;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const ct = req.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
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

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function send404(res) {
  sendJson(res, 404, { success: false, error: '404 Not Found' });
}

// ========== 業務邏輯 ==========

/**
 * I4：input schema 驗證（型別 + 長度）
 * 在 validateOrderData 之前跑，先擋掉明顯錯誤（防禦性）
 * @param {object} data - order_data
 * @returns {{valid: boolean, errorMessage?: string}}
 */
function validateInputSchema(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errorMessage: 'order_data 必須是物件' };
  }

  // string 欄位：型別 + 長度
  const stringFields = [
    ['user_line_name', INPUT_USER_LINE_NAME_MAX, true], // required
    ['user_phone', INPUT_USER_PHONE_MAX, true], // required
    ['address', INPUT_ADDRESS_MAX, true], // required
    ['community', INPUT_COMMUNITY_MAX, false], // optional
    ['delivery_date', INPUT_DELIVERY_DATE_MAX, true], // required
    ['time_slot', INPUT_TIME_SLOT_MAX, true], // required
    ['payment_method', INPUT_PAYMENT_METHOD_MAX, false], // optional
    ['payment_status', INPUT_PAYMENT_STATUS_MAX, false], // optional
    ['order_status', INPUT_ORDER_STATUS_MAX, false], // optional
    ['staff_notes', INPUT_STAFF_NOTES_MAX, false], // optional
    ['customer_notes', INPUT_CUSTOMER_NOTES_MAX, false], // optional
  ];
  for (const [key, maxLen] of stringFields) {
    // 跳過：未提供 / null → 由 validateOrderData 的「缺少必填欄位」檢查統一處理
    if (data[key] == null) continue;
    if (typeof data[key] !== 'string') {
      return { valid: false, errorMessage: `${key} 必須是字串（收到 ${typeof data[key]}）` };
    }
    if (data[key].length > maxLen) {
      return {
        valid: false,
        errorMessage: `${key} 長度超過上限 ${maxLen}（目前 ${data[key].length}）`,
      };
    }
  }

  // number 欄位：型別 + 有限數
  const numberFields = ['subtotal', 'delivery_fee', 'total_amount'];
  for (const key of numberFields) {
    if (data[key] == null) continue;
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) {
      return {
        valid: false,
        errorMessage: `${key} 必須是有限數字（收到 ${typeof data[key]}）`,
      };
    }
  }
  // total_amount 必須 > 0
  if (data.total_amount != null && data.total_amount <= 0) {
    return { valid: false, errorMessage: 'total_amount 必須大於 0' };
  }

  // items 陣列
  if ('items' in data && data.items != null) {
    if (!Array.isArray(data.items)) {
      return { valid: false, errorMessage: 'items 必須是陣列' };
    }
    if (data.items.length > INPUT_ITEMS_MAX) {
      return { valid: false, errorMessage: `items 不能超過 ${INPUT_ITEMS_MAX} 個` };
    }
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { valid: false, errorMessage: `items[${i}] 必須是物件` };
      }
      if (typeof item.name !== 'string' || item.name.length === 0) {
        return { valid: false, errorMessage: `items[${i}].name 必須是非空字串` };
      }
      if (item.name.length > INPUT_ITEM_NAME_MAX) {
        return {
          valid: false,
          errorMessage: `items[${i}].name 長度超過 ${INPUT_ITEM_NAME_MAX}`,
        };
      }
      if (typeof item.qty !== 'number' || !Number.isInteger(item.qty) || item.qty <= 0) {
        return {
          valid: false,
          errorMessage: `items[${i}].qty 必須是正整數（收到 ${item.qty}）`,
        };
      }
      if ('total' in item && item.total != null
          && (typeof item.total !== 'number' || !Number.isFinite(item.total))) {
        return {
          valid: false,
          errorMessage: `items[${i}].total 必須是有限數字`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * 驗證訂單資料
 */
function validateOrderData(data) {
  const required = ['user_line_name', 'user_phone', 'address', 'delivery_date', 'time_slot', 'total_amount'];
  const missing = required.filter((k) => !(k in data) || data[k] == null || data[k] === '');
  if (missing.length > 0) {
    return { valid: false, errorMessage: `缺少必填欄位: ${missing.join(', ')}` };
  }

  // 驗證電話
  const phoneResult = validatePhone(data.user_phone);
  if (!phoneResult.valid) {
    return { valid: false, errorMessage: `電話錯誤: ${phoneResult.errorMessage}` };
  }

  // 驗證地址
  const addressResult = validateAddress(data.address);
  if (!addressResult.valid) {
    return { valid: false, errorMessage: `地址錯誤: ${addressResult.errorMessage}` };
  }

  // 驗證日期
  const dateResult = validateDate(data.delivery_date);
  if (!dateResult.valid) {
    return { valid: false, errorMessage: `日期錯誤: ${dateResult.errorMessage}` };
  }

  // 驗證時段
  const timeSlotResult = validateTimeSlotWithDate(data.delivery_date, data.time_slot);
  if (!timeSlotResult.valid) {
    return { valid: false, errorMessage: `時段錯誤: ${timeSlotResult.errorMessage}` };
  }

  return { valid: true };
}

/**
 * 分類品項（chicken / side / extra）
 */
function classifyItems(items) {
  const chicken = {};
  const side = {};
  const extra = {};
  for (const item of items) {
    if (item.name.includes('雞') || item.name.includes('鴨') || item.name.includes('鵝')) {
      chicken[item.name] = item.qty;
    } else if (item.name.includes('秘製')) {
      side[item.name] = item.qty;
    } else {
      extra[item.name] = item.qty;
    }
  }
  return { chicken, side, extra };
}

/**
 * 驗證品項（從 knowledge 載入）
 */
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, errorMessage: '品項為空' };
  }
  const itemsForValidation = items.map((i) => `${i.name} x${i.qty}`).join(', ');
  const result = validateMenu(itemsForValidation);
  if (!result.valid) {
    return { valid: false, errorMessage: result.errorMessage };
  }
  return { valid: true, parsedItems: result.parsedItems };
}

/**
 * 產生 order_id（時間戳後綴）
 */
function generateOrderId() {
  return `PENDING-${Date.now()}`;
}

/**
 * POST /api/orders — 建立訂單
 */
function handleCreateOrder(req, res) {
  return parseBody(req).then((body) => {
    const { order_data, source } = body;
    if (!order_data) {
      return sendJson(res, 400, { success: false, error: '缺少 order_data' });
    }

    // I4: schema 驗證（型別 + 長度）
    const schemaResult = validateInputSchema(order_data);
    if (!schemaResult.valid) {
      return sendJson(res, 400, { success: false, error: schemaResult.errorMessage });
    }

    // 業務驗證
    const validation = validateOrderData(order_data);
    if (!validation.valid) {
      return sendJson(res, 400, { success: false, error: validation.errorMessage });
    }

    // 驗證品項
    const itemsResult = validateItems(order_data.items || []);
    if (!itemsResult.valid) {
      return sendJson(res, 400, { success: false, error: itemsResult.errorMessage });
    }

    // 分類品項
    const classified = classifyItems(itemsResult.parsedItems);

    // 產生 order_id
    const order_id = generateOrderId();
    const created_at = new Date().toISOString();

    // 準備寫入資料
    const orderRow = {
      order_id,
      created_at,
      user_line_name: order_data.user_line_name,
      user_phone: order_data.user_phone.replace(/[\s\-()]/g, ''),
      address: order_data.address,
      community: order_data.community || '',
      delivery_date: order_data.delivery_date,
      time_slot: order_data.time_slot,
      chicken_items: classified.chicken,
      side_items: classified.side,
      extra_items: classified.extra,
      subtotal: order_data.subtotal || order_data.total_amount,
      delivery_fee: 0,
      total_amount: order_data.total_amount,
      payment_method: order_data.payment_method || '待定',
      payment_status: order_data.payment_status || 'pending',
      order_status: order_data.order_status || 'confirmed',
      staff_notes: order_data.staff_notes || '',
      customer_notes: order_data.customer_notes || '',
      source: source || 'api',
      intent_confirmed: true,
    };

    // 寫入 CSV
    try {
      writeOrderWithRetry(orderRow);
      sendJson(res, 201, {
        success: true,
        order_id,
        message: '訂單已建立',
        order: orderRow,
      });
    } catch (e) {
      sendJson(res, 500, { success: false, error: `CSV 寫入失敗: ${e.message}` });
    }
  }).catch((e) => {
    sendJson(res, 400, { success: false, error: `JSON 解析失敗: ${e.message}` });
  });
}

/**
 * PATCH /api/orders/:id — 更新訂單
 */
function handleUpdateOrder(req, res, orderId) {
  return parseBody(req).then((body) => {
    if (!body || Object.keys(body).length === 0) {
      return sendJson(res, 400, { success: false, error: '缺少更新資料' });
    }

    try {
      const success = updateOrder(orderId, body);
      if (success) {
        sendJson(res, 200, { success: true, message: '訂單已更新' });
      } else {
        sendJson(res, 404, { success: false, error: '找不到訂單' });
      }
    } catch (e) {
      sendJson(res, 500, { success: false, error: `更新失敗: ${e.message}` });
    }
  }).catch((e) => {
    sendJson(res, 400, { success: false, error: `JSON 解析失敗: ${e.message}` });
  });
}

/**
 * GET /api/orders — 查詢訂單
 */
function handleListOrders(req, res, urlObj) {
  try {
    if (urlObj.searchParams.has('date')) {
      const date = urlObj.searchParams.get('date');
      const orders = getOrdersByDate(date);
      return sendJson(res, 200, { success: true, count: orders.length, orders });
    }

    // 全部訂單（讀所有 CSV 檔案）
    if (!fs.existsSync(ORDERS_DIR)) {
      return sendJson(res, 200, { success: true, count: 0, orders: [] });
    }
    const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.csv'));
    const allOrders = [];
    for (const file of files) {
      const date = file.replace('.csv', '');
      const list = getOrdersByDate(date);
      for (const o of list) allOrders.push(o);
    }
    sendJson(res, 200, { success: true, count: allOrders.length, orders: allOrders });
  } catch (e) {
    sendJson(res, 500, { success: false, error: e.message });
  }
}

/**
 * GET /api/orders/:id — 查單筆
 */
function handleGetOrder(req, res, orderId) {
  if (!fs.existsSync(ORDERS_DIR)) {
    return sendJson(res, 404, { success: false, error: '訂單不存在' });
  }
  const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.csv'));
  for (const file of files) {
    const date = file.replace('.csv', '');
    const list = getOrdersByDate(date);
    const found = list.find((o) => o.order_id === orderId);
    if (found) {
      return sendJson(res, 200, { success: true, order: found });
    }
  }
  sendJson(res, 404, { success: false, error: '訂單不存在' });
}

// ========== 路由 ==========

// I1：graceful shutdown 狀態追蹤
// 收到 SIGTERM/SIGINT 後：isShuttingDown = true，後續 middleware 拒絕新連線
let isShuttingDown = false;
// 追蹤所有活躍 socket，shutdown 時等它們關閉
const activeSockets = new Set();

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = urlObj.pathname;
  const method = req.method;

  // I1：shutting down → 503，避免客戶看到「突然斷線」
  if (isShuttingDown) {
    res.writeHead(503, {
      'Content-Type': 'application/json; charset=utf-8',
      Connection: 'close',
    });
    res.end(JSON.stringify({
      success: false,
      error: 'Server is shutting down, please retry later',
    }));
    return;
  }

  // I3：IP-based rate limit（在 auth 之前套用，避免 auth 也被 DDoS）
  const clientIp = req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(clientIp);
  res.setHeader('X-RateLimit-Limit', String(API_RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.resetSec));
    sendJson(res, 429, {
      success: false,
      error: `Rate limit exceeded (${API_RATE_LIMIT} per ${API_RATE_LIMIT_WINDOW_MS}ms). Retry in ${rl.resetSec}s.`,
    });
    return;
  }

  // I2：CORS 白名單（從 API_CORS_ORIGINS env 讀，預設關閉）
  const reqOrigin = req.headers['origin'];
  if (API_CORS_ORIGINS.length > 0 && API_CORS_ORIGINS.includes(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (method === 'OPTIONS') {
    // OPTIONS preflight 一律回 204，但 CORS headers 僅在白名單命中時附加
    res.writeHead(204);
    res.end();
    return;
  }

  // Session L2：GET /api/docs — Swagger UI HTML（需 auth）
  if (path === '/api/docs' && method === 'GET') {
    if (!checkAuth(req, res)) return;
    const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>雞味研究所 API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>
`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Session L2：GET /api/docs/openapi.yaml — openapi spec 內容（需 auth）
  if (path === '/api/docs/openapi.yaml' && method === 'GET') {
    if (!checkAuth(req, res)) return;
    if (!fs.existsSync(OPENAPI_FILE)) {
      sendJson(res, 404, { success: false, error: 'openapi.yaml not found' });
      return;
    }
    const content = fs.readFileSync(OPENAPI_FILE, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/yaml; charset=utf-8' });
    res.end(content);
    return;
  }

  // 公開：GET /api/health（也支援 /healthz 給 dashboard /healthz ping）
  // 2026-07-15：加 /healthz alias 讓 dashboard ping 走得到
  if ((path === '/api/health' || path === '/healthz') && method === 'GET') {
    return sendJson(res, 200, { success: true, status: 'ok', tenant: TENANT, time: new Date().toISOString() });
  }

  // 需 auth
  if (!checkAuth(req, res)) return;

  // POST /api/orders
  if (path === '/api/orders' && method === 'POST') {
    return handleCreateOrder(req, res);
  }

  // GET /api/orders
  if (path === '/api/orders' && method === 'GET') {
    return handleListOrders(req, res, urlObj);
  }

  // PATCH /api/orders/:id
  const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch) {
    const orderId = decodeURIComponent(orderMatch[1]);
    if (method === 'PATCH') {
      return handleUpdateOrder(req, res, orderId);
    }
    if (method === 'GET') {
      return handleGetOrder(req, res, orderId);
    }
  }

  send404(res);
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[api-server] 啟動於 http://0.0.0.0:${PORT}`);
  logger.info(`[api-server] Tenant: ${TENANT}`);
  if (API_PASSWORD) {
    logger.info(`[api-server] HTTP Basic Auth: ${API_USERNAME} / ********`);
  } else {
    logger.info(`[api-server] ⚠️  未設定 API_PASSWORD — 全部可訪問（不安全）`);
  }
  logger.info(`[api-server] 端點：`);
  logger.info(`  GET  /api/health            → 健康檢查（公開）`);
  logger.info(`  POST /api/orders            → 建立訂單（需 auth）`);
  logger.info(`  GET  /api/orders            → 查詢訂單（需 auth）`);
  logger.info(`  GET  /api/orders/:id        → 查單筆（需 auth）`);
  logger.info(`  PATCH /api/orders/:id      → 更新訂單（需 auth）`);
  logger.info(`  GET  /api/docs              → Swagger UI（需 auth）`);
  logger.info(`  GET  /api/docs/openapi.yaml → OpenAPI 3.0 spec（需 auth）`);
  logger.info(`[api-server] Graceful shutdown timeout: ${API_GRACEFUL_TIMEOUT_MS}ms`);
});

// I1：追蹤所有 sockets，shutdown 時等待它們斷開
server.on('connection', (socket) => {
  activeSockets.add(socket);
  socket.on('close', () => {
    activeSockets.delete(socket);
  });
});

// I1：graceful shutdown 函式
// 收到 signal 時：
// 1. 標記 isShuttingDown（後續 request 回 503）
// 2. server.close() 停止接受新 connection
// 3. 等待 activeSockets 全部關閉（in-flight request 完成）
// 4. 超過 API_GRACEFUL_TIMEOUT_MS 強制退出
let isGracefulShuttingDown = false;
function gracefulShutdown(signal) {
  if (isGracefulShuttingDown) return;
  isGracefulShuttingDown = true;
  isShuttingDown = true;
  const activeCount = activeSockets.size;
  logger.info(
    `\n[api-server] Received ${signal}, shutting down gracefully `
    + `(timeout=${API_GRACEFUL_TIMEOUT_MS}ms, active_sockets=${activeCount})`,
  );

  // 設置強制 timeout 退出
  const forceExitTimer = setTimeout(() => {
    logger.error(
      `[api-server] Graceful shutdown timeout (${API_GRACEFUL_TIMEOUT_MS}ms) reached, `
      + `forcing exit. Remaining sockets: ${activeSockets.size}`,
    );
    process.exit(1);
  }, API_GRACEFUL_TIMEOUT_MS);
  forceExitTimer.unref();

  // 停止接受新連線，等待現有連線關閉
  server.close(() => {
    logger.info('[api-server] All connections closed, exiting cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
