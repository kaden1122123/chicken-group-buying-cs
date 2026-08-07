'use strict';

/**
 * src/storage/db.js
 * Round 40 (Hubert 14:40 同意) — SQLite Primary DB layer
 *
 * 設計:
 *   - better-sqlite3 synchronous API(簡單 + 適合本地小型 DB)
 *   - DB 路徑: data/db/chicken.db(已在 .gitignore 排除)
 *   - Schema 對齊 prompt 規範的 29 欄位 + indexes(line_user_id + payment_status)
 *   - 5 個標準 CRUD 介面:initDb / createOrder / getOrderById / updateOrderStatus / listOrders
 *   - 測試用 `:memory:` in-memory DB(避免檔案污染)
 *
 * 與既有腳本整合:
 *   - csvWriter 雙寫:DB 為主,CSV 為備份(Step 2 整合)
 *   - sheetsSync 改讀 DB(Step 2 整合)
 *   - Dashboard API 4 個 endpoint 都走 DB(Step 3 整合)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', 'data', 'db');
const DB_PATH = path.join(DB_DIR, 'chicken.db');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  -- 主鍵(prompt §3)
  order_id TEXT PRIMARY KEY,

  -- timestamps(prompt §3)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- 核心欄位(prompt §3)
  line_user_id TEXT,
  customer_name TEXT,
  payment_method TEXT,                        -- cash/transfer/jko/linepay
  payment_info TEXT,                          -- 帳號後五碼/交易號
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',  -- UNPAID/VERIFYING/PAID/FAILED
  order_status TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING/PROCESSING/SHIPPED/CANCELLED
  tracking_number TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,

  -- 完整 29 欄位(prompt §3 + 對齊 CSV)
  user_phone TEXT,
  address TEXT,
  community TEXT,
  delivery_date TEXT,
  time_slot TEXT,
  chicken_items TEXT,
  side_items TEXT,
  extra_items TEXT,
  chicken_count INTEGER DEFAULT 0,
  side_count INTEGER DEFAULT 0,
  total_boxes INTEGER DEFAULT 0,
  subtotal INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 0,
  staff_notes TEXT,
  customer_notes TEXT,
  customer_tags TEXT,
  handoff_type TEXT,
  handoff_logged_at TEXT,
  handoff_resolved_at TEXT,
  source TEXT,
  intent_confirmed TEXT,
  receipts_path TEXT
);

-- Indexes(prompt §3)
CREATE INDEX IF NOT EXISTS idx_orders_line_user_id ON orders(line_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
`;

/**
 * 確保 production DB 已初始化(lazy init — 只在 production DB 首次寫入時建表)
 * - 測試傳入的 :memory: db 不會被 auto-init(測試自行管理)
 * - initDb(db) 明確呼叫會重設 flag(供重置 schema 用)
 */
let _initialized = false;
function ensureInitialized() {
  if (_initialized) return;
  initDb();
  _initialized = true;
}

/** 重置 initialized flag(供測試重置 schema 用) */
function _resetInitFlag() {
  _initialized = false;
}

const ALL_COLUMNS = [
  'order_id', 'created_at', 'updated_at',
  'line_user_id', 'customer_name', 'payment_method', 'payment_info',
  'payment_status', 'order_status', 'tracking_number', 'total_amount',
  'user_phone', 'address', 'community', 'delivery_date', 'time_slot',
  'chicken_items', 'side_items', 'extra_items',
  'chicken_count', 'side_count', 'total_boxes', 'subtotal', 'delivery_fee',
  'staff_notes', 'customer_notes', 'customer_tags',
  'handoff_type', 'handoff_logged_at', 'handoff_resolved_at',
  'source', 'intent_confirmed', 'receipts_path',
];

const UPDATABLE_COLUMNS = [
  'payment_status', 'order_status', 'tracking_number',
  'staff_notes', 'customer_notes', 'payment_info', 'total_amount',
  'updated_at',
];

/**
 * 確保 data/db/ 目錄存在
 */
function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

/**
 * 開啟 DB 連線(供內部使用 + 測試用 `:memory:`)
 * @param {string} [dbPath] - 自訂路徑,預設為 production DB_PATH
 * @returns {Database.Database}
 */
function openDb(dbPath) {
  if (dbPath === ':memory:' || !dbPath) {
    if (!dbPath) ensureDbDir();
    return new Database(dbPath || DB_PATH);
  }
  return new Database(dbPath);
}

/**
 * 初始化 DB(建立 tables + indexes)
 * @param {Database.Database} [db] - 可選,測試時可傳 in-memory DB
 * @returns {boolean}
 */
function initDb(db) {
  const target = db || openDb();
  try {
    target.exec(SCHEMA_SQL);
    if (!db) _initialized = true; // 只對 production DB 設 flag
    return true;
  } finally {
    if (!db) target.close();
  }
}

/**
 * 建立訂單(INSERT)
 * @param {Object} orderData - 訂單資料(需含 order_id)
 * @param {Database.Database} [db] - 可選外部連線
 * @returns {{order_id: string, changes: number}}
 */
