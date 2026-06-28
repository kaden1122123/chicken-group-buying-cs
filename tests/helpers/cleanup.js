'use strict';

/**
 * Test Cleanup Helper — 防止測試污染真實訂單資料
 *
 * 背景：
 *   - 2026-06-26 慘案：cleanup-test-orders.sh 太寬，誤刪 6/13 + 6/16 真實訂單
 *   - 2026-06-27 修正：cleanup-test-orders.sh 改為 PROTECTED 清單機制
 *   - 2026-06-28 Session D：本 helper 把保護機制延伸到 src/ 測試層
 *
 * 用途：
 *   - tests/*.test.js 寫 CSV 前，呼叫 assertNotProtected() 保護真實訂單
 *   - tests/*.test.js 清理 CSV 時，呼叫 safeUnlinkCSV() 確保不刪 protected
 *
 * 維護：
 *   - 當 PHASE 新增 git tracked 真實訂單時，把檔名加到 PRODUCTION_DATA_PROTECTED
 *   - 真實訂單 = git ls-files data/orders/<子目錄>/<檔名>.csv（用 `git ls-files data/orders/` 查）
 *
 * 單元測試：tests/helpers/cleanup.test.js
 */

const fs = require('fs');
const path = require('path');

// Git tracked 真實訂單清單
// 來源：git ls-files data/orders/<子目錄>/<檔名>.csv（排除 .gitkeep）
// 6/13 是 PHASE1 第一筆、6/16 是第二筆（從 cleanup-test-orders.sh 沿用）
const PRODUCTION_DATA_PROTECTED = [
  '2026-06-13.csv', // PHASE1 第一筆真實訂單
  '2026-06-16.csv', // PHASE1 第二筆真實訂單
];

// data/orders/{tenant_id}/ 路徑（與 src/order/csvWriter.js 一致）
// helper 預設用 chicken tenant，可由呼叫端覆寫
const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'orders', 'chicken');

/**
 * 驗證檔名是否為受保護的真實訂單
 * @param {string} filename - 純檔名，例如 '2026-06-13.csv'
 * @returns {boolean}
 */
function isProtected(filename) {
  return PRODUCTION_DATA_PROTECTED.includes(filename);
}

/**
 * Assert 檔名不是受保護的（測試寫入/刪除前必跑）
 * @param {string} filename
 * @throws {Error} 如果是受保護檔案，訊息明確指出原因
 */
function assertNotProtected(filename) {
  if (isProtected(filename)) {
    throw new Error(
      `[cleanup] REFUSED: ${filename} is PRODUCTION data (git tracked). ` +
      `Tests must not write/delete this file. ` +
      `Use /tmp/ for test CSV, or remove from PROTECTED list intentionally.`,
    );
  }
}

/**
 * 安全刪除測試 CSV（拒絕刪 protected）
 * @param {string} filename - 純檔名
 * @param {string} [dataDir] - 覆寫預設資料目錄
 * @returns {boolean} true if deleted, false if file not found
 * @throws {Error} 如果是受保護檔案
 */
function safeUnlinkCSV(filename, dataDir) {
  assertNotProtected(filename);
  const dir = dataDir || DEFAULT_DATA_DIR;
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

/**
 * 列出目前受保護的真實訂單清單
 * @returns {string[]} 不會改到原陣列（回傳 copy）
 */
function listProtected() {
  return [...PRODUCTION_DATA_PROTECTED];
}

/**
 * 取得預設資料目錄路徑（給測試顯示/驗證用）
 * @returns {string}
 */
function getDataDir() {
  return DEFAULT_DATA_DIR;
}

module.exports = {
  PRODUCTION_DATA_PROTECTED,
  isProtected,
  assertNotProtected,
  safeUnlinkCSV,
  listProtected,
  getDataDir,
};
