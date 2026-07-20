# 雞味客服 — 完整測試指南 (Testing Guide)

> **目的**：Hubert 或 brtclaw session 可以照本指南「全範圍包攬」所有功能路徑,從環境驗證到各 State machine path、各 Payment 方式、老闆 handoff、Sheets/Gmail/Worker 整合。
> **範圍**：雞味客服 (chicken-group-buying-customer-service) LINE Bot 系統。
> **最後更新**：2026-07-20
> **作者**：brtclaw（OpenClaw runtime session）
> **配套文件**：
> - `PROJECT_INVENTORY.md`（系統地圖,本指南引用的檔案位置）
> - `docs/API_CURL.md`（API curl 範例）
> - `docs/ENGINEERING_HANDBOOK.md`（工程慣例）
> - `HANDOFF.md` §1（當前 production 狀態）

---

## Phase 0 · 環境驗證（5 分鐘 · 必要前置）

### 0.1 確認 services 全 up

```bash
curl -sS -m 5 http://localhost:3000/healthz
# 預期：{"status":"ok","services":{"dashboard":"up","api_server":"up","worker":"up"}}

curl -sS -m 5 http://localhost:3001/api/health
# 預期：{"success":true,"status":"ok","tenant":"chicken",...}
```

公開 URL（dashboard）:
- https://dashboard.brt1122.com（透過 Named Tunnel `brt1122-System-09`）
- http://localhost:3000（直接本機）

### 0.2 secrets 存在性

```bash
ls /home/clawuser/.config/chicken/secrets/
# 預期看到:api-pwd api-token dashboard-pwd gmail-credentials.json google-service-account.json line-bot-token
```

### 0.3 cron jobs 正常

```bash
openclaw cron list | grep -E "雞味客服|backup|dashboard"
# 預期看到至少 5 個雞味客服相關 cron（dashboard-watchdog 已被禁用改 systemd 接管）
```

### 0.4 真實訂單保護（不要刪 6/13 + 6/16）

```bash
ls data/orders/chicken/2026-06-13.csv data/orders/chicken/2026-06-16.csv
# 兩個檔必須存在且 git tracked
git log --follow -- data/orders/chicken/2026-06-13.csv | head -5
```

---

## Phase 1 · API 端點直接測試（10 分鐘）

> 來源：`docs/API_CURL.md`（curl 範例） + `openapi.yaml`（正式 spec）

### 1.1 GET /api/health（公開 · 不需 auth）

```bash
curl -s http://localhost:3001/api/health
```

**預期**：
```json
{"success":true,"status":"ok","tenant":"chicken","time":"..."}
```

### 1.2 GET /api/orders（用 Auth）

```bash
export API_USER="api-user"
export API_PASS=$(cat /home/clawuser/.config/chicken/secrets/api-pwd)

curl -s "http://localhost:3001/api/orders?date=2026-06-16" \
  -u "$API_USER:$API_PASS" | python3 -m json.tool | head -30
```

**預期**：
```json
{
  "success": true,
  "count": N,
  "orders": [/* 真實 6/16 訂單 */]
}
```

**驗證點**：`count >= 1`（6/16 真實訂單），訂單物件有 `order_id`、`user_phone`、`delivery_date`。

### 1.3 GET /api/orders/{id}（單筆）

```bash
# 取第一筆 order_id
ORDER_ID=$(curl -s "http://localhost:3001/api/orders?date=2026-06-16" \
  -u "$API_USER:$API_PASS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["orders"][0]["order_id"])')

curl -s "http://localhost:3001/api/orders/$ORDER_ID" \
  -u "$API_USER:$API_PASS" | python3 -m json.tool
```

**預期**：
```json
{
  "success": true,
  "order": {
    "order_id": "...",
    "delivery_date": "2026-06-16",
    "payment_status": "...",
    "items": "..."
  }
}
```

### 1.4 POST /api/orders（建立測試訂單 · P7 完整性檢查）

**警告**：建立測試訂單會污染真實 data dir,用 cleanup-test-orders.js 清。

