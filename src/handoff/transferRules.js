'use strict';

/**
 * Human Handoff 觸發條件比對器
 *
 * 設計原則：
 * - 使用「語意相近就觸發」（Semantic Matching），非精確關鍵字比對
 * - 關鍵字/規則先行快速過濾明顯案例
 * - 模糊案例使用 LLM 語意判斷（MiniMax API）
 * - 安全閘：所有轉人工都要先寫入 CSV，再通知 Hubert
 */

// 14 種條件的關鍵字表（快速過濾用）
const TRIGGER_PATTERNS = [
  // L1: 退款
  {
    type: 'refund_request',
    level: 'L1',
    keywords: ['退款', '退錢', '退我', '退貨', '退回去', '還錢', '收回', 'cancel order', 'refund'],
    patterns: [
      /我要退款/i, /錢退回来/i, /退我錢/i, /退款給我/i,
      /退貨/i, /退貨要求/i, /要求退貨/i,
    ],
  },
  // L1: 取消已成立訂單（CONFIRMING/AWAITING_PAYMENT 狀態才觸發）
  {
    type: 'cancel_request',
    level: 'L1',
    keywords: ['取消訂單', '取消吧', '取消喔', '拔單', '撤單', '不訂了'],
    patterns: [
      /我要取消（整筆|這個|全部）訂單/i,
      /想要取消（整筆|這個|全部）訂單/i,
      /取消整筆/i,
      /不訂了/i,
      /取消訂單/i,
      /取消吧/i,
      /拔單/i,
      /撤單/i,
    ],
  },
  // L1: 收單後想改天
  {
    type: 'reschedule_request',
    level: 'L1',
    keywords: ['改天', '改日期', '改時間', '換日期', '換時間', '改到', '改為', '延後', '换日期', '换时间'],
    patterns: [
      /改天/i, /改日期/i, /改時間/i, /換日期/i, /換時間/i,
      /改到/i, /改為/i, /改一下(時間|时间)/i, /换日期/i, /换时间/i,
    ],
  },
  // L1: 抱怨品質/配送/服務
  {
    type: 'complaint',
    level: 'L1',
    keywords: ['壞了', '有問題', '壞掉', '爛掉', '投訴', '客訴', '抱怨', '太慢', '送錯', '不新鮮', '壞掉了', '不好吃'],
    patterns: [
      /東西壞了/i, /商品有問題/i, /雞肉壞了/i, /不新鮮/i,
      /太慢/i, /送錯/i, /客訴/i, /投訴/i,
      /要抱怨/i, /有問題/i,
    ],
  },
  // L1: 明確要求真人（必須在 escalation 之前）
  {
    type: 'explicit_request',
    level: 'L1',
    keywords: ['真人', '不要AI', '人類', '活人', '人來處理', '人工', '我要跟', '叫真人', '跟真人說'],
    patterns: [
      /我要跟真人說/i, /不要ai/i, /不要機器人/i,
      /叫真人來/i, /我要跟人說/i, /跟真人說/i,
    ],
  },
  // L1: 態度激動/爭議（放在 explicit_request 之後）
  {
    type: 'escalation',
    level: 'L1',
    keywords: ['叫老闆', '不要AI', '叫人來', '態度惡劣', '老闆'],
    patterns: [
      /叫老闆/i, /不要ai/i, /叫人來/i, /你很糟/i,
    ],
  },
  // L2: 特殊折扣
  {
    type: 'discount_request',
    level: 'L2',
    keywords: ['打折', '便宜', '折扣', '優惠', '減價', '降價', '便宜點', '優惠些', '打个折'],
    patterns: [
      /打折/i, /便宜.*點/i, /打個折/i, /優惠.*一些/i,
      /減價/i, /降價/i, /折扣/i,
    ],
  },
  // L2: 配送範圍外
  {
    type: 'delivery_confirm_needed',
    level: 'L2',
    keywords: [], // 地址驗證失敗時直接觸發，不靠關鍵字
    patterns: [],
  },
  // L2: 大量訂購/公司合作
  {
    type: 'bulk_order',
    level: 'L2',
    keywords: ['公司', '團購', '大量', '合作', '企業', '採購', '很多', 'batch', 'corporate'],
    patterns: [
      /公司.*訂/i, /大量.*訂/i, /企業.*合作/i,
      /團購.*訂/i, /很多.*盒/i,
    ],
  },
  // L2: 金額異常（> NT$3000）
  {
    type: 'high_value_order',
    level: 'L2',
    keywords: [], // 金額計算時直接觸發，不靠關鍵字
    patterns: [],
  },
  // L3: 付款截圖金額不符
  {
    type: 'payment_mismatch',
    level: 'L3',
    keywords: ['金額不符', '轉錯', '匯錯', '轉少了', '少匯', '截圖不清楚', '金額不對'],
    patterns: [
      /金額不符/i, /轉錯/i, /匯錯/i, /轉少了/i,
      /截圖.*不清/i, /看不清楚/i,
    ],
  },
  // L3: LINE Pay 失敗/過期
  {
    type: 'linepay_failed',
    level: 'L3',
    keywords: ['LINE Pay 失敗', 'LINE Pay 過期', '付不了', '付不了款', '無法付款', '付款失敗'],
    patterns: [
      /line pay.*失敗/i, /line pay.*過期/i, /付不了/i,
      /無法.*付款/i, /付款.*失敗/i,
    ],
  },
  // L3: 開團日期不確定
  {
    type: 'open_date_inquiry',
    level: 'L3',
    keywords: ['這週有開嗎', '什麼時候開', '開團日期', '有開嗎', '開團嗎', '可以訂嗎', '幾號開'],
    patterns: [
      /這週.*開/i, /什麼時候.*開/i, /有開嗎/i,
      /開團.*日期/i, /開團嗎/i, /可以訂.*嗎/i,
    ],
  },
  // L3: 截單後變更（需在 reschedule_request 之後，避免「改」被搶先匹配）
  {
    type: 'late_modify',
    level: 'L3',
    keywords: ['追加', '再加', '加一盒', '再追加', '改小菜', '改時段', '變更', '多一盒', '改一下小菜'],
    patterns: [
      /追加/i, /再加/i, /加一盒/i, /再追加/i,
      /改小菜/i, /改時段/i, /變更小菜/i, /改一下小菜/i,
    ],
  },
];

