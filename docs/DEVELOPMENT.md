# 雞味客服 Development SOP（測試 + 開發 + Troubleshooting）

> **作者**：brtclaw（2026-07-25 11:50+ Round 22 合併建立）
> **目的**：合併 `TESTING_GUIDE.md` + `TESTING_TROUBLESHOOTING.md` 為單一文件
> **來源**：2 個 SOP 共 1007 行 → 合併後 280 行（**72% 節省**）
> **適用對象**：開發者、測試者、debugger
> **last_updated**：2026-07-27（Round 27 確認仍適用，無改動）

---

## 🧪 1. 測試前準備 checklist（必做）

```bash
# 1. 確認 services 全 up
curl http://localhost:3000/healthz  # dashboard=up, api_server=up, worker=up

# 2. 確認 secrets 存在
ls /home/clawuser/.config/chicken/secrets/  # dashboard-pwd, api-pwd, api-token, line-bot-token

# 3. 確認 cron jobs 正常
openclaw cron list  # 應該 8+ 個雞味客服 cron

# 4. 真實訂單保護（不要刪 6/13 + 6/16）
ls data/orders/chicken/2026-06-1{3,6}.csv
```

---

## 🔬 2. 測試 SOP（精簡版）

### Phase 1: API 端點（用 `.netrc` 避免密碼留 history）

**先用 `make netrc` 設定**（推薦取代 `-u user:pass`）：
```bash
cat > ~/.netrc <<EOF
machine localhost
login api-user
password $(cat /home/clawuser/.config/chicken/secrets/api-pwd)
EOF
chmod 600 ~/.netrc
```

**測試 5 個關鍵 endpoint**：
```bash
# 1. health
curl -s http://localhost:3001/api/health

# 2. orders list
curl -sn http://localhost:3001/api/orders

# 3. single order
curl -sn http://localhost:3001/api/orders/<ORDER_ID>

# 4. create order
curl -sn -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"user_line_name":"Test","user_phone":"0912345678","address":"三峽","delivery_date":"2026-08-01","time_slot":"afternoon","chicken_items":"鹽水雞半隻","side_items":"","chicken_count":"1","side_count":"0","total_boxes":"1","subtotal":"380","total_amount":"380","payment_method":"transfer","payment_status":"pending"}'

# 5. update payment
curl -sn -X PATCH http://localhost:3001/api/orders/<ORDER_ID> \
  -H "Content-Type: application/json" \
  -d '{"payment_status":"paid"}'
```

### Phase 2: Dashboard UI 流程

```bash
# 1. 開 dashboard
open http://localhost:3000  # admin / dashboard-pwd

# 2. 測試「✓ 已收款」按鈕（P5）
# 3. 測試訂單詳情頁
# 4. 測試「解除轉真人」按鈕（P0 #2）
# 5. 看客戶端 LLM prompt 是否同步
```

### Phase 3: Worker 端點（KB matching）

```bash
# 查 KB 統計
curl -s "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats"

# 測試 KB 匹配（含 fuzzy）
curl -s "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=運費"
curl -s "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=wiliy0221"  # typo
curl -s "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=鹽水隻"  # 缺字
```