function createOrder(orderData, db) {
  if (!orderData || !orderData.order_id) {
    throw new Error('createOrder: orderData.order_id is required');
  }
  if (!db) ensureInitialized(); // production DB lazy init(測試傳 db 時跳過)
  const target = db || openDb();
  const now = new Date().toISOString();

  // 動態建構 INSERT:跳過 null/undefined 欄位,讓 SQLite 用 DEFAULT 值
  // (避免顯式 NULL 違反 NOT NULL 約束)
  // 型別轉換:better-sqlite3 只接受 number/string/bigint/buffer/null
  //   - boolean → 0/1(SQLite 無原生 boolean,用 INTEGER)
  //   - Date → ISO string
  //   - object (excluded) → 跳過
  const cols = [];
  const placeholders = [];
  const params = {};
  for (const col of ALL_COLUMNS) {
    let value;
    if (col === 'created_at') {
      value = orderData[col] || now;
    } else if (col === 'updated_at') {
      value = now;
    } else if (orderData[col] === undefined || orderData[col] === null) {
      continue; // 跳過此欄位,使用 SQLite DEFAULT
    } else {
      value = orderData[col];
    }
    // 型別轉換(SQLite 約束)
    if (typeof value === 'boolean') {
      value = value ? 1 : 0;
    } else if (value instanceof Date) {
      value = value.toISOString();
    } else if (typeof value === 'object') {
      // 避免 object/array 進 DB(進階用法應由 caller 自行 JSON.stringify)
      value = JSON.stringify(value);
    }
    cols.push(col);
    placeholders.push(`@${col}`);
    params[col] = value;
  }
  try {
    const sql = `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const stmt = target.prepare(sql);
    const result = stmt.run(params);
    return { order_id: orderData.order_id, changes: result.changes };
  } finally {
    if (!db) target.close();
  }
}

/**
 * 查詢單筆訂單
 * @param {string} orderId
 * @param {Database.Database} [db]
 * @returns {Object|null}
 */
function getOrderById(orderId, db) {
  if (!db) ensureInitialized();
  const target = db || openDb();
  try {
    const row = target.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    return row || null;
  } finally {
    if (!db) target.close();
  }
}

/**
 * 更新訂單狀態 / 欄位(白名單欄位)
 * @param {string} orderId
 * @param {Object} updates - 要更新的欄位(payment_status / order_status / tracking_number / staff_notes / customer_notes 等)
 * @param {Database.Database} [db]
 * @returns {{changes: number, order_id: string}}
 */
function updateOrderStatus(orderId, updates, db) {
  if (!orderId) {
    throw new Error('updateOrderStatus: orderId is required');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('updateOrderStatus: updates object is required');
  }
  if (!db) ensureInitialized();
  const target = db || openDb();
  const sets = [];
  const values = { order_id: orderId };
  // 只處理使用者提供的欄位(updated_at 由 UPDATABLE_COLUMNS 排除)
  const userFields = UPDATABLE_COLUMNS.filter((k) => k !== 'updated_at');
  for (const key of userFields) {
    if (key in updates) {
      sets.push(`${key} = @${key}`);
      values[key] = updates[key];
    }
  }
  // 若無使用者欄位 → no-op,直接返回(連 updated_at 也不動)
  if (sets.length === 0) {
    if (!db) target.close();
    return { changes: 0, order_id: orderId };
  }
  // 自動更新 updated_at
  sets.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();
  try {
    const sql = `UPDATE orders SET ${sets.join(', ')} WHERE order_id = @order_id`;
    const result = target.prepare(sql).run(values);
    return { changes: result.changes, order_id: orderId };
  } finally {
    if (!db) target.close();
  }
}

/**
 * 列出訂單(支援分頁 + 篩選)
 * @param {Object} opts - { limit, offset, payment_status, order_status, line_user_id }
 * @param {Database.Database} [db]
 * @returns {Array<Object>}
 */
function listOrders(opts = {}, db) {
  const { limit = 100, offset = 0, payment_status, order_status, line_user_id } = opts;
  if (!db) ensureInitialized();
  const target = db || openDb();
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = { limit, offset };
  if (payment_status) {
    sql += ' AND payment_status = @payment_status';
    params.payment_status = payment_status;
  }
  if (order_status) {
    sql += ' AND order_status = @order_status';
    params.order_status = order_status;
  }
  if (line_user_id) {
    sql += ' AND line_user_id = @line_user_id';
    params.line_user_id = line_user_id;
  }
  sql += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset';
  try {
    const rows = target.prepare(sql).all(params);
    return rows;
  } finally {
    if (!db) target.close();
  }
}

module.exports = {
  // lifecycle
  initDb,
  openDb,
  ensureDbDir,
  ensureInitialized,
  // CRUD
  createOrder,
  getOrderById,
  updateOrderStatus,
  listOrders,
  // constants(供測試用)
  SCHEMA_SQL,
  DB_PATH,
  DB_DIR,
  ALL_COLUMNS,
  UPDATABLE_COLUMNS,
};
