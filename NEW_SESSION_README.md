# 雞味客服 — New Session 必讀手冊

> **作者**：brtclaw（2026-08-01 13:50+ 首次建立）
> **last_updated**：2026-08-01 13:50+
> **目的**：接手雞味客服專案的新 brtclaw session 必讀（10 分鐘上手）
> **目標讀者**：接手雞味客服工作的下一個 brtclaw session

---

## 1. 5 分鐘上手

### 1.1 環境驗證 5 步驟

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# 1. 確認 git 狀態
git status --short && git log --oneline -5

# 2. 品質檢查（12 項）
bash scripts/check-quality.sh
# 預期：12 通過 / 0-2 警告 / 0 失敗

# 3. 跑全套測試
npm test
# 預期：51 個 .test.js 全綠 / 0 fail（Round 35 驗證）

# 4. 三服務健康檢查
curl http://localhost:3000/healthz
# 預期：{"status":"ok","services":{"dashboard":"up","api_server":"up","worker":"up"}}

# 5. 確認 cron 同步
tail -3 /tmp/chicken-config-sync.log
```

### 1.2 關鍵 ID 速查

| 用途 | 數值 |
|------|------|
| Dev repo（L1 source of truth）| `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| Main mirror（L2 services 跑）| `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |
| Production runtime（L3 LLM 讀）| `~/.openclaw/agents/external-user/` |
| Worker repo | `~/openclaw-workspace/external-user/cloudflare-worker/` |
| Worker prod URL | `https://external-user-line-security.kaden1122123.workers.dev` |
| Worker staging URL | `https://external-user-line-security-staging.kaden1122123.workers.dev` |
| Dashboard URL | `https://dashboard.brt1122.com` |
| 老闆 LINE ID | `Uf56650056d35626deb64165926a26182` |
| 客戶 ID | `U13921951a8873b3e84412a9c14a22c9a` |

---

## 2. 系統地圖

### 2.1 3 層位置架構（必理解）

```
┌──────────────────────────────────────────────────────┐
│ L1: Dev repo (本倉庫 source of truth)                │
│ • git tracked, 永遠在這編輯                          │
│ • chmod 555 保護 L2                                    │
└──────────────────────────────────────────────────────┘
              ↑ sync-{canonical,config,mirror,producer-config}
┌──────────────────────────────────────────────────────┐
│ L2: Main mirror (services 跑的位置)                  │
│ • api-server (3001) + dashboard-server (3000)         │
│ • chmod 555 保護                                       │
└──────────────────────────────────────────────────────┘
              ↑ LLM 真的讀這裡
┌──────────────────────────────────────────────────────┐
│ L3: Production runtime (~/.openclaw/agents/external-user/) │
│ • AGENTS.md / SOUL.md / main_idea.md (canonical)    │
│ • chattr +i 保護（Layer 1 + cron 自動 revert Layer 2）│
└──────────────────────────────────────────────────────┘
              ↑ 但 sync-canonical.sh 需 Layer 3 check-cwd.sh
             ← 永遠在 L1 編輯 → sync 推到 L2 → L3 自動 sync
```

**為何 3 層**（見 ADR-0002/0003）：
- Git 隔離：原位置是 git，主位置不帶 `.git` 歷史
- Secrets 隔離：主位置 `.env` 不進 git
- 私人物料隔離：Hubert 個人資料夾保留在原位置

### 2.2 核心資料流

```
客戶 (LINE)
   ↓ webhook POST
[Cloudflare Worker]
   • 過濾、rate limit、sanitize
   ↓ POST HTTPS
[OpenClaw Gateway :18789]
   ↓ process
[Chicken repo / LLM]
   • state machine + KB + rules
   ↓ 回覆
[→ Worker → LINE]
```

### 2.3 程式碼結構

```
src/
├── index.js                # LINE webhook 入口
├── config.js               # YAML 設定載入（chicken.yaml）
├── states/                 # 狀態機（idle/awaitingInfo/awaitingPayment/...）
├── rules/                  # 驗證規則（address/date/menu/payment/...）
├── order/                  # CSV 寫讀 + 訂單格式化
├── handoff/                # 轉真人 + 通知（notifier/emailNotifier/autoOrder）
├── knowledge/              # KB loader + triggers
├── middleware/             # whitelist
├── utils/                  # logger/sanitizer/lineReply/timeUtils
└── storage/                # Google Sheets 同步
```

