'use strict';

/**
 * 雞肉團購智能客服 — 設定載入器
 * 讀取 config.yaml + 環境變數，提供統一設定介面
 *
 * 載入策略：
 * 1. 優先使用 js-yaml（若專案內或全域有安裝）
 * 2. 退回手動解析：支援巢狀 YAML 結構、list of strings、list of objects
 * 3. 手動解析覆蓋關鍵 keys: open_dates / ignored_keywords / allowed_line_users / block_others / official / delivery / handoff
 *
 * 使用方式：
 *   const { getOpenDates, getIgnoredKeywords, isIgnoredKeyword } = require('./config');
 */

const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// 規模化：支援多租戶
// 1. 讀取環境變數 TENANT_ID，未設定則預設 'chicken'（向下相容）
// 2. 多租戶設定路徑：config/tenants/{tenant_id}.yaml
// 3. 單租戶（向後相容）設定路徑：config.yaml
const DEFAULT_TENANT = process.env.TENANT_ID || 'chicken';
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const TENANT_CONFIG_PATH = path.join(CONFIG_DIR, 'tenants', `${DEFAULT_TENANT}.yaml`);
const LEGACY_CONFIG_PATH = path.join(__dirname, '..', 'config.yaml'); // 向後相容

// Session C C3 變更：移除 dead code 常數 KNOWLEDGE_DIR / TENANT_KB_PATH / LEGACY_KB_PATH。
// 原本與 loader.js 的 KB 路徑設定重複（loader.js 已實作完整路徑解析），
// config.js 這邊只保留 config 路徑與讀取邏輯。知識庫路徑請改用 src/knowledge/loader.js。

function resolveConfigPath() {
  if (fs.existsSync(TENANT_CONFIG_PATH)) {
    return TENANT_CONFIG_PATH;
  }
  if (fs.existsSync(LEGACY_CONFIG_PATH)) {
    return LEGACY_CONFIG_PATH;
  }
  throw new Error(`[config] No config found for tenant '${DEFAULT_TENANT}' (tried ${TENANT_CONFIG_PATH} and ${LEGACY_CONFIG_PATH})`);
}

const CONFIG_PATH = resolveConfigPath(); // 動態決定（多租戶 or 向後相容）

// ─── 手動 YAML 解析器（不依賴 js-yaml） ───

/**
 * 手動解析 config.yaml 的關鍵子樹
 * 支援：
 * - scalar: key: value
 * - nested: key:\n  child: value
 * - list of strings: - "item"
 * - list of objects: - { key: value, key2: value2 }
 * - comments: # 註解
 * - multi-line: | (略，複雜情境不支援)
 *
 * @param {string} content - YAML 內容
 * @returns {object}
 */
