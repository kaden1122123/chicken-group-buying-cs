'use strict';

/**
 * 知識庫觸發對照表
 * 根據對話階段，回傳應讀取的知識庫檔案列表
 */

const fs = require('fs');
const { readKBFile, KB_PATH } = require('./loader');

// Session C C2 變更：KB 讀取統一透過 loader.readKBFile()，
// 移除本地 KNOWLEDGE_BASE_PATH 常數與重複的 loadKBFile() 函式，
// 確保知識庫路徑在 loader.js 是 single source of truth。

// intent → 知識庫檔案對照
const INTENT_KB_MAP = {
  order_start: ['02_order_flow.md', '03_payment.md'],
  product_query: ['01_product.md'],
  menu_browse: ['01_product.md'],
  delivery_check: ['04_delivery.md', '02_order_flow.md'],
  date_check: ['02_order_flow.md'],
  payment_info: ['03_payment.md'],
  order_confirm: ['12_reply_examples.md'],
  handoff: ['07_transfer_rules.md'],
  faq: ['06_faq.md'],
  lead_followup: ['11_lead_followup.md'],
  customer_tag: ['10_customer_tags.md'],
};

// state → 知識庫檔案對照
const STATE_KB_MAP = {
  IDLE: [],
  AWAITING_INFO: ['01_product.md', '02_order_flow.md', '03_payment.md', '04_delivery.md'],
  CONFIRMING: ['12_reply_examples.md'],
  AWAITING_PAYMENT: ['03_payment.md'],
  HUMAN_HANDOFF: ['07_transfer_rules.md'],
  COMPLETED: [],
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
 * 列出所有可用的知識庫檔案
 * @returns {string[]}
 */
function listKnowledgeFiles() {
  return fs.existsSync(KB_PATH)
    ? fs.readdirSync(KB_PATH).filter((f) => f.endsWith('.md'))
    : [];
}

/**
 * 根據 intent 讀取並合併所有相關知識庫檔案內容（30 秒 TTL 快取）
 * @param {string} intent
 * @returns {string} - 合併後的知識庫內容
 */
function loadKnowledgeForIntent(intent) {
  return cachedLoadKnowledge(`intent:${intent}`, () => {
    const files = getKBFilesForIntent(intent);
    if (files.length === 0) return '';
    const contents = files.map((f) => readKBFile(f)).filter((c) => c.length > 0);
    return contents.join('\n\n---\n\n');
  });
}

/**
 * 根據 state 讀取並合併所有相關知識庫檔案內容（30 秒 TTL 快取）
 * @param {string} state
 * @returns {string}
 */
function loadKnowledgeForState(state) {
  return cachedLoadKnowledge(`state:${state}`, () => {
    const files = getKBFilesForState(state);
    if (files.length === 0) return '';
    const contents = files.map((f) => readKBFile(f)).filter((c) => c.length > 0);
    return contents.join('\n\n---\n\n');
  });
}

// ────────────────────────────────────────────────────────────
// Session X4-B：KB 讀取結果快取（30 秒 TTL）
// ────────────────────────────────────────────────────────────
// 目的：避免 LLM 每次觸發都重讀 KB 檔案（隱藏 high freq IO）
// 設計：Map<key, { result, expiresAt }>，預設 30 秒 TTL（環境變數可覆寫）
// 失效：chicken.yaml 變更時可手動 invalidate（自然 TTL 過期為 fallback）

const KB_CACHE_TTL_MS = parseInt(process.env.KNOWLEDGE_CACHE_TTL_MS, 10) || 30 * 1000;
const knowledgeCache = new Map();

/**
 * 清空 KB 快取（Session X4-B）
 * 用途：chicken.yaml 變更時手動清，避免讀到 stale 資料
 */
function clearKnowledgeCache() {
  knowledgeCache.clear();
}

/**
 * 帶快取的 KB loader（內部 helper）
 * @param {string} key - 快取鍵
 * @param {function} loader - 實際讀 KB 函數
 * @returns {*}
 */
function cachedLoadKnowledge(key, loader) {
  const cached = knowledgeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = loader();
  knowledgeCache.set(key, {
    result,
    expiresAt: Date.now() + KB_CACHE_TTL_MS,
  });
  return result;
}

module.exports = {
  getKBFilesForIntent,
  getKBFilesForState,
  guessIntent,
  loadKBFile: readKBFile, // Session C C2 變更：直接轉用 loader.readKBFile()
  loadKnowledgeForIntent,
  loadKnowledgeForState,
  listKnowledgeFiles,
  INTENT_KB_MAP,
  STATE_KB_MAP,
  // Session X4-B：快取相關
  clearKnowledgeCache,
};
