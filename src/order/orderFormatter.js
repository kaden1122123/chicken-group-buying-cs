'use strict';

// 時區統一設定（Session G.2）
require('../utils/timezone');

const { loadProductMenu } = require('../knowledge/loader');
const { getDeliveryRules } = require('../config');

/**
 * 計算訂單金額
 * @param {object} itemsData - { chicken_items: {}, side_items: {}, extra_items: {} }
 * @returns {{ subtotal: number, delivery_fee: number, total_amount: number, chicken_count: number, side_count: number, total_boxes: number }}
 */
function calculatePrice(itemsData) {
  const { items } = loadProductMenu();
  const priceMap = {};
  items.forEach((item) => {
    priceMap[item.name] = item.price;
  });

  let subtotal = 0;
  let chickenCount = 0;
  let sideCount = 0;

  // 雞肉品項
  const chicken = itemsData.chicken_items || {};
  for (const [name, qty] of Object.entries(chicken)) {
    const price = priceMap[name] || 0;
    subtotal += price * qty;
    // 半隻=1盒，整隻=2盒
    const isWhole = name.includes('整隻') || name.includes('玉米雞（整隻') || name.includes('土雞（整隻') || name.includes('烏骨公雞（整隻') || name.includes('玉米公雞（整隻');
    chickenCount += isWhole ? qty * 2 : qty;
  }

  // 小菜品項
  const sides = itemsData.side_items || {};
  for (const [name, qty] of Object.entries(sides)) {
    const price = priceMap[name] || 0;
    subtotal += price * qty;
    sideCount += qty;
  }

  // 加購品
  const extras = itemsData.extra_items || {};
  for (const [name, qty] of Object.entries(extras)) {
    const price = priceMap[name] || 0;
    subtotal += price * qty;
  }

  // 免運判斷
  const hasChicken = chickenCount > 0;
  const hasSide = sideCount > 0;
  const sideSubtotal = Object.entries(sides).reduce((sum, [name, qty]) => {
    return sum + (priceMap[name] || 0) * qty;
  }, 0);

  let deliveryFee = 0;
  const deliveryRules = getDeliveryRules();
  // 小菜免運門檻（從 config 讀，預設 NT$350）
  const sideMinNtd = deliveryRules.minimum_order?.side_dish_ntd || 350;
  // 小菜未滿門檻時的運費（從 config 讀，預設 NT$80）
  const deliveryFeeFallback = deliveryRules.delivery_fee_short_fallback || 80;
  if (hasChicken) {
    deliveryFee = 0; // 雞肉1盒以上免運
  } else if (hasSide && sideSubtotal >= sideMinNtd) {
    deliveryFee = 0; // 小菜滿$sideMinNtd免運
  } else if (hasSide) {
    deliveryFee = deliveryFeeFallback; // 小菜未滿門檻，收運費
  }

  return {
    subtotal,
    delivery_fee: deliveryFee,
    total_amount: subtotal + deliveryFee,
    chicken_count: chickenCount,
    side_count: sideCount,
    total_boxes: chickenCount + sideCount,
  };
}

/**
 * 格式化品項為 LINE 顯示文字
 * @param {object} itemsData
 * @returns {string}
 */
function formatItemsDisplay(itemsData) {
  const lines = [];

  const chicken = itemsData.chicken_items || {};
  for (const [name, qty] of Object.entries(chicken)) {
    lines.push(`🐔 ${name} x${qty}`);
  }

  const sides = itemsData.side_items || {};
  for (const [name, qty] of Object.entries(sides)) {
    lines.push(`🥒 ${name} x${qty}`);
  }

  const extras = itemsData.extra_items || {};
  for (const [name, qty] of Object.entries(extras)) {
    lines.push(`➕ ${name} x${qty}`);
  }

  return lines.join('\n') || '（未填寫品項）';
}

/**
 * 格式化訂單確認摘要（給客戶看）
 * @param {object} orderData
 * @returns {string}
 */
function formatOrderSummary(orderData) {
  const priceCalc = calculatePrice({
    chicken_items: orderData.chicken_items || {},
    side_items: orderData.side_items || {},
    extra_items: orderData.extra_items || {},
  });

  const timeSlotLabel = orderData.time_slot === 'morning' ? '🌞 上午（10:00~12:00）' : '🌛 下午（16:00~18:00）';

  const lines = [
    '📋 訂單確認',
    '═══════════════════',
    `📦 品項：`,
    formatItemsDisplay({
      chicken_items: orderData.chicken_items || {},
      side_items: orderData.side_items || {},
      extra_items: orderData.extra_items || {},
    }),
    '',
    `📍 送達日期：${orderData.delivery_date || '（未填寫）'}`,
    `⏰ 送達時段：${timeSlotLabel}`,
    `👤 收件人：${orderData.user_line_name || '（未填寫）'}`,
    `📞 電話：${orderData.user_phone || '（未填寫）'}`,
    `🏠 地址：${orderData.address || '（未填寫）'}`,
    orderData.community ? `🏢社區：${orderData.community}` : '',
    '',
    `💰總金額：NT$ ${priceCalc.total_amount}`,
    priceCalc.delivery_fee === 0 ? '✔️ 免運' : `運費：NT$ ${priceCalc.delivery_fee}`,
    '',
    `💳 付款方式：${orderData.payment_method || '（未選擇）'}`,
    '',
    '═══════════════════',
    '請回覆「確認」完成訂購。',
  ].filter((l) => l !== '');

  return lines.join('\n');
}

/**
 * 格式化訂單詳細（給 Hubert 內部查看）
 * @param {object} orderData
 * @returns {string}
 */
function formatOrderDetail(orderData) {
  const priceCalc = calculatePrice({
    chicken_items: orderData.chicken_items || {},
    side_items: orderData.side_items || {},
    extra_items: orderData.extra_items || {},
  });

  return [
    `order_id: ${orderData.order_id}`,
    `created_at: ${orderData.created_at}`,
    `user_line_name: ${orderData.user_line_name}`,
    `user_phone: ${orderData.user_phone}`,
    `address: ${orderData.address}`,
    `community: ${orderData.community}`,
    `delivery_date: ${orderData.delivery_date}`,
    `time_slot: ${orderData.time_slot}`,
    `chicken_items: ${JSON.stringify(orderData.chicken_items || {})}`,
    `side_items: ${JSON.stringify(orderData.side_items || {})}`,
    `extra_items: ${JSON.stringify(orderData.extra_items || {})}`,
    `total_amount: ${priceCalc.total_amount}`,
    `payment_method: ${orderData.payment_method}`,
    `payment_status: ${orderData.payment_status}`,
    `order_status: ${orderData.order_status}`,
    `staff_notes: ${orderData.staff_notes}`,
    `customer_notes: ${orderData.customer_notes}`,
    `customer_tags: ${orderData.customer_tags}`,
    `handoff_type: ${orderData.handoff_type}`,
  ].join('\n');
}

module.exports = {
  calculatePrice,
  formatItemsDisplay,
  formatOrderSummary,
  formatOrderDetail,
};
