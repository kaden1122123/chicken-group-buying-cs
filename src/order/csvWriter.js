'use strict';

const path = require('path');
const fs = require('fs');
const sanitize = require('../utils/sanitizer');
const { formatDate } = require('../utils/timeUtils');

// 規模化：支援多租戶
// 1. 讀取環境變數 TENANT_ID，未設定則預設 'chicken'
// 2. 多租戶訂單路徑：data/orders/{tenant_id}/{date}.csv
// 3. 單租戶（向後相容）路徑：data/orders/{date}.csv
const DEFAULT_TENANT = process.env.TENANT_ID || 'chicken';
const ORDERS_ROOT = path.join(__dirname, '../../data/orders');
const TENANT_DATA_DIR = path.join(ORDERS_ROOT, DEFAULT_TENANT);
const LEGACY_DATA_DIR = ORDERS_ROOT;

function resolveDataDir() {
  if (fs.existsSync(TENANT_DATA_DIR)) return TENANT_DATA_DIR;
  return LEGACY_DATA_DIR;
}

const DATA_DIR = resolveDataDir();

// CSV 檔名格式：以 delivery_date 為主，未填時用今天日期
// 格式：{YYYY-MM-DD}.csv（與 config.yaml storage.phase1.filename_pattern 保持同步）
const FILENAME_PATTERN = '{date}.csv';

// CSV 欄位（按照 SPEC.md Section 4.1）
const CSV_HEADERS = [
  'order_id', 'created_at', 'user_line_name', 'user_phone', 'address', 'community',
  'delivery_date', 'time_slot',
  'chicken_items', 'side_items', 'extra_items',
  'chicken_count', 'side_count', 'total_boxes',
  'subtotal', 'delivery_fee', 'total_amount',
  'payment_method', 'payment_status',
  'order_status',
  'staff_notes', 'customer_notes', 'customer_tags',
  'handoff_type', 'handoff_logged_at', 'handoff_resolved_at',
  'source', 'intent_confirmed',
];

const CSV_HEADER_LINE = CSV_HEADERS.join(',');

/**
 * 確保資料目錄存在
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 消毒並格式化欄位值
 * @param {*} value
 * @returns {string}
 */
function formatField(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return sanitize(JSON.stringify(value));
  }
  const str = String(value);
  // 如果包含逗號、引號或換行，則用雙引號包起來
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return sanitize(str);
}

/**
 * 寫入新訂單到 CSV
 * @param {object} orderData - 訂單資料
 * @returns {string} - 寫入的 order_id
 */
function writeOrder(orderData) {
  ensureDataDir();

  const dateStr = orderData.delivery_date || formatDate(new Date());
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);
  const isNewFile = !fs.existsSync(csvPath);

  // 消毒所有欄位
  const row = CSV_HEADERS.map((header) => {
    let value = orderData[header] || '';
    // JSON 欄位序列化
    if (['chicken_items', 'side_items', 'extra_items'].includes(header) && typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    return formatField(value);
  });

  const rowLine = row.join(',');
  const lines = isNewFile ? [CSV_HEADER_LINE, rowLine] : [rowLine];

  fs.appendFileSync(csvPath, lines.join('\n') + '\n', 'utf8');

  return orderData.order_id || '';
}

/**
 * 更新現有訂單（依 order_id）
 * @param {string} orderId
 * @param {object} updates - 要更新的欄位
 * @returns {boolean}
 */
function updateOrder(orderId, updates) {
  const dateStr = updates.delivery_date || formatDate(new Date());
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(csvPath)) return false;

  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    const headerIndex = lines[0] === CSV_HEADER_LINE ? 0 : lines.findIndex((l) => l.startsWith('order_id'));
    const headers = lines[headerIndex].split(',');
    const dataLines = lines.slice(headerIndex + 1);

    let found = false;
    const updatedLines = dataLines.map((line) => {
      const cols = parseCSVLine(line);
      if (cols[0] === orderId) {
        found = true;
        // 更新欄位
        for (const [key, value] of Object.entries(updates)) {
          const idx = headers.indexOf(key);
          if (idx !== -1) {
            let formattedVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
            cols[idx] = formatField(formattedVal);
          }
        }
      }
      return cols.join(',');
    });

    if (!found) {
      return false;  // 找不到對應的 orderId
    }

    const output = [CSV_HEADER_LINE, ...updatedLines].join('\n') + '\n';
    fs.writeFileSync(csvPath, output, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 簡單 CSV 行解析（處理引號包圍的欄位）
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

module.exports = {
  writeOrder,
  updateOrder,
  CSV_HEADERS,
  formatField,
  parseCSVLine,
  FILENAME_PATTERN,
};