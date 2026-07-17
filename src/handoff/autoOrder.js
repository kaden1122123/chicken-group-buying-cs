'use strict';

/**
 * B 方案：LLM 自動觸發 POST /api/orders (2026-07-16 加)
 *
 * 取代 A 方案手動建單。LLM 偵測「客戶確認」後，自動 call api-server 建單。
 *
 * 嚴格規則 (Hubert 22:28 強調)：
 * - 客戶必須回覆純文字「確認」才建單
 * - 排除：line 貼圖、emoji、其他非純文字
 *
 * auth 安全：
 * - X-API-Token 從 XDG secrets 讀
 * - 禁止 commit 到 git (.gitignore 排除)
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('../utils/logger');
const { notifyHubert } = require('./notifier');

const API_SERVER_URL = process.env.API_SERVER_URL || 'http://127.0.0.1:3001';
const AUTO_CREATE_TIMEOUT_MS = 10000;

function isStrictConfirmation(message) {
  if (typeof message !== 'string') return false;
  const trimmed = message.trim();
  if (trimmed !== '確認' && !/^確認[。！!？?]$/.test(trimmed)) {
    return false;
  }
  if (/^\(.{3,}\)$/.test(trimmed)) {
    logger.info('[autoOrder] 偵測到 line 貼圖，跳過', { message: trimmed });
    return false;
  }
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u.test(trimmed)) {
    logger.info('[autoOrder] 偵測到 emoji，跳過', { message: trimmed });
    return false;
  }
  return true;
}

async function triggerAutoOrder(options) {
  const { userId, orderData } = options || {};
  if (!userId || !orderData) {
    return { success: false, error: '缺少 userId 或 orderData' };
  }

  const token = readXApiToken();
  if (!token) {
    const error = 'X-API-Token 不存在或讀取失敗';
    logger.error('[autoOrder] ' + error);
    await fallbackNotifyHubert(userId, orderData, error);
    return { success: false, error };
  }

  // items: array of {name, qty}（api-server.validateItems 要求 array 格式）
  // 從 orderData 的 object 格式（chicken_items/side_items/extra_items）合併轉換
  const items = [
    ...Object.entries(orderData.chicken_items || {}).map(([name, qty]) => ({ name, qty: Number(qty) || 1 })),
    ...Object.entries(orderData.side_items || {}).map(([name, qty]) => ({ name, qty: Number(qty) || 1 })),
    ...Object.entries(orderData.extra_items || {}).map(([name, qty]) => ({ name, qty: Number(qty) || 1 })),
  ];

  const orderPayload = {
    order_data: {
      user_line_name: orderData.user_line_name || 'LINE 用戶',
      user_phone: orderData.user_phone || '',
      address: orderData.address,
      community: orderData.community || '',
      delivery_date: orderData.delivery_date,
      time_slot: orderData.time_slot,
      items, // 統一用 items array（api-server.validateItems 要求）
      subtotal: orderData.subtotal,
      delivery_fee: orderData.delivery_fee || 0,
      total_amount: orderData.total_amount,
      payment_method: orderData.payment_method,
      payment_status: 'pending',
      order_status: 'confirmed',
      staff_notes: 'B 方案：客戶回「確認」自動建單',
      customer_notes: orderData.customer_notes || '',
      customer_tags: orderData.customer_tags || '',
      intent_confirmed: true,
    },
    // source 在 body 頂層（api-server 從 body.source 取，不是 order_data.source）
    source: 'b_auto_confirm',
  };

  try {
    const result = await postOrder(orderPayload, token);
    if (result.success) {
      logger.info('[autoOrder] 自動建單成功', { userId, orderId: result.orderId });
      try {
        await notifyHubert(
          '🔔 【B 方案自動建單】客戶 ' + (orderData.user_line_name || userId) + ' 已確認訂單：\n' +
        'order_id: ' + result.orderId + '\n' +
        '配送: ' + orderData.delivery_date + ' ' + orderData.time_slot + '\n' +
        '金額: NT$ ' + orderData.total_amount + '\n' +
        '請確認付款狀態 ✓',
          { type: 'autoOrder' },
        );
      } catch (e) {
        // notifyHubert 失敗（LINE 429 / 網路）只 log，不影響 autoOrder success
        logger.warn('[autoOrder] 通知老闆失敗', { err: e.message, userId });
      }
      return { success: true, orderId: result.orderId };
    } else {
      const error = 'API 回傳失敗: ' + (result.error || '未知');
      logger.error('[autoOrder] 自動建單失敗', { userId, error });
      await fallbackNotifyHubert(userId, orderData, error);
      return { success: false, error };
    }
  } catch (e) {
    const error = 'POST /api/orders 失敗: ' + e.message;
    logger.error('[autoOrder] ' + error, { userId });
    await fallbackNotifyHubert(userId, orderData, error);
    return { success: false, error };
  }
}

function readXApiToken() {
  const candidates = [
    process.env.X_API_TOKEN,
    process.env.API_TOKEN,
  ].filter(Boolean);

  const tokenFile = process.env.X_API_TOKEN_FILE || process.env.API_TOKEN_FILE
    || '/home/clawuser/.config/chicken/secrets/api-token';
  try {
    if (fs.existsSync(tokenFile)) {
      const fileToken = fs.readFileSync(tokenFile, 'utf8').trim();
      if (fileToken) {
        logger.info('[autoOrder] X-API-Token 從檔案讀取', { path: tokenFile });
        candidates.push(fileToken);
      }
    }
  } catch (e) {
    logger.warn('[autoOrder] 讀 X-API-Token 失敗', { path: tokenFile, err: e.message });
  }

  const clientToken = (process.env.X_API_TOKEN || '').trim();
  if (clientToken) candidates.push(clientToken);

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function postOrder(payload, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(API_SERVER_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/api/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-API-Token': token,
        'X-Source': 'b_auto_confirm',
      },
      timeout: AUTO_CREATE_TIMEOUT_MS,
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if ((res.statusCode === 200 || res.statusCode === 201) && parsed.success) {
            resolve({ success: true, orderId: parsed.order_id || (parsed.data && parsed.data.order_id) });
          } else {
            resolve({ success: false, error: parsed.error || data.substring(0, 200) });
          }
        } catch (e) {
          reject(new Error('API 回傳解析失敗: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('POST /api/orders timeout')));
    req.write(body);
    req.end();
  });
}

async function fallbackNotifyHubert(userId, orderData, error) {
  try {
    await notifyHubert(
      '⚠️ 【B 方案自動建單失敗】請手動建單：\n' +
      '客戶 user_id: ' + userId + '\n' +
      '配送: ' + (orderData.delivery_date || '?') + ' ' + (orderData.time_slot || '?') + '\n' +
      '金額: NT$ ' + (orderData.total_amount || '?') + '\n' +
      '失敗原因: ' + error + '\n' +
      '請至 dashboard 手動建單 🙏',
      { type: 'autoOrder' },
    );
  } catch (e) {
    logger.error('[autoOrder] fallback 通知老闆也失敗', { err: e.message });
  }
}

module.exports = {
  isStrictConfirmation,
  triggerAutoOrder,
  readXApiToken,
};
