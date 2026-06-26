'use strict';

/**
 * 雞肉團購智能客服 — 主入口
 * 整合所有模組，接收 LINE webhook 事件
 */

const { STATES, getState, transition, setStateDirectly } = require('./states/stateMachine');
const { handleIdle, isOrderIntent } = require('./states/idle');
const { handleAwaitingInfo } = require('./states/awaitingInfo');
const { handleConfirming, isConfirmReply, isCancelReply, isModifyIntent } = require('./states/confirming');
const { handleAwaitingPayment } = require('./states/awaitingPayment');
const { handleCompleted } = require('./states/completed');
const { handleHandoff, checkHandoffTrigger } = require('./states/handoff');
const { shouldTransfer } = require('./handoff/transferRules');
const { textReply } = require('./utils/lineReply');
const sanitize = require('./utils/sanitizer');
const { formatOrderSummary, formatCustomerReply } = require('./order/orderFormatter');
const { writeOrder } = require('./order/csvWriter');
const { generateOrderId } = require('./order/orderIdGenerator');
const { isIgnoredKeyword } = require('./config');
const { getLineDisplayName } = require('./utils/lineProfileCache');
const { checkWhitelist } = require('./middleware/whitelist');
const { guessIntent, loadKnowledgeForIntent } = require('./knowledge/triggers');

/**
 * 處理收到的 LINE 訊息
 * @param {string} userId - LINE user ID
 * @param {string} message - 客戶訊息
 * @param {object} userProfile - { lineDisplayName, ... }
 * @returns {Promise<{ reply: object|null, newState: string }>}
 */
async function handleMessage(userId, message, userProfile = {}) {
  // 消毒輸入
  const cleanMessage = sanitize(message);


  // ── P0-1: 忽略關鍵字檢查（100% 完全比對 ===）────
  if (isIgnoredKeyword(cleanMessage)) {
    return { reply: null, newState: getState(userId).state };
  }

  // 取得當前狀態
  const current = getState(userId);
  const { state, orderData, context } = current;


  // 先檢查是否應觸發轉真人（所有狀態都可能觸發）
  // 但 IDLE 狀態的問候不應觸發
  const isIntentMessage = isOrderIntent(cleanMessage) || cleanMessage.trim().length > 3;
  if (state !== STATES.IDLE || isIntentMessage) {
    if ((await shouldTransfer(cleanMessage)).shouldTransfer) {
      const result = await handleHandoff(userId, cleanMessage, orderData, userProfile);
      return { reply: result.reply, newState: result.newState };
    }
  }

  // 依狀態處理
  switch (state) {
    case STATES.IDLE: {
      // P1-5: 知識庫觸發整合
      const intent = guessIntent(cleanMessage);
      let kbContent = '';
      if (intent) {
        kbContent = loadKnowledgeForIntent(intent);
      }

      const result = handleIdle(userId, cleanMessage, { ...context, kbContent });
      if (result.action === 'order_intent') {
        transition(userId, 'order_intent', {});
      }
      return { reply: result.reply, newState: result.newState };
    }

    case STATES.AWAITING_INFO:
    case STATES.REASK_INFO: {
      // P1-3: AWAITING_INFO 狀態的「取消產品」引導
      const cancelCheck = await shouldTransfer(cleanMessage);
      if (cancelCheck.shouldTransfer && cancelCheck.type === 'cancel_request') {
        const chickenCount = orderData.chicken_items ? Object.keys(orderData.chicken_items).length : 0;
        const sideCount = orderData.side_items ? Object.keys(orderData.side_items).length : 0;
        const extraCount = orderData.extra_items ? Object.keys(orderData.extra_items).length : 0;
        const totalProducts = chickenCount + sideCount + extraCount;


        if (totalProducts > 1) {
          // 多項產品 → 引導使用者指定移除哪一項
          return {
            reply: textReply('好的，請告訴我想移除哪一項？例如「不要鹽水雞了」或「把毛豆去掉」'),
            newState: STATES.AWAITING_INFO,
          };
        } else {
          // 僅一項 → 確認是否放棄整筆訂購
          return {
            reply: textReply('目前只有一項品項，確認要取消這筆訂購嗎？'),
            newState: STATES.AWAITING_INFO,
          };
        }
      }


      const result = handleAwaitingInfo(userId, cleanMessage, orderData, context);
      if (result.action === 'handoff_needed') {
        // P0-1: 地址超出配送範圍 / 需人工確認 → 走 handleHandoff 轉真人
        // 之前訊息說「已轉交人工處理」但實際只停在 REASK_INFO，
        // 客戶被卡住、Hubert 也沒收到通知。本修整把 action 真實串接。
        const handoffResult = await handleHandoff(userId, cleanMessage, {
          ...orderData,
          address: cleanMessage, // 把用戶輸入的地址帶進去（即使不在配送範圍）
        }, userProfile);
        return { reply: handoffResult.reply, newState: handoffResult.newState };
      } else if (result.action === 'field_received' || result.action === 'validation_failed') {
        const event = result.action === 'validation_failed' ? 'field_received' : result.action;
        // P0-3: 用 awaitingInfo 已 trimmed/驗證後的值（fieldValue），避免 transition 用未 trim 的
        // cleanMessage 覆蓋。fallback 到 cleanMessage 保持向後相容（既有測試只用 value）。
        const fieldValue = result.orderData ? result.orderData[context.awaitingField] : undefined;
        transition(userId, event, {
          fieldName: context.awaitingField,
          fieldValue: fieldValue,
          value: cleanMessage,
          nextField: result.context.awaitingField,
          validationFailed: result.action === 'validation_failed',
          errorMessage: result.context.lastError,
          allFieldsReceived: result.newState === STATES.CONFIRMING,
        });
      } else if (result.action === 'all_fields_received') {
        transition(userId, 'field_received', { allFieldsReceived: true });
        // 顯示確認摘要
        const confirmMsg = textReply(formatCustomerReply(result.orderData));
        return { reply: confirmMsg, newState: STATES.CONFIRMING };
      }
      return { reply: result.reply, newState: result.newState };
    }

    case STATES.CONFIRMING: {
      // P1-3: CONFIRMING 狀態的「取消」→ 轉真人處理
      const cancelCheck = await shouldTransfer(cleanMessage);
      if (cancelCheck.shouldTransfer && cancelCheck.type === 'cancel_request') {
        const result = await handleHandoff(userId, cleanMessage, orderData, userProfile);
        return { reply: result.reply, newState: result.newState };
      }

      if (isConfirmReply(cleanMessage)) {
        transition(userId, 'customer_confirm', {});
        return {
          reply: textReply('收到！請選擇付款方式：\n\n💳 付款說明：\n\n現金：送達時現場付款\n轉帳：銀行代碼007 / 帳號23257030422\nLINE Pay：加老闆 LINE（ID：Willy0221）\n街口：請告知，我提供 QR Code\n\n完成後回覆「已付款」或上傳截圖'),
          newState: STATES.AWAITING_PAYMENT,
        };
      }
      if (isModifyIntent(cleanMessage)) {
        transition(userId, 'customer_modify', {});
        return {
          reply: textReply('好的，請告訴我您想修改的項目。'),
          newState: STATES.AWAITING_INFO,
        };
      }
      // 客戶有新輸入，回到 AWAITING_INFO
      const result = handleAwaitingInfo(userId, cleanMessage, orderData, { awaitingField: null });
      if (result.newState === STATES.CONFIRMING) {
        const confirmMsg = textReply(formatCustomerReply(result.orderData));
        return { reply: confirmMsg, newState: STATES.CONFIRMING };
      }
      return { reply: result.reply, newState: result.newState };
    }

    case STATES.AWAITING_PAYMENT: {
      const result = handleAwaitingPayment(userId, cleanMessage, orderData, context);
      if (result.action === 'payment_received') {
        transition(userId, 'payment_received', {});
        return { reply: result.reply, newState: STATES.COMPLETED };
      }
      if (result.action === 'cancelled') {
        transition(userId, 'customer_cancel', {});
        return { reply: result.reply, newState: STATES.IDLE };
      }
      return { reply: result.reply, newState: result.newState };
    }

    case STATES.HUMAN_HANDOFF: {
      // 轉真人後不回覆
      return { reply: null, newState: STATES.HUMAN_HANDOFF };
    }

    case STATES.COMPLETED: {
      const result = handleCompleted(userId, cleanMessage, orderData, context);
      if (result.action === 'new_order') {
        transition(userId, 'new_order', {});
      }
      return { reply: result.reply, newState: result.newState };
    }

    default:
      return {
        reply: textReply('抱歉，系統遇到一些問題，請稍後再試。'),
        newState: STATES.IDLE,
      };
  }
}

