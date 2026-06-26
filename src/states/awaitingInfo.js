'use strict';

const { STATES } = require('./stateMachine');
const {
  validatePhone,
  validateAddress,
  validateMenu,
  validateDate,
  validateTimeSlot,
  parseItems,
  calculatePrice,
} = require('../rules');
const { textReply } = require('../utils/lineReply');
const { isReturningCustomer } = require('../order/csvReader');
const { formatDate } = require('../utils/timeUtils');

/**
 * AWAITING_INFO 狀態處理
 * 收集：地址、姓名、電話、品項、日期、時段、付款方式
 * 每個欄位通過 rules 驗證
 */

// 欄位收集順序
const FIELD_ORDER = ['address', 'name', 'phone', 'menu', 'date', 'timeSlot', 'paymentMethod'];

// 欄位解析正規表達式
const FIELD_PATTERNS = {
  address: /(?:地址|送到|送達)[:：]?\s*(.+)/i,
  name: /(?:姓名|名字|訂購人)[:：]?\s*(.+)/i,
  phone: /(?:電話|手機|聯絡)[:：]?\s*(.+)/i,
  menu: /(?:品項|訂購|要的|雞肉|小菜)[:：]?\s*(.+)/i,
  date: /(?:日期|時間|送達日)[:：]?\s*(\d{1,2}[月\/]\d{1,2}[日]?|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
  timeSlot: /(?:時段|上午|下午|早上|晚上)[:：]?\s*(.+)/i,
  paymentMethod: /(?:付款|支付|轉帳|現金|街口|LINE Pay)[:：]?\s*(.+)/i,
};

/**
 * 從訊息中解析欄位
 * @param {string} message
 * @returns {object} - { fieldName, value, rawMessage }
 */
function parseFieldFromMessage(message) {
  for (const [fieldName, pattern] of Object.entries(FIELD_PATTERNS)) {
    const match = message.match(pattern);
    if (match) {
      return { fieldName, value: match[1].trim(), rawMessage: message };
    }
  }
  // 如果沒有明確欄位標記，視為品項
  return { fieldName: 'menu', value: message.trim(), rawMessage: message };
}

/**
 * 處理 AWAITING_INFO 狀態的訊息
 * @param {string} userId
 * @param {string} message
 * @param {object} orderData
 * @param {object} context - { awaitingField }
 * @returns {{ action: string, reply: object|null, newState: string, orderData: object, context: object }}
 */
function handleAwaitingInfo(userId, message, orderData, context) {
  // 解析欄位
  const { fieldName, value: rawValue, rawMessage } = parseFieldFromMessage(message);
  const value = (rawValue || '').trim(); // 統一 trim 去除前後空白
  let updatedOrderData = { ...orderData };
  let updatedContext = { ...context };

  // 根據當前等待的欄位或自動偵測欄位
  const targetField = context.awaitingField || fieldName;

  // 依序驗證欄位
  let validationResult = { valid: true };

  switch (targetField) {
    case 'address':
      validationResult = validateAddress(value);
      if (validationResult.valid) {
        updatedOrderData.address = value;
        updatedContext.awaitingField = 'name';
      }
      break;

    case 'name':
      if (value && value.length > 0) {
        updatedOrderData.user_line_name = value;
        updatedContext.awaitingField = 'phone';
      } else {
        validationResult = { valid: false, errorMessage: '請填寫姓名。' };
        updatedContext.awaitingField = 'name';
      }
      break;

    case 'phone':
      validationResult = validatePhone(value);
      if (validationResult.valid) {
        const cleanPhone = value.replace(/[\s\-()]/g, '');
        updatedOrderData.user_phone = cleanPhone;
        // 檢查是否為老客戶
        const isReturning = isReturningCustomer(cleanPhone);
        updatedOrderData._isReturningCustomer = isReturning;
        updatedContext.awaitingField = 'menu';
      }
      break;

    case 'menu':
      validationResult = validateMenu(value);
      if (validationResult.valid) {
        const parsedItems = validationResult.parsedItems;
        updatedOrderData._parsedItems = parsedItems;
        // 分類
        const chickenItems = {};
        const sideItems = {};
        const extraItems = {};
        for (const item of parsedItems) {
          const isChicken = item.name.includes('雞') || item.name.includes('鴨') || item.name.includes('鵝');
          const isSide = item.name.includes('秘製');
          if (isChicken) {
            chickenItems[item.name] = item.quantity;
          } else if (isSide) {
            sideItems[item.name] = item.quantity;
          } else {
            extraItems[item.name] = item.quantity;
          }
        }
        updatedOrderData.chicken_items = chickenItems;
        updatedOrderData.side_items = sideItems;
        updatedOrderData.extra_items = extraItems;
        updatedOrderData._parsedItems = parsedItems;

        // 計算金額
        const priceCalc = calculatePrice(parsedItems);
        updatedOrderData.subtotal = priceCalc.subtotal;
        updatedOrderData.delivery_fee = priceCalc.deliveryFee;
        updatedOrderData.total_amount = priceCalc.totalAmount;
        updatedOrderData.chicken_count = priceCalc.chickenCount;
        updatedOrderData.side_count = priceCalc.sideCount;
        updatedOrderData.total_boxes = priceCalc.totalBoxes;

        updatedContext.awaitingField = 'date';
      }
      break;

    case 'date':
      validationResult = validateDate(value, rawMessage);
      if (validationResult.valid) {
        // 解析日期並格式化
        const dateInput = value.match(/(\d+)[月\/](\d+)/);
        if (dateInput) {
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${dateInput[1].padStart(2, '0')}-${dateInput[2].padStart(2, '0')}`;
          updatedOrderData.delivery_date = dateStr;
        }
        updatedContext.awaitingField = 'timeSlot';
      }
      break;

    case 'timeSlot':
      const slotResult = validateTimeSlot(value);
      if (slotResult.warning) {
        // 有指定時間，不阻擋但提醒
        updatedOrderData._timeSlotWarning = slotResult.errorMessage;
      }
      if (slotResult.valid || slotResult.warning) {
        const { getTimeSlot } = require('../utils/timeUtils');
        updatedOrderData.time_slot = getTimeSlot(value) || (value.includes('下午') ? 'afternoon' : 'morning');
        updatedContext.awaitingField = 'paymentMethod';
      }
      validationResult = { valid: slotResult.valid, errorMessage: slotResult.errorMessage };
      break;

    case 'paymentMethod':
      const totalAmount = updatedOrderData.total_amount || 0;
      const isReturning = updatedOrderData._isReturningCustomer || false;
      const { validatePayment } = require('../rules');
      validationResult = validatePayment(value, totalAmount, isReturning);
      if (validationResult.valid) {
        const methodMap = { '現金': 'cash', '轉帳': 'transfer', '街口': 'jko', 'LINE Pay': 'linepay' };
        updatedOrderData.payment_method = methodMap[value] || value;
        updatedContext.awaitingField = null;
      }
      break;

    default:
      // 嘗試解析任意欄位
      const generic = parseFieldFromMessage(message);
      return handleAwaitingInfo(userId, message, orderData, { ...context, awaitingField: generic.fieldName });
  }

  if (!validationResult.valid) {
    // P0-1: 配送範圍類錯誤（超出/不確定）應走 handoff 路徑，
    // 而不是停在 REASK_INFO。index.js 會呼叫 handleHandoff 觸發轉真人。
    if (validationResult.action === 'handoff_needed') {
      updatedContext.awaitingField = targetField;
      return {
        action: 'handoff_needed',
        reason: validationResult.reason || 'unknown',
        reply: textReply(validationResult.errorMessage),
        newState: STATES.AWAITING_INFO, // index.js 會接手走 handleHandoff
        orderData: updatedOrderData,
        context: updatedContext,
      };
    }
    updatedContext.awaitingField = targetField;
    updatedContext.lastError = validationResult.errorMessage;
    return {
      action: 'validation_failed',
      reply: textReply(validationResult.errorMessage),
      newState: STATES.REASK_INFO,
      orderData: updatedOrderData,
      context: updatedContext,
    };
  }

  // 檢查是否所有必填欄位都已填寫
  const allFieldsReceived = !updatedContext.awaitingField;

  if (allFieldsReceived) {
    return {
      action: 'all_fields_received',
      reply: null, // 讓 confirming 處理顯示
      newState: STATES.CONFIRMING,
      orderData: updatedOrderData,
      context: updatedContext,
    };
  }

  // 回覆下一步提示
  return {
    action: 'field_received',
    reply: buildFieldPrompt(updatedContext.awaitingField),
    newState: STATES.AWAITING_INFO,
    orderData: updatedOrderData,
    context: updatedContext,
  };
}

/**
 * 構建欄位填寫提示
 * @param {string} fieldName
 * @returns {object}
 */
function buildFieldPrompt(fieldName) {
  const prompts = {
    name: '請填寫姓名：',
    phone: '請填寫電話（09開頭10位數）：',
    menu: '請填寫品項與數量（例如：鹽水雞2、甘蔗煙燻雞1、秘製黑胡椒毛豆2）：',
    date: '請填寫配送日期（例如：6/15）：',
    timeSlot: '請選擇時段：上午（10-12點）或 下午（16-18點）',
    paymentMethod: '請選擇付款方式：現金 / 轉帳 / 街口 / LINE Pay',
  };

  return textReply(prompts[fieldName] || '請繼續填寫訂購資訊：');
}

module.exports = {
  handleAwaitingInfo,
  parseFieldFromMessage,
  buildFieldPrompt,
  FIELD_ORDER,
};