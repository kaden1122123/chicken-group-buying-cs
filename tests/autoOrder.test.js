'use strict';

/**
 * autoOrder.js 單元測試（Session P0 v7 — 2026-07-18）
 *
 * 涵蓋：
 *  - isStrictConfirmation v2（含 false positive 統計監控）
 *  - getConfirmStats / resetConfirmStats
 *  - 嚴格確認匹配（只接受純文字「確認」+ 標點）
 *  - 排除 line 貼圖 / emoji / 含其他文字
 *
 * 注意：triggerAutoOrder 需要 api-server，本測試只測 isStrictConfirmation + stats
 */

const test = require('node:test');
const assert = require('node:assert');

// 用 child_process 跑 require，避免測試環境污染 module cache
// 直接 require 也行 — 但需要先確認 src/handoff/autoOrder.js 可載入
const autoOrder = require('../src/handoff/autoOrder');

test('isStrictConfirmation v2 — 基本純文字「確認」接受', () => {
  autoOrder.resetConfirmStats();
  assert.strictEqual(autoOrder.isStrictConfirmation('確認'), true);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.total_checked, 1);
  assert.strictEqual(stats.total_accepted, 1);
  assert.strictEqual(stats.rejected_other, 0);
});

test('isStrictConfirmation v2 — 接受「確認」+ 標點', () => {
  autoOrder.resetConfirmStats();
  assert.strictEqual(autoOrder.isStrictConfirmation('確認。'), true);
  assert.strictEqual(autoOrder.isStrictConfirmation('確認！'), true);
  assert.strictEqual(autoOrder.isStrictConfirmation('確認?'), true);
  assert.strictEqual(autoOrder.getConfirmStats().total_accepted, 3);
});

test('isStrictConfirmation v2 — 拒絕 line 貼圖格式', () => {
  autoOrder.resetConfirmStats();
  // line 貼圖至少 3 個字元（regex /^\(.{3,}\)$/）
  assert.strictEqual(autoOrder.isStrictConfirmation('(哈哈哈)'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('(開心笑)'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('(讚讚讚)'), false);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.rejected_sticker, 3);
  assert.strictEqual(stats.total_accepted, 0);
});

test('isStrictConfirmation v2 — 拒絕含 emoji', () => {
  autoOrder.resetConfirmStats();
  assert.strictEqual(autoOrder.isStrictConfirmation('確認 😀'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('確認 👍'), false);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.rejected_emoji, 2);
});

test('isStrictConfirmation v2 — 拒絕含其他文字（false positive 觀察）', () => {
  autoOrder.resetConfirmStats();
  assert.strictEqual(autoOrder.isStrictConfirmation('我確認'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('幫我確認'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('好的確認'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('確認喔'), false);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.rejected_extra_text, 4);
  // 「確認喔」含「確認」關鍵字 → rejected_extra_text
  // 「我確認」「幫我確認」也含「確認」關鍵字 → rejected_extra_text
});

test('isStrictConfirmation v2 — 拒絕與「確認」無關文字', () => {
  autoOrder.resetConfirmStats();
  // 「好」「OK」含關鍵字 → rejected_extra_text（false positive 觀察）
  assert.strictEqual(autoOrder.isStrictConfirmation('好'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('OK'), false);
  // 「收到」「隨機訊息」不含關鍵字 → rejected_other
  assert.strictEqual(autoOrder.isStrictConfirmation('收到'), false);
  assert.strictEqual(autoOrder.isStrictConfirmation('隨機訊息'), false);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.rejected_extra_text, 2, '「好」「OK」含關鍵字 → rejected_extra_text');
  assert.strictEqual(stats.rejected_other, 2, '「收到」「隨機訊息」不含關鍵字 → rejected_other');
});

test('isStrictConfirmation v2 — 統計累積正確', () => {
  autoOrder.resetConfirmStats();
  autoOrder.isStrictConfirmation('確認'); // accepted
  autoOrder.isStrictConfirmation('確認。'); // accepted
  autoOrder.isStrictConfirmation('(哈哈哈)'); // rejected_sticker
  autoOrder.isStrictConfirmation('確認 😀'); // rejected_emoji
  autoOrder.isStrictConfirmation('我確認'); // 含「確認」 → rejected_extra_text
  autoOrder.isStrictConfirmation('隨機訊息'); // 不含關鍵字 → rejected_other

  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.total_checked, 6, 'total_checked 應該是 6');
  assert.strictEqual(stats.total_accepted, 2, 'total_accepted 應該是 2');
  assert.strictEqual(stats.rejected_sticker, 1, 'rejected_sticker 應該是 1');
  assert.strictEqual(stats.rejected_emoji, 1, 'rejected_emoji 應該是 1');
  assert.strictEqual(stats.rejected_extra_text, 1, 'rejected_extra_text 應該是 1（「我確認」含「確認」）');
  assert.strictEqual(stats.rejected_other, 1, 'rejected_other 應該是 1（「隨機訊息」不含關鍵字）');
});

test('isStrictConfirmation v2 — resetConfirmStats 重置所有計數', () => {
  autoOrder.isStrictConfirmation('確認');
  autoOrder.isStrictConfirmation('(貼圖)');
  let stats = autoOrder.getConfirmStats();
  assert.ok(stats.total_checked > 0);

  autoOrder.resetConfirmStats();
  stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.total_checked, 0);
  assert.strictEqual(stats.total_accepted, 0);
  assert.strictEqual(stats.rejected_sticker, 0);
  assert.strictEqual(stats.rejected_emoji, 0);
  assert.strictEqual(stats.rejected_extra_text, 0);
  assert.strictEqual(stats.rejected_other, 0);
});

test('isStrictConfirmation v2 — getConfirmStats 回傳 copy（不可變）', () => {
  autoOrder.resetConfirmStats();
  autoOrder.isStrictConfirmation('確認');
  const stats1 = autoOrder.getConfirmStats();
  assert.strictEqual(stats1.total_accepted, 1);

  // 改 copy 不影響原始 stats
  stats1.total_accepted = 999;
  const stats2 = autoOrder.getConfirmStats();
  assert.strictEqual(stats2.total_accepted, 1, '原始 stats 不應被 copy 修改影響');
});

test('isStrictConfirmation v2 — 非 string 輸入', () => {
  autoOrder.resetConfirmStats();
  assert.strictEqual(autoOrder.isStrictConfirmation(null), false);
  assert.strictEqual(autoOrder.isStrictConfirmation(undefined), false);
  assert.strictEqual(autoOrder.isStrictConfirmation(123), false);
  assert.strictEqual(autoOrder.isStrictConfirmation({}), false);
  const stats = autoOrder.getConfirmStats();
  assert.strictEqual(stats.rejected_other, 4);
  assert.strictEqual(stats.total_checked, 4);
});
