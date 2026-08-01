'use strict';

const { loadProductMenu } = require('../knowledge/loader');

// Session C C2 變更：移除 dead code 常數 KNOWLEDGE_BASE_PATH。
// 原本指向 knowledge/base/，但從未實際使用（商品資料統一從 loader 拿）。

// ============================================================================
// 商品資料來源：01_product.md（單一真相源）
// 不再硬編碼 VALID_ITEMS / PRICES，所有品項與價格動態從知識庫載入
// ============================================================================

let _menuCache = null;
let _validItems = null;
let _prices = null;
let _chickenItems = null;
let _sideItems = null;

/**
 * 取得商品菜單資料（含快取）
 * @returns {{ items: Array, prices: object }}
 */
function getMenu() {
  if (!_menuCache) {
    _menuCache = loadProductMenu();
    _validItems = null;
    _prices = null;
    _chickenItems = null;
    _sideItems = null;
  }
  return _menuCache;
}

function ensureDerived() {
  if (!_validItems) {
    getMenu();
    _validItems = _menuCache.items.map((i) => i.name);
    _prices = { ..._menuCache.prices };
    _chickenItems = new Set(_menuCache.items.filter((i) => i.category === 'chicken').map((i) => i.name));
    _sideItems = new Set(_menuCache.items.filter((i) => i.category === 'side').map((i) => i.name));
  }
}

/**
 * 清除商品菜單快取（測試或熱重載使用）
 */
function clearMenuCache() {
  _menuCache = null;
  _validItems = null;
  _prices = null;
  _chickenItems = null;
  _sideItems = null;
}

// ============================================================================
// 「常數型」介面（向下相容舊 import）
// 透過 Object.defineProperty getter 攔截，確保即使在 module load 後才使用，也能取到最新值
// ============================================================================

// eslint-disable-next-line no-unused-vars
const VALID_ITEMS = [];
// eslint-disable-next-line no-unused-vars
const PRICES = {};
// eslint-disable-next-line no-unused-vars
const CHICKEN_ITEMS = new Set();
// eslint-disable-next-line no-unused-vars
const SIDE_ITEMS = new Set();

// 用物件 getter 轉接到 ensureDerived
Object.defineProperty(module.exports, 'VALID_ITEMS', {
  get() { ensureDerived(); return _validItems; },
  configurable: true,
});
Object.defineProperty(module.exports, 'PRICES', {
  get() { ensureDerived(); return _prices; },
  configurable: true,
});
Object.defineProperty(module.exports, 'CHICKEN_ITEMS', {
  get() { ensureDerived(); return _chickenItems; },
  configurable: true,
});
Object.defineProperty(module.exports, 'SIDE_ITEMS', {
  get() { ensureDerived(); return _sideItems; },
  configurable: true,
});

// 同時也導出函數型 API（推薦用法）
function getValidItems() { ensureDerived(); return [..._validItems]; }
function getPrices() { ensureDerived(); return { ..._prices }; }
function getChickenItems() { ensureDerived(); return [..._chickenItems]; }
function getSideItems() { ensureDerived(); return [..._sideItems]; }

/**
 * 從原始文字解析品項（Round 32 Bug 2c 修整：長度優先匹程，避免「煙燻」誤判為「甘蔗煙燻雞」）
 * @param {string} text - 客戶輸入的品項文字
 * @returns {Array<{name:string, quantity:number}>}
 */
function parseItems(text) {
  const items = [];
  if (!text) return items;
  const validItems = getValidItems();

  // Round 32 Bug 2c：按品項名長度降序排，最長的（最精確的）優先匹配
  // 並拆分量為「剛出現在品項名後」才計入，避免「煙燻 1 甘蔗煙燻雞 1」被誤讀
  const isDuplicate = (name, qty) =>
    items.some((it) => it.name === name && it.quantity === qty);

  const sortedByLength = [...validItems].sort((a, b) => b.length - a.length);
  let remaining = text;

  // 每個匹配後重啟 for 迴圈，避免「鹽水雞x2 鹽水雞x3」只匹配到一次
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let matched = false;
    for (const validName of sortedByLength) {
      if (remaining.includes(validName)) {
        // 抽離品項名後面的數字（最多理 1 個）
        const idx = remaining.indexOf(validName);
        const after = remaining.substring(idx + validName.length);
        const qtyMatch = after.match(/^\s*[xX×]?\s*(\d+)?/);
        const qty = qtyMatch && qtyMatch[1] ? parseInt(qtyMatch[1]) : 1;
        if (!isDuplicate(validName, qty)) {
          items.push({ name: validName, quantity: qty });
        }
        // 從 remaining 移除已匹配區段
        const matchedLen = idx + validName.length + (qtyMatch ? qtyMatch[0].length : 0);
        remaining = remaining.substring(0, idx) + remaining.substring(matchedLen);
        matched = true;
        break; // 重啟 while loop 檢查其他品項
      }
    }
    if (!matched) break;
  }

  return items;
}

