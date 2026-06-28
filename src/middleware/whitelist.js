'use strict';

/**
 * LINE 測試帳號白名單 Middleware
 * 所有請求在進入 handleWebhookEvent 主流程前，先經過這裡檢查。
 *
 * 設定來源：config.yaml → security.allowed_line_users + security.block_others
 * 不再使用脆弱的手動逐行 YAML 解析，改為統一從 config.js 載入
 */

const {
  getAllowedLineUsers,
  getBlockOthers,
  reload: reloadConfigYaml,
} = require('../config');

let _cachedUsers = getAllowedLineUsers();
let _cachedBlockOthers = getBlockOthers();

/**
 * 重新載入白名單設定（測試或熱重載使用）
 */
function reloadConfig() {
  reloadConfigYaml();
  _cachedUsers = getAllowedLineUsers();
  _cachedBlockOthers = getBlockOthers();
}

/**
 * 檢查 userId 是否在白名單內
 * @param {string} userId
 * @returns {boolean}
 */
function isWhitelisted(userId) {
  if (!userId) return false;
  return _cachedUsers.includes(userId);
}

/**
 * 阻擋訊息處理的制式話術
 * @returns {object} LINE text reply object
 */
function getBlockReply() {
  const { textReply } = require('../utils/lineReply');
  return textReply(
    '此服務目前僅供測試，感謝理解 🐔\n' +
    '有問題請聯繫：LINE 社群 @620boqol',
  );
}

/**
 * 白名單檢查主函式
 * 若阻擋 → 回傳 { blocked: true, reply: ... }
 * 若通過 → 回傳 { blocked: false }
 *
 * @param {string} userId - LINE user ID
 * @returns {{ blocked: boolean, reply: object|null }}
 */
function checkWhitelist(userId) {
  // block_others = false 時，不阻擋任何人
  if (!_cachedBlockOthers) {
    return { blocked: false };
  }

  if (!isWhitelisted(userId)) {
    console.warn(`[whitelist] blocked userId: ${userId}`);
    return { blocked: true, reply: getBlockReply() };
  }

  return { blocked: false };
}

/**
 * 取得目前白名單列表（供管理或測試用）
 * @returns {string[]}
 */
function getAllowedUsers() {
  return [..._cachedUsers];
}

/**
 * 取得 block_others 設定
 * @returns {boolean}
 */
function isBlockOthers() {
  return _cachedBlockOthers;
}

module.exports = {
  checkWhitelist,
  isWhitelisted,
  getAllowedUsers,
  reloadConfig,
  getBlockReply,
  isBlockOthers,
};
