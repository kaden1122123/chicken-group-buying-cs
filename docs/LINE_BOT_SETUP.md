# 雞味客服 LINE Bot — 完整設定指南

> **作者**：brtclaw（2026-07-24 10:50 Round 19 建立）
> **目的**：單一文件說明如何設定 / 切換 / 維護雞味客服 LINE Bot
> **適用對象**：Hubert（owner）、未來接手工程師、新客戶 linebot 建置 SOP 範本

---

## 📋 雞味客服 LINE Bot 完整設定清單

### 必要資訊（從 LINE Developer Console 取得）

| 項目 | 取得位置 | 格式 |
|------|---------|------|
| **LINE Channel Access Token** | LINE Developer Console → 你的 Channel → Messaging API → Channel access token (long-lived) | 172 chars JWT |
| **LINE Channel Secret** | LINE Developer Console → Channel → Basic settings → Channel secret | 32 chars hex |
| **LINE User ID（Hubert 個人）** | LINE Developer Console 或 LINE 設定檔 | `Uf...` 開頭 33 chars |
| **Webhook URL** | Worker URL + `/webhook` | `https://external-user-line-security.kaden1122123.workers.dev/webhook` |

---

## 🔧 三層位置 + 換 Bot 流程

### Layer 1: dev repo source of truth（git tracked）

**檔案**：`config/tenants/chicken.yaml`

```yaml
line:
  bot_token: ${LINE_BOT_TOKEN}      # env var reference
  channel_secret: ${LINE_CHANNEL_SECRET}  # env var reference

notify_owner:
  enabled: true
  line_user_id: Uf56650056d35626deb64165926a26182  # Hubert 個人 LINE
```

**要換 bot 時改這 2 個值**：
1. `notify_owner.line_user_id` → 新老闆的 LINE User ID
2. `bot_token` / `channel_secret` env vars 改值（這 2 個是 env reference，指向 secret）

### Layer 2: 本機 secrets 檔（mode 600，git ignored）

**路徑**：`/home/clawuser/.config/chicken/secrets/`

| 檔案 | mode | 內容 |
|------|------|------|
| `line-bot-token` | 600 | 172 chars LINE access token |
| `dashboard-pwd` | 600 | dashboard HTTP Basic Auth password (15 chars) |
| `api-pwd` | 600 | api-server HTTP Basic Auth password (14 chars) |
| `api-token` | 600 | 64 chars X-API-Token for B 方案 |

**要換 bot 時改這 1 個檔**：`line-bot-token`（用真實 token 覆蓋）

### Layer 3: Cloudflare Worker env vars（Cloudflare dashboard）

**設定位置**：Cloudflare Dashboard → Workers → external-user-line-security → Settings → Variables

| Variable | Type | Value |
|----------|------|-------|
| `LINE_CHANNEL_SECRET` | Secret | 32 chars hex |
| `LINE_ACCESS_TOKEN` | Secret | 172 chars JWT（向後相容） |
| `LINE_BOT_TOKEN` | Secret | 172 chars JWT（canonical，新設） |
| `OPENCLAW_GATEWAY_URL` | Plaintext | `https://openclaw.brt1122.com` |
| `RATE_LIMIT_WINDOW_SECONDS` | Plaintext | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Plaintext | `7` |
| `RATE_LIMIT_DAILY_MAX` | Plaintext | `500` |
| `RATE_LIMIT_MAX_MESSAGE_LENGTH` | Plaintext | `2000` |

**要換 bot 時改這 1 個值**：`LINE_BOT_TOKEN`（Worker 程式會優先讀 LINE_BOT_TOKEN，fallback LINE_ACCESS_TOKEN）

---

## 🚀 換 Line Bot 完整步驟（Hubert 確認換真實帳號時執行）

### Step 1：在 LINE Developer Console 建新 Channel

1. 登入 https://developers.line.biz/console/
2. Create new provider（如：「雞味研究所」）
3. Create new channel → Messaging API
4. 填寫 Channel 資訊（名稱、描述、icon、Category）
5. 取得：
   - Channel access token (long-lived)
   - Channel secret

### Step 2：設定新 Channel 的 Webhook

1. LINE Developer Console → 新 Channel → Messaging API → Webhook settings
2. Webhook URL：`https://external-user-line-security.kaden1122123.workers.dev/webhook`
3. 啟用 Webhook
4. 關閉「Auto-reply messages」（避免 LINE 官方預設回應衝突）

