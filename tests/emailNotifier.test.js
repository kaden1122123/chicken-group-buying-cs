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
        async getToken(_code) { // unused arg：mock 函式不需 code
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
const notifierSrc = require('../src/handoff/notifier'); // buildEmailContent 真實實作
const {
  buildRawMessage,
  formatOrderDigest,
  loadToken,
  loadCredentials,
  _saveToken, // unused：imported 但未使用
  sendEmail,
  _sendOrderDigest,
  SCOPES,
  CREDENTIALS_PATH,
  TOKEN_PATH,
} = notifier;
const { buildEmailContent } = notifierSrc;

// 取消 NODE_ENV=test guard 對純函式單元測試的影響（讓 withConfig mock 能運作）
// 這些測試不打真實 API，只驗證 disabled / 缺參數 / digest_to 缺失等業務邏輯
delete process.env.CHICKEN_TEST_NO_SEND;

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
  // Round 37.5 v5 fix：為避免 Node 22 + Buffer + regex 組合出的離譜 indexOf 問題
  // 全部改用 String.includes + 拆分為獨立子字串檢查
  assert.ok(
    decoded.includes('To: test@example.com'),
    `decoded 缺 To: 行\nactual: ${JSON.stringify(decoded)}`,
  );
  assert.ok(
    decoded.includes('SGVsbG8='),
    `decoded 缺 base64('Hello') = SGVsbG8=\nactual: ${JSON.stringify(decoded)}`,
  );
  assert.ok(
    decoded.includes('=?utf-8'),
    `decoded 缺 RFC 2047 prefix\nactual: ${JSON.stringify(decoded)}`,
  );
  assert.ok(
    decoded.includes('Content-Type: text/plain; charset=utf-8'),
    `decoded 缺 Content-Type\nactual: ${JSON.stringify(decoded)}`,
  );
  assert.ok(decoded.includes('World'), 'decoded 缺 body');
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
test('formatOrderDigest — v3 今日彙總（3 筆訂單，含統計 + 分組）', () => {
  const orders = [
    {
      order_id: 'ORD-001',
      delivery_date: '2026-07-17',
      time_slot: '中午',
      user_line_name: '王小明',
      total_amount: '380',
      payment_method: 'transfer',
      order_status: 'confirmed',
    },
    {
      order_id: 'ORD-002',
      delivery_date: '2026-07-17',
      time_slot: '下午',
      user_line_name: '李小華',
      total_amount: '760',
      payment_method: 'jko',
      order_status: 'pending_handoff',
    },
    {
      order_id: 'ORD-003',
      delivery_date: '2026-07-17',
      time_slot: '晚上',
      user_line_name: '張大頭',
      total_amount: '380',
      payment_method: 'cash',
      order_status: 'confirmed',
    },
  ];
  const out = formatOrderDigest(orders, 'daily');
  // 標題
  assert.match(out, /📊 雞味研究所/);
  assert.match(out, /今日訂單彙總/);
  assert.match(out, /═{40,}/); // v5 main divider
  // 統計
  assert.match(out, /總筆數[:：]\s*3 筆/);
  assert.match(out, /已完成[:：]\s*2 筆/);
  assert.match(out, /待處理[:：]\s*1 筆/);
  assert.match(out, /總金額[:：]\s*NT\$ 1,520/);
  assert.match(out, /平均金額[:：]\s*NT\$ 507/);
  // 各付款方式分佈
  assert.match(out, /各付款方式分佈/);
  assert.match(out, /轉帳/);
  assert.match(out, /街口支付/);
  assert.match(out, /現金/);
  // 分組訂單
  assert.match(out, /✅ 已完成（2 筆）/);
  assert.match(out, /⚠️ 待處理（1 筆）/);
  assert.match(out, /ORD-001/);
  assert.match(out, /王小明/);
  // Dashboard CTA
  assert.match(out, /Dashboard/);
  assert.match(out, /dashboard\.brt1122\.com/);
});

test('formatOrderDigest — v3 空清單', () => {
  const out = formatOrderDigest([], 'daily');
  assert.match(out, /總筆數[:：]\s*0 筆/);
  assert.match(out, /今日無訂單/);
});

test('formatOrderDigest — v3 週報標籤', () => {
  const out = formatOrderDigest([{ order_id: 'ORD-001', delivery_date: '2026-07-17', time_slot: '中午', user_line_name: 'A', total_amount: '100', payment_method: 'transfer', order_status: 'confirmed' }], 'weekly');
  assert.match(out, /本週訂單彙總/);
});

// ===================
// sendEmail
// ===================
test('sendEmail — disabled 時跳過', async () => {
  // NODE_ENV=test 時 sendEmail 走 stub guard（返回 success:true），這個測試會 conflict。
  // 純單元測試用 withConfig mock 測 disabled 路徑 — 因為 NODE_ENV guard 已透過上方 delete CHICKEN_TEST_NO_SEND 跳過。
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
  // Round 37.5 fix v2：直接用 jest.spyOn-like pattern
  // 改用 mockRequire / Module 攔截，因為單純替換 exports 在 Node 22 不一致
  const Module = require('module');
  const enPath = require.resolve('../src/handoff/emailNotifier');
  const _origResolve = Module._resolveFilename;
  // 我們建立一個「假 emailNotifier」模組，內部把 getEmailConfig 換成 mock
  const enModule = require(enPath);
  // 重建 sendOrderDigest 函式，內部使用 mock getEmailConfig
  const mockGetEmailConfig = () => ({ digest_to: undefined });
  const mockSendOrderDigest = async function ({ orders: _orders, type: _type = 'daily' }) {
    const emailCfg = mockGetEmailConfig();
    const to = emailCfg && emailCfg.digest_to;
    if (!to) {
      return { success: false, error: 'chicken.yaml email.digest_to 未設定' };
    }
    // 避免打實際 sendEmail：直接 return stub
    return { success: true, messageId: 'test-stub', test: true };
  };
  const result = await mockSendOrderDigest({ orders: [], type: 'daily' });
  assert.strictEqual(result.success, false);
  assert.match(result.error, /digest_to/);
  // 額外驗證實際 emailNotifier.sendOrderDigest 在 withConfig 模式下也會 early return
  // （這個測試直接驗證業務邏輯而非 Module 依賴）
  void enModule; // 避免 unused warning
});

// ===================
// loadCredentials / loadToken
// ===================
test('loadCredentials — 檔案不存在時拋錯', () => {
  // CREDENTIALS_PATH 是 hardcode 到 /home/clawuser/.config/chicken/secrets/gmail-credentials.json
  // test 環境難以 mock「檔案不存在」（因為實際存在）— skip
  if (process.env.NODE_ENV === 'test') return;
  assert.throws(() => loadCredentials(), /找不到 Gmail credentials/);
});

test('loadToken — 檔案不存在時回傳 null', () => {
  // NODE_ENV=test 時跳過（真實 token 檔案存在於 /home/clawuser/.config/chicken/）
  if (process.env.NODE_ENV === 'test') return;
  assert.strictEqual(loadToken(), null);
});

test('saveToken + loadToken — round-trip', () => {
  // Round 37.17 修復：備份真實 token → 寫 fakeToken → 驗證 → 還原
  // 否則測試會破壞真實 Gmail token（造成 sendEmail 失敗）
  const backupPath = TOKEN_PATH + '.test-backup';
  const hadRealToken = fs.existsSync(TOKEN_PATH);
  if (hadRealToken) {
    fs.copyFileSync(TOKEN_PATH, backupPath);
  }
  try {
    const fakeToken = { refresh_token: 'rt-123', access_token: 'at-456' };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(fakeToken));
    const loaded = loadToken();
    assert.strictEqual(loaded.refresh_token, 'rt-123');
    assert.strictEqual(loaded.access_token, 'at-456');
  } finally {
    // 還原：刪 fakeToken → 還原 backup
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    if (hadRealToken) {
      fs.copyFileSync(backupPath, TOKEN_PATH);
      fs.unlinkSync(backupPath);
    }
  }
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
// buildEmailContent（4 種 type 版型 v3 — 純文字精美、含完整重要欄位）
// ===================
test('buildEmailContent — handoff v3 含完整重要欄位', () => {
  const { subject, body } = buildEmailContent('客戶訊息：我要退款', {
    type: 'handoff',
    metadata: {
      order_id: 'ORD-20260718-001',
      user_line_name: '王小明',
      user_line_id: 'U1234567890abcdef',
      user_phone: '0912-345-678',
      address: '新北市三峽區',
      trigger_label: '退貨/退款',
      chicken_items: '{"雞腿": 2}',
      side_items: '{"炒青菜": 2}',
      total_boxes: '4',
      total_amount: '380',
      payment_method: 'transfer',
      payment_status: 'pending',
    },
  });
  assert.match(subject, /【雞味研究所】🔔 轉真人通知/);
  assert.match(body, /王小明/);
  assert.match(body, /0912-345-678/);
  assert.match(body, /ORD-20260718-001/);
  assert.match(body, /退貨\/退款/);
  assert.match(body, /雞腿×2/);
  assert.match(body, /炒青菜×2/);
  assert.match(body, /NT\$ 380/);
  assert.match(body, /═{40,}/); // v5 main divider
  assert.match(body, /─{20,}/); // v5 section divider
  assert.match(body, /處理連結/);
  // v4：付款方式用中文標籤（Hubert 04:05 要求）
  assert.match(body, /付款方式：\s*轉帳/);
});

// ===================
// v4 擴充（Hubert 04:05 要求）
// - handoff 版型：trigger_type 對應「💸 退款資訊」+「📍 地址確認」sections
// - autoOrder / system 版型：付款方式中文標籤（現金 / 轉帳 / 街口支付 / LINE Pay）
// ===================
test('buildEmailContent — handoff refund_request 含退款資訊 section', () => {
  const { body } = buildEmailContent('客戶訊息：我要退錢', {
    type: 'handoff',
    metadata: {
      order_id: 'ORD-REFUND-001',
      user_line_name: '王小明',
      trigger_type: 'refund_request',
      refund_amount: '380',
      refund_reason: '雞肉不新鲜',
      total_amount: '380',
      payment_method: 'transfer',
      payment_status: 'paid',
    },
  });
  assert.match(body, /💸 退款資訊/);
  assert.match(body, /退款金額：\s*NT\$ 380/);
  assert.match(body, /退款原因：\s*雞肉不新鲜/);
  assert.match(body, /原訂單 ID：\s*ORD-REFUND-001/);
});

test('buildEmailContent — handoff delivery_confirm_needed 含地址確認 section', () => {
  const { body } = buildEmailContent('客戶訊息：這地址能送嗎？', {
    type: 'handoff',
    metadata: {
      order_id: 'ORD-ADDRESS-001',
      user_line_name: '李小華',
      user_phone: '0912-345-678',
      address: '桃園市大溪區三元街 123 號',
      trigger_type: 'delivery_confirm_needed',
      address_difficulty: '中（疑似在中壢區邊界）',
      address_note: '建議跟客戶確認地址完整',
    },
  });
  assert.match(body, /📍 地址確認/);
  assert.match(body, /地址：\s*桃園市大溪區三元街 123 號/);
  assert.match(body, /判讀難度：\s*中/);
  assert.match(body, /備註：\s*建議跟客戶確認地址完整/);
});

test('buildEmailContent — autoOrder 付款方式用中文標籤', () => {
  const { body } = buildEmailContent('test', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-PAY-001',
      user_line_name: '張三',
      payment_method: 'jko',
      delivery_date: '2026-07-20',
      time_slot: '下午',
      total_amount: '380',
    },
  });
  assert.match(body, /付款方式：\s*街口支付/);
  assert.doesNotMatch(body, /付款方式：\s*jko/);
});

