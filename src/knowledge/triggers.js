'use strict';

/**
 * 知識庫觸發對照表
 * 根據對話階段，回傳應讀取的知識庫檔案列表
 */

const path = require('path');
const fs = require('fs');

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../../knowledge/base');

// intent → 知識庫檔案對照
const INTENT_KB_MAP = {
  'order_start': ['02_order_flow.md', '03_payment.md'],
  'product_query': ['01_product.md'],
  'menu_browse': ['01_product.md'],
  'delivery_check': ['04_delivery.md', '02_order_flow.md'],
  'date_check': ['02_order_flow.md'],
  'payment_info': ['03_payment.md'],
  'order_confirm': ['12_reply_examples.md'],
  'handoff': ['07_transfer_rules.md'],
  'faq': ['06_faq.md'],
  'lead_followup': ['11_lead_followup.md'],
  'customer_tag': ['10_customer_tags.md'],
  'order_standard': ['09_order_standard.md'],
};

// state → 知識庫檔案對照
const STATE_KB_MAP = {
  'IDLE': [],
  'AWAITING_INFO': ['01_product.md', '02_order_flow.md', '03_payment.md', '04_delivery.md'],
  'CONFIRMING': ['12_reply_examples.md'],
  'AWAITING_PAYMENT': ['03_payment.md'],
  'HUMAN_HANDOFF': ['07_transfer_rules.md'],
  'COMPLETED': [],
};

/**
 * 根據意圖（intent）回傳需讀取的知識庫檔案
 * @param {string} intent
 * @returns {string[]}
 */
function getKBFilesForIntent(intent) {
  return INTENT_KB_MAP[intent] || [];
}

/**
 * 根據狀態（state）回傳需讀取的知識庫檔案
 * @param {string} state
 * @returns {string[]}
 */
function getKBFilesForState(state) {
  return STATE_KB_MAP[state] || [];
}

/**
 * 根據訊息內容猜測意圖
 * @param {string} message
 * @returns {string|null}
 */
function guessIntent(message) {
  if (!message) return null;
  const lower = message.toLowerCase();

  if (lower.includes('有什麼') || lower.includes('菜單') || lower.includes('商品')) {
    return 'product_query';
  }
  if (lower.includes('訂購') || lower.includes('下單') || lower.includes('購買') || lower.includes('我要買')) {
    return 'order_start';
  }
  if (lower.includes('地址') && (lower.includes('配送') || lower.includes('送'))) {
    return 'delivery_check';
  }
  if (lower.includes('日期') || lower.includes('時間') || lower.includes('開團')) {
    return 'date_check';
  }
  if (lower.includes('付款') || lower.includes('轉帳') || lower.includes('現金')) {
    return 'payment_info';
  }

  return null;
}

/**
 * 讀取指定知識庫檔案內容
 * @param {string} filename - 檔案名稱
 * @returns {string} - 檔案內容，若失敗則回傳空字串
 */
function loadKBFile(filename) {
  try {
    const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    console.warn(`[triggers] knowledge file not found: ${filename}`);
    return '';
  } catch (e) {
    console.error(`[triggers] failed to load ${filename}: ${e.message}`);
    return '';
  }
}

/**
 * 根據 intent 讀取並合併所有相關知識庫檔案內容
 * @param {string} intent
 * @returns {string} - 合併後的知識庫內容
 */
function loadKnowledgeForIntent(intent) {
  const files = getKBFilesForIntent(intent);
  if (files.length === 0) return '';

  const contents = files.map((f) => loadKBFile(f)).filter((c) => c.length > 0);
  return contents.join('\n\n---\n\n');
}

/**
 * 根據 state 讀取並合併所有相關知識庫檔案內容
 * @param {string} state
 * @returns {string}
 */
function loadKnowledgeForState(state) {
  const files = getKBFilesForState(state);
  if (files.length === 0) return '';

  const contents = files.map((f) => loadKBFile(f)).filter((c) => c.length > 0);
  return contents.join('\n\n---\n\n');
}

module.exports = {
  getKBFilesForIntent,
  getKBFilesForState,
  guessIntent,
  loadKBFile,
  loadKnowledgeForIntent,
  loadKnowledgeForState,
  INTENT_KB_MAP,
  STATE_KB_MAP,
};
