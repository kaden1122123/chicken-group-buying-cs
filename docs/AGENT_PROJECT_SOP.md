# AGENT_PROJECT_SOP — AI 客服專案建置 SOP

> **作者**：brtclaw（2026-07-24 Round 19 Task D 建立）
> **目的**：未來建新的 LINE Bot + AI 客服專案的完整步驟
> **範例**：雞味客服 (`chicken-group-buying-customer-service`) 已建置完成，作為 reference

---

## 為什麼需要這份 SOP

- 每次建新客戶/linebot 都要重新摸索基礎設施浪費時間
- 用一致的架構（3-layer + KB + Worker + Scripts）減少維運成本
- 預先定義好 SOP，brtclaw 或未來工程師可以直接照做

---

## 🎯 適用情境

- 建新的 LINE Bot + AI 客服（餐廳、電商、客服中心）
- 客戶需要「自訂 domain + AI 自動回 + 真人轉接 + 訂單管理」

---

## 📐 整體架構（3-Layer Architecture）

```
                    ┌─────────────────────────────┐
                    │  Production Runtime          │
                    │  ~/.openclaw/agents/         │
                    │  <agent_name>/               │
                    │  (LLM 真的在這讀)            │
                    └─────────────────────────────┘
                                  ↑
                       sync-canonical.sh
                                  ↑
┌─────────────────────────────┐ ┌────────────────────────┐
│  Dev Repo (source of truth) │→│  Main Mirror            │
│  ~/openclaw-workspace/      │ │  ~/.openclaw/workspace- │
│  others/<project_name>/     │ │  external-user/projects/│
│  (git tracked, 永遠在這編)   │ │  <project_name>/        │
└─────────────────────────────┘ │  (rsync, chmod 555)     │
                                └────────────────────────┘
```

**3 層各自角色**：
1. **Dev repo**：single source of truth，git tracked，永遠在這編
2. **Main mirror**：services 跑的 code（rsync from dev，chmod 555 防直接編）
3. **Production runtime**：LLM prompt（canonical files，sync from dev）

---

## 📋 Step-by-Step 建置流程

### Step 0：必要基礎設施（prerequisites）

#### 0.1 帳號與服務

| 服務 | 用途 | 取得 |
|------|------|------|
| Cloudflare 帳號 | Worker 部署 | https://dash.cloudflare.com/sign-up |
| GitHub 帳號 | Repo hosting | https://github.com/signup |
| LINE Developer 帳號 | LINE Bot | https://developers.line.biz/console/ |
| OpenClaw Gateway | LLM 轉發 | 已預設（`https://openclaw.brt1122.com`）|

#### 0.2 本機環境

```bash
# 確認有這些工具
node --version      # >= 20
npm --version       # >= 10
wrangler --version  # >= 4
git --version       # >= 2
```

#### 0.3 建立 dev repo

```bash
cd ~/openclaw-workspace/others
mkdir <project_name>  # 例：chicken-group-buying-customer-service
cd <project_name>
git init
git remote add origin git@github.com:kaden1122123/<project_name>.git
```

---

### Step 1：建立 src/ 目錄結構

複製雞味客服的 src/ 結構（已 production-ready）：

```bash
# 從雞味客服複製 src/ 模板
cp -r ~/openclaw-workspace/others/chicken-group-buying-customer-service/src/ .
cp -r ~/openclaw-workspace/others/chicken-group-buying-customer-service/tests/ .
cp -r ~/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/ .
```

