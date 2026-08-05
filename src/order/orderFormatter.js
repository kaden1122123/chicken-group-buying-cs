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
  const isWholeMap = {};
  items.forEach((item) => {
    priceMap[item.name] = item.price;
    isWholeMap[item.name] = item.isWhole;
  });

  let subtotal = 0;
  let chickenCount = 0;
  let sideCount = 0;

  // 雞肉品項
  const chicken = itemsData.chicken_items || {};
  for (const [name, qty] of Object.entries(chicken)) {
    const price = priceMap[name] || 0;
    subtotal += price * qty;
    // 整隻 = 2 盒，半隻 = 1 盒（從 loadProductMenu().items[i].isWhole 讀，loader.js 已正確判斷）
    const isWhole = isWholeMap[name] === true;
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
 * Round 37.16 (Hubert 11:17) 多品項 CSV 標準化格式
 * @param {object} itemsData - { chicken_items: {}, side_items: {}, extra_items: {} }
 * @returns {string} 「品項名稱 x 數量 | 品項名稱 x 數量」格式
 *                    例：「鹽水雞 x2 | 玉米雞 x1」(chicken)
 *                    例：「小菜 x3 | 加購 x1」(side+extra)
 */
function formatItemsForCsv(itemsData) {
  const parts = [];
  const chicken = itemsData.chicken_items || {};
  for (const [name, qty] of Object.entries(chicken)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  const sides = itemsData.side_items || {};
  for (const [name, qty] of Object.entries(sides)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  const extras = itemsData.extra_items || {};
  for (const [name, qty] of Object.entries(extras)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  return parts.join(' | ');
}

/**
 * 雞肉品項 CSV 專用（只 chicken_items）
 */
function formatChickenForCsv(itemsData) {
  const chicken = itemsData.chicken_items || {};
  const parts = [];
  for (const [name, qty] of Object.entries(chicken)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  return parts.join(' | ');
}

/**
 * 小菜 + 加購 CSV 專用
 */
function formatSidesForCsv(itemsData) {
  const parts = [];
  const sides = itemsData.side_items || {};
  for (const [name, qty] of Object.entries(sides)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  const extras = itemsData.extra_items || {};
  for (const [name, qty] of Object.entries(extras)) {
    if (qty > 0) parts.push(`${name} x${qty}`);
  }
  return parts.join(' | ');
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

  const timeSlotLabel = orderData.time_slot === 'morning' ? '上午 🌞 10:00~12:00' : '下午 🌛 16:00-18:00';

  // Round 37.26 (Hubert 20:02) LINE Emoji 純文字卡片
  // - 嚴禁使用 Markdown 表格（LINE 不支援 `| 項目 | 內容 |`）
  // - 統一採用 Emoji 開頭 + 易讀排版
  // - 地址附 (配送範圍內) 註記（addressRule 判定）
  // - 金額含未滿 $1000 新客戶現金付款 OK 提示
  // - 日期用 M/D (週X) 格式、時段用「下午 16:00-18:00」
  // - CTA：「回覆「確認」後，我就幫您正式成立訂單囉 😊」

  const itemsDisplay = formatItemsDisplay({
    chicken_items: orderData.chicken_items || {},
    side_items: orderData.side_items || {},
    extra_items: orderData.extra_items || {},
  });

  const addressWithRange = orderData.address
    ? `${orderData.address}${orderData.community ? `（${orderData.community}）` : ''}${isAddressInRange(orderData.address) ? ' (配送範圍內)' : ' (配送範圍需確認)'}`
    : '（未填寫）';

  const dateDisplay = orderData.delivery_date
    ? formatDeliveryDateForCard(orderData.delivery_date)
    : '（未填寫）';

  const totalStr = `NT$ ${Math.round(priceCalc.total_amount).toLocaleString('zh-TW')}`;
  const newCustomerCashHint =
    priceCalc.total_amount < 1000 && orderData.payment_method === 'cash'
      ? ' (未滿 $1000 新客戶現金付款 OK)'
      : '';

  const paymentLabels = { cash: '現金', transfer: '轉帳', jko: '街口支付', linepay: 'LINE Pay' };
  const paymentMethod = orderData.payment_method || '（未選擇）';
  const paymentDisplay = `${paymentLabels[paymentMethod] || paymentMethod}${paymentMethod === 'cash' ? ' (取貨付款)' : ''}`;

  const lines = [
    '📋 訂單內容確認',
    '',
    `👤 姓名：${orderData.user_line_name || '（未填寫）'}`,
    `📞 電話：${orderData.user_phone || '（未填寫）'}`,
    `📍 地址：${addressWithRange}`,
    `🐔 品項：${itemsDisplay.replace(/\n/g, '、')}`,
    `💰 總計：${totalStr}${newCustomerCashHint}`,
    `🚚 送達：${dateDisplay} ${timeSlotLabel}`,
    `💳 付款：${paymentDisplay}`,
    '',
    '回覆「確認」後，我就幫您正式成立訂單囉 😊',
  ];

  return lines.join('\n');
}

// Round 37.26 (Hubert 20:02) 配送範圍簡明判定（三峽區 / 鶯歌區 / loader 關鍵字）
function isAddressInRange(address) {
  if (!address) return false;
  if (address.includes('三峽區') || address.includes('鶯歌區')) return true;
  try {
    const { loadDeliveryAreas } = require('../knowledge/loader');
    const { allowed } = loadDeliveryAreas();
    return allowed.some((kw) => address.includes(kw));
  } catch (e) {
    return false;
  }
}

// Round 37.26 (Hubert 20:02) 日期 M/D (週X) 格式
function formatDeliveryDateForCard(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const dateObj = new Date(dateStr);
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const wd = isNaN(dateObj.getTime()) ? '' : weekdays[dateObj.getDay()];
  return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)} (${wd})`;
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
  formatOrderSummary,
  formatItemsDisplay,
  formatItemsForCsv,
  formatChickenForCsv,
  formatSidesForCsv,
  formatOrderDetail,
};

