'use strict';

/**
 * 電話驗證規則
 * 10位數、09開頭
 */

/**
 * 驗證電話格式
 * @param {string} phone
 * @returns {{ valid: boolean, errorMessage: string|null }}
 */
function validatePhone(phone) {
  if (!phone || phone.trim().length === 0) {
    return {
      valid: false,
      errorMessage: '電話為必填項目，請提供聯絡電話。',
    };
  }

  const cleaned = phone.replace(/[\s\-()]/g, '');

  // 檢查是否為10位數
  if (!/^\d{10}$/.test(cleaned)) {
    return {
      valid: false,
      errorMessage: '電話格式有誤，請重新填寫（09開頭10位數）。',
    };
  }

  // 檢查是否為09開頭
  if (!cleaned.startsWith('09')) {
    return {
      valid: false,
      errorMessage: '電話格式有誤，請重新填寫（09開頭10位數）。',
    };
  }

  return { valid: true, errorMessage: null };
}

module.exports = validatePhone;
