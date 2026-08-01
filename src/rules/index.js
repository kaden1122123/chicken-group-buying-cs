'use strict';

const validatePhone = require('./phoneRule');
const validateAddress = require('./addressRule');
const { validateMenu, parseItems, calculateChickenCount, calculateTotalBoxes, calculateSubtotal } = require('./menuRule');
const { validateDate, getOpenDates, formatOpenDates, getUpcomingOpenDates } = require('./dateRule');
const { validateTimeSlot } = require('./timeSlotRule');
const { validatePayment, PAYMENT_METHODS, PAYMENT_LABELS } = require('./paymentRule');
const { calculatePrice } = require('./priceRule');

/**
 * 一次性驗證所有欄位
 * @param {object} orderData - 訂單資料
 * @param {boolean} isReturningCustomer - 是否為老客戶
 * @returns {Array<{field:string, valid:boolean, errorMessage:string|null}>}
 */
function validateAll(orderData, isReturningCustomer = false) {
  const results = [];

  if (orderData.address !== undefined) {
    results.push({ field: 'address', ...validateAddress(orderData.address) });
  }

  if (orderData.user_phone !== undefined) {
    results.push({ field: 'user_phone', ...validatePhone(orderData.user_phone) });
  }

  if (orderData.menu !== undefined) {
    const result = validateMenu(orderData.menu);
    results.push({ field: 'menu', ...result });
  }

  if (orderData.date !== undefined) {
    const result = validateDate(orderData.date, orderData._rawMessage || '');
    results.push({ field: 'date', ...result });
  }

  if (orderData.timeSlot !== undefined) {
    results.push({ field: 'timeSlot', ...validateTimeSlot(orderData.timeSlot) });
  }

  if (orderData.paymentMethod !== undefined) {
    const totalAmount = orderData.totalAmount || 0;
    const result = validatePayment(orderData.paymentMethod, totalAmount, isReturningCustomer);
    results.push({ field: 'paymentMethod', ...result });
  }

  return results;
}

module.exports = {
  validatePhone,
  validateAddress,
  validateMenu,
  validateDate,
  validateTimeSlot,
  validatePayment,
  calculatePrice,
  parseItems,
  calculateChickenCount,
  calculateTotalBoxes,
  calculateSubtotal,
  validateAll,
  getOpenDates,
  formatOpenDates,
  // Round 33 Bug 2 (Hubert 01:08 11:55)：未來兩週開團日
  getUpcomingOpenDates,
  PAYMENT_METHODS,
  PAYMENT_LABELS,
};
