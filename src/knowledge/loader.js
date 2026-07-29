'use strict';

const path = require('path');
const fs = require('fs');

// 規模化：支援多租戶
// 1. 讀取環境變數 TENANT_ID，未設定則預設 'chicken'
// 2. 多租戶知識庫路徑：knowledge/tenants/{tenant_id}/
//
// Session C C2 (2026-06-27) 變更：移除 knowledge/base/ 向後相容 fallback。
// 之前 base/ 與 tenants/chicken/ 11 個檔案 byte-identical、1 個檔案 (04_delivery.md) 不同步，
// 證明雙重來源會導致內容漂移。改為 tenants/{tenant_id}/ 為 single source of truth。
const DEFAULT_TENANT = process.env.TENANT_ID || 'chicken';
const KB_ROOT = path.join(__dirname, '../../knowledge');
const TENANT_KB_PATH = path.join(KB_ROOT, 'tenants', DEFAULT_TENANT);

if (!fs.existsSync(TENANT_KB_PATH)) {
  throw new Error(`[loader] Knowledge base not found for tenant '${DEFAULT_TENANT}' at ${TENANT_KB_PATH}`);
}

const KB_PATH = TENANT_KB_PATH;

/**
 * 讀取知識庫檔案
 * @param {string} filename
 * @returns {string}
 */
