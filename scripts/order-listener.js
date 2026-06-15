'use strict';

/**
 * 訂單 Listener（雞味研究所客服）
 *
 * 從 OpenClaw sessions 目錄讀取最新 assistant output，
 * 解析 `===訂單確認===...===END===` 與 `===付款更新===...===END===` 區塊，
 * 自動呼叫 `writeOrder` / `updateOrder` 寫入 CSV。
 *
 * 為何不用 JSON：LLM 算括號容易出錯，純文字 K=V 格式更可靠。
 *
 * 運作方式：
 * 1. 定期（每 3 秒）掃描 OpenClaw sessions 目錄
 * 2. 讀取每個 session 的最新 assistant output
 * 3. 解析 action block
 * 4. 寫入 CSV
 * 5. 失敗時透過 notifyHubert 通知管理員
 *
 * 使用方式：
 *   node scripts/order-listener.js
 *
 * 環境變數：
 *   OPENCLAW_SESSIONS_DIR - OpenClaw sessions 目錄
 *   NOTIFY_LINE_TOKEN     - LINE Bot token（從 notifier 取得）
 *   NOTIFY_LINE_USER_ID   - 通知對象（Hubert）
 *   LISTENER_INTERVAL_MS   - 掃描間隔（毫秒，預設 3000）
 */

const fs = require('fs');
const path = require('path');
const { writeOrder, updateOrder } = require('../src/order/csvWriter');
const { getOpenDates } = require('../src/config');
const { isOpenDate, validateDate, getNextOrderableOpenDate } = require('../src/rules/dateRule');
const { validateTimeSlotWithDate } = require('../src/rules/timeSlotRule');
const { validateMenu } = require('../src/rules/menuRule');
const { validateAddress, validatePhone } = require('../src/rules');

const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR ||
                     '/home/clawuser/.openclaw/agents/external-user/sessions/';
const INTERVAL_MS = parseInt(process.env.LISTENER_INTERVAL_MS || '3000', 10);

// 已處理的 sessionId set（避免重複處理）
const processedSessions = new Set();

// 從環境變數或 notifier.js 取得 LINE token
let LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN || '';
let HUBERT_LINE_USER_ID = process.env.HUBERT_LINE_USER_ID || 'Uf56650056d35626deb64165926a26182';

if (!LINE_BOT_TOKEN) {
  try {
    const notifier = require('../src/handoff/notifier');
    LINE_BOT_TOKEN = notifier.LINE_BOT_TOKEN;
    HUBERT_LINE_USER_ID = notifier.HUBERT_LINE_USER_ID;
  } catch (e) {
    console.warn('[order-listener] 無法載入 notifier，通知功能將無法使用');
  }
}

// === Action Block 解析 ===

/**
 * 解析 assistant text 中的 action blocks
 * @param {string} text - LLM 輸出
 * @returns {Array<{action: string, data: object, raw: string}>}
 */
function parseActionBlocks(text) {
  const blocks = [];

  // ===訂單確認===...===END===
  const orderPattern = /===訂單確認===\s*([\s\S]*?)===END===/g;
  let match;
  while ((match = orderPattern.exec(text)) !== null) {
    const data = parseKeyValue(match[1]);
    if (data) {
      blocks.push({ action: 'write_order', data, raw: match[0] });
    }
  }

  // ===付款更新===...===END===
  const paymentPattern = /===付款更新===\s*([\s\S]*?)===END===/g;
  while ((match = paymentPattern.exec(text)) !== null) {
    const data = parseKeyValue(match[1]);
    if (data) {
      blocks.push({ action: 'update_payment', data, raw: match[0] });
    }
  }

  return blocks;
}

/**
 * 解析 K=V 對（含 list 格式：`- key x1` 或 `key: value`）
 * @param {string} content
 * @returns {object|null}
 */
function parseKeyValue(content) {
  const lines = content.split('\n');
  const data = {};
  let currentList = null; // 當前 list 的 key

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 處理 list 格式：`- 鹽水雞 x1`
    if (trimmed.startsWith('- ')) {
      const item = trimmed.substring(2).trim();
      // 解析 "品項名 x數量" 或 "品項名 380 x1 = 380"
      const m = item.match(/^(.+?)\s+x?(\d+)(?:\s*=\s*(\d+))?$/);
      if (m) {
        if (currentList) {
          if (!data[currentList]) data[currentList] = [];
          data[currentList].push({ name: m[1].trim(), qty: parseInt(m[2], 10), total: m[3] ? parseInt(m[3], 10) : null });
        }
      }
      continue;
    }

    // 處理 K=V 格式：`key: value` 或 `key: "value"`
    const m = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      let value = m[2].trim();
      // 移除引號
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      // 數字轉型（但電話、order_id 等保留為字串）
      const isNumericKey = ['小計', '運費', '總金額', '數量'].includes(key);
      if (isNumericKey && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }

      data[key] = value;

      // 如果 key 以 "品項" 開頭，後續行可能是 list
      if (key.startsWith('品項')) {
        currentList = key;
      } else {
        currentList = null;
      }
    }
  }

  return Object.keys(data).length > 0 ? data : null;
}

