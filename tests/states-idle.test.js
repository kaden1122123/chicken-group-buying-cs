'use strict';

/**
 * IDLE State Module 測試（Session H8-A）
 *
 * 目的：驗證 src/states/idle.js 的 4 個 exports
 *   1. isOrderIntent(message) — 訂購意圖判斷（9 種 regex）
 *   2. isGreeting(message) — 問候判斷（5+ 種 regex）
 *   3. handleIdle(userId, message, context) — 4 種 action 分支
 *   4. buildOrderFormatReply() — 訂購格式回覆（quickReply 結構）
 *
 * 範圍：
 *   - 純邏輯（isOrderIntent / isGreeting）：全部 case
 *   - handleIdle 各 action 分支 + edge cases（empty / unknown / kbContent）
 *
 * 不含：context.kbContent 業務邏輯（屬 knowledge/triggers 範圍）
 */

const assert = require('assert');

const {
  isOrderIntent,
  isGreeting,
  handleIdle,
  buildOrderFormatReply,
} = require('../src/states/idle');
const { STATES } = require('../src/states/stateMachine');

console.log('\n=== IDLE State Module Tests ===');

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

// ==================== isOrderIntent ====================
console.log('\n--- isOrderIntent: 9 種訂購關鍵詞 ---');
check('「我要訂購」', isOrderIntent('我要訂購') === true, '應 true');
check('「我要下單」', isOrderIntent('我要下單') === true, '應 true');
check('「我要買」', isOrderIntent('我要買') === true, '應 true');
check('「想訂」', isOrderIntent('想訂一隻雞') === true, '應 true');
check('「要訂」', isOrderIntent('要訂雞肉') === true, '應 true');
check('「下單」', isOrderIntent('我來下單') === true, '應 true');
check('「購買」', isOrderIntent('想購買') === true, '應 true');
check('「訂雞」', isOrderIntent('我來訂雞') === true, '應 true');
check('「叫雞」', isOrderIntent('我要叫雞') === true, '應 true');
check('「團購」', isOrderIntent('這是團購') === true, '應 true');

console.log('\n--- isOrderIntent: 非訂購意圖 ---');
check('「你好」', isOrderIntent('你好') === false, '應 false');
check('「多少錢」', isOrderIntent('多少錢') === false, '應 false');
check('「」', isOrderIntent('') === false, '應 false');
check('null', isOrderIntent(null) === false, '應 false');
check('undefined', isOrderIntent(undefined) === false, '應 false');

// ==================== isGreeting ====================
console.log('\n--- isGreeting: 問候關鍵詞 ---');
check('「嗨」', isGreeting('嗨') === true, '應 true');
check('「hi」', isGreeting('hi') === true, '應 true');
check('「Hello」', isGreeting('Hello') === true, '應 true');
check('「hey」', isGreeting('hey') === true, '應 true');
check('「你好」', isGreeting('你好') === true, '應 true');
check('「您好」', isGreeting('您好') === true, '應 true');
check('「早安」', isGreeting('早安') === true, '應 true');
check('「午安」', isGreeting('午安') === true, '應 true');
check('「晚安」', isGreeting('晚安') === true, '應 true');
check('「好」', isGreeting('好') === true, '應 true');
check('「  嗨  」 (with trim)', isGreeting('  嗨  ') === true, '應 true');

console.log('\n--- isGreeting: 非問候 ---');
check('「多少錢」', isGreeting('多少錢') === false, '應 false');
check('「我要訂購」', isGreeting('我要訂購') === false, '應 false');
check('「」', isGreeting('') === false, '應 false');
check('null', isGreeting(null) === false, '應 false');
check('undefined', isGreeting(undefined) === false, '應 false');

// ==================== handleIdle ====================
console.log('\n--- handleIdle: order_intent 分支 ---');
const orderResult = handleIdle('user_1', '我要訂購', {});
check('action', orderResult.action === 'order_intent', `got ${orderResult.action}`);
check('newState', orderResult.newState === STATES.AWAITING_INFO, `got ${orderResult.newState}`);
check('reply is quickReply', orderResult.reply && orderResult.reply.type === 'text', `got reply=${JSON.stringify(orderResult.reply).slice(0, 80)}`);

console.log('\n--- handleIdle: greeting 分支 ---');
const greetResult = handleIdle('user_2', '嗨', {});
check('action', greetResult.action === 'greeting', `got ${greetResult.action}`);
check('newState', greetResult.newState === STATES.IDLE, `got ${greetResult.newState}`);
check('reply 不為 null', greetResult.reply !== null, 'reply 不應為 null');

console.log('\n--- handleIdle: kbContent 分支（knowledge lookup） ---');
const kbResult = handleIdle('user_3', '多少錢', { kbContent: '鹽水雞：NT$380' });
check('action', kbResult.action === 'kb_lookup', `got ${kbResult.action}`);
check('newState', kbResult.newState === STATES.IDLE, `got ${kbResult.newState}`);
check('reply 包含 kbContent 預覽', kbResult.reply && /鹽水雞/.test(kbResult.reply.text), '應包含 kb 預覽');

console.log('\n--- handleIdle: kbContent 長度限制 (500 chars preview) ---');
const longKb = 'A'.repeat(800);
const longKbResult = handleIdle('user_4', '多少錢', { kbContent: longKb });
check('reply 預覽 ≤ 500 字', longKbResult.reply && longKbResult.reply.text.indexOf('AAAA') >= 0, '應包含預覽');
const aaaCount = (longKbResult.reply.text.match(/A/g) || []).length;
check('A 字符數 ≤ 500', aaaCount <= 500, `got ${aaaCount}`);

console.log('\n--- handleIdle: fallback 分支 ---');
const fallbackResult = handleIdle('user_5', '隨便問', {});
check('action', fallbackResult.action === 'fallback', `got ${fallbackResult.action}`);
check('newState', fallbackResult.newState === STATES.IDLE, `got ${fallbackResult.newState}`);
check('reply 不為 null', fallbackResult.reply !== null, 'reply 不應為 null');

// ==================== buildOrderFormatReply ====================
console.log('\n--- buildOrderFormatReply: quickReply 結構 ---');
const formatReply = buildOrderFormatReply();
check('有 type', formatReply && formatReply.type === 'text', `got ${formatReply && formatReply.type}`);
check('有 text 內含「訂購資訊」', formatReply && /訂購資訊|📌/.test(formatReply.text), 'text 應包含「📌 請填寫以下訂購資訊」');
check('有 quickReply.items', Array.isArray(formatReply.quickReply && formatReply.quickReply.items), 'items 應為 array');
if (formatReply.quickReply && formatReply.quickReply.items) {
  check('quickReply 至少 2 項', formatReply.quickReply.items.length >= 2, `got ${formatReply.quickReply.items.length} 項`);
}

// ==================== 結果 ====================
console.log(`\n--- IDLE Tests 結果 ---`);
console.log(`  ✓ 通過: ${pass} / ${fail + pass}`);
if (fail > 0) {
  console.error(`  ✗ 失敗: ${fail}`);
  process.exit(1);
}
console.log('\n========================================');