```bash
RESPONSE=$(curl -s -X POST "http://localhost:3001/api/orders" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "order_data": {
      "user_line_name": "測試用戶",
      "user_phone": "0912345678",
      "address": "新北市三峽區學成路100號",
      "community": "三峽北大特區",
      "delivery_date": "'$(date -d '+7 days' +%Y-%m-%d)'",
      "time_slot": "上午",
      "chicken_items": {"鹽水雞": 1},
      "side_items": {},
      "extra_items": {},
      "chicken_count": 1,
      "side_count": 0,
      "total_boxes": 1,
      "subtotal": 380,
      "delivery_fee": 100,
      "total_amount": 480,
      "payment_method": "cash",
      "payment_status": "pending",
      "order_status": "new",
      "source": "test",
      "intent_confirmed": true
    },
    "source": "test"
  }')

echo "$RESPONSE" | python3 -m json.tool
echo "$RESPONSE" | python3 -c 'import json,sys;print("order_id =", json.loads(sys.stdin.read()).get("order_id"))'
```

**預期**：
```json
{
  "success": true,
  "order_id": "TEST-...",
  "message": "訂單已建立"
}
```

**驗證點**：`success=true`、`order_id` 有值。

### 1.5 PATCH /api/orders/{id}（更新付款狀態）

```bash
ORDER_ID=$(echo "$RESPONSE" | python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["order_id"])')

curl -s -X PATCH "http://localhost:3001/api/orders/$ORDER_ID" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_date": "'$(date -d '+7 days' +%Y-%m-%d)'",
    "payment_status": "paid",
    "payment_method": "cash"
  }' | python3 -m json.tool
```

**預期**：
```json
{"success":true,"message":"訂單已更新"}
```

**驗證點**：再用 GET 1.3 查,確認 `payment_status` 變 `paid`。

### 1.6 API 錯誤 path 測試

```bash
# 401 未授權
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3001/api/orders"
# 預期：HTTP 401

# 404 找不到訂單
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -u "$API_USER:$API_PASS" \
  "http://localhost:3001/api/orders/DOES-NOT-EXIST"
# 預期：HTTP 404

# 400 缺必填
curl -s -X POST "http://localhost:3001/api/orders" \
  -u "$API_USER:$API_PASS" \
  -H "Content-Type: application/json" \
  -d '{"order_data":{}}'
# 預期：HTTP 400 + error 訊息
```

**驗證點**：所有 401 / 404 / 400 路徑都正確觸發。

### 1.7 Rate limit 測試（選用）

```bash
# 連發 100 次 GET 應該被擋下
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3001/api/orders?date=2026-06-16" \
    -u "$API_USER:$API_PASS"
done | sort | uniq -c
# 預期：~60 個 200 + ~40 個 429（IP 限速）
```

---

## Phase 2 · Dashboard UI 流程（15 分鐘）

### 2.1 登入

URL: https://dashboard.brt1122.com/

```
Username: admin
Password: $(cat /home/clawuser/.config/chicken/secrets/dashboard-pwd)
```

**驗證點**：登入後看到訂單列表首頁。

### 2.2 看訂單列表

- 預設顯示當天訂單
- 可切日期（dropdown）
- 可篩選狀態（新 / 已收款 / 待付款 ...）

**驗證點**：
- 看到 6/13 + 6/16 真實訂單（≥ 1 筆）
- 訂單狀態欄顯示 `pending` 或 `paid`

### 2.3 看訂單詳情

- 點任一訂單 → 訂單明細 + customer reply 欄 + 編輯按鈕

**驗證點**：明細欄位齊全（user_line_name / phone / address / items / total_amount / payment_status）

### 2.4 編輯 customer reply（給客戶的回覆）

- 編輯 textarea → 儲存
- 應該 trigger LINE push 給該客戶

**驗證點**：
- 在 dashboard 改的 reply 真的送出 LINE 訊息給客戶（需登入的 LINE 帳號觀察）
- 訂單的 `staff_notes` 或 `customer_reply` 欄被更新

### 2.5 標記已收款（✓ 已收款按鈕 · P5）

- 在訂單詳情頁 → 點 `✓ 已收款`
- 訂單 `payment_status` 從 `pending` → `paid`

**驗證點**：
- 前端 UI 立即更新
- 後端 CSV 寫入（`grep '<ORDER_ID>' data/orders/...` 應該看到 payment_status 變 paid）
- 客戶 LINE 收到「已收款確認」訊息（B 方案）

### 2.6 跳轉 LINE chat

- 從訂單詳情 → 點 LINE 圖示 / 用戶 ID → 開 LINE chat 直接聯絡客戶
- 如果 dashboard 整合 deep link 應該跳到 LINE 對應 chat

**驗證點**：能正常跳轉。

---

## Phase 3 · LINE Bot 訊息路徑（透過真實手動 LINE · 20 分鐘）