function parseYamlSimple(content) {
  const lines = content.split('\n');
  const root = {};
  // 遞迴 stack: 每個是 { indent, obj }
  const stack = [{ indent: -1, obj: root }];
  // 註：currentListKey / currentListIndent 保留為未來 nested list 解析預留欄位
  // eslint-disable-next-line no-unused-vars
  const currentListKey = null; // 當前在 list 模式中
  // eslint-disable-next-line no-unused-vars
  const currentListIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // 清除行內註解（# 開頭，且不在字串內）
    let line = raw;
    const commentIdx = findInlineCommentIdx(line);
    if (commentIdx !== -1) {
      line = line.substring(0, commentIdx);
    }
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^\s*/)[0].length;
    const text = line.trim();

    // 計算上一層的物件
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // 處理 list item
    if (text.startsWith('- ')) {
      const itemContent = text.substring(2).trim();
      // eslint-disable-next-line no-unused-vars
      const parentIndent = stack[stack.length - 1].indent;
      // 確保 parent 是 array（根據上下文）
      if (!Array.isArray(parent)) {
        // 可能是上一個 key 的 list（但這裡是 list item 開始）
        // 跳過以防不完整解析
        continue;
      }
      // 判斷是 object { k: v, k2: v2 } 還是 string
      if (itemContent.startsWith('{')) {
        try {
          const obj = JSON.parse(itemContent.replace(/'/g, '"'));
          parent.push(obj);
        } catch (e) {
          // 嘗試解析簡單的 { type: "x", label: "y" }
          const obj = {};
          const pairs = itemContent.slice(1, -1).split(',');
          for (const pair of pairs) {
            const m = pair.match(/^\s*(\w+):\s*"?([^"]*?)"?\s*$/);
            if (m) obj[m[1]] = m[2];
          }
          parent.push(obj);
        }
      } else if (itemContent.includes(':')) {
        // "- key: value" 格式（多行 object）
        const obj = {};
        const m = itemContent.match(/^(\w+):\s*"?([^"]*?)"?$/);
        if (m) {
          obj[m[1]] = m[2];
          // 推入新 stack frame for 這個 object
          parent.push(obj);
          stack.push({ indent: indent + 2, obj });
        }
        continue;
      } else {
        // 簡單 string
        parent.push(itemContent.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // 處理 key: value
    const m = text.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();

    if (value === '' || value === '|' || value === '>') {
      // 巢狀結構：下一行是 list 或 object
      // 先看下一行判斷是 array 還是 object
      let nextLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() && !lines[j].trim().startsWith('#')) {
          nextLine = lines[j];
          break;
        }
      }
      if (nextLine.trim().startsWith('-')) {
        parent[key] = [];
        stack.push({ indent, obj: parent[key] });
      } else {
        parent[key] = {};
        stack.push({ indent, obj: parent[key] });
      }
    } else {
      // scalar value
      // 去除包圍的引號
      let cleanValue = value.replace(/^["']|["']$/g, '');
      // 嘗試解析 boolean / number
      if (cleanValue === 'true') cleanValue = true;
      else if (cleanValue === 'false') cleanValue = false;
      else if (/^\d+$/.test(cleanValue)) cleanValue = parseInt(cleanValue, 10);
      else if (/^\d+\.\d+$/.test(cleanValue)) cleanValue = parseFloat(cleanValue);
      parent[key] = cleanValue;
    }
  }

  return root;
}

// ─── 載入設定 ───
let configYaml = {};
let _yamlParser = 'unknown';

/**
 * 找出 # 開頭的行內註解位置
 * 注意：# 必須在字串外（不在引號內）才算註解
 * @param {string} line
 * @returns {number} -1 表示無註解
 */
function findInlineCommentIdx(line) {
  let inQuote = null; // null | '"' | "'"
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === '#') {
        // 確保 # 前不是 key 的一部分（key 中的 # 罕見，但 key: value#no-space 也算註解）
        // 簡化處理：# 之前必須是空白或行首
        if (i === 0 || /\s/.test(line[i - 1])) {
          return i;
        }
      }
    }
  }
  return -1;
}

