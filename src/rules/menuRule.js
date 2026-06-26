'use strict';

const path = require('path');
const fs = require('fs');
const { loadProductMenu } = require('../knowledge/loader');

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../../knowledge/base');

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

let VALID_ITEMS = [];
let PRICES = {};
let CHICKEN_ITEMS = new Set();
let SIDE_ITEMS = new Set();

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
 * 從原始文字解析品項
 * @param {string} text - 客戶輸入的品項文字
 * @returns {Array<{name:string, quantity:number}>}
 */
function parseItems(text) {
  const items = [];
  if (!text) return items;
  const validItems = getValidItems();

  // P1-3 修整：兩個 pattern 都會對「鹽水雞x2、甘蔗煙燻雞1」抓出重複
  // （第一個 pattern 抓甘蔗煙燻雞 qty 1，第二個 pattern 也抓到甘蔗煙燻雞 qty 1）
  // 解法：加入 items 前檢查去重（相同 name + quantity 不重複加入）
  const isDuplicate = (name, qty) =>
    items.some((it) => it.name === name && it.quantity === qty);

  // 嘗試解析 "鹽水雞x2" 或 "鹽水雞 2盒" 或 "鹽水雞 2" 等格式
  const patterns = [
    /([^\s\d,，xX×]+)\s*[xX×]\s*(\d+)/g,
    /([^\s\d,，]+)\s*(\d+)\s*(盒|份|支|顆|罐)?/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      const qty = parseInt(match[2]) || 1;
      if (validItems.some((v) => v.includes(name) || name.includes(v))) {
        const found = validItems.find((v) => v.includes(name) || name.includes(v));
        if (!isDuplicate(found, qty)) {
          items.push({ name: found, quantity: qty });
        }
      }
    }
  }

  // 如果解析失敗，嘗試簡單匹配品項名
  if (items.length === 0) {
    for (const item of validItems) {
      if (text.includes(item)) {
        // 嘗試找數量
        const qtyMatch = text.match(new RegExp(`(${item})\\s*(\\d+)`));
        const qty = qtyMatch ? parseInt(qtyMatch[2]) : 1;
        items.push({ name: item, quantity: qty });
      }
    }
  }

  return items;
}

/**
 * 驗證品項是否存在於知識庫
 * @param {string} menuText - 客戶輸入的品項文字
 * @returns {{ valid: boolean, errorMessage: string|null, parsedItems: Array }}
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
      .map((i) => i.name)
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