'use strict';

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const resolve = (rel) => require.resolve(path.join(SRC, rel));

function loadWriter({ digestTo }) {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(SRC)) delete require.cache[key];
  }
  const realConfig = require(resolve('config'));
  const sent = [];
  const stub = (rel, exports) => {
    const id = resolve(rel);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  stub('config', {
    ...realConfig,
    isFeatureEnabled: () => true,
    getEmailConfig: () => (digestTo === undefined ? null : { digest_to: digestTo }),
  });
  stub('storage/db', { createOrder: () => {} });
  stub('handoff/emailNotifier', { sendEmail: async (msg) => { sent.push(msg); } });
  return { csvWriter: require(resolve('order/csvWriter')), sent };
}

const flush = () => new Promise((r) => setImmediate(() => setImmediate(r)));

const transferOrder = { order_id: 'ORD-TEST-EMAIL-001', payment_method: 'transfer', total_amount: 820 };

test('轉帳訂單的核帳信寄到 config 的 email.digest_to', async () => {
  const { csvWriter, sent } = loadWriter({ digestTo: 'owner@example.com' });
  csvWriter.writeOrder(transferOrder);
  await flush();
  assert.strictEqual(sent.length, 1, '應寄出一封核帳信');
  assert.strictEqual(sent[0].to, 'owner@example.com');
  assert.ok(sent[0].subject.includes('ORD-TEST-EMAIL-001'));
});

test('email.digest_to 未設定時不寄核帳信，建單照常成功', async () => {
  const { csvWriter, sent } = loadWriter({ digestTo: undefined });
  assert.strictEqual(csvWriter.writeOrder(transferOrder), 'ORD-TEST-EMAIL-001');
  await flush();
  assert.strictEqual(sent.length, 0);
});

test('現金訂單不寄核帳信', async () => {
  const { csvWriter, sent } = loadWriter({ digestTo: 'owner@example.com' });
  csvWriter.writeOrder({ ...transferOrder, payment_method: 'cash' });
  await flush();
  assert.strictEqual(sent.length, 0);
});
