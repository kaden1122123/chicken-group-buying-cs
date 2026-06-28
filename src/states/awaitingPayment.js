'use strict';

const { STATES, buildCancelResult } = require('./stateMachine');
const { textReply } = require('../utils/lineReply');
const { formatThankYou } = require('../order/orderFormatter');
const { writeOrder } = require('../order/csvWriter');
const { generateOrderId } = require('../order/orderIdGenerator');

/**
 * AWAITING_PAYMENT 狀態處理
 * 現金：直接完成 → COMPLETED
 * 轉帳/街口：等待截圖，收到 → COMPLETED（標記 pending）
 * LINE Pay：提供 Willy0221 → COMPLETED
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
      writeOrder(updatedOrderData);
    } catch (e) {
      // 寫入失敗仍繼續，但不阻断流程
      console.error('CSV write failed:', e);
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
  switch (paymentMethod) {
    case 'cash':
      paymentInstructions = '請於收到商品時以現金付款給外送人員。';
      break;
    case 'transfer':
      paymentInstructions = '請轉帳至：銀行代碼007 / 帳號23257030422\n轉帳完成後回覆「已轉帳」並截圖，謝謝！';
      break;
    case 'jko':
      paymentInstructions = '請使用街口支付掃描 QR Code，完成後回覆「已付款」，謝謝！';
      break;
    case 'linepay':
      paymentInstructions = '請加入老闆 LINE（ID：Willy0221）進行 LINE Pay 付款，完成後回覆「已付款」，謝謝！';
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
