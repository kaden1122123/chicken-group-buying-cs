'use strict';

const { STATES } = require('./stateMachine');
const { textReply, quickReply } = require('../utils/lineReply');
const { getOrdersByLineDisplayName } = require('../order/csvReader');
const { formatCustomerReply } = require('../order/orderFormatter');

/**
 * IDLE 狀態處理
 * 等待「我要訂購」「我要下單」「我要買」（語意判斷）
 */

// 觸發關鍵詞（語意）
const ORDER_INTENT_PATTERNS = [
  /我要訂購/, /我要下單/, /我要買/, /想訂/, /要訂/, /下單/,
  /購買/, /訂雞/, /叫雞/, /團購/,
];

// Round 37.24 (Hubert 16:23) 客戶自助查詢 — 『我的訂單』 / 『查訂單』 / 『訂單查詢』
const MY_ORDER_QUERY_PATTERNS = [
  /我的訂單/, /查訂單/, /訂單查詢/, /查我的訂單/, /我的訂單查詢/,
  /^訂單$/, /^訂單狀態$/, /^訂單詳情$/,
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
 * Round 37.24 (Hubert 16:23) 判斷是否為客戶「我的訂單」查詢
 * @param {string} message
 * @returns {boolean}
 */
function isMyOrderQuery(message) {
  if (!message) return false;
  return MY_ORDER_QUERY_PATTERNS.some((p) => p.test(message.trim()));
}

/**
 * 構建『我的訂單』回覆卡片
 * 根據 lineDisplayName 查詢該用戶的最新有效訂單
 * @param {Array<object>} orders
 * @returns {string}
 */
function buildMyOrdersReply(orders) {
  if (!orders || orders.length === 0) {
    return '目前查無您的近期訂單，歡迎參考菜單下單喔！🐔';
  }
  const lines = ['📋 您的近期訂單：\n'];
  orders.forEach((o, i) => {
    const orderId = o.order_id || '?';
    const deliveryDate = o.delivery_date || '—';
    const timeSlot = (o.time_slot || '').toLowerCase() === 'morning' ? '上午 🌞' : ((o.time_slot || '').toLowerCase() === 'afternoon' ? '下午 🌛' : (o.time_slot || '—'));
    // 品項細項
    const ch = typeof o.chicken_items === 'string' ? safeParseObj(o.chicken_items) : (o.chicken_items || {});
    const sd = typeof o.side_items === 'string' ? safeParseObj(o.side_items) : (o.side_items || {});
    const ex = typeof o.extra_items === 'string' ? safeParseObj(o.extra_items) : (o.extra_items || {});
    const itemParts = [];
    Object.keys(ch).forEach((k) => itemParts.push('🐔 ' + k + 'x' + ch[k]));
    Object.keys(sd).forEach((k) => itemParts.push('🥒 ' + k + 'x' + sd[k]));
    Object.keys(ex).forEach((k) => itemParts.push('➕ ' + k + 'x' + ex[k]));
    const itemsStr = itemParts.length ? itemParts.join('、') : '（無品項）';
    // 狀態
    const ps = (o.payment_status || '—');
    const os = (o.order_status || '—');
    const total = parseFloat(o.total_amount) || 0;
    const totalStr = 'NT$ ' + Math.round(total).toLocaleString('zh-TW');
    lines.push((i + 1) + '. 🧾 ' + orderId);
    lines.push('   📅 到貨：' + deliveryDate + ' ' + timeSlot);
    lines.push('   🛒 品項：' + itemsStr);
    lines.push('   💰 總金額：' + totalStr);
    lines.push('   💳 付款：' + ps + ' / 訂單：' + os);
    lines.push('');
  });
  lines.push('如有疑問請說「客服」或聯絡老闆。');
  return lines.join('\n');
}

function safeParseObj(s) {
  if (!s) return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch (e) { return {}; }
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

  // Round 37.24 (Hubert 16:23) 客戶自助查詢：先檢查『我的訂單』
  if (isMyOrderQuery(message)) {
    const displayName = context.lineDisplayName || context.userProfile && context.userProfile.lineDisplayName || '';
    const orders = getOrdersByLineDisplayName(displayName, { limit: 5 });
    return {
      action: 'my_order_query',
      reply: textReply(buildMyOrdersReply(orders)),
      newState: STATES.IDLE,
    };
  }

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
  // Round 37.25 (Hubert 19:06)：動態讀 open_dates（嚴禁硬編碼 8/8、8/9 等）
  const openDatesStr = formatOpenDatesForPrompt();
  return quickReply(
    '📌 請填寫以下訂購資訊：\n\n' +
    '地址：（完整地址，如有社區名稱請提供）\n' +
    '姓名：\n' +
    '電話：\n' +
    '日期&訂購品項：\n' +
    '送達時段：上午 / 下午\n' +
    '付款方式：現金 / 轉帳\n\n' +
    (openDatesStr ? '📅 本期開團日：' + openDatesStr + '\n' : '') +
    '🌞 上午時段：10:00~12:00\n' +
    '🌛 下午時段：16:00~18:00',
    [
      { label: '我要訂購', text: '我要訂購' },
      { label: '查看菜單', text: '有什麼商品' },
      { label: '常見問題', text: '常見問題' },
    ],
  );
}

/**
 * Round 37.25 (Hubert 19:06)：動態從 chicken.yaml 的 open_dates 讀取開團日
 * 轉成 "M/D (週X)" 格式（例如 "8/7 (週五)"），供 prompt 參考
 * 嚴禁硬編碼日期 — 一律從 config 讀
 * @returns {string}
 */
function formatOpenDatesForPrompt() {
  try {
    const { getUpcomingOpenDates, formatDateWithWeekday } = require('../rules/dateRule');
    const dates = getUpcomingOpenDates({ weeks: 2 });
    if (!dates || dates.length === 0) return '';
    return dates
      .slice(0, 4)
      .map((d) => {
        const withDay = formatDateWithWeekday(d);
        const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return withDay;
        const md = parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
        const weekday = withDay.match(/（(.+)）/);
        return md + ' (' + (weekday ? weekday[1] : '') + ')';
      })
      .join('、');
  } catch (e) {
    return '';
  }
}

module.exports = {
  isOrderIntent,
  isGreeting,
  isMyOrderQuery, // Round 37.24
  handleIdle,
  buildOrderFormatReply,
  buildMyOrdersReply, // Round 37.24
};
