'use strict';

/**
 * P1-6: community 欄位加進 awaitingInfo 驗證測試
 *
 * 原本 FIELD_ORDER 是 [address, name, phone, ...]，沒有 community 欄位。
 * 客戶在地址裡附帶的「社區/公司名稱」會被當作地址一部分，可能觸發 addressRule 拒絕。
 *
 * 修整：
 * - FIELD_ORDER 加 community 在 address 之後、name 之前
 * - 客戶回「無」「略」「-」等跳過關鍵字時，不存 community 並直接跳到 name
 * - 其他輸入存到 orderData.community
 * - buildFieldPrompt 對 community 給出提示
 *
 * 本測試驗證：
 * 1. address → community 流程正常
 * 2. 客戶填社區名 → orderData.community 有值
 * 3. 客戶回「無」/「略」/「-」→ 跳過 community，orderData.community 為 undefined
 * 4. community 後 nextField = 'name'
 * 5. FIELD_ORDER 包含 community
 * 6. buildFieldPrompt('community') 返回正確提示
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  handleAwaitingInfo,
  buildFieldPrompt,
  FIELD_ORDER,
} = require('../src/states/awaitingInfo');
const { STATES, setStateDirectly, clearState } = require('../src/states/stateMachine');

console.log('\n=== Community Field Tests (P1-6) ===');

// ─── 1. FIELD_ORDER 包含 community 在正確位置 ───
console.log('\n--- FIELD_ORDER ---');
const idxAddr = FIELD_ORDER.indexOf('address');
const idxComm = FIELD_ORDER.indexOf('community');
const idxName = FIELD_ORDER.indexOf('name');
assert.ok(idxAddr >= 0, 'FIELD_ORDER 應有 address');
assert.ok(idxComm >= 0, 'FIELD_ORDER 應有 community');
assert.ok(idxName >= 0, 'FIELD_ORDER 應有 name');
assert.ok(idxAddr < idxComm, 'address 應在 community 之前');
assert.ok(idxComm < idxName, 'community 應在 name 之前');
console.log(`  ✓ FIELD_ORDER = ${JSON.stringify(FIELD_ORDER)}`);

// ─── 2. 完整流程：address → community → name ───
console.log('\n--- 完整流程（填社區）---');

clearState('u1');
setStateDirectly('u1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const r1 = handleAwaitingInfo('u1', '三峽北大特區學成路100號', {}, { awaitingField: 'address' });
assert.strictEqual(r1.context.awaitingField, 'community', 'address 後應到 community');
assert.strictEqual(r1.orderData.address, '三峽北大特區學成路100號');
console.log('  ✓ address 通過 → nextField = community');

const r2 = handleAwaitingInfo('u1', '皇翔玉品', r1.orderData, r1.context);
assert.strictEqual(r2.context.awaitingField, 'name', 'community 後應到 name');
assert.strictEqual(r2.orderData.community, '皇翔玉品');
console.log(`  ✓ community 填寫 → orderData.community = "${r2.orderData.community}"`);

// ─── 3. 跳過 community：用「無」/「略」/「-」/空字串 ───
console.log('\n--- 跳過 community ---');

const skipKeywords = ['無', '略', '沒', 'no', 'n', '-', '不填', '不用', 'skip', ''];
for (const kw of skipKeywords) {
  clearState('skip-' + kw);
  setStateDirectly('skip-' + kw, STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

  const a1 = handleAwaitingInfo('skip-' + kw, '三峽北大特區學成路100號', {}, { awaitingField: 'address' });
  const a2 = handleAwaitingInfo('skip-' + kw, kw, a1.orderData, a1.context);

  assert.strictEqual(a2.context.awaitingField, 'name', `「${kw}」應跳到 name`);
  assert.ok(
    !('community' in a2.orderData),
    `「${kw}」不應存 community 到 orderData`,
  );
}
console.log(`  ✓ ${skipKeywords.length} 個跳過關鍵字全綠`);

// ─── 4. 社區名有特殊字符也能正確存 ───
console.log('\n--- 特殊社區名 ---');

clearState('u-special');
setStateDirectly('u-special', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

const s1 = handleAwaitingInfo('u-special', '鶯歌區陶瓷路88號', {}, { awaitingField: 'address' });
const s2 = handleAwaitingInfo('u-special', '王○公司（3樓）', s1.orderData, s1.context);
assert.strictEqual(s2.orderData.community, '王○公司（3樓）');
console.log('  ✓ 中文 + 括號 + 數字 + ○ 都正確存');

const s3 = handleAwaitingInfo('u-special', '  前面空白  ', s2.orderData, { awaitingField: 'community' });
assert.strictEqual(s3.orderData.community, '前面空白', '應自動 trim');
console.log('  ✓ 自動 trim');

// ─── 5. buildFieldPrompt('community') 給出提示 ───
console.log('\n--- buildFieldPrompt ---');

const prompt = buildFieldPrompt('community');
assert.strictEqual(prompt.type, 'text');
assert.ok(
  prompt.text.includes('社區') || prompt.text.includes('公司'),
  'community 提示應包含「社區」或「公司」字樣',
);
console.log(`  ✓ prompt 包含引導字樣: "${prompt.text}"`);

const promptAddr = buildFieldPrompt('address');
assert.ok(promptAddr.text.length > 0);
console.log('  ✓ address 也有 prompt');

// ─── 6. CSV schema 確認 community 欄位存在 ───
console.log('\n--- CSV schema ---');

const csvWriterSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'order', 'csvWriter.js'),
  'utf8',
);
assert.ok(csvWriterSource.includes('community'), 'csvWriter 應有 community 欄位');
console.log('  ✓ csvWriter 有 community 欄位');

console.log('\n========================================');
console.log('ALL COMMUNITY FIELD TESTS PASSED ✓');
console.log('========================================\n');
