'use strict';
const logger = require('../src/utils/logger');

/**
 * 雞肉團購客服 — 儀表板 MVP
 * 從 CSV 讀取訂單，生成靜態 HTML 儀表板（用 Chart.js CDN）
 *
 * 使用方式：
 *   node scripts/dashboard.js
 *
 * 輸出：
 *   dashboard.html（同目錄）
 *
 * 內容：
 *   - 訂單總覽（總訂單數、總營收、平均客單價）
 *   - 本週/本月訂單趨勢
 *   - 品項分佈（雞肉/小菜/加購）
 *   - 客戶分析（新客 vs 老客）
 *   - 訂單狀態分佈
 */

const fs = require('fs');
const path = require('path');
const { getTenantId } = require('../src/config');
const { getOrdersByDate } = require('../src/order/csvReader');

const TENANT = getTenantId();
const ORDERS_DIR = path.join(__dirname, '..', 'data', 'orders', TENANT);
const OUTPUT_PATH = path.join(__dirname, '..', 'dashboard.html');

logger.info(`[Dashboard] Tenant: ${TENANT}`);
logger.info(`[Dashboard] Orders dir: ${ORDERS_DIR}`);
logger.info(`[Dashboard] Output: ${OUTPUT_PATH}`);

if (!fs.existsSync(ORDERS_DIR)) {
  logger.error(`[Dashboard] Orders dir not found: ${ORDERS_DIR}`);
  process.exit(1);
}

// 讀取所有訂單
const allOrders = [];
const dateFiles = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.csv'));
for (const file of dateFiles) {
  const dateStr = file.replace('.csv', '');
  const orders = getOrdersByDate(dateStr);
  for (const order of orders) {
    allOrders.push(order);
  }
}

logger.info(`[Dashboard] Loaded ${allOrders.length} orders from ${dateFiles.length} files`);

// 計算指標
const totalOrders = allOrders.length;
const totalRevenue = allOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
const uniquePhones = new Set(allOrders.map((o) => o.user_phone).filter(Boolean)).size;

// 訂單按日分組
const ordersByDate = {};
for (const order of allOrders) {
  const date = order.delivery_date || order.created_at?.split('T')[0] || 'unknown';
  if (!ordersByDate[date]) ordersByDate[date] = 0;
  ordersByDate[date]++;
}

// 訂單按狀態分組
const ordersByStatus = {};
for (const order of allOrders) {
  const status = order.order_status || 'unknown';
  if (!ordersByStatus[status]) ordersByStatus[status] = 0;
  ordersByStatus[status]++;
}

// 品項分佈
const itemsCount = {};
for (const order of allOrders) {
  try {
    const chicken = typeof order.chicken_items === 'string'
      ? JSON.parse(order.chicken_items) : (order.chicken_items || {});
    const side = typeof order.side_items === 'string'
      ? JSON.parse(order.side_items) : (order.side_items || {});
    const extra = typeof order.extra_items === 'string'
      ? JSON.parse(order.extra_items) : (order.extra_items || {});
    for (const [name, qty] of Object.entries(chicken)) {
      itemsCount[name] = (itemsCount[name] || 0) + qty;
    }
    for (const [name, qty] of Object.entries(side)) {
      itemsCount[name] = (itemsCount[name] || 0) + qty;
    }
    for (const [name, qty] of Object.entries(extra)) {
      itemsCount[name] = (itemsCount[name] || 0) + qty;
    }
  } catch (e) {
    // ignore parse errors
  }
}

// 客戶分析
const customerOrderCount = {};
for (const order of allOrders) {
  const phone = order.user_phone;
  if (phone) {
    customerOrderCount[phone] = (customerOrderCount[phone] || 0) + 1;
  }
}
const newCustomers = Object.values(customerOrderCount).filter((c) => c === 1).length;
const returningCustomers = Object.values(customerOrderCount).filter((c) => c > 1).length;

