'use strict';

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
const { writeOrder, updateOrder } = require('../src/order/csvWriter');
const { getOrdersByDate } = require('../src/order/csvReader');

// 決策 4：MOCK_TODAY 環境變數支援，讓測試可以控制「今天」是哪一天
// 用途：api-server.test.js 用 delivery_date: '2026-06-18'，但今天是 2026-06-26
// 過期，設 MOCK_TODAY=2026-06-15T10:00:00+08:00 可讓 validateDate 認為是配送前一日 10 點
// 重要：production 環境絕對不要設 MOCK_TODAY
if (process.env.MOCK_TODAY) {
  const RealDate = Date;
  const mockNow = new RealDate(process.env.MOCK_TODAY).getTime();
  function MockDate(...args) {
    if (args.length === 0) return new RealDate(mockNow);
    return new RealDate(...args);
  }
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  MockDate.now = () => mockNow;
  MockDate.prototype = RealDate.prototype;
  global.Date = MockDate;
  console.log('[api-server] MOCK_TODAY=' + process.env.MOCK_TODAY + ' (測試模式)');
}
const { validateDate } = require('../src/rules/dateRule');
const { validateTimeSlotWithDate } = require('../src/rules/timeSlotRule');
const { validateMenu } = require('../src/rules/menuRule');
const { validatePhone, validateAddress } = require('../src/rules');

// 環境變數
const PORT = parseInt(process.env.PORT || '3001', 10);
const API_USERNAME = process.env.API_USERNAME || 'api-user';
const API_PASSWORD = process.env.API_PASSWORD || '';

// 路徑
const ROOT = path.join(__dirname, '..');
const TENANT = getTenantId();
const ORDERS_DIR = path.join(ROOT, 'data', 'orders', TENANT);

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

    // 驗證
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
      writeOrder(orderRow);
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

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = urlObj.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 公開：GET /api/health
  if (path === '/api/health' && method === 'GET') {
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
  console.log(`[api-server] 啟動於 http://0.0.0.0:${PORT}`);
  console.log(`[api-server] Tenant: ${TENANT}`);
  if (API_PASSWORD) {
    console.log(`[api-server] HTTP Basic Auth: ${API_USERNAME} / ********`);
  } else {
    console.log(`[api-server] ⚠️  未設定 API_PASSWORD — 全部可訪問（不安全）`);
  }
  console.log(`[api-server] 端點：`);
  console.log(`  GET  /api/health            → 健康檢查（公開）`);
  console.log(`  POST /api/orders            → 建立訂單（需 auth）`);
  console.log(`  GET  /api/orders            → 查詢訂單（需 auth）`);
  console.log(`  GET  /api/orders/:id        → 查單筆（需 auth）`);
  console.log(`  PATCH /api/orders/:id      → 更新訂單（需 auth）`);
});

process.on('SIGINT', () => {
  console.log('\n[api-server] 關閉中...');
  server.close(() => process.exit(0));
});
