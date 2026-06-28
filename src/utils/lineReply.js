'use strict';

/**
 * LINE 回覆格式工具
 */

/**
 * 純文字回覆格式
 * @param {string} text
 * @returns {object} LINE message object
 */
function textReply(text) {
  return {
    type: 'text',
    text,
  };
}

/**
 * Flex Message 格式（訂單確認用）
 * @param {object} contents - Flex Message contents
 * @returns {object} LINE message object
 */
function flexReply(contents) {
  return {
    type: 'flex',
    altText: contents.altText || '訂單摘要',
    contents,
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
};