> 來源：main_idea.md 18 章節 + HANDOFF §1
> **必要**：白名單帳號 `Uf56650056d35626deb64165926a26182`（Hubert）+ 第二個白名單帳號（如有）
> 若無第二個白名單帳號,跳過白名單排除測試

### 3.0 測試環境前置

- 確認 LINE Bot 已上線（從 Cloudflare Worker webhook `external-user-line-security.kaden1122123.workers.dev/webhook` 接收）
- 拿 1-2 個白名單內的帳號掃 QR code加入 Bot
- 每個 scenario 從「客戶視角」輸入訊息,從 dashboard / 日誌觀察後端

### 3.1 白名單測試

#### 3.1.1 白名單內帳號
- 用白名單帳號發任意訊息 → 應該被 Bot 接收 + 回覆

#### 3.1.2 白名單外帳號（如果有）
- 用非白名單帳號發訊息 → 應該被擋下（block reply 或 ignore，視 config `block_others` 設定）

**驗證點**：dashboard 沒看到白名單外 user 的對話;HANDOFF/PROJECT_INVENTORY §2 有 `block_others` 設定。

### 3.2 IDLE / 新訂單開始

**客戶訊息**：「我要訂購」「我想買」「你好」
**預期**：Bot 問「請問需要什麼？」
**state 轉移**：IDLE → AWAITING_INFO
**驗證點**：customer LINE 收到回覆、dashboard 看到新對話 state。

### 3.3 AWAITING_INFO（收集各欄位）

#### 3.3.1 詢問菜單（FAQ · 不入訂單流程）
**客戶訊息**：「你們有什麼菜單？」「有菜單嗎」
**預期**：
- Bot 應傳送菜單圖片（3 張,主要雞肉）
- text: 「好的，以下是我們的品項～」 或類似
- Quick Reply 按鈕（看 main_idea.md # 十八, P3 2026-07-16 加）

**驗證點**：客戶收到 3 張圖片 + Quick Reply 按鈕。

#### 3.3.2 詢問配送（FAQ）
**客戶訊息**：「你們配送到哪裡？」
**預期**：Bot 回覆配送區域（三峽、鶯歌、土城等）+ 外送費規則

**驗證點**：對照 config/tenants/chicken.yaml `delivery.areas.allowed` 確認回覆內容。

#### 3.3.3 詢問付款方式
**客戶訊息**：「怎麼付款？」
**預期**：Bot 回覆 4 種付款方式（現金 / 轉帳 / 街口 / LINE Pay）

**驗證點**：對照 `payment:` 段 config 確認。

#### 3.3.4 詢問下次開團
**客戶訊息**：「下次開團是什麼時候？」
**預期**：Bot 回覆下一個 open_date

**驗證點**：對照 `open_dates:` 段。

### 3.4 ADDRESS 驗證（addressRule.js）

#### 3.4.1 合法地址
**客戶訊息**：「新北市三峽區學成路100號」
**預期**：Bot 接受 + 進到下一個欄位（電話 / 時段 / 件數）

#### 3.4.2 超出配送範圍 → handoff
**客戶訊息**：「大溪區三元街123號」
**預期**：Bot 回「超出配送範圍」訊息,state 轉 HUMAN_HANDOFF,老闆收到 LINE 通知

**驗證點**：
- 客戶 LINE 收到「已轉交人工」訊息
- dashboard 看到 state = HUMAN_HANDOFF
- 老闆 LINE 收到 handoff 通知（含 user line name + address）
- staff_notes 含「地址超出配送範圍」字樣

#### 3.4.3 需人工確認 → handoff
**客戶訊息**：「台北市信義區」
**預期**：Bot 回「需由客服進一步確認」+ handoff,staff_notes 含「配送範圍需人工確認」

#### 3.4.4 地址錯誤 → reask
**客戶訊息**：（空字串或「我不告訴你」）
**預期**：Bot 走 validation_failed,請客戶重給地址

### 3.5 DATE / TIME_SLOT 驗證

#### 3.5.1 配送日 + 收單時間（已過）
**客戶訊息**：（已過 13:00）今天配送
**預期**：`past_cutoff_today` error

#### 3.5.2 配送日 + 收單時間（前一天 13:00 後）
**客戶訊息**：（前一天 14:00 後）明天配送
**預期**：`past_order_cutoff` error

#### 3.5.3 合法時間組合
**客戶訊息**：（前一天 10:00）明天配送 + 上午 / 下午
**預期**：Bot 接受

**驗證點**：對照 main_idea.md # 九、收單時間規則。