**目錄結構**：
```
src/
├── config.js               # 設定載入（YAML + env）
├── index.js                # 主 entry
├── states/                 # 訂單狀態機
│   ├── idle.js
│   ├── awaitingInfo.js
│   ├── awaitingPayment.js
│   ├── confirming.js
│   └── completed.js
├── order/                  # 訂單管理
│   ├── csvWriter.js
│   ├── csvReader.js
│   └── orderFormatter.js
├── rules/                  # 業務規則引擎
│   ├── addressRule.js
│   ├── dateRule.js
│   └── paymentRule.js
├── handoff/                # 轉真人 + 通知
│   ├── notifier.js
│   ├── autoOrder.js
│   └── emailNotifier.js
├── knowledge/              # KB 來源
│   └── triggers.js
└── utils/                  # 工具
    ├── logger.js
    └── lineProfileCache.js

scripts/
├── api-server.js           # HTTP API（port 3001）
├── dashboard-server.js     # Dashboard（port 3000）
├── check-quality.sh        # 12 項品質檢查
├── sync-canonical.sh       # sync production runtime
├── sync-config.sh          # sync config.yaml
├── sync-mirror.sh          # rsync dev → main mirror
├── main-enforce-readonly.sh # chmod 555 強制
├── cleanup-test-orders.js  # 清測試訂單
└── customer-tags.js        # 客戶標籤自動判斷
```

---

### Step 2：建立 config/ 結構（YAML）

```bash
mkdir -p config/tenants
```

**config/tenants/<tenant>.yaml**（chicken.yaml 範例）：

```yaml
# 客戶配置 source of truth
tenant:
  id: <tenant_id>
  display_name: <客戶顯示名>
  agent_path: ~/.openclaw/agents/<agent_name>
  environment: production

line:
  bot_token: ${LINE_BOT_TOKEN}
  channel_secret: ${LINE_CHANNEL_SECRET}

notify_owner:
  enabled: true
  line_user_id: <老闆 LINE User ID>

knowledge:
  base_path: knowledge/tenants/<tenant>
  learned_path: knowledge/learned
  triggers_path: src/knowledge/triggers.js

security:
  status_flow:
    payment_status: [pending, paid, confirmed]
    order_status: [new, confirmed, preparing, delivered, completed, cancelled]
  forbidden_info:
    - 老闆個人電話
    - 私人 LINE
    - 成本結構
  input_sanitization: true
  block_others: false
  allowed_line_users:
    - <老闆 LINE User ID>

storage:
  phase1:
    enabled: true
    type: csv
    base_path: data/orders
    filename_pattern: '{date}.csv'
    backup_path: data/orders/archive
  phase2:
    enabled: false
    type: google_sheets

payment:
  cash:
    enabled: true
  transfer:
    enabled: true
    bank_code: <銀行代碼>
    account: <帳號>
  line_pay:
    enabled: true
  jko:
    enabled: true
    qr_url: <QR Code URL>

open_dates:
  # YYYY-MM-DD 開團日（每月初更新）
  - <YYYY-MM-DD>

email:
  enabled: true
  digest_to: <email>
```

---

### Step 3：建立 docs/production-prompt/（LLM prompt 版本控制）

```bash
mkdir -p docs/production-prompt/<version>
```

**docs/production-prompt/<version>/AGENTS.md**（LLM 看到的規範）
**docs/production-prompt/<version>/SOUL.md**（人格）
**docs/production-prompt/<version>/main_idea.md**（業務邏輯）
**docs/production-prompt/<version>/CHANGELOG.md**（版本變更）

用 `sync-canonical.sh` 同步到 `~/.openclaw/agents/<agent_name>/`。

---

### Step 4：建立 Cloudflare Worker

```bash
mkdir -p ~/openclaw-workspace/external-user/cloudflare-worker-<project>
cd ~/openclaw-workspace/external-user/cloudflare-worker-<project>
git init
```

**wrangler.toml**：
```toml
name = "<project>-line-security"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<從 Cloudflare dashboard 取得>"

[vars]
OPENCLAW_GATEWAY_URL = "https://openclaw.brt1122.com"
RATE_LIMIT_WINDOW_SECONDS = "60"
RATE_LIMIT_MAX_REQUESTS = "7"
RATE_LIMIT_DAILY_MAX = "500"
RATE_LIMIT_MAX_MESSAGE_LENGTH = "2000"
```

**src/kb-content.ts**：複製雞味客服版本（45 KB entries + fuzzy + synonyms）

```bash
# 複製 Worker src/ 結構（kb-content.ts + synonyms.ts + index.ts）
cp -r ~/openclaw-workspace/external-user/cloudflare-worker/src/ .
```

