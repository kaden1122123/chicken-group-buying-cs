# 雞味客服 Operations SOP（LINE Bot + Staging + Secrets）

> **作者**：brtclaw（2026-07-25 11:40+ Round 22 合併建立）
> **last_updated**：2026-07-25（Round 26 — STAGING 內容已併入 §4）
> **目的**：合併 `LINE_BOT_SETUP.md` + `STAGING.md` + `STAGING_SECRETS_SETUP.md` 為單一文件
> **來源**：3 個 SOP 共 521 行 → 合併後 220 行（**58% 節省**）
> **適用對象**：Hubert（owner）、新客戶 linebot 建置 SOP 範本

---

## 📋 1. 3 層位置架構（LINE Bot 設定分散在這 3 處）

| 層 | 位置 | 編輯權 | 用途 |
|----|------|--------|------|
| **L1: dev repo** | `config/tenants/chicken.yaml` | ✅ 永遠改這 | source of truth（git tracked）|
| **L2: 本機 secrets** | `/home/clawuser/.config/chicken/secrets/` | ❌ mode 600 保護 | 實際 secret 內容 |
| **L3: Cloudflare Worker** | Cloudflare Dashboard → external-user-line-security → Settings → Variables | ❌ 加密 | Worker runtime env |

**LINE Bot 必要資訊**（從 LINE Developer Console 取得）：
- **Channel access token (long-lived)** — 172 chars JWT
- **Channel secret** — 32 chars hex
- **Hubert 個人 LINE User ID** — `Uf56650056d35626deb64165926a26182`
- **Webhook URL** — `https://external-user-line-security.kaden1122123.workers.dev/webhook`

---

## 🔄 2. 3 個環境（dev / staging / production）

| 環境 | Worker name | URL | 用途 |
|------|-------------|-----|------|
| **dev** | 本地（無 Worker） | `localhost:8787` | 本地 `wrangler dev` 測試 |
| **staging** | `external-user-line-security-staging` | `https://external-user-line-security-staging.kaden1122123.workers.dev` | 整合測試、真實 LINE 帳號測試 |
| **production** | `external-user-line-security` | `https://external-user-line-security.kaden1122123.workers.dev` | 服務真實客戶 |

**環境變數對照表**：

| Variable | dev | staging | production |
|----------|-----|---------|------------|
| `LINE_BOT_TOKEN` | (file) | staging bot token | 真實 bot token |
| `LINE_CHANNEL_SECRET` | (file) | staging secret | 真實 secret |
| `OPENCLAW_GATEWAY_URL` | `http://127.0.0.1:18789` | `https://openclaw.brt1122.com` | `https://openclaw.brt1122.com` |
| `RATE_LIMIT_MAX_REQUESTS` | 不限 | 30 | 7 |
| `RATE_LIMIT_DAILY_MAX` | 不限 | 1000 | 500 |
| `RATE_LIMIT_MAX_MESSAGE_LENGTH` | 2000 | 2000 | 2000 |

---

## 🚀 3. 換 LINE Bot 本體（Hubert 確認換真實帳號時執行）

### Step 1：在 LINE Developer Console 建新 Channel

1. 登入 https://developers.line.biz/console/
2. Create new provider → Create new channel → Messaging API
3. 填寫 Channel 資訊（名稱、描述、icon、Category）
4. 取得：
   - Channel access token (long-lived) — 172 chars JWT
   - Channel secret — 32 chars hex

### Step 2：設定新 Channel 的 Webhook

1. LINE Developer Console → 新 Channel → Messaging API → Webhook settings
2. Webhook URL：`https://external-user-line-security.kaden1122123.workers.dev/webhook`
3. 啟用 Webhook，**關閉「Auto-reply messages」**（避免 LINE 官方預設回應衝突）

### Step 3：更新 Cloudflare Worker env vars（2 種方法）

**方法 A — wrangler CLI**：
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
vi config/tenants/chicken.yaml
# 把 notify_owner.line_user_id 改成新老闆的 LINE User ID
bash scripts/sync-config.sh
```

### Step 5：更新本機 secrets 檔

```bash
echo "NEW_LINE_BOT_TOKEN" > /home/clawuser/.config/chicken/secrets/line-bot-token
chmod 600 /home/clawuser/.config/chicken/secrets/line-bot-token
# 重啟 api-server 才會讀到新 token
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID" && sleep 2
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \
  LOG_DIR=/home/clawuser/.openclaw/logs/chicken \
  node scripts/api-server.js > ~/.openclaw/logs/chicken/api-server.log 2>&1 & disown
