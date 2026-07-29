'use strict';

/**
 * csvReader 測試（Session H H5）
 *
 * 目的：驗證 src/order/csvReader.js 的 6 個函數
 *
 * 測試情境：
 * 1. readCSV：CSV 解析（含 JSON 欄位、檔案不存在）
 * 2. getOrderById：依 order_id 查（含跨檔查詢）
 * 3. getOrdersByDate：依日期查
 * 4. getCustomerByPhone：依電話查（跨檔）
 * 5. isReturningCustomer：是否老客戶
 * 6. getAllOrders：所有日期訂單
 *
 * 策略：
 * - 使用偽日期 2099-12-31 / 2099-12-30 避免污染真實 CSV
 * - 測試開始/結束都清理測試檔案
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const csvReader = require('../src/order/csvReader');

// 偽日期（避免污染真實訂單）
const TEST_DATE_1 = '2099-12-31';
const TEST_DATE_2 = '2099-12-30';
const TEST_DATE_3 = '2099-12-29';
const TEST_FILE_1 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_1}.csv`);
const TEST_FILE_2 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_2}.csv`);
const TEST_FILE_3 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_3}.csv`);

const CSV_HEADER = 'order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed';

function cleanup() {
  for (const f of [TEST_FILE_1, TEST_FILE_2, TEST_FILE_3]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

test('1. readCSV 解析 CSV — 檔案不存在 / 正常 / 只有 header / 跳過 junk / 完全空', () => {
  // 1.1 檔案不存在 → 空陣列
  assert.deepStrictEqual(csvReader.readCSV('/tmp/nonexistent-12345.csv'), [], '不存在的檔案回傳空陣列');

  // 1.2 正常 CSV（含 JSON 欄位）
  const csv1 = `${CSV_HEADER}
ORD-20991231-001,2099-12-31T10:00:00+08:00,王小明,0912345678,三峽區學成路100號,,2099-12-31,morning,"{""鹽水雞"":2}","{}",{},2,0,2,760,0,760,transfer,pending,awaiting_payment,,,,,line,
ORD-20991231-002,2099-12-31T11:00:00+08:00,陳小姐,0987654321,三峽老街48號,,2099-12-31,afternoon,"{""甘蔗煙燻雞"":1}","{""秘製黑胡椒蒜味毛豆"":2}",{},1,2,3,520,0,520,linepay,paid,completed,,,,,line,`;
  fs.writeFileSync(TEST_FILE_1, csv1, 'utf8');
  const orders1 = csvReader.readCSV(TEST_FILE_1);
  assert.strictEqual(orders1.length, 2, '應解析 2 筆訂單');
  assert.strictEqual(orders1[0].order_id, 'ORD-20991231-001');
  assert.strictEqual(orders1[0].user_line_name, '王小明');
  assert.deepStrictEqual(orders1[0].chicken_items, { 鹽水雞: 2 }, 'chicken_items 應 JSON.parse 為物件');
  assert.deepStrictEqual(orders1[1].side_items, { 秘製黑胡椒蒜味毛豆: 2 }, 'side_items 應 JSON.parse 為物件');

  // 1.3 空檔案（只有 header）→ 0 筆
  fs.writeFileSync(TEST_FILE_1, CSV_HEADER + '\n', 'utf8');
  assert.deepStrictEqual(csvReader.readCSV(TEST_FILE_1), [], '只有 header 回傳空陣列');

  // 1.4 無 header（第一行是資料）→ 自動找 header 行
  const csv2 = `some,junk,line
${CSV_HEADER}
ORD-20991231-001,2099-12-31T10:00:00+08:00,測試,0900000000,X,,2099-12-31,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
  fs.writeFileSync(TEST_FILE_1, csv2, 'utf8');
  const orders2 = csvReader.readCSV(TEST_FILE_1);
  assert.strictEqual(orders2.length, 1, '應跳過 junk 行找到 header');
  assert.strictEqual(orders2[0].order_id, 'ORD-20991231-001');

  // 1.5 完全空檔案 → 空陣列
  fs.writeFileSync(TEST_FILE_1, '', 'utf8');
  assert.deepStrictEqual(csvReader.readCSV(TEST_FILE_1), [], '空檔案回傳空陣列');
});

test('2. getOrderById 依 ID 查詢 — 找到 / 找不到 / 跨檔', () => {
  // 重新建立有資料的檔案
  fs.writeFileSync(TEST_FILE_1, `${CSV_HEADER}
ORD-20991231-001,2099-12-31T10:00:00+08:00,王小明,0912345678,三峽區學成路100號,,2099-12-31,morning,"{""鹽水雞"":2}","{}",{},2,0,2,760,0,760,transfer,pending,awaiting_payment,,,,,line,`, 'utf8');

  // 2.1 找到
  const found = csvReader.getOrderById('ORD-20991231-001');
  assert.ok(found, '應找到訂單');
  assert.strictEqual(found.user_line_name, '王小明');

  // 2.2 找不到
  const notFound = csvReader.getOrderById('ORD-99999999-999');
  assert.strictEqual(notFound, null, '不存在的 order_id 回傳 null');

  // 2.3 跨檔查詢（建另一個日期的 CSV）
  fs.writeFileSync(TEST_FILE_2, `${CSV_HEADER}
ORD-20991230-001,2099-12-30T10:00:00+08:00,跨檔,0900000000,Y,,2099-12-30,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`, 'utf8');
  const crossFile = csvReader.getOrderById('ORD-20991230-001');
  assert.ok(crossFile, '跨檔查詢應找到');
  assert.strictEqual(crossFile.user_line_name, '跨檔');
});

test('3. getOrdersByDate 依日期查詢', () => {
  // 確保 TEST_FILE_1 有資料
  if (!fs.existsSync(TEST_FILE_1)) {
    fs.writeFileSync(TEST_FILE_1, `${CSV_HEADER}
ORD-20991231-001,2099-12-31T10:00:00+08:00,王小明,0912345678,X,,2099-12-31,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`, 'utf8');
  }

  // 3.1 有資料
  const date1Orders = csvReader.getOrdersByDate(TEST_DATE_1);
  assert.ok(date1Orders.length >= 1, `12-31 應至少 1 筆，實際: ${date1Orders.length}`);
  assert.strictEqual(date1Orders[0].order_id, 'ORD-20991231-001');

  // 3.2 無資料
  const emptyOrders = csvReader.getOrdersByDate('1999-01-01');
  assert.deepStrictEqual(emptyOrders, [], '不存在的日期回傳空陣列');
});

test('4. getCustomerByPhone 依電話查詢（跨檔）', () => {
  // 確保有資料
  if (!fs.existsSync(TEST_FILE_1)) {
    fs.writeFileSync(TEST_FILE_1, `${CSV_HEADER}
ORD-20991231-001,2099-12-31T10:00:00+08:00,王小明,0912345678,X,,2099-12-31,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`, 'utf8');
  }
  if (!fs.existsSync(TEST_FILE_2)) {
    fs.writeFileSync(TEST_FILE_2, `${CSV_HEADER}
ORD-20991230-001,2099-12-30T10:00:00+08:00,跨檔,0900000000,Y,,2099-12-30,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`, 'utf8');
  }

  // 4.1 找到
  const customer1 = csvReader.getCustomerByPhone('0912345678');
  assert.ok(customer1, '應找到老客戶');
  assert.strictEqual(customer1.user_line_name, '王小明');

  // 4.2 跨檔找到
  const customer2 = csvReader.getCustomerByPhone('0900000000');
  assert.ok(customer2, '跨檔查詢應找到');
  assert.strictEqual(customer2.user_line_name, '跨檔');

  // 4.3 找不到
  const noCustomer = csvReader.getCustomerByPhone('0999999999');
  assert.strictEqual(noCustomer, null, '不存在的電話回傳 null');
});

test('5. isReturningCustomer 是否老客戶', () => {
  // 確保有資料（其他 test 已建檔，這裡只驗證 logic）
  assert.strictEqual(csvReader.isReturningCustomer('0912345678'), true, '有訂單紀錄 → true');
  assert.strictEqual(csvReader.isReturningCustomer('0999999999'), false, '無訂單紀錄 → false');
});

test('6. getAllOrders 所有訂單（跨多檔）', () => {
  // 建立第三個檔案
  fs.writeFileSync(TEST_FILE_3, `${CSV_HEADER}
ORD-20991229-001,2099-12-29T10:00:00+08:00,第三天,0911111111,Z,,2099-12-29,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,
ORD-20991229-002,2099-12-29T11:00:00+08:00,第三天-2,0911111112,Z2,,2099-12-29,afternoon,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`, 'utf8');

  const all = csvReader.getAllOrders();
  assert.ok(all.length >= 5, `至少 5 筆（12-29: 2, 12-30: 1, 12-31: 2），實際: ${all.length}`);

  const has29 = all.some((o) => o.order_id === 'ORD-20991229-001');
  const has30 = all.some((o) => o.order_id === 'ORD-20991230-001');
  const has31 = all.some((o) => o.order_id === 'ORD-20991231-001');
  assert.ok(has29 && has30 && has31, '應包含三個日期的訂單');
});

// === Round 30 P1.3：補強 csvReader 測試 ===

test('7. getRecentOrders — 依 created_at 降序排序（最新優先）+ 預設 limit 20', () => {
  // 既有資料（test 1-6 建檔）：
  // - TEST_FILE_1: ORD-20991231-001 (12-31 10:00)
  // - TEST_FILE_2: ORD-20991230-001 (12-30 10:00)
  // - TEST_FILE_3: ORD-20991229-001 (12-29 10:00), ORD-20991229-002 (12-29 11:00)
  // 注意：production data 也有訂單，所以用 limit=100 確保拿到 test orders，
  // 再用 order_id 過濾到 test 自己的 4 筆
  const recent = csvReader.getRecentOrders(100);
  const testOrders = recent.filter((o) =>
    ['ORD-20991231-001', 'ORD-20991230-001', 'ORD-20991229-001', 'ORD-20991229-002'].includes(o.order_id),
  );
  assert.strictEqual(testOrders.length, 4);
  assert.strictEqual(testOrders[0].order_id, 'ORD-20991231-001', '最新 12-31');
  assert.strictEqual(testOrders[1].order_id, 'ORD-20991230-001', '12-30 第二新');
  assert.strictEqual(testOrders[2].order_id, 'ORD-20991229-002', '12-29 11:00');
  assert.strictEqual(testOrders[3].order_id, 'ORD-20991229-001', '12-29 10:00 最舊');
});

test('8. getRecentOrders — 自訂 limit 參數（只回傳前 N 筆）', () => {
  const limited = csvReader.getRecentOrders(5);
  assert.strictEqual(limited.length, 5);
  // limit 應限制返回數量
  assert.ok(limited.length <= 5);
});

test('9. readCSV — JSON 欄位壞掉（malformed JSON）→ 不 throw，保留原值', () => {
  // source：JSON.parse 失敗 catch 後 val 保持原字串（不修改為 ''）
  const csv = `${CSV_HEADER}
ORD-BAD-001,2099-12-31T13:00:00+08:00,測試,0900000099,X,,2099-12-31,morning,"broken{","{}",{},0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
  fs.writeFileSync(TEST_FILE_1, csv, 'utf8');
  let orders;
  assert.doesNotThrow(() => {
    orders = csvReader.readCSV(TEST_FILE_1);
  });
  assert.strictEqual(orders.length, 1);
  // JSON parse 失敗 → catch 後 val 保留原字串 'broken{'
  assert.strictEqual(orders[0].chicken_items, 'broken{');
});

test('10. readCSV — 中文含逗號地址（CSV 逗號在引號內）', () => {
  const csv = `${CSV_HEADER}
ORD-CSV-001,2099-12-31T14:00:00+08:00,用戶A,0900000050,"地址含,逗號",,2099-12-31,morning,"{}",{},{},0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
  fs.writeFileSync(TEST_FILE_1, csv, 'utf8');
  const orders = csvReader.readCSV(TEST_FILE_1);
  assert.strictEqual(orders[0].address, '地址含,逗號');
});

test('11. getOrderById — 不存在 order_id → null', () => {
  // 用獨特不存在的 order_id 避免 production 干擾
  assert.strictEqual(csvReader.getOrderById('ORD-20991231-DOES-NOT-EXIST-99999'), null);
});

test('12. getCustomerByPhone — 不存在電話 → null', () => {
  // 修正：production data 有空 user_phone，所以不要測空字串（會 match）
  // 用獨特不存在的電話測 null 路徑
  assert.strictEqual(csvReader.getCustomerByPhone('NONEXISTENT-PHONE-99999'), null);
});

test('13. isReturningCustomer — 不存在電話 → false', () => {
  assert.strictEqual(csvReader.isReturningCustomer('NONEXISTENT-PHONE-99999'), false);
});

test('14. getRecentOrders — 訂單無 created_at 也能排序（空字串排最後）', () => {
  const csv = `${CSV_HEADER}
ORD-WITH-TIME,2099-12-31T15:00:00+08:00,有時間,0900000070,X,,2099-12-31,morning,"{}",{},{},0,0,0,0,0,0,cash,pending,idle,,,,,line,
ORD-NO-TIME,,無時間,0900000071,X,,2099-12-31,morning,"{}",{},{},0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
  fs.writeFileSync(TEST_FILE_1, csv, 'utf8');
  // limit=10000 確保所有 orders 都包進來（避免 production > 100 把 ORD-NO-TIME 切掉）
  // ORD-NO-TIME (created_at='') 排最後（created_at 最小）
  // ORD-WITH-TIME (created_at=2099) 排最前
  const recent = csvReader.getRecentOrders(10000);
  const testOrders = recent.filter(
    (o) => o.order_id === 'ORD-WITH-TIME' || o.order_id === 'ORD-NO-TIME',
  );
  assert.strictEqual(testOrders.length, 2, `應找到 2 個 test orders，實際: ${testOrders.length}`);
  assert.strictEqual(testOrders[0].order_id, 'ORD-WITH-TIME');
  assert.strictEqual(testOrders[1].order_id, 'ORD-NO-TIME');
});

// 最終 cleanup（test suite 結束後）
test('teardown — cleanup 測試 CSV', () => {
  cleanup();
});
