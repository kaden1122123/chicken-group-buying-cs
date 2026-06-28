'use strict';

// 時區統一設定（Session G.2）
require('../utils/timezone');

const { getTimeSlot } = require('../utils/timeUtils');

/**
 * 驗證時段是否有效
 * 僅接受：上午(10-12) / 下午(16-18)
 * 指定精準時間 → 回覆說明不保證但不阻擋
 *
 * @param {string} input
 * @returns {{ valid: boolean, errorMessage: string|null, specifiedTime: string|null, warning: boolean }}
 */
function validateTimeSlot(input) {
  if (!input || input.trim().length === 0) {
    return {
      valid: false,
      errorMessage: '時段為必填項目，請選擇「上午」或「下午」。',
      specifiedTime: null,
      warning: false,
    };
  }

  const slot = getTimeSlot(input);

  if (slot === null) {
    // 嘗試解析是否有指定精準時間
    const timePattern = /(\d{1,2})[:：]?(\d{0,2})/;
    const match = input.match(timePattern);
    if (match) {
      // 有指定精準時間 → 不阻擋但提醒（不論是否在時段內）
      const hour = parseInt(match[1]);
      const isMorningWindow = hour >= 10 && hour < 12;
      const isAfternoonWindow = hour >= 16 && hour < 18;

      if (isMorningWindow) {
        return { valid: true, errorMessage: '由於外送人手有限，我們會盡量在指定時間送達，但無法保證準時。', specifiedTime: 'morning', warning: true };
      }
      if (isAfternoonWindow) {
        return { valid: true, errorMessage: '由於外送人手有限，我們會盡量在指定時間送達，但無法保證準時。', specifiedTime: 'afternoon', warning: true };
      }

      // 不在允許時段內，但有指定時間 → 不阻擋但提醒
      return {
        valid: true,
        errorMessage: '由於外送人手有限，我們會盡量在指定時間送達，但無法保證準時。',
        specifiedTime: input,
        warning: true,
      };
    }

    return {
      valid: false,
      errorMessage: '不好意思，目前僅提供上午（10-12點）和下午（16-18點）兩個時段。',
      specifiedTime: null,
      warning: false,
    };
  }

  return { valid: true, errorMessage: null, specifiedTime: slot, warning: false };
}

/**
 * 驗證時段 × 配送日的組合
 * 核心規則：
 * - 配送日 = 今天 + 現在 13:00 後 → 不可下單（不管是上午/下午）
 * - 配送日 = 明天 + 現在 13:00 後 → 已過收單時間
 * - 配送日 = 明天 + 現在 14:00 後 + 上午時段 → 雞肉備料時間不足
 * - 配送日 = 明天 + 現在 18:00 後 + 下午時段 → 小菜無法追加
 *
 * @param {string|Date} deliveryDate - 配送日
 * @param {string} input - 客戶輸入的時段
 * @param {Date} [now] - 當前時間（測試用，預設 new Date()）
 * @returns {{ valid: boolean, errorMessage: string|null, errorType: string|null, specifiedTime: string|null, warning: boolean }}
 */
function validateTimeSlotWithDate(deliveryDate, input, now) {
  // 先驗證時段本身是否合法
  const slotResult = validateTimeSlot(input);
  if (!slotResult.valid) {
    return { ...slotResult, errorType: 'invalid_slot' };
  }

  const current = now || new Date();
  const delivery = new Date(deliveryDate);
  if (isNaN(delivery.getTime())) {
    return {
      valid: false,
      errorMessage: '配送日格式有誤，請重新提供。',
      errorType: 'invalid_date',
      specifiedTime: slotResult.specifiedTime,
      warning: false,
    };
  }

  // 計算配送前一日 13:00
  const orderCutoff = new Date(delivery);
  orderCutoff.setDate(orderCutoff.getDate() - 1);
  orderCutoff.setHours(13, 0, 0, 0);

  // 規則 1：配送日 = 今天 + 現在 >= 13:00 → past_cutoff_today
  const isToday = formatDateSimple(current) === formatDateSimple(delivery);
  if (isToday) {
    const todayCutoff = new Date(current);
    todayCutoff.setHours(13, 0, 0, 0);
    if (current >= todayCutoff) {
      return {
        valid: false,
        errorMessage: '不好意思，今天 13:00 後已不收單，無論上午/下午時段都無法訂購。請改訂下個開團日。',
        errorType: 'past_cutoff_today',
        specifiedTime: slotResult.specifiedTime,
        warning: false,
      };
    }
  }

  // 規則 2：配送日 = 明天 + 現在 >= 配送前一日 13:00 → past_order_cutoff
  if (current >= orderCutoff) {
    return {
      valid: false,
      errorMessage: '不好意思，已超過下單時間（配送前一日 13:00 截止）。請改訂下個開團日。',
      errorType: 'past_order_cutoff',
      specifiedTime: slotResult.specifiedTime,
      warning: false,
    };
  }

  // 規則 3：配送日 = 明天 + 上午時段 + 現在 14:00 後 → past_chicken_cutoff
  if (slotResult.specifiedTime === 'morning' && isTomorrow(current, delivery)) {
    const chickenCutoff = new Date(orderCutoff);
    chickenCutoff.setHours(14, 0, 0, 0);
    if (current >= chickenCutoff) {
      return {
        valid: false,
        errorMessage: '不好意思，配送前一日 14:00 後已無法追加雞肉。請改訂下個開團日或選擇下午時段（若有）。',
        errorType: 'past_chicken_cutoff',
        specifiedTime: slotResult.specifiedTime,
        warning: false,
      };
    }
  }

  // 規則 4：配送日 = 明天 + 下午時段 + 現在 18:00 後 → past_side_dish_cutoff
  if (slotResult.specifiedTime === 'afternoon' && isTomorrow(current, delivery)) {
    const sideCutoff = new Date(orderCutoff);
    sideCutoff.setHours(18, 0, 0, 0);
    if (current >= sideCutoff) {
      return {
        valid: false,
        errorMessage: '不好意思，配送前一日 18:00 後已無法追加小菜或變更時段。請改訂下個開團日。',
        errorType: 'past_side_dish_cutoff',
        specifiedTime: slotResult.specifiedTime,
        warning: false,
      };
    }
  }

  // 通過所有規則
  return { ...slotResult, errorType: null };
}

function formatDateSimple(date) {
  if (typeof date === 'string') return date.substring(0, 10);
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isTomorrow(now, target) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateSimple(tomorrow) === formatDateSimple(target);
}

module.exports = { validateTimeSlot, validateTimeSlotWithDate };
