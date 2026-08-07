'use strict';

/**
 * src/tools/orderStatus.js
 * Round 40 (Hubert 14:40) Step 5 — OpenClaw Tool for real-time order status query
 *
 * 用途:
 *   - 客戶在 Line 問「我付款了嗎?」/「處理進度」/「出貨了嗎?」
 *   - LLM Agent (external-user) 透過此 Tool 即時查詢 DB
 *   - 對應 prompt §3 第三段「OpenClaw (LLM 客服) 實時狀態查詢整合」
 *
 * 設計:
 *   - get_order_status(line_user_id):回傳該客戶最近 N 筆訂單狀態
 *   - 查詢 DB(不讀 CSV,DB 為 source of truth)
 *   - 失敗回傳 null + error message(不 throw,讓 LLM 可以處理)
 *
 * 註冊方式:
 *   - external-user agent 需在 OpenClaw config 註冊此 Tool
 *   - 透過 sync-runtime.sh 推至 L3 runtime
 *   - 文件:docs/OPENCLAW_TOOL_REGISTRATION.md(待補)
 */

const db = require('../storage/db');
const logger = require('../utils/logger');

/**
 * 查詢客戶訂單狀態
 * @param {string} line_user_id - LINE user ID
 * @param {Object} [opts]
 * @param {number} [opts.limit=5] - 回傳最近幾筆訂單(預設 5)
 * @returns {{found: boolean, count?: number, orders?: Array, message?: string, error?: string}}
 */
function get_order_status(line_user_id, opts = {}) {
  if (!line_user_id || typeof line_user_id !== 'string') {
    return { found: false, error: 'line_user_id 必填且為字串' };
  }
  const { limit = 5, db: externalDb } = opts;
  try {
    const orders = db.listOrders({ line_user_id, limit }, externalDb);
    if (!orders || orders.length === 0) {
      return {
        found: false,
        line_user_id,
        message: `查無此用戶(${line_user_id})的訂單紀錄`,
      };
    }
    return {
      found: true,
      line_user_id,
      count: orders.length,
      orders: orders.map((o) => ({
        order_id: o.order_id,
        payment_status: o.payment_status,
        order_status: o.order_status,
        tracking_number: o.tracking_number || '(尚未出貨)',
        delivery_date: o.delivery_date,
        time_slot: o.time_slot,
        total_amount: o.total_amount,
        payment_method: o.payment_method,
        created_at: o.created_at,
      })),
    };
  } catch (e) {
    logger.error('[orderStatus] get_order_status failed', { line_user_id, err: e.message });
    return { found: false, error: e.message, line_user_id };
  }
}

module.exports = {
  get_order_status,
};
