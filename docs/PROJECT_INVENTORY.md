# 雞味客服專案 — 系統目錄與檔案清單

> **最後更新**：2026-07-18 08:10（commit 3fbe06c 之後 — Gmail 整合完整鏈 + 4 cron jobs + P4/P6 邏輯測試）

## 🎯 用途（Purpose）

此檔是**雞味客服專案的系統地圖**。功能目的：
1. 讓接手者**快速找到任何檔案**（不用 `find` 整個 codebase）
2. 標明**每個檔案的角色**（不只是路徑，還有「為什麼存在」）
3. 區分**3 層位置架構**（dev repo / main mirror / production runtime）
4. 給非開發者（Hubert）**快速 reference**「哪個檔負責什麼」
5. 防止**未來 session 重複考古**（已整理的東西不需要再整理）

## 👥 讀者（Audience）

- **接手工作的 brtclaw session**（首要）
- **Hubert**（老闆）— 想知道「改某功能要動哪個檔」
- **未來 audit 的人** — 了解系統邊界

## 🛠 怎麼用（How to Use）

**找檔案**：用 grep -n 在對應的「### 3.x」段找路徑
**改檔案**：永遠改 dev repo 根（path # 1），不要改 main mirror 或 production runtime
**確認加密密碼**：看 §2「服務 port 與登入資訊」表
**確認 cron jobs**：看 §4

## 📚 參考的 Best Practices

