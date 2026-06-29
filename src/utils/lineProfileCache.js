'use strict';

/**
 * LINE Profile 快取管理器
 * TTL: 10 分鐘（600,000 ms）
 * 所有需要 displayName 的地方都從這裡取，
 * 禁止直接 fallback 到 'Unknown'。
 */

const logger = require('./logger');
const https = require('https');
// P2-5：改用 src/config.js 介面，不自己 regex 解析 config.yaml
// 支援多租戶、js-yaml 缺失 fallback、與 src/ 其他模組一致
const { getLineBotToken } = require('../config');

function loadBotToken() {
  return getLineBotToken();
}

const LINE_BOT_TOKEN = loadBotToken();

// ---------------------------------------------------------------------------
// 快取結構
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 分鐘

// Map<userId, { displayName, pictureUrl, statusMessage, cachedAt }>
const profileCache = new Map();

/**
 * 呼叫 LINE Profile API
 * @param {string} userId
 * @returns {Promise<{ displayName: string, pictureUrl: string, statusMessage: string }>}
 */
function fetchLineProfile(userId) {
  return new Promise((resolve, reject) => {
    if (!LINE_BOT_TOKEN) {
      return reject(new Error('LINE_BOT_TOKEN not configured'));
    }

    const options = {
      hostname: 'api.line.me',
      path: `/v2/bot/profile/${encodeURIComponent(userId)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${LINE_BOT_TOKEN}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              displayName: parsed.displayName || 'LINE用戶',
              pictureUrl: parsed.pictureUrl || '',
              statusMessage: parsed.statusMessage || '',
            });
          } catch (e) {
            reject(new Error(`Failed to parse LINE profile response: ${e.message}`));
          }
        } else {
          reject(new Error(`LINE Profile API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('LINE Profile API timeout'));
    });

    req.end();
  });
}

/**
 * 檢查快取是否有效（未過期）
 * @param {object} cached
 * @returns {boolean}
 */
function isCacheValid(cached) {
  if (!cached) return false;
  return (Date.now() - cached.cachedAt) < CACHE_TTL_MS;
}

/**
 * 取得 LINE 使用者顯示名稱
 * 優先從快取取，無或過期時 call API 並更新快取
 *
 * @param {string} userId - LINE user ID
 * @returns {Promise<string>} displayName（一定會回傳字串）
 */
async function getLineDisplayName(userId) {
  if (!userId) return 'LINE用戶';

  const cached = profileCache.get(userId);

  // 命中快取（未過期）
  if (isCacheValid(cached)) {
    return cached.displayName;
  }

  // 嘗試 call API
  try {
    const profile = await fetchLineProfile(userId);
    profileCache.set(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
      cachedAt: Date.now(),
    });
    return profile.displayName;
  } catch (e) {
    // API 失敗時
    logger.error(`[lineProfileCache] fetch failed for ${userId}`, { err: e.message });

    // 有過期快取 → 使用過期快取（避免使用者看到空名稱）
    if (cached) {
      logger.warn(`[lineProfileCache] using expired cache for ${userId}`);
      return cached.displayName;
    }

    // 沒有任何快取 → 最后 fallback
    return 'LINE用戶';
  }
}

/**
 * 取得完整 Profile 資料（含大頭貼 URL）
 * @param {string} userId
 * @returns {Promise<{ displayName, pictureUrl, statusMessage }>}
 */
async function getLineProfile(userId) {
  if (!userId) {
    return { displayName: 'LINE用戶', pictureUrl: '', statusMessage: '' };
  }

  const cached = profileCache.get(userId);

  if (isCacheValid(cached)) {
    return {
      displayName: cached.displayName,
      pictureUrl: cached.pictureUrl,
      statusMessage: cached.statusMessage,
    };
  }

  try {
    const profile = await fetchLineProfile(userId);
    profileCache.set(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
      cachedAt: Date.now(),
    });
    return profile;
  } catch (e) {
    logger.error(`[lineProfileCache] full profile fetch failed for ${userId}`, { err: e.message });
    if (cached) {
      return {
        displayName: cached.displayName,
        pictureUrl: cached.pictureUrl,
        statusMessage: cached.statusMessage,
      };
    }
    return { displayName: 'LINE用戶', pictureUrl: '', statusMessage: '' };
  }
}

/**
 * 主動讓快取過期（通常在需要強制刷新時調用）
 * @param {string} userId
 */
function invalidateCache(userId) {
  if (userId && profileCache.has(userId)) {
    profileCache.delete(userId);
  }
}

/**
 * 清除所有快取（測試用）
 */
function clearAllCache() {
  profileCache.clear();
}

module.exports = {
  getLineDisplayName,
  getLineProfile,
  invalidateCache,
  clearAllCache,
};
