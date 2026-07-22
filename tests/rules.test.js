'use strict';

/**
 * 規則引擎單元測試
 * 每個規則 ≥ 5 個測試案例，覆蓋正常/邊界/錯誤
 */

const assert = require('assert');
const { test } = require('node:test');

// Load rules
const validatePhone = require('../src/rules/phoneRule');
const validateAddress = require('../src/rules/addressRule');
const { validateMenu } = require('../src/rules/menuRule');
const { validateTimeSlot } = require('../src/rules/timeSlotRule');
const { validatePayment } = require('../src/rules/paymentRule');
const { calculatePrice } = require('../src/rules/priceRule');

test('Phone Rule — 正常 / 邊界 / 空值', () => {
  // 正常案例
  assert.strictEqual(validatePhone('0912345678').valid, true);
  assert.strictEqual(validatePhone('0987654321').valid, true);

  // 位數錯（不是 10 位）
  assert.strictEqual(validatePhone('091234567').valid, false);
  assert.strictEqual(validatePhone('09123456789').valid, false);

  // 非 09 開頭
  assert.strictEqual(validatePhone('0981234567').valid, true);
  assert.strictEqual(validatePhone('0881234567').valid, false);

  // 格式變化（消毒後可接受）
  assert.strictEqual(validatePhone('0912-345-678').valid, true);
  assert.strictEqual(validatePhone('0912 345 678').valid, true);

  // 空值
  assert.strictEqual(validatePhone('').valid, false);
  assert.strictEqual(validatePhone(null).valid, false);
});

test('Phone Rule — 錯誤訊息', () => {
  // 位數錯錯誤訊息
  const r1 = validatePhone('091234567');
  assert.ok(r1.errorMessage.includes('電話格式有誤'));

  // 非 09 開頭錯誤訊息
  const r2 = validatePhone('0881234567');
  assert.ok(r2.errorMessage.includes('電話格式有誤'));

  // 空值錯誤訊息
  const r3 = validatePhone('');
  assert.ok(r3.errorMessage.includes('電話為必填項目'));
});

test('Address Rule — 允許區域', () => {
  assert.strictEqual(validateAddress('三峽北大特區學成路100號').valid, true);
  assert.strictEqual(validateAddress('三峽老街48號').valid, true);
  assert.strictEqual(validateAddress('三峽安溪國中附近').valid, true);
  assert.strictEqual(validateAddress('鶯歌區陶瓷路88號').valid, true);
  assert.strictEqual(validateAddress('三峽介壽國小周邊').valid, true);
});

test('Address Rule — 拒絕區域 / 邊界 / 空值', () => {
  // 拒絕區域
  assert.strictEqual(validateAddress('大溪區三元街123號').valid, false);
  assert.strictEqual(validateAddress('新店區北新路200號').valid, false);
  assert.strictEqual(validateAddress('龍潭區中正路').valid, false);

  // 邊界：不在允許也不在拒絕
  assert.strictEqual(validateAddress('台北市信義區').valid, false);

  // 空值
  assert.strictEqual(validateAddress('').valid, false);
});

test('Menu Rule — 有效 / 無效品項', () => {
  assert.strictEqual(validateMenu('鹽水雞2').valid, true);
  assert.strictEqual(validateMenu('甘蔗煙燻雞 1').valid, true);
  assert.strictEqual(validateMenu('秘製黑胡椒蒜味毛豆 2').valid, true);
  assert.strictEqual(validateMenu('鹽水雞x2、甘蔗煙燻雞1').valid, true);
  assert.strictEqual(validateMenu('玉米雞').valid, true);
  assert.strictEqual(validateMenu('土雞').valid, true);
  assert.strictEqual(validateMenu('雞脖子5').valid, true);

  assert.strictEqual(validateMenu('珍珠奶茶').valid, false);
  assert.strictEqual(validateMenu('炸雞排').valid, false);
  assert.strictEqual(validateMenu('').valid, false);
});

