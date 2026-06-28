'use strict';

// 時區統一設定（Session G.2）：確保即使系統時區是 UTC，業務時間仍用 Asia/Taipei
require('../utils/timezone');

const { formatDate, getTodayString } = require('../utils/timeUtils');
const { getOpenDates: getConfigOpenDates } = require('../config');


/**
 * 取得開團日期（以 config.yaml 的 open_dates 為主）
 * @returns {string[]} - ['YYYY-MM-DD', ...]
 */
function getOpenDates() {
  return getConfigOpenDates();
}

/**
 * 格式化開團日期列表（供訊息使用）
 * @param {string[]} dates
 * @returns {string}
 */
function formatOpenDates(dates) {
  return dates.join('、');
}

/**
 * 取得指定日期之後的下一個開團日
 * @param {string|Date} [afterDate] - 起始日期（含當天），未提供則用今天
 * @returns {string|null} - YYYY-MM-DD 格式，null 表示找不到
 */
function getNextOpenDate(afterDate) {
  const openDates = getOpenDates();
  if (openDates.length === 0) return null;
  const start = afterDate
    ? (typeof afterDate === 'string' ? afterDate : formatDate(afterDate))
    : getTodayString();
  const sorted = [...openDates].sort();
  return sorted.find((d) => d >= start) || null;
}

/**
 * 取得下一個「客戶可以下單」的開團日
 * 排除：今天（已截止）、配送前一日 13:00 後已截止的開團日
 *
 * @param {Date} [now] - 當前時間，未提供則用 new Date()
 * @returns {string|null} - YYYY-MM-DD 格式
 */
function getNextOrderableOpenDate(now) {
  const current = now || new Date();
  const openDates = getOpenDates();
  if (openDates.length === 0) return null;

  const todayStr = formatDate(current);

  for (const d of [...openDates].sort()) {
    // 跳過今天（時間已晚）
    if (d === todayStr) {
      // 今天還有機會？只有現在 < 13:00 才有可能（理論上太趕）
      if (current.getHours() < 13) {
        return d; // 理論上可以但實務上不推薦
      }
      continue;
    }
    // 跳過已過收單時間的開團日（配送前一日 13:00 後）
    const deliveryDate = new Date(d);
    const orderCutoff = new Date(deliveryDate);
    orderCutoff.setDate(orderCutoff.getDate() - 1);
    orderCutoff.setHours(13, 0, 0, 0);
    if (current >= orderCutoff) {
      continue; // 已過收單時間
    }
    return d; // 找到第一個可下單的開團日
  }
  return null;
}

/**
 * 將日期格式化為人類可讀的「週X」格式
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} - 例：「2026-06-16（週二）」
 */
function formatDateWithWeekday(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return `${dateStr}（${weekdays[d.getDay()]}）`;
}

/**
 * 驗證日期是否有效
 * 4種情況：
 * 1. 已超過收單時間（13:00 前一天）
 * 2. 今天沒有開團
 * 3. 已超過當天開團時間（13:00）
 * 4. 不是當月的日期
 *
 * @param {string|Date} inputDate - 配送日期
 * @param {string} [customerMessage] - 客戶原始訊息（用於日後擴展）
 * @returns {{ valid: boolean, errorMessage: string|null, errorType: string|null, suggestedDate: string|null }}
 */
function validateDate(inputDate, customerMessage) {
  if (!inputDate) {
    return {
      valid: false,
      errorMessage: '日期為必填項目，請提供配送日期。',
      errorType: 'missing',
      suggestedDate: getNextOrderableOpenDate(),
    };
  }

  // 解析日期
  let deliveryDate;
  if (inputDate instanceof Date) {
    deliveryDate = inputDate;
  } else {
    deliveryDate = new Date(inputDate);
  }

  if (isNaN(deliveryDate.getTime())) {
    return {
      valid: false,
      errorMessage: '日期格式有誤，請提供正確的日期（例：6/15 或 2026-06-15）。',
      errorType: 'invalid_format',
      suggestedDate: getNextOrderableOpenDate(),
    };
  }

  const now = new Date();
  const todayStr = getTodayString();
  const deliveryDateStr = formatDate(deliveryDate);
  const openDates = getOpenDates();
  const suggestedDate = getNextOrderableOpenDate(now);

  // 情況4：不是當月
  const deliveryMonth = deliveryDate.getMonth();
  const currentMonth = now.getMonth();
  if (deliveryMonth !== currentMonth) {
    return {
      valid: false,
      errorMessage: buildErrorMessage('not_this_month', deliveryDateStr, suggestedDate, openDates),
      errorType: 'not_this_month',
      suggestedDate,
    };
  }

  // 情況2：今天沒有開團
  if (!openDates.includes(deliveryDateStr)) {
    return {
      valid: false,
      errorMessage: buildErrorMessage('not_open_date', deliveryDateStr, suggestedDate, openDates),
      errorType: 'not_open_date',
      suggestedDate,
    };
  }

  // 情況3：已超過當天開團時間（13:00）
  const cutoffToday = new Date(now);
  cutoffToday.setHours(13, 0, 0, 0);
  if (now >= cutoffToday && formatDate(now) === deliveryDateStr) {
    return {
      valid: false,
      errorMessage: buildErrorMessage('past_cutoff_today', deliveryDateStr, suggestedDate, openDates),
      errorType: 'past_cutoff_today',
      suggestedDate,
    };
  }

  // 情況1：已超過收單時間（配送日前一天 13:00）
  const orderCutoff = new Date(deliveryDate);
  orderCutoff.setDate(orderCutoff.getDate() - 1);
  orderCutoff.setHours(13, 0, 0, 0);
  if (now >= orderCutoff) {
    return {
      valid: false,
      errorMessage: buildErrorMessage('past_order_cutoff', deliveryDateStr, suggestedDate, openDates),
      errorType: 'past_order_cutoff',
      suggestedDate,
    };
  }

  return { valid: true, errorMessage: null, errorType: null, suggestedDate };
}

/**
 * 統一產生錯誤訊息
 * 突出「下一個開團日」建議，而非整個清單
 *
 * @param {string} errorType
 * @param {string} requestedDate
 * @param {string|null} suggestedDate
 * @param {string[]} openDates
 * @returns {string}
 */
function buildErrorMessage(errorType, requestedDate, suggestedDate, openDates) {
  const suggested = suggestedDate
    ? `下次有開團的日期是 ${formatDateWithWeekday(suggestedDate)}，您要改訂這天嗎？`
    : `本月已無可訂購的開團日。`;
  const fullList = openDates.length > 0
    ? `（本月開團日期：${formatOpenDates(openDates)}）`
    : '';

  switch (errorType) {
    case 'not_open_date':
      return `不好意思，您選的日期（${requestedDate}）目前沒有開團。${suggested}${fullList}`;
    case 'past_cutoff_today':
      return `不好意思，今天已經超過 13:00 了，無法再下今天的訂單。${suggested}${fullList}`;
    case 'past_order_cutoff':
      return `不好意思，已經超過下單時間了（配送前一日 13:00 截止）。${suggested}${fullList}`;
    case 'not_this_month':
      return `不好意思，您選的日期（${requestedDate}）不是本月的開團日。${suggested}${fullList}`;
    default:
      return `不好意思，您選的日期有問題。${suggested}${fullList}`;
  }
}

module.exports = {
  validateDate,
  getOpenDates,
  formatOpenDates,
  getNextOpenDate,
  getNextOrderableOpenDate,
  formatDateWithWeekday,
};
