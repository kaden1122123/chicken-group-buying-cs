'use strict';

/**
 * 通知格式 — LINE Push 訊息格式
 */

// 與 transferRules.js 的 TRIGGER_PATTERNS.type 保持同步
// 若 transferRules 新增 type，請補上對應標題
const HANDOFF_TITLES = {
  'refund_request': '【退貨/退款】',
  'cancel_request': '【取消訂單】',
  'reschedule_request': '【改天需求】',
  'complaint': '【售後/客訴】',
  'escalation': '【客訴/爭議】',
  'explicit_request': '【明確要求真人】',
  'discount_request': '【折扣請求】',
  'delivery_confirm_needed': '【配送範圍確認】',
  'bulk_order': '【大批訂單/公司合作】',
  'high_value_order': '【金額異常】',
  'payment_mismatch': '【付款異常】',
  'linepay_failed': '【LINE Pay 付款失敗】',
  'open_date_inquiry': '【開團日期確認】',
  'late_modify': '【截單後變更】',
  'general': '【一般轉報】',
  'general_inquiry': '【一般轉報】',
};

/**
 * 取得 handoff type 對應的標題
 * 若 type 未知：console.warn 提示開發者補上
 * @param {string} handoffType
 * @returns {string}
 */
function getHandoffTitle(handoffType) {
  if (handoffType in HANDOFF_TITLES) {
    return HANDOFF_TITLES[handoffType];
  }
  // 未知 type：警告開發者（避免持續 fallback 到「一般轉報」）
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[notificationFormat] 未知 handoff_type: "${handoffType}"，請補上 HANDOFF_TITLES 對應項目`);
  }
  return '【一般轉報】';
}

/**
 * 格式化 LINE 通知訊息
 * @param {object} orderData - 訂單資料
 * @param {string} userMessage - 客戶原始訊息
 * @returns {string}
 */
function formatLINENotification(orderData, userMessage) {
  const handoffType = orderData.handoff_type || 'general_inquiry';
  const title = getHandoffTitle(handoffType);
  const time = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  // 解析品項摘要
  let itemsSummary = '';
  if (orderData.chicken_items) {
    const chicken = typeof orderData.chicken_items === 'string'
      ? JSON.parse(orderData.chicken_items) : orderData.chicken_items;
    if (chicken && Object.keys(chicken).length > 0) {
      itemsSummary += '🍗 雞肉：' + Object.entries(chicken).map(([k, v]) => `${k}x${v}`).join('、') + '\n';
    }
  }
  if (orderData.side_items) {
    const side = typeof orderData.side_items === 'string'
      ? JSON.parse(orderData.side_items) : orderData.side_items;
    if (side && Object.keys(side).length > 0) {
      itemsSummary += '🥗 小菜：' + Object.entries(side).map(([k, v]) => `${k}x${v}`).join('、') + '\n';
    }
  }

  const lines = [
    `🔔 【AI 客服轉報通知】`,
    `═══════════════════════════`,
    ``,
    `📋 案件類型：${title}`,
    ``,
    `👤 用戶資料`,
    `- LINE 名稱：${orderData.user_line_name || '未知'}`,
    orderData.user_phone ? `- 電話：${orderData.user_phone}` : '',
    orderData.address ? `- 地址：${orderData.address}` : '',
    ``,
    `📝 問題摘要：`,
    `${userMessage}`,
    ``,
    `⏰ 發生時間：${time}`,
    ``,
    itemsSummary ? `📦 訂單品項：\n${itemsSummary}` : '',
    orderData.total_amount ? `💰 訂單金額：NT$ ${orderData.total_amount.toLocaleString()}` : '',
    ``,
    `🤖 AI 已回覆內容：`,
    `「目前老闆再忙，後續會再回覆您，請留意 LINE 通知，謝謝！」`,
    ``,
    `📎 CSV 查詢：`,
    `order_id: ${orderData.order_id}`,
    ``,
    `═══════════════════════════`,
  ].filter((l) => l !== '');

  return lines.join('\n');
}

/**
 * 格式化 LINE 通知（物件格式，供 LINE Messaging API 使用）
 * @param {object} orderData
 * @param {string} userMessage
 * @returns {object} - LINE message object
 */
function formatLINENotificationMessage(orderData, userMessage) {
  const text = formatLINENotification(orderData, userMessage);
  return {
    type: 'text',
    text: text,
  };
}

module.exports = {
  formatLINENotification,
  formatLINENotificationMessage,
  getHandoffTitle,
  HANDOFF_TITLES,
};