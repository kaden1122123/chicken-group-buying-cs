'use strict';

const { STATES, buildCancelResult } = require('./stateMachine');
const { textReply } = require('../utils/lineReply');
const { formatOrderSummary, formatCustomerReply } = require('../order/orderFormatter');

/**
 * CONFIRMING 狀態處理
 * 展示完整訂單摘要 + 總金額
 * 等待客戶回覆「確認」
 * 客戶有新問題 → 回到 AWAITING_INFO
 */

const CONFIRM_KEYWORDS = ['確認', 'ok', '好', '沒問題', '正確', '對', 'yes', 'confirm'];
const CANCEL_KEYWORDS = ['取消', '不要', '算了', '重新', '修改'];
const MODIFY_KEYWORDS = ['改', '修改', '換', '更正'];

/**
 * 判斷是否為確認回覆
 * @param {string} message
 * @returns {boolean}
 */
function isConfirmReply(message) {
  if (!message) return false;
  return CONFIRM_KEYWORDS.some((k) => message.includes(k));
}

/**
 * 判斷是否為取消回覆
 * @param {string} message
 * @returns {boolean}
 */
function isCancelReply(message) {
  if (!message) return false;
  return CANCEL_KEYWORDS.some((k) => message.includes(k));
}

/**
 * 判斷是否為修改意圖
 * @param {string} message
 * @returns {boolean}
 */
function isModifyIntent(message) {
  if (!message) return false;
  return MODIFY_KEYWORDS.some((k) => message.includes(k));
}

/**
 * 處理 CONFIRMING 狀態的訊息
 * @param {string} userId
 * @param {string} message
 * @param {object} orderData
 * @param {object} context
 * @returns {{ action: string, reply: object|null, newState: string, orderData: object, context: object }}
 */
function handleConfirming(userId, message, orderData, context) {
  if (isConfirmReply(message)) {
    return {
      action: 'confirmed',
      reply: textReply('收到！我現在提供付款方式给您：\n\n💳 付款方式說明：\n\n現金：送達時現場付款\n轉帳：銀行代碼007 / 帳號23257030422\nLINE Pay：請加老闆 LINE（ID：Willy0221）\n街口支付：請告知，我提供 QR Code\n\n請選擇您的付款方式並完成後回覆「已付款」或上傳截圖，謝謝！'),
      newState: STATES.AWAITING_PAYMENT,
      orderData,
      context: { ...context, intent_confirmed: true },
    };
  }

  if (isCancelReply(message)) {
    return {
      ...buildCancelResult(),
      context: {},
    };
  }

  if (isModifyIntent(message)) {
    // 回到 AWAITING_INFO，重新收集
    return {
      action: 'modify_requested',
      reply: textReply('好的，請告訴我您想修改的項目，我重新為您整理。'),
      newState: STATES.AWAITING_INFO,
      orderData,
      context: { ...context, awaitingField: null },
    };
  }

  // 客戶提出新問題，回到 AWAITING_INFO 處理
  return {
    action: 'new_input',
    reply: null, // 讓 awaitingInfo 處理
    newState: STATES.AWAITING_INFO,
    orderData,
    context: { ...context, awaitingField: null },
  };
}

/**
 * 構建訂單確認訊息
 * @param {object} orderData
 * @returns {object}
 */
function buildConfirmationMessage(orderData) {
  return textReply(formatCustomerReply(orderData));
}

module.exports = {
  isConfirmReply,
  isCancelReply,
  isModifyIntent,
  handleConfirming,
  buildConfirmationMessage,
};