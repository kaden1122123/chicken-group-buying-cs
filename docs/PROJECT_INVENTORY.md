# 雞味客服專案 — 系統目錄與檔案清單（2026-07-16）

> **用途**：未來 session 接手雞味客服工作時，第一份讀的文檔。包含所有路徑、檔案用途、3 層位置架構。
> **最後更新**：2026-07-16 03:00（commit `953da66` 之後）

---

## 1. 三層位置架構（必讀）

| 層級 | 路徑 | 角色 | 編輯權限 |
|------|------|------|----------|
| **本倉庫 source**（dev） | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | git tracked，single source of truth | ✅ 永遠在這編 |
| **主上線端**（production runtime，LLM 讀） | `/home/clawuser/.openclaw/agents/external-user/` | LLM 真的在這跑，AGENTS.md/SOUL.md/main_idea.md canonical | ❌ 不可直接編（Layer 1 chmod 555 物理擋） |
| **Main 鏡像**（dev 鏡像，services 跑） | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | sync-mirror 自動同步結果，services 在這啟動 | ❌ 不可直接編（chmod 555） |
| **GitHub remote** | `github.com/kaden1122123/chicken-group-buying-cs` | git remote | push only |

**編輯流程**（永遠）：

1. 在 dev repo 改檔
2. `bash scripts/check-quality.sh` 確認 10 checks 全綠
3. `git add -A && git commit && git push`
4. `bash scripts/sync-mirror.sh from-legacy` 同步到 main 鏡像
5. 重啟對應 services（如改 src/config.js → 重啟 api-server + dashboard）

---

## 2. 服務 port 與登入資訊

| 服務 | Port | 帳號 | 密碼檔（mode 600） | 用途 |
|------|------|------|------------------|------|
| **Dashboard** | 3000 | `admin` | `/tmp/dash-pwd` (15 chars) | 訂單管理、訂單建單、付款狀態（未來）|
| **api-server** | 3001 | `api-user` | `/tmp/api-pwd` (14 chars) | 給 Worker / B 方案呼叫 |
| **Line Bot Token** | — | — | `/tmp/line-bot-token` (待寫) | 給 notifier.js push LINE 給 Hubert |
| **Tailscale** | — | — | — | 100.114.197.9（你 PC + server 同一 mesh） |

啟動服務的範例指令（chmod 555 保護下，要 u+w 暫解 + 記得 u+w 改回）：

```bash
# dashboard
DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/tmp/dash-pwd PORT=3000 \
  nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown

# api-server
API_USERNAME=api-user API_PASSWORD_FILE=/tmp/api-pwd PORT=3001 \
  nohup node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown
```

---

## 3. dev repo 檔案總覽

### 3.1 核心 code

| 路徑 | 用途 | 備註 |
|------|------|------|
| `src/config.js` | 設定載入（YAML + env），含 LINE_BOT_TOKEN_FILE fallback | 修改需 sync + 重啟 |
| `src/order/csvWriter.js` | 寫訂單到 CSV（writeOrderWithRetry 含 retry 邏輯）| |
| `src/order/csvReader.js` | 讀訂單（getOrdersByDate、getRecentOrders）| |
| `src/rules/*.js` | 業務規則引擎（addressRule、dateRule、paymentRule 等）| 7 個 rule |
| `src/states/*.js` | 訂單狀態機（idle/awaitingInfo/awaitingPayment/completed）| 4 個 state |
| `src/handoff/notifier.js` | 推 LINE 通知給 Hubert（notifyHubert、testNotification）| LINE_BOT_TOKEN 來源 |
| `src/utils/logger.js` | 結構化 logging（Session K 新增）| |
| `src/utils/lineProfileCache.js` | LINE 用戶 profile 快取 | |
| `src/middleware/whitelist.js` | 測試期間白名單機制 | |
| `src/knowledge/triggers.js` | 14 種觸發關鍵字（退款、改單等）| |
| `src/index.js` | 主 entry，customer reply handler | |

### 3.2 Scripts

