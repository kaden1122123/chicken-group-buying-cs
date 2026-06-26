'use strict';

/**
 * P1-3: menuRule.parseItems 去重驗證測試
 *
 * 原本 menuRule.parseItems 跑兩個 regex pattern 都會對「鹽水雞x2、甘蔗煙燻雞1」
 * 抓出「甘蔗煙燻雞 qty 1」兩次（第一個跟第二個 pattern 都匹配），導致客戶下單
 * 數量變成兩倍。
 *
 * 修整：parseItems 加入 isDuplicate 檢查，相同 (name, quantity) 不重複加入。
 *
 * 本測試驗證：
 * 1. 兩個 pattern 對相同輸入不會重複加入
 * 2. 同品項不同數量會保留為不同 items（合理）
 * 3. 既有 testMenu 案例仍能正確 parse（valid=true）
 */

const assert = require('assert');

const { parseItems, validateMenu } = require('../src/rules/menuRule');

console.log('\n=== Parse Items Dedup Tests (P1-3) ===');

// ─── 1. P1-3 核心：兩個 pattern 對同一輸入去重 ───
console.log('\n--- 兩個 pattern 去重 ---');

const r1 = parseItems('鹽水雞x2、甘蔗煙燻雞1');
console.log(`  parsed: ${JSON.stringify(r1)}`);
assert.strictEqual(r1.length, 2, '應只有 2 個 items，無重複');
assert.ok(
  r1.some((it) => it.name === '鹽水雞' && it.quantity === 2),
  '應有 鹽水雞 x2'
);
assert.ok(
  r1.some((it) => it.name === '甘蔗煙燻雞' && it.quantity === 1),
  '應有 甘蔗煙燻雞 x1'
);
console.log('  ✓ 無重複');

// ─── 2. 「空格+數字」格式（第二個 pattern 專屬） ───
console.log('\n--- 空格+數字 格式 ---');

const r2 = parseItems('鹽水雞 2');
console.log(`  parsed: ${JSON.stringify(r2)}`);
assert.strictEqual(r2.length, 1, '應只有 1 個 item');
assert.strictEqual(r2[0].name, '鹽水雞');
assert.strictEqual(r2[0].quantity, 2);
console.log('  ✓ 單一 item');

const r2b = parseItems('鹽水雞 2盒');
console.log(`  parsed: ${JSON.stringify(r2b)}`);
assert.strictEqual(r2b.length, 1);
assert.strictEqual(r2b[0].quantity, 2);
console.log('  ✓ 帶「盒」單位也正確');

// ─── 3. 同品項不同數量（不應被去重） ───
console.log('\n--- 同品項不同數量 ---');

const r3 = parseItems('鹽水雞x2 鹽水雞x3');
console.log(`  parsed: ${JSON.stringify(r3)}`);
assert.strictEqual(r3.length, 2, '應有 2 個 items（同品項不同數量）');
assert.ok(r3.some((it) => it.name === '鹽水雞' && it.quantity === 2));
assert.ok(r3.some((it) => it.name === '鹽水雞' && it.quantity === 3));
console.log('  ✓ 同品項不同數量保留');

const r3b = parseItems('鹽水雞 1 鹽水雞 2');
console.log(`  parsed: ${JSON.stringify(r3b)}`);
assert.strictEqual(r3b.length, 2);
console.log('  ✓ 空格格式同品項不同數量也保留');

// ─── 4. 三個品項混合 ───
console.log('\n--- 三品項混合 ---');

const r4 = parseItems('鹽水雞x2、甘蔗煙燻雞1、秘製黑胡椒蒜味毛豆 3');
console.log(`  parsed: ${JSON.stringify(r4)}`);
assert.strictEqual(r4.length, 3, '應有 3 個 items');
console.log('  ✓ 三品項無重複');

// ─── 5. validateMenu 確認有效（既有 testMenu 行為） ───
console.log('\n--- validateMenu 既有行為 ---');

function testMenu(input, expectedValid, label) {
  const result = validateMenu(input);
  assert.strictEqual(result.valid, expectedValid, `${label}: expected ${expectedValid}`);
  console.log(`  ${expectedValid ? '✓' : '✗'} ${label}: "${input}" → ${result.valid ? 'VALID' : 'INVALID'}`);
}

testMenu('鹽水雞2', true, '簡單數字');
testMenu('甘蔗煙燻雞 1', true, '空格+數字');
testMenu('秘製黑胡椒蒜味毛豆 2', true, '小菜');
testMenu('鹽水雞x2、甘蔗煙燻雞1', true, 'P1-3 重點案例');
testMenu('玉米雞', true, '無數量（預設 1）');
testMenu('土雞', true, '無數量（預設 1）');
testMenu('雞脖子5', true, '加購品');
testMenu('珍珠奶茶', false, '不存在的品項');
testMenu('炸雞排', false, '不存在的品項');
testMenu('', false, '空字串');

console.log('\n========================================');
console.log('ALL PARSE ITEMS DEDUP TESTS PASSED ✓');
console.log('========================================\n');