### 2.4 知識庫結構（12 個 KB 檔案）

```
knowledge/tenants/chicken/
├── 01_product.md            # 產品（雞肉品項、價格）
├── 02_order_flow.md         # 訂單流程
├── 03_payment.md            # 付款方式
├── 04_delivery.md           # 配送規則
├── 05_promotion.md          # 促銷
├── 06_faq.md                # FAQ
├── 07_transfer_rules.md     # 14 種轉真人條件
├── 08_owner_info.md         # 老闆資訊（敏感）
├── 09_order_standard.md     # 訂單整理標準
├── 10_customer_tags.md      # 客戶標籤
├── 11_lead_followup.md      # 潛客跟進
└── 12_reply_examples.md     # 回覆範本
```

---

## 3. 必讀文件（按重要性）

### 3.1 必讀（5 個 · 30 分鐘）

| # | 檔案 | 用途 |
|---|------|------|
| 1 | `NEW_SESSION_README.md`（本檔）| 10 分鐘上手 + 系統地圖 |
| 2 | `docs/OPERATIONS.md` | 部署、secrets、staging、換 LINE bot SOP |
| 3 | `docs/DEVELOPMENT.md` | 測試 + 開發 + troubleshooting |
| 4 | `docs/adr/0001-0005.md` | 5 個架構決策 |
| 5 | `docs/handoff/ARCHITECTURE_CURRENT_STATE_<DATE>.md` | 最新架構 |

### 3.2 參考（按需讀）

| 檔案 | 用途 |
|------|------|
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例（30 分鐘 overview）|
| `docs/PROJECT_INVENTORY.md` | 完整系統地圖（17 KB）|
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策（CEO 視角）|
| `docs/KNOWN_ISSUES.md` | 已知問題 |
| `docs/SESSION_END_SOP.md` | Session 結束 SOP |
| `docs/handoff/rounds/ROUND_*.md` | 特定 round 紀錄（最近 9 個）|

### 3.3 接手者必跳過（LEGACY · 已併入本檔或歸檔）

- `HANDOFF.md`（已 stale 2026-07-25，內容已併入本檔）
- `docs/architecture/NEW_ORDER_FLOW.md`（舊架構，已被 ARCHITECTURE_CURRENT_STATE 取代）
- `docs/INTERNAL_MODULES.md`（內容簡單，已併入 README）
- `docs/CLI_TOOLS.md`（內容簡單，已併入 README）
- `docs/MAIN_DIR_FILES.md`（內容簡單，已併入 README）
- `docs/AGENT_PROJECT_SOP.md`（建新專案 SOP，與接手雞味客服無關）
- `MIGRATION_HISTORY.md`（歷史紀錄，git 已有）
- `docs/.archive/`（整個目錄，已歸檔 22 個 session + 12 個歷史 PLAN）

---

## 4. 開始工作

### 4.1 常見任務 flow

**改 bug**：
```bash
1. 改 src/ 程式碼
2. npm test 通過
3. bash scripts/check-quality.sh 12 通過
4. git add -A && commit && push
5. bash scripts/sync-mirror.sh from-legacy（同步 main mirror）
```

**改 KB**：
```bash
1. 改 knowledge/tenants/chicken/*.md
2. bash scripts/verify-kb-sources.js（驗證）
3. bash scripts/check-quality.sh（包含 Check 8 驗證）
4. git add -A && commit && push
```

**改 production prompt (LLM 看的)**：
```bash
1. 改 docs/production-prompt/2026-07-03/main_idea.md
2. bash scripts/sync-canonical.sh（同步到 production runtime）
3. ⚠️ main_idea.md 沒 hot-reload（修改後需重啟 gateway）
4. git add -A && commit && push
```

**改設定**：
```bash
1. 改 config/tenants/chicken.yaml
2. bash scripts/sync-config.sh（同步到 config.yaml）
3. ⚠️ chicken.yaml 改後 1 分鐘 cron 自動同步到 main mirror
4. git add -A && commit && push
```

