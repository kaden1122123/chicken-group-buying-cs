'use strict';

/**
 * emailNotifier.js — Gmail API 通知模組
 *
 * 用途：通知老闆的備援通道，當 LINE push 額滿或失敗時仍能送達。
 * 與 src/handoff/notifier.js 的 notifyHubert 並行觸發，兩者獨立失敗互不影響。
 *
 * 認證：OAuth 2.0 user credentials（Desktop app type）
 *   - credentials.json（client_id + client_secret）→ XDG secrets
 *   - token.json（refresh_token + access_token + expiry）→ XDG secrets
 *
 * 觸發：
 *   - sendEmail({ to, subject, body })：單封純文字 email
 *   - sendOrderDigest({ orders, type }): 訂單彙總日報/週報
 *
 * Session P0（2026-07-17 啟動）：雞味客服 Gmail 整合
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { isFeatureEnabled, getEmailConfig } = require('../config');

// XDG secrets 標準位置
const CREDENTIALS_PATH = '/home/clawuser/.config/chicken/secrets/gmail-credentials.json';
const TOKEN_PATH = '/home/clawuser/.config/chicken/secrets/gmail-token.json';

// Gmail API 需要的 scope（只送件，不讀取）
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// 延遲載入 googleapis（測試環境若沒裝也可 import，但 sendEmail 會 fail gracefully）
let _googleapis = null;
function loadGoogleapis() {
  if (_googleapis === null) {
    try {
      _googleapis = require('googleapis').google;
    } catch (e) {
      logger.warn('[emailNotifier] googleapis 未安裝，請跑 npm install googleapis');
      _googleapis = false;
    }
  }
  return _googleapis;
}

/**
 * 讀取 OAuth credentials.json
 * 支援 installed (Desktop app) 與 web (Web application) 兩種格式
 */
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`找不到 Gmail credentials: ${CREDENTIALS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

/**
 * 建立 OAuth2 client（不帶 token）
 */
function getOAuth2Client() {
  const google = loadGoogleapis();
  if (!google) {
    throw new Error('googleapis 套件未安裝，請跑 npm install googleapis');
  }
  const credentials = loadCredentials();
  // Desktop app = "installed", Web application = "web"
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;
  if (!client_id || !client_secret) {
    throw new Error('credentials.json 缺少 client_id 或 client_secret');
  }
  // Desktop app 預設 redirect_uri 是 "http://localhost"（out-of-band flow 已被淘汰）
  // 用 credentials 裡的 redirect_uris[0]，或 fallback 到 localhost:8765
  const redirectUri = (redirect_uris && redirect_uris[0]) || 'http://localhost:8765';
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

/**
 * 讀取已存的 token
 */
function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

/**
 * 儲存 token（mode 600）
 */
function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  fs.chmodSync(TOKEN_PATH, 0o600);
}

/**
 * 取得帶有自動 refresh 機制的 Gmail client
 * 若 access_token 過期會自動用 refresh_token 換新，並存回 TOKEN_PATH
 */
async function getGmailClient() {
  const google = loadGoogleapis();
  if (!google) {
    throw new Error('googleapis 套件未安裝');
  }
  const oauth2Client = getOAuth2Client();
  const token = loadToken();
  if (!token) {
    throw new Error(
      `找不到 Gmail token: ${TOKEN_PATH}。請跑 node scripts/gmail-auth.js 授權`,
    );
  }
  oauth2Client.setCredentials(token);

  // 自動 refresh handler：若 refresh_token 被換新，存回 TOKEN_PATH
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      const merged = { ...token, ...newTokens };
      try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
        fs.chmodSync(TOKEN_PATH, 0o600);
        logger.info('[emailNotifier] refresh_token 已更新');
      } catch (e) {
        logger.warn('[emailNotifier] 寫入新 refresh_token 失敗', { err: e.message });
      }
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * 將 MIME 訊息編碼成 Gmail API 用的 base64url
 */
function buildRawMessage({ to, subject, body }) {
  // Subject 用 RFC 2047 base64 編碼（支援中文）
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const lines = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 寄一封純文字 email
 * @param {object} options
 * @param {string} options.to - 收件者 email
 * @param {string} options.subject - 主旨
 * @param {string} options.body - 內文（純文字）
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, skipped?: boolean}>}
 */
async function sendEmail({ to, subject, body }) {
  // 檢查 email.enabled flag
  if (!isFeatureEnabled('email.enabled')) {
    logger.warn('[emailNotifier] email.enabled = false，跳過寄信');
    return { success: false, skipped: true };
  }
  if (!to || !subject || !body) {
    return { success: false, error: 'to/subject/body 不可為空' };
  }

  try {
    const gmail = await getGmailClient();
    const raw = buildRawMessage({ to, subject, body });
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    logger.info('[emailNotifier] 寄信成功', { to, subject, messageId: result.data.id });
    return { success: true, messageId: result.data.id };
  } catch (e) {
    logger.error('[emailNotifier] 寄信失敗', { err: e.message, to, subject });
    return { success: false, error: e.message };
  }
}

/**
 * 格式化訂單彙總（純文字）
 */
function formatOrderDigest(orders, type = 'daily') {
  const typeLabel = type === 'daily' ? '今日' : type === 'weekly' ? '本週' : '彙總';
  const dateStr = new Date().toISOString().slice(0, 10);
  const lines = [
    `== 雞味研究所 ${typeLabel}訂單彙總 (${dateStr}) ==`,
    '',
    `總筆數: ${orders.length}`,
    `已完成: ${orders.filter((o) => o.order_status === 'confirmed').length}`,
    `待處理: ${orders.filter((o) => o.order_status === 'pending_handoff').length}`,
    '',
    '--- 訂單清單 ---',
  ];
  if (orders.length === 0) {
    lines.push('（無訂單）');
  } else {
    orders.forEach((o, i) => {
      lines.push(
        `${i + 1}. ${o.delivery_date || '?'} ${o.time_slot || '?'} | ${o.user_line_name || '?'} | NT$${o.total_amount || '?'} | ${o.payment_method || '?'} | ${o.order_status || '?'}`,
      );
    });
  }
  return lines.join('\n');
}

/**
 * 寄訂單彙總（給 digest_to）
 */
async function sendOrderDigest({ orders, type = 'daily' }) {
  const emailCfg = getEmailConfig();
  const to = emailCfg && emailCfg.digest_to;
  if (!to) {
    return { success: false, error: 'chicken.yaml email.digest_to 未設定' };
  }
  const typeLabel = type === 'daily' ? '今日訂單彙總' : type === 'weekly' ? '本週訂單彙總' : '訂單彙總';
  const subject = `【雞味研究所】${typeLabel} (${new Date().toISOString().slice(0, 10)})`;
  const body = formatOrderDigest(orders, type);
  return sendEmail({ to, subject, body });
}

module.exports = {
  // 主要 API
  sendEmail,
  sendOrderDigest,
  formatOrderDigest,
  // OAuth setup 工具（給 scripts/gmail-auth.js 用）
  getOAuth2Client,
  loadCredentials,
  loadToken,
  saveToken,
  buildRawMessage,
  // 常數（給測試用）
  SCOPES,
  CREDENTIALS_PATH,
  TOKEN_PATH,
};