### Step 3：更新 Cloudflare Worker env vars

**方法 A — 用 wrangler CLI**：
```bash
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
echo "NEW_LINE_BOT_TOKEN" | wrangler secret put LINE_BOT_TOKEN
echo "NEW_LINE_CHANNEL_SECRET" | wrangler secret put LINE_CHANNEL_SECRET
```

**方法 B — Cloudflare Dashboard**：
1. https://dash.cloudflare.com → Workers → external-user-line-security
2. Settings → Variables → Add variable
3. Type: Secret, Name: `LINE_BOT_TOKEN`, Value: <new token>
4. 同樣加 `LINE_CHANNEL_SECRET`

### Step 4：更新 dev repo chicken.yaml

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
# 改 line section
vi config/tenants/chicken.yaml
# 把 notify_owner.line_user_id 改成新老闆的 LINE User ID

# sync 到 legacy config.yaml（給 fallback 讀）
bash scripts/sync-config.sh
```

### Step 5：更新本機 secrets 檔

```bash
# 改成新 token
echo "NEW_LINE_BOT_TOKEN" > /home/clawuser/.config/chicken/secrets/line-bot-token
chmod 600 /home/clawuser/.config/chicken/secrets/line-bot-token

# 重啟 api-server 才會讀到新 token
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID"
sleep 2

cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
  PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown
```

### Step 6：驗證

```bash
# 1. Worker 還活
curl -sS -m 5 https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats

# 2. api-server 讀到新 token
tail -20 /tmp/api-server.log | grep -E "LINE_BOT_TOKEN|config"

# 3. 手機 LINE 傳訊息測試
# 客戶應收到 AI 回應（KB 命中 → canned / fallback LLM）
```

### Step 7：清理舊 secrets（可選）

```bash
# 確認新 bot 穩定運作 1 週後，可清除舊 secrets
# 但要保留作為 audit trail
mv /home/clawuser/.config/chicken/secrets/line-bot-token \
   /home/clawuser/.config/chicken/secrets/line-bot-token.bak.$(date +%Y%m%d)
```

---

## 🔁 切換回 dev bot（測試用）

如果切到真實帳號後發現問題想切回 dev bot：

1. 把 secrets 檔的值還原：
```bash
echo "DEV_LINE_BOT_TOKEN" > /home/clawuser/.config/chicken/secrets/line-bot-token
echo "DEV_LINE_CHANNEL_SECRET" | wrangler secret put LINE_CHANNEL_SECRET  # via Cloudflare
echo "DEV_LINE_BOT_TOKEN" | wrangler secret put LINE_BOT_TOKEN  # via Cloudflare
```

2. Worker 部署不需重啟（用 env vars hot reload）

---

## 🐛 常見問題

### Q1: 換 bot 後客戶訊息 401 Unauthorized

**原因**：LINE_CHANNEL_SECRET 跟新 bot 的不匹配
**修法**：確認 `wrangler secret put LINE_CHANNEL_SECRET` 用了正確的值

### Q2: 換 bot 後 AI 沒回應

**原因**：LINE_ACCESS_TOKEN 是舊的
**修法**：把新 token 加到 LINE_BOT_TOKEN secret（Worker 程式會優先讀）

### Q3: 換 bot 後 notify_owner 沒收到 handoff 通知

**原因**：`notify_owner.line_user_id` 還是舊老闆
**修法**：改成新 line_user_id + 重啟 api-server

---

## 🔐 安全注意事項

1. **永遠不要 commit secret 到 git**：用 mode 600 檔案 + env var reference
2. **Token rotation**：每 90 天換一次 LINE Channel Access Token（見 `docs/GCP_ROTATION_SOP.md` 同樣 SOP）
3. **Audit log**：每次換 bot 記錄到 `memory/YYYY-MM-DD.md`
4. **Backup**：新 bot 的 token 設定後，備份到 `/home/clawuser/backups/chicken-secrets-YYYY-MM-DD.tar.gz`

---

_本檔由 brtclaw 維護，配合 `docs/SESSION_END_SOP.md` 在換 bot 後 24 小時內 review 一次_
_最後更新：2026-07-24 10:50_