// 生成 HTML
const html = generateHTML({
  tenant: TENANT,
  totalOrders,
  totalRevenue,
  avgOrder,
  uniquePhones,
  newCustomers,
  returningCustomers,
  ordersByDate,
  ordersByStatus,
  itemsCount,
  recentOrders: allOrders.slice(-20).reverse(),
});

fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
logger.info(`[Dashboard] ✅ Generated: ${OUTPUT_PATH}`);
logger.info(`[Dashboard]   總訂單: ${totalOrders}`);
logger.info(`[Dashboard]   總營收: NT$${totalRevenue.toFixed(0)}`);
logger.info(`[Dashboard]   平均客單價: NT$${avgOrder.toFixed(0)}`);
logger.info(`[Dashboard]   唯一客戶數: ${uniquePhones}`);

function generateHTML(data) {
  const dateLabels = JSON.stringify(Object.keys(data.ordersByDate).sort());
  const dateValues = JSON.stringify(Object.values(data.ordersByDate).sort((a, b) => a - b));
  const statusLabels = JSON.stringify(Object.keys(data.ordersByStatus));
  const statusValues = JSON.stringify(Object.values(data.ordersByStatus));
  const topItems = Object.entries(data.itemsCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const itemLabels = JSON.stringify(topItems.map(([n]) => n));
  const itemValues = JSON.stringify(topItems.map(([, q]) => q));

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>${data.tenant} 儀表板</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: -apple-system, "Microsoft JhengHei", sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 20px 0; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { margin: 0 0 8px 0; color: #666; font-size: 14px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; }
    .card .unit { font-size: 14px; color: #999; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin: 20px 0; }
    .chart-box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; background: white; margin-top: 16px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9f9f9; font-weight: 600; }
    .meta { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🐔 ${data.tenant} 儀表板</h1>
  <p class="meta">最後更新：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>

  <div class="cards">
    <div class="card">
      <h3>總訂單數</h3>
      <div class="value">${data.totalOrders}</div>
    </div>
    <div class="card">
      <h3>總營收</h3>
      <div class="value">NT$${data.totalRevenue.toFixed(0)}</div>
    </div>
    <div class="card">
      <h3>平均客單價</h3>
      <div class="value">NT$${data.avgOrder.toFixed(0)}</div>
    </div>
    <div class="card">
      <h3>唯一客戶數</h3>
      <div class="value">${data.uniquePhones}</div>
    </div>
    <div class="card">
      <h3>新客</h3>
      <div class="value">${data.newCustomers}</div>
      <div class="unit">（訂單數 = 1）</div>
    </div>
    <div class="card">
      <h3>老客</h3>
      <div class="value">${data.returningCustomers}</div>
      <div class="unit">（訂單數 > 1）</div>
    </div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <h3>每日訂單數趨勢</h3>
      <canvas id="dateChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>訂單狀態分佈</h3>
      <canvas id="statusChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>熱門品項（Top 10）</h3>
      <canvas id="itemChart"></canvas>
    </div>
  </div>

  <h2>最近 20 筆訂單</h2>
  <table>
    <thead>
      <tr>
        <th>訂單 ID</th>
        <th>配送日</th>
        <th>客戶</th>
        <th>品項</th>
        <th>金額</th>
        <th>狀態</th>
        <th>付款</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${data.recentOrders.map((o) => {
    const isPaid = o.payment_status === 'confirmed';
    const needApprove = o.order_status === 'pending_handoff';
    return `
        <tr>
          <td>${o.order_id || '-'}</td>
          <td>${o.delivery_date || '-'}</td>
          <td>${o.user_line_name || o.user_phone || '-'}</td>
          <td>${(typeof o.chicken_items === 'string' ? o.chicken_items : JSON.stringify(o.chicken_items || {})).substring(0, 50)}</td>
          <td>NT$${o.total_amount || 0}</td>
          <td>${o.order_status || '-'}</td>
          <td>${isPaid ? '<span style="color:#2e7d32;font-weight:600">✓ 已收款</span>' : '<span style="color:#e65100">⏳ 待收款</span>'}</td>
          <td>${needApprove ? `<button class="approve-btn" data-order-id="${o.order_id}" style="background:#2196f3;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px">✓ 核准</button>` : ''}${isPaid ? '<span style="color:#999;font-size:12px">已確認收款</span>' : `<button class="mark-paid-btn" data-order-id="${o.order_id}" style="background:#ff9800;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">✓ 已收款</button>`}</td>
        </tr>
      `;
  }).join('')}
    </tbody>
  </table>

  <script>
    new Chart(document.getElementById('dateChart'), {
      type: 'line',
      data: {
        labels: ${dateLabels},
        datasets: [{
          label: '訂單數',
          data: ${dateValues},
          borderColor: '#4caf50',
          tension: 0.1,
        }],
      },
    });

    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: ${statusLabels},
        datasets: [{
          data: ${statusValues},
          backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0'],
        }],
      },
    });

    new Chart(document.getElementById('itemChart'), {
      type: 'bar',
      data: {
        labels: ${itemLabels},
        datasets: [{
          label: '數量',
          data: ${itemValues},
          backgroundColor: '#2196f3',
        }],
      },
      options: { indexAxis: 'y' },
    });
  </script>

  <!-- P2：Hubert 手動核准訂單 — 點擊「✓ 核准」按鈕呼叫 POST /api/orders/:id/approve -->
  <!-- P5：Hubert 手動標記付款狀態 — 點擊「✓ 已收款」按鈕呼叫 POST /api/orders/:id/mark-paid -->
  <script>
    document.addEventListener('click', async (e) => {
      if (!e.target.classList) return;
      const orderId = e.target.dataset.orderId;
      if (!orderId) return;

      // P2 核准按鈕
      if (e.target.classList.contains('approve-btn')) {
        if (!confirm('確認核准訂單 ' + orderId + '？')) return;
        e.target.disabled = true;
        e.target.textContent = '處理中...';
        try {
          const r = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/approve', { method: 'POST' });
          const data = await r.json();
          if (data.success) {
            e.target.textContent = '✓ 已核准';
            e.target.style.background = '#4caf50';
            e.target.classList.remove('approve-btn');
            const row = e.target.closest('tr');
            if (row) {
              const cells = row.querySelectorAll('td');
              if (cells[5]) cells[5].innerHTML = '<span style="color:#2e7d32;font-weight:600">confirmed</span>';
            }
          } else {
            e.target.disabled = false;
            e.target.textContent = '✓ 核准';
            alert('核准失敗：' + (data.error || '未知錯誤'));
          }
        } catch (err) {
          e.target.disabled = false;
          e.target.textContent = '✓ 核准';
          alert('網路錯誤：' + err.message);
        }
        return;
      }

      // P5 標記已收款按鈕
      if (e.target.classList.contains('mark-paid-btn')) {
        if (!confirm('確認標記訂單 ' + orderId + ' 為已收款？')) return;
        e.target.disabled = true;
        e.target.textContent = '處理中...';
        try {
          const r = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/mark-paid', { method: 'POST' });
          const data = await r.json();
          if (data.success) {
            e.target.textContent = '✓ 已收款';
            e.target.style.background = '#4caf50';
            e.target.classList.remove('mark-paid-btn');
            const row = e.target.closest('tr');
            if (row) {
              const cells = row.querySelectorAll('td');
              if (cells[6]) cells[6].innerHTML = '<span style="color:#2e7d32;font-weight:600">✓ 已收款</span>';
              if (cells[7]) cells[7].innerHTML = '<span style="color:#999;font-size:12px">已確認收款</span>';
            }
          } else {
            e.target.disabled = false;
            e.target.textContent = '✓ 已收款';
            alert('標記失敗：' + (data.error || '未知錯誤'));
          }
        } catch (err) {
          e.target.disabled = false;
          e.target.textContent = '✓ 已收款';
          alert('網路錯誤：' + err.message);
        }
      }
    });
  </script>
</body>
</html>`;
}
