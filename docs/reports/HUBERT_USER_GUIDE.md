# 雞味客服系統 — Hubert 使用指南（Round 34 起）

> **作者**：brtclaw（2026-08-01 14:36+）
> **適用對象**：Hubert（老闆，雞味研究所）
> **目的**：讓 Hubert 不用透過工程師就能操作日常運維
> **last_updated**：2026-08-01 14:36+

---

## 🎯 1 分鐘搞懂

雞味客服是 **LINE 官方帳號「雞味研究所」AI 客服系統**。客戶傳訊息 → AI 自動回覆（必要時轉真人給你）。

**你（Hubert）關心的 3 件事**：
1. **客戶有沒有順利下單** → 看 Dashboard
2. **AI 客服有沒有怪怪** → 看 production log
3. **異常時怎麼處理** → 這份 SOP

---

## 🖥️ 日常操作

### 看訂單 / 客戶互動

| 任務 | 怎麼做 |
|------|--------|
| 看今天訂單 | 開 https://dashboard.brt1122.com（admin / ChickenTest2026） |
| 標記已收款 | Dashboard 訂單 → 「✓ 已收款」按鈕 |
| 客戶請求轉真人 | 收到 Email 通知（Gmail：k.chang.8844@gmail.com） |
| 解除轉真人 | Dashboard 訂單 → 「解除轉真人」按鈕 |
| 上傳付款截圖 | Dashboard 訂單詳情 → 上傳圖片 |

**Dashboard 入口**：
- 網址：`https://dashboard.brt1122.com`
- 帳號：`admin`
- 密碼檔：`/home/clawuser/.config/chicken/secrets/dashboard-pwd`（mode 600）

---

### Email 通知（替代 LINE 節省額度）

從 Round 34 起，**所有老闆通知都改走 Email**，避免 LINE 月額度 500 限制。

| 通知類型 | 收件人 | 觸發情境 |
|----------|--------|----------|
| 客戶轉真人 | k.chang.8844@gmail.com | 客戶問 ALERT 關鍵字（退款/投訴/地址確認等） |
| B 方案自動建單成功 | k.chang.8844@gmail.com | 客戶確認訂單後自動寫入 CSV |
| B 方案自動建單失敗 | k.chang.8844@gmail.com | API 錯誤，需手動建單 |
| 系統通知 | k.chang.8844@gmail.com | background 任務異常 |

**Email 5 秒節流**：連續 Email 通知最少間隔 5 秒，避免被 Gmail 標記為 spam。

---

## 🔧 維運操作

### 環境驗證（5 步驟）

每個新 session 開始時跑：

```bash
# 1. 確認 git 狀態
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
git status --short
git log --oneline -5

# 2. 品質檢查（12 項）
bash scripts/check-quality.sh
# 預期：12 通過 / 0-2 警告 / 0 失敗

# 3. 跑全套測試
npm test
# 預期：51 套全綠

# 4. 三服務健康檢查
curl http://localhost:3000/healthz
# 預期：{"status":"ok","services":{"dashboard":"up","api_server":"up","worker":"up"}}

# 5. 確認 cron 同步
tail -3 /tmp/chicken-config-sync.log
```

### 重啟服務（當 src/config.js 改了）

```bash
# 永遠先 PID 檢查再用 kill 避免 self-kill
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
DASHPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/dashboard-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID" && sleep 2
[ -n "$DASHPID" ] && kill "$DASHPID" && sleep 2

# 啟動
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

nohup env DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  WORKER_HEALTH_URL=https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats \
  PORT=3000 node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

# 驗證
sleep 2 && curl http://localhost:3000/healthz
```

### 修改設定（雞味客服價格、開團日）

