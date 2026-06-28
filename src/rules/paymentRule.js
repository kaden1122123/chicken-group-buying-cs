'use strict';

/**
 * 付款方式驗證規則
 * 新客戶 > NT$1,000 不能選現金
 */

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

  // 新客戶且金額 > NT$1,000，不能選現金
  if (!isReturningCustomer && totalAmount > 1000 && methodKey === 'cash') {
    return {
      valid: false,
      errorMessage: '首次訂購超過 NT$1,000，需要使用轉帳、街口支付或LINE Pay喔。',
    };
  }

  return { valid: true, errorMessage: null };
}

module.exports = {
  validatePayment,
  PAYMENT_METHODS,
  PAYMENT_LABELS,
};
