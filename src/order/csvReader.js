'use strict';

const path = require('path');
const fs = require('fs');

// 規模化：與 csvWriter 共用路徑解析邏輯
const DEFAULT_TENANT = process.env.TENANT_ID || 'chicken';
const ORDERS_ROOT = path.join(__dirname, '../../data/orders');
const TENANT_DATA_DIR = path.join(ORDERS_ROOT, DEFAULT_TENANT);
const LEGACY_DATA_DIR = ORDERS_ROOT;

function resolveDataDir() {
  if (fs.existsSync(TENANT_DATA_DIR)) return TENANT_DATA_DIR;
  return LEGACY_DATA_DIR;
}

const DATA_DIR = resolveDataDir();
const { parseCSVLine, FILENAME_PATTERN } = require('./csvWriter');

/**
 * 讀取 CSV 並解析為 JSON 陣列
 * @param {string} csvPath
 * @returns {Array<object>}
 */
function readCSV(csvPath) {
  if (!fs.existsSync(csvPath)) return [];

  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    // 找到 header 行
    let headerLine = lines[0];
    if (!headerLine.startsWith('order_id')) {
      const idx = lines.findIndex((l) => l.startsWith('order_id'));
      if (idx !== -1) headerLine = lines[idx];
    }

    const headers = headerLine.split(',').map((h) => h.trim());
    const dataLines = lines.slice(lines.indexOf(headerLine) + 1);

    return dataLines.map((line) => {
      const cols = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        let val = cols[i] || '';
        // 解析 JSON 欄位
        if (['chicken_items', 'side_items', 'extra_items'].includes(h)) {
          try {
            val = JSON.parse(val);
          } catch (e) {
            // ignore
          }
        }
        obj[h] = val;
      });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

/**
 * 依 order_id 查詢訂單
 * @param {string} orderId
 * @returns {object|null}
 */
function getOrderById(orderId) {
  // 搜尋所有 CSV 檔案
  if (!fs.existsSync(DATA_DIR)) return null;

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));

  for (const file of files) {
    const csvPath = path.join(DATA_DIR, file);
    const orders = readCSV(csvPath);
    const found = orders.find((o) => o.order_id === orderId);
    if (found) return found;
  }

  return null;
}

/**
 * 依日期查詢所有訂單
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Array<object>}
 */
function getOrdersByDate(dateStr) {
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);
  return readCSV(csvPath);
}

/**
 * 依電話查詢老客戶
 * @param {string} phone
 * @returns {object|null}
 */
function getCustomerByPhone(phone) {
  if (!fs.existsSync(DATA_DIR)) return null;

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));
  const allOrders = [];

  for (const file of files) {
    const csvPath = path.join(DATA_DIR, file);
    const orders = readCSV(csvPath);
    allOrders.push(...orders);
  }

  const customerOrders = allOrders.filter((o) => o.user_phone === phone);
  return customerOrders.length > 0 ? customerOrders[customerOrders.length - 1] : null;
}

/**
 * 檢查是否為老客戶
 * @param {string} phone
 * @returns {boolean}
 */
function isReturningCustomer(phone) {
  return getCustomerByPhone(phone) !== null;
}

/**
 * 取得所有日期的訂單
 * @returns {Array<object>}
 */
function getAllOrders() {
  if (!fs.existsSync(DATA_DIR)) return [];

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));
  const allOrders = [];

  for (const file of files) {
    const csvPath = path.join(DATA_DIR, file);
    allOrders.push(...readCSV(csvPath));
  }

  return allOrders;
}

/**
 * 取得最近 N 筆訂單（Session X3-A）
 * 按 created_at 降序，預設 20 筆
 * @param {number} [limit=20]
 * @returns {Array<object>}
 */
function getRecentOrders(limit = 20) {
  const all = getAllOrders();
  // 按 created_at 降序排序（ISO 字串可字典序排序）
  all.sort((a, b) => {
    const aTime = a.created_at || '';
    const bTime = b.created_at || '';
    return bTime.localeCompare(aTime);
  });
  return all.slice(0, limit);
}

/**
 * Round 37.24 (Hubert 16:23) - LINE『我的訂單』客戶自查
 * 根據 lineDisplayName（或 userLineId）查詢該客戶的訂單
 * @param {string} lineDisplayName - LINE 顯示名稱
 * @param {object} [opts]
 * @param {number} [opts.limit=5] - 最多回幾筆
 * @returns {Array<object>}
 */
function getOrdersByLineDisplayName(lineDisplayName, opts = {}) {
  const limit = opts.limit || 5;
  if (!lineDisplayName) return [];
  const all = getAllOrders();
  // 過濾：user_line_name 嚴格匹配；保留有效訂單（order_status != 'pending_handoff' 且 有 chicken/side items）
  const filtered = all.filter((o) => {
    if (o.user_line_name !== lineDisplayName) return false;
    // 排除 pending_handoff（可能是 spurious 記錄）
    if ((o.order_status || '').toLowerCase() === 'pending_handoff') return false;
    // 排除空品項
    const ch = typeof o.chicken_items === 'string' ? o.chicken_items : JSON.stringify(o.chicken_items || {});
    const sd = typeof o.side_items === 'string' ? o.side_items : JSON.stringify(o.side_items || {});
    const hasCh = ch && ch !== '{}' && ch !== '';
    const hasSd = sd && sd !== '{}' && sd !== '';
    if (!hasCh && !hasSd) return false;
    return true;
  });
  // 按 created_at 降序
  filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return filtered.slice(0, limit);
}

module.exports = {
  getOrderById,
  getOrdersByDate,
  getCustomerByPhone,
  isReturningCustomer,
  getAllOrders,
  getRecentOrders, // Session X3-A
  getOrdersByLineDisplayName, // Round 37.24
  readCSV,
};