/**
 * 找出文字中所有「模糊關鍵字」對應的品項（Round 32 Bug 2c）
 * 例如「煙燻」對應 甘蔗煙燻雞 / 甘蔗煙燻公雞 / 煙燻鴨肉 / 煙燻鵝肉 / 秘製煙燻無骨鳳爪
 * @param {string} text - 客戶輸入
 * @returns {string[]} - 所有候選品項名稱（不重複）
 */
function findAmbiguousCandidates(text) {
  const validItems = getValidItems();
  // 這些關鍵字可能代表多個品項，需要客戶確認
  const AMBIGUOUS_KEYWORDS = ['煙燻', '鹽水', '公雞', '玉米雞', '土雞', '烏骨', '雞', '鴨', '鵝'];
  const matches = new Set();

  for (const kw of AMBIGUOUS_KEYWORDS) {
    if (text.includes(kw)) {
      const candidates = validItems.filter((v) => v.includes(kw));
      // 只在該關鍵字對應 2+ 個品項時才算 ambiguous
      if (candidates.length >= 2) {
        candidates.forEach((c) => matches.add(c));
      }
    }
  }

  return Array.from(matches);
}

/**
 * 驗證品項是否存在於知識庫（Round 32 Bug 2c 加 ambiguous 處理）
 * @param {string} menuText - 客戶輸入的品項文字
 * @returns {{ valid: boolean, errorMessage: string|null, parsedItems: Array, ambiguous?: boolean, candidates?: string[] }}
 */
function validateMenu(menuText) {
  if (!menuText || menuText.trim().length === 0) {
    return {
      valid: false,
      errorMessage: '品項為必填項目，請填寫想訂購的商品。',
      parsedItems: [],
    };
  }

  const items = parseItems(menuText);
  const validItems = getValidItems();

  if (items.length === 0) {
    // Round 32 Bug 2c：如果 parseItems 沒匹配到，但有模糊關鍵字對應多個品項 → 詢問
    const candidates = findAmbiguousCandidates(menuText);
    if (candidates.length >= 2) {
      return {
        valid: false,
        ambiguous: true,
        candidates,
        errorMessage: `不好意思，「${menuText}」可能指多個品項，請問您要的是哪一個？\n\n${candidates.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n請直接回覆完整品項名稱。`,
        parsedItems: [],
      };
    }
    return {
      valid: false,
      errorMessage: '不好意思，請確認品項名稱，我們沒有這個品項喔。',
      parsedItems: [],
    };
  }

  // 檢查是否有無效品項
  const invalidItems = items.filter((it) => !validItems.includes(it.name));
  if (invalidItems.length > 0) {
    return {
      valid: false,
      errorMessage: `不好意思，請確認品項名稱，以下品項我們沒有：${invalidItems.map((i) => i.name).join('、')}`,
      parsedItems: items,
    };
  }

  return { valid: true, errorMessage: null, parsedItems: items };
}

/**
 * 計算雞隻數（1盒=半隻，整隻=2盒）
 * @param {Array<{name:string, quantity:number}>} items
 * @returns {number}
 */
function calculateChickenCount(items) {
  let count = 0;
  const chickenItems = getChickenItems();
  const chickenSet = new Set(chickenItems);
  // 整隻品項（需 isWhole=true）
  const wholeNames = new Set(
    (typeof getMenu === 'function' ? getMenu().items : [])
      .filter((i) => i.isWhole)
      .map((i) => i.name),
  );
  for (const item of items) {
    if (chickenSet.has(item.name)) {
      count += item.quantity * 0.5; // 半隻
      if (wholeNames.has(item.name)) {
        count += item.quantity * 0.5; // 整隻加半隻 = 1隻
      }
    }
  }
  return count;
}

/**
 * 計算總盒數
 * @param {Array<{name:string, quantity:number}>} items
 * @returns {number}
 */
function calculateTotalBoxes(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * 計算商品小計
 * @param {Array<{name:string, quantity:number}>} items
 * @returns {number}
 */
function calculateSubtotal(items) {
  const prices = getPrices();
  return items.reduce((sum, item) => {
    const price = prices[item.name] || 0;
    return sum + price * item.quantity;
  }, 0);
}

module.exports = {
  validateMenu,
  parseItems,
  // Round 32 Bug 2c：匯出 findAmbiguousCandidates 供 awaitingInfo 判斷
  findAmbiguousCandidates,
  calculateChickenCount,
  calculateTotalBoxes,
  calculateSubtotal,
  getValidItems,
  getPrices,
  getChickenItems,
  getSideItems,
  getMenu,
  clearMenuCache,
  // 向下相容 (getter properties)：
  get VALID_ITEMS() { ensureDerived(); return _validItems; },
  get PRICES() { ensureDerived(); return _prices; },
  get CHICKEN_ITEMS() { ensureDerived(); return _chickenItems; },
  get SIDE_ITEMS() { ensureDerived(); return _sideItems; },
};
