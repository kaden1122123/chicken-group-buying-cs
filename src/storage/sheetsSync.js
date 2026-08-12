'use strict';

/**
 * Google Sheets 同步模組（P9 · 2026-07-16 加）
 *
 * 功能：讀取 chicken 訂單 CSV → 寫入 Google Sheets
 * 認證：OAuth 2.0 service account（JSON key file）
 * 獨立 google account：clawbrt@gmail.com（不與 kaden1122123@gmail.com 共用）
 *
 * 用法：
 *   const { syncOrdersToSheets } = require('./src/storage/sheetsSync');
 *   const result = await syncOrdersToSheets({ dryRun: true });
 *
 * Setup：執行 `bash scripts/setup-google-sheets.sh` 取得 service account JSON
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const logger = require('../utils/logger');

const SHEETS_API_HOST = 'sheets.googleapis.com';
const TOKEN_API_HOST = 'oauth2.googleapis.com';
const TOKEN_PATH = '/token';
const SHEETS_APPEND_PATH = '/v4/spreadsheets';

/**
 * 讀取 storage config（從 src/config.js 的 getStorageConfig）
 * 為避免循環依賴，這裡用 lazy require
 */
// Round 37.21 (Hubert 14:18) lint 修整：加底線前綴允許 unused（保留給未來 sheetsSync 重構時用）
async function _getStorageConfigLazy() {
  const { getStorageConfig } = require('../config');
  return getStorageConfig();
}

function getTenantId() {
  const { getTenantId } = require('../config');
  return getTenantId();
}

/**
 * Base64URL encoding（JWT 用）
 * @param {Buffer|string} data
 * @returns {string}
 */