| 來源 | 應用 |
|------|------|
| [session-handoff skill](https://github.com/softaworks/agent-toolkit) | **Zero ambiguity** — 每個檔案要有 purpose 說明 |
| [Project Handover Templates](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) | **Structured transfer** — 分門別類、表格化 |

---



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
| **Dashboard** | 3000 | `admin` | `/home/clawuser/.config/chicken/secrets/dashboard-pwd` (15 chars) | 訂單管理、訂單建單、付款狀態（已實作 ✓ 已收款按鈕）|
| **api-server** | 3001 | `api-user` | `/home/clawuser/.config/chicken/secrets/api-pwd` (14 chars) | 給 Worker / B 方案呼叫 |
| **Line Bot Token** | — | — | `/home/clawuser/.config/chicken/secrets/line-bot-token` (172 chars, d4b0d23 寫入) | 給 notifier.js push LINE 給 Hubert（2026-07-16 21:30 重新啟用）|
| **WORKER_HEALTH_URL** | — | — | 環境變數，`http://127.0.0.1:3001/api/health`（Round 3E 設）| 讓 dashboard /healthz worker=up |
| **Tailscale** | — | — | — | 100.114.197.9（你 PC + server 同一 mesh） |

啟動服務的範例指令（chmod 555 保護下，要 u+w 暫解 + 記得 u+w 改回）：

```bash
# dashboard
DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd PORT=3000 \
  nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown

# api-server
API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd PORT=3001 \
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
| ~~`docs/CLEANUP_PHASE_2_PLAN.md`~~ | **[LEGACY] 請勿 read（已標記，內容已由 CHANGELOG.md 取代）** |
| `docs/handoff/sessions/SESSION_X_PROMPT.md` | 13+ 個 session prompts（X1-X5、D3-D4、E、F、G、H、H8、I、J、K、L、M、N、O、P、Q）|
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | **下個 session 開始 prompt**（含接手者必跳過清單）|
| `docs/handoff/SESSION_CLEANUP_PROMPT_*.md` | Session B/C/D cleanup prompts |
| `docs/adr/*.md` | 5 個 Architecture Decision Records（0001-0005）|
| `docs/architecture/NEW_ORDER_FLOW.md` | A/B/C 方案訂單流程設計 |
| `docs/NOTES/2026-06-16-issues.md` | 6/16 實測問題紀錄 |
| `docs/production-prompt/2026-07-03/` | LLM prompt 當前版本（AGENTS/SOUL/main_idea/CHANGELOG）|
| `docs/SYSTEM_AUDIT_2026-07-19.md` | 完整 audit 報告（2026-07-19，含 Round 10 修整紀錄）|
| `docs/GCP_ROTATION_SOP.md` | GCP service account key 90 天 rotate SOP |

**⚠️ LEGACY 區塊**（已標記 `<!-- ⚠️ LEGACY -->` 開頭，接手者請勿 read 浪費 token）：
- `PHASE1_PROGRESS.md` — Phase 1 進度報告（6/7/3 最後更新）
- `docs/TODO_2026-06-26.md` — 評估與修整 TODO（6/26 最後更新）
- `docs/CLEANUP_PHASE_2_PLAN.md` — Cleanup Phase 2 修整計畫（6/28 最後更新）

**如果你要快速了解系統現狀**：直接讀 `CHANGELOG.md` + `HANDOFF.md` + `docs/SYSTEM_AUDIT_2026-07-19.md` 就夠了。

### 3.6 /tmp 的 chicken 服務檔（mode 600，永不 commit）

| 路徑 | 用途 | 寫入時機 |
|------|------|----------|
| `/home/clawuser/.config/chicken/secrets/dashboard-pwd` | dashboard 密碼（15 chars）| 重啟 dashboard 時驗證 |
| `/home/clawuser/.config/chicken/secrets/api-pwd` | api-server 密碼（14 chars）| 重啟 api-server 時驗證 |
| `/home/clawuser/.config/chicken/secrets/line-bot-token` | LINE channel access token (172 chars, d4b0d23 寫入) | 重啟 api-server 時驗證 |
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

## 8. 目前進度（2026-07-17 06:30 狀態）

| 項目 | 狀態 |
|------|------|
| Production runtime 對齊（AGENTS/SOUL/main_idea.md md5）| ✅ |
| 測試套件 | ✅ 49 套全綠 |
| 品質檢查 | ✅ 10 通過 / 0 警告 / 0 失敗 |
| Dashboard 服務 | ✅ 跑中（port 3000）|
| api-server 服務 | ✅ 跑中（port 3001）|
| Worker Cloudflare | ✅ 改 WORKER_HEALTH_URL 指向 api-server /api/health（Round 3E）|
| 89 leaked cloudflared processes | ✅ 04:55 Hubert 手動清理 |
| 老闆 LINE 通知 | ✅ **已啟用**（2026-07-16 21:30 + 2026-07-17 06:30 持續）|
| LINE push loop 防護 | ✅ HUMAN_HANDOFF guard + 1分鐘 debounce（c6438e8 + bbe6533）|
| P1 LINE_BOT_TOKEN | ✅ 修整完成（d4b0d23）|
| P2 方案 B | ✅ 實作完成（commit 0e2d29f）|
| P3 Quick Reply 意圖 | ✅ 實作完成（待 OpenClaw 渲染，commit fa0500d）|
| P4 街口支付傳圖片 | ✅ **完整 4 stages + 街口主動推 QR code**（commits 239dbf2/8d4f5dc/060ec7e/5c40664）|
| P5 付款狀態機制 | ✅ 實作完成（commits 18565aa + 854948a）|
| P6 OCR analyzer | ✅ 實作完成（commits fbfa2df + 2fd8aca，minimax vision 介面）|
| P7 訂單完整性規則 | ✅ 實作完成（commit 1380731）|
| P8 Dashboard 更新 | ✅ 已答（A 方案需老闆手動建單）|
| P9 Google Sheets sync | ✅ 實作完成 + 662 筆訂單寫入（commits d903098 + 057ed3e）|
| B 方案 auto-create-order | ✅ 實作完成（commits c67eca3 + 3e998c9 + 756b859 + a42e362）|
| LINE 月度額度 | ⚠️ 額滿（500/月用完，下個 reset = 2026-08-01）|
| **Gmail 整合（P0 v0-v7）**| ✅ **完整實作**（commits `ee04932` / `ea64832` / `b823dd7` / `1dc9b4d` / `6cc05a8` / `e512e0d` / `9911485` / `0484bba`）— OAuth loopback + 永遠 LINE+Email 並行 + 4 種版型 + 中文付款標籤 + 後續自動化腳本 |

---

## 9. 待修整清單（下階段工作）

見 `HANDOFF.md` 第 5 節「待修整清單」與 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`。

### 2026-07-19 03:36+ Round 10 修整後狀態

**已完成（commit `a4c2c36` / `e7bcac7` / 待本次 commit）**：
- ✅ H1: `scripts/manage-tunnel.sh start()` 帶完整 env + 用 `_FILE` 取代明文密碼
- ✅ H2: `scripts/check-quality.sh Check 10` 擴展 production runtime canonical drift 檢查
- ✅ 重要修正 1: `scripts/sync-canonical.sh` 新增 + 同步 production runtime（解決 12 天 drift）
- ✅ 重要修正 2: `docs/GCP_ROTATION_SOP.md` 新增
- ✅ 重要修正 3: `SESSION_H8_PROMPT.md` 狀態對齊（⏸ → ✅ + 4 commits 證據）
- ✅ check-quality: 11 通過 / 1 警告 / 0 失敗（從原本 9/3/0 大幅改善）

**仍待後續 session 處理（見 SYSTEM_AUDIT §6）**：
- L1: 攏長文件 archive（54 refs 跨檔、本 session 不實際 git mv）
- L2: production runtime .bak 清理（sync-canonical.sh 留下的 .bak.20260719-* 可清；原本 .bak.20260715 等保留為歷史）
- 統一測試 framework 到 `node:test`（48 個自訂 assert 風格）
- GCP service account key 實 rotate
- Cloudflare Worker DEPLOYMENT.md 更新（5/31 後沒更新）