function loadConfig() {
  let content = '';
  try {
    content = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (e) {
    logger.error(`[config] Failed to read ${CONFIG_PATH}`, { err: e.message });
    return {};
  }

  // 優先使用 js-yaml
  try {
    const yaml = require('js-yaml');
    configYaml = yaml.load(content) || {};
    _yamlParser = 'js-yaml';
    return configYaml;
  } catch (e) {
    // js-yaml 不可用，使用手動解析
    _yamlParser = 'fallback';
    configYaml = parseYamlSimple(content);
    return configYaml;
  }
}

loadConfig();

// ─── 環境變數 ───
let LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const JKO_QR_CODE_URL = process.env.JKO_QR_CODE_URL || '';

// LINE_BOT_TOKEN 支援 file-based 載入（避免 OpenClaw exec redact 密碼）
// Pattern: env LINE_BOT_TOKEN_FILE > /tmp/line-bot-token (default fallback)
// 2026-07-16 加（Hubert 22:35 報告的 P1 修法：手動加 token 不被 redact）
const TOKEN_FILE_SOURCES = [
  process.env.LINE_BOT_TOKEN_FILE,
  '/home/clawuser/.config/chicken/secrets/line-bot-token', // XDG 標準位置（reboot-safe）
  '/tmp/line-bot-token', // legacy fallback
];
if (!LINE_BOT_TOKEN) {
  for (const filePath of TOKEN_FILE_SOURCES) {
    if (!filePath) continue;
    try {
      const trimmed = require('fs').readFileSync(filePath, 'utf8').trim();
      if (trimmed) {
        LINE_BOT_TOKEN = trimmed;
        logger.info(`[config] LINE_BOT_TOKEN loaded from ${filePath} (${LINE_BOT_TOKEN.length} chars)`);
        break;
      }
    } catch (e) {
      // 檔案不存在或讀不到就繼續 fallback
    }
  }
}
if (!LINE_BOT_TOKEN) {
  logger.warn('[config] LINE_BOT_TOKEN 未設定：LINE push 通知會靜默失敗。寫 token 到 /tmp/line-bot-token (mode 600) 或設 env LINE_BOT_TOKEN_FILE');
}

// ─── 匯出設定 ───

/**
 * 開團日期陣列（YYYY-MM-DD 字串）
 * Hubert 每月討論後由此修改
 * @returns {string[]}
 */
function getOpenDates() {
  return configYaml.open_dates || [];
}

/**
 * 檢查某日期是否為開團日
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {boolean}
 */
function isOpenDate(dateStr) {
  const dates = getOpenDates();
  return dates.includes(dateStr);
}

/**
 * 取得忽略關鍵字陣列（100% 符合即不回覆）
 * @returns {string[]}
 */
function getIgnoredKeywords() {
  return configYaml.ignored_keywords || [];
}

/**
 * 檢查訊息是否為需忽略的關鍵字
 * 100% 完全比對（===），不做任何模糊匹配
 * @param {string|*} message
 * @param {string[]} [keywords] - 可選的關鍵字清單，未提供則使用 config.yaml 的預設
 * @returns {boolean}
 */
function isIgnoredKeyword(message, keywords) {
  if (typeof message !== 'string') return false;
  const list = Array.isArray(keywords) ? keywords : getIgnoredKeywords();
  const trimmed = message.trim();
  return list.includes(trimmed);
}

/**
 * 取得 LINE Bot Token
 */
function getLineBotToken() {
  return LINE_BOT_TOKEN;
}

/**
 * 取得 LINE Channel Secret
 */
function getLineChannelSecret() {
  return LINE_CHANNEL_SECRET;
}

/**
 * 取得街口 QR Code URL
 */
function getJkoQrCodeUrl() {
  return JKO_QR_CODE_URL || configYaml.official?.jko_qr_code_url || '';
}

/**
 * 取得官方資訊
 */
function getOfficialInfo() {
  return configYaml.official || {};
}

/**
 * 取得付款設定（Session D3）
 * 回傳 { cash: {...}, transfer: {...}, jko: {...}, linepay: {...} }
 * 各付款方式的硬規則（如現金上限、銀行帳號、LINE Pay ID）都從這裡讀
 * @returns {object}
 */
function getPaymentConfig() {
  return configYaml.payment || {};
}

/**
 * 業務可關閉功能旗標（Session D4）
 * 用 isFeatureEnabled(path) 查詢是否啟用
 * 列在這裡讓 check-quality.sh 能 grep 到、且便於 IDE 跳轉
 *
 * 業務相關（5 個）：
 * - payment.cash.enabled
 * - payment.transfer.enabled
 * - payment.jko.enabled
 * - payment.linepay.enabled
 * - official.line_pay.enabled
 *
 * 系統相關（4 個）：
 * - storage.phase1.enabled
 * - storage.phase2.enabled
 * - handoff.notify_owner.enabled
 * - security.input_sanitization
 */
const FEATURE_FLAGS = [
  'payment.cash.enabled',
  'payment.transfer.enabled',
  'payment.jko.enabled',
  'payment.linepay.enabled',
  'official.line_pay.enabled',
  'storage.phase1.enabled',
  'storage.phase2.enabled',
  'handoff.notify_owner.enabled',
  'security.input_sanitization',
];

/**
 * 檢查 feature flag 是否啟用（Session D4）
 * 雞味客服原本 9 個 enabled flag 都是「dead config」— chicken.yaml 寫了但 src/ 不讀
 * 現在通過這個統一介面讀取，flag 才會真正生效
 *
 * 邏輯：
 * - 用 dot path 查 config 物件
 * - 找到且有 `enabled` 欄位且為 false → 回傳 false（功能關閉）
 * - 找不到路徑 → 預設回傳 true（向後相容，舊 config 不會壞）
 * - 其他情況 → 回傳 true（預設啟用）
 *
 * @param {string} featurePath - 例如 'payment.cash.enabled' 或 'payment.cash'
 * @returns {boolean} - true = 啟用，false = 關閉
 */
function isFeatureEnabled(featurePath) {
  if (!featurePath || typeof featurePath !== 'string') return true;
  // 支援兩種路徑：'payment.cash.enabled' 或 'payment.cash'
  // 如果沒有 .enabled 結尾，自動補上
  const path = featurePath.endsWith('.enabled') ? featurePath : `${featurePath}.enabled`;
  const parts = path.split('.');
  let current = configYaml;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // 路徑不存在：預設啟用（向後相容）
      return true;
    }
  }
  // current 現在是最後一個 segment 的值（應該是 boolean）
  // 如果是 boolean，直接回傳
  // 如果是物件（表示路徑多走了一層），檢查 enabled
  if (typeof current === 'boolean') return current;
  if (current && typeof current === 'object') {
    return current.enabled !== false;
  }
  return true;
}

