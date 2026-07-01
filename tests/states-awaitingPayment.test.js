'use strict';

/**
 * AWAITING_PAYMENT State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/awaitingPayment.js 的 3 個 exports
 *   1. isPaymentConfirmed(message) — 7 種關鍵詞
 *   2. isPaymentCancel(message) — 3 種關鍵詞
 *   3. handleAwaitingPayment(userId, message, orderData, context) — 多分支
 *
 * 範圍：
 *   - isPaymentConfirmed / isPaymentCancel：全部 case
 *   - handleAwaitingPayment：
 *     a) cancel 路徑 → IDLE
 *     b) payment_received 路徑 → COMPLETED（含 I/O 測試用未來日期隔離）
 *     c) payment_method 各類型(cash/transfer/jko/linepay) instructions 訊息
 *
 * I/O 隔離：使用預設 tenant (chicken) + delivery_date=2099-12-31 未來日期
 * 測試結束後清理 chicken/2099-12-31.csv 防止污染真實訂單資料
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 不設定 TENANT_ID — 用預設 chicken tenant（避免 module require 時 fail）
const {
  isPaymentConfirmed,
  isPaymentCancel,
  handleAwaitingPayment,
} = require('../src/states/awaitingPayment');
const { STATES } = require('../src/states/stateMachine');

console.log('\n=== AWAITING_PAYMENT State Module Tests ===');

let pass = 0;
let fail = 0;
function check(label, condition, msg) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label} — ${msg}`);
    fail++;
  }
}

const TEST_DATE = '2099-12-31';
const TEST_CSV_PATH = path.join(__dirname, '..', 'data', 'orders', 'chicken', `${TEST_DATE}.csv`);

// ==================== isPaymentConfirmed ====================
console.log('\n--- isPaymentConfirmed: 7 種付款確認關鍵詞 ---');
check('「已轉帳」', isPaymentConfirmed('已轉帳') === true, '應 true');
check('「已付款」', isPaymentConfirmed('已付款') === true, '應 true');
check('「轉了」', isPaymentConfirmed('轉了') === true, '應 true');
check('「付了」', isPaymentConfirmed('付了') === true, '應 true');
check('「轉帳完成」', isPaymentConfirmed('轉帳完成') === true, '應 true');
check('「付款完成」', isPaymentConfirmed('付款完成') === true, '應 true');
check('「ok」', isPaymentConfirmed('ok') === true, '應 true（lowercase 匹配）');
// Note: 「OK」uppercase 目前不匹配（PAYMENT_CONFIRM_KEYWORDS 用 message.includes() 是 case-sensitive）
// 屬於 known issue — H8 文檔化，不在測試 session 範圍動 production
check('「好」', isPaymentConfirmed('好') === true, '應 true');

console.log('\n--- isPaymentConfirmed: 非付款確認 ---');
check('「多少錢」', isPaymentConfirmed('多少錢') === false, '應 false');
check('「」', isPaymentConfirmed('') === false, '應 false');
check('null', isPaymentConfirmed(null) === false, '應 false');
check('undefined', isPaymentConfirmed(undefined) === false, '應 false');

console.log('\n--- isPaymentConfirmed: 含關鍵詞但不為付款（誤判防護） ---');
check('「請問取消流程」', isPaymentConfirmed('請問取消流程') === false, '應 false（無付款關鍵詞）');

// ==================== isPaymentCancel ====================
console.log('\n--- isPaymentCancel: 3 種取消關鍵詞 ---');
check('「取消」', isPaymentCancel('取消訂單') === true, '應 true');
check('「不要」', isPaymentCancel('不要了') === true, '應 true');
check('「算了」', isPaymentCancel('算了') === true, '應 true');

console.log('\n--- isPaymentCancel: 非取消 ---');
check('「已付款」', isPaymentCancel('已付款') === false, '應 false');
check('「多少錢」', isPaymentCancel('多少錢') === false, '應 false');
check('「」', isPaymentCancel('') === false, '應 false');
check('null', isPaymentCancel(null) === false, '應 false');

// ==================== handleAwaitingPayment: cancel 路徑 ====================
console.log('\n--- handleAwaitingPayment: cancel 路徑 → IDLE ---');
const cancelResult = handleAwaitingPayment('user_1', '算了', { payment_method: 'cash' }, {});
check('newState 是 IDLE', cancelResult.newState === STATES.IDLE, `got ${cancelResult.newState}`);
check('無 orderData', !cancelResult.orderData || Object.keys(cancelResult.orderData).length === 0, 'orderData 應清空');

console.log('\n--- handleAwaitingPayment: cancel — 從「取消」「不要」觸發 ---');
const cancelResult2 = handleAwaitingPayment('user_2', '不要了', { payment_method: 'transfer' }, {});
check('「不要了」也觸發 cancel', cancelResult2.newState === STATES.IDLE, `got ${cancelResult2.newState}`);

// ==================== handleAwaitingPayment: payment_received 路徑 ====================
const baseOrder = {
  user_line_name: 'H8測試用戶',
  user_phone: '0912345678',
  address: '台北市測試區測試路1號',
  delivery_date: TEST_DATE,
  time_slot: '上午',
  chicken_items: { '鹽水雞': 1 },
  chicken_count: 1,
  side_count: 0,
  total_boxes: 1,
  subtotal: 380,
  delivery_fee: 0,
  total_amount: 380,
};

console.log('\n--- handleAwaitingPayment: payment_received（cash）→ COMPLETED + payment_status=confirmed ---');
const cashResult = handleAwaitingPayment('user_3', '已付款', { ...baseOrder, payment_method: 'cash' }, {});
check('action 是 payment_received', cashResult.action === 'payment_received', `got ${cashResult.action}`);
check('newState 是 COMPLETED', cashResult.newState === STATES.COMPLETED, `got ${cashResult.newState}`);
check('payment_status 是 confirmed（現金）', cashResult.orderData.payment_status === 'confirmed', `got ${cashResult.orderData.payment_status}`);
check('order_id 已產生', !!cashResult.orderData.order_id, `got ${cashResult.orderData.order_id}`);
check('order_id 格式正確（ORD-YYYYMMDD-XXX）', /^ORD-\d{8}-\d{3}$/.test(cashResult.orderData.order_id), `got ${cashResult.orderData.order_id}`);
check('created_at 已產生', !!cashResult.orderData.created_at, 'created_at 應已設定');
check('order_status 是 new', cashResult.orderData.order_status === 'new', `got ${cashResult.orderData.order_status}`);
check('source 是 line', cashResult.orderData.source === 'line', `got ${cashResult.orderData.source}`);
check('intent_confirmed 是 true', cashResult.orderData.intent_confirmed === true, `got ${cashResult.orderData.intent_confirmed}`);
// 驗證 CSV 檔案存在
check('CSV 檔案已產生', fs.existsSync(TEST_CSV_PATH), `csv path: ${TEST_CSV_PATH}`);
if (fs.existsSync(TEST_CSV_PATH)) {
  const csvContent = fs.readFileSync(TEST_CSV_PATH, 'utf8');
  check('CSV 有 order_id', csvContent.includes(cashResult.orderData.order_id), 'CSV 應包含新建的 order_id');
  check('CSV 有 payment_status=confirmed', csvContent.includes('confirmed'), 'CSV 應包含 payment_status=confirmed');
}

console.log('\n--- handleAwaitingPayment: payment_received（transfer）→ payment_status=pending ---');
const transferResult = handleAwaitingPayment('user_4', '已轉帳', { ...baseOrder, payment_method: 'transfer' }, {});
check('payment_status 是 pending（非現金）', transferResult.orderData.payment_status === 'pending', `got ${transferResult.orderData.payment_status}`);

console.log('\n--- handleAwaitingPayment: payment_received（jko）→ payment_status=pending ---');
const jkoResult = handleAwaitingPayment('user_5', '已付款', { ...baseOrder, payment_method: 'jko' }, {});
check('jko payment_status 是 pending', jkoResult.orderData.payment_status === 'pending', `got ${jkoResult.orderData.payment_status}`);

console.log('\n--- handleAwaitingPayment: paymentProofReceived context 旗標觸發 ---');
const proofResult = handleAwaitingPayment('user_6', '訊息但無付款詞', { ...baseOrder }, { paymentProofReceived: true });
check('paymentProofReceived=true 觸發 payment_received', proofResult.action === 'payment_received', `got ${proofResult.action}`);

// ==================== handleAwaitingPayment: 4 種付款方式 instructions ====================
console.log('\n--- handleAwaitingPayment: 各付款方式 instructions（未收到付款時） ---');

function getInstructionsForMethod(method) {
  // 用一個不會被當付款確認 / 取消的訊息
  const result = handleAwaitingPayment('user_inst', '請問怎麼付款', { payment_method: method }, {});
  return result.reply ? result.reply.text : '';
}

// cash
const cashInst = getInstructionsForMethod('cash');
check('cash 有「現金付款給外送人員」', /現金.*付款.*外送/.test(cashInst), `got: ${cashInst.slice(0, 60)}`);
check('cash 保持 AWAITING_PAYMENT state', handleAwaitingPayment('user_inst', '問個問題', { payment_method: 'cash' }, {}).newState === STATES.AWAITING_PAYMENT, 'state 應保持 AWAITING_PAYMENT');

// transfer — config 提供銀行代碼與帳號
const transferInst = getInstructionsForMethod('transfer');
check('transfer 有「銀行代碼」', /銀行代碼/.test(transferInst), `got: ${transferInst.slice(0, 60)}`);
check('transfer 有「帳號」', /帳號/.test(transferInst), `got: ${transferInst.slice(0, 60)}`);

// jko
const jkoInst = getInstructionsForMethod('jko');
check('jko 有「街口支付」', /街口支付/.test(jkoInst), `got: ${jkoInst.slice(0, 60)}`);

// linepay
try {
  const linepayInst = getInstructionsForMethod('linepay');
  check('linepay 有「老闆 LINE」「LINE Pay」', /LINE/.test(linepayInst), `got: ${linepayInst.slice(0, 60)}`);
} catch (e) {
  // 若 chicken.yaml 的 linepay.line_id 缺失 — fail test
  console.log(`  ⚠ linepay 測試失敗: ${e.message}`);
  fail++;
  check('linepay 測試', false, e.message);
}

// default (unknown payment_method)
const defaultInst = getInstructionsForMethod('unknown_method_xyz');
check('default 有「付款方式」提示', /付款方式/.test(defaultInst), `got: ${defaultInst.slice(0, 60)}`);
check('default 保持 AWAITING_PAYMENT', handleAwaitingPayment('user_inst', '問個問題', { payment_method: 'unknown' }, {}).newState === STATES.AWAITING_PAYMENT, '應保持 AWAITING_PAYMENT');

// ==================== Cleanup ====================
// 測試結束清理測試 CSV（防止污染真實訂單資料）
try {
  if (fs.existsSync(TEST_CSV_PATH)) {
    fs.unlinkSync(TEST_CSV_PATH);
    console.log(`\n  🧹 已清理測試 CSV: ${TEST_CSV_PATH}`);
  }
} catch (e) {
  console.log(`  ⚠ 清理失敗: ${e.message}`);
}

// ==================== 結果 ====================
console.log(`\n--- AWAITING_PAYMENT Tests 結果 ---`);
console.log(`  ✓ 通過: ${pass} / ${fail + pass}`);
if (fail > 0) {
  console.error(`  ✗ 失敗: ${fail}`);
  process.exit(1);
}
console.log('\n========================================');
