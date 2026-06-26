'use strict';

/**
 * 狀態機 - 管理用戶對話狀態
 * 狀態：IDLE, AWAITING_INFO, REASK_INFO, CONFIRMING, AWAITING_PAYMENT, HUMAN_HANDOFF, COMPLETED
 */

// 狀態常數
const STATES = {
  IDLE: 'IDLE',
  AWAITING_INFO: 'AWAITING_INFO',
  REASK_INFO: 'REASK_INFO',
  CONFIRMING: 'CONFIRMING',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  COMPLETED: 'COMPLETED',
};

// 記憶體儲存（實際環境應用 Redis/DB）
const userStates = new Map(); // userId -> { state, orderData, context }

/**
 * 取得用戶當前狀態
 * @param {string} userId
 * @returns {object}
 */
function getState(userId) {
  return userStates.get(userId) || {
    state: STATES.IDLE,
    orderData: {},
    context: {},
  };
}

/**
 * 更新用戶狀態
 * @param {string} userId
 * @param {object} newState
 */
function setState(userId, newState) {
  const current = getState(userId);
  userStates.set(userId, { ...current, ...newState });
}

/**
 * 清除用戶狀態（回到 IDLE）
 * @param {string} userId
 */
function clearState(userId) {
  userStates.delete(userId);
}

/**
 * 狀態轉換
 * @param {string} userId
 * @param {string} event
 * @param {object} data
 * @returns {{ newState: string, orderData: object, context: object }}
 */
function transition(userId, event, data = {}) {
  const current = getState(userId);
  const { state, orderData, context } = current;

  let newState = state;
  let updatedOrderData = { ...orderData };
  let updatedContext = { ...context };

  switch (state) {
    case STATES.IDLE:
      if (event === 'order_intent') {
        newState = STATES.AWAITING_INFO;
        updatedContext = { ...updatedContext, awaitingField: 'address' };
      }
      break;

    case STATES.AWAITING_INFO:
    case STATES.REASK_INFO:
      if (event === 'field_received') {
        // P0-3: 優先用 data.fieldValue（已 trimmed + 驗證的值），fallback 到 data.value（向後相容）
        const fieldName = data.fieldName;
        const fieldValue = data.fieldValue !== undefined ? data.fieldValue : data.value;
        if (fieldName && fieldValue !== undefined) {
          updatedOrderData = { ...updatedOrderData, [fieldName]: fieldValue };
        }
        updatedContext = { ...updatedContext, awaitingField: data.nextField || null };

        if (data.allFieldsReceived) {
          newState = STATES.CONFIRMING;
        } else if (data.validationFailed) {
          newState = STATES.REASK_INFO;
          updatedContext = { ...updatedContext, awaitingField: fieldName, lastError: data.errorMessage };
        }
      }
      break;

    case STATES.CONFIRMING:
      if (event === 'customer_confirm') {
        newState = STATES.AWAITING_PAYMENT;
      } else if (event === 'customer_modify') {
        newState = STATES.AWAITING_INFO;
        updatedContext = { ...updatedContext, awaitingField: data.fieldToModify };
      } else if (event === 'customer_cancel') {
        newState = STATES.IDLE;
        updatedOrderData = {};
      }
      break;

    case STATES.AWAITING_PAYMENT:
      if (event === 'payment_received') {
        newState = STATES.COMPLETED;
      } else if (event === 'payment_proof_received') {
        newState = STATES.COMPLETED;
        updatedOrderData = { ...updatedOrderData, payment_status: 'pending' };
      } else if (event === 'customer_cancel') {
        newState = STATES.IDLE;
        updatedOrderData = {};
      }
      break;

    case STATES.HUMAN_HANDOFF:
      // 轉真人後不再處理自動回覆
      break;

    case STATES.COMPLETED:
      if (event === 'new_order') {
        newState = STATES.AWAITING_INFO;
        updatedOrderData = {};
        updatedContext = {};
      }
      break;
  }

  setState(userId, {
    state: newState,
    orderData: updatedOrderData,
    context: updatedContext,
  });

  return {
    newState,
    orderData: updatedOrderData,
    context: updatedContext,
  };
}

/**
 * 直接設定狀態（用於從外部載入狀態）
 * @param {string} userId
 * @param {string} state
 * @param {object} orderData
 * @param {object} context
 */
function setStateDirectly(userId, state, orderData = {}, context = {}) {
  setState(userId, { state, orderData, context });
}

/**
 * 取消訂購的制式回覆文字
 * 統一在各狀態 (CONFIRMING / AWAITING_PAYMENT / COMPLETED) 使用
 */
const CANCEL_REPLY_TEXT = '好的，已取消本次訂購。有需要再跟我說喔！';

/**
 * 建立取消訂購的結果物件
 * 所有狀態的取消邏輯統一使用此函數
 *
 * @returns {{ action: string, reply: object, newState: string, orderData: object }}
 */
function buildCancelResult() {
  return {
    action: 'cancelled',
    reply: { type: 'text', text: CANCEL_REPLY_TEXT },
    newState: STATES.IDLE,
    orderData: {},
  };
}

module.exports = {
  STATES,
  getState,
  setState,
  clearState,
  transition,
  setStateDirectly,
  buildCancelResult,
  CANCEL_REPLY_TEXT,
};