/**
 * 取得配送規則
 */
function getDeliveryRules() {
  return configYaml.delivery || {};
}

/**
 * 取得轉真人觸發條件
 */
function getHandoffConfig() {
  return configYaml.handoff || {};
}

/**
 * 取得轉真人時的客戶回覆訊息
 * 從 config.handoff.customer_reply 讀取
 * @returns {string} - 回覆文字（可能為空字串）
 */
function getHandoffCustomerReply() {
  const handoff = configYaml.handoff || {};
  return typeof handoff.customer_reply === 'string' ? handoff.customer_reply : '';
}

/**
 * 取得轉真人通知對象的 LINE user ID
 * 從 config.handoff.notify_owner.line_user_id 讀取
 * @returns {string} - LINE user ID（可能為空字串）
 */
function getNotifyOwnerUserId() {
  const handoff = configYaml.handoff || {};
  return handoff.notify_owner && typeof handoff.notify_owner.line_user_id === 'string'
    ? handoff.notify_owner.line_user_id
    : '';
}

/**
 * 取得白名單（allowed_line_users）
 * 從 config.security.allowed_line_users 讀取
 * @returns {string[]} - LINE user ID 陣列
 */
function getAllowedLineUsers() {
  const security = configYaml.security || {};
  return security.allowed_line_users || [];
}

/**
 * 是否阻擋白名單以外的用戶
 * @returns {boolean}
 */
function getBlockOthers() {
  const security = configYaml.security || {};
  return security.block_others === true;
}

module.exports = {
  getOpenDates,
  isOpenDate,
  getIgnoredKeywords,
  isIgnoredKeyword,
  getLineBotToken,
  getLineChannelSecret,
  getJkoQrCodeUrl,
  getOfficialInfo,
  getPaymentConfig,
  isFeatureEnabled,
  FEATURE_FLAGS,
  getDeliveryRules,
  getHandoffConfig,
  getHandoffCustomerReply,
  getNotifyOwnerUserId,
  getAllowedLineUsers,
  getBlockOthers,
  // 載入狀態
  _yamlParser,
  _rawConfig: configYaml,
  // 手動 parser 供測試 / 高階使用
  _parseYamlSimple: parseYamlSimple,
  reload: loadConfig,
  // 規模化介面
  getTenantId: () => DEFAULT_TENANT,
  getConfigPath: () => CONFIG_PATH,
  resolveTenantConfigPath: resolveConfigPath,
};