**部署**：
```bash
# 設定 secrets
echo "<LINE_BOT_TOKEN>" | wrangler secret put LINE_BOT_TOKEN
echo "<LINE_CHANNEL_SECRET>" | wrangler secret put LINE_CHANNEL_SECRET

# Deploy
wrangler deploy
# 記下 Worker URL: https://<project>-line-security.<account>.workers.dev
```

---

### Step 5：建立 GitHub repo + 設 remote

```bash
# 在 GitHub 創建 repo（透過 gh CLI）
gh repo create kaden1122123/<project_name> --private --description "<專案描述>"

# 設定 remote（用 gh token 避免 fatal: could not read Username）
git remote add origin https://x-access-token:$(gh auth token)@github.com/kaden1122123/<project_name>.git

# 第一次 push
git add -A
git commit -m "feat: initial scaffold"
git push -u origin main
```

---

### Step 6：建立 main mirror（sync dev → mirror）

```bash
# 第一次設定 mirror
mkdir -p ~/.openclaw/workspace-external-user/projects/<project_name>
chmod u+w ~/.openclaw/workspace-external-user/projects/<project_name>  # 暫時 writable

# 從 dev repo rsync 到 mirror
cd ~/openclaw-workspace/others/<project_name>
bash scripts/sync-mirror.sh from-legacy

# 強制 mirror chmod 555
bash scripts/main-enforce-readonly.sh
```

**scripts/sync-mirror.sh** 範本（直接複製雞味客服版本）：

```bash
#!/bin/bash
# ... (見 chicken-group-buying-customer-service/scripts/sync-mirror.sh)
```

---

### Step 7：建立 production runtime（sync canonical files）

```bash
# 第一次建立 production runtime 目錄
mkdir -p ~/.openclaw/agents/<agent_name>/knowledge

# 同步 canonical files
cd ~/openclaw-workspace/others/<project_name>
bash scripts/sync-canonical.sh
```

**scripts/sync-canonical.sh** 範本（直接複製雞味客服版本）：

```bash
#!/bin/bash
# 同步 docs/production-prompt/<version>/ → ~/.openclaw/agents/<agent_name>/
# AGENTS.md 加 14 行 CANONICAL 標頭（提醒「這是 production runtime」）
# ... (見 chicken-group-buying-customer-service/scripts/sync-canonical.sh)
```

---

### Step 8：建立 secrets（mode 600）

```bash
mkdir -p ~/.config/<project_name>/secrets
chmod 700 ~/.config/<project_name>/secrets

# 寫 secrets
echo "<LINE_BOT_TOKEN>" > ~/.config/<project_name>/secrets/line-bot-token
echo "<DASHBOARD_PWD>" > ~/.config/<project_name>/secrets/dashboard-pwd
echo "<API_PWD>" > ~/.config/<project_name>/secrets/api-pwd
echo "<API_TOKEN>" > ~/.config/<project_name>/secrets/api-token

chmod 600 ~/.config/<project_name>/secrets/*
```

---

### Step 9：建立 KB 內容（knowledge/tenants/<tenant>/）

複製雞味客服的 12 個 KB 檔（01_product.md ~ 12_reply_examples.md + INDEX.md）：

```bash
mkdir -p knowledge/tenants/<tenant>
cp -r ~/openclaw-workspace/others/chicken-group-buying-customer-service/knowledge/tenants/chicken/* \
      knowledge/tenants/<tenant>/
```

**修改每個檔案**：
- 替換客戶特定資訊（產品、價格、地址、配送範圍等）
- 保留 SOP 規則（轉真人 14 種、回覆範本 4 種）

---

### Step 10：建立 production runtime 啟動腳本

```bash
# 啟動 api-server（port 3001）
nohup env \
  API_USERNAME=api-user \
  API_PASSWORD_FILE=~/.config/<project_name>/secrets/api-pwd \
  X_API_TOKEN_FILE=~/.config/<project_name>/secrets/api-token \
  PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown

# 啟動 dashboard-server（port 3000）
nohup env \
  DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD_FILE=~/.config/<project_name>/secrets/dashboard-pwd \
  API_USERNAME=api-user \
  API_PASSWORD_FILE=~/.config/<project_name>/secrets/api-pwd \
  WORKER_HEALTH_URL=https://<project>-line-security.<account>.workers.dev/api/knowledge/stats \
  PORT=3000 \
  node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown
```

