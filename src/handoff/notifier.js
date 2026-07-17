'use strict';

const logger = require('../utils/logger');
const https = require('https');
// P2-5：改用 src/config.js 介面，不自己 regex 解析 config.yaml
// 支援多租戶、js-yaml 缺失 fallback、與 src/ 其他模組一致
const { getLineBotToken, getNotifyOwnerUserId, isFeatureEnabled, getEmailConfig } = require('../config');
// P0 2026-07-17：Email 整合（Gmail 通知老闆的備援通道）
const { sendEmail } = require('./emailNotifier');

// 預設值（若 config 沒設定時使用，僅在開發環境有意義）
const DEFAULT_HUBERT_LINE_USER_ID = 'Uf56650056d35626deb64165926a26182';

function getHubertLineUserId() {
  return getNotifyOwnerUserId() || DEFAULT_HUBERT_LINE_USER_ID;
}

function getLineToken() {
  return getLineBotToken();
}

/**
 * 內部 LINE Push 函數（不 throw，return { success, error }）
 * notifyHubert 內部呼叫，並可被重用於測試
 * @param {string|object} message
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function notifyHubertViaLine(message) {
  // Session D4-4：handoff.notify_owner.enabled flag 檢查
  // chicken.yaml 的 handoff.notify_owner.enabled 控制是否通知 Hubert
  // 未啟用時跳過（return { success: false }），不丟錯誤
  if (!isFeatureEnabled('handoff.notify_owner.enabled')) {
    logger.warn('[notifier] handoff.notify_owner.enabled = false，跳過通知 Hubert');
    return { success: false, error: 'handoff.notify_owner.enabled = false' };
  }
  const lineToken = getLineToken();
  if (!lineToken) {
    logger.warn('LINE Bot Token not configured, skipping notification');
    return { success: false, error: 'LINE Bot Token not configured' };
  }

  const messageText = typeof message === 'string' ? message : message.text || JSON.stringify(message);

  const payload = {
    to: getHubertLineUserId(),
    messages: [
      {
        type: 'text',
        text: messageText,
      },
    ],
  };

  const payloadStr = JSON.stringify(payload);

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
        'Content-Length': Buffer.byteLength(payloadStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true });
        } else {
          logger.error('LINE notification failed', { status: res.statusCode, body: data });
          resolve({ success: false, error: `LINE API returned ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => {
      logger.error('LINE notification error', { err: e.message });
      resolve({ success: false, error: e.message });
    });

    req.write(payloadStr);
    req.end();
  });
}

/**
 * Email fallback（LINE push 失敗時的備援通道）
 * @param {string|object} message
 * @returns {Promise<{success: boolean, error?: string, skipped?: boolean}>}
 */
async function sendEmailFallback(message) {
  const emailCfg = getEmailConfig();
  const to = emailCfg && emailCfg.digest_to;
  if (!to) {
    logger.warn('[notifier] email.digest_to 未設定，跳過 Email fallback');
    return { success: false, skipped: true };
  }
  const messageText = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
  const subject = '【雞味研究所】客服通知 ' + new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  return sendEmail({ to, subject, body: messageText });
}

/**
 * 發送 LINE Push 通知到 Hubert（P0 2026-07-17 加 Email fallback）
 *
 * 設計：
 *   - LINE 為主通道（低延遲、即時）
 *   - LINE 失敗自動 Email fallback（LINE 額度 500/月限制備援）
 *   - options.urgent = true 時強制 LINE + Email 並行（緊急 handoff 用）
 *
 * 向後相容：
 *   - 舊呼叫 notifyHubert(message) 仍可正常運作（行為不變）
 *   - 舊呼叫 notifyHubert(message).catch(...) 仍能處理失敗（throw 行為保留）
 *
 * @param {string|object} message - 文字或 LINE message object
 * @param {object} [options]
 * @param {boolean} [options.urgent=false] - 強制 LINE + Email 並行
 * @returns {Promise<boolean>}
 */
async function notifyHubert(message, options = {}) {
  const lineResult = await notifyHubertViaLine(message);

  // Email fallback（urgent 或 LINE 失敗時自動觸發）
  if (options.urgent || !lineResult.success) {
    sendEmailFallback(message).catch((e) =>
      logger.warn('[notifier] Email fallback 失敗', { err: e.message }),
    );
  }

  // 向後相容：原行為是失敗時 reject（呼叫端 .catch 處理）
  if (!lineResult.success) {
    throw new Error(lineResult.error || 'LINE push failed');
  }
  return true;
}

/**
 * 測試通知（發送測試訊息）
 * @returns {Promise<boolean>}
 */
async function testNotification() {
  return notifyHubert('🔔 AI 客服測試通知 — 系統運作正常');
}

/**
 * 通用 LINE Push Text 訊息（2026-07-16 P4 加）
 * @param {string} text - 訊息文字
 * @param {string} recipientUserId - LINE user ID（接收者）
 * @returns {Promise<boolean>}
 */
async function sendTextMessage(text, recipientUserId) {
  const lineToken = getLineToken();
  if (!lineToken) {
    logger.warn('LINE Bot Token not configured, skipping text message');
    return false;
  }

  const payload = JSON.stringify({
    to: recipientUserId,
    messages: [{ type: 'text', text }],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          logger.error('LINE text push failed', { status: res.statusCode, body: data });
          reject(new Error(`LINE API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      logger.error('LINE text push error', { err: e.message });
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * 通用 LINE Push Image 訊息（2026-07-16 P4 加）
 * @param {string} imageUrl - HTTPS 公開 URL（LINE 不接受本地檔）
 * @param {string} previewImageUrl - 縮圖 URL（可選，沒給就用原圖）
 * @param {string} recipientUserId - LINE user ID（接收者）
 * @returns {Promise<boolean>}
 */
async function sendImageMessage(imageUrl, previewImageUrl, recipientUserId) {
  const lineToken = getLineToken();
  if (!lineToken) {
    logger.warn('LINE Bot Token not configured, skipping image message');
    return false;
  }
  if (!imageUrl || !recipientUserId) {
    logger.warn('sendImageMessage: imageUrl 和 recipientUserId 必填');
    return false;
  }

  const payload = JSON.stringify({
    to: recipientUserId,
    messages: [
      {
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: previewImageUrl || imageUrl,
      },
    ],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          logger.error('LINE image push failed', { status: res.statusCode, body: data, imageUrl });
          reject(new Error(`LINE API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      logger.error('LINE image push error', { err: e.message });
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * 取得街口支付 QR code URL（2026-07-16 P4 加）
 * 從 process.env.JKO_QR_CODE_URL 或 chicken.yaml 讀取
 * @returns {string|null} HTTPS URL 或 null（未設定）
 */
function getJKOQrCodeUrl() {
  // 優先 env var（OpenClaw exec 不 redact URL）
  if (process.env.JKO_QR_CODE_URL) {
    return process.env.JKO_QR_CODE_URL;
  }
  // fallback config（從 getPaymentConfig 讀 qr_code_url）
  try {
    const { getPaymentConfig } = require('../config');
    const jkoConfig = getPaymentConfig().jko;
    return (jkoConfig && jkoConfig.qr_code_url) || null;
  } catch (e) {
    logger.warn('getJKOQrCodeUrl: 無法讀取 config', { err: e.message });
    return null;
  }
}

module.exports = {
  notifyHubert,
  notifyHubertViaLine,
  sendEmailFallback,
  sendTextMessage,
  sendImageMessage,
  getJKOQrCodeUrl,
  testNotification,
};
