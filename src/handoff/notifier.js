'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// 嘗試載入 config.yaml
let HUBERT_LINE_USER_ID = 'Uf56650056d35626deb64165926a26182';
let LINE_BOT_TOKEN = '';

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../../config.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      // 簡單解析 YAML（不依賴額外庫）
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('line_user_id')) {
          const match = line.match(/line_user_id:\s*"?([^"\n]+)"?/);
          if (match) HUBERT_LINE_USER_ID = match[1].trim();
        }
        if (line.includes('line_bot_token')) {
          const match = line.match(/line_bot_token:\s*"?([^"\n]+)"?/);
          if (match) LINE_BOT_TOKEN = match[1].trim();
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

loadConfig();

/**
 * 發送 LINE Push 通知到 Hubert
 * @param {string|object} message - 文字或 LINE message object
 * @returns {Promise<boolean>}
 */
async function notifyHubert(message) {
  if (!LINE_BOT_TOKEN) {
    console.warn('LINE Bot Token not configured, skipping notification');
    return false;
  }

  const messageText = typeof message === 'string' ? message : message.text || JSON.stringify(message);

  const payload = {
    to: HUBERT_LINE_USER_ID,
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
        'Authorization': `Bearer ${LINE_BOT_TOKEN}`,
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
  HUBERT_LINE_USER_ID,
  LINE_BOT_TOKEN,
};