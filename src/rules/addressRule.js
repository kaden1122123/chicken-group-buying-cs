'use strict';

const path = require('path');
const fs = require('fs');

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../../knowledge/base');

// 允許區域關鍵詞
const ALLOWED_KEYWORDS = [
  '北大特區', '三峽老街', '三峽舊市區', '安溪國中', '八安大橋',
  '三峽', '鶯歌', '介壽國小',
];

// 拒絕區域關鍵詞
const DENIED_KEYWORDS = [
  '大溪', '新店', '龍潭', '楊梅', '桃園', '中壢',
  '土城', '板橋', '中和', '永和', '汐止',
];

/**
 * 驗證地址是否在配送範圍內
 * @param {string} address
 * @returns {{ valid: boolean, errorMessage: string|null }}
 */
function validateAddress(address) {
  if (!address || address.trim().length === 0) {
    return {
      valid: false,
      errorMessage: '地址為必填項目，請提供完整地址（含社區或公司名稱）。',
    };
  }

  const addr = address.trim();
  const deniedFound = DENIED_KEYWORDS.find((kw) => addr.includes(kw));
  if (deniedFound) {
    return {
      valid: false,
      errorMessage: '不好意思，您的地址超出配送範圍，已轉交人工處理。',
    };
  }

  // 檢查是否在允許區域（模糊匹配）
  const allowedFound = ALLOWED_KEYWORDS.some((kw) => addr.includes(kw));
  if (!allowedFound) {
    // 地址不在明確的允許區域，但也不在拒絕區域，需要人工確認
    return {
      valid: false,
      errorMessage: '感謝您的提問！您的地址是否能配送，需由客服進一步確認。已協助轉交人工處理，將盡快回覆您。',
    };
  }

  return { valid: true, errorMessage: null };
}

module.exports = validateAddress;