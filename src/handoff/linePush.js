'use strict';

/**
 * src/handoff/linePush.js
 * Round 40 (Hubert 14:40) Step 4 — Customer-facing LINE Push 模組
 *
 * 用途:
 *   - 客戶完成付款/出貨/取消/核帳失敗 → 推送 LINE 訊息給客戶
 *   - 與 src/handoff/notifier.js 互補:notifier.js 是 manager-only(Hubert),
 *     linePush.js 是 customer-facing(客戶)
 *
 * 與既有架構整合:
 *   - LINE_BOT_TOKEN 從 L3 runtime 環境變數或 ~/.config/chicken/secrets/line-bot-token 讀
 *   - 透過 LINE Messaging API push 訊息(https://api.line.me/v2/bot/message/push)
 *   - 不 throw 阻斷主流程(訂單狀態更新成功,push 失敗 log warn)
 *
 * 安全閘:
 *   - lineUserId 必填
 *   - LINE_BOT_TOKEN 未設定 → silent skip(向後相容)
 *   - HTTP error → catch + log warn,不影響 caller
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const LINE_API_HOST = 'api.line.me';
const LINE_PUSH_PATH = '/v2/bot/message/push';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * 取得 LINE Bot Token
 * 優先順序:LINE_BOT_TOKEN 環境變數 > L3 runtime secrets 檔案
 */
function getLineBotToken() {
  if (process.env.LINE_BOT_TOKEN) {
    return process.env.LINE_BOT_TOKEN;
  }
  try {
    // L3 runtime secrets(由 OpenClaw 注入)
    const secretPath = '/home/clawuser/.config/chicken/secrets/line-bot-token';
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (e) {
    logger.warn('[linePush] 讀 LINE_BOT_TOKEN 失敗:', e.message);
  }
  return null;
}

/**
 * HTTPS POST helper
 */
function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: { ...headers, 'Content-Length': bodyBuf.length },
      timeout: REQUEST_TIMEOUT_MS,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ statusCode: 200, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('LINE push timeout')));
    req.write(bodyBuf);
    req.end();
  });
}

/**
 * Push 純文字訊息給客戶
 * @param {string} lineUserId - 客戶 LINE user ID
 * @param {string} message - 訊息內容
 * @returns {Promise<{success: boolean, lineUserId: string}>}
 */
async function pushToCustomer(lineUserId, message) {
  if (!lineUserId) {
    throw new Error('[linePush] pushToCustomer: lineUserId 必填');
  }
  if (!message || typeof message !== 'string') {
    throw new Error('[linePush] pushToCustomer: message 必填且為字串');
  }
  const token = getLineBotToken();
  if (!token) {
    logger.warn('[linePush] LINE_BOT_TOKEN 未設定,跳過 push', { lineUserId });
    return { success: false, reason: 'no_token', lineUserId };
  }
  const body = JSON.stringify({
    to: lineUserId,
    messages: [{ type: 'text', text: message }],
  });
  const result = await httpsPost(
    LINE_API_HOST,
    LINE_PUSH_PATH,
    body,
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  );
  logger.info('[linePush] push 成功', { lineUserId, messageLength: message.length });
  return { success: true, lineUserId, statusCode: result.statusCode };
}

/**
 * 安全 push(catch 錯誤 + log,不 throw 阻斷 caller)
 * 用於 dashboard endpoint / csvWriter 等不希望 push 失敗影響主流程的場景
 * @param {string} lineUserId
 * @param {string} message
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function safePushToCustomer(lineUserId, message) {
  try {
    return await pushToCustomer(lineUserId, message);
  } catch (e) {
    logger.warn('[linePush] push 失敗(已 catch,不影響主流程)', {
      lineUserId,
      err: e.message,
    });
    return { success: false, error: e.message, lineUserId };
  }
}

module.exports = {
  pushToCustomer,
  safePushToCustomer,
  getLineBotToken,
};