function base64url(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 讀 service account JSON 並用 JWT 換取 access token
 * @param {object} credentials - service account JSON
 * @returns {Promise<string>} access token
 */
/**
 * 從 spreadsheet metadata 取得第一個 sheet 的名稱（避免 hardcode sheet_name 出錯）
 * @param {string} accessToken - 已取得的 access token（呼叫端負責 fetch）
 * @param {string} spreadsheetId
 * @returns {Promise<string>}
 */
function getFirstSheetName(accessToken, spreadsheetId) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SHEETS_API_HOST,
      path: `${SHEETS_APPEND_PATH}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const firstSheet = parsed.sheets && parsed.sheets[0];
            if (firstSheet) {
              resolve(firstSheet.properties.title);
            } else {
              reject(new Error('No sheets found in spreadsheet'));
            }
          } catch (e) {
            reject(new Error(`Parse metadata failed: ${e.message}`));
          }
        } else {
          reject(new Error(`Get metadata failed: ${res.statusCode} ${data}`));
        }
      });
    }).on('error', reject).end();
  });
}

function getAccessToken(credentials) {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600, // 1 小時
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signatureInput = `${headerB64}.${payloadB64}`;

    // 用 RSA-SHA256 簽名
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(credentials.private_key);
    const signatureB64 = base64url(signature);
    const jwt = `${signatureInput}.${signatureB64}`;

    // POST to oauth2.googleapis.com/token
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const body = Buffer.from(postData);

    const options = {
      hostname: TOKEN_API_HOST,
      path: TOKEN_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': body.length,
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.access_token);
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data.substring(0, 200)}`));
          }
        } else {
          reject(new Error(`Token request failed (${res.statusCode}): ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Token request timeout')));
    req.write(body);
    req.end();
  });
}

/**
 * HTTPS POST helper（不回傳 stream，回傳完整 response body）
 */
function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': bodyBuf.length,
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Sheets API request timeout')));
    req.write(bodyBuf);
    req.end();
  });
}

/**
 * 從 src/order/csvReader 取得所有訂單（lazy require 避免循環）
 */
function collectAllOrders() {
  // ===== Round 43 (Hubert 2026-08-12) 架構重整:改回只讀 CSV =====
  // 配合「DB → CSV → Sheet」鏈:CSV 為 sheetsSync 的 source of truth
  // (不是 DB 直接 sync。csvWriter._triggerSheetsSync 鏈:exportDbToCsv() → syncOrdersToSheets())
  // 撤掉 Round 40 Step 2 的 DB 優先讀取邏輯
  const { getOrdersByDate } = require('../order/csvReader');
  const fs = require('fs');
  const tenant = getTenantId();

  const ordersDir = path.join(process.cwd(), 'data', 'orders', tenant);
  if (!fs.existsSync(ordersDir)) return [];

  const files = fs.readdirSync(ordersDir).filter((f) => f.endsWith('.csv'));
  const orders = [];
  for (const file of files) {
    const date = file.replace('.csv', '');
    const list = getOrdersByDate(date);
    for (const o of list) {
      orders.push({ ...o, _file_date: date });
    }
  }
  logger.info('[sheetsSync] 從 CSV 讀取訂單', { count: orders.length });
  return orders;
}

/**
 * Round 40 Step 2：DB 欄位映射到 Sheet 欄位(對齊 Sheet 29 欄位 header)
 * DB schema(prompt §3)：line_user_id, customer_name, user_phone...
 * Sheet header(現有)：user_line_name, user_phone...
 * 映射規則：
 *   - customer_name → user_line_name( Sheet 期望「LINE 名稱」)
 *   - line_user_id → 不寫入 Sheet(Sheet 沒有此欄位,留空)
 *   - 其他欄位名一致,直接通過
 */
function mapDbOrderToSheetFormat(dbOrder) {
  return {
    ...dbOrder,
    user_line_name: dbOrder.customer_name || dbOrder.user_line_name || '',
    // 保留 DB 原欄位供未來 Sheet 擴充用
    line_user_id: dbOrder.line_user_id || '',
  };
}

/**
 * 把 orders 陣列轉成 Sheets values 格式（二維陣列）
 */
function ordersToSheetValues(orders, liveHeader) {
  const SHEET_HEADER = [
    'order_id', 'created_at', 'user_line_name', 'user_phone', 'address', 'community',
    'delivery_date', 'time_slot', 'chicken_items', 'side_items', 'extra_items',
    'chicken_count', 'side_count', 'total_boxes', 'subtotal', 'delivery_fee',
    'total_amount', 'payment_method', 'payment_status', 'order_status', 'staff_notes',
    'customer_notes', 'customer_tags', 'handoff_type', 'handoff_logged_at',
    'handoff_resolved_at', 'source', 'intent_confirmed', 'receipts_path',
  ];
  if (orders.length === 0) return [];
  const useHeader = liveHeader || SHEET_HEADER;

  // 建立 headerMap[columnName] = columnIndex
  const headerMap = {};
  useHeader.forEach((colName, idx) => {
    headerMap[colName] = idx;
  });

  // 構建 rows：根據 headerMap 動態填入每筆訂單
  const rows = [useHeader];
  for (const o of orders) {
    const row = new Array(useHeader.length).fill('');
    Object.keys(o).forEach((key) => {
      if (!(key in headerMap)) return; // CSV 多出的欄位（likely_paid 等）→ 丟棄
      const idx = headerMap[key];
      const v = o[key];
      if (v === null || v === undefined) row[idx] = '';
      else if (typeof v === 'object') row[idx] = JSON.stringify(v);
      else row[idx] = String(v);
    });
    rows.push(row);
  }
  return rows;
}

// ===== Round 37.18 async wrapper — 讀 Sheet 實際 Header + 呼叫 ordersToSheetValues =====
async function buildSheetRowsWithLiveHeader(orders, accessToken, spreadsheetId, sheetTitle) {
  let liveHeader = null;
  try {
    const headerRes = await getSheetHeader(accessToken, spreadsheetId, sheetTitle);
    if (headerRes && headerRes.values && headerRes.values[0]) {
      liveHeader = headerRes.values[0];
      logger.info('[sheetsSync] 動態表頭讀取成功：' + liveHeader.length + ' 欄');
    }
  } catch (e) {
    logger.warn('[sheetsSync] 讀 Sheet header 失敗，用 SHEET_HEADER 常數 fallback:', e.message);
  }
  return ordersToSheetValues(orders, liveHeader);
}

/**
 * 讀 Sheet Header Row 1（動態表頭來源）
 * @param {string} accessToken
 * @param {string} spreadsheetId
 * @param {string} sheetTitle
 * @returns {Promise<{values: string[][]}|null>}
 */
function getSheetHeader(accessToken, spreadsheetId, sheetTitle) {
  return new Promise((resolve, reject) => {
    const range = `${sheetTitle}!A1:AC1`;
    https.get({
      hostname: SHEETS_API_HOST,
      path: `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 主要 sync 函數：讀 CSV → 寫 Sheets
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - true = 不實際寫入，只回傳將要寫的資料
 * @returns {Promise<{success: boolean, rowsWritten: number, errors: string[]}>}
 */
async function syncOrdersToSheets(options = {}) {
  const { dryRun = false } = options;
  const _errors = []; // unused 2026-07-25 Round 26 #2 lint cleanup（未來加錯誤處理時啟用）

  try {
    // 1. 讀 config（直接 require 取最新值，避免 LOCAL wrapper cache 問題）
    const storage = require('../config').getStorageConfig();
    const phase2 = storage && storage.phase2;
    if (!phase2) {
      return { success: false, rowsWritten: 0, errors: ['storage.phase2 config 不存在'] };
    }
    // Round 37.17 (Hubert 11:47) 事件驅動架構：forceSync=true 時跳過 phase2.enabled 阻擋
    // 由 csvWriter._triggerSheetsSync('writeOrder') 觸發（每筆新訂單自動同步）
    // 預設行為（cron / 手動呼叫）仍遵守 phase2.enabled 開關（向後相容）
    const forceSync = options && options.forceSync === true;
    if (!phase2.enabled && !forceSync) {
      return { success: false, rowsWritten: 0, errors: ['storage.phase2.enabled = false（待 OAuth setup）'] };
    }
    if (!phase2.enabled && forceSync) {
      logger.info('[sheetsSync] forceSync=true 跳過 phase2.enabled 阻擋（事件驅動模式）');
    }

    // 2. 讀 credentials
    const credsPath = phase2.auth && phase2.auth.credentials_path;
    if (!credsPath || !fs.existsSync(credsPath)) {
      return {
        success: false,
        rowsWritten: 0,
        errors: [`service account JSON 不存在：${credsPath}\n請執行 bash scripts/setup-google-sheets.sh`],
      };
    }
    const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

    if (!phase2.spreadsheet_id) {
      return {
        success: false,
        rowsWritten: 0,
        errors: ['spreadsheet_id 未設定。請在 chicken.yaml storage.phase2.spreadsheet_id 填入 Google Sheets ID'],
      };
    }

    // 3. 讀 orders（dryRun 也需要計算訂單數）
    const orders = collectAllOrders();
    if (dryRun) {
      logger.info('[sheetsSync] Dry run - skip write', { ordersCount: orders.length });
      return { success: true, rowsWritten: 0, dryRun: true, ordersCount: orders.length, errors: [] };
    }

    // 4. 取得 access token（JWT signing）— 只在不是 dryRun 時打 HTTPS
    const accessToken = await getAccessToken(credentials);

    // 5. Auto-discover sheet name FIRST（修 2026-08-05 bug: sheetTitle 在呼叫前 undefined）
    let actualSheetName = phase2.sheet_name;
    try {
      actualSheetName = await getFirstSheetName(accessToken, phase2.spreadsheet_id);
      logger.info('[sheetsSync] 使用 spreadsheet 第一個 sheet', { sheet: actualSheetName });
    } catch (e) {
      logger.warn('[sheetsSync] auto-discover sheet 失敗，用 config 設定', { err: e.message, configured: phase2.sheet_name });
    }
    const sheetName = actualSheetName;

    // 6. 用動態 header 構建 rows（用已 discover 的 sheetName）
    const values = await buildSheetRowsWithLiveHeader(orders, accessToken, phase2.spreadsheet_id, sheetName);

    // 6. 寫入 Sheets（先 clear 後寫，避免重複）
    // 中文 sheet name 用單引號包裝避免 range parse error
    const quotedSheet = `'${sheetName}'`;
    const range = `${quotedSheet}!A1`; // append 從 A1 開始（Sheets 自動找尾）

    // Clear first
    await httpsPost(
      SHEETS_API_HOST,
      `${SHEETS_APPEND_PATH}/${encodeURIComponent(phase2.spreadsheet_id)}/values/${encodeURIComponent(`${sheetName}!A1:ZZ`)}:clear`,
      '',
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    );

    // Append new values
    const response = await httpsPost(
      SHEETS_API_HOST,
      `${SHEETS_APPEND_PATH}/${encodeURIComponent(phase2.spreadsheet_id)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
      JSON.stringify({ values }),
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode === 200) {
      logger.info('[sheetsSync] Sync success', { ordersCount: orders.length, rowsWritten: values.length });
      return { success: true, rowsWritten: values.length, errors: [] };
    } else {
      const msg = `Sheets API failed (${response.statusCode}): ${response.body.substring(0, 300)}`;
      logger.error('[sheetsSync] Sync failed', { statusCode: response.statusCode, body: response.body });
      return { success: false, rowsWritten: 0, errors: [msg] };
    }
  } catch (e) {
    logger.error('[sheetsSync] Unexpected error', { err: e.message });
    return { success: false, rowsWritten: 0, errors: [e.message] };
  }
}

module.exports = {
  syncOrdersToSheets,
  getAccessToken,
  getFirstSheetName,
  collectAllOrders,
  ordersToSheetValues,
  buildSheetRowsWithLiveHeader,
  base64url,
};
