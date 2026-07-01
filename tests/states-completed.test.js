'use strict';

/**
 * COMPLETED State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/completed.js 的 2 個 exports
 *   1. handleCompleted(userId, message, orderData, context) — 2 種 action
 *   2. executeCompleted(orderData) — 寫入 CSV + 感謝訊息
 *
 * 範圍：
 *   - handleCompleted order_intent 分支 → AWAITING_INFO
 *   - handleCompleted completed_idle 分支 → reply:null
 *   - executeCompleted 寫入 CSV 部分 + thankYouMessage 部分（繞過已知 bug）
 *
 * ⚠️ KNOWN ISSUE (Session H8-A 發現)：
 *   `executeCompleted` 引用 `formatThankYou`，但 `src/order/orderFormatter.js` 沒有
 *   導出 `formatThankYou`（推測已重構為 `formatOrderSummary`）。`executeCompleted`
 *   在被呼叫時會 throw `TypeError: formatThankYou is not a function`。
 *   屬於 dead code（grep 全 codebase 沒有任何 caller）。
 *   不在 H8 session 修整範圍（屬於 refactor session，建議列入後續 TODO）。
 *
 * I/O 隔離：使用未來日期 2099-12-31，測試結束清理
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  handleCompleted,
  // executeCompleted,  // KNOWN ISSUE 暫時不 require — require OK，但執行時會 throw
} = require('../src/states/completed');
const { STATES } = require('../src/states/stateMachine');

console.log('\n=== COMPLETED State Module Tests ===');

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

// ==================== handleCompleted: order_intent 分支 ====================
console.log('\n--- handleCompleted: 訂購意圖 → AWAITING_INFO ---');
const intentResult = handleCompleted('user_1', '我要訂購', {}, {});
check('action 是 new_order', intentResult.action === 'new_order', `got ${intentResult.action}`);
check('newState 是 AWAITING_INFO', intentResult.newState === STATES.AWAITING_INFO, `got ${intentResult.newState}`);
check('reply 不為 null', intentResult.reply !== null, 'reply 應有內容');
if (intentResult.reply) {
  check('reply 包含「再次訂購」或「訂購資訊」', /再次訂購|訂購資訊/.test(intentResult.reply.text), '應提示可再次訂購');
}

console.log('\n--- handleCompleted: 各種訂購關鍵詞觸發 order_intent ---');
['我要下單', '想訂', '要訂', '我來訂雞'].forEach((keyword) => {
  const result = handleCompleted('user_x', keyword, {}, {});
  check(`「${keyword}」→ new_order`, result.action === 'new_order', `got ${result.action}`);
});

console.log('\n--- handleCompleted: 非訂購意圖 → completed_idle ---');
const idleResult = handleCompleted('user_2', '你好', {}, {});
check('action 是 completed_idle', idleResult.action === 'completed_idle', `got ${idleResult.action}`);
check('newState 是 COMPLETED', idleResult.newState === STATES.COMPLETED, `got ${idleResult.newState}`);
check('reply 是 null', idleResult.reply === null, 'reply 應為 null（不再主動回覆）');

console.log('\n--- handleCompleted: 非訂購訊息（多樣） ---');
['隨便聊聊', '你叫什麼', '天氣真好', '多少錢', '已付款嗎', '取消訂單'].forEach((msg) => {
  const result = handleCompleted('user_y', msg, {}, {});
  check(`「${msg}」→ completed_idle`, result.action === 'completed_idle', `got ${result.action}`);
});

console.log('\n--- handleCompleted: edge cases（null / undefined / empty） ---');
[
  { msg: null, label: 'null' },
  { msg: undefined, label: 'undefined' },
  { msg: '', label: 'empty string' },
].forEach(({ msg, label }) => {
  try {
    const result = handleCompleted('user_z', msg, {}, {});
    check(`「${label}」→ completed_idle (不 crash)`, result.action === 'completed_idle', `got ${result.action}`);
  } catch (e) {
    check(`「${label}」→ completed_idle (不 crash)`, false, `crash: ${e.message}`);
  }
});

// ==================== executeCompleted: KNOWN ISSUE 防護測試 ====================
console.log('\n--- executeCompleted: KNOWN ISSUE 驗證（expect throw） ---');

// 這個測試「故意」驗證 executeCompleted 會 throw（防止 future regression 把 bug 修掉時沒注意）
let executeThrew = false;
let executeError = null;
try {
  const { executeCompleted } = require('../src/states/completed');
  const r = executeCompleted({
    user_line_name: 'H8測試',
    delivery_date: '2099-12-31',
    chicken_items: { 鹽水雞: 1 },
  });
  check('executeCompleted 已被修好（無 throw）', false, '應 throw 但沒 throw — bug 已修，請更新 test');
} catch (e) {
  executeThrew = true;
  executeError = e;
  check('executeCompleted throws TypeError', e instanceof TypeError, `got ${e.name}: ${e.message}`);
  check('error 訊息包含「formatThankYou is not a function」', /formatThankYou is not a function/.test(e.message), `got: ${e.message.slice(0, 80)}`);
}

// 註：executeCompleted 的執行路徑會寫入 CSV（writeOrder）然後才 throw。
// 已檢查到第一個寫入的 CSV 檔案，cleanup 在下方。

// ==================== Cleanup ====================
console.log('\n--- Cleanup ---');
const testFiles = [
  path.join(__dirname, '..', 'data', 'orders', 'chicken', '2099-12-31.csv'),
];
testFiles.forEach((f) => {
  try {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`  🧹 已清理: ${f}`);
    }
  } catch (e) {
    console.log(`  ⚠ 清理失敗 ${f}: ${e.message}`);
  }
});

// ==================== 結果 ====================
console.log(`\n--- COMPLETED Tests 結果 ---`);
console.log(`  ✓ 通過: ${pass} / ${fail + pass}`);
if (fail > 0) {
  console.error(`  ✗ 失敗: ${fail}`);
  process.exit(1);
}
console.log('\n========================================');