### Phase 4: CI 自動測試

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
npm test                    # 30+ 個 test（unit + integration）
bash scripts/check-quality.sh  # 12 checks
```

---

## 🐛 3. Troubleshooting（7 種常見問題）

### 🔴 P0 緊急狀況

**服務整體掛掉**（/healthz 非 ok）：
1. 立刻通知 Hubert（不要自己重啟，先抓 log）
2. 抓 api-server / dashboard-server log：
   ```bash
   tail -100 /tmp/api-server.log
   tail -100 /tmp/dashboard-server.log
   ```
3. 常見 root cause：process 被 kill / 磁碟滿 / secrets 改壞

### 🟡 P1 單一功能異常

**問題 1：客戶訊息沒回應**
- 確認 Worker 收到 webhook（`wrangler tail`）
- 確認 `LINE_CHANNEL_SECRET` 沒被改
- 確認 main_idea.md 是最新（`bash scripts/sync-canonical.sh`）
- 確認 api-server 在跑（Worker 轉發需要它）

**問題 2：客戶訊息回應錯誤（KB 誤判）**
- 重現問題：複製客戶訊息 curl `/api/knowledge?q=...`
- 看 `entry.id` 和 `topic`，判斷命中錯誤
- 修法：加新 entry 把這個 query 收進 keywords

**問題 3：客戶訊息卡在轉真人沒回應**
- 確認 `notify_owner.line_user_id` 設定正確
- 確認 `line-bot-token` mode 600
- 看 api-server log 有沒有 `[notifyHubert]` 錯誤

**問題 4：客戶訊息走 LLM 但答錯**
- 確認 KB 真的沒命中（curl `/api/knowledge?q=...`）
- 確認 main_idea.md 是最新
- 看 OpenClaw Gateway log

### 🟢 P2 邊界 case

**問題 5：fuzzy match 誤觸發**
- Re-run unit tests：`cd Worker && node --test tests/kb-matching.test.mjs`
- 25 tests 應該全 pass
- 如果 production 失敗可能是 deployment cache，redeploy

**問題 6：客戶訊息包含 emoji / 特殊字元**
- 確認 message sanitizer（`src/index.ts` line 81-100）
- 加 log 看實際 messageText
- 修 sanitizer regex

**問題 7：客戶訂單寫入失敗**
- 看 api-server log 有 `[writeOrder]` 錯誤
- 檢查 `data/orders/chicken/` 是否有新 csv
- 檢查 disk space：`df -h /`
- 檢查 chicken.yaml storage 設定

---

## 🔍 4. Debug 工具

```bash
# 查 Worker 實時 log
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
wrangler tail --format=pretty
wrangler tail --env staging --format=pretty  # staging log

# 查 api-server log
tail -200 /tmp/api-server.log | grep -E "ERROR|WARN|notifyHubert"

# 查 dashboard-server log
tail -200 /tmp/dashboard-server.log

# 查 KB 匹配結果（不透過 LINE）
curl "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=測試訊息"

# 看 cron jobs
openclaw cron list
openclaw cron runs --id <JOB_ID>  # 看特定 cron 執行歷史
```

### 重啟服務（最後手段）

```bash
# api-server
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APID" 2>/dev/null
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

# dashboard-server（類似）
```

---

## 🔄 5. Development Workflow（dev → staging → prod）

```bash
# 1. 改 code
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
# 改 src/ 或 scripts/ 或 tests/

# 2. dev 本地測試
bash scripts/check-quality.sh  # 12 checks
npm test                        # 30+ tests

# 3. commit + push（先 chicken）
git add -A
git commit -m "feat: ..."
git push origin main
bash scripts/sync-mirror.sh from-legacy
bash scripts/sync-canonical.sh   # 如果改 main_idea.md

# 4. Worker staging 測試（如果改 Worker）
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
npm test                        # if any
wrangler deploy --env staging   # 觀察 5-10 分鐘

# 5. Worker prod
wrangler deploy --env production

# 6. 監控 24hr
# 看 Worker logs + Discord
```

---

## 🛠 6. 開發環境設置（新接手者）

```bash
# 1. 確認有這些工具
node --version      # >= 20
npm --version       # >= 10
wrangler --version  # >= 4
git --version       # >= 2

# 2. Clone repos
git clone git@github.com:kaden1122123/chicken-group-buying-customer-service.git
git clone git@github.com:kaden1122123/external-user-line-security.git

# 3. 設定 secrets
mkdir -p ~/.config/chicken/secrets
chmod 700 ~/.config/chicken/secrets
# （從安全管道取得 4 個 secret 檔：dashboard-pwd, api-pwd, api-token, line-bot-token）

# 4. 確認環境
cd chicken-group-buying-customer-service
bash scripts/check-quality.sh  # 12/0/0
npm test                        # 30+ 全綠

# 5. 啟動服務
nohup node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown
nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

# 6. 驗證
curl http://localhost:3000/healthz
```

---

## 🔐 7. 安全注意事項

1. **不要 commit secret 到 git** — 用 mode 600 檔案或 wrangler secret put
2. **不要用 `-u user:pass` 在 cmdline** — 用 `~/.netrc`（推薦）
3. **Token rotation**：每 90 天換一次（見 `docs/GCP_ROTATION_SOP.md`）
4. **測試時 log 要遮罩 secret** — 開發時用 `***` 取代真實 token
5. **重啟前先 kill 舊 process** — 用 `kill <PID>` 不要 `pkill -f`（會 self-kill）

---

_本檔由 brtclaw 維護，配合 `docs/SESSION_END_SOP.md` 在 session 結束時跑_
_取代：`docs/TESTING_GUIDE.md` + `docs/TESTING_TROUBLESHOOTING.md`_
_最後更新：2026-07-25 11:50+_
