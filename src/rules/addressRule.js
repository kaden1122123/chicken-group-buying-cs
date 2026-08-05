'use strict';

// 時區統一設定（Session G.2）
require('../utils/timezone');

const { loadDeliveryAreas } = require('../knowledge/loader');
const { getDeliveryRules } = require('../config');

// Session C C2 變更：移除 dead code 常數 KNOWLEDGE_BASE_PATH。
// 原本指向 knowledge/base/，但從未實際使用（地址資料統一從 loader 拿）。

/**
 * 動態載入允許/拒絕區域關鍵字
 * 來源：knowledge/tenants/chicken/04_delivery.md（Session C C2 後）
 * 用 loader.loadDeliveryAreas() 動態讀，single source of truth = 04_delivery.md
 *
 * P1-2 修整前：使用 hardcode 的 ALLOWED_KEYWORDS / DENIED_KEYWORDS，
 *   跟 04_delivery.md 跟 config.yaml 都不同步。
 * P1-2 修整後：動態讀 loader，04_delivery.md 改了自動生效。
 *
 * 注意：loader 的 regex 解析可能會包含 markdown 結構（`####` `###`）或長例句，
 * 這些不會匹配地址（地址不會有 markdown 字符），所以不影響判斷。
 * 若 04_delivery.md 結構大幅改變，可能需要同時更新 loader.loadDeliveryAreas()。
 */
function getKeywords() {
  const { allowed, denied } = loadDeliveryAreas();
  // Session D3-3：broad 區域關鍵字從 config 讀（替代 hardcode）
  // chicken.yaml 的 delivery.areas.allowed 包含「三峽」「鶯歌」等 broad 關鍵字
  // loader 只抓 04_delivery.md 的 list items，不抓「####」標題
  // 所以這些 broad 關鍵字仍需要 fallback — 從 config 讀而非 hardcode
  const deliveryRules = getDeliveryRules();
  const broadKeywords = (deliveryRules.areas?.allowed || []).filter((k) =>
    k && k.length >= 2 && k.length < 50 && !allowed.includes(k),
  );
  return {
    allowed: [
      ...allowed.filter((k) => k && !k.startsWith('#') && k.length >= 2 && k.length < 50),
      ...broadKeywords,
    ],
    // 04_delivery.md 用「大溪方向」「新店方向」這樣的 broad 關鍵字，但客戶選址寫「大溪區」
    // 不含「方向」。補上 broad 拒絕關鍵字避免誤判。
    denied: [
      ...denied.filter((k) => k && !k.startsWith('#') && k.length >= 2 && k.length < 50).map((k) =>
        k.replace(/方向$/, ''),
      ),
      '大溪', '新店', '龍潭', '楊梅', '桃園', '中壢',
      '土城', '板橋', '中和', '永和', '汐止',
    ],
  };
}

/**
 * 驗證地址是否在配送範圍內
 *
 * P0-1 修整：對「超出配送範圍」與「需人工確認」兩種情境，新增 action 標記
 *   - action: 'handoff_needed'  表示應由 index.js 呼叫 handleHandoff 轉真人
 *   - action: 'reask'           表示客戶輸入不完整，請重新填寫
 *
 * P1-2 修整：配送區域關鍵字改從 loader.loadDeliveryAreas() 動態讀取
 *
 * @param {string} address
 * @returns {{
 *   valid: boolean,
 *   errorMessage: string|null,
 *   action?: string,
 *   reason?: string
 * }}
 */
function validateAddress(address) {
  if (!address || address.trim().length === 0) {
    return {
      valid: false,
      action: 'reask',
      errorMessage: '地址為必填項目，請提供完整地址（含社區或公司名稱）。',
    };
  }

  const addr = address.trim();
  const { allowed: ALLOWED_KEYWORDS, denied: DENIED_KEYWORDS } = getKeywords();

  // Round 37.25 (Hubert 19:06) 外科手術修：只要地址包含「三峽區」就直判 in-range
  // 不論是『三峽區民生街1號』還是『新北市三峽區』，都屬於三峽生活圈
  if (addr.includes('三峽區')) {
    return { valid: true, errorMessage: null };
  }
  // 同樣處理鶯歌區（鶯歌全區可配送）
  if (addr.includes('鶯歌區')) {
    return { valid: true, errorMessage: null };
  }

  const deniedFound = DENIED_KEYWORDS.find((kw) => addr.includes(kw));
  if (deniedFound) {
    return {
      valid: false,
      action: 'handoff_needed',
      reason: 'out_of_range',
      errorMessage: '不好意思，您的地址超出配送範圍，已轉交人工處理。',
    };
  }

  // 檢查是否在允許區域（模糊匹配）
  const allowedFound = ALLOWED_KEYWORDS.some((kw) => addr.includes(kw));
  if (!allowedFound) {
    // 地址不在明確的允許區域，但也不在拒絕區域，需要人工確認
    return {
      valid: false,
      action: 'handoff_needed',
      reason: 'needs_confirmation',
      errorMessage: '感謝您的提問！您的地址是否能配送，需由客服進一步確認。已協助轉交人工處理，將盡快回覆您。',
    };
  }

  return { valid: true, errorMessage: null };
}

module.exports = validateAddress;
