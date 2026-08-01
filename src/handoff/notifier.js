'use strict';

const logger = require('../utils/logger');
const https = require('https');
// P2-5：改用 src/config.js 介面，不自己 regex 解析 config.yaml
// 支援多租戶、js-yaml 缺失 fallback、與 src/ 其他模組一致
const { getLineBotToken, getNotifyOwnerUserId, isFeatureEnabled, getEmailConfig } = require('../config');
// P0 2026-07-17：Email 整合（Gmail 通知老闆的備援通道）
// 注意：用 emailNotifier.sendEmail 延遲查找（不要 destructure）— 讓測試能在 module load 之後
// 替換 sendEmail 函式（P0 mock pattern）
const emailNotifier = require('./emailNotifier');
const { PAYMENT_METHOD_LABELS } = emailNotifier;

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
 * Email 通知內容生成器（4 種 type 版型 v3 — 純文字精美、含完整重要欄位）
 * @param {string|object} message - 原始訊息（向後相容：純文字時仍可用）
 * @param {object} [options]
 * @param {string} [options.type='system'] - handoff | autoOrder | system | digest
 * @param {object} [options.metadata] - 完整資料（v3 新增，含用戶、訂單、品項、付款等欄位）
 * @returns {{subject: string, body: string}}
 */
function buildEmailContent(message, options = {}) {
  const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei', hour12: false }).replace(' ', ' ');
  const dashboardBase = process.env.DASHBOARD_URL || 'https://100.114.197.9:3000/admin';
  const dashboardUrl = options.metadata && options.metadata.order_id
    ? `${dashboardBase}?order=${encodeURIComponent(options.metadata.order_id)}`
    : dashboardBase;
  const type = options.type || 'system';
  const meta = options.metadata || {};
  const messageText = typeof message === 'string' ? message : JSON.stringify(message, null, 2);

  // v5 樣式：純文字大標題 + 分隔線 + emoji 中標題（移除 box chars）
  const divider = '═'.repeat(48);
  const sectionDivider = '─'.repeat(32);
  const title = (icon, label) => `${icon} 雞味研究所 — ${label}`;
  const sectionTitle = (icon, label) => `${icon} ${label}`;
  const field = (key, val, labelWidth = 10) => {
    const v = val || '—';
    const label = (key + '：').padEnd(labelWidth + 4, ' ');
    return `  ${label}${v}`;
  };

  // 輔助：解析 items JSON string
  const parseItems = (raw) => {
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const entries = Object.entries(obj).filter(([, v]) => v);
      if (entries.length === 0) return null;
      return entries.map(([k, v]) => `${k}×${v}`).join('、');
    } catch (e) {
      return null;
    }
  };

  // 輔助：金額格式化（加千分位逗號）
  const fmtMoney = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    return isNaN(num) ? String(n) : num.toLocaleString('en-US');
  };

  // 各版型生成器（v5：移除 box chars，用純文字大標題 + 分隔線 + emoji 中標題）
  if (type === 'handoff') {
    const triggerLabel = meta.trigger_label || meta.handoff_type || '轉真人';
    const subject = `【雞味研究所】🔔 轉真人通知 ${ts}`;
    const lines = [
      title('🔔', '轉真人通知'),
      divider,
      '',
      sectionTitle('📋', '案件資訊'),
      sectionDivider,
      field('類型', `handoff（${triggerLabel}）`),
      field('時間', ts),
      field('order_id', meta.order_id),
      '',
      sectionTitle('👤', '客戶資訊'),
      sectionDivider,
      field('名稱', meta.user_line_name),
      field('LINE ID', meta.user_line_id),
      field('電話', meta.user_phone),
      field('地址', meta.address),
      '',
      sectionTitle('💬', '客戶訊息'),
      sectionDivider,
      `  ${messageText || '（無）'}`,
    ];
    // 品項（如有）
    const chicken = parseItems(meta.chicken_items);
    const side = parseItems(meta.side_items);
    const extra = parseItems(meta.extra_items);
    if (chicken || side || extra) {
      lines.push('', sectionTitle('📦', '訂單品項'), sectionDivider);
      if (chicken) lines.push(`  🍗 雞肉：${chicken}`);
      if (side) lines.push(`  🥗 小菜：${side}`);
      if (extra) lines.push(`  ➕ 加購：${extra}`);
      lines.push(field('總盒數', meta.total_boxes));
    }
    // 退款 trigger（refund_request）：加「💸 退款資訊」section
    if (meta.trigger_type === 'refund_request' || meta.refund_amount) {
      lines.push('', sectionTitle('💸', '退款資訊'), sectionDivider);
      lines.push(field('退款金額', `NT$ ${fmtMoney(meta.refund_amount || meta.total_amount)}`));
      lines.push(field('退款原因', meta.refund_reason || meta.staff_notes || '—'));
      lines.push(field('原訂單 ID', meta.order_id));
    }
    // 地址確認 trigger（delivery_confirm_needed）：加「📍 地址確認」section
    if (meta.trigger_type === 'delivery_confirm_needed' || meta.address_check_needed) {
      lines.push('', sectionTitle('📍', '地址確認'), sectionDivider);
      lines.push(field('地址', meta.address));
      lines.push(field('判讀難度', meta.address_difficulty || '—'));
      lines.push(field('備註', meta.address_note || '—'));
    }
    // 付款（如有）
    if (meta.total_amount || meta.payment_method) {
      lines.push('', sectionTitle('💰', '付款資訊'), sectionDivider);
      lines.push(field('金額', `NT$ ${fmtMoney(meta.total_amount)}`));
      lines.push(field('付款方式', PAYMENT_METHOD_LABELS[meta.payment_method] || meta.payment_method));
      lines.push(field('付款狀態', meta.payment_status || 'pending'));
    }
    lines.push(
      '',
      divider,
      '👉 處理連結',
      `   ${dashboardUrl}`,
      '   → 請儘速登入 dashboard 處理',
    );
    return { subject, body: lines.join('\n') };
  }

  if (type === 'autoOrder') {
    const subject = `【雞味研究所】🤖 B 方案自動建單 ${ts}`;
    const lines = [
      title('🤖', 'B 方案自動建單'),
      divider,
      '',
      sectionTitle('✅', '建單結果'),
      sectionDivider,
      field('order_id', meta.order_id),
      field('狀態', meta.success === false ? '❌ 失敗' : '✅ 成功'),
      field('時間', ts),
      '',
      sectionTitle('👤', '客戶資訊'),
      sectionDivider,
      field('名稱', meta.user_line_name),
      field('LINE ID', meta.user_line_id),
      field('電話', meta.user_phone),
      field('地址', meta.address),
    ];
    // 品項
    const chicken = parseItems(meta.chicken_items);
    const side = parseItems(meta.side_items);
    const extra = parseItems(meta.extra_items);
    if (chicken || side || extra) {
      lines.push('', sectionTitle('🍗', '品項詳情'), sectionDivider);
      if (chicken) lines.push(`  🍗 雞肉：${chicken}`);
      if (side) lines.push(`  🥗 小菜：${side}`);
      if (extra) lines.push(`  ➕ 加購：${extra}`);
      lines.push(field('總盒數', meta.total_boxes));
    }
    // 配送 + 金額 + 付款
    lines.push(
      '', sectionTitle('📦', '配送資訊'), sectionDivider,
      field('配送日期', meta.delivery_date),
      field('時段', meta.time_slot),
      field('社區', meta.community),
      '', sectionTitle('💰', '金額明細'), sectionDivider,
      field('小計', `NT$ ${fmtMoney(meta.subtotal)}`),
      field('配送費', `NT$ ${fmtMoney(meta.delivery_fee)}`),
      field('總計', `NT$ ${fmtMoney(meta.total_amount)}`),
      field('付款方式', PAYMENT_METHOD_LABELS[meta.payment_method] || meta.payment_method),
      field('付款狀態', meta.payment_status || 'pending'),
    );
    if (meta.error || meta.failure_reason) {
      lines.push('', sectionTitle('⚠️', '錯誤訊息'), sectionDivider);
      lines.push('  ' + (meta.error || meta.failure_reason));
    }
    lines.push(
      '',
      divider,
      '👉 處理連結',
      `   ${dashboardUrl}`,
      '   → 請確認付款狀態 ✓',
    );
    return { subject, body: lines.join('\n') };
  }

  if (type === 'digest') {
    // digest 簡單版型（純文字，給 sendOrderDigest 用）
    const subject = `【雞味研究所】📊 訂單彙總 ${ts}`;
    const lines = [
      title('📊', '訂單彙總'),
      divider,
      '',
      `總筆數：${meta.total || messageText.length || '?'}`,
      '',
      messageText,
      '',
      divider,
      '👉 Dashboard',
      `   ${dashboardUrl}`,
    ];
    return { subject, body: lines.join('\n') };
  }

  // system 版型
  const subject = `【雞味研究所】⚙️ 系統通知 ${ts}`;
  const lines = [
    title('⚙️', '系統通知'),
    divider,
    '',
    sectionTitle('📋', '訊息內容'),
    sectionDivider,
    messageText,
  ];
  if (meta.context) {
    lines.push('', sectionTitle('🔍', 'Context'), sectionDivider, meta.context);
  }
  return { subject, body: lines.join('\n') };
}

