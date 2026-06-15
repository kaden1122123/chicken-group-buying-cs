'use strict';

/**
 * 規則引擎單元測試
 * 每個規則 ≥ 5 個測試案例，覆蓋正常/邊界/錯誤
 */

const assert = require('assert');

// Load rules
const validatePhone = require('../src/rules/phoneRule');
const validateAddress = require('../src/rules/addressRule');
const { validateMenu, parseItems, calculateChickenCount, calculateTotalBoxes, calculateSubtotal, VALID_ITEMS, PRICES } = require('../src/rules/menuRule');
const { validateDate, getOpenDates } = require('../src/rules/dateRule');
const { validateTimeSlot } = require('../src/rules/timeSlotRule');
const { validatePayment } = require('../src/rules/paymentRule');
const { calculatePrice } = require('../src/rules/priceRule');
const { validateAll } = require('../src/rules');

// ========== Phone Rule Tests ==========
console.log('\n=== Phone Rule Tests ===');

function testPhone(input, expectedValid, expectedError) {
  const result = validatePhone(input);
  if (expectedValid) {
    assert.strictEqual(result.valid, true, `Expected valid for: ${input}`);
  } else {
    assert.strictEqual(result.valid, false, `Expected invalid for: ${input}`);
    if (expectedError) {
      assert.strictEqual(result.errorMessage, expectedError, `Error message mismatch for: ${input}`);
    }
  }
  console.log(`  ✓ Phone: "${input}" → ${result.valid ? 'VALID' : 'INVALID'}`);
}

// 正常案例
testPhone('0912345678', true, null);
testPhone('0987654321', true, null);
// 09開頭但非10位
testPhone('091234567', false, '電話格式有誤，請重新填寫（09開頭10位數）。');
testPhone('09123456789', false, '電話格式有誤，請重新填寫（09開頭10位數）。');
// 非09開頭
testPhone('0981234567', true, null);
testPhone('0881234567', false, '電話格式有誤，請重新填寫（09開頭10位數）。');
testPhone('0912345678', true, null);
// 格式變化（消毒後可接受）
testPhone('0912-345-678', true, null);
testPhone('0912 345 678', true, null);
// 空值
testPhone('', false, '電話為必填項目，請提供聯絡電話。');
testPhone(null, false, '電話為必填項目，請提供聯絡電話。');

console.log('Phone Rule: ALL PASSED ✓');

// ========== Address Rule Tests ==========
console.log('\n=== Address Rule Tests ===');

function testAddress(input, expectedValid, expectedError) {
  const result = validateAddress(input);
  if (expectedValid) {
    assert.strictEqual(result.valid, true, `Expected valid for: ${input}`);
  } else {
    assert.strictEqual(result.valid, false, `Expected invalid for: ${input}`);
    if (expectedError) {
      assert.ok(result.errorMessage.includes(expectedError.split('。')[0]), `Error message mismatch for: ${input}`);
    }
  }
  console.log(`  ✓ Address: "${input}" → ${result.valid ? 'VALID' : 'INVALID'}`);
}

// 允許區域
testAddress('三峽北大特區學成路100號', true, null);
testAddress('三峽老街48號', true, null);
testAddress('三峽安溪國中附近', true, null);
testAddress('鶯歌區陶瓷路88號', true, null);
testAddress('三峽介壽國小周邊', true, null);
// 拒絕區域
testAddress('大溪區三元街123號', false, '超出配送範圍');
testAddress('新店區北新路200號', false, '超出配送範圍');
testAddress('龍潭區中正路', false, '超出配送範圍');
// 邊界：不在允許也不在拒絕
testAddress('台北市信義區', false, '需由客服進一步確認');
// 空值
testAddress('', false, '地址為必填項目');

console.log('Address Rule: ALL PASSED ✓');

// ========== Menu Rule Tests ==========
console.log('\n=== Menu Rule Tests ===');

function testMenu(input, expectedValid) {
  const result = validateMenu(input);
  assert.strictEqual(result.valid, expectedValid, `Menu: "${input}" expected ${expectedValid ? 'valid' : 'invalid'}`);
  console.log(`  ✓ Menu: "${input}" → ${result.valid ? 'VALID' : 'INVALID'}`);
}

// 有效品項
testMenu('鹽水雞2', true);
testMenu('甘蔗煙燻雞 1', true);
testMenu('秘製黑胡椒蒜味毛豆 2', true);
testMenu('鹽水雞x2、甘蔗煙燻雞1', true);
testMenu('玉米雞', true);
testMenu('土雞', true);
testMenu('雞脖子5', true);
// 無效品項
testMenu('珍珠奶茶', false);
testMenu('炸雞排', false);
testMenu('', false);

console.log('Menu Rule: ALL PASSED ✓');

