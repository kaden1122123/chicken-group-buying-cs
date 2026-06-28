'use strict';

/**
 * Sanitizer — 字串消毒，防止 SQL/Prompt Injection
 * 移除特殊字符、跳脫單引號等
 */

/**
 * 消毒輸入字串，防止 injection
 * @param {string} input - 任意輸入
 * @returns {string} - 消毒後字串
 */
function sanitize(input) {
  if (input === null || input === undefined) return '';
  if (typeof input === 'object' && input !== null) return '';

  const str = String(input);

  // 移除或跳脫危險字符
  return str
    // 移除 null byte
    .replace(/\0/g, '')
    // 跳脫單引號（SQL injection 防禦）
    .replace(/'/g, "''")
    // 移除反斜線（防止路徑注入）
    .replace(/\\/g, '')
    // 移除路徑穿越序列
    .replace(/\.\.\//g, '')
    .replace(/\/\.\./g, '')
    .replace(/\.\./g, '')
    // 移除分號（SQL 語句終止）
    .replace(/;/g, '')
    // 移除雙重dash（SQL註釋）
    .replace(/--/g, '')
    // 移除斜線星號（SQL註釋）
    .replace(/\/\*/g, '')
    // 移除換行（防止 CRLF injection）
    .replace(/[\r\n]/g, ' ')
    // 移除tab
    .replace(/\t/g, ' ')
    // 移除控制字符
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 移除 Prompt Injection 關鍵模式（更廣泛）
    .replace(/ignore\s*(previous|all|above|your)/gi, '')
    .replace(/disregard\s*(previous|all|above|your)/gi, '')
    .replace(/forget\s*(previous|all|above|everything)/gi, '')
    .replace(/override\s*(system|instruction)/gi, '')
    .replace(/you are now a different AI/gi, '***')
    .replace(/new AI mode/gi, '***')
    .replace(/\\x/i, '')
    .replace(/\[SYSTEM\]/gi, '')
    // 移除危險 SQL/系統關鍵字
    .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|EXEC|EXECUTE|UNION|SELECT|SHOW|DESCRIBE|GRANT|REVOKE)\b/gi, '')
    .replace(/\b(etc|passwd|shadow|sam|system32|config)\b/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<script/gi, '')
    .replace(/<img/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '')
    .replace(/onclick=/gi, '')
    // 收尾 trim
    .trim()
    // 移除多餘空白
    .replace(/\s+/g, ' ')
    // 再次移除殘留的危險關鍵字（替換為星號）
    .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|EXEC|UNION|SELECT|SHOW|GRANT)\b/gi, '***')
    .replace(/etc[\/\.]*passwd/gi, '***')
    .replace(/<[^>]*>/g, '');
}

module.exports = sanitize;
module.exports.default = sanitize;