| 路徑 | 用途 | 啟動頻率 |
|------|------|----------|
| `scripts/api-server.js` | HTTP API server（port 3001）| nohup |
| `scripts/dashboard-server.js` | Dashboard + admin server（port 3000）| nohup |
| `scripts/cleanup-test-orders.js` | 清測試訂單（保護 6/13 + 6/16 真實）| 手動或 cron |
| `scripts/sync-config.sh` | 單向 mirror chicken.yaml → config.yaml | 每次改 chicken.yaml 後跑 |
| `scripts/sync-mirror.sh` | dev → main 鏡像同步（rsync）| commit + push 後 |
| `scripts/check-quality.sh` | 10 項品質檢查（Check 1-10）| commit 前必跑 |
| `scripts/manage-tunnel.sh` | Cloudflare Quick Tunnel 管理 | 啟動 / 停 / 查 / 測 |
| `scripts/dashboard-watchdog.sh` | 透過 /healthz 監控 dashboard | cron `36d2ca19` |
| `scripts/backup.sh` | 每日備份（22K, 7 天 retention）| cron `bd933551` |
| `scripts/verify-kb-sources.js` | KB 12 檔 single-source-of-truth 驗證 | Check 8 |
| `scripts/main-enforce-readonly.sh` | re-apply chmod 555 防 drift | cron `3bade756` |
| `scripts/check-cwd.sh` | pre-edit guard（main 位置警告）| 手動 / Claude Code hooks |
| `scripts/dashboard-watchdog.sh` | — | — |

### 3.3 Config

| 路徑 | 用途 | 編輯策略 |
|------|------|----------|
| `config/tenants/chicken.yaml` | **source of truth**（LLM 讀、api-server 讀）| 永遠改這，sync 推 mirror |
| `config.yaml` | legacy fallback（auto mirror）| 不直接編 |
| `.env.example` | 環境變數範例（30 個 vars）| — |

### 3.4 Tests

`tests/*.test.js` — 49 套 unit test + 1 套 integration。`npm test` 跑全部。Check 1 in check-quality.sh 跑 `npm test`。

### 3.5 Docs

| 路徑 | 用途 |
|------|------|
| `HANDOFF.md` | 當前狀態 + 1-10 區塊（含待修整清單）|
| `CHANGELOG.md` | commit 級變更歷史 |
| `docs/INDEX.md` | 文檔總索引 |
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策 |
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例（含 §6.6 三層位置） |
| `docs/API_CURL.md` | api-server curl 範例 |
| `docs/MULTI_TENANT_DESIGN.md` | multi-tenant 設計 |
| `docs/KNOWN_ISSUES.md` | 已知問題 |
| `docs/CLEANUP_PHASE_2_PLAN.md` | 之前清理計畫（已完成）|
| `docs/handoff/sessions/SESSION_X_PROMPT.md` | 13+ 個 session prompts（X1-X5、D3-D4、E、F、G、H、H8、I、J、K、L、M、N、O、P、Q）|
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | **下個 session 開始 prompt**（見本檔下個 section）|
| `docs/handoff/SESSION_CLEANUP_PROMPT_*.md` | Session B/C/D cleanup prompts |
| `docs/adr/*.md` | 5 個 Architecture Decision Records（0001-0005）|
| `docs/architecture/NEW_ORDER_FLOW.md` | A/B/C 方案訂單流程設計 |
| `docs/NOTES/2026-06-16-issues.md` | 6/16 實測問題紀錄 |
| `docs/production-prompt/2026-07-03/` | LLM prompt 當前版本（AGENTS/SOUL/main_idea/CHANGELOG）|

### 3.6 /tmp 的 chicken 服務檔（mode 600，永不 commit）

| 路徑 | 用途 | 寫入時機 |
|------|------|----------|
| `/tmp/dash-pwd` | dashboard 密碼（15 chars）| 重啟 dashboard 時驗證 |
| `/tmp/api-pwd` | api-server 密碼（14 chars）| 重啟 api-server 時驗證 |
| `/tmp/line-bot-token` | **待寫**（Hubert 手動加 LINE_BOT_TOKEN）| 重啟 api-server 時驗證 |
| `/tmp/dashboard-server.log` | dashboard 啟動 log | 自動 |
| `/tmp/api-server.log` | api-server 啟動 log | 自動 |

