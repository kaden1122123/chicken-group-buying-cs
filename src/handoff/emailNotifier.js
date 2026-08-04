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
// const path = require('path'); // unused 2026-07-25 Round 26 #2 lint cleanup
const logger = require('../utils/logger');
const { isFeatureEnabled, getEmailConfig } = require('../config');

// XDG secrets 標準位置
const CREDENTIALS_PATH = '/home/clawuser/.config/chicken/secrets/gmail-credentials.json';
const TOKEN_PATH = '/home/clawuser/.config/chicken/secrets/gmail-token.json';

// Gmail API 需要的 scope（只送件，不讀取）
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// 付款方式中文標籤（Hubert 04:05 要求：現金；轉帳；街口支付...）
// notifier.js 與 formatOrderDigest 都會用
const PAYMENT_METHOD_LABELS = {
  cash: '現金',
  transfer: '轉帳',
  jko: '街口支付',
  linepay: 'LINE Pay',
};

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

  // Round 37 P0 (Hubert 2026-08-03 21:19)：測試環境必須擋下真實 Gmail 寄信
  // guard 位置：在 feature flag + empty check 後、getGmailClient() 前
  // 避免 token 檢查先 throw 干擾測試；保留既有 mock 測試的業務邏輯
  if (process.env.NODE_ENV === 'test' || process.env.CHICKEN_TEST_NO_SEND === '1') {
    logger.info('[emailNotifier] TEST MODE: stub Gmail send (no real API call)', { to, subject });
    return { success: true, messageId: 'test-stub-' + Date.now(), test: true };
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
 * 格式化訂單彙總（純文字精美版 v3 — 分組、重要欄位全加）
 */
function formatOrderDigest(orders, type = 'daily') {
  const _ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei', hour12: false }).replace(' ', ' '); // unused 2026-07-25 Round 26 #2 lint cleanup（_ts 是 placeholder）
  const dateStr = new Date().toISOString().slice(0, 10);
  const typeLabel = type === 'daily' ? '今日' : type === 'weekly' ? '本週' : '彙總';

  // 統計
  const total = orders.length;
  const confirmed = orders.filter((o) => o.order_status === 'confirmed').length;
  const pendingHandoff = orders.filter((o) => o.order_status === 'pending_handoff').length;
  const pending = orders.filter((o) => o.order_status === 'pending').length;
  const totalAmount = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const avgAmount = total > 0 ? Math.round(totalAmount / total) : 0;
  const fmtMoney = (n) => (n || 0).toLocaleString('en-US');

  // 各付款方式分佈
  const byPayment = {};
  orders.forEach((o) => {
    const p = o.payment_method || 'unknown';
    if (!byPayment[p]) byPayment[p] = { count: 0, amount: 0 };
    byPayment[p].count += 1;
    byPayment[p].amount += Number(o.total_amount) || 0;
  });

  const lines = [
    `📊 雞味研究所 — ${typeLabel}訂單彙總`,
    '═'.repeat(40),
    '',
    `日期: ${dateStr}`,
    '',
    '📈 統計',
    '─'.repeat(40),
    `  總筆數:     ${total} 筆`,
    `  已完成:     ${confirmed} 筆${total > 0 ? `（${Math.round(confirmed / total * 100)}%）` : ''}`,
    `  待處理:     ${pending + pendingHandoff} 筆（pending: ${pending}, pending_handoff: ${pendingHandoff}）`,
    `  總金額:     NT$ ${fmtMoney(totalAmount)}`,
    `  平均金額:   NT$ ${fmtMoney(avgAmount)}`,
    '',
    '💰 各付款方式分佈',
    '─'.repeat(40),
  ];
  if (Object.keys(byPayment).length === 0) {
    lines.push('  （無資料）');
  } else {
    Object.entries(byPayment).forEach(([method, { count, amount }]) => {
      const label = PAYMENT_METHOD_LABELS[method] || method;
      lines.push(`  ${label.padEnd(8, ' ')}  ${count} 筆（NT$ ${fmtMoney(amount)}）`);
    });
  }

  // 訂單清單（分組：待處理、已完成、其他）
  const groups = [
    { title: '待處理', items: orders.filter((o) => ['pending', 'pending_handoff'].includes(o.order_status)), icon: '⚠️' },
    { title: '已完成', items: orders.filter((o) => o.order_status === 'confirmed'), icon: '✅' },
    { title: '其他', items: orders.filter((o) => !['pending', 'pending_handoff', 'confirmed'].includes(o.order_status)), icon: '📦' },
  ];

  groups.forEach(({ title, items, icon }) => {
    if (items.length === 0) return;
    lines.push('', `${icon} ${title}（${items.length} 筆）`, '─'.repeat(40));
    items.forEach((o, i) => {
      const methodLabel = PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method || '?';
      lines.push(
        `  ${(i + 1 + '.').padEnd(4, ' ')}${(o.order_id || '?').padEnd(20, ' ')} | ${(o.user_line_name || '?').padEnd(10, ' ')} | ${(o.delivery_date || '?').padEnd(11, ' ')} ${(o.time_slot || '?').padEnd(3, ' ')} | ${methodLabel.padEnd(8, ' ')} | NT$${fmtMoney(o.total_amount).padEnd(6, ' ')} | ${o.order_status || '?'}`,
      );
    });
  });

  if (total === 0) {
    lines.push('', '（今日無訂單）');
  }

  lines.push(
    '',
    '═'.repeat(40),
    '👉 Dashboard',
    '   https://100.114.197.9:3000/admin',
  );
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
  PAYMENT_METHOD_LABELS,
};
