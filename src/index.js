'use strict';

/**
 * 雞肉團購智能客服 — 主入口
 * 整合所有模組，接收 LINE webhook 事件
 */

// 重要：時區統一設定必須是第一個 require
// 確保所有後續模組的 Date 操作都用 Asia/Taipei
require('./utils/timezone');

const { STATES, getState, transition, setStateDirectly } = require('./states/stateMachine');
const { handleIdle, isOrderIntent } = require('./states/idle');
const { handleAwaitingInfo } = require('./states/awaitingInfo');
const { isConfirmReply, isModifyIntent } = require('./states/confirming');
const { triggerAutoOrder, isStrictConfirmation } = require('../src/handoff/autoOrder');
const { handleAwaitingPayment } = require('./states/awaitingPayment');
const { handleCompleted } = require('./states/completed');
const { handleHandoff } = require('./states/handoff');
const { shouldTransfer } = require('./handoff/transferRules');
const { textReply } = require('./utils/lineReply');
const logger = require('./utils/logger');
const sanitize = require('./utils/sanitizer');
const { formatCustomerReply } = require('./order/orderFormatter');
const { isIgnoredKeyword, getPaymentConfig, isFeatureEnabled } = require('./config');
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
  // P3-emergency 2026-07-16：加 HUMAN_HANDOFF guard 防止 LINE push infinite loop
  // 之前 bug：客戶在 HUMAN_HANDOFF 狀態下若再說「退款」「投訴」等關鍵字，
  // 會重複觸發 handleHandoff → notifyHubert 每次都 push → 累積成「超級多次」推播
  // 修法：HUMAN_HANDOFF 狀態下不重複觸發 handoff（除非是「不要/取消/不要 AI」這類 escape 訊息）
  const isIntentMessage = isOrderIntent(cleanMessage) || cleanMessage.trim().length > 3;
  if (state !== STATES.HUMAN_HANDOFF && (state !== STATES.IDLE || isIntentMessage)) {
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
        // 決策 6：傳遞 reason 給 handleHandoff 寫入 staff_notes
        const handoffResult = await handleHandoff(userId, cleanMessage, {
          ...orderData,
          address: cleanMessage, // 把用戶輸入的地址帶進去（即使不在配送範圍）
        }, userProfile, { reason: result.reason });
        // 同步到 state machine（讓後續讀 state.orderData 看得到 staff_notes 等）
        setStateDirectly(userId, handoffResult.newState, handoffResult.orderData, current.context);
        return { reply: handoffResult.reply, newState: handoffResult.newState };
      } else if (result.action === 'field_received' || result.action === 'validation_failed') {
        const event = result.action === 'validation_failed' ? 'field_received' : result.action;
        // P0-3: 用 awaitingInfo 已 trimmed/驗證後的值（fieldValue），避免 transition 用未 trim 的
        // cleanMessage 覆蓋。fallback 到 cleanMessage 保持向後相容（既有測試只用 value）。
        const fieldValue = result.orderData ? result.orderData[context.awaitingField] : undefined;
        transition(userId, event, {
          fieldName: context.awaitingField,
          fieldValue,
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
        // B 方案（2026-07-16 加）：純文字「確認」才 trigger 自動建單
        // 其他 confirm reply（好的/OK）保留舊 flow（不自動建單）
        if (isStrictConfirmation(cleanMessage)) {
          try {
            const autoResult = await triggerAutoOrder({ userId, orderData });
            if (autoResult.success) {
              logger.info('[B 方案] 自動建單成功', { orderId: autoResult.orderId, userId });
            } else {
              logger.warn('[B 方案] 自動建單失敗，老闆需手動建單', { error: autoResult.error, userId });
              // fallback 走 handoff 讓老闆處理
              // 不在這裡轉 handoff（避免干擾現有 payment options 顯示）
            }
          } catch (e) {
            logger.error('[B 方案] trigger 拋錯', { err: e.message, userId });
          }
        }

        transition(userId, 'customer_confirm', {});
        // Session D3-4：付款方式訊息改為從 config 動態生成
        // - 銀行帳號 / LINE Pay ID 從 chicken.yaml 讀
        // - 4 種付款方式依 feature flag 過濾（關閉的不顯示）
        const paymentConfig = getPaymentConfig();
        const bankCode = paymentConfig.transfer.bank_code;
        const bankAccount = paymentConfig.transfer.account;
        const linepayId = paymentConfig.linepay.line_id;
        const lines = ['收到！請選擇付款方式：\n', '💳 付款說明：\n'];
        if (isFeatureEnabled('payment.cash.enabled')) {
          lines.push('現金：送達時現場付款');
        }
        if (isFeatureEnabled('payment.transfer.enabled')) {
          lines.push(`轉帳：銀行代碼${bankCode} / 帳號${bankAccount}`);
        }
        if (isFeatureEnabled('payment.linepay.enabled') && isFeatureEnabled('official.line_pay.enabled')) {
          lines.push(`LINE Pay：加老闆 LINE（ID：${linepayId}）`);
        }
        if (isFeatureEnabled('payment.jko.enabled')) {
          lines.push('街口：請告知，我提供 QR Code');
        }
        lines.push('\n完成後回覆「已付款」或上傳截圖');
        return {
          reply: textReply(lines.join('\n')),
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
