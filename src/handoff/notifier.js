'use strict';

const https = require('https');
// P2-5：改用 src/config.js 介面，不自己 regex 解析 config.yaml
// 支援多租戶、js-yaml 缺失 fallback、與 src/ 其他模組一致
const { getLineBotToken, getNotifyOwnerUserId } = require('../config');

// 預設值（若 config 沒設定時使用，僅在開發環境有意義）
const DEFAULT_HUBERT_LINE_USER_ID = 'Uf56650056d35626deb64165926a26182';

function getHubertLineUserId() {
  return getNotifyOwnerUserId() || DEFAULT_HUBERT_LINE_USER_ID;
}

function getLineToken() {
  return getLineBotToken();
}

/**
 * 發送 LINE Push 通知到 Hubert
 * @param {string|object} message - 文字或 LINE message object
 * @returns {Promise<boolean>}
 */
async function notifyHubert(message) {
  const lineToken = getLineToken();
  if (!lineToken) {
    console.warn('LINE Bot Token not configured, skipping notification');
    return false;
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

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lineToken}`,
        'Content-Length': Buffer.byteLength(payloadStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          console.error('LINE notification failed:', res.statusCode, data);
          reject(new Error(`LINE API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error('LINE notification error:', e);
      reject(e);
    });

    req.write(payloadStr);
    req.end();
  });
}

/**
 * 測試通知（發送測試訊息）
 * @returns {Promise<boolean>}
 */
async function testNotification() {
  return notifyHubert('🔔 AI 客服測試通知 — 系統運作正常');
}

module.exports = {
  notifyHubert,
  testNotification,
};