// === 寫入處理 ===

/**
 * 處理一個 action block
 * @param {object} block
 * @returns {{success: boolean, message: string, orderId?: string}}
 */
function processBlock(block) {
  if (block.action === 'write_order') {
    return processWriteOrder(block.data);
  } else if (block.action === 'update_payment') {
    return processUpdatePayment(block.data);
  }
  return { success: false, message: `Unknown action: ${block.action}` };
}

/**
 * 處理 ===訂單確認=== 區塊
 * @param {object} data
 */
function processWriteOrder(data) {
  // 驗證必填欄位
  const required = ['姓名', '電話', '地址', '日期', '時段', '品項', '總金額'];
  const missing = required.filter((k) => !(k in data));
  if (missing.length > 0) {
    return { success: false, message: `缺少必填欄位: ${missing.join(', ')}` };
  }

  // 驗證電話
  const phoneResult = validatePhone(data['電話']);
  if (!phoneResult.valid) {
    return { success: false, message: `電話格式錯誤: ${phoneResult.errorMessage}` };
  }

  // 驗證地址
  const addressResult = validateAddress(data['地址']);
  if (!addressResult.valid) {
    return { success: false, message: `地址錯誤: ${addressResult.errorMessage}` };
  }

  // 驗證日期
  const dateResult = validateDate(data['日期']);
  if (!dateResult.valid) {
    return { success: false, message: `日期錯誤: ${dateResult.errorMessage}` };
  }

  // 驗證時段
  const timeSlotResult = validateTimeSlotWithDate(data['日期'], data['時段']);
  if (!timeSlotResult.valid) {
    return { success: false, message: `時段錯誤: ${timeSlotResult.errorMessage}` };
  }

  // 解析品項
  const items = Array.isArray(data['品項']) ? data['品項'] : [];
  if (items.length === 0) {
    return { success: false, message: '品項為空' };
  }

  // 驗證品項（從 knowledge 載入）
  const itemsForValidation = items.map((i) => `${i.name} x${i.qty}`).join(', ');
  const menuResult = validateMenu(itemsForValidation);
  if (!menuResult.valid) {
    return { success: false, message: `品項錯誤: ${menuResult.errorMessage}` };
  }

  // 分類品項（chicken / side / extra）
  const chicken_items = {};
  const side_items = {};
  const extra_items = {};
  for (const item of items) {
    if (item.name.includes('雞') || item.name.includes('鴨') || item.name.includes('鵝')) {
      chicken_items[item.name] = item.qty;
    } else if (item.name.includes('秘製')) {
      side_items[item.name] = item.qty;
    } else {
      extra_items[item.name] = item.qty;
    }
  }

  // 計算小計（用 knowledge 的價格，與 LLM 計算的交叉驗證）
  const { calculatePrice } = require('../src/rules/priceRule');
  const priceCalc = calculatePrice(menuResult.parsedItems);
  const expectedSubtotal = priceCalc.totalAmount;
  const llmSubtotal = typeof data['小計'] === 'number' ? data['小計'] : null;
  if (llmSubtotal !== null && Math.abs(llmSubtotal - expectedSubtotal) > 1) {
    console.warn(`[order-listener] 小計不一致: LLM=${llmSubtotal}, 計算=${expectedSubtotal}`);
  }

  // 寫入 CSV
  try {
    const orderId = `LISTENER-${Date.now()}`;
    const orderData = {
      order_id: orderId,
      created_at: new Date().toISOString(),
      user_line_name: data['姓名'],
      user_phone: phoneResult.valid ? data['電話'].replace(/[\s\-()]/g, '') : data['電話'],
      address: data['地址'],
      delivery_date: data['日期'],
      time_slot: timeSlotResult.specifiedTime,
      chicken_items,
      side_items,
      extra_items,
      chicken_count: priceCalc.chickenCount,
      side_count: priceCalc.sideCount,
      total_boxes: priceCalc.totalBoxes,
      subtotal: expectedSubtotal,
      delivery_fee: 0,
      total_amount: expectedSubtotal,
      payment_method: '待定',
      payment_status: 'pending',
      order_status: 'confirmed',
      customer_notes: data['備註'] || '',
      source: 'order-listener',
      intent_confirmed: true,
    };

    writeOrder(orderData);

    return { success: true, message: '訂單已寫入', orderId };
  } catch (e) {
    return { success: false, message: `CSV 寫入失敗: ${e.message}` };
  }
}