**重啟服務**：
```bash
# 永遠先 PID 檢查再用 kill 避免 self-kill
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
DASHPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/dashboard-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID" && sleep 2
[ -n "$DASHPID" ] && kill "$DASHPID" && sleep 2

nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

nohup env DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  WORKER_HEALTH_URL=https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats \
  PORT=3000 node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

curl http://localhost:3000/healthz
```

### 4.2 Session 結束 SOP（必跑）

```bash
# 1. check-quality
bash scripts/check-quality.sh

# 2. CHANGELOG.md + .openclaw-internal/ 更新
# 3. git add -A + commit + push（按 MEMORY.md §I-1 SOP）
git add -A && git status --short && git diff --cached --stat && git commit -m "..." && git show HEAD --stat && git push

# 4. 同步 main mirror
bash scripts/sync-mirror.sh from-legacy

# 5. 寫 memory/YYYY-MM-DD.md
```

完整 SOP：見 `docs/SESSION_END_SOP.md`。

---

## 5. 已知問題（2026-08-01 13:50+ 狀態）

### 5.1 仍在調查

| 問題 | 症狀 | 推測 root cause | 處理 |
|------|------|----------------|------|
| 客戶「客服邏輯錯亂」 | 客戶回報回覆邏輯錯亂 | 可能源自 Round 32-33 期間 chat log 污染（sanitize 只能防未來）| 從 OpenClaw session 重建客戶 context |
| `Exec failed` 原始來源 | grep 全 src/ 找不到 | 推測 OpenClaw pipeline 底層某個 tool 失敗漏訊息 | 翻 OpenClaw source |
| main_idea.md drift | Check 11 警告 | production runtime 改但 docs/production-prompt/ 沒跟 | 重新 sync-canonical |

### 5.2 已修，觀察中（Round 33）

| 修法 | 檔案 | 驗證方式 |
|------|------|---------|
| Bug 1（測試用戶通知走 Gmail）| `src/handoff/notifier.js` + `autoOrder.js` | 等下次測試用戶通知確認只走 Gmail |
| Bug 2（兩週開團日）| `src/rules/dateRule.js` + main_idea.md | 等客戶問開團日時 LLM 主動列出 |
| Bug 3（sanitize outbound）| `src/utils/lineReply.js` | 觀察客戶回報是否還有「怪怪的」 |

### 5.3 已知風險

- main_idea.md 沒有 hot-reload（修改後需重啟 gateway）
- 雙 chicken.yaml 同步風險（cron 已加，逆向覆寫風險仍存）
- sessions/ 累積 16384 entries（建議 prune 但不阻擋）

---

## 6. 架構決策速查（必讀 ADR）

| ADR | 主題 | 為何重要 |
|-----|------|---------|
| 0001 | src/ 不是 production runtime | 接手者最容易搞錯 |
| 0002 | 雙位置架構（原 + 主）| 看似 bug 是設計 |
| 0003 | config.yaml 是 legacy fallback | chicken.yaml 是 single source of truth |
| 0004 | MEMORY.md 用 L1/L2/L3 三層結構 | 控制 LLM context load |
| 0005 | Session-based 變更 + 每 Task 一 commit | 避免「一環遞迴」 |

---

## 7. 給接手者的提醒

1. **永遠在 L1 dev repo 編輯**，不在 L2 main mirror 或 L3 production runtime
2. **改 src/ 不直接影響 production**（production 真正運行的是 LLM agent + prompt）
3. **改 production prompt 需重啟 gateway**（沒 hot-reload）
4. **真實訂單 6/13 + 6/16 絕對不能刪**（git tracked 保護）
5. **commit 前必跑 3 個 SOP**（MEMORY.md §I-1/-2/-3）

---

## 變更歷史

- **2026-08-01 13:50+**：首次建立（取代 `HANDOFF.md` + `SESSION_NEXT_PROMPT.md` + `ARCHITECTURE_CURRENT_STATE_2026-08-01.md` 等多個交接文件單一入口）

---

_本檔由 brtclaw 維護，細心完整實踐，2026-08-01 首次建立_
