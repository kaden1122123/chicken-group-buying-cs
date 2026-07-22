'use strict';

/**
 * lineReply 測試（Session H H2）
 */

const assert = require('assert');
const { test } = require('node:test');

const lineReply = require('../src/utils/lineReply');

test('textReply — 純文字回覆', () => {
  assert.deepStrictEqual(lineReply.textReply('您好，請問需要什麼？'), { type: 'text', text: '您好，請問需要什麼？' });
  assert.deepStrictEqual(lineReply.textReply(''), { type: 'text', text: '' });

  const t3 = lineReply.textReply('訂單 #ORD-20260629-001 已收到');
  assert.strictEqual(t3.type, 'text');
  assert.strictEqual(t3.text, '訂單 #ORD-20260629-001 已收到');
});

test('flexReply — Flex Message 結構', () => {
  const flexContents = { type: 'bubble', body: { type: 'box', contents: [] }, altText: '訂單摘要' };
  const f1 = lineReply.flexReply(flexContents);
  assert.strictEqual(f1.type, 'flex');
  assert.strictEqual(f1.altText, '訂單摘要');
  assert.strictEqual(f1.contents, flexContents);

  const f2 = lineReply.flexReply({ type: 'bubble' });
  assert.strictEqual(f2.altText, '訂單摘要', '無 altText 應預設為「訂單摘要」');
});

test('quickReply — 快速回覆', () => {
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

  // 無 text 屬性 fallback 到 label
  const q2 = lineReply.quickReply('選一個', [{ label: 'A' }, { label: 'B' }]);
  assert.strictEqual(q2.quickReply.items[0].action.text, 'A', '無 text 應 fallback 到 label');

  // action 預設為 message
  const q3 = lineReply.quickReply('測', [{ label: 'X' }]);
  assert.strictEqual(q3.quickReply.items[0].action.type, 'message');

  // 空選項
  const q4 = lineReply.quickReply('無選項', []);
  assert.deepStrictEqual(q4.quickReply.items, []);
});

test('imageReply — 圖片回覆', () => {
  const i1 = lineReply.imageReply('https://example.com/full.jpg', 'https://example.com/preview.jpg');
  assert.strictEqual(i1.type, 'image');
  assert.strictEqual(i1.originalContentUrl, 'https://example.com/full.jpg');
  assert.strictEqual(i1.previewImageUrl, 'https://example.com/preview.jpg');

  // 無 previewImageUrl fallback 到 originalContentUrl
  const i2 = lineReply.imageReply('https://example.com/full.jpg');
  assert.strictEqual(i2.previewImageUrl, 'https://example.com/full.jpg', '無 preview 應 fallback 到 originalContentUrl');

  // previewImageUrl 空字串 fallback
  const i3 = lineReply.imageReply('https://example.com/full.jpg', '');
  assert.strictEqual(i3.previewImageUrl, 'https://example.com/full.jpg', '空 preview 應 fallback');
});
