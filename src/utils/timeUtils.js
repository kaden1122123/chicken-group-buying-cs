'use strict';

const path = require('path');
const { readKBFile } = require('../knowledge/loader');

// 知識庫路徑：透過 loader 統一管理（Session C C2 變更）
// 之前直接讀 knowledge/base/，現改用 loader.readKBFile() 確保 single source of truth

/**
 * 解析時段
 * @param {string} input - 時段描述
 * @returns {'morning'|'afternoon'|null}
 */
function getTimeSlot(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  // 上午關鍵字
  if (lower.includes('上午') || lower.includes('早上') || lower === 'am' || lower === 'morning') {
    return 'morning';
  }
  // 下午關鍵字（不包含「晚上」）
  if (lower.includes('下午') || lower === 'pm' || lower === 'afternoon') {
    return 'afternoon';
  }
  return null;
}

/**
 * 格式化日期為 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 從知識庫讀取當月開團日期
 * @returns {string[]} - ['YYYY-MM-DD', ...]
 */
function getCurrentOpenDates() {
  try {
    const content = readKBFile('02_order_flow.md');
    // 從知識庫解析開團日期（這裡簡化處理，實際由 loader.js 提供完整解析）
    // 預設：本月每週三、五、六開團（根據實際調整）
    // 此函式由 loader.js 的 loadOrderFlow 補充完整邏輯
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * 檢查是否在收單時間前（13:00 前一天）
 * @param {Date} deliveryDate - 配送日期
 * @returns {boolean}
 */
function isWithinOrderTime(deliveryDate) {
  const now = new Date();
  const cutoff = new Date(deliveryDate);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(13, 0, 0, 0);
  return now < cutoff;
}

/**
 * 取得今天的日期字串 YYYY-MM-DD
 * @returns {string}
 */
function getTodayString() {
  return formatDate(new Date());
}

/**
 * 解析客戶輸入的日期字串
 * @param {string} input
 * @returns {Date|null}
 */
function parseDateInput(input) {
  if (!input) return null;
  // 嘗試常見格式
  const patterns = [
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
    /(\d{1,2})[/-](\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) {
      const now = new Date();
      let year, month, day;
      if (m[1].length === 4) {
        year = parseInt(m[1]);
        month = parseInt(m[2]);
        day = parseInt(m[3]);
      } else {
        year = now.getFullYear();
        month = parseInt(m[1]);
        day = parseInt(m[2]);
      }
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

module.exports = {
  getTimeSlot,
  formatDate,
  getCurrentOpenDates,
  isWithinOrderTime,
  getTodayString,
  parseDateInput,
};