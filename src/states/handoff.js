'use strict';

const logger = require('../utils/logger');
const { STATES, setHandoffOrderIndex } = require('./stateMachine');
const { textReply } = require('../utils/lineReply');
const { writeOrderWithRetry } = require('../order/csvWriter');
const { generatePendingOrderId } = require('../order/orderIdGenerator');
const { shouldTransfer } = require('../handoff/transferRules');
const { formatLINENotification } = require('../handoff/notificationFormat');
const { notifyHubert } = require('../handoff/notifier');
const { getHandoffCustomerReply } = require('../config');

// 預設轉真人回覆（若 config 沒設定時使用）
const DEFAULT_HANDOFF_CUSTOMER_REPLY = '目前老闆再忙，後續會再回覆您，請留意 LINE 通知，謝謝！';

// P3-emergency 2026-07-16：1 分鐘 debounce 防止 LINE push infinite loop
// 同 userId + 訊息 hash 1 分鐘內只 push 一次，保護 webhook retry / 客戶重複訊息
const PUSH_DEBOUNCE_MS = 60 * 1000; // 1 分鐘
const recentPushes = new Map(); // userId → { msgHash, ts }

function shouldDebouncePush(userId, userMessage) {
  const msgHash = require('crypto').createHash('md5').update(userMessage).digest('hex');
  const now = Date.now();
  const last = recentPushes.get(userId);
  if (last && last.msgHash === msgHash && (now - last.ts) < PUSH_DEBOUNCE_MS) {
    return true;
  }
  recentPushes.set(userId, { msgHash, ts: now });
  // 清理舊 entries（避免 memory leak）
  if (recentPushes.size > 500) {
    const cutoff = now - PUSH_DEBOUNCE_MS * 10;
    for (const [k, v] of recentPushes.entries()) {
      if (v.ts < cutoff) recentPushes.delete(k);
    }
  }
  return false;
}

/**
 * HUMAN_HANDOFF 狀態處理
 * 14 種條件（語意判斷，非關鍵字）
 * 流程：寫入 CSV → 回覆制式話術 → LINE Push 通知 Hubert
 */

/**
 * 處理轉真人請求
 * @param {string} userId
 * @param {string} userMessage
 * @param {object} orderData - 當前訂單資料（可為空）
 * @param {object} userProfile - { lineDisplayName, ... }
 * @param {object} [options] - 額外選項
 * @param {string} [options.reason] - 轉真人原因（例：'address_out_of_range'、'address_needs_confirmation'）
 *   會寫入 staff_notes，讓 Hubert 看到通知知道為什麼轉真人
 * @returns {{ action: string, reply: object|null, newState: string, orderData: object }}
 */