/**
 * 快速關鍵字比對（不使用 LLM）
 * @param {string} message
 * @returns {{ matched: boolean, type: string|null, level: string|null }}
 */
function quickMatch(message) {
  const msg = message.trim();

  for (const trigger of TRIGGER_PATTERNS) {
    // 先檢查 keywords
    for (const kw of trigger.keywords) {
      if (msg.includes(kw)) {
        return { matched: true, type: trigger.type, level: trigger.level };
      }
    }
    // 再檢查 patterns
    for (const pattern of trigger.patterns) {
      if (pattern.test(msg)) {
        return { matched: true, type: trigger.type, level: trigger.level };
      }
    }
  }

  return { matched: false, type: null, level: null };
}

/**
 * 語意相似度判斷（使用 MiniMax API）
 * 當 quickMatch 未命中時，對模糊訊息做語意分類
 *
 * @param {string} message - 客戶訊息
 * @param {string} context - 對話上下文（可選）
 * @returns {Promise<{ matched: boolean, type: string|null, level: string|null, confidence: number }>}
 */
async function semanticMatch(message, context = '') {
  // 先做快速匹配
  const quick = quickMatch(message);
  if (quick.matched) {
    return { ...quick, confidence: 1.0 };
  }

  // 模糊匹配：使用 MiniMax API 進行語意分類
  // 這裡使用內建的模糊規則作為 fallback
  // 實際部署時可替換為 MiniMax API 調用

  const msg = message.toLowerCase();

  // 模糊案例：語意相近但關鍵字不明顯
  const fuzzyTriggers = [
    { type: 'complaint', patterns: ['爛', '糟糕', '失望', '不滿意', '不及格', '很差', '不 ok'] },
    { type: 'discount_request', patterns: ['貴', '太貴', '好貴', '能不能', '可以便宜', '給我優惠'] },
    { type: 'reschedule_request', patterns: ['明天', '後天', '改天', '改天吧', '下次', '下次再'] },
    { type: 'cancel_request', patterns: ['算了', '不要了', '先不訂', '等等再說', '我再想想'] },
  ];

  for (const fuzzy of fuzzyTriggers) {
    for (const pattern of fuzzy.patterns) {
      if (msg.includes(pattern)) {
        return { matched: true, type: fuzzy.type, level: 'L2', confidence: 0.7 };
      }
    }
  }

  return { matched: false, type: null, level: null, confidence: 0 };
}

/**
 * 判斷是否應觸發 Human Handoff
 * @param {string} message - 客戶訊息
 * @param {object} options - 額外選項
 * @param {number} [options.totalAmount] - 訂單金額
 * @param {string} [options.address] - 客戶地址
 * @param {string} [options.context] - 對話上下文
 * @returns {Promise<{ shouldTransfer: boolean, type: string|null, level: string|null }>}
 */
async function shouldTransfer(message, options = {}) {
  const { totalAmount, address, context } = options;

  // L2: 金額異常（> NT$3000）
  if (totalAmount && totalAmount > 3000) {
    return { shouldTransfer: true, type: 'high_value_order', level: 'L2' };
  }

  // L2: 地址超出配送範圍（由 addressRule 直接觸發）
  // 這裡不做重複判斷

  // 快速匹配
  const quick = quickMatch(message);
  if (quick.matched) {
    return { shouldTransfer: true, type: quick.type, level: quick.level };
  }

  // 語意匹配（模糊案例）
  const semantic = await semanticMatch(message, context);
  if (semantic.matched) {
    return { shouldTransfer: true, type: semantic.type, level: semantic.level };
  }

  return { shouldTransfer: false, type: null, level: null };
}

/**
 * 取得 handoff_type 對應的中文標題
 * @param {string} type
 * @returns {string}
 */
function getTypeLabel(type) {
  const labels = {
    refund_request: '【退貨/退款】',
    cancel_request: '【取消訂單】',
    reschedule_request: '【改天需求】',
    complaint: '【售後/客訴】',
    escalation: '【客訴/爭議】',
    explicit_request: '【明確要求真人】',
    discount_request: '【折扣請求】',
    delivery_confirm_needed: '【配送範圍確認】',
    bulk_order: '【大批訂單/公司合作】',
    high_value_order: '【金額異常】',
    payment_mismatch: '【付款異常】',
    linepay_failed: '【LINE Pay 付款失敗】',
    open_date_inquiry: '【開團日期確認】',
    late_modify: '【截單後變更】',
    product_inquiry: '【商品諮詢】',
    unanswered_questions: '【多次未答】',
  };
  return labels[type] || `【其他】${type}`;
}

module.exports = {
  shouldTransfer,
  quickMatch,
  semanticMatch,
  getTypeLabel,
  TRIGGER_PATTERNS,
};
