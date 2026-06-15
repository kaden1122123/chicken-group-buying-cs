'use strict';

const { STATES } = require('./stateMachine');
const { textReply, quickReply } = require('../utils/lineReply');

/**
 * IDLE 狀態處理
 * 等待「我要訂購」「我要下單」「我要買」（語意判斷）
 */

// 觸發關鍵詞（語意）
const ORDER_INTENT_PATTERNS = [
  /我要訂購/, /我要下單/, /我要買/, /想訂/, /要訂/, /下單/,
  /購買/, /訂雞/, /叫雞/, /團購/,
];

// 問候回覆（無特定意圖）
const GREETING_PATTERNS = [
  /^(嗨|hi|hello|hey|你好|您好)/i,
  /^(早安|午安|晚安|好)/,
];

/**
 * 判斷是否為訂購意圖
 * @param {string} message
 * @returns {boolean}
 */
function isOrderIntent(message) {
  if (!message) return false;
  return ORDER_INTENT_PATTERNS.some((p) => p.test(message));
}

/**
 * 判斷是否為問候
 * @param {string} message
 * @returns {boolean}
 */
function isGreeting(message) {
  if (!message) return false;
  return GREETING_PATTERNS.some((p) => p.test(message.trim()));
}

/**
 * 處理 IDLE 狀態的訊息
 * @param {string} userId
 * @param {string} message
 * @param {object} context - 包含 kbContent（知識庫內容）
 * @returns {{ action: string, reply: object|null, newState: string }}
 */
function handleIdle(userId, message, context = {}) {
  const kbContent = context.kbContent || '';

  if (isOrderIntent(message)) {
    return {
      action: 'order_intent',
      reply: buildOrderFormatReply(),
      newState: STATES.AWAITING_INFO,
    };
  }

  if (isGreeting(message)) {
    return {
      action: 'greeting',
      reply: textReply('嗨！歡迎來到雞味研究所 🍗\n想訂購的朋友請說「我要訂購」或「我要下單」，我會提供訂購格式給您填寫！'),
      newState: STATES.IDLE,
    };
  }

  // P1-5: 若有知識庫內容（如商品查詢），附加在回覆中
  if (kbContent) {
    const kbPreview = kbContent.substring(0, 500);
    return {
      action: 'kb_lookup',
      reply: textReply(`${kbPreview}\n\n想訂購的朋友請說「我要訂購」或「我要下單」喔！`),
      newState: STATES.IDLE,
    };
  }

  // 預設回覆
  return {
    action: 'fallback',
    reply: textReply('您好！我可以幫您處理訂購相關問題。想訂購的朋友請說「我要訂購」或「我要下單」喔！'),
    newState: STATES.IDLE,
  };
}

/**
 * 構建訂購格式回覆
 * @returns {object}
 */
function buildOrderFormatReply() {
  return quickReply(
    '📌 請填寫以下訂購資訊：\n\n' +
    '地址：（完整地址，如有社區名稱請提供）\n' +
    '姓名：\n' +
    '電話：\n' +
    '日期&訂購品項：\n' +
    '送達時段：上午 / 下午\n' +
    '付款方式：現金 / 轉帳\n\n' +
    '🌞 上午時段：10:00~12:00\n' +
    '🌛 下午時段：16:00~18:00',
    [
      { label: '我要訂購', text: '我要訂購' },
      { label: '查看菜單', text: '有什麼商品' },
      { label: '常見問題', text: '常見問題' },
    ]
  );
}

module.exports = {
  isOrderIntent,
  isGreeting,
  handleIdle,
  buildOrderFormatReply,
};