---

## 4. Cron Jobs（OpenClaw 與系統層）

| Cron Job | ID | 頻率 | 觸發指令 | 健康度 |
|----------|------|------|----------|--------|
| **雞味客服 dashboard watchdog** | `36d2ca19` | 每 10 分鐘 | `bash scripts/dashboard-watchdog.sh` | ✅ 02:00 報健康 |
| **雞味客服每日 backup** | `bd933551` | 每日 02:00 | `bash scripts/backup.sh` | ✅ 22K 27 檔 0 異常 |
| **雞味客服 main enforce readonly** | `3bade756` | 每 10 分鐘 | `bash scripts/main-enforce-readonly.sh` | ✅ Layer 2 防漂移 |

新增 cron 範例：
```bash
# 用 openclaw cron add
```

---

## 5. 3 層 Enforcement 設計（防 dual-location confusion）

設計目的：未來 session 即使不讀 HANDOFF.md，也被強制只能在 dev repo 編輯。

| 層 | 機制 | 強度 | 失效場景 |
|----|------|------|----------|
| **Layer 1** | `chmod 555` 給 main 鏡像的 critical files（dashboard-server.js、api-server.js、check-quality.sh、check-cwd.sh、manage-tunnel.sh + src/ + docs/）| 物理 | agent 跑 `chmod u+w` 自己改回 → 但 Layer 2 自動 revert |
| **Layer 2** | `scripts/main-enforce-readonly.sh` cron（3bade756）每 10 分鐘 re-apply 555 | 自動 | 改權限後 10 分鐘內 revert |
| **Layer 3** | `scripts/check-quality.sh` Check 10（md5 一致性）+ `scripts/check-cwd.sh`（pre-edit guard）| 偵測 | 兩個都失效，dev/main 會漂移（Check 10 警告） |

**sync-mirror.sh 需要 chmod dance**（auto-undo + restore 555，否則 sync 會 fail 寫不進 main）：

```bash
# 在 sync-mirror.sh 內或手動 sync 之前
chmod u+w main/scripts/*.js main/src/  # 暫解
rsync ...  # 同步
chmod 555 main/scripts/*.js main/src/  # restore
```

---

## 6. Tailscale 跨機訪問

| 端點 | IP | 用途 |
|------|------|------|
| Dashboard | `http://100.114.197.9:3000/admin` | 你 PC 開瀏覽器看訂單 |
| api-server | `http://100.114.197.9:3001/api/health` | healthz（dashboard ping 用）|
| SSH | `ssh clawuser@100.114.197.9` | 維護入口（同網可改用 192.168.0.104）|

**Tailscale 是 mesh 網路** — 從任何登入同帳號的裝置都能直接訪問 100.114.197.9，不用 SSH tunnel（Option 2 已廢）。

---

## 7. GitHub / Git Workflow

- **Remote**: `github.com/kaden1122123/chicken-group-buying-cs`
- **Branch**: `main`（單一分支）
- **Commit style**: `type(scope): subject`（e.g., `fix(dashboard): P1 LINE_BOT_TOKEN_FILE 支援`）
- **MEMORY.md §I-1 SOP**: git add -A → status --short → diff --cached --stat → commit → show --stat → push

---

## 8. 目前進度（2026-07-16 03:00 狀態）

| 項目 | 狀態 |
|------|------|
| Production runtime 對齊（AGENTS/SOUL/main_idea.md md5）| ✅ |
| 測試套件 | ✅ 49 套全綠 |
| 品質檢查 | ✅ 10 通過 / 0 警告 / 0 失敗 |
| Dashboard 服務 | ✅ 跑中（port 3000）|
| api-server 服務 | ✅ 跑中（port 3001）|
| Worker Cloudflare | ❌ 404（healthz degraded，但不擋 line bot 對話）|
| 89 leaked cloudflared processes | ⚠️ 可選清理 |
| 老闆 LINE 通知 | ❌ **LINE_BOT_TOKEN 還沒設**（Hubert 03:14 說要手動加）|

---

## 9. 待修整清單（下階段工作）

見 `HANDOFF.md` 第 5 節「待修整清單」與 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`。