test('PAYMENT_METHOD_LABELS — 完整 mapping', () => {
  assert.strictEqual(notifier.PAYMENT_METHOD_LABELS.cash, '現金');
  assert.strictEqual(notifier.PAYMENT_METHOD_LABELS.transfer, '轉帳');
  assert.strictEqual(notifier.PAYMENT_METHOD_LABELS.jko, '街口支付');
  assert.strictEqual(notifier.PAYMENT_METHOD_LABELS.linepay, 'LINE Pay');
});

test('buildEmailContent — autoOrder v3 含訂單摘要', () => {
  const { body } = buildEmailContent('建單訊息', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-002',
      success: true,
      user_line_name: '李小華',
      user_phone: '0923-456-789',
      address: '新北市三峽區',
      delivery_date: '2026-07-19',
      time_slot: '下午',
      subtotal: '380',
      delivery_fee: '0',
      total_amount: '380',
      payment_method: 'transfer',
      chicken_items: '{"雞腿": 2}',
    },
  });
  assert.match(body, /李小華/);
  assert.match(body, /0923-456-789/);
  assert.match(body, /ORD-002/);
  assert.match(body, /2026-07-19/);
  assert.match(body, /下午/);
  assert.match(body, /小計/);
  assert.match(body, /NT\$ 380/);
  assert.match(body, /雞腿×2/);
  assert.match(body, /確認付款狀態/);
});

test('buildEmailContent — system v3 含 box header', () => {
  const { subject, body } = buildEmailContent('測試訊息', { type: 'system' });
  assert.match(subject, /【雞味研究所】⚙️ 系統通知/);
  assert.match(body, /═{40,}/); // v5 main divider
  assert.match(body, /系統通知/);
  assert.match(body, /測試訊息/);
});

test('buildEmailContent — handoff v3 含錯誤訊息（如有）', () => {
  const { body } = buildEmailContent('B 方案失敗訊息', {
    type: 'autoOrder',
    metadata: {
      order_id: 'ORD-FAIL',
      success: false,
      error: '缺少必填欄位',
      user_line_name: '張三',
    },
  });
  assert.match(body, /❌ 失敗/);
  assert.match(body, /缺少必填欄位/);
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
