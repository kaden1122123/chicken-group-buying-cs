'use strict';

/**
 * Round 37.27 (Hubert 07:51) — 全 11 檔 KB 意圖動態加載測試
 * 涵蓋：商品/菜單/配送/付款/促銷/FAQ/轉真人/老闆/範例/標籤/跟進
 * fallback：無法明確歸類 → INDEX.md
 */

const assert = require('assert');
const { test } = require('node:test');

const {
  guessIntent,
  INTENT_KB_MAP,
  STATE_KB_MAP,
  loadKnowledgeForIntent,
  getKBFilesForIntent,
  FALLBACK_INTENT,
} = require('../src/knowledge/triggers');

// ===== Task 1.1: 商品 / 菜單意圖 =====
test('guessIntent — 玉米雞 → product_query（01_product.md）', () => {
  assert.strictEqual(guessIntent('玉米雞'), 'product_query');
});

test('guessIntent — 土雞 → product_query', () => {
  assert.strictEqual(guessIntent('土雞多少'), 'product_query');
});

test('guessIntent — 煙燻雞 → product_query', () => {
  assert.strictEqual(guessIntent('你們有煙燻雞嗎'), 'product_query');
});

test('guessIntent — 鹽水雞 → product_query', () => {
  assert.strictEqual(guessIntent('鹽水雞'), 'product_query');
});

test('guessIntent — 小菜 → product_query', () => {
  assert.strictEqual(guessIntent('小菜有哪些'), 'product_query');
});

test('guessIntent — 港點 → product_query', () => {
  assert.strictEqual(guessIntent('港式燒賣'), 'product_query');
});

test('guessIntent — 菜單 / 價格 / 金額 → product_query', () => {
  assert.strictEqual(guessIntent('有菜單嗎'), 'product_query');
  assert.strictEqual(guessIntent('價格多少'), 'product_query');
  assert.strictEqual(guessIntent('金額'), 'product_query');
});

test('INTENT_KB_MAP — product_query 含 01_product.md', () => {
  const files = getKBFilesForIntent('product_query');
  assert.ok(files.includes('01_product.md'), 'product_query 必含 01_product.md');
});

// ===== Task 1.2: 配送 / 地址意圖 =====
test('guessIntent — 地址 / 配送 / 免運 / 運費 / 三峽 / 鶯歌 / 門檻 → delivery_check', () => {
  assert.strictEqual(guessIntent('地址'), 'delivery_check');
  assert.strictEqual(guessIntent('配送範圍'), 'delivery_check');
  assert.strictEqual(guessIntent('免運多少'), 'delivery_check');
  assert.strictEqual(guessIntent('運費'), 'delivery_check');
  assert.strictEqual(guessIntent('三峽區可以送嗎'), 'delivery_check');
  assert.strictEqual(guessIntent('鶯歌有配送嗎'), 'delivery_check');
  assert.strictEqual(guessIntent('免運門檻'), 'delivery_check');
});

test('INTENT_KB_MAP — delivery_check 含 04_delivery.md', () => {
  const files = getKBFilesForIntent('delivery_check');
  assert.ok(files.includes('04_delivery.md'));
});

// ===== Task 1.3: 付款 / 轉帳意圖 =====
test('guessIntent — 付款 / 轉帳 / 匯款 / 街口 / LINE Pay / 現金 → payment_info', () => {
  assert.strictEqual(guessIntent('付款方式'), 'payment_info');
  assert.strictEqual(guessIntent('轉帳帳號'), 'payment_info');
  assert.strictEqual(guessIntent('匯款'), 'payment_info');
  assert.strictEqual(guessIntent('街口支付'), 'payment_info');
  assert.strictEqual(guessIntent('LINE Pay'), 'payment_info');
  assert.strictEqual(guessIntent('現金付款'), 'payment_info');
});

test('INTENT_KB_MAP — payment_info 含 03_payment.md', () => {
  const files = getKBFilesForIntent('payment_info');
  assert.ok(files.includes('03_payment.md'));
});

// ===== Task 1.4: 全 11 檔 fallback =====
test('guessIntent — 模糊訊息「你好」→ fallback', () => {
  assert.strictEqual(guessIntent('你好'), FALLBACK_INTENT);
});

test('guessIntent — 空訊息 / null → fallback（永遠不返回 null）', () => {
  assert.strictEqual(guessIntent(''), FALLBACK_INTENT);
  assert.strictEqual(guessIntent(null), FALLBACK_INTENT);
});

