'use strict';

const { shouldTransfer } = require('../handoff/transferRules');

/**
 * REASK_INFO 狀態：某欄位驗證失敗，重新詢問該欄位
 */

async function handle(userId, event, data, { getState, setState, STATES }) {
  const { message } = data;
  const current = getState(userId);
  const msg = (message || '').trim();

  // 檢查 Human Handoff
  const handoffCheck = await shouldTransfer(msg);
  if (handoffCheck.shouldTransfer) {
    setState(userId, { state: STATES.HUMAN_HANDOFF });
    return {
      newState: STATES.HUMAN_HANDOFF,
      reply: '目前老闆再忙，後續會再回覆您，請留意 LINE 通知，謝謝！',
      orderData: current.orderData,
      handoffType: handoffCheck.type,
    };
  }

  // 回到 AWAITING_INFO 處理（使用同一套邏輯）
  const { handle: awaitingHandle } = require('./awaitingInfo');
  return awaitingHandle(userId, event, data, { getState, setState, STATES });
}

module.exports = { handle };