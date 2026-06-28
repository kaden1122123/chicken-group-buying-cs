'use strict';

/**
 * 時區統一管理
 *
 * 目的：確保業務邏輯永遠使用 Asia/Taipei 時區
 * - 即使 production 或開發者機器系統時區是 UTC，行為也正確
 * - 即使 CI runner 是 UTC，測試也通過
 *
 * 設計：
 * - Node.js 支援動態修改 process.env.TZ（會立即生效）
 * - 在 src/index.js 第一行 require，確保最早設定
 * - 尊重外部已設定的 TZ（測試環境可覆蓋）
 *
 * 受影響的 API：
 * - Date.prototype.getHours() / getDate() / getMonth() / getFullYear()
 * - Date.prototype.toLocaleString() 不帶 timeZone option
 *
 * 不受影響的 API：
 * - Date.prototype.toISOString() — 永遠 UTC
 * - Date.prototype.toLocaleString(locale, { timeZone }) — 明確指定時區
 */

// 雞味研究所是台北生意，業務邏輯永遠用 Asia/Taipei
// 強制覆蓋系統時區，即使 CI runner 或開發者機器用 UTC 也正確
// 注意：測試可透過設定 ALLOW_TIMEZONE_OVERRIDE=1 來使用其他時區（極少數）
if (!process.env.ALLOW_TIMEZONE_OVERRIDE) {
  process.env.TZ = 'Asia/Taipei';
}

const BUSINESS_TIMEZONE = 'Asia/Taipei';

/**
 * 取得業務時區（永遠回傳 Asia/Taipei）
 * 用於：toLocaleString 等需要明確時區的 API
 * @returns {string}
 */
function getBusinessTimezone() {
  return BUSINESS_TIMEZONE;
}

/**
 * 取得當前生效的時區（process.env.TZ）
 * 用於：debug、測試驗證
 * @returns {string}
 */
function getCurrentTimezone() {
  return process.env.TZ || BUSINESS_TIMEZONE;
}

/**
 * 判斷是否啟用時區覆蓋（測試 escape hatch）
 * @returns {boolean}
 */
function isTimezoneOverrideAllowed() {
  return process.env.ALLOW_TIMEZONE_OVERRIDE === '1';
}

/**
 * 用業務時區格式化 Date 為 YYYY-MM-DD
 * 與 src/utils/timeUtils.js 的 formatDate 邏輯一致，但獨立避免循環依賴
 * @param {Date} date
 * @returns {string} YYYY-MM-DD 或 ''（如果無效）
 */
function formatBusinessDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  // getFullYear/getMonth/getDate 使用 process.env.TZ 設定的時區
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 用業務時區取得 Date 的小時（0-23）
 * @param {Date} date
 * @returns {number}
 */
function getBusinessHours(date) {
  if (!date || !(date instanceof Date)) return 0;
  return date.getHours();
}

module.exports = {
  BUSINESS_TIMEZONE,
  getBusinessTimezone,
  getCurrentTimezone,
  isTimezoneOverrideAllowed,
  formatBusinessDate,
  getBusinessHours,
};
