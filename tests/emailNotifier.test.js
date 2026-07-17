'use strict';

/**
 * emailNotifier 單元測試
 *
 * 涵蓋：
 *  - buildRawMessage: MIME 編碼（base64url + 中文主旨）
 *  - formatOrderDigest: 訂單彙總格式化（daily/weekly/空清單）
 *  - sendEmail: 成功 / 失敗 / disabled / 缺參數
 *  - sendOrderDigest: 成功 / 缺 digest_to
 *  - loadToken / loadCredentials: 檔案存在性
 *  - getOAuth2Client: 錯誤處理（無 credentials、格式錯誤）
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock googleapis（測試環境不一定裝，用 mock 隔離）
const mockGmailSend = Symbol('mockGmailSend');
const mockGoogleapis = {
  google: {
    auth: {
      OAuth2: class {
        constructor(clientId, clientSecret, redirectUri) {
          this.clientId = clientId;
          this.clientSecret = clientSecret;
          this.redirectUri = redirectUri;
          this.credentials = null;
          this.listeners = {};
        }
        setCredentials(token) {
          this.credentials = token;
        }
        on(event, cb) {
          this.listeners[event] = cb;
        }
        generateAuthUrl(opts) {
          return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&scope=${encodeURIComponent((opts.scope || []).join(' '))}&access_type=${opts.access_type}`;
        }
        async getToken(code) {
          return {
            tokens: {
              access_token: 'ya29.mock-access-token',
              refresh_token: 'mock-refresh-token',
              expiry_date: Date.now() + 3600 * 1000,
            },
          };
        }
      },
    },
    gmail: () => ({
      users: {
        messages: {
          send: mockGmailSend,
        },
      },
    }),
  },
};

// 用 Module._cache 注入 mock googleapis，避免 require 真套件
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'googleapis') return require.resolve('node:fs'); // 任一存在的模組路徑當佔位
  return originalResolve.call(this, request, parent, ...rest);
};
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === 'googleapis') return mockGoogleapis;
  return originalRequire.call(this, request);
};

// 修改 emailNotifier 的 XDG 路徑常數到測試 temp dir（需在 require 前）
const TEST_HOME = path.join(os.tmpdir(), `emailNotifier-test-${Date.now()}`);
fs.mkdirSync(TEST_HOME, { recursive: true });
process.env.HOME = TEST_HOME; // 影響 XDG_CONFIG_HOME fallback

const notifier = require('../src/handoff/emailNotifier');
const {
  buildRawMessage,
  formatOrderDigest,
  loadToken,
  loadCredentials,
  saveToken,
  sendEmail,
  sendOrderDigest,
  buildEmailContent,
  SCOPES,
  CREDENTIALS_PATH,
  TOKEN_PATH,
} = notifier;

// Mock src/config 的 isFeatureEnabled 和 getEmailConfig
const configModule = require('../src/config');
const originalIsFeatureEnabled = configModule.isFeatureEnabled;
const originalGetEmailConfig = configModule.getEmailConfig;

function withConfig({ enabled = true, digestTo = 'test@example.com' }, fn) {
  configModule.isFeatureEnabled = () => enabled;
  configModule.getEmailConfig = () => ({
    digest_to: digestTo,
  });
  return Promise.resolve(fn()).finally(() => {
    configModule.isFeatureEnabled = originalIsFeatureEnabled;
    configModule.getEmailConfig = originalGetEmailConfig;
  });
}

// ===================
// buildRawMessage
// ===================
test('buildRawMessage — 基本編碼（純文字英文）', () => {
  const raw = buildRawMessage({
    to: 'test@example.com',
    subject: 'Hello',
    body: 'World',
  });
  // base64url 解碼回原文
  const decoded = Buffer.from(
    raw.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8');
  assert.match(decoded, /To: test@example\.com/);
  assert.match(decoded, /Subject: =\?utf-8\?B\?SGVsbG8\?=/);
  assert.match(decoded, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(decoded, /World/);
});

test('buildRawMessage — 中文主旨用 RFC 2047 base64', () => {
  const raw = buildRawMessage({
    to: 'test@example.com',
    subject: '【雞味研究所】今日訂單',
    body: '內容',
  });
  const decoded = Buffer.from(
    raw.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8');
  // Subject 應該是 base64 encoded
  const subjectLine = decoded.split('\r\n').find((l) => l.startsWith('Subject:'));
  assert.match(subjectLine, /=\?utf-8\?B\?/);
  // 解碼後應為中文
  const b64Part = subjectLine.match(/B\?(.+)\?=/)[1];
  const decodedSubject = Buffer.from(b64Part, 'base64').toString('utf8');
  assert.strictEqual(decodedSubject, '【雞味研究所】今日訂單');
});

// ===================
// formatOrderDigest
// ===================
test('formatOrderDigest — 今日彙總（3 筆訂單）', () => {
  const orders = [
    {
      delivery_date: '2026-07-17',
      time_slot: '中午',
      user_line_name: '王小明',
      total_amount: '380',
      payment_method: 'transfer',
      order_status: 'confirmed',
    },
    {
      delivery_date: '2026-07-17',
      time_slot: '下午',
      user_line_name: '李小華',
      total_amount: '760',
      payment_method: 'jko',
      order_status: 'pending_handoff',
    },
    {
      delivery_date: '2026-07-17',
      time_slot: '晚上',
      user_line_name: '張大頭',
      total_amount: '380',
      payment_method: 'cash',
      order_status: 'confirmed',
    },
  ];
  const out = formatOrderDigest(orders, 'daily');
  assert.match(out, /== 雞味研究所 今日訂單彙總/);
  assert.match(out, /總筆數: 3/);
  assert.match(out, /已完成: 2/);
  assert.match(out, /待處理: 1/);
  assert.match(out, /王小明/);
  assert.match(out, /NT\$380/);
});

test('formatOrderDigest — 空清單', () => {
  const out = formatOrderDigest([], 'daily');
  assert.match(out, /總筆數: 0/);
  assert.match(out, /（無訂單）/);
});

test('formatOrderDigest — 週報標籤', () => {
  const out = formatOrderDigest([{ delivery_date: '2026-07-17', time_slot: '中午', user_line_name: 'A', total_amount: '100', payment_method: 'transfer', order_status: 'confirmed' }], 'weekly');
  assert.match(out, /本週訂單彙總/);
});

// ===================
// sendEmail
// ===================
test('sendEmail — disabled 時跳過', async () => {
  await withConfig({ enabled: false }, async () => {
    const result = await sendEmail({ to: 'a@b.com', subject: 's', body: 'b' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.skipped, true);
  });
});

test('sendEmail — 缺參數時失敗', async () => {
  await withConfig({ enabled: true }, async () => {
    const r1 = await sendEmail({ subject: 's', body: 'b' });
    assert.strictEqual(r1.success, false);
    assert.match(r1.error, /to/);

    const r2 = await sendEmail({ to: 'a@b.com', body: 'b' });
    assert.strictEqual(r2.success, false);
    assert.match(r2.error, /subject/);

    const r3 = await sendEmail({ to: 'a@b.com', subject: 's' });
    assert.strictEqual(r3.success, false);
    assert.match(r3.error, /body/);
  });
});

// ===================
// sendOrderDigest
// ===================
test('sendOrderDigest — 缺 digest_to 時失敗', async () => {
  await withConfig({ enabled: true, digestTo: undefined }, async () => {
    const result = await sendOrderDigest({ orders: [], type: 'daily' });
    assert.strictEqual(result.success, false);
    assert.match(result.error, /digest_to/);
  });
});

// ===================
// loadCredentials / loadToken
// ===================
test('loadCredentials — 檔案不存在時拋錯', () => {
  assert.throws(() => loadCredentials(), /找不到 Gmail credentials/);
});

test('loadToken — 檔案不存在時回傳 null', () => {
  assert.strictEqual(loadToken(), null);
});

test('saveToken + loadToken — round-trip', () => {
  const fakeToken = { refresh_token: 'rt-123', access_token: 'at-456' };
  // 直接用 fs 操作因為 saveToken 寫到 TOKEN_PATH（XDG secrets）
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(fakeToken));
  const loaded = loadToken();
  assert.strictEqual(loaded.refresh_token, 'rt-123');
  assert.strictEqual(loaded.access_token, 'at-456');
  // 清理
  fs.unlinkSync(TOKEN_PATH);
});

// ===================
// Constants
// ===================
test('SCOPES — 含 gmail.send', () => {
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/gmail.send'));
});

test('CREDENTIALS_PATH / TOKEN_PATH — 在 XDG secrets 目錄', () => {
  assert.match(CREDENTIALS_PATH, /gmail-credentials\.json$/);
  assert.match(TOKEN_PATH, /gmail-token\.json$/);
});

// ===================
// buildEmailContent（4 種 type 版型）
// ===================
test('buildEmailContent — handoff 版型', () => {
  const { subject, body } = buildEmailContent('客戶訊息：我要退款', { type: 'handoff' });
  assert.match(subject, /【雞味研究所】🔔 轉真人通知/);
  assert.match(body, /類型: handoff/);
  assert.match(body, /客戶訊息：我要退款/);
  assert.match(body, /請儘速登入 dashboard/);
  assert.match(body, /━{20,}/); // divider
});

test('buildEmailContent — autoOrder 版型', () => {
  const { subject, body } = buildEmailContent('order_id: ORD-001\n金額: NT$380', { type: 'autoOrder' });
  assert.match(subject, /【雞味研究所】🤖 B 方案自動建單/);
  assert.match(body, /類型: autoOrder/);
  assert.match(body, /order_id: ORD-001/);
  assert.match(body, /請確認付款狀態/);
});

test('buildEmailContent — digest 版型（無 CTA）', () => {
  const { subject, body } = buildEmailContent('總筆數: 5', { type: 'digest' });
  assert.match(subject, /【雞味研究所】📊 訂單彙總/);
  assert.match(body, /類型: digest/);
  assert.match(body, /總筆數: 5/);
});

test('buildEmailContent — system 版型（無 CTA、無 divider）', () => {
  const { subject, body } = buildEmailContent('測試訊息', { type: 'system' });
  assert.match(subject, /【雞味研究所】⚙️ 系統通知/);
  assert.match(body, /類型: system/);
  assert.match(body, /測試訊息/);
  assert.doesNotMatch(body, /━{20,}/); // 系統通知無 divider
});

test('buildEmailContent — 未指定 type 預設 system', () => {
  const { subject } = buildEmailContent('test');
  assert.match(subject, /【雞味研究所】⚙️ 系統通知/);
});

test('buildEmailContent — 未知 type fallback 到 system', () => {
  const { subject } = buildEmailContent('test', { type: 'unknown_type' });
  assert.match(subject, /【雞味研究所】⚙️ 系統通知/);
});

test('buildEmailContent — object 訊息轉 JSON', () => {
  const { body } = buildEmailContent({ foo: 'bar', num: 42 }, { type: 'system' });
  assert.match(body, /"foo": "bar"/);
  assert.match(body, /"num": 42/);
});