/**
 * 處理 ===付款更新=== 區塊
 * @param {object} data
 */
function processUpdatePayment(data) {
  if (!data.order_id) {
    return { success: false, message: '缺少 order_id' };
  }
  if (!data.付款狀態) {
    return { success: false, message: '缺少 付款狀態' };
  }

  try {
    const updates = {
      payment_status: data.付款狀態,
      payment_method: data.付款方式 || '待定',
    };
    const success = updateOrder(data.order_id, updates);
    if (success) {
      return { success: true, message: '付款狀態已更新' };
    }
    return { success: false, message: '找不到對應訂單' };
  } catch (e) {
    return { success: false, message: `更新失敗: ${e.message}` };
  }
}

// === 通知 ===

/**
 * 透過 LINE Push 通知 Hubert
 */
async function notifyHubert(message) {
  if (!LINE_BOT_TOKEN) {
    console.warn('[order-listener] LINE_BOT_TOKEN 未設定，無法通知');
    return false;
  }

  const https = require('https');
  const payload = JSON.stringify({
    to: HUBERT_LINE_USER_ID,
    messages: [{ type: 'text', text: message }],
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_BOT_TOKEN}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// === 主迴圈：掃描 sessions ===

/**
 * 取得所有未處理的 session 檔案
 */
function getNewSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SESSIONS_DIR);
  const newSessions = [];

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    const sessionId = file.replace('.jsonl', '');

    if (processedSessions.has(sessionId)) continue;

    const fullPath = path.join(SESSIONS_DIR, file);
    const stats = fs.statSync(fullPath);

    // 跳過 jsonl.reset 檔（OpenClaw 的重置檔）
    if (file.includes('.reset.')) continue;

    newSessions.push({ sessionId, fullPath, mtime: stats.mtimeMs });
  }

  return newSessions;
}

/**
 * 從 session jsonl 讀取最新 assistant 輸出
 */
function readLatestAssistantOutput(sessionFile) {
  if (!fs.existsSync(sessionFile)) return null;

  const content = fs.readFileSync(sessionFile, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());

  // 找最後一個 assistant message
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const event = JSON.parse(lines[i]);
      if (event.type === 'message' && event.message?.role === 'assistant') {
        // 提取文字內容
        const content = event.message?.content;
        if (Array.isArray(content)) {
          return content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        }
        if (typeof content === 'string') {
          return content;
        }
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  }

  return null;
}

/**
 * 處理單個 session
 */
async function processSession(sessionId, sessionFile) {
  const output = readLatestAssistantOutput(sessionFile);
  if (!output) return;

  const blocks = parseActionBlocks(output);
  if (blocks.length === 0) return;

  for (const block of blocks) {
    const result = processBlock(block);
    if (result.success) {
      console.log(`[order-listener] ✅ ${sessionId}: ${result.message}${result.orderId ? ` (${result.orderId})` : ''}`);
    } else {
      console.log(`[order-listener] ❌ ${sessionId}: ${result.message}`);
      // 通知 Hubert
      await notifyHubert(`🔔 [order-listener] 訂單處理失敗\n\nSession: ${sessionId}\n錯誤: ${result.message}\n\nBlock:\n${block.raw.substring(0, 500)}`);
    }
  }
}

/**
 * 主迴圈
 */
async function main() {
  console.log('[order-listener] 啟動...');
  console.log(`[order-listener] 監聽目錄: ${SESSIONS_DIR}`);
  console.log(`[order-listener] 掃描間隔: ${INTERVAL_MS}ms`);

  setInterval(async () => {
    try {
      const newSessions = getNewSessions();
      for (const { sessionId, fullPath } of newSessions) {
        await processSession(sessionId, fullPath);
        processedSessions.add(sessionId);
      }
    } catch (e) {
      console.error('[order-listener] 掃描錯誤:', e.message);
    }
  }, INTERVAL_MS);
}

// 啟動
if (require.main === module) {
  main();
}

module.exports = {
  parseActionBlocks,
  parseKeyValue,
  processBlock,
  processWriteOrder,
  processUpdatePayment,
};