### 3.6 CONFIRMING（訂單確認）

#### 3.6.1 客戶確認
**客戶訊息**：（已經完成所有欄位後）「確認」
**預期**：Bot 回「訂單已建立」+ 老闆 LINE 收到訂單通知 + state 轉 AWAITING_PAYMENT
**驗證點**：dashboard 看到新訂單 + 老闆收到 LINE 訊息（內容包含 user name / address / items / total）

#### 3.6.2 B 方案 auto-create-order（客戶寫「確認」時自動建單）
**驗證點**：v2 實作細節（見 HANDOFF §1 P5 標籤「B 方案」）

#### 3.6.3 客戶拒絕 / 改單
**客戶訊息**：「等一下」「我要改」
**預期**：Bot 回「請問要改什麼？」或退到 AWAITING_INFO

### 3.7 AWAITING_PAYMENT（收款流程）

#### 3.7.1 現金 (cash)
**客戶訊息**：「我選現金」
**預期**：Bot 回「到貨收現」+ state 等待 delivery 確認

#### 3.7.2 轉帳 (transfer)
**客戶訊息**：「我選轉帳」
**預期**：Bot 回銀行帳號 + 提醒轉帳後回傳截圖
**驗證點**：客戶收到轉帳帳號（從 config `payment.transfer.account`）

#### 3.7.3 街口 (jko) — P4
**客戶訊息**：「我選街口」
**預期**：
- Bot 回覆含街口 QR code（圖片）
- 客戶掃碼付款
- 客戶傳送截圖 → Bot 上傳到 `receipts_path` + vision OCR（P6 analyzer）

**驗證點**：客戶收到 QR code 圖片（不只是 URL）

#### 3.7.4 LINE Pay
**客戶訊息**：「我選 LINE Pay」
**預期**：Bot 回 LINE Pay 連結 或老闆的 LINE ID（落後選項、config `payment.linepay.line_id`）

### 3.8 已上傳支付截圖（receipts · P4 + P6）

#### 3.8.1 客戶傳圖片
**客戶動作**：客戶在對話傳支付截圖
**預期**：
- Bot 上傳圖片到 `data/orders/{date}/receipts/`
- vision analyzer（P6）解析金額、帳號末五碼
- 老闆 LINE 收到通知含 OCR 結果摘要
- dashboard 顯示 receipts_path 與 OCR 結果

**驗證點**：
- `ls data/orders/chicken/<date>/receipts/` 看到檔案
- CSV 訂單的 `likely_paid` / `detected_amount` / `detected_account_last5` 欄被填入
- 老闆 LINE 收到「客戶已上傳支付截圖，建議確認」訊息

### 3.9 HUMAN_HANDOFF（轉人工）

#### 3.9.1 觸發 handoff 的場景
- 3.4.2 / 3.4.3（地址超出 / 需確認）
- 客戶寫「我要退款」「我要找老闆」（觸發關鍵字）
- 客戶 writeLine 貼圖（line 貼圖、emoji 等）
- AI 信心不足（P6 vision failed）

**預期**：state 轉 HUMAN_HANDOFF,老闆 LINE 收到通知 + dashboard 顯示「待人工回覆」標籤

#### 3.9.2 老闆從 dashboard 回覆
- dashboard 該對話 → 編輯 customer_reply → 送出
- 客戶 LINE 收到老闆回覆

**驗證點**：從 dashboard 改 reply → LINE 推送成功（客戶收到）

### 3.10 COMPLETED（已完成）

#### 3.10.1 訂單完成（標記已收款）
老闆在 dashboard 點 ✓ 已收款 → state 轉 COMPLETED → 客戶收到「感謝您的訂購」訊息

#### 3.10.2 後續客戶訊息
客戶在已完成的訂單後傳訊息（不應該再開新訂單流程）
**預期**：Bot 回友善提示（不在訂單流程中）

---

## Phase 4 · State machine 完整路徑（10 分鐘）

### 4.1 從 IDLE 走完到 COMPLETED（Happy Path）

```
IDLE 
  → AWAITING_INFO (新訂單開始)
    → CONFIRMING (確認訂單)
      → AWAITING_PAYMENT (選付款方式)
        → COMPLETED (已收款)
```

**測試**：透過 Phase 3.2-3.7.1 連續執行一個 cash 訂單。

### 4.2 handoff 路徑（分支）

```
IDLE 
  → AWAITING_INFO
    → HUMAN_HANDOFF (地址超出 / 退款 / 貼圖)
      → 人工回覆後可繼續 IDLE
```