/**
 * Email 通知（永遠觸發，與 LINE 並行；失敗不影響主流程）
 * @param {string|object} message
 * @param {object} [options]
 * @param {string} [options.type='system']
 * @returns {Promise<{success: boolean, error?: string, skipped?: boolean}>}
 */
async function sendEmailNotification(message, options = {}) {
  const emailCfg = getEmailConfig();
  const to = emailCfg && emailCfg.digest_to;
  if (!to) {
    logger.warn('[notifier] email.digest_to 未設定，跳過 Email 通知');
    return { success: false, skipped: true };
  }
  const { subject, body } = buildEmailContent(message, options);
  return emailNotifier.sendEmail({ to, subject, body });
}

/**
 * Email fallback（保留向後相容別名）
 * @deprecated 2026-07-18 v3 改用 sendEmailNotification（永遠觸發，不再只是 fallback）
 */
async function sendEmailFallback(message) {
  return sendEmailNotification(message, { type: 'system' });
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
// Round 33 Bug 1 (Hubert 2026-08-01 11:55)：Email throttle 避免 Gmail 判讀為 spam
let _lastEmailSentAt = 0;
const EMAIL_THROTTLE_MS = 5000; // 連續寄送最小間隔 5 秒

async function sendEmailWithThrottle(message, options) {
  const now = Date.now();
  if (_lastEmailSentAt > 0) {
    const elapsed = now - _lastEmailSentAt;
    if (elapsed < EMAIL_THROTTLE_MS) {
      const waitMs = EMAIL_THROTTLE_MS - elapsed;
      logger.info(`[notifier] Email throttle: 等待 ${waitMs}ms 避免 Gmail 判讀為 spam`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  const result = await sendEmailNotification(message, options);
  _lastEmailSentAt = Date.now();
  return result;
}

async function notifyHubert(message, options = {}) {
  // Round 33 Bug 1 (Hubert 2026-08-01 11:55)：測試階段不再用 LINE push，改為 channels: ['email']
  // 預設 ['line', 'email'] 維持向後相容，測試用戶通知、auto-create-order 失敗等呼叫點明確傳 channels: ['email']
  const channels = Array.isArray(options.channels) ? options.channels : ['line', 'email'];
  const results = {};

  if (channels.includes('line')) {
    results.line = await notifyHubertViaLine(message);
  }

  if (channels.includes('email')) {
    try {
      results.email = await sendEmailWithThrottle(message, options);
    } catch (e) {
      logger.warn('[notifier] Email 通知失敗', { err: e.message });
      results.email = { success: false, error: e.message };
    }
  }

  // 整體成功：指定 channels 中至少一邊成功即可
  const overallSuccess = Object.values(results).some((r) => r && r.success);

  if (!overallSuccess) {
    // 所有指定 channels 都失敗才 throw（保留向後相容：呼叫端 .catch 處理）
    const errMsg =
      Object.values(results).map((r) => r && r.error).filter(Boolean).join('; ') ||
      'notifyHubert failed (所有 channels 都失敗)';
    throw new Error(errMsg);
  }
  return { ...results, overallSuccess: true };
}

/**
 * 測試通知（發送測試訊息）
 * @returns {Promise<boolean>}
 */
async function testNotification() {
  // Round 33 Bug 1 (Hubert 11:55)：測試通知只走 Email，不推 LINE
  return notifyHubert('🔔 AI 客服測試通知 — 系統運作正常', { type: 'system', channels: ['email'] });
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
    return { success: false, error: 'LINE Bot Token not configured' };
  }
  if (!recipientUserId || typeof recipientUserId !== 'string') {
    logger.warn('sendTextMessage: recipientUserId 必填（非空字串）');
    return { success: false, error: 'recipientUserId 必填（非空字串）' };
  }

  const payload = JSON.stringify({
    to: recipientUserId,
    messages: [{ type: 'text', text }],
  });

  return new Promise((resolve) => {
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
          resolve({ success: true });
        } else {
          logger.error('LINE text push failed', { status: res.statusCode, body: data });
          resolve({ success: false, error: `LINE API returned ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => {
      logger.error('LINE text push error', { err: e.message });
      resolve({ success: false, error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * 通用 LINE Push Image 訊息（2026-07-16 P4 加）
 * 與 sendTextMessage 統一合約：回 {success, error}、不 throw、API 錯誤也是 resolve
 * @param {string} imageUrl - HTTPS 公開 URL（LINE 不接受本地檔）
 * @param {string} previewImageUrl - 縮圖 URL（可選，沒給就用原圖）
 * @param {string} recipientUserId - LINE user ID（接收者）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendImageMessage(imageUrl, previewImageUrl, recipientUserId) {
  const lineToken = getLineToken();
  if (!lineToken) {
    logger.warn('LINE Bot Token not configured, skipping image message');
    return { success: false, error: 'LINE Bot Token not configured' };
  }
  if (!imageUrl || !recipientUserId) {
    logger.warn('sendImageMessage: imageUrl 和 recipientUserId 必填');
    return { success: false, error: 'imageUrl 和 recipientUserId 必填' };
  }
  if (typeof recipientUserId !== 'string') {
    logger.warn('sendImageMessage: recipientUserId 必填（非空字串）');
    return { success: false, error: 'recipientUserId 必填（非空字串）' };
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

  return new Promise((resolve) => {
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
          resolve({ success: true });
        } else {
          logger.error('LINE image push failed', { status: res.statusCode, body: data, imageUrl });
          resolve({ success: false, error: `LINE API returned ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => {
      logger.error('LINE image push error', { err: e.message });
      resolve({ success: false, error: e.message });
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
  sendEmailNotification,
  sendEmailFallback,
  buildEmailContent,
  sendTextMessage,
  sendImageMessage,
  getJKOQrCodeUrl,
  getHubertLineUserId,
  testNotification,
};
