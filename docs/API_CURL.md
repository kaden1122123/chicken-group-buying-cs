# 雞味研究所 API — Curl 範例

> Session L3：api-server.js 對外 HTTP API 的 curl 範例
> 完整 OpenAPI spec 見 `openapi.yaml`
> Swagger UI 互動式文件：`GET /api/docs`（需 auth）
> last_updated：2026-07-27（Round 27 確認仍適用，無改動）

---

## 環境變數

```bash
export API_HOST="http://localhost:3001"
export API_USER="api-user"
export API_PASS="chicke…9k2x"  # 你的 API_PASSWORD 環境變數值
```

> Windows PowerShell 用 `$env:API_HOST = "http://localhost:3001"` 等。

## Auth（HTTP Basic）

所有請求（除了 `GET /api/health`）都需要 `Authorization: Basic <base64>`。
curl 用 `-u "user:pass"` 自動加。

---

## GET /api/health（公開）

健康檢查 — 不需 auth、用於 load balancer probe。

```bash
curl -s "$API_HOST/api/health"
```

**Response 200:**
```json
{
  "success": true,
  "status": "ok",
  "tenant": "chicken",
  "time": "2026-06-29T11:30:00.000Z"
}
```

---

## POST /api/orders（建立訂單）

從 Cloudflare Worker 收到 LINE 訂單後呼叫。

```bash
curl -s -X POST "$API_HOST/api/orders" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "order_data": {
      "user_line_name": "王小明",
      "user_phone": "0912345678",
      "address": "新北市三峽區學成路100號",
      "community": "三峽北大特區",
      "delivery_date": "2026-06-30",
      "time_slot": "上午",
      "items": [
        { "name": "鹽水雞", "qty": 1, "total": 380 },
        { "name": "甘蔗煙燻雞", "qty": 1, "total": 420 }
      ],
      "subtotal": 800,
      "delivery_fee": 0,
      "total_amount": 800,
      "payment_method": "轉帳",
      "payment_status": "pending",
      "order_status": "confirmed"
    },
    "source": "worker"
  }'
```

**Response 201:**
```json
{
  "success": true,
  "order_id": "PENDING-1719700000000",
  "message": "訂單已建立",
  "order": { /* 完整訂單物件 */ }
}
```

**Response 400（缺欄位 / 型別錯 / 超長）：**
```json
{ "success": false, "error": "缺少必填欄位: user_phone, address" }
```

**Response 429（rate limit）：** 帶 `Retry-After` header。

---

## GET /api/orders（查詢列表）

```bash
# 全部訂單
curl -s "$API_HOST/api/orders" -u "$API_USER:$API_PASS"

# 篩選特定日期
curl -s "$API_HOST/api/orders?date=2026-06-30" -u "$API_USER:$API_PASS"
```

**Response 200:**
```json
{
  "success": true,
  "count": 5,
  "orders": [
    { "order_id": "...", "user_phone": "...", "delivery_date": "..." }
  ]
}
```

---

## GET /api/orders/{id}（查單筆）

```bash
curl -s "$API_HOST/api/orders/PENDING-1719700000000" \
  -u "$API_USER:$API_PASS"
```

**Response 200:**
```json
{
  "success": true,
  "order": {
    "order_id": "PENDING-1719700000000",
    "user_line_name": "王小明",
    "delivery_date": "2026-06-30",
    "items": "{\"鹽水雞\":1,\"甘蔗煙燻雞\":1}",
    "total_amount": 800,
    "payment_status": "pending"
  }
}
```

**Response 404：** 找不到此 ID。

---

## PATCH /api/orders/{id}（更新）

更新付款狀態 / 配送日期等。**`delivery_date` 必填**（用於定位 CSV 檔案）。

```bash
curl -s -X PATCH "$API_HOST/api/orders/PENDING-1719700000000" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_date": "2026-06-30",
    "payment_status": "paid",
    "payment_method": "轉帳"
  }'
```

**Response 200:**
```json
{ "success": true, "message": "訂單已更新" }
```

**Response 404：** 找不到此 ID（ID 或 delivery_date 對應的 CSV 錯）。

---

## 完整 e2e 範例（推薦用 jq 看 response）

```bash
# 1. 建立訂單
RESPONSE=$(curl -s -X POST "$API_HOST/api/orders" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "order_data": {
      "user_line_name": "測試用戶",
      "user_phone": "0912345678",
      "address": "新北市三峽區",
      "delivery_date": "2026-06-30",
      "time_slot": "上午",
      "items": [{ "name": "鹽水雞", "qty": 1, "total": 380 }],
      "subtotal": 380,
      "total_amount": 380,
      "payment_method": "待定",
      "payment_status": "pending",
      "order_status": "confirmed"
    }
  }')

ORDER_ID=$(echo "$RESPONSE" | jq -r '.order_id')
echo "建立訂單：$ORDER_ID"

# 2. 查詢單筆
curl -s "$API_HOST/api/orders/$ORDER_ID" -u "$API_USER:$API_PASS" | jq .

# 3. 更新付款
curl -s -X PATCH "$API_HOST/api/orders/$ORDER_ID" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_date": "2026-06-30",
    "payment_status": "paid"
  }' | jq .

# 4. 驗證更新
curl -s "$API_HOST/api/orders/$ORDER_ID" -u "$API_USER:$API_PASS" \
  | jq '.order | {order_id, payment_status, payment_method}'
```

---

## 常見錯誤

| Status | 原因 | 解法 |
|--------|------|------|
| 401 | 缺 / 錯 Basic Auth | 檢查 `-u "$API_USER:$API_PASS"` |
| 400 | 缺欄位 / 型別錯 / 超長 | 看 `error` 訊息，檢查 openapi.yaml 限制 |
| 403 | CORS 白名單沒命中 | Worker 域名加到 `API_CORS_ORIGINS` env |
| 404 | 訂單 ID 不存在或 `delivery_date` 對不上 | 確認 POST 回傳的 order_id + 對應日期 |
| 429 | 超過 rate limit（預設 60 req/min/IP） | 看到 `Retry-After` header，等幾秒再 retry |
| 503 | Server graceful shutdown 中 | 等待 systemd 重啟完成 |

---

## 在 production 環境跑

production 通常綁在 Cloudflare Tunnel 或 reverse proxy：

```bash
# 透過 Cloudflare Tunnel
export API_HOST="https://api.chicken-your-domain.com"

# 或直接 localhost（透過 tunnel 訪問）
export API_HOST="http://127.0.0.1:3001"
```

CORS：production Worker 域名要列在 `API_CORS_ORIGINS` env（Session I2）。

Rate limit：production 可調 `API_RATE_LIMIT` env（預設 60 req/min/IP，Session I3）。
