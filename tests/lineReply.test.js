'use strict';

/**
 * lineReply 測試（Session H H2）
 *
 * 目的：驗證 src/utils/lineReply.js 的 4 個 LINE 回覆格式函數
 *
 * 測試情境：
 * 1. textReply：純文字格式
 * 2. flexReply：Flex Message 格式
 * 3. quickReply：快速回覆格式
 * 4. imageReply：圖片回覆格式
 */

const assert = require('assert');

console.log('\n=== LineReply Tests ===');

const lineReply = require('../src/utils/lineReply');

console.log(`\n--- 情境 1: textReply 純文字 ---`);

// 基本
const t1 = lineReply.textReply('您好，請問需要什麼？');
assert.deepStrictEqual(t1, { type: 'text', text: '您好，請問需要什麼？' });
console.log('  ✓ 基本純文字回覆結構正確');

// 空字串
const t2 = lineReply.textReply('');
assert.deepStrictEqual(t2, { type: 'text', text: '' });
console.log('  ✓ 空字串仍回傳合法結構');

// 含特殊字元
const t3 = lineReply.textReply('訂單 #ORD-20260629-001 已收到');
assert.strictEqual(t3.type, 'text');
assert.strictEqual(t3.text, '訂單 #ORD-20260629-001 已收到');
console.log('  ✓ 含特殊字元（#、數字）正確保留');

console.log(`\n--- 情境 2: flexReply Flex Message ---`);

// 基本 Flex Message
const flexContents = {
  type: 'bubble',
  body: { type: 'box', contents: [] },
  altText: '訂單摘要',
};
const f1 = lineReply.flexReply(flexContents);
assert.strictEqual(f1.type, 'flex');
assert.strictEqual(f1.altText, '訂單摘要');
assert.strictEqual(f1.contents, flexContents);
console.log('  ✓ Flex Message 結構正確（type/altText/contents）');

// 沒有 altText 時預設為「訂單摘要」
const f2 = lineReply.flexReply({ type: 'bubble' });
assert.strictEqual(f2.altText, '訂單摘要', '無 altText 應預設為「訂單摘要」');
console.log('  ✓ 無 altText 預設為「訂單摘要」');

console.log(`\n--- 情境 3: quickReply 快速回覆 ---`);

// 基本
const options1 = [
  { label: '是', action: 'message', text: '確認' },
  { label: '否', action: 'message', text: '取消' },
];
const q1 = lineReply.quickReply('請選擇', options1);
assert.strictEqual(q1.type, 'text');
assert.strictEqual(q1.text, '請選擇');
assert.ok(Array.isArray(q1.quickReply.items));
assert.strictEqual(q1.quickReply.items.length, 2);
assert.strictEqual(q1.quickReply.items[0].type, 'action');
assert.strictEqual(q1.quickReply.items[0].action.label, '是');
assert.strictEqual(q1.quickReply.items[0].action.text, '確認');
console.log('  ✓ Quick Reply 結構正確（type/text/items）');

// 沒有 text 時 fallback 到 label
const q2 = lineReply.quickReply('選一個', [{ label: 'A' }, { label: 'B' }]);
assert.strictEqual(q2.quickReply.items[0].action.text, 'A', '無 text 應 fallback 到 label');
assert.strictEqual(q2.quickReply.items[1].action.text, 'B');
console.log('  ✓ 無 text 屬性 fallback 到 label');

// action 預設為 message
const q3 = lineReply.quickReply('測', [{ label: 'X' }]);
assert.strictEqual(q3.quickReply.items[0].action.type, 'message', '無 action 預設為 message');
console.log('  ✓ 無 action 屬性預設為 message');

// 空選項
const q4 = lineReply.quickReply('無選項', []);
assert.deepStrictEqual(q4.quickReply.items, []);
console.log('  ✓ 空選項回傳空 items 陣列');

console.log(`\n--- 情境 4: imageReply 圖片 ---`);

// 基本
const i1 = lineReply.imageReply('https://example.com/full.jpg', 'https://example.com/preview.jpg');
assert.strictEqual(i1.type, 'image');
assert.strictEqual(i1.originalContentUrl, 'https://example.com/full.jpg');
assert.strictEqual(i1.previewImageUrl, 'https://example.com/preview.jpg');
console.log('  ✓ 圖片回覆結構正確（originalContentUrl/previewImageUrl）');

// 沒有 previewImageUrl 時 fallback 到 originalContentUrl
const i2 = lineReply.imageReply('https://example.com/full.jpg');
assert.strictEqual(i2.previewImageUrl, 'https://example.com/full.jpg', '無 preview 應 fallback 到 originalContentUrl');
console.log('  ✓ 無 previewImageUrl fallback 到 originalContentUrl');

// previewImageUrl 空字串時 fallback
const i3 = lineReply.imageReply('https://example.com/full.jpg', '');
assert.strictEqual(i3.previewImageUrl, 'https://example.com/full.jpg', '空 preview 應 fallback');
console.log('  ✓ previewImageUrl 空字串 fallback');

console.log('\n=== LineReply Tests: ALL PASSED ===');