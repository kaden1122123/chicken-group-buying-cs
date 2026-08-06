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

// intent → 知識庫檔案對照（Round 37.27 全 11 檔 KB 意圖動態加載）
// 11 個 KB 檔：
//   01_product.md        品項菜單（價格必讀）
//   02_order_flow.md     下單流程
//   03_payment.md        付款方式
//   04_delivery.md       配送區域
//   05_promotion.md      促銷/開團規則
//   06_faq.md            FAQ
//   07_transfer_rules.md 轉真人 14 種情況
//   08_owner_info.md     Hubert 老闆資訊
//   10_customer_tags.md  客戶標籤
//   11_lead_followup.md  潜在客戶跟進
//   12_reply_examples.md 回覆範例
// + INDEX.md              總索引（fallback）
const INTENT_KB_MAP = {
  order_start: ['02_order_flow.md', '03_payment.md'],
  // Round 37.27 (Hubert 07:51)：商品 / 菜單意圖必須涵蓋「玉米雞、土雞、煙燻雞、鹽水雞、小菜、港點、菜單、價格、金額」
  product_query: ['01_product.md'],
  menu_browse: ['01_product.md'],
  // Round 37.27 (Hubert 07:51)：配送 / 地址意圖必須涵蓋「地址、配送、免運、運費、三峽、鶯歌、門檻」
  delivery_check: ['04_delivery.md', '02_order_flow.md'],
  date_check: ['02_order_flow.md', '04_delivery.md'],
  // Round 37.27 (Hubert 07:51)：付款 / 轉帳意圖必須涵蓋「付款、轉帳、匯款、街口、LINE Pay、現金」
  payment_info: ['03_payment.md'],
  // Round 37.27 (Hubert 07:51)：促銷 / 開團意圖
  promotion_query: ['05_promotion.md', '02_order_flow.md'],
  faq: ['06_faq.md'],
  // Round 37.27 (Hubert 07:51)：轉真人涵蓋「轉給真人、專人確認、非標準品項」需含 07_transfer_rules
  handoff: ['07_transfer_rules.md'],
  handoff_nonstandard: ['07_transfer_rules.md', '01_product.md'],
  owner_info: ['08_owner_info.md'],
  lead_followup: ['11_lead_followup.md'],
  customer_tag: ['10_customer_tags.md'],
  // 訂單確認含回覆範例 + 付款 + 訂單流程（Round 37.28 加 01_product.md 讓客戶確認時可查真實價格）
  order_confirm: ['01_product.md', '12_reply_examples.md', '03_payment.md', '02_order_flow.md'],
  reply_example: ['12_reply_examples.md'],
  // fallback：意圖不明確 → 加載總索引
  fallback: ['INDEX.md'],
};

