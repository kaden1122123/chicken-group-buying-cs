'use strict';

// 時區統一設定（Session G.2）：確保即使系統時區是 UTC，業務時間仍用 Asia/Taipei
require('../utils/timezone');

/**
 * 付款方式驗證規則
 * 新客戶 > NT$1,000 不能選現金（Session D3：金額從 config 讀）
 */

const { getPaymentConfig } = require('../config');

// 付款方式對應
const PAYMENT_METHODS = {
  現金: 'cash',
  现金: 'cash',
  轉帳: 'transfer',
  转账: 'transfer',
  街口: 'jko',
  街口支付: 'jko',
  'LINE Pay': 'linepay',
  'line pay': 'linepay',
  linepay: 'linepay',
  line: 'linepay',
};

const PAYMENT_LABELS = {
  cash: '現金',
  transfer: '轉帳',
  jko: '街口支付',
  linepay: 'LINE Pay',
};

/**
 * 驗證付款方式
 * @param {string} paymentMethod - 付款方式（客戶輸入）
 * @param {number} totalAmount - 訂單總金額
 * @param {boolean} isReturningCustomer - 是否為老客戶
 * @returns {{ valid: boolean, errorMessage: string|null }}
 */
function validatePayment(paymentMethod, totalAmount, isReturningCustomer = false) {
  if (!paymentMethod || paymentMethod.trim().length === 0) {
    return {
      valid: false,
      errorMessage: '付款方式為必填項目，請選擇「現金」、「轉帳」、「街口」或「LINE Pay」。',
    };
  }

  // 標準化輸入：去除空白、轉小寫、再比對
  const normalized = paymentMethod.trim().replace(/\s+/g, '').toLowerCase();
  const methodKey = PAYMENT_METHODS[normalized] || PAYMENT_METHODS[paymentMethod.trim()] || paymentMethod.trim().toLowerCase();

  // 檢查是否為有效付款方式
  if (!Object.keys(PAYMENT_LABELS).includes(methodKey)) {
    return {
      valid: false,
      errorMessage: `不好意思，付款方式「${paymentMethod}」不在選項中，請選擇：現金 / 轉帳 / 街口 / LINE Pay。`,
    };
  }

  // 新客戶且金額 > 現金上限（從 config 讀，預設 NT$1,000）
  const newCustomerMax = getPaymentConfig().cash?.new_customer_max || 1000;
  if (!isReturningCustomer && totalAmount > newCustomerMax && methodKey === 'cash') {
    return {
      valid: false,
      errorMessage: `首次訂購超過 NT$${newCustomerMax.toLocaleString()}，需要使用轉帳、街口支付或LINE Pay喔。`,
    };
  }

  return { valid: true, errorMessage: null };
}

module.exports = {
  validatePayment,
  PAYMENT_METHODS,
  PAYMENT_LABELS,
};
