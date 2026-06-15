'use strict';

const { CHICKEN_ITEMS, SIDE_ITEMS, PRICES } = require('./menuRule');

const DELIVERY_FEE = 0; // 目前免運
const MIN_SIDE_DISH_FOR_DELIVERY = 350; // 小菜滿 NT$350 免運

/**
 * 計算訂單金額
 * 雞肉1盒以上免運、小菜滿$350免運、總金額=商品小計+運費
 *
 * @param {Array<{name:string, quantity:number}>} items
 * @returns {{
 *   subtotal: number,
 *   deliveryFee: number,
 *   totalAmount: number,
 *   chickenCount: number,
 *   sideCount: number,
 *   totalBoxes: number,
 *   hasChicken: boolean,
 *   sideSubtotal: number,
 *   chickenSubtotal: number
 * }}
 */
function calculatePrice(items) {
  let chickenSubtotal = 0;
  let sideSubtotal = 0;
  let extraSubtotal = 0;
  let chickenBoxes = 0;
  let sideBoxes = 0;
  let extraBoxes = 0;

  for (const item of items) {
    const price = PRICES[item.name] || 0;
    const qty = item.quantity;

    if (CHICKEN_ITEMS.has(item.name)) {
      chickenSubtotal += price * qty;
      chickenBoxes += qty;
    } else if (SIDE_ITEMS.has(item.name)) {
      sideSubtotal += price * qty;
      sideBoxes += qty;
    } else {
      // 加購品
      extraSubtotal += price * qty;
      extraBoxes += qty;
    }
  }

  const subtotal = chickenSubtotal + sideSubtotal + extraSubtotal;

  // 免運判斷：雞肉1盒以上 或 小菜滿$350
  const hasChicken = chickenBoxes > 0;
  const sideMeetsMinimum = sideSubtotal >= MIN_SIDE_DISH_FOR_DELIVERY;

  let deliveryFee = DELIVERY_FEE;
  if (!hasChicken && !sideMeetsMinimum) {
    deliveryFee = 100; // 不符合免運條件，收運費（可調整）
  }

  const totalAmount = subtotal + deliveryFee;
  const totalBoxes = chickenBoxes + sideBoxes + extraBoxes;

  return {
    subtotal,
    deliveryFee,
    totalAmount,
    chickenCount: chickenBoxes * 0.5, // 1盒=半隻
    sideCount: sideBoxes,
    totalBoxes,
    hasChicken,
    sideSubtotal,
    chickenSubtotal,
  };
}

module.exports = { calculatePrice, DELIVERY_FEE, MIN_SIDE_DISH_FOR_DELIVERY };