// state → 知識庫檔案對照（依對話階段加載必要 KB）
// state → 知識庫檔案對照（依對話階段加載必要 KB）
// Round 37.27 (Hubert 07:51)：IDLE / COMPLETED 預設載入 INDEX.md 總索引（防「連不上資料庫」幻覺 + 讓 AI 有全局視角）
// Round 37.28 (Hubert 09:50) Hubert 09:50：ORDERING + CONFIRMING 強制含 01_product.md
//   - ORDERING 是下單過程中（點品項 / 問價格 / 確認品項的階段），必須讀 01_product.md 才能正確回答價格
//   - CONFIRMING 加上 01_product.md（客戶確認階段如問「幾盒」或「多少錢」要能查真實價格）
//   - 嚴禁回答「稍後幫您核對」或「讀不到菜單」
const STATE_KB_MAP = {
  IDLE: ['INDEX.md'],
  AWAITING_INFO: ['01_product.md', '02_order_flow.md', '03_payment.md', '04_delivery.md', '12_reply_examples.md'],
  ORDERING: ['01_product.md', '02_order_flow.md', '03_payment.md', '04_delivery.md', 'INDEX.md'],
  CONFIRMING: ['01_product.md', '12_reply_examples.md', '03_payment.md', '02_order_flow.md'],
  AWAITING_PAYMENT: ['03_payment.md', '01_product.md'],
  HUMAN_HANDOFF: ['07_transfer_rules.md'],
  COMPLETED: ['INDEX.md'],
  REASK_INFO: ['01_product.md', '12_reply_examples.md'],
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
 * 根據訊息內容猜測意圖（Round 37.27 全 11 檔 KB 覆蓋）
 * 涵蓋：
 *   - 品項 / 菜單 / 價格：玉米雞、土雞、煙燻雞、鹽水雞、小菜、港點、菜單、價格、金額
 *   - 配送 / 地址：地址、配送、免運、運費、三峽、鶯歌、門檻
 *   - 付款 / 轉帳：付款、轉帳、匯款、街口、LINE Pay、現金
 *   - 促銷 / 開團：促銷、優惠、開團、何時
 *   - FAQ：常見問題、問題、怎麼
 *   - 轉真人：轉給真人、專人確認、轉交老闆、非標準品項
 *   - 回覆範例：範例、怎麼回、回應範本
 * fallback：無法明確歸類 → 載入 INDEX.md 總索引
 * @param {string} message
 * @returns {string} - 意圖名稱（永遠不返回 null，未匹配會回 fallback）
 */
function guessIntent(message) {
  if (!message) return 'fallback';
  const lower = message.toLowerCase();

  // 訂單流程
  if (lower.includes('訂購') || lower.includes('下單') || lower.includes('購買') || lower.includes('我要買')) {
    return 'order_start';
  }

  // 品項 / 菜單 / 價格 / 金額（涵蓋所有品項關鍵字）
  if (
    lower.includes('有什麼') || lower.includes('菜單') || lower.includes('商品') ||
    lower.includes('價格') || lower.includes('金額') || lower.includes('多少錢') ||
    lower.includes('玉米雞') || lower.includes('土雞') || lower.includes('烏骨') ||
    lower.includes('煙燻') || lower.includes('鹽水') || lower.includes('小菜') ||
    lower.includes('港點') || lower.includes('港式') || lower.includes('燒賣') ||
    lower.includes('蘿蔔糕') || lower.includes('珍珠丸') || lower.includes('臘味')
  ) {
    return 'product_query';
  }

  // 日期 / 開團（Round 37.27 修：提到 delivery_check 前，避免「配送日期」誤判為 delivery_check）
  if (lower.includes('日期') || lower.includes('時間') || lower.includes('開團') || lower.includes('何時')) {
    return 'date_check';
  }

  // 配送 / 地址（涵蓋三峽、鶯歌、免運、門檻）
  if (
    lower.includes('地址') || lower.includes('配送') ||
    lower.includes('免運') || lower.includes('運費') || lower.includes('門檻') ||
    lower.includes('三峽') || lower.includes('鶯歌')
  ) {
    return 'delivery_check';
  }

  // 付款 / 轉帳 / 匯款 / 街口 / LINE Pay / 現金
  if (
    lower.includes('付款') || lower.includes('轉帳') || lower.includes('匯款') ||
    lower.includes('街口') || lower.includes('line pay') || lower.includes('現金')
  ) {
    return 'payment_info';
  }

  // 促銷 / 優惠
  if (lower.includes('促銷') || lower.includes('優惠') || lower.includes('折扣') || lower.includes('活動')) {
    return 'promotion_query';
  }

  // FAQ（Round 37.27 修嚴：移除「怎麼」避免與付款/配送/地址 等常見問法衝突；
  // 「怎麼付款」應走 payment_info，「怎麼送」應走 delivery_check）
  if (lower.includes('常見問題') || lower.includes('faq') || lower === '問題') {
    return 'faq';
  }

  // 轉真人（含「非標準品項」特殊路徑）
  if (
    lower.includes('轉給真人') || lower.includes('專人確認') ||
    lower.includes('轉交老闆') || lower.includes('非標準') || lower.includes('客訴')
  ) {
    return lower.includes('非標準') ? 'handoff_nonstandard' : 'handoff';
  }

  // Hubert / 老闆資訊
  if (lower.includes('老闆') || lower.includes('hubert') || lower.includes('負責人')) {
    return 'owner_info';
  }

  // 回覆範例查詢
  if (lower.includes('範例') || lower.includes('回應範本') || lower.includes('怎麼回')) {
    return 'reply_example';
  }

  // fallback：意圖不明確 → 載入 INDEX.md 總索引（11 檔結構）
  return 'fallback';
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
 * Round 37.27 (Hubert 07:51)：fallback 預設載入 INDEX.md
 * @param {string} intent
 * @returns {string} - 合併後的知識庫內容
 */
function loadKnowledgeForIntent(intent) {
  return cachedLoadKnowledge(`intent:${intent}`, () => {
    let files = getKBFilesForIntent(intent);
    // Round 37.27 安全網：若 intent 無對應 KB 檔（避免「連不上資料庫」幻覺）
    if (!files || files.length === 0) {
      files = ['INDEX.md'];
    }
    const contents = files.map((f) => readKBFile(f)).filter((c) => c.length > 0);
    // 若所有檔案讀不到（檔案缺失），仍回 INDEX.md fallback（保證不空）
    if (contents.length === 0) {
      const indexContent = readKBFile('INDEX.md');
      if (indexContent) return indexContent;
    }
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
    let files = getKBFilesForState(state);
    // Round 37.27 安全網：未知 state 預設讀 INDEX.md 總索引（防「連不上資料庫」幻覺）
    if (!files || files.length === 0) {
      files = ['INDEX.md'];
    }
    const contents = files.map((f) => readKBFile(f)).filter((c) => c.length > 0);
    if (contents.length === 0) {
      const indexContent = readKBFile('INDEX.md');
      if (indexContent) return indexContent;
    }
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
  // Round 37.27 (Hubert 07:51)：fallback helper（測試與外部使用）
  FALLBACK_INTENT: 'fallback',
};
