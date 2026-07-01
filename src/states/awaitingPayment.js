'use strict';

// 時區統一設定（Session G.2）
require('../utils/timezone');

const logger = require('../utils/logger');
const { STATES, buildCancelResult } = require('./stateMachine');
const { textReply } = require('../utils/lineReply');
const { writeOrderWithRetry } = require('../order/csvWriter');
const { generateOrderId } = require('../order/orderIdGenerator');
const { getPaymentConfig, isFeatureEnabled } = require('../config');

/**
 * AWAITING_PAYMENT 狀態處理
 * 現金：直接完成 → COMPLETED
 * 轉帳/街口：等待截圖，收到 → COMPLETED（標記 pending）
 * LINE Pay：提供老闆 LINE ID（從 config.payment.linepay.line_id 讀）→ COMPLETED
 */

const PAYMENT_CONFIRM_KEYWORDS = ['已轉帳', '已付款', '轉了', '付了', '轉帳完成', '付款完成', 'ok', '好'];
const PAYMENT_CANCEL_KEYWORDS = ['取消', '不要', '算了'];

/**
 * 判斷是否為付款確認
 * @param {string} message
 * @returns {boolean}
 */
function isPaymentConfirmed(message) {
  if (!message) return false;
  return PAYMENT_CONFIRM_KEYWORDS.some((k) => message.includes(k));
}

/**
 * 判斷是否為取消
 * @param {string} message
 * @returns {boolean}
 */
function isPaymentCancel(message) {
  if (!message) return false;
  return PAYMENT_CANCEL_KEYWORDS.some((k) => message.includes(k));
}

/**
 * 處理 AWAITING_PAYMENT 狀態的訊息
 * @param {string} userId
 * @param {string} message
 * @param {object} orderData
 * @param {object} context
 * @returns {{ action: string, reply: object|null, newState: string, orderData: object }}
 */
function handleAwaitingPayment(userId, message, orderData, context) {
  const paymentMethod = orderData.payment_method;

  if (isPaymentCancel(message)) {
    return buildCancelResult();
  }

  if (isPaymentConfirmed(message) || context.paymentProofReceived) {
    // 現金直接完成，轉帳/街口/LINE Pay 標記 pending
    const updatedOrderData = { ...orderData };
    if (paymentMethod === 'cash') {
      updatedOrderData.payment_status = 'confirmed';
    } else {
      updatedOrderData.payment_status = 'pending';
    }

    // 寫入 CSV
    if (!updatedOrderData.order_id) {
      updatedOrderData.order_id = generateOrderId();
    }
    updatedOrderData.created_at = new Date().toISOString();
    updatedOrderData.order_status = 'new';
    updatedOrderData.source = 'line';
    updatedOrderData.intent_confirmed = true;

    try {
      writeOrderWithRetry(updatedOrderData);
    } catch (e) {
      // 寫入失敗仍繼續，但不阻断流程
      logger.error('CSV write failed', { err: e.message });
    }

    return {
      action: 'payment_received',
      reply: textReply('感謝您的訂購！🍗\n\n我們已收到您的付款確認，會在配送前與您聯繫。\n\n祝您用餐愉快！'),
      newState: STATES.COMPLETED,
      orderData: updatedOrderData,
    };
  }

  // 尚未確認付款
  let paymentInstructions = '';
  // Session D3-4/D3-5：銀行帳號與 LINE Pay ID 從 config 讀（替代 hardcode）
  // 不設 default value：chicken.yaml 必須有這些欄位，fail-fast 提醒設定錯誤
  const paymentConfig = getPaymentConfig();
  const bankCode = paymentConfig.transfer.bank_code;
  const bankAccount = paymentConfig.transfer.account;
  const linepayId = paymentConfig.linepay.line_id;
  // Session D4-2：檢查 feature flag，關閉的付款方式提示客戶選別的
  const paymentEnabledMap = {
    cash: isFeatureEnabled('payment.cash.enabled'),
    transfer: isFeatureEnabled('payment.transfer.enabled'),
    jko: isFeatureEnabled('payment.jko.enabled'),
    linepay: isFeatureEnabled('payment.linepay.enabled') && isFeatureEnabled('official.line_pay.enabled'),
  };
  if (paymentMethod in paymentEnabledMap && !paymentEnabledMap[paymentMethod]) {
    return {
      reply: textReply('抱歉，這個付款方式目前暫停服務，請選擇其他付款方式（現金 / 轉帳 / 街口 / LINE Pay）。'),
      newState: STATES.AWAITING_PAYMENT,
    };
  }
  switch (paymentMethod) {
    case 'cash':
      paymentInstructions = '請於收到商品時以現金付款給外送人員。';
      break;
    case 'transfer':
      paymentInstructions = `請轉帳至：銀行代碼${bankCode} / 帳號${bankAccount}\n轉帳完成後回覆「已轉帳」並截圖，謝謝！`;
      break;
    case 'jko':
      paymentInstructions = '請使用街口支付掃描 QR Code，完成後回覆「已付款」，謝謝！';
      break;
    case 'linepay':
      paymentInstructions = `請加入老闆 LINE（ID：${linepayId}）進行 LINE Pay 付款，完成後回覆「已付款」，謝謝！`;
      break;
    default:
      paymentInstructions = '請選擇付款方式並完成後回覆「已付款」，謝謝！';
  }

  return {
    action: 'awaiting_payment',
    reply: textReply(paymentInstructions),
    newState: STATES.AWAITING_PAYMENT,
    orderData,
  };
}

module.exports = {
  isPaymentConfirmed,
  isPaymentCancel,
  handleAwaitingPayment,
};
