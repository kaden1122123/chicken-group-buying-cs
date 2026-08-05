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
function getStorageConfig() {
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
  return orders;
}

/**
 * 把 orders 陣列轉成 Sheets values 格式（二維陣列）
 */
function ordersToSheetValues(orders) {
  if (orders.length === 0) return [];
  // Round 37.8 (Hubert 20:41)：改為精準對齊 Sheet 實際 29 個 header
  // 用 SHEET_HEADER 常數讓 Sheet 變更時能快速對應
  const SHEET_HEADER = [
    'order_id', 'created_at', 'user_line_name', 'user_phone', 'address', 'community',
    'delivery_date', 'time_slot', 'chicken_items', 'side_items', 'extra_items',
    'chicken_count', 'side_count', 'total_boxes', 'subtotal', 'delivery_fee',
    'total_amount', 'payment_method', 'payment_status', 'order_status', 'staff_notes',
    'customer_notes', 'customer_tags', 'handoff_type', 'handoff_logged_at',
    'handoff_resolved_at', 'source', 'intent_confirmed', 'receipts_path',
  ];
  const rows = [SHEET_HEADER];
  for (const o of orders) {
    // Round 37.8：精準對齊 Sheet 29 個欄位（不要寫 Sheet 沒有的欄位）
    // CSV 多出的 6 個欄位（likely_paid, detected_amount 等）會被忽略
    const row = SHEET_HEADER.map((key) => {
      const v = o[key];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    });
    rows.push(row);
  }
  return rows;
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
    // 1. 讀 config
    const storage = getStorageConfig();
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

    // 3. 讀 orders
    const orders = collectAllOrders();
    const values = ordersToSheetValues(orders);

    if (dryRun) {
      logger.info('[sheetsSync] Dry run - skip write', { ordersCount: orders.length, rowsCount: values.length });
      return { success: true, rowsWritten: 0, dryRun: true, ordersCount: orders.length, errors: [] };
    }

    // 5. 取得 access token（共用給 sheet metadata + clear/append，雙重呼叫的浪費已消除）
    const accessToken = await getAccessToken(credentials);

    // 4. Auto-discover sheet name（避免 sheet_name 跟實際試算表名稱不符 + 中文需單引號問題）
    let actualSheetName = phase2.sheet_name;
    try {
      actualSheetName = await getFirstSheetName(accessToken, phase2.spreadsheet_id);
      logger.info('[sheetsSync] 使用 spreadsheet 第一個 sheet', { sheet: actualSheetName });
    } catch (e) {
      logger.warn('[sheetsSync] auto-discover sheet 失敗，用 config 設定', { err: e.message, configured: phase2.sheet_name });
    }
    const sheetName = actualSheetName;

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
  base64url,
};
