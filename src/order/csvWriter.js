'use strict';

const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const lockfile = require('proper-lockfile');
const sanitize = require('../utils/sanitizer');
const { formatDate } = require('../utils/timeUtils');
const { isFeatureEnabled } = require('../config');

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

// Lock 設定（Session D D2 race condition 修復）
const LOCK_STALE_MS = 5000; // 5 秒沒更新視為 stale（防止死鎖）
const LOCK_MAX_RETRIES = 50; // 最多重試 50 次
const LOCK_RETRY_INTERVAL_MS = 20; // 每次重試間隔 20ms（busy wait）
const LOCK_MAX_WAIT_MS = LOCK_MAX_RETRIES * LOCK_RETRY_INTERVAL_MS; // = 1000ms

/**
 * 同步取得 CSV 寫入鎖（busy-wait retry loop）
 *
 * 為何不用 proper-lockfile 的 async API：
 * - proper-lockfile lockSync 不支援 retries 選項（會拋 ESYNC 錯誤）
 * - proper-lockfile lockSync 不支援 async/sleep，只能 fire-and-forget
 * - 我們要保留 csvWriter sync API（呼叫端都是 sync），所以自己寫 busy wait
 *
 * Trade-off：
 * - busy wait 在 lock 競爭時會 spin CPU 最多 1 秒
 * - 但 src/ 不是 production runtime，這是「程式碼正確性」而非效能
 * - 跨 process race 在 src/ 測試環境極罕見（不會多 process 同檔寫）
 *
 * @param {string} lockTarget - 要鎖的目標（目錄或檔案路徑）
 * @returns {boolean} true 表示取得鎖
 * @throws {Error} 達到 max retries 仍無法取得
 */
function acquireLockSync(lockTarget) {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      lockfile.lockSync(lockTarget, { stale: LOCK_STALE_MS });
      return true;
    } catch (e) {
      // Busy wait（Node.js sync API 沒有原生 sleep）
      const end = Date.now() + LOCK_RETRY_INTERVAL_MS;
      // eslint-disable-next-line no-empty
      while (Date.now() < end) { /* spin */ }
    }
  }
  throw new Error(
    `[csvWriter] failed to acquire lock on ${lockTarget} after ` +
    `${LOCK_MAX_RETRIES} retries (${LOCK_MAX_WAIT_MS}ms)`,
  );
}

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
 *
 * Race condition 處理（Session D D2）：
 * - 高併發下兩個 writeOrder 同時呼叫會：
 *   - appendFileSync 交錯（同一行被切兩半）
 *   - writeFileSync 覆蓋（一筆訂單被另一筆覆蓋）
 * - 解法：用 proper-lockfile.lockSync 序列化 DATA_DIR 寫入
 * - 鎖目錄（不是單檔）因為：
 *   - 即使不同日期 CSV，確保整體寫入序列化（簡單且安全）
 *   - proper-lockfile 鎖單檔需要檔案存在，新檔第一筆寫入會失敗
 *
 * @param {object} orderData - 訂單資料
 * @returns {string} - 寫入的 order_id
 */