```bash
# 1. 改 chicken.yaml
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
vim config/tenants/chicken.yaml  # 改 open_dates / 價格 / 配送範圍

# 2. 同步到 config.yaml（legacy fallback）
bash scripts/sync-config.sh

# 3. 驗證
npm test

# 4. 1 分鐘內 cron 自動同步到 main mirror
sleep 60 && tail -3 /tmp/chicken-config-sync.log

# 5. commit
git add -A && git commit -m "config: ..." && git push
```

### 修改知識庫（產品資訊、FAQ）

```bash
# 1. 改 KB 檔案
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
vim knowledge/tenants/chicken/01_product.md  # 改品項、價格
# 或 02_order_flow.md / 03_payment.md / 06_faq.md 等

# 2. 驗證
bash scripts/verify-kb-sources.js

# 3. 同步 main mirror
bash scripts/sync-mirror.sh from-legacy

# 4. commit
git add -A && git commit -m "kb: ..." && git push
```

### 修改 production prompt（LLM 對話規則）

⚠️ **謹慎**：這會直接影響 AI 客服行為，且 main_idea.md 沒 hot-reload（須重啟 gateway）。

```bash
# 1. 改 main_idea.md
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
vim docs/production-prompt/2026-07-03/main_idea.md

# 2. 同步到 production runtime
bash scripts/sync-canonical.sh

# 3. ⚠️ 重啟 gateway（如果有效能問題）
# （通常 prompt 改完下次新 session 才會讀，不需要重啟）

# 4. commit
git add -A && git commit -m "prompt: ..." && git push
```

---

## 🆘 緊急處理

### 服務整體掛掉（/healthz 非 ok）

```bash
# 1. 立馬抓 log
tail -100 /tmp/api-server.log
tail -100 /tmp/dashboard-server.log

# 2. 常見 root cause
# - process 被 kill（自動 systemd 會重啟）
# - 磁碟滿（df -h /）
# - secrets 改壞（檢查 ~/.config/chicken/secrets/）

# 3. 重啟（見上面「重啟服務」）
```

### 客戶訊息沒回應

```bash
# 1. 確認 Worker 收到 webhook
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
wrangler tail

# 2. 確認 chicken.yaml 與 main_idea.md 對應
diff /home/clawuser/.openclaw/agents/external-user/knowledge/main_idea.md \
     docs/production-prompt/2026-07-03/main_idea.md

# 3. 重啟 api-server
```

### KB 誤判（客戶問 X 但 AI 回 Y）

```bash
# 1. 確認 KB 內容
cat knowledge/tenants/chicken/01_product.md  # 對應客戶問的類別

# 2. 加上新 keywords
grep "客戶問的關鍵字" knowledge/tenants/chicken/*.md

# 3. 重新跑 verify
bash scripts/verify-kb-sources.js

# 4. sync + commit
```

### 客戶回覆「還是有怪怪的」(客戶邏輯錯亂)

**已知問題**（Round 33 sanitize 沒根治）：
- 可能源自 Round 32-33 期間 chat log 污染
- 建議：告知客戶「請先刪除對話再開始新對話」
- 內部：翻 OpenClaw session 找 `Exec failed` 原始來源

---

## 📊 監控與日誌

### Cron Jobs（雞味客服）

| 頻率 | 任務 | 指令 |
|------|------|------|
| 每 10 分鐘 | main enforce readonly | `scripts/main-enforce-readonly.sh` |
| 每 1 小時 | cloudflared leaked cleanup | `scripts/cleanup-leaked-cloudflared.sh` |
| 每 1 分鐘 | config sync | `scripts/sync-producer-config.sh` |
| 每日 02:00 | 備份 | `scripts/backup.sh` |
| 每日 03:00 | Google Sheets 同步 | `scripts/sheets-sync-cron.js` |
| 每日 23:30 | 日報彙總 | `scripts/send-digest.js` |
| 週日 10:00 | 週報彙總 | `scripts/send-digest.js` |
| 每月 1 號 09:00 | GCP key age check | `scripts/key_age_check.sh` |

### Log 位置