---

### Step 11：LINE Bot Channel 設定

#### 11.1 在 LINE Developer Console 建立 Channel

1. 登入 https://developers.line.biz/console/
2. 建立 Provider（如：「客戶名稱」）
3. 建立 Channel → Messaging API
4. 填寫 Channel 資訊
5. 取得：
   - Channel access token (long-lived)
   - Channel secret

#### 11.2 設定 Webhook

1. Channel → Messaging API → Webhook settings
2. Webhook URL: `https://<project>-line-security.<account>.workers.dev/webhook`
3. 啟用 Webhook
4. 關閉「Auto-reply messages」

#### 11.3 設定 Cloudflare Worker secrets

```bash
cd ~/openclaw-workspace/external-user/cloudflare-worker-<project>
echo "<LINE_BOT_TOKEN>" | wrangler secret put LINE_BOT_TOKEN
echo "<LINE_CHANNEL_SECRET>" | wrangler secret put LINE_CHANNEL_SECRET
```

---

### Step 12：建立 OpenClaw cron jobs

參考雞味客服的 cron jobs：

```bash
# 每日備份（每天 02:00）
openclaw cron add \
  --name "<project> 每日 backup" \
  --schedule "cron 0 2 * * *" \
  --tz Asia/Taipei \
  --agent-id agent:main:discord:channel:<project>_channel \
  --payload agentTurn \
  --message "bash ~/openclaw-workspace/others/<project>/scripts/backup.sh" \
  --delivery-mode announce \
  --delivery-channel discord \
  --delivery-to "channel:<project>_channel"

# 雲端清理（每小時）
# main enforce readonly（每 10 分鐘）
# ... 參考雞味客服現有 cron jobs
```

---

### Step 13：建立監控 + 健康檢查

#### 13.1 Health check 設定

```bash
# Dashboard tunnel（用 Cloudflare Named Tunnel 固定 URL）
cloudflared tunnel route dns <tunnel_name> dashboard.<project>.com

# Dashboard URL: https://dashboard.<project>.com/healthz
# Worker URL: https://<project>-line-security.<account>.workers.dev/api/knowledge/stats
```

#### 13.2 Cron 健康檢查

```bash
# 每 10 分鐘跑 dashboard-watchdog.sh
openclaw cron add \
  --name "<project> dashboard watchdog" \
  --schedule "every 10m" \
  ...
```

---

### Step 14：建立 staging 環境（強烈建議）

```bash
# 建立 staging Worker
cd ~/openclaw-workspace/external-user/cloudflare-worker-<project>
cp wrangler.toml wrangler.staging.toml
# 改 wrangler.staging.toml 的 name = "<project>-line-security-staging"
# 建立 staging KV namespace
wrangler kv:namespace create RATE_LIMIT_KV --env staging
# 把 KV id 填到 wrangler.staging.toml
wrangler deploy --env staging
```

參考 `docs/STAGING.md` 完整流程。

---

### Step 15：建立狀態文件（防止 drift）

```bash
mkdir -p ~/.openclaw/workspace/memory
mkdir -p ~/.openclaw/workspace/.task-state
```

**~/.openclaw/workspace/HEARTBEAT.md**：cron jobs + 系統狀態
**~/.openclaw/workspace/memory/heartbeat-state.json**：JSON 格式狀態
**~/.openclaw/workspace/.task-state/active-tasks.md**：進行中的任務
**~/.openclaw/workspace/memory/<YYYY-MM-DD>.md**：每日 session summary

每個 session 結束前更新這些檔案。

---

### Step 16：建立 check-quality.sh 12 項品質檢查

直接複製雞味客服版本：

```bash
cp ~/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/check-quality.sh scripts/

# 第一次跑確認全綠
bash scripts/check-quality.sh
# 應 13 pass / 0 warn / 0 fail
```