**測試**：3.4.2 然後老闆 dashboard reply → 客戶收到「地址超出配送範圍,建議改三峽」。

### 4.3 ERROR 路徑

```
AWAITING_INFO 收到垃圾輸入 → REASK (action: 'reask') 或 validation_failed
CONFIRMING 拒絕 → 退 AWAITING_INFO 改單
```

### 4.4 並發測試（2 個白名單帳號同時下單）

```bash
# 模擬：兩支手機同時點餐
# 預期：兩個訂單都成功建立,不會 race condition（csvWriter.js lock 機制）
# 驗證：dashboard 看到兩個訂單（不同 order_id）+ CSV 內 row 數正確
```

---

## Phase 5 · Payment 方式 4 種（10 分鐘）

### 5.1 現金 (cash)

- 客戶選「現金」→ Bot 確認到貨收現
- Dashboard 標 ✓ 已收款（day-of-delivery 收到錢時）
- 客戶 LINE 收到「感謝您,訂單已完成」

### 5.2 轉帳 (transfer)

- 客戶選「轉帳」→ Bot 給銀行帳號
- 客戶轉帳後可選：傳轉帳末五碼文字 / 傳截圖
- 老闆在 dashboard 人工確認 → ✓ 已收款

### 5.3 街口支付 (JKO) — P4

- 客戶選「街口」→ Bot 給 QR code 圖片
- 客戶掃碼付款後傳截圖
- P6 vision analyzer 解析金額 + 末五碼
- 若 confidence 高 → 自動標 ✓ 已收款,否則老闆手動確認

### 5.4 LINE Pay

- 客戶選「LINE Pay」→ Bot 回老闆 LINE ID（落後選項）
- 客戶私下 LINE 老闆付款
- 老闆確認收款

**驗證點**：4 種付款方式的對應流程 + 老闆 LINE 通知。

---

## Phase 6 · 外部整合（被動驗證 · 10 分鐘）

### 6.1 Google Sheets sync（P9）

訂單建單後應該被 sync 到 Google Sheets:
- 自動跑（不需要觸發）
- 檢查 cron：`6033de71-23d9-4007-8861-8e3ceadfb707` 每日 03:00 dryRun 跑

**手動驗證**:
```bash
node scripts/sheets-sync-cron.js dryRun
# 預期：列出會被 sync 的訂單（不實際寫入）
```

### 6.2 老闆 LINE 通知

- 訂單建單 → 老闆 LINE 收到「[新訂單] user / phone / address / total」
- handoff → 老闆 LINE 收到「[待處理] user line name + reason」
- 客戶上傳支付截圖 → 老闆 LINE 收到「[客戶已付款截圖] OCR 摘要」

**驗證點**：Hubert LINE `k.chang.8844@gmail.com` 內部看到對應訊息。

### 6.3 老闆 Email 通知（P0 Gmail）

- 訂單 / handoff / 客戶回覆都同時寄 Email（gog 整合）
- 4 種版型:handoff / autoOrder / digest / system

**驗證點**:
```bash
# 看 gog 信箱（k.chang.8844@gmail.com）的 inbox
# 或用 gog CLI
gog gmail list --query "from:chicken-cs is:unread"
```

### 6.4 Cloudflare Worker（webhook proxy）

- LINE webhook → external-user-line-security.kaden1122123.workers.dev/webhook
- Worker 做:sanitize + rate limit + forward OpenClaw

**驗證點**:
```bash
# 從外部打 webhook 應該得到 200
curl -X POST https://external-user-line-security.kaden1122123.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# 注意：沒有正確 LINE signature 會被擋，預期 401/403
```

### 6.5 每日 backup

```bash
ls /home/clawuser/openclaw/workspace-external-user/backups/ | tail
# 預期看到 7 天 rotation 的 backup（每日 02:00 跑）
```

---

## Phase 7 · 故障排除

### 常見錯誤與處置

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| `/healthz` dashboard=down | dashboard-server.js crash | `ps -eo pid,etime,args \| grep dashboard-server` + kill + 重新啟動 |
| `/healthz` api_server=down | api-server.js crash | `ps -eo pid,etime,args \| grep api-server` + kill + 重新啟動 |
| `/healthz` worker=down | Cloudflare Worker 部署 v 過期或 API server down | 重新 deploy worker + 查 api-server |
| 客戶訊息無回應 | Worker webhook fail | 看 Cloudflare Worker logs + api-server.log |
| 老闆沒收到 LINE | LINE_BOT_TOKEN 失效 | `cat ~/.config/chicken/secrets/line-bot-token` 確認 172 chars |
| test fail | npm test 有 stale state | `rm -rf data/orders/_csv_concurrency_test*` 然後重跑 |
| 訂單沒 sync 到 Sheets | api-server dryRun 失敗 | 看 logs,sync-cron.js status |