```bash
# API server
tail -200 /tmp/api-server.log

# Dashboard server
tail -200 /tmp/dashboard-server.log

# Config sync
tail -30 /tmp/chicken-config-sync.log

# Cloudflare Worker（即時）
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
wrangler tail
```

### 訂單資料

```bash
# 真實訂單（6/13 + 6/16 保護不能刪）
ls data/orders/chicken/2026-06-1{3,6}.csv

# 今日訂單
ls data/orders/chicken/$(date '+%Y-%m-%d').csv
```

---

## 🔐 安全注意事項

1. **永遠不要把 secrets commit 到 git**（LINE token / API token / 密碼）
2. **不要用 `pkill -f`**（會 self-kill）— 用 `kill <PID>`
3. **不要在 Dashboard 看到客戶真實個資後截圖**（除非必要）
4. **每次改 `src/` 後跑 `npm test` 確保沒破壞**
5. **每月 1 號提醒**：`scripts/key_age_check.sh` 檢查 GCP key 是否過期

---

## 📞 重大問題找誰

| 問題 | 聯絡 |
|------|------|
| LINE Bot 沒回應 | 通知工程師（brtclaw） |
| Dashboard 看不到訂單 | 重啟 dashboard-server |
| 客戶個資外洩 | **立即**通知 Hubert + 改 secrets |
| 系統檔案損壞 | git checkout 對應 commit |
| 想要新功能 | 討論後由 brtclaw 規劃實作 |

---

## 🔗 速查連結

| 服務 | URL |
|------|-----|
| Dashboard | https://dashboard.brt1122.com |
| Worker prod | https://external-user-line-security.kaden1122123.workers.dev |
| Worker staging | https://external-user-line-security-staging.kaden1122123.workers.dev |
| LINE 官方帳號 | 雞味研究所 |
| Google Sheets | （Dashboard 內可達） |
| Gmail | k.chang.8844@gmail.com |

---

## 📚 必讀文件（給接手 brtclaw session）

| 順序 | 文件 | 用途 |
|------|------|------|
| 1 | `NEW_SESSION_README.md` | 10 分鐘上手（單一入口）|
| 2 | `docs/OPERATIONS.md` | 部署、secrets、staging SOP |
| 3 | `docs/DEVELOPMENT.md` | 測試 + 開發 + troubleshooting |
| 4 | `docs/adr/0001-0005.md` | 5 個架構決策 |
| 5 | `docs/handoff/ARCHITECTURE_CURRENT_STATE_<DATE>.md` | 最新架構（每次看最新）|

---

## 🚀 升級與擴充

### 加新的驗證規則
1. 新增 `src/rules/<name>Rule.js`
2. 在 `src/rules/index.js` 加呼叫
3. 寫測試 `tests/<name>-rule.test.js`
4. 更新 `docs/CEO_DECISION_GUIDE.md`

### 加新的客戶標籤
- 改 `scripts/customer-tags.js` 的 5 類 23 規則
- 跑測試 `npm test`

### 加新的狀態（例：待補款）
1. 在 `src/states/stateMachine.js` 加 `STATES.AWAITING_TOPUP`
2. 新增 `src/states/awaitingTopup.js`
3. 在 `src/index.js` switch 加 case
4. 加 CSV 欄位（如果需要）
5. 寫測試

### 加新的 LINE bot 客戶（多租戶）
- 詳見 `docs/AGENT_PROJECT_SOP.md`（建新 linebot 完整 SOP）
- 注意：`AGENT_PROJECT_SOP.md` 主要給 brtclaw session 看，不是給 Hubert 日常操作

---

## 變更歷史

- **2026-08-01 14:36+（Round 34）**：首次建立（本檔取代舊的 MAIN_DIR_FILES.md）

---

_本檔由 brtclaw 維護，Hubert 日常操作優先看這份_
_對應內部接手：NEW_SESSION_README.md_