/**
 * 處理 LINE Webhook Event
 * @param {object} event - LINE webhook event
 * @returns {Promise<object|null>} - 回覆訊息
 */
async function handleWebhookEvent(event) {
  if (event.type !== 'message' || !event.message) {
    return null;
  }

  const userId = event.source?.userId || 'unknown';
  const messageText = event.message?.text || '';


  // ── P1-1: 白名單檢查（第一關）────
  const { blocked, reply: blockReply } = checkWhitelist(userId);
  if (blocked) {
    return blockReply;
  }

  // ── P1-2: 取得 LINE displayName（快取 10min）────
  const lineDisplayName = await getLineDisplayName(userId);
  const userProfile = { lineDisplayName };


  // ── 忽略關鍵字檢查（100% 完全符合才觸發）────
  if (isIgnoredKeyword(messageText)) {
    return null;
  }

  // 處理訊息
  const result = await handleMessage(userId, messageText, userProfile);
  return result.reply;
}

/**
 * 設定用戶狀態（從外部載入）
 * @param {string} userId
 * @param {string} state
 * @param {object} orderData
 * @param {object} context
 */
function setUserState(userId, state, orderData, context) {
  setStateDirectly(userId, state, orderData, context);
}

/**
 * 清除用戶狀態
 * @param {string} userId
 */
function clearUserState(userId) {
  const { clearState } = require('./states/stateMachine');
  clearState(userId);
}

/**
 * 取得用戶當前狀態
 * @param {string} userId
 * @returns {object}
 */
function getUserState(userId) {
  return getState(userId);
}

module.exports = {
  handleMessage,
  handleWebhookEvent,
  setUserState,
  clearUserState,
  getUserState,
  STATES,
};