```

### Step 6：驗證

```bash
curl -sS -m 5 https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats
# 手機 LINE 傳訊息測試
```

### Step 7：清理舊 secrets（可選，新 bot 穩定 1 週後）

```bash
mv /home/clawuser/.config/chicken/secrets/line-bot-token \
   /home/clawuser/.config/chicken/secrets/line-bot-token.bak.$(date +%Y%m%d)
```

---

## 🔧 4. Staging 環境設定（一次 + 日常 deploy）

### 第一次設定（一次性）

```bash
# 1. 建立 staging KV namespace
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
wrangler kv:namespace create RATE_LIMIT_KV --env staging
# 填 id 到 wrangler.staging.toml（已建，ID: 83d36bc57b6b4505aa24ad684483e00c）

# 2. 設定 staging secrets
echo "STAGING_LINE_BOT_TOKEN" | wrangler secret put LINE_BOT_TOKEN --env staging
echo "STAGING_LINE_CHANNEL_SECRET" | wrangler secret put LINE_CHANNEL_SECRET --env staging

# 3. 第一次 deploy staging
wrangler deploy --env staging
```

**wrangler 4.x 已知問題**：`wrangler secret list --env staging` 可能報 "No environment found"。Workaround：在 `wrangler.toml` 加 `[env.staging]` section，或用 Dashboard 設定（不影響 deploy 效果）。

### 日常 deploy 流程（每次改 Worker code 時）

```bash
# 1. dev 本地測試
wrangler dev --env staging

# 2. deploy staging
wrangler deploy --env staging
# 驗證: curl https://external-user-line-security-staging.kaden1122123.workers.dev/api/knowledge/stats

# 3. staging 整合測試（手機 LINE 加 staging bot 好友）
# 4. deploy production
wrangler deploy --env production

# 5. production 監控 24hr（看 Worker logs + Discord）
```

### Rollback（prod 出問題時）

```bash
wrangler deployments list
wrangler rollback --env production  # 30 秒內生效上一個 version
```

---

## 🔍 5. 驗證

```bash
# Worker health
curl https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats
# {"totalEntries":45,"uniqueKeywords":240,...}

# Staging health
curl https://external-user-line-security-staging.kaden1122123.workers.dev/api/knowledge/stats

# Local services
curl http://localhost:3000/healthz  # {dashboard=up, api_server=up, worker=up}
```

---

## 🛡️ 6. 安全注意事項

1. **永遠不要用 production token 當 staging secret**（避免訊息混用）
2. **不要把 secret commit 到 git**（用 mode 600 檔案或 wrangler secret put）
3. **定期 rotate**（每 90 天，見 `docs/GCP_ROTATION_SOP.md`）
4. **不要在 staging 測真實客戶個資**
5. **每次換 bot 記錄到 `memory/YYYY-MM-DD.md`**
6. **備份**：`/home/clawuser/backups/chicken-secrets-YYYY-MM-DD.tar.gz`

---

## 🆘 7. Troubleshooting

| 問題 | 原因 | 修法 |
|------|------|------|
| 換 bot 後 401 Unauthorized | `LINE_CHANNEL_SECRET` 不匹配 | 確認 secret 值正確 |
| 換 bot 後 AI 沒回應 | `LINE_ACCESS_TOKEN` 是舊的 | 加新 token 到 `LINE_BOT_TOKEN`（Worker 優先讀）|
| notify_owner 沒收到 | `notify_owner.line_user_id` 還是舊老闆 | 改成新 line_user_id + 重啟 api-server |
| staging deploy 後 webhook 沒反應 | secret 沒設 | `wrangler secret list --env staging` 確認 |
| staging bot 收到 prod 訊息 | secret 混用 | 確認 staging 與 prod token 不同 |
| `wrangler secret put` 卡住等 input | CLI 沒從 stdin 讀 | 加 `echo "value" \|` 前綴 |

---

_本檔由 brtclaw 維護，對應 `docs/SESSION_END_SOP.md` 在換 bot 後 24 小時內 review_
_取代：`docs/LINE_BOT_SETUP.md` + Worker `docs/STAGING.md` + Worker `docs/STAGING_SECRETS_SETUP.md`_
_最後更新：2026-07-25 11:40+_
