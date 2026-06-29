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
const fs = require('fs');
const path = require('path');

console.log('\n=== CsvReader Tests ===');

const csvReader = require('../src/order/csvReader');

// 偽日期（避免污染真實訂單）
const TEST_DATE_1 = '2099-12-31';
const TEST_DATE_2 = '2099-12-30';
const TEST_DATE_3 = '2099-12-29';
const TEST_FILE_1 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_1}.csv`);
const TEST_FILE_2 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_2}.csv`);
const TEST_FILE_3 = path.join(__dirname, `../data/orders/chicken/${TEST_DATE_3}.csv`);

function cleanup() {
  for (const f of [TEST_FILE_1, TEST_FILE_2, TEST_FILE_3]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

// 清理舊測試殘留
cleanup();

console.log(`\n--- 情境 1: readCSV 解析 CSV ---`);

// 1.1 檔案不存在 → 空陣列
assert.deepStrictEqual(csvReader.readCSV('/tmp/nonexistent-12345.csv'), [], '不存在的檔案回傳空陣列');
console.log('  ✓ 檔案不存在回傳空陣列');

// 1.2 正常 CSV（含 JSON 欄位）
const csv1 = `order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed
ORD-20991231-001,2099-12-31T10:00:00+08:00,王小明,0912345678,三峽區學成路100號,,2099-12-31,morning,"{""鹽水雞"":2}","{}",{},2,0,2,760,0,760,transfer,pending,awaiting_payment,,,,,line,
ORD-20991231-002,2099-12-31T11:00:00+08:00,陳小姐,0987654321,三峽老街48號,,2099-12-31,afternoon,"{""甘蔗煙燻雞"":1}","{""秘製黑胡椒蒜味毛豆"":2}",{},1,2,3,520,0,520,linepay,paid,completed,,,,,line,`;
fs.writeFileSync(TEST_FILE_1, csv1, 'utf8');
const orders1 = csvReader.readCSV(TEST_FILE_1);
assert.strictEqual(orders1.length, 2, '應解析 2 筆訂單');
assert.strictEqual(orders1[0].order_id, 'ORD-20991231-001');
assert.strictEqual(orders1[0].user_line_name, '王小明');
assert.deepStrictEqual(orders1[0].chicken_items, { 鹽水雞: 2 }, 'chicken_items 應 JSON.parse 為物件');
assert.deepStrictEqual(orders1[1].side_items, { 秘製黑胡椒蒜味毛豆: 2 }, 'side_items 應 JSON.parse 為物件');
console.log('  ✓ 正常 CSV 解析（含 JSON 欄位 → 物件）');

// 1.3 空檔案（只有 header）→ 0 筆
fs.writeFileSync(TEST_FILE_1, 'order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed\n', 'utf8');
assert.deepStrictEqual(csvReader.readCSV(TEST_FILE_1), [], '只有 header 回傳空陣列');
console.log('  ✓ 只有 header 回傳空陣列');

// 1.4 無 header（第一行是資料）→ 自動找 header 行
const csv2 = `some,junk,line
order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed
ORD-20991231-001,2099-12-31T10:00:00+08:00,測試,0900000000,X,,2099-12-31,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
fs.writeFileSync(TEST_FILE_1, csv2, 'utf8');
const orders2 = csvReader.readCSV(TEST_FILE_1);
assert.strictEqual(orders2.length, 1, '應跳過 junk 行找到 header');
assert.strictEqual(orders2[0].order_id, 'ORD-20991231-001');
console.log('  ✓ 無 header 開頭時自動尋找 header 行');

// 1.5 完全空檔案 → 空陣列
fs.writeFileSync(TEST_FILE_1, '', 'utf8');
assert.deepStrictEqual(csvReader.readCSV(TEST_FILE_1), [], '空檔案回傳空陣列');
console.log('  ✓ 完全空檔案回傳空陣列');

console.log(`\n--- 情境 2: getOrderById 依 ID 查詢 ---`);

// 重新建立有資料的檔案
fs.writeFileSync(TEST_FILE_1, csv1, 'utf8');

// 2.1 找到
const found = csvReader.getOrderById('ORD-20991231-001');
assert.ok(found, '應找到訂單');
assert.strictEqual(found.user_line_name, '王小明');
console.log('  ✓ 依 order_id 找到訂單');

// 2.2 找不到
const notFound = csvReader.getOrderById('ORD-99999999-999');
assert.strictEqual(notFound, null, '不存在的 order_id 回傳 null');
console.log('  ✓ 不存在的 order_id 回傳 null');

// 2.3 跨檔查詢（建另一個日期的 CSV）
const csv3 = `order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed
ORD-20991230-001,2099-12-30T10:00:00+08:00,跨檔,0900000000,Y,,2099-12-30,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
fs.writeFileSync(TEST_FILE_2, csv3, 'utf8');
const crossFile = csvReader.getOrderById('ORD-20991230-001');
assert.ok(crossFile, '跨檔查詢應找到');
assert.strictEqual(crossFile.user_line_name, '跨檔');
console.log('  ✓ 跨檔查詢（不同日期 CSV）');

console.log(`\n--- 情境 3: getOrdersByDate 依日期查詢 ---`);

// 3.1 有資料
const date1Orders = csvReader.getOrdersByDate(TEST_DATE_1);
assert.strictEqual(date1Orders.length, 2, '12-31 應有 2 筆');
assert.strictEqual(date1Orders[0].order_id, 'ORD-20991231-001');
console.log('  ✓ 依日期查詢回傳所有該日訂單');

// 3.2 無資料
const emptyOrders = csvReader.getOrdersByDate('1999-01-01');
assert.deepStrictEqual(emptyOrders, [], '不存在的日期回傳空陣列');
console.log('  ✓ 不存在的日期回傳空陣列');

console.log(`\n--- 情境 4: getCustomerByPhone 依電話查詢（跨檔） ---`);

// 4.1 找到
const customer1 = csvReader.getCustomerByPhone('0912345678');
assert.ok(customer1, '應找到老客戶');
assert.strictEqual(customer1.user_line_name, '王小明');
console.log('  ✓ 依電話找到老客戶');

// 4.2 跨檔找到
const customer2 = csvReader.getCustomerByPhone('0900000000');
assert.ok(customer2, '跨檔查詢應找到');
assert.strictEqual(customer2.user_line_name, '跨檔');
console.log('  ✓ 跨檔依電話找到老客戶');

// 4.3 找不到
const noCustomer = csvReader.getCustomerByPhone('0999999999');
assert.strictEqual(noCustomer, null, '不存在的電話回傳 null');
console.log('  ✓ 不存在的電話回傳 null');

console.log(`\n--- 情境 5: isReturningCustomer 是否老客戶 ---`);

assert.strictEqual(csvReader.isReturningCustomer('0912345678'), true, '有訂單紀錄 → true');
console.log('  ✓ 有訂單紀錄 → true');

assert.strictEqual(csvReader.isReturningCustomer('0999999999'), false, '無訂單紀錄 → false');
console.log('  ✓ 無訂單紀錄 → false');

console.log(`\n--- 情境 6: getAllOrders 所有訂單 ---`);

// 建立第三個檔案
const csv4 = `order_id,created_at,user_line_name,user_phone,address,community,delivery_date,time_slot,chicken_items,side_items,extra_items,chicken_count,side_count,total_boxes,subtotal,delivery_fee,total_amount,payment_method,payment_status,order_status,staff_notes,customer_notes,customer_tags,handoff_type,handoff_logged_at,handoff_resolved_at,source,intent_confirmed
ORD-20991229-001,2099-12-29T10:00:00+08:00,第三天,0911111111,Z,,2099-12-29,morning,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,
ORD-20991229-002,2099-12-29T11:00:00+08:00,第三天-2,0911111112,Z2,,2099-12-29,afternoon,"{}","{}","{}",0,0,0,0,0,0,cash,pending,idle,,,,,line,`;
fs.writeFileSync(TEST_FILE_3, csv4, 'utf8');

const all = csvReader.getAllOrders();
assert.ok(all.length >= 5, `至少 5 筆（12-29: 2, 12-30: 1, 12-31: 2），實際: ${all.length}`);
// 包含跨日
const has29 = all.some((o) => o.order_id === 'ORD-20991229-001');
const has30 = all.some((o) => o.order_id === 'ORD-20991230-001');
const has31 = all.some((o) => o.order_id === 'ORD-20991231-001');
assert.ok(has29 && has30 && has31, '應包含三個日期的訂單');
console.log(`  ✓ getAllOrders 跨多檔共 ${all.length} 筆訂單`);

// 最終清理
cleanup();

console.log('\n=== CsvReader Tests: ALL PASSED ===');