async function handleHandoff(userId, userMessage, orderData = {}, userProfile = {}, options = {}) {
  const handoffType = (await shouldTransfer(userMessage)).type || 'general_inquiry';
  const orderId = generatePendingOrderId();

  // P0 #2 (Bug B11): 註冊 orderId ↔ userId 反向索引,dashboard 解除轉真人時可從 orderId 取回 userId
  setHandoffOrderIndex(userId, orderId);

  // 決策 6：reason 寫入 staff_notes，Hubert 看通知知道為什麼轉真人
  // 與 src/rules/addressRule.js 的 reason 命名對齊（out_of_range / needs_confirmation）
  const reasonLabel = {
    out_of_range: '地址超出配送範圍',
    needs_confirmation: '配送範圍需人工確認',
  }[options.reason] || null;
  const initialStaffNotes = reasonLabel ? `原因：${reasonLabel}` : '';

  // 構建轉真人訂單資料
  const handoffOrderData = {
    order_id: orderId,
    created_at: new Date().toISOString(),
    user_line_name: userProfile.lineDisplayName || 'LINE用戶',
    user_phone: orderData.user_phone || '',
    address: orderData.address || '',
    delivery_date: orderData.delivery_date || '',
    time_slot: orderData.time_slot || '',
    chicken_items: orderData.chicken_items || {},
    side_items: orderData.side_items || {},
    extra_items: orderData.extra_items || {},
    subtotal: orderData.subtotal || 0,
    delivery_fee: orderData.delivery_fee || 0,
    total_amount: orderData.total_amount || 0,
    payment_method: orderData.payment_method || '',
    payment_status: 'pending',
    order_status: 'pending_handoff',
    staff_notes: initialStaffNotes,
    customer_notes: userMessage,
    customer_tags: '',
    handoff_type: handoffType,
    handoff_logged_at: new Date().toISOString(),
    handoff_resolved_at: '',
    source: 'line',
    intent_confirmed: false,
  };

  // Step 1: 寫入 CSV（安全閘）
  try {
    writeOrderWithRetry(handoffOrderData);
  } catch (e) {
    logger.error('Handoff CSV write failed', { err: e.message });
    handoffOrderData.staff_notes = 'CSV寫入失敗，請人工確認';
  }

  // Step 2: 回覆制式話術（從 config 讀取；若 config 未設定則用預設）
  const replyText = getHandoffCustomerReply() || DEFAULT_HANDOFF_CUSTOMER_REPLY;
  const customerReply = textReply(replyText);

  // Step 3: 通知 Hubert（Email only + 1 分鐘 debounce）
  // Round 34 Bug 4 (Hubert 2026-08-01 14:29)：LINE 月額度 500 限制，所有通知改 Email 避免爆量
  // P3-emergency 2026-07-16：1 分鐘 debounce 防止 push infinite loop
  // Round 33 already：Email 5s throttle（sendEmailWithThrottle）
  if (shouldDebouncePush(userId, userMessage)) {
    logger.warn(`[handoff] Push debounced for ${userId} (same message within 1 min)`);
  } else {
    const notification = formatLINENotification(handoffOrderData, userMessage);
    // Round 37.29 (Hubert 13:04) 修：channels 改為 ['line', 'email']（LINE push 為主 + Email 備援）
    // 之前只送 email，結果老闆在 LINE 端根本收不到「老闆通知」訊息 — 被誤判為「被吃」
    // 同時移除 silent catch — 改用 await 拿到結果，失敗時明確 log + 更新 staff_notes（可讓 Hubert 在 dashboard 看到狀態）
    notifyHubert(notification, { type: 'handoff', channels: ['line', 'email'] })
      .then((results) => {
        const lineOk = results.line && results.line.success;
        const emailOk = results.email && results.email.success;
        if (!lineOk && !emailOk) {
          logger.error('[handoff] LINE + Email 都失敗', {
            userId,
            line: results.line && results.line.error,
            email: results.email && results.email.error,
          });
          handoffOrderData.staff_notes = '⚠️ 老闆通知失敗：LINE=' + (results.line && results.line.error || 'unknown') + ', Email=' + (results.email && results.email.error || 'unknown');
        } else if (!lineOk) {
          logger.warn('[handoff] LINE 推送失敗（Email 已寄出）', { line: results.line && results.line.error });
        } else if (!emailOk) {
          logger.warn('[handoff] Email 通知失敗（LINE 已推）', { email: results.email && results.email.error });
        }
        try {
          writeOrderWithRetry(handoffOrderData); // 同步更新 staff_notes 狀態
        } catch (e2) {
          // ignore
        }
      })
      .catch((e) => {
        logger.error('[handoff] notifyHubert 完全失敗', { err: e.message, userId });
        handoffOrderData.staff_notes = '⚠️ 老闆通知完全失敗：' + e.message;
        try {
          writeOrderWithRetry(handoffOrderData);
        } catch (e2) { /* ignore */ }
      });
  }

  return {
    action: 'handoff_triggered',
    reply: customerReply,
    newState: STATES.HUMAN_HANDOFF,
    orderData: handoffOrderData,
  };
}

/**
 * 檢查是否應觸發轉真人
 * @param {string} message
 * @param {object} orderData
 * @returns {boolean}
 */
function checkHandoffTrigger(message, orderData) {
  // 先檢查訊息是否匹配轉真人條件
  if (shouldTransfer(message)) {
    return true;
  }

  // 檢查訂單金額是否異常（> NT$3,000）
  if (orderData.total_amount > 3000) {
    return true;
  }

  return false;
}

module.exports = {
  handleHandoff,
  checkHandoffTrigger,
};