test('Price Rule — 雞肉 / 小菜 / 混合', () => {
  const items1 = [{ name: '鹽水雞', quantity: 2 }];
  const r1 = calculatePrice(items1);
  assert.strictEqual(r1.subtotal, 760, '鹽水雞2盒應為760');
  assert.strictEqual(r1.deliveryFee, 0, '有雞肉應免運');
  assert.strictEqual(r1.totalAmount, 760, '總金額760');

  const items2 = [{ name: '秘製黑胡椒蒜味毛豆', quantity: 5 }];
  const r2 = calculatePrice(items2);
  assert.strictEqual(r2.subtotal, 350, '毛豆5份應為350');
  assert.strictEqual(r2.deliveryFee, 0, '小菜滿350免運');
  assert.strictEqual(r2.totalAmount, 350, '總金額350');

  const items3 = [{ name: '秘製黑胡椒蒜味毛豆', quantity: 4 }];
  const r3 = calculatePrice(items3);
  assert.strictEqual(r3.subtotal, 280, '毛豆4份應為280');
  assert.ok(r3.deliveryFee > 0, '小菜未滿350應收運費');

  const items4 = [
    { name: '甘蔗煙燻雞', quantity: 1 },
    { name: '秘製麻辣雞胗', quantity: 2 },
  ];
  const r4 = calculatePrice(items4);
  assert.strictEqual(r4.subtotal, 580, '甘蔗雞+雞胗2應為580');
  assert.strictEqual(r4.deliveryFee, 0, '有雞肉免運');
  assert.strictEqual(r4.totalAmount, 580, '總金額580');
});

test('Payment Rule — 新客戶 / 老客戶 / 各付款方式', () => {
  // 新客戶 <=1000 可用現金
  const r1 = validatePayment('現金', 800, false);
  assert.strictEqual(r1.valid, true, '新客戶<=1000現金應有效');

  // 新客戶 >1000 不能用現金
  const r2 = validatePayment('現金', 1500, false);
  assert.strictEqual(r2.valid, false, '新客戶>1000現金應無效');
  assert.ok(r2.errorMessage.includes('首次訂購超過'), '錯誤訊息應提及首次');

  // 新客戶 >1000 可用轉帳
  const r3 = validatePayment('轉帳', 1500, false);
  assert.strictEqual(r3.valid, true, '新客戶>1000轉帳應有效');

  // 老客戶任何金額都可用現金
  const r4 = validatePayment('現金', 2000, true);
  assert.strictEqual(r4.valid, true, '老客戶任何金額現金應有效');

  // 街口/LINE Pay 所有人都可用
  const r5 = validatePayment('街口', 500, false);
  assert.strictEqual(r5.valid, true, '街口應所有人都可用');
  const r6 = validatePayment('LINE Pay', 500, false);
  assert.strictEqual(r6.valid, true, 'LINE Pay應所有人都可用');
});

test('TimeSlot Rule — 有效 / 無效 / 指定精準時間', () => {
  const t1 = validateTimeSlot('上午');
  assert.strictEqual(t1.valid, true, '上午應有效');
  assert.strictEqual(t1.specifiedTime, 'morning', '上午時段為morning');

  const t2 = validateTimeSlot('下午');
  assert.strictEqual(t2.valid, true, '下午應有效');
  assert.strictEqual(t2.specifiedTime, 'afternoon', '下午時段為afternoon');

  const t3 = validateTimeSlot('晚上');
  assert.strictEqual(t3.valid, false, '晚上應無效');
  assert.ok(t3.errorMessage.includes('僅提供'), '晚上應回覆僅提供上午/下午');

  const t4 = validateTimeSlot('10:00');
  assert.strictEqual(t4.valid, true, '10:00不阻擋但有warning');
  assert.strictEqual(t4.warning, true, '10:00應有warning');
});