包含的檢查：
1. npm test 全綠
2. 沒有 hardcode
3. 沒有 dead config
4. 真實訂單保護（6/13 + 6/16 還在）
5. 兩位置 rsync 一致
6. git working tree 乾淨
7. ESLint 0 errors
8. KB source of truth 驗證
9. config.yaml drift 預防
10. 雙位置關鍵檔案 md5 一致
11. Ignored Keywords 同步
12. production runtime canonical 對齊

---

### Step 17：建立 session-end SOP

直接複製 `docs/SESSION_END_SOP.md`：

```bash
cp ~/openclaw-workspace/others/chicken-group-buying-customer-service/docs/SESSION_END_SOP.md docs/
```

每次 session 結束前跑 7 步：
1. check-quality.sh 全綠
2. 更新 CHANGELOG.md
3. 更新 HANDOFF.md §5 待辦
4. 寫當日 memory/YYYY-MM-DD.md
5. 更新 SESSION_NEXT_PROMPT.md
6. git add + commit + push
7. sync-mirror.sh from-legacy

---

### Step 18：建立文件清單（docs/）

建議文件結構：

```
docs/
├── SPEC.md                       # 規格
├── HANDOFF.md                    # session 交接手冊
├── CHANGELOG.md                  # commit 級變更歷史
├── AGENT_PROJECT_SOP.md          # 這份文件（建新專案 SOP）
├── CEO_DECISION_GUIDE.md         # 給 CEO 看的決策指南
├── ENGINEERING_HANDBOOK.md       # 工程慣例
├── TESTING_GUIDE.md              # 測試 SOP
├── TESTING_TROUBLESHOOTING.md    # 測試時的問題反應
├── LINE_BOT_SETUP.md             # LINE bot 設定完整指南
├── SESSION_END_SOP.md            # session 結束 SOP
├── STAGING.md                    # Worker staging 環境 SOP
├── GCP_ROTATION_SOP.md           # GCP service account key rotate SOP
├── SYSTEM_AUDIT_<YYYY-MM-DD>.md  # 系統 audit 報告
└── handoff/sessions/
    ├── README.md
    └── SESSION_NEXT_PROMPT.md    # 下個 session 開局 prompt
```

---

## ✅ 完成清單

建完一個新 linebot 專案要完成這些：

- [ ] Step 0: 帳號 + 本機環境準備
- [ ] Step 1: src/ 目錄結構（從雞味客服複製）
- [ ] Step 2: config/tenants/<tenant>.yaml
- [ ] Step 3: docs/production-prompt/<version>/
- [ ] Step 4: Cloudflare Worker（含 KB content）
- [ ] Step 5: GitHub repo + remote
- [ ] Step 6: Main mirror + sync-mirror.sh
- [ ] Step 7: Production runtime + sync-canonical.sh
- [ ] Step 8: Secrets（mode 600）
- [ ] Step 9: KB 內容（從雞味客服複製 + 修改）
- [ ] Step 10: 啟動腳本（api-server + dashboard-server）
- [ ] Step 11: LINE Bot Channel + Webhook + Secrets
- [ ] Step 12: OpenClaw cron jobs
- [ ] Step 13: 監控 + 健康檢查
- [ ] Step 14: Staging 環境
- [ ] Step 15: 狀態文件（HEARTBEAT, heartbeat-state, active-tasks, memory/）
- [ ] Step 16: check-quality.sh 12 項
- [ ] Step 17: session-end SOP
- [ ] Step 18: docs/ 完整文件

---

## 📚 Reference：雞味客服

- **Repo**: https://github.com/kaden1122123/chicken-group-buying-customer-service
- **Worker**: https://github.com/kaden1122123/external-user-line-security
- **生產 URL**: https://external-user-line-security.kaden1122123.workers.dev
- **Dashboard**: https://dashboard.brt1122.com
- **建立時間**: 2026-03-20
- **狀態**: 生產中（Round 15+ 完成）

---

_本檔由 brtclaw 維護，作為新專案建置 SOP_
_最後更新：2026-07-24 18:50_
