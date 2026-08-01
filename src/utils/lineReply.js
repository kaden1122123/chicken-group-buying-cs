'use strict';

/**
 * LINE 回覆格式工具
 */

// ============================================================================
// Round 33 Bug 3 (Hubert 01:08 11:55)：sanitize outbound reply
//
// 背景：客戶聊天室出現 'Exec failed: ....' 之類的作業訊息。
// 來源不明（OpenClaw pipeline / child_process / stderr 漏出），但已造成客服邏輯錯誤。
// 修法：在 textReply / flexReply / quickReply 出口加黑名單 pattern，
// 命中則改為 generic fallback message，避免作業訊息漏到客戶端。
// ============================================================================
const LEAK_PATTERNS = [
  /Exec failed:/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /\bError:\s/i,
  /\s+at\s+(?:async\s+)?[A-Za-z][A-Za-z0-9_.]*\s*\(/, // JS stack trace like 'at foo ('
  /at\s+<anonymous>/i,
  /node_modules\/[^\s]+/,
  /\/usr\/lib\/node_modules\/[^\s]+/,
  /child_process/i,
];

const FALLBACK_MESSAGE = '抱歉，系統遇到一些問題，請稍後再試或聯絡客服 🙏';

/**
 * 清理 outbound reply 文字，避免作業訊息漏到客戶端
 * @param {string} text
 * @returns {string}
 */
function sanitizeReplyText(text) {
  if (typeof text !== 'string') return text;
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) {
      return FALLBACK_MESSAGE;
    }
  }
  return text;
}

/**
 * 純文字回覆格式
 * @param {string} text
 * @returns {object} LINE message object
 */
function textReply(text) {
  return {
    type: 'text',
    text: sanitizeReplyText(text),
  };
}

/**
 * Flex Message 格式（訂單確認用）
 * @param {object} contents - Flex Message contents
 * @returns {object} LINE message object
 */
function flexReply(contents) {
  // Round 33 Bug 3 (Hubert 11:55)：sanitize altText 避免作業訊息漏到客戶端
  // 只有需要 sanitize 時才 spread（保留 reference equality，測試 lineReply.test.js 期待）
  const safeAltText = typeof contents.altText === 'string'
    ? sanitizeReplyText(contents.altText)
    : null;
  const needsNewContents = safeAltText !== null && safeAltText !== contents.altText;
  const finalContents = needsNewContents
    ? { ...contents, altText: safeAltText }
    : contents;
  return {
    type: 'flex',
    altText: safeAltText || contents.altText || '訂單摘要',
    contents: finalContents,
  };
}

/**
 * Quick Reply 格式
 * @param {string} text - 訊息文字
 * @param {Array<{label:string, action:string}>} options - 快速回覆選項
 * @returns {object} LINE message object
 */
function quickReply(text, options) {
  const items = options.map((opt) => ({
    type: 'action',
    action: {
      type: opt.action || 'message',
      label: opt.label,
      text: opt.text || opt.label,
    },
  }));
  return {
    type: 'text',
    text,
    quickReply: {
      items,
    },
  };
}

/**
 * 圖片回覆格式
 * @param {string} originalContentUrl
 * @param {string} previewImageUrl
 * @returns {object}
 */
function imageReply(originalContentUrl, previewImageUrl) {
  return {
    type: 'image',
    originalContentUrl,
    previewImageUrl: previewImageUrl || originalContentUrl,
  };
}

module.exports = {
  textReply,
  flexReply,
  quickReply,
  imageReply,
  sanitizeReplyText,
};
