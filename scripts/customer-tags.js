#!/usr/bin/env node
/**
 * scripts/customer-tags.js
 * Round 19 (2026-07-24 10:50+) Task C2 — 客戶標籤自動判斷
 *
 * 設計：
 *   - Rule-based，從 order history + 當下訂單判斷
 *   - 規則參考 knowledge/tenants/chicken/10_customer_tags.md
 *   - 標籤分類：身份 / 訂單狀態 / 注意 / 偏好 / 成交機會
 *
 * 使用：
 *   node scripts/customer-tags.js <user_line_id>          # 從現有 CSV 判斷標籤
 *   node scripts/customer-tags.js <user_line_id> --json  # JSON 格式輸出
 *
 * 未來整合：
 *   - 加到 api-server /api/customer-tags/:userId endpoint
 *   - 加到 src/handoff/notifier.js 自動標籤通知 Hubert
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 標籤規則定義（從 knowledge/tenants/chicken/10_customer_tags.md 整合）
// ============================================================

const TAG_RULES = {
  // 身份標籤
  identity: {
    首購族: (ctx) => ctx.successfulOrderCount === 0,
    老客戶: (ctx) => ctx.successfulOrderCount >= 2,
    朋友介紹: (_ctx) => false, // 需要外部來源資料，預留（_ctx unused：placeholder）
    大客戶: (ctx) => ctx.currentOrderTotal >= 2000,
    團購客: (ctx) => ctx.isGroupOrder === true,
    公司訂單: (ctx) => ctx.companyName && ctx.companyName.length > 0,
  },

  // 訂單狀態標籤
  orderStatus: {
    已付款: (ctx) => ctx.currentPaymentStatus === 'paid',
    待轉帳: (ctx) => ctx.currentPaymentStatus === 'pending',
    現金付款: (ctx) => ctx.currentPaymentMethod === 'cash',
    需催收: (ctx) => ctx.daysSinceOrder >= 1 && ctx.currentPaymentStatus === 'pending',
  },

  // 注意事項標籤
  notes: {
    地址需確認: (ctx) => !ctx.addressComplete,
    配送範圍需確認: (ctx) => ctx.addressOutOfRange === true,
    需真人處理: (ctx) => ctx.handoffTriggered === true,
    客訴: (ctx) => ctx.hasComplaint === true,
    態度激動: (ctx) => ctx.agitated === true,
  },

  // 客戶偏好標籤（從歷史訂單統計）
  preferences: {
    喜歡鹽水: (ctx) => ctx.saltedChickenCount >= 3,
    喜歡煙燻: (ctx) => ctx.smokedChickenCount >= 3,
    常買小菜: (ctx) => ctx.sideDishOrderRate >= 0.5,
    偏好下午配送: (ctx) => ctx.afternoonDeliveryRate >= 0.6,
    送禮: (ctx) => ctx.giftOrderCount >= 1,
    放管理室: (ctx) => ctx.managementRoomCount >= 1,
  },

  // 成交機會標籤（從對話歷史）
  opportunity: {
    高機率成交: (ctx) => ctx.intentScore >= 0.7,
    詢問中: (ctx) => ctx.intentScore >= 0.4 && ctx.intentScore < 0.7,
    猶豫中: (ctx) => ctx.intentScore < 0.4 && ctx.interactionCount >= 2,
  },
};

// ============================================================
// 從 order history 計算 tag context
// ============================================================

function buildTagContext(userLineId, orderHistory, currentOrder = null) {
  const successfulOrders = orderHistory.filter((o) => o.order_status === 'completed' || o.payment_status === 'paid');
  const allOrders = orderHistory;

  // 統計偏好
  const saltedChickenOrders = allOrders.filter((o) => (o.chicken_items || '').includes('鹽水'));
  const smokedChickenOrders = allOrders.filter((o) => (o.chicken_items || '').includes('煙燻'));
  const sideDishOrders = allOrders.filter((o) => parseInt(o.side_count || '0') > 0);
  const afternoonDeliveries = allOrders.filter((o) => o.time_slot === 'afternoon');

  const ctx = {
    userLineId,
    successfulOrderCount: successfulOrders.length,
    totalOrderCount: allOrders.length,
    currentOrderTotal: currentOrder ? parseInt(currentOrder.total_amount || '0') : 0,
    currentPaymentStatus: currentOrder?.payment_status || null,
    currentPaymentMethod: currentOrder?.payment_method || null,
    isGroupOrder: false, // 需要 groupOrder 欄位或外部資料
    companyName: null, // 需要從 community 欄位解析
    addressComplete: currentOrder ? (currentOrder.address && currentOrder.address.length > 10) : true,
    addressOutOfRange: false, // 需要 geocoding
    handoffTriggered: false,
    hasComplaint: false,
    agitated: false,
    saltedChickenCount: saltedChickenOrders.length,
    smokedChickenCount: smokedChickenOrders.length,
    sideDishOrderRate: allOrders.length > 0 ? sideDishOrders.length / allOrders.length : 0,
    afternoonDeliveryRate: allOrders.length > 0 ? afternoonDeliveries.length / allOrders.length : 0,
    giftOrderCount: 0, // 需要 customer_notes 解析
    managementRoomCount: 0, // 需要 customer_notes 解析
    intentScore: 0, // 需要對話歷史
    interactionCount: allOrders.length,
    daysSinceOrder: currentOrder ? Math.floor((Date.now() - new Date(currentOrder.created_at).getTime()) / 86400000) : 0,
  };

  return ctx;
}

// ============================================================
// 根據 context 計算 tags
// ============================================================

function determineTags(ctx) {
  const tags = [];
  for (const [category, rules] of Object.entries(TAG_RULES)) {
    for (const [tagName, rule] of Object.entries(rules)) {
      try {
        if (rule(ctx)) tags.push({ tag: tagName, category });
      } catch (e) {
        // rule failed, skip
      }
    }
  }
  return tags;
}

// ============================================================
// 從 data/orders/chicken/*.csv 讀取 order history
// ============================================================

function loadOrderHistory(userLineId) {
  const orderDir = path.join(__dirname, '..', 'data', 'orders', 'chicken');
  if (!fs.existsSync(orderDir)) return [];

  const orders = [];
  const files = fs.readdirSync(orderDir).filter((f) => f.endsWith('.csv')).sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(orderDir, file), 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) continue;

    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);
      // 只取該用戶的訂單（用 user_line_name 或 phone 判斷，簡化用 phone）
      if (row.user_phone === userLineId || row.user_line_name === userLineId) {
        orders.push(row);
      }
    }
  }
  return orders;
}

// ============================================================
// CLI 入口
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/customer-tags.js <user_line_id> [--json]');
    process.exit(1);
  }

  const userLineId = args[0];
  const jsonOutput = args.includes('--json');

  const orderHistory = loadOrderHistory(userLineId);
  const currentOrder = orderHistory[orderHistory.length - 1] || null; // 最新訂單
  const ctx = buildTagContext(userLineId, orderHistory, currentOrder);
  const tags = determineTags(ctx);

  const result = {
    userLineId,
    orderCount: orderHistory.length,
    currentOrder: currentOrder ? {
      order_id: currentOrder.order_id,
      total_amount: currentOrder.total_amount,
      payment_status: currentOrder.payment_status,
    } : null,
    tags,
    tagCount: tags.length,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('=== 客戶標籤 ===');
    console.log(`用戶: ${result.userLineId}`);
    console.log(`歷史訂單數: ${result.orderCount}`);
    if (result.currentOrder) {
      console.log(`當下訂單: ${result.currentOrder.order_id} ($${result.currentOrder.total_amount}, ${result.currentOrder.payment_status})`);
    }
    console.log(`\n標籤 (${result.tagCount} 個):`);
    if (tags.length === 0) {
      console.log('  (無)');
    } else {
      // 按分類分組
      const byCategory = {};
      tags.forEach((t) => {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t.tag);
      });
      for (const [cat, tagList] of Object.entries(byCategory)) {
        console.log(`  [${cat}] ${tagList.join(', ')}`);
      }
    }
  }
}

module.exports = { buildTagContext, determineTags, loadOrderHistory, TAG_RULES };
