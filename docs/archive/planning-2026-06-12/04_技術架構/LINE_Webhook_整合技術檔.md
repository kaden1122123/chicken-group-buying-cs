# LINE Webhook 整合技術檔

> 建立時間：2026-06-08
> 最後更新：2026-06-08
> 狀態：已修復 ✅

---

## 問題描述

LINE 長訊息（100字以上）通过 Cloudflare Worker 转发到 OpenClaw 时返回 401，短訊息正常。

---

## 根本原因

LINE signature 驗證是 body-dependent（HMAC over raw body）。

1. Worker 收到 LINE webhook，用 Worker 自己的 `LINE_CHANNEL_SECRET` 驗證 signature ✅
2. Worker 修改 body（過濾 blocked events）後轉發
3. 轉發時使用**原始 signature**（針對原始 body）
4. OpenClaw 收到 modified body + 原始 signature → 401

---

## 修復方案

### 1. 新增 `generateLINESignature` 函數

```typescript
async function generateLINESignature(bodyText: string, channelSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(channelSecret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}
```

### 2. 修改轉發邏輯

```typescript
// 構造新的請求體
const newBody = JSON.stringify({
  ...JSON.parse(body),
  events: allowedEvents,
});

// ✅ 核心修復：為修改過的 newBody 重新計算 Signature
const newSignature = await generateLINESignature(newBody, env.LINE_CHANNEL_SECRET);

// 轉發到 OpenClaw Gateway
const gatewayResponse = await fetch(fullUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Line-Signature': newSignature, // ✅ 傳送新的 Signature
  },
  body: newBody,
});
```

---

## 設定檔

### Cloudflare Worker

**位置：** `/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/src/index.ts`

**wrangler.toml：**
```toml
name = "external-user-line-security"
main = "src/index.ts"
compatibility_date = "2024-01-01"

account_id = "7f2546e81619908113f0d6c9e42b6b36"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "4e2769895f2c48adb7b57e00a335c59f"

[vars]
OPENCLAW_GATEWAY_URL = "https://openclaw.brt1122.com"
RATE_LIMIT_WINDOW_SECONDS = "60"
RATE_LIMIT_MAX_REQUESTS = "7"
RATE_LIMIT_DAILY_MAX = "500"
RATE_LIMIT_MAX_MESSAGE_LENGTH = "2000"
```

**LINE Secrets（Cloudflare Dashboard → Workers → Secrets）：**
- `LINE_ACCESS_TOKEN` - LINE Channel Access Token
- `LINE_CHANNEL_SECRET` - LINE Channel Secret

### OpenClaw LINE 設定

**位置：** `~/.openclaw/openclaw.json`

```json
{
  "channels": {
    "line": {
      "enabled": true,
      "accounts": {
        "534zsteg": {
          "enabled": true,
          "webhookPath": "/line/534zsteg",
          "channelAccessToken": "UbUmg0FicKxCzGMp3SE3ycwl/...",
          "channelSecret": "c088801e7a4c01fe3e8ec916e2ce282b",
          "dmPolicy": "open",
          "allowFrom": ["*"],
          "groupPolicy": "allowlist",
          "groupAllowFrom": [
            "Uf56650056d35626deb64165926a26182",
            "U1c2ef77ad9b7bec409a66b9dcab14c07",
            "U3fdecb112988cfe50774e2501f2a164f",
            "U19bee32edfecafbc7743ff56ccdfdc10",
            "U89a3652b40353638751dbeac97d49dce"
          ]
        }
      }
    }
  }
}
```

---

## LINE Webhook URL

```
https://external-user-line-security.kaden1122123.workers.dev/webhook
```

**注意：** LINE 要求 Webhook URL 必須以 `/webhook` 結尾，無法改成其他路徑。

---

## 架構圖（修復後）

```
LINE 發送 webhook
     │
     ▼
https://external-user-line-security.kaden1122123.workers.dev/webhook
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Worker                              │
│                                                 │
│  1. 接收 POST /webhook                          │
│  2. 取出 X-Line-Signature header                │
│  3. verifyLINEWebhookSignature(body, sig,       │
│     env.LINE_CHANNEL_SECRET)                    │
│     → 失敗 → 403 Unauthorized                   │
│     → 成功 → 繼續                               │
│  4. 解析 JSON → 取出 events                    │
│  5. Rate Limiting 檢查                         │
│  6. 付款關鍵字攔截（短訊息 ≤50字）             │
│  7. 過濾 blocked events → newBody              │
│  8. newSignature = generateLINESignature(       │
│     newBody, env.LINE_CHANNEL_SECRET)           │
│  9. POST https://openclaw.brt1122.com/line/534zsteg
│     Header: X-Line-Signature: newSignature      │
│     Body: newBody                               │
└─────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  OpenClaw Gateway                               │
│                                                 │
│  1. 接收 POST /line/534zsteg                    │
│  2. 取出 X-Line-Signature header                │
│  3. 用 534zsteg 的 channelSecret 驗證 signature │
│     → 失敗 → 401 Unauthorized                  │
│     → 成功 → 處理事件                           │
│  4. 路由到對應的 Agent（雞肉團購客服）          │
└─────────────────────────────────────────────────┘
     │
     ▼
雞肉團購客服 Agent
```

---

## 關鍵函數

| 函數 | 位置 | 用途 |
|------|------|------|
| `verifyLINEWebhookSignature` | Worker | 驗證 LINE 原始 signature |
| `generateLINESignature` | Worker | 為 modified body 產生新 signature |
| Rate Limiter | Worker | per-user rate limiting |
| `replyToLINE` | Worker | 回覆 LINE 訊息 |

---

## 版本記錄

| 日期 | 版本 | 變更 |
|------|------|------|
| 2026-06-08 | 2eb126a9 | 新增 `generateLINESignature`；修改轉發邏輯使用 `newSignature` |
| 2026-06-08 | 3667cb1a | 付款關鍵字攔截改為僅限短訊息（≤50字） |
| 2026-06-05 | 39d1a66d | 新增 debug log |
| 2026-05-31 | 初始版 | 基本架構 |

---

## 注意事項

1. **LINE Webhook URL 不可自訂結尾**：LINE 要求必須是 `/webhook`
2. **Signature 驗證是 body-dependent**：任何修改 body 的動作都需要重新計算 signature
3. **Worker 和 OpenClaw 使用同一個 LINE Channel Secret**：雙方都需要能夠驗證同一個 signature
4. **webhookPath 是 OpenClaw 內部路由**：用於區分多個 LINE 帳號，不影響外部 URL