'use strict';

const { STATES } = require('./stateMachine');
const { textReply } = require('../utils/lineReply');
const { formatThankYou } = require('../order/orderFormatter');
const { writeOrder } = require('../order/csvWriter');
const { generateOrderId } = require('../order/orderIdGenerator');

/**
 * COMPLETED 狀態處理
 * 寫入 CSV（order_id, created_at, 所有欄位）
 * 發送感謝訊息
 * 回到 IDLE
 */

/**
 * 處理 COMPLETED 狀態（新訂單意圖）
 * @param {string} userId
 * @param {string} message
 * @param {object} orderData
 * @param {object} context
 * @returns {{ action: string, reply: object|null, newState: string }}
 */
function handleCompleted(userId, message, orderData, context) {
  // 檢查是否為新訂購意圖
  const { isOrderIntent } = require('./idle');

  if (isOrderIntent(message)) {
    return {
      action: 'new_order',
      reply: textReply('感謝您上次訂購！想再次訂購的朋友請提供以下資訊：\n\n📌 訂購資訊\n地址：（完整地址）\n姓名：\n電話：\n品項：\n日期：\n時段：上午/下午\n付款方式：'),
      newState: STATES.AWAITING_INFO,
    };
  }

  // 感謝訊息已發送，不再主動回覆
  return {
    action: 'completed_idle',
    reply: null,
    newState: STATES.COMPLETED,
  };
}

/**
 * 執行完成流程（寫入 CSV + 感謝訊息）
 * @param {object} orderData
 * @returns {{ orderData: object, thankYouMessage: object }}
 */
function executeCompleted(orderData) {
  const finalizedOrder = { ...orderData };

  if (!finalizedOrder.order_id) {
    finalizedOrder.order_id = generateOrderId();
  }
  if (!finalizedOrder.created_at) {
    finalizedOrder.created_at = new Date().toISOString();
  }
  finalizedOrder.order_status = 'new';
  finalizedOrder.source = 'line';
  finalizedOrder.intent_confirmed = true;

  // 寫入 CSV
  try {
    writeOrder(finalizedOrder);
  } catch (e) {
    console.error('CSV write failed in completed:', e);
  }

  const thankYouMessage = textReply(formatThankYou(finalizedOrder));

  return {
    orderData: finalizedOrder,
    thankYouMessage,
  };
}

module.exports = {
  handleCompleted,
  executeCompleted,
};