### 服務重啟 SOP

```bash
# 重啟 dashboard
pkill -f "node scripts/dashboard-server" 2>/dev/null
sleep 2
DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd PORT=3000 \
  nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown

# 重啟 api-server
pkill -f "node scripts/api-server" 2>/dev/null
sleep 2
API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd PORT=3001 \
  nohup node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown

# 確認 healthz 全綠
sleep 3
curl -s http://localhost:3000/healthz
```

### 看 log

```bash
# 即時 tail
tail -f /tmp/dashboard-server.log
tail -f /tmp/api-server.log

# 找 error pattern
grep -nE "ERROR|throw|TypeError|Error:" /tmp/api-server.log | tail -20
```

---

## Phase 8 · 環境清理（測試完成時）

```bash
# 1. 刪測試訂單（不要刪 6/13 + 6/16）
node scripts/cleanup-test-orders.js

# 2. 刪 worker script（如有殘留）
rm -f tests/fixtures/csv-writer-concurrency-worker.js
rm -rf data/orders/_csv_concurrency_test* knowledge/tenants/_csv_concurrency_test

# 3. 同步 main 鏡像（如果 dev repo 改了任何檔）
bash scripts/sync-mirror.sh from-legacy

# 4. check-quality 確認 13 checks 全綠
bash scripts/check-quality.sh
# 預期：通過 13 警告 0 失敗 0
```

---

## Phase 9 · 簽署

測試完成後,在 commit 訊息或工作日誌加:

```
測試人: Hubert / brtclaw session
日期: 2026-07-XX
涵蓋範圍: Phase 0-8 全綠 / 部分 skip
異常紀錄: (Link to issue if any)
下次測試對象: P1 統一測試 framework 進度 / worker FAQ 整合 (sign-on 2026-07-20)
```

---

## 附錄 A · 重要檔案 quick reference

| 檔案 | 用途 |
|------|------|
| `/tmp/dashboard-server.log` | Dashboard 服務 log |
| `/tmp/api-server.log` | api-server 服務 log |
| `data/orders/chicken/<date>.csv` | 每日訂單 CSV（真實 6/13 + 6/16 protected） |
| `data/orders/chicken/<date>/receipts/` | 客戶支付截圖（P4） |
| `knowledge/tenants/chicken/06_faq.md` | FAQ 知識源（Cloudflare Worker 將來用於前處理） |
| `config/tenants/chicken.yaml` | 設定 source of truth |
| `scripts/check-quality.sh` | 13 check quality gate |
| `scripts/cleanup-test-orders.js` | 測試訂單清理（保護 6/13 + 6/16） |

## 附錄 B · 對應 main_idea.md 章節

| Phase | main_idea.md 章節 |
|-------|-------------------|
| Phase 3.3.1 | # 十一、菜單知識庫（line 450） |
| Phase 3.3.2 | # 七、外送規則（line 266） |
| Phase 3.3.3 | # 六、付款方式與訂單成立規則（line 216） |
| Phase 3.4 | # 十二、接單時的標準流程 §三（line 689） |
| Phase 3.5 | # 九、收單時間規則（line 328）🚨 |
| Phase 3.6 | # 十四、訂單確認流程 v2 A 方案（line 896）🚨 |
| Phase 3.7.3 | # 二十、客戶上傳支付截圖 P4（line 1236） |
| Phase 3.7.4 | main_idea.md 內「LINE Pay 落後選項」config |
| Phase 3.8 | # 二十、P4 + # 二十二、P6 Vision Analyzer |
| Phase 3.9 | # 十五、必須轉交真人的情況（line 851） |
| Phase 3.10 | # 十六、客服回覆範例（line 894） |
| Phase 3 Quick Reply | # 十八、Quick Reply 統一回覆 P3（line 1141） |
| Phase 6.2 | # 十二、通知管理員守則（line 484）🚨 |

---

_本文件由 brtclaw（OpenClaw runtime session）維護,測試 SOP 範本_
_下次 audit 時機：P1 統一測試 framework 進度 + Worker FAQ 整合完成後_