function writeOrder(orderData) {
  // Session D4-3：storage.phase1.enabled flag 檢查
  // chicken.yaml 的 storage.phase1.enabled 控制是否寫入 CSV
  // 未啟用時 throw 明確錯誤，提醒設定錯誤
  if (!isFeatureEnabled('storage.phase1.enabled')) {
    throw new Error('[csvWriter] storage.phase1.enabled = false，CSV 寫入已關閉。請檢查 chicken.yaml 設定。');
  }
  // Session D4-7：storage.phase2.enabled flag 檢查
  // Phase 2 = Google Sheets 寫入（未實作）。若雞味老闆不小心在 yaml 設為 enabled = true，
  // 應以明確錯誤告知「此功能未實作」，避免以為有啟用但實際沒作用。
  if (isFeatureEnabled('storage.phase2.enabled')) {
    throw new Error(
      '[csvWriter] storage.phase2.enabled = true，但 Phase 2（Google Sheets 寫入）尚未實作。\n' +
      '請檢查 chicken.yaml：storage.phase2.enabled 應設為 false，或等待 Phase 2 實作。',
    );
  }
  ensureDataDir();

  const dateStr = orderData.delivery_date || formatDate(new Date());
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);
  const isNewFile = !fs.existsSync(csvPath);

  // 序列化寫入：用 proper-lockfile 鎖 DATA_DIR（跨 process 也有效）
  let locked = false;
  try {
    acquireLockSync(DATA_DIR);
    locked = true;

    // 鎖內：消毒所有欄位
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
  } finally {
    if (locked) {
      try {
        lockfile.unlockSync(DATA_DIR);
      } catch (e) {
        // unlock 失敗不應影響主流程（lockfile 已 stale 或已被外部清理）
        logger.error('[csvWriter] unlockSync failed', { err: e.message });
      }
    }
  }

  return orderData.order_id || '';
}
// ──────────────────────────────────────────────────────────
// Session X4-A：writeOrderWithRetry — _sync_ retry wrapper
// ──────────────────────────────────────────────────────────
// 為什麼不是 async：
// - src/ 內其他 caller（awaitingPayment.js 等）是 sync API
// - csvWriter 的 proper-lockfile.lockSync 是 sync 版（busy-wait 已內建）
// - 改 async 會擾到所有 caller，增加風險
//
// Retry 設計：
// - 3 輪 default（可由第二個參數覆寫）
// - backoff：50ms / 100ms / 150ms（線性递增）
// - busy-wait 而非 setTimeout（保持 sync 語意）
// - 失敗時丢原 error（不論召幾輪都重新 throw）
//
// 適合什廢時候 retry：
// - 暫時性 lock 衝突（其他 process 剛釋放）
// - busy-wait 已超 1 秒仍拿不到 lock 的情況是其次見（CSV 不常高頻）
const RETRY_BACKOFF_BASE_MS = 50;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Sync busy-wait 休眠（不使用 setTimeout 以保持 sync 語意）
 * @param {number} ms
 */
function syncSleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin */ }
}

/**
 * 寫入訂單，支援 retry（Session X4-A）
 *
 * @param {object} orderData - 訂單資料
 * @param {object} [options] - 選項
 * @param {number} [options.maxRetries=3] - 最大重試次數
 * @returns {string} - 寫入的 order_id
 * @throws {Error} 超出最大重試次數後丟出最後一次錯誤
 */
function writeOrderWithRetry(orderData, options = {}) {
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = writeOrder(orderData);
      if (attempt > 1) {
        logger.info('[csvWriter] writeOrder succeeded after retry', {
          attempt,
          maxRetries,
        });
      }
      return result;
    } catch (e) {
      lastError = e;
      logger.warn('[csvWriter] writeOrder attempt failed', {
        attempt,
        maxRetries,
        err: e.message,
      });

      if (attempt < maxRetries) {
        // 線性 backoff：50ms / 100ms / 150ms
        const backoff = RETRY_BACKOFF_BASE_MS * attempt;
        syncSleep(backoff);
      }
    }
  }

  // 所有重試都失敗
  throw new Error(`[csvWriter] writeOrder failed after ${maxRetries} retries: ${lastError ? lastError.message : 'unknown'}`);
}

/**
 * 更新現有訂單（依 order_id）
 *
 * Race condition 處理（Session D D2）：
 * - 與 writeOrder 同樣鎖 DATA_DIR，避免併發 read-modify-write 期間被其他 process 覆蓋
 *
 * @param {string} orderId
 * @param {object} updates - 要更新的欄位
 * @returns {boolean}
 */
function updateOrder(orderId, updates) {
  // Session D4-3：storage.phase1.enabled flag 檢查
  if (!isFeatureEnabled('storage.phase1.enabled')) {
    throw new Error('[csvWriter] storage.phase1.enabled = false，CSV 寫入已關閉。請檢查 chicken.yaml 設定。');
  }
  const dateStr = updates.delivery_date || formatDate(new Date());
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(csvPath)) return false;

  let locked = false;
  try {
    // 序列化 read-modify-write（同 writeOrder）
    acquireLockSync(DATA_DIR);
    locked = true;

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
            const formattedVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
            cols[idx] = formatField(formattedVal);
          }
        }
      }
      return cols.join(',');
    });

    if (!found) {
      return false; // 找不到對應的 orderId
    }

    const output = [CSV_HEADER_LINE, ...updatedLines].join('\n') + '\n';
    fs.writeFileSync(csvPath, output, 'utf8');
    return true;
  } catch (e) {
    return false;
  } finally {
    if (locked) {
      try {
        lockfile.unlockSync(DATA_DIR);
      } catch (e) {
        logger.error('[csvWriter] unlockSync failed', { err: e.message });
      }
    }
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
  writeOrderWithRetry,
  updateOrder,
  CSV_HEADERS,
  formatField,
  parseCSVLine,
  FILENAME_PATTERN,
};

