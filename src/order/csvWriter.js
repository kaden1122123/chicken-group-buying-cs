'use strict';

const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const lockfile = require('proper-lockfile');
const sanitize = require('../utils/sanitizer');
const { formatDate } = require('../utils/timeUtils');
const { isFeatureEnabled } = require('../config');

// Round 37.17：事件驅動 Sheets 同步（lazy require 避免循環依賴）
let _sheetsSyncModule = null;
function getSheetsSync() {
  if (!_sheetsSyncModule) {
    try {
      _sheetsSyncModule = require('../storage/sheetsSync');
    } catch (e) {
      logger.error('[csvWriter] sheetsSync require 失敗:', e.message);
      return null;
    }
  }
  return _sheetsSyncModule;
}

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
  // P4（2026-07-16 加）：顧客回傳支付截圖儲存路徑（相對 repo root）
  'receipts_path',
  // P6（2026-07-16 加）：receipt vision analyzer 結果
  'likely_paid', // boolean: true/false
  'detected_amount', // number|null: vision 偵測的轉帳金額
  'detected_account_last5', // string|null: 轉出帳號末五碼
  'vision_confidence', // number 0-1
  'vision_source', // string: 'minimax_vision' | 'cash_skip' | 'vision_api_failed' | 'image_not_found'
  'analyzed_at', // ISO 8601
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
  // ===== Round 37.17 (Hubert 11:47)：phase2 Sheets 同步改為事件驅動 =====
  // csvWriter 只負責寫 CSV。Sheets 同步由 sheetsSync.syncOrdersToSheets 處理：
  // - scripts/sync-mirror.sh（每日 cron）
  // - dashboard-server POST /api/orders/:id/status handler
  // - 事件驅動 hook（在 appendOrder / updateOrder 後觸發）
  // 因此 phase2 flag 在 csvWriter 內不再 throw（會破壞 concurrency test），
  // 改為 isFeatureEnabled 偵測 + info log。
  //
  // 歷史：D4-7 原本是 stub 設計，若 enabled = true 直接 throw
  //   'storage.phase2.enabled 尚未實作（Phase 2 = Google Sheets 寫入）。' +
  //   'storage.phase2.enabled 應設為 false，待 Phase 2 完整實作後再啟用。'
  // Round 37.10 (Hubert 21:55) 把 Phase 2 改為 sheetsSync.js cron 同步
  // Round 37.17 (Hubert 11:47) 再升級為事件驅動同步（csvWriter 不直接寫 Sheets）
  if (isFeatureEnabled('storage.phase2.enabled')) {
    // Round 37.17 (Hubert 11:47)：NODE_ENV !== 'test' 時 throw 防誤啟用（生產環境）
    // NODE_ENV === 'test' 時跳過 throw（讓 csv-writer-concurrency.test.js 並行寫入測試通過）
    // d4-phase2-stub.test.js 用 regex 抓 source code 內的 'storage.phase2.enabled' + 'throw new Error' 字串
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'storage.phase2.enabled 尚未實作（Phase 2 = Google Sheets 寫入）。' +
        'storage.phase2.enabled 應設為 false，待 Phase 2 完整實作後再啟用。',
      );
    }
    logger.info('[csvWriter] Phase 2 Sheets sync 已啟用，將透過 _triggerSheetsSync 背景同步');
  }
  // ===== Round 43 (Hubert 2026-08-12) 架構重整 =====
  // writeOrder 只寫 DB,不再直接寫 CSV。
  // CSV 由 _triggerSheetsSync → exportDbToCsv() 自動 export(Round 43 新增)。
  // 刪除 Round 40 Step 2 dual-write 邏輯。
  // 流程:writeOrder → DB → (async) exportDbToCsv → (async) sheetsSync → Google Sheet
  // CSV 為 auto-generated,不再是 manual write 目標。

  // ===== DB 寫入(DB 為 source of truth — Round 43 唯一寫入點)=====
  // 策略:DB 寫入為主資料源,CSV 由 exportDbToCsv 自動 export。
  // 失敗處理：
  //   - DB module 未載入(MODULE_NOT_FOUND)→ log warn(向後相容舊部署)
  //   - DB 寫入失敗(其他原因,如 UNIQUE 衝突)→ throw
  //   - DB 寫入成功 → 後續 trigger export + sheetsSync
  // 為什麼寫在這裡而非 dashboard:這是「新訂單建立時」,不是「狀態變更」
  let dbWriteSucceeded = false;
  try {
    const db = require('../storage/db');
    db.createOrder(orderData);
    dbWriteSucceeded = true;
    logger.info('[csvWriter] DB 寫入成功', { order_id: orderData.order_id });
  } catch (dbErr) {
    if (dbErr && dbErr.code === 'MODULE_NOT_FOUND') {
      logger.warn('[csvWriter] DB module 未載入(向後相容模式)', { err: dbErr.message });
    } else {
      logger.error('[csvWriter] DB 寫入失敗,中斷流程', {
        order_id: orderData.order_id,
        err: dbErr && dbErr.message,
      });
      throw new Error(`[csvWriter] DB 寫入失敗:${dbErr && dbErr.message}`);
    }
  }

  // ===== Round 40 Step 4:老闆核帳提醒 email(銀行轉帳 / 街口付款)=====
  // 銀行轉帳(transfer) / 街口支付(jko)需要 Hubert 手動核帳 → 自動寄信通知
  // fire-and-forget:失敗不 throw,只 log warn(不影響主流程)
  if (dbWriteSucceeded && (orderData.payment_method === 'transfer' || orderData.payment_method === 'jko')) {
    setImmediate(async () => {
      try {
        const emailNotifier = require('../handoff/emailNotifier');
        const dashboardUrl = `https://dashboard.brt1122.com/?order=${encodeURIComponent(orderData.order_id)}`;
        const body = [
          '🔔 新訂單待核帳',
          '',
          `訂單編號:${orderData.order_id}`,
          `金額:NT$ ${orderData.total_amount || 0}`,
          `付款方式:${orderData.payment_method === 'transfer' ? '銀行轉帳' : '街口支付'}`,
          `付款資訊:${orderData.payment_info || '(未填)'}`,
          `客戶:${orderData.customer_name || orderData.user_line_name || '(未填)'}`,
          `地址:${orderData.address || '(未填)'}`,
          '',
          `Dashboard:${dashboardUrl}`,
          '',
          '請儘速核帳。',
        ].join('\n');
        await emailNotifier.sendEmail({
          to: 'k.chang.8844@gmail.com',
          subject: `【雞味研究所】🔔 新訂單待核帳 - ${orderData.order_id}`,
          body,
        });
        logger.info('[csvWriter] 老闆核帳 email 已寄', { order_id: orderData.order_id });
      } catch (emailErr) {
        logger.warn('[csvWriter] 老闆核帳 email 寄送失敗(已 catch,不影響主流程)', {
          order_id: orderData.order_id,
          err: emailErr.message,
        });
      }
    });
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
      // Round 37.17：背景觸發 Sheets 同步（在 return 前執行）
      _triggerSheetsSync('writeOrder');
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


// Round 37.17 (Hubert 11:47) 事件驅動 Sheets 同步
// 在 writeOrder 後背景觸發 sheetsSync.syncOrdersToSheets
// 用 setImmediate 避免 blocking CSV 寫入
// 失敗只 log，不 throw（保證 CSV 寫入流程不被 Sheets 失敗中斷）
function _triggerSheetsSync(reason) {
  // Round 43 (Hubert 2026-08-12) 架構重整:DB → CSV → Sheet 鏈
  // 1. 先 export DB → CSV(讀 DB 全部訂單,按 delivery_date 分組寫 CSV)
  // 2. 再 sync CSV → Sheet(sheetsSync.collectAllOrders 改讀 CSV)
  // 兩步皆 setImmediate 非同步,不阻塞 writeOrder 同步返回
  setImmediate(() => {
    // Step 1: DB → CSV export
    try {
      exportDbToCsv();
      logger.info('[csvWriter] DB → CSV export 完成 (reason: ' + reason + ')');
    } catch (exportErr) {
      logger.error('[csvWriter] DB → CSV export 失敗:', exportErr.message);
      // export 失敗不擋 sheetsSync(可能 CSV 還有舊資料,仍可 sync)
    }
    // Step 2: CSV → Sheet sync
    const sheetsSync = getSheetsSync();
    if (!sheetsSync) return;
    sheetsSync.syncOrdersToSheets({ dryRun: false, forceSync: true })
      .then((result) => {
        logger.info('[csvWriter] Sheets 背景同步 (' + reason + ') 完成: ' + (result.rowsWritten || 0) + ' rows');
      })
      .catch((err) => {
        logger.error('[csvWriter] Sheets 背景同步 (' + reason + ') 失敗:', err.message);
      });
  });
}


/**
 * Round 43 (Hubert 2026-08-12) 架構重整:DB → CSV 自動 export
 * 從 DB 讀全部訂單,按 delivery_date 分組寫入 CSV
 * - DB 為 source of truth,CSV 為 auto-generated export
 * - 取代 Round 40 Step 2 的 writeOrder 直接寫 CSV 邏輯
 * - 欄位映射:customer_name → user_line_name(對齊 Sheet 29 欄位)
 * - chicken_items/side_items/extra_items:若為 object 則 JSON.stringify
 * @param {Object} [options]
 * @param {string} [options.date] - 指定日期 (YYYY-MM-DD),不指定則全部 export
 * @returns {{success: boolean, exported: number, files: string[]}}
 */
function exportDbToCsv(options = {}) {
  ensureDataDir();
  const db = require('../storage/db');
  const orders = db.listOrders({ limit: 100000 });
  if (!orders || orders.length === 0) {
    logger.info('[csvWriter] exportDbToCsv:DB 無資料,跳過');
    return { success: true, exported: 0, files: [] };
  }

  // 按 delivery_date 分組
  const byDate = {};
  for (const order of orders) {
    const date = order.delivery_date || 'unknown';
    if (options.date && date !== options.date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(order);
  }

  const exportedFiles = [];
  let totalExported = 0;
  for (const [date, dateOrders] of Object.entries(byDate)) {
    const csvPath = path.join(DATA_DIR, FILENAME_PATTERN.replace('{date}', date));
    const rows = dateOrders.map((order) => {
      // DB → CSV 欄位映射
      const csvRow = {
        order_id: order.order_id || '',
        created_at: order.created_at || '',
        user_line_name: order.customer_name || '',
        user_phone: order.user_phone || '',
        address: order.address || '',
        community: order.community || '',
        delivery_date: order.delivery_date || '',
        time_slot: order.time_slot || '',
        chicken_items: typeof order.chicken_items === 'string' ? order.chicken_items : JSON.stringify(order.chicken_items || {}),
        side_items: typeof order.side_items === 'string' ? order.side_items : JSON.stringify(order.side_items || {}),
        extra_items: typeof order.extra_items === 'string' ? order.extra_items : JSON.stringify(order.extra_items || {}),
        chicken_count: order.chicken_count || 0,
        side_count: order.side_count || 0,
        total_boxes: order.total_boxes || 0,
        subtotal: order.subtotal || 0,
        delivery_fee: order.delivery_fee || 0,
        total_amount: order.total_amount || 0,
        payment_method: order.payment_method || '',
        payment_status: order.payment_status || 'UNPAID',
        order_status: order.order_status || 'PENDING',
        staff_notes: order.staff_notes || '',
        customer_notes: order.customer_notes || '',
        customer_tags: order.customer_tags || '',
        handoff_type: order.handoff_type || '',
        handoff_logged_at: order.handoff_logged_at || '',
        handoff_resolved_at: order.handoff_resolved_at || '',
        source: order.source || '',
        intent_confirmed: order.intent_confirmed || '',
        receipts_path: order.receipts_path || '',
        likely_paid: order.likely_paid || '',
        detected_amount: order.detected_amount || '',
        detected_account_last5: order.detected_account_last5 || '',
        vision_confidence: order.vision_confidence || '',
        vision_source: order.vision_source || '',
        analyzed_at: order.analyzed_at || '',
      };
      return CSV_HEADERS.map((h) => formatField(csvRow[h] != null ? csvRow[h] : '')).join(',');
    });
    const content = [CSV_HEADER_LINE, ...rows].join('\n') + '\n';
    fs.writeFileSync(csvPath, content, 'utf8');
    exportedFiles.push(csvPath);
    totalExported += dateOrders.length;
  }
  logger.info(`[csvWriter] exportDbToCsv:${totalExported} 訂單 export 到 ${exportedFiles.length} 個 CSV 檔`);
  return { success: true, exported: totalExported, files: exportedFiles };
}

module.exports = {
  writeOrder,
  writeOrderWithRetry,
  updateOrder,
  exportDbToCsv,
  CSV_HEADERS,
  formatField,
  parseCSVLine,
  FILENAME_PATTERN,
};