test('guessIntent — 數字 / 雜訊 → fallback', () => {
  assert.strictEqual(guessIntent('123'), FALLBACK_INTENT);
  assert.strictEqual(guessIntent('???'), FALLBACK_INTENT);
});

test('INTENT_KB_MAP — fallback 含 INDEX.md（總索引）', () => {
  const files = getKBFilesForIntent(FALLBACK_INTENT);
  assert.ok(files.includes('INDEX.md'), 'fallback 必含 INDEX.md 總索引');
});

test('loadKnowledgeForIntent — fallback 不會回空字串（防「連不上資料庫」幻覺）', () => {
  const content = loadKnowledgeForIntent(FALLBACK_INTENT);
  assert.ok(content.length > 0, 'fallback 必讀到 INDEX.md 內容');
  assert.ok(content.includes('knowledge') || content.includes('INDEX') || content.includes('品項') || content.includes('知識庫'),
    'INDEX.md 應含知識庫結構說明');
});

test('loadKnowledgeForIntent — fallback 安全網（intent 不存在也不回空）', () => {
  const content = loadKnowledgeForIntent('non_existent_intent_xyz');
  assert.ok(content.length > 0, '不存在 intent 應 fallback 讀 INDEX.md');
});

// ===== 新增意圖覆蓋測試 =====
test('guessIntent — 促銷 / 優惠 → promotion_query', () => {
  assert.strictEqual(guessIntent('促銷'), 'promotion_query');
  assert.strictEqual(guessIntent('有優惠嗎'), 'promotion_query');
});

test('guessIntent — FAQ / 常見問題 → faq', () => {
  assert.strictEqual(guessIntent('常見問題'), 'faq');
  // 「怎麼付款」實際是問付款方式 → payment_info（不該走 faq）
  assert.strictEqual(guessIntent('怎麼付款'), 'payment_info');
  // 純 FAQ 問法才走 faq
  assert.strictEqual(guessIntent('你們 FAQ 是什麼'), 'faq');
});

test('guessIntent — 轉給真人 / 專人確認 / 轉交老闆 → handoff', () => {
  assert.strictEqual(guessIntent('轉給真人'), 'handoff');
  assert.strictEqual(guessIntent('專人確認'), 'handoff');
  assert.strictEqual(guessIntent('轉交老闆'), 'handoff');
});

test('guessIntent — 非標準品項 → handoff_nonstandard', () => {
  assert.strictEqual(guessIntent('非標準品項'), 'handoff_nonstandard');
});

test('guessIntent — 老闆 / Hubert → owner_info', () => {
  assert.strictEqual(guessIntent('老闆'), 'owner_info');
  assert.strictEqual(guessIntent('hubert'), 'owner_info');
});

test('guessIntent — 範例 / 怎麼回 → reply_example', () => {
  assert.strictEqual(guessIntent('範例'), 'reply_example');
});

test('guessIntent — 訂購 / 下單 → order_start', () => {
  assert.strictEqual(guessIntent('我要訂購'), 'order_start');
  assert.strictEqual(guessIntent('下單'), 'order_start');
});

// ===== STATE_KB_MAP 測試 =====
test('STATE_KB_MAP — IDLE 載入 INDEX.md fallback', () => {
  assert.ok(STATE_KB_MAP.IDLE.includes('INDEX.md'));
});

test('STATE_KB_MAP — AWAITING_INFO 涵蓋 01/02/03/04 + 12_reply_examples', () => {
  const files = STATE_KB_MAP.AWAITING_INFO;
  assert.ok(files.includes('01_product.md'));
  assert.ok(files.includes('02_order_flow.md'));
  assert.ok(files.includes('03_payment.md'));
  assert.ok(files.includes('04_delivery.md'));
  assert.ok(files.includes('12_reply_examples.md'));
});

// ===== 全部 11 個檔都被某個 intent 引用 =====
test('INTENT_KB_MAP — 涵蓋所有 11 個 KB 檔（除 INDEX.md）', () => {
  const allFiles = new Set();
  Object.values(INTENT_KB_MAP).forEach((files) => files.forEach((f) => allFiles.add(f)));
  const requiredFiles = [
    '01_product.md', '02_order_flow.md', '03_payment.md', '04_delivery.md',
    '05_promotion.md', '06_faq.md', '07_transfer_rules.md', '08_owner_info.md',
    '10_customer_tags.md', '11_lead_followup.md', '12_reply_examples.md',
  ];
  requiredFiles.forEach((f) => {
    assert.ok(allFiles.has(f), `${f} 應在至少一個 intent 中`);
  });
});