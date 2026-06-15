'use strict';

const assert = require('assert');
const {
  parseActionBlocks,
  parseKeyValue,
  processBlock,
  processWriteOrder,
  processUpdatePayment,
} = require('../scripts/order-listener');

console.log('\n=== Order Listener Tests ===');

// ========== 1. parseKeyValue ==========
console.log('\n--- parseKeyValue ---');

const r1 = parseKeyValue(`姓名: 王小明
電話: 0912345678
地址: 新北市三峽區...
日期: 2026-06-16
時段: 上午
總金額: 480`);
assert.strictEqual(r1['姓名'], '王小明');
assert.strictEqual(r1['電話'], '0912345678');
assert.strictEqual(r1['總金額'], 480);  // 數字轉型
assert.strictEqual(r1['時段'], '上午');
console.log('  ✓ K=V 解析');

const r2 = parseKeyValue(`姓名: "王小明"
電話: '0912-345-678'
日期: 2026-06-16`);
assert.strictEqual(r2['姓名'], '王小明');  // 自動去引號
assert.strictEqual(r2['電話'], '0912-345-678');
console.log('  ✓ 引號處理');

const r3 = parseKeyValue(`品項:
- 鹽水雞 x1
- 秘製麻辣雞胗 x1
小計: 480`);
assert.ok(Array.isArray(r3['品項']));
assert.strictEqual(r3['品項'].length, 2);
assert.strictEqual(r3['品項'][0].name, '鹽水雞');
assert.strictEqual(r3['品項'][0].qty, 1);
console.log('  ✓ List 解析');

console.log('parseKeyValue: ALL PASSED ✓');

// ========== 2. parseActionBlocks ==========
console.log('\n--- parseActionBlocks ---');

const text1 = `好的，我來幫您確認訂單 🐔

===訂單確認===
姓名: 王小明
電話: 0912345678
地址: 新北市三峽區...
日期: 2026-06-16
時段: 上午
品項:
- 鹽水雞 x1
- 秘製麻辣雞胗 x1
小計: 480
總金額: 480
===END===

感謝您的訂購！`;

const blocks1 = parseActionBlocks(text1);
assert.strictEqual(blocks1.length, 1);
assert.strictEqual(blocks1[0].action, 'write_order');
assert.strictEqual(blocks1[0].data['姓名'], '王小明');
console.log('  ✓ 訂單確認區塊解析');

const text2 = `好的，已為您更新付款狀態

===付款更新===
order_id: PENDING-12345
付款方式: 轉帳
付款狀態: paid
===END===`;

const blocks2 = parseActionBlocks(text2);
assert.strictEqual(blocks2.length, 1);
assert.strictEqual(blocks2[0].action, 'update_payment');
assert.strictEqual(blocks2[0].data['order_id'], 'PENDING-12345');
assert.strictEqual(blocks2[0].data['付款狀態'], 'paid');
console.log('  ✓ 付款更新區塊解析');

const text3 = `這是一般對話，沒有 action block`;
const blocks3 = parseActionBlocks(text3);
assert.strictEqual(blocks3.length, 0);
console.log('  ✓ 沒有 action block');

const text4 = `
===訂單確認===
姓名: 李小華
電話: 0923456789
地址: 新北市三峽區
日期: 2026-06-18
時段: 下午
品項:
- 玉米雞 x1
小計: 820
總金額: 820
===END===

===付款更新===
order_id: PENDING-12345
付款方式: 轉帳
付款狀態: paid
===END===
`;
const blocks4 = parseActionBlocks(text4);
assert.strictEqual(blocks4.length, 2);
assert.strictEqual(blocks4[0].action, 'write_order');
assert.strictEqual(blocks4[1].action, 'update_payment');
console.log('  ✓ 多個 action block');

console.log('parseActionBlocks: ALL PASSED ✓');

// ========== 3. processWriteOrder ==========
console.log('\n--- processWriteOrder ---');

// Mock Date.now 到 2026-06-15 09:00（確保所有 2026-06-16 開團日的驗證都能通過）
const RealDate = Date;
const mockNow = new RealDate('2026-06-15T09:00:00+08:00').getTime();
function MockDate(...args) {
  if (args.length === 0) return new RealDate(mockNow);
  return new RealDate(...args);
}
MockDate.now = () => mockNow;
MockDate.parse = RealDate.parse;
MockDate.UTC = RealDate.UTC;
MockDate.prototype = RealDate.prototype;
global.Date = MockDate;

const validData = {
  '姓名': '測試用戶',
  '電話': '0912345678',
  '地址': '新北市三峽區',  // 三峽
  '日期': '2026-06-16',  // 開團日
  '時段': '上午',
  '品項': [{ name: '鹽水雞', qty: 1, total: 380 }],
  '小計': 380,
  '總金額': 380,
};
const result1 = processWriteOrder(validData);
assert.strictEqual(result1.success, true, '應該成功');
console.log('  ✓ 合法訂單處理成功');
console.log(`    ${result1.message}${result1.orderId ? ` (${result1.orderId})` : ''}`);

// 清理測試資料
const fs = require('fs');
const path = require('path');
const testFile = path.join(__dirname, '..', 'data', 'orders', 'chicken', '2026-06-16.csv');
if (fs.existsSync(testFile)) {
  // 刪除我們剛加入的測試行
  const content = fs.readFileSync(testFile, 'utf-8');
  const lines = content.split('\n').filter((l) => !l.includes('LISTENER-') || !l.includes('測試用戶'));
  fs.writeFileSync(testFile, lines.join('\n'));
}

const missingData = { '姓名': '王', '電話': '0912345678' };  // 缺地址、日期等
const result2 = processWriteOrder(missingData);
assert.strictEqual(result2.success, false, '應該失敗');
console.log('  ✓ 缺欄位被拒絕');

const badPhoneData = { ...validData, '電話': '1234' };
const result3 = processWriteOrder(badPhoneData);
assert.strictEqual(result3.success, false, '應該失敗');
console.log('  ✓ 不合法電話被拒絕');

const badDateData = { ...validData, '日期': '2099-01-01' };
const result4 = processWriteOrder(badDateData);
assert.strictEqual(result4.success, false, '應該失敗');
console.log('  ✓ 不合法日期被拒絕');

console.log('processWriteOrder: ALL PASSED ✓');

// ========== 4. processUpdatePayment ==========
console.log('\n--- processUpdatePayment ---');

const r5 = processUpdatePayment({ order_id: 'NONEXISTENT', '付款狀態': 'paid' });
assert.strictEqual(r5.success, false, '應該失敗（找不到訂單）');
console.log('  ✓ 不存在的 order_id 被拒絕');

const r6 = processUpdatePayment({ '付款狀態': 'paid' });
assert.strictEqual(r6.success, false, '應該失敗（缺 order_id）');
console.log('  ✓ 缺 order_id 被拒絕');

console.log('processUpdatePayment: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL ORDER LISTENER TESTS PASSED ✓');
console.log('========================================\n');