function readKBFile(filename) {
  const filePath = path.join(KB_PATH, filename);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

/**
 * 解析 markdown 表格行為欄位陣列
 * @param {string} line
 * @returns {string[]}
 */
function parseMarkdownTableRow(line) {
  // 表格行格式: | col1 | col2 | col3 |
  if (!line.trim().startsWith('|')) return [];
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * 是否為表格分隔行（|---|---|---|）
 * @param {string} line
 * @returns {boolean}
 */
function isTableSeparator(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return false;
  // 全部是 | - 空白 : 等
  return /^\|?[\s\-:|]+\|?$/.test(trimmed) && trimmed.includes('-');
}

/**
 * 從品項名稱中清除半隻/整隻等規格括號
 * 例：「鹽水雞（半隻）」 → 「鹽水雞」
 * @param {string} name
 * @returns {string}
 */
function cleanItemName(name) {
  return name
    // 清除「（半隻）」「（整隻）」「（全隻）」「（整）」等規格括號（全形/半形）
    .replace(/[（(](半隻|整隻|全隻|整)([）)])?/g, '')
    .replace(/[（(](半隻|整隻|全隻|整)$/g, '')
    // 清除「半隻」「整隻」（沒有括號）
    .replace(/(半隻|整隻|全隻|整)$/g, '')
    // 清除 [需提前兩天預定] 等說明括號
    .replace(/\[.*?\]/g, '')
    // 清除多餘空白
    .replace(/\s+/g, '')
    .trim();
}

/**
 * 讀取商品菜單（01_product.md）
 * 這是商品資料的唯一來源（single source of truth）
 * @returns {{
 *   items: Array<{ name: string, price: number, category: string, isWhole: boolean, originalName: string }>,
 *   prices: Record<string, number>,
 *   raw: string
 * }}
 */
function loadProductMenu() {
  const content = readKBFile('01_product.md');
  const items = [];
  const prices = {};

  const lines = content.split('\n');
  let currentCategory = ''; // 章節名
  let currentSubCategory = ''; // 三級章節
  let tableHeaders = null;
  let colPriceIdx = -1;
  let colNameIdx = -1;

  for (const line of lines) {
    // 抓二級章節 ## xxx
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      currentCategory = h2[1].trim();
      currentSubCategory = '';
      tableHeaders = null;
      continue;
    }

    // 抓三級章節 ### xxx
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      currentSubCategory = h3[1].trim();
      tableHeaders = null;
      continue;
    }

    // 表格分隔行
    if (isTableSeparator(line)) {
      // 確定欄位位置
      if (tableHeaders) {
        colNameIdx = tableHeaders.findIndex((h) => h.includes('品項') || h.includes('名稱'));
        colPriceIdx = tableHeaders.findIndex((h) => h.includes('價格') || h.includes('價'));
      }
      continue;
    }

    // 表格標題行
    if (line.trim().startsWith('|') && !tableHeaders) {
      const cols = parseMarkdownTableRow(line);
      if (cols.length >= 2 && cols[0].includes('品項')) {
        tableHeaders = cols;
        colNameIdx = cols.findIndex((h) => h.includes('品項') || h.includes('名稱'));
        colPriceIdx = cols.findIndex((h) => h.includes('價格') || h.includes('價'));
      }
      continue;
    }

    // 表格資料行
    if (tableHeaders && line.trim().startsWith('|') && colNameIdx >= 0 && colPriceIdx >= 0) {
      const cols = parseMarkdownTableRow(line);
      if (cols.length <= Math.max(colNameIdx, colPriceIdx)) continue;

      const originalName = cols[colNameIdx] || '';
      const priceText = cols[colPriceIdx] || '';

      // 解析價格：取第一個數字
      const priceMatch = priceText.match(/(\d+)/);
      const price = priceMatch ? parseInt(priceMatch[1], 10) : 0;

      if (originalName && price > 0) {
        const name = cleanItemName(originalName);
        if (name) {
          // 判斷分類：以二級章節名（currentCategory）為主，三級（currentSubCategory）為輔
          let category = 'chicken';
          if (currentCategory.includes('小菜')) {
            category = 'side';
          } else if (currentCategory.includes('加購')) {
            category = 'extra';
          } else if (currentSubCategory.includes('小菜')) {
            category = 'side';
          } else if (currentSubCategory.includes('加購')) {
            category = 'extra';
          }

          const isWhole = originalName.includes('整隻');

          items.push({ name, price, category, isWhole, originalName });
          prices[name] = price;
        }
      }
    }
  }

  return { items, prices, raw: content };
}

/**
 * 讀取下單流程（02_order_flow.md）
 * @returns {object}
 */
function loadOrderFlow() {
  const content = readKBFile('02_order_flow.md');
  return { raw: content };
}

/**
 * 讀取付款方式（03_payment.md）
 * @returns {object}
 */
function loadPaymentRules() {
  const content = readKBFile('03_payment.md');
  return { raw: content };
}

/**
 * 讀取配送範圍（04_delivery.md）
 * @returns {object} { allowed: [], denied: [] }
 */
function loadDeliveryAreas() {
  const content = readKBFile('04_delivery.md');
  const allowed = [];
  const denied = [];

  // P1-2 修整：用 markdown section 劃分而非關鍵字匹配。
  // - 任何在「## 配送範圍」或「### 服務區域」到「### 不配送區域」之間的「- xxx」列進 allowed
  // - 任何在「### 不配送區域」後的「- xxx」列進 denied
  // 避免之前的脆弱關鍵字匹配（「北大特區」「三峽」等）。
  const lines = content.split('\n');
  let inDenialSection = false;
  let inAllowedSection = false;
  for (const line of lines) {
    // 進入「不配送區域」section
    if (/^###\s*不配送/.test(line) || /不配送區域/.test(line)) {
      inDenialSection = true;
      inAllowedSection = false;
      continue;
    }
    // 進入「服務區域 / 配送範圍」section
    if (/^###\s*服務區域/.test(line) || /^##\s*配送範圍/.test(line)) {
      inAllowedSection = true;
      inDenialSection = false;
      continue;
    }
    // 進入新一級 section 重置
    if (/^##\s/.test(line) && !/配送範圍/.test(line)) {
      inAllowedSection = false;
      inDenialSection = false;
      continue;
    }

    // 抓「- xxx」list item
    const listMatch = line.match(/^\s*[-*]\s*(.+)/);
    if (!listMatch) continue;
    const area = listMatch[1].trim();
    if (!area || area.length < 2) continue;
    // 跳過「##」或「###」標題（雖然 regex 不會匹配，但要保險）
    if (area.startsWith('#')) continue;

    if (inDenialSection) {
      denied.push(area);
    } else if (inAllowedSection) {
      allowed.push(area);
    }
  }

  return { allowed, denied, raw: content };
}

/**
 * 讀取轉真人條件（07_transfer_rules.md）
 * @returns {object}
 */
function loadTransferRules() {
  const content = readKBFile('07_transfer_rules.md');
  // 解析 14 種條件
  const rules = [];
  const lines = content.split('\n');
  let currentLevel = '';

  for (const line of lines) {
    const levelMatch = line.match(/^### L(\d)/);
    if (levelMatch) {
      currentLevel = levelMatch[1];
      continue;
    }
    const ruleMatch = line.match(/\d+\.\s*(.+?)\s*[:：]/);
    if (ruleMatch && currentLevel) {
      rules.push({
        level: `L${currentLevel}`,
        trigger: ruleMatch[1],
        raw: line,
      });
    }
  }

  return { rules, raw: content };
}

/**
 * 讀取 FAQ（06_faq.md）
 * 格式：`### Q\d?:` 後接段落（沒 `A:` 前綴）
 * 修正 (Round 30 P1.4)：原本 regex 找 `A:` 前綴才 push，導致 0 筆。
 * 修法：累積 Q 後的非空非標題非分隔行作為答案。
 * @returns {Array<{q:string, a:string}>}
 */
function loadFAQ() {
  const content = readKBFile('06_faq.md');
  const faqs = [];
  const lines = content.split('\n');
  let currentQ = '';
  let currentA = '';
  for (const line of lines) {
    // Round 30 P1.4 bug fix：原本 ##? 只 match # 或 ##（1-2 個 #），但 06_faq.md 用 ### Q1:（3 個 #）
    // 修法：改為 ###?（1 或 3 個 #）以支援實際檔案格式
    const qMatch = line.match(/^###?\s*Q\d?[：:]\s*(.+)/);
    if (qMatch) {
      // Push previous Q/A pair（若有）
      if (currentQ && currentA) {
        faqs.push({ q: currentQ, a: currentA.trim() });
      }
      currentQ = qMatch[1];
      currentA = '';
      continue;
    }
    // 累積答案：非空、非標題 (#/##/###)、非分隔 (---) 的行
    if (currentQ && line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
      currentA = currentA ? `${currentA}\n${line.trim()}` : line.trim();
    }
  }
  // Push last Q/A pair（迴圈結束時的未 push）
  if (currentQ && currentA) {
    faqs.push({ q: currentQ, a: currentA.trim() });
  }
  return faqs;
}

module.exports = {
  readKBFile,
  // 內部 helper（Round 30 P1.4 為了測試被 export）
  parseMarkdownTableRow,
  isTableSeparator,
  cleanItemName,
  loadProductMenu,
  loadOrderFlow,
  loadPaymentRules,
  loadDeliveryAreas,
  loadTransferRules,
  loadFAQ,
  KB_PATH,
};