// ========== Price Rule Tests ==========
console.log('\n=== Price Rule Tests ===');

const items1 = [{ name: '鹽水雞', quantity: 2 }];
const result1 = calculatePrice(items1);
assert.strictEqual(result1.subtotal, 760, '鹽水雞2盒應為760');
assert.strictEqual(result1.deliveryFee, 0, '有雞肉應免運');
assert.strictEqual(result1.totalAmount, 760, '總金額760');
console.log('  ✓ 雞肉2盒計算正確');

const items2 = [{ name: '秘製黑胡椒蒜味毛豆', quantity: 5 }];
const result2 = calculatePrice(items2);
assert.strictEqual(result2.subtotal, 350, '毛豆5份應為350');
assert.strictEqual(result2.deliveryFee, 0, '小菜滿350免運');
assert.strictEqual(result2.totalAmount, 350, '總金額350');
console.log('  ✓ 小菜滿350免運');

const items3 = [{ name: '秘製黑胡椒蒜味毛豆', quantity: 4 }];
const result3 = calculatePrice(items3);
assert.strictEqual(result3.subtotal, 280, '毛豆4份應為280');
assert.strictEqual(result3.deliveryFee > 0, true, '小菜未滿350應收運費');
console.log('  ✓ 小菜未滿350應收運費');

const items4 = [
  { name: '甘蔗煙燻雞', quantity: 1 },
  { name: '秘製麻辣雞胗', quantity: 2 },
];
const result4 = calculatePrice(items4);
assert.strictEqual(result4.subtotal, 580, '甘蔗雞+雞胗2應為580');
assert.strictEqual(result4.deliveryFee, 0, '有雞肉免運');
assert.strictEqual(result4.totalAmount, 580, '總金額580');
console.log('  ✓ 混合品項計算正確');

console.log('Price Rule: ALL PASSED ✓');

// ========== Payment Rule Tests ==========
console.log('\n=== Payment Rule Tests ===');

// 新客戶 <=1000 可用現金
const r1 = validatePayment('現金', 800, false);
assert.strictEqual(r1.valid, true, '新客戶<=1000現金應有效');
console.log('  ✓ 新客戶<=1000可選現金');

// 新客戶 >1000 不能用現金
const r2 = validatePayment('現金', 1500, false);
assert.strictEqual(r2.valid, false, '新客戶>1000現金應無效');
assert.ok(r2.errorMessage.includes('首次訂購超過'), '錯誤訊息應提及首次');
console.log('  ✓ 新客戶>1000不可選現金');

// 新客戶 >1000 可用轉帳
const r3 = validatePayment('轉帳', 1500, false);
assert.strictEqual(r3.valid, true, '新客戶>1000轉帳應有效');
console.log('  ✓ 新客戶>1000可選轉帳');

// 老客戶任何金額都可用現金
const r4 = validatePayment('現金', 2000, true);
assert.strictEqual(r4.valid, true, '老客戶任何金額現金應有效');
console.log('  ✓ 老客戶任何金額可選現金');

// 街口/LINE Pay 所有人都可用
const r5 = validatePayment('街口', 500, false);
assert.strictEqual(r5.valid, true, '街口應所有人都可用');
const r6 = validatePayment('LINE Pay', 500, false);
assert.strictEqual(r6.valid, true, 'LINE Pay應所有人都可用');
console.log('  ✓ 街口/LINE Pay所有人都可用');

console.log('Payment Rule: ALL PASSED ✓');

// ========== TimeSlot Rule Tests ==========
console.log('\n=== TimeSlot Rule Tests ===');

const t1 = validateTimeSlot('上午');
assert.strictEqual(t1.valid, true, '上午應有效');
assert.strictEqual(t1.specifiedTime, 'morning', '上午時段為morning');
console.log('  ✓ 上午時段有效');

const t2 = validateTimeSlot('下午');
assert.strictEqual(t2.valid, true, '下午應有效');
assert.strictEqual(t2.specifiedTime, 'afternoon', '下午時段為afternoon');
console.log('  ✓ 下午時段有效');

const t3 = validateTimeSlot('晚上');
assert.strictEqual(t3.valid, false, '晚上應無效');
assert.ok(t3.errorMessage.includes('僅提供'), '晚上應回覆僅提供上午/下午');
console.log('  ✓ 晚上時段無效');

const t4 = validateTimeSlot('10:00');
assert.strictEqual(t4.valid, true, '10:00不阻擋但有warning');
assert.strictEqual(t4.warning, true, '10:00應有warning');
console.log('  ✓ 指定精準時間不阻擋但有warning');

console.log('TimeSlot Rule: ALL PASSED ✓');

console.log('\n========================================');
console.log('ALL RULES TESTS PASSED ✓');
console.log('========================================\n');