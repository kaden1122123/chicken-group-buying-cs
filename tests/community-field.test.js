'use strict';

/**
 * P1-6: community 欄位加進 awaitingInfo 驗證測試
 */

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const {
  handleAwaitingInfo,
  buildFieldPrompt,
  FIELD_ORDER,
} = require('../src/states/awaitingInfo');
const { STATES, setStateDirectly, clearState } = require('../src/states/stateMachine');

test('FIELD_ORDER 包含 community 在正確位置', () => {
  const idxAddr = FIELD_ORDER.indexOf('address');
  const idxComm = FIELD_ORDER.indexOf('community');
  const idxName = FIELD_ORDER.indexOf('name');
  assert.ok(idxAddr >= 0, 'FIELD_ORDER 應有 address');
  assert.ok(idxComm >= 0, 'FIELD_ORDER 應有 community');
  assert.ok(idxName >= 0, 'FIELD_ORDER 應有 name');
  assert.ok(idxAddr < idxComm, 'address 應在 community 之前');
  assert.ok(idxComm < idxName, 'community 應在 name 之前');
});

test('完整流程：address → community → name（填社區）', () => {
  clearState('u1');
  setStateDirectly('u1', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

  const r1 = handleAwaitingInfo('u1', '三峽北大特區學成路100號', {}, { awaitingField: 'address' });
  assert.strictEqual(r1.context.awaitingField, 'community');
  assert.strictEqual(r1.orderData.address, '三峽北大特區學成路100號');

  const r2 = handleAwaitingInfo('u1', '皇翔玉品', r1.orderData, r1.context);
  assert.strictEqual(r2.context.awaitingField, 'name');
  assert.strictEqual(r2.orderData.community, '皇翔玉品');
});

test('跳過 community：用「無」/「略」/「-」等關鍵字', () => {
  const skipKeywords = ['無', '略', '沒', 'no', 'n', '-', '不填', '不用', 'skip', ''];
  for (const kw of skipKeywords) {
    clearState('skip-' + kw);
    setStateDirectly('skip-' + kw, STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

    const a1 = handleAwaitingInfo('skip-' + kw, '三峽北大特區學成路100號', {}, { awaitingField: 'address' });
    const a2 = handleAwaitingInfo('skip-' + kw, kw, a1.orderData, a1.context);

    assert.strictEqual(a2.context.awaitingField, 'name', `「${kw}」應跳到 name`);
    assert.ok(!('community' in a2.orderData), `「${kw}」不應存 community`);
  }
});

test('社區名特殊字符 + trim', () => {
  clearState('u-special');
  setStateDirectly('u-special', STATES.AWAITING_INFO, {}, { awaitingField: 'address' });

  const s1 = handleAwaitingInfo('u-special', '鶯歌區陶瓷路88號', {}, { awaitingField: 'address' });
  const s2 = handleAwaitingInfo('u-special', '王○公司（3樓）', s1.orderData, s1.context);
  assert.strictEqual(s2.orderData.community, '王○公司（3樓）');

  const s3 = handleAwaitingInfo('u-special', '  前面空白  ', s2.orderData, { awaitingField: 'community' });
  assert.strictEqual(s3.orderData.community, '前面空白', '應自動 trim');
});

test('buildFieldPrompt(\'community\') 給出引導字樣', () => {
  const prompt = buildFieldPrompt('community');
  assert.strictEqual(prompt.type, 'text');
  assert.ok(prompt.text.includes('社區') || prompt.text.includes('公司'), '應含「社區」或「公司」');

  const promptAddr = buildFieldPrompt('address');
  assert.ok(promptAddr.text.length > 0);
});

test('CSV schema 含 community 欄位', () => {
  const csvWriterSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'order', 'csvWriter.js'),
    'utf8',
  );
  assert.ok(csvWriterSource.includes('community'), 'csvWriter 應有 community 欄位');
});
