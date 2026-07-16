'use strict';

/**
 * 轉帳截圖分析器（P6 · 2026-07-16 加）
 *
 * 功能：分析顧客上傳的轉帳/街口支付截圖，提取金額、帳號末五碼等資訊，
 *      用於對比訂單 expected_amount 並標記 likely_paid。
 *
 * 支援 4 種支付方式（來自 chicken.yaml payment.*）：
 *   1. 現金：依現金規則，後續貨到付款（不走 OCR）
 *   2. 轉帳：客戶轉帳後回傳截圖 → 對比 expected amount → likely_paid
 *   3. 街口支付：P4 推 QR code 後，客戶付款回傳截圖 → 對比 → likely_paid
 *   4. LINE Pay：落後選項不主動提供，客戶詢問才給老闆 LINE ID
 *
 * Vision provider：minimax（透過 OpenClaw Gateway）
 * - 如未來要更換 LLM provider，只需改 analyzeWithVision() 實作
 * - Stub mode：如果 vision API 失敗，回傳 confidence: 0 → 標記人工審核
 *
 * 用法：
 *   const { analyzeReceipt } = require('./src/handoff/receiptAnalyzer');
 *   const result = await analyzeReceipt({
 *     imagePath: 'data/receipts/PENDING-123/transfer.png',
 *     orderContext: { total_amount: 380, payment_method: 'transfer' }
 *   });
 *   // result: { likely_paid: true, detected_amount: 380, detected_account_last5: '12345', confidence: 0.92, source: 'minimax_vision' }
 */

const fs = require('fs');
const path = require('path');
const http = require('http'); // OpenClaw Gateway 通常是 http (本地)
const https = require('https');
const logger = require('../utils/logger');

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
const VISION_TIMEOUT_MS = 30000;

/**
 * 分析轉帳截圖（主入口）
 * @param {object} options
 * @param {string} options.imagePath - 本地圖片路徑（PNG/JPG）
 * @param {object} options.orderContext - 訂單 context
 * @param {number} options.orderContext.total_amount - 訂單金額
 * @param {string} options.orderContext.payment_method - 付款方式（cash/transfer/jko/linepay）
 * @returns {Promise<AnalysisResult>}
 */
async function analyzeReceipt(options) {
  const { imagePath, orderContext = {} } = options || {};

  // 1. 驗證輸入
  if (!imagePath) {
    return makeResult({ error: 'image_path_required' });
  }
  if (!fs.existsSync(imagePath)) {
    logger.warn('[receiptAnalyzer] 圖片不存在', { imagePath });
    return makeResult({ error: 'image_not_found', imagePath });
  }

  // 2. 現金付款不分析
  if (orderContext.payment_method === 'cash') {
    logger.info('[receiptAnalyzer] 現金付款跳過分析', { imagePath });
    return makeResult({
      likely_paid: false,
      detected_amount: null,
      detected_account_last5: null,
      confidence: 1.0,
      source: 'cash_skip',
      note: '現金付款，無需 OCR 對比，後續貨到付款',
    });
  }

  // 3. 呼叫 vision API
  try {
    const visionResult = await analyzeWithVision(imagePath, orderContext);

    // 4. 對比金額判斷 likely_paid
    const expectedAmount = Number(orderContext.total_amount) || 0;
    const detectedAmount = Number(visionResult.detected_amount) || null;
    const likelyPaid = detectedAmount !== null && isAmountMatch(detectedAmount, expectedAmount);

    return makeResult({
      likely_paid: likelyPaid,
      detected_amount: detectedAmount,
      detected_account_last5: visionResult.detected_account_last5 || null,
      confidence: Number(visionResult.confidence) || 0,
      source: 'minimax_vision',
      raw_response: visionResult.raw_response,
    });
  } catch (e) {
    // 5. Vision API 失敗 → 標記人工審核
    logger.warn('[receiptAnalyzer] Vision API 失敗，標記人工審核', { err: e.message, imagePath });
    return makeResult({
      likely_paid: false,
      detected_amount: null,
      detected_account_last5: null,
      confidence: 0,
      source: 'vision_api_failed',
      error: e.message,
    });
  }
}

/**
 * 呼叫 minimax vision API（透過 OpenClaw Gateway）
 * @param {string} imagePath
 * @param {object} orderContext
 * @returns {Promise<{detected_amount: number|null, detected_account_last5: string|null, confidence: number, raw_response: object}>}
 */
function analyzeWithVision(imagePath, orderContext) {
  return new Promise((resolve, reject) => {
    // 讀圖片為 base64
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    // OpenClaw Gateway vision endpoint
    // POST /v1/vision/analyze
    const requestBody = JSON.stringify({
      image: { base64: imageBase64, mime_type: mimeType },
      prompt: buildVisionPrompt(orderContext),
      context: { total_amount: orderContext.total_amount, payment_method: orderContext.payment_method },
      model: 'minimax-vision', // 與 Discord 圖片理解同樣的 provider
    });

    const url = new URL(GATEWAY_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/v1/vision/analyze',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: VISION_TIMEOUT_MS,
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              detected_amount: parsed.detected_amount || null,
              detected_account_last5: parsed.detected_account_last5 || null,
              confidence: parsed.confidence || 0,
              raw_response: parsed,
            });
          } catch (e) {
            reject(new Error(`Vision API 回傳解析失敗: ${data.substring(0, 200)}`));
          }
        } else {
          reject(new Error(`Vision API HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Vision API timeout (${VISION_TIMEOUT_MS}ms)`)));
    req.write(requestBody);
    req.end();
  });
}

/**
 * 建立 vision prompt（引導 LLM 提取結構化資訊）
 */
function buildVisionPrompt(orderContext) {
  const expectedAmount = orderContext.total_amount || 0;
  return `請分析這張轉帳/支付截圖，提取以下資訊：

1. **轉帳金額**（新台幣 NT$，純數字，例如 380）
2. **轉出帳號末五碼**（例如 12345）
3. **轉帳時間**（ISO 8601，例如 2026-07-16T14:30:00+08:00）
4. **付款方式**（transfer / jko / linepay）

**預期訂單金額**：NT$${expectedAmount}

請以 JSON 格式回應：
\`\`\`json
{
  "detected_amount": 380,
  "detected_account_last5": "12345",
  "transfer_time": "2026-07-16T14:30:00+08:00",
  "payment_method": "transfer",
  "confidence": 0.95
}
\`\`\`

注意事項：
- 如果截圖模糊、看不清楚，confidence 應 < 0.5
- 如果找不到特定欄位，填 null
- confidence 應反映整體判斷信心（0-1 之間）
- 只回 JSON，不要其他文字`;
}

/**
 * 判斷偵測金額是否匹配訂單金額（容許 ±1 元誤差）
 */
function isAmountMatch(detected, expected) {
  if (typeof detected !== 'number' || typeof expected !== 'number') return false;
  return Math.abs(detected - expected) <= 1;
}

/**
 * 統一回傳格式
 */
function makeResult(overrides) {
  return {
    likely_paid: false,
    detected_amount: null,
    detected_account_last5: null,
    confidence: 0,
    source: 'unknown',
    analyzed_at: new Date().toISOString(),
    ...overrides,
  };
}

module.exports = {
  analyzeReceipt,
  analyzeWithVision,
  isAmountMatch,
  buildVisionPrompt,
};
