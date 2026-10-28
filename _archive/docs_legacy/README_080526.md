# 雞味客服 (Chicken Customer Service)

> **LINE 官方帳號「雞味研究所」AI 客服系統** — Cloudflare Worker + OpenClaw Agent + Node.js 多層架構
> **last_updated**：2026-07-25（Round 26 — 連結修補、文件補齊）

[![Status](https://img.shields.io/badge/status-production-brightgreen)](#)
[![Node](https://img.shields.io/badge/node-22-blue)](.nvmrc)
[![Tests](https://img.shields.io/badge/tests-53%20passed-brightgreen)](tests/)
[![Lint](https://img.shields.io/badge/lint-0%20errors-brightgreen)](.eslintrc.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

---

## 📋 簡介

雞味客服是一個 LINE 官方帳號 AI 客服系統，使用 Cloudflare Worker（資安過濾）+ OpenClaw Agent（LLM 對話）+ Node.js（業務邏輯）的多層架構。提供：

- ✅ **自動訂單流程**（Quick Reply + A 方案 LLM 純文字）
- ✅ **多租戶支援**（chicken tenant，可擴展）
- ✅ **規則引擎**（rules — address / date / payment / timeSlot / price）
- ✅ **狀態機**（states — idle / awaitingInfo / awaitingPayment / completed）
- ✅ **Human handoff**（14 種觸發條件自動轉真人）
- ✅ **Email fallback**（LINE 月度額度 500/月用完時改走 Gmail API）
- ✅ **Google Sheets 同步**（P9 — 訂單自動寫入 spreadsheet）
- ✅ **Dashboard 管理後台**（admin UI + approve + mark-paid + receipt upload）

---

## 🛠 技術堆疊

| 層 | 技術 |
|----|------|
| Backend | Node.js 22 + 原生 HTTP |
| Dashboard | HTML + Vanilla JS |
| Webhook 資安 | Cloudflare Worker (TypeScript) + KV Rate Limit |
| AI Agent | OpenClaw `external-user` agent |
| LLM 模型 | minimax/MiniMax-M3 |
| Storage | CSV (orders) + JSON (config) + KV (rate limit) |
| Email | Gmail API（OAuth 2.0 Desktop loopback flow）|
| Spreadsheet | Google Sheets API（Service Account）|
| Tests | Node.js native `node:test` (5) + 自訂 assert (48) |

---

## 🏛 三層位置架構

> ⚠️ **必讀** — 這是雞味客服的核心架構設計

| 層級 | 路徑 | 角色 | 編輯權限 |
|------|------|------|----------|
| **Dev repo** | `~/openclaw-workspace/others/chicken-group-buying-customer-service/` | git tracked，single source of truth | ✅ **永遠在這編** |
| **Main 鏡像** | `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | services 跑的位置 | ❌ chmod 555 保護 |
| **Production runtime** | `~/.openclaw/agents/external-user/` | LLM 真的在這讀（AGENTS.md / SOUL.md / main_idea.md）| ❌ Layer 1 chattr +i |

**編輯流程**：
```bash
# 1. 在 dev repo 改檔
# 2. 跑品質檢查
bash scripts/check-quality.sh
# 3. commit + push
git add -A && git commit && git push
# 4. 同步到 main 鏡像
bash scripts/sync-mirror.sh from-legacy
# 5. 重啟對應 services（如改 src/config.js）
```

---

## 🚀 安裝

```bash
# Clone
git clone https://github.com/kaden1122123/chicken-group-buying-cs.git
cd chicken-group-buying-customer-service

# 確認 Node 版本（22）
node --version  # 應 v22.x

# 安裝依賴
npm ci
```

---

## ⚙️ 啟動服務

### 環境準備

把以下檔案放到 `~/.config/chicken/secrets/`（mode 600）：

| Secret 檔 | 長度 | 用途 |
|-----------|------|------|
| `line-bot-token` | 172 chars | LINE channel access token |
| `dashboard-pwd` | 15 chars | Dashboard HTTP Basic Auth |
| `api-pwd` | 14 chars | api-server HTTP Basic Auth |
| `api-token` | 64 chars | B 方案 X-API-Token |
| `gmail-credentials.json` | — | Gmail OAuth Desktop flow |
| `google-service-account.json` | — | Google Sheets sync |

### 啟動指令

```bash
# api-server (port 3001)
nohup env API_USERNAME=api-user \
  API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
  PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

# dashboard-server (port 3000)
nohup env DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user \
  API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
  WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health \
  PORT=3000 \
  node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

# Cloudflare Worker（需要 wrangler CLI + 已設定 secrets）
cd ~/openclaw-workspace/external-user/cloudflare-worker
wrangler deploy
```

### 驗證

```bash
# 服務健康度
curl http://localhost:3000/healthz
# 預期：{ "status": "ok", "services": { "dashboard": "up", "api_server": "up", "worker": "up" } }

# 品質檢查（11 checks）
bash scripts/check-quality.sh
# 預期：11 通過 / 0 警告 / 0 失敗
```

---

## ⚙️ 配置

| 檔案 | 用途 | 編輯策略 |
|------|------|----------|
| `config/tenants/chicken.yaml` | **source of truth**（LLM 讀、api-server 讀）| 永遠改這 |
| `config.yaml` | legacy fallback（auto mirror）| 不直接編 |
| `.env.example` | 環境變數範本 | 參考用 |

修改 `chicken.yaml` 後必跑：`bash scripts/sync-config.sh`

---

## 🧪 測試

```bash
# 全套測試（53 套 unit + 1 integration）
npm test

# 單獨測試
npm run test:rules          # 規則引擎
npm run test:states         # 狀態機
npm run test:integration    # 整合測試
npm run test:dashboard-server   # Dashboard server 整合

# Lint
npm run lint
npm run lint:fix

# 品質檢查（11 checks · 必跑）
bash scripts/check-quality.sh
```

**測試覆蓋模組**：rules / states / handoff / security / sanitizer / triggers / lineProfileCache / date / config / whitelist / integration / api-server hardening / csv-writer concurrency+retry / triggers cache / emailNotifier / autoOrder / send-digest / receiptAnalyzer / awaitingPayment / state-trimmed-value / parse-items-dedup / address-dynamic-keywords / community-field / config-interface-adoption / config-feature-flag / lineReply / orderIdGenerator / orderFormatter / csvReader / notificationFormat / logger / d3-payment-options-dynamic / d4-phase2-stub / session-j-architecture / dashboard-server-yaml-fallback+patch / helpers/cleanup / timezone / handoff-customer-reply / address-handoff

---

## 📡 API Reference

完整 OpenAPI 3.0 spec 見 [`openapi.yaml`](./openapi.yaml)。

### 主要 Endpoints

| Method | Path | Auth | 用途 |
|--------|------|------|------|
| GET | `/healthz` | 公開 | 三服務健康檢查（dashboard / api_server / worker）|
| GET | `/admin` | Basic Auth | Dashboard 管理後台 |
| GET | `/api/data` | Basic Auth | 訂單資料 |
| GET | `/api/config` | Basic Auth | 當前 config |
| POST | `/api/config` | Basic Auth | 更新 config |
| POST | `/api/orders` | X-API-Token | B 方案 auto-create-order |
| POST | `/api/orders/:orderId/mark-paid` | Basic Auth | 標記已收款（P5）|
| POST | `/api/orders/:orderId/approve` | Basic Auth | 核准訂單（P2 方案 B）|
| POST | `/api/orders/:orderId/receipts` | Basic Auth | 上傳付款截圖（P4 街口支付）|

詳細 curl 範例見 [`docs/NEW_SESSION_HANDBOOK.md`](./docs/NEW_SESSION_HANDBOOK.md) §5 Dashboard API 區段。

---

## 🏗 架構

- 📖 [`docs/NEW_SESSION_HANDBOOK.md`](./docs/NEW_SESSION_HANDBOOK.md) — 接手手冊 + 三層位置架構 (§2)
- 🗺 [`docs/OWNER_MANUAL.md`](./docs/OWNER_MANUAL.md) — 完整系統目錄與檔案清單 (§5)
- 🔍 **`docs/.archive/SYSTEM_AUDIT_2026-07-19.md`**（已歸檔，內容已併入 NEW_SESSION_README.md） — 完整 audit 報告（2026-07-19 已歸檔）
- 📚 [`docs/INDEX.md`](./docs/INDEX.md) — 文檔總索引
- 🏛 [`docs/adr/`](./docs/adr/) — 5 個 Architecture Decision Records

### 對話架構

```
客戶 (LINE)
   ↓ LINE Webhook
Cloudflare Worker (資安過濾 + Rate Limit + Sanitize)
   ↓ HTTPS POST
OpenClaw Agent (external-user)
   ↓ 讀 SOUL.md + AGENTS.md + knowledge/main_idea.md
   ↓ LLM 推理（minimax/MiniMax-M3）
   ↓ 規則引擎 (rules/) + 狀態機 (states/)
   ↓ 訂單流程
   ↓ (需真人時) Human Handoff → 老闆 Email/LINE
客戶 (回覆)
```

---

## 🔐 安全性

- **LINE 額度**：500/月 outbound（free plan），inbound webhook 無限
- **Cloudflare Worker Rate Limit**：60s/7req sliding window, 500/day daily max
- **Sanitization**：Prompt injection / SQL injection 攔截（Worker + src/sanitizer.js）
- **Secrets**：XDG 標準位置 `~/.config/chicken/secrets/`（mode 600），從 `_FILE` env 讀取避免 process.env redact
- **3 層 Enforcement**（防 dual-location confusion）：
  - Layer 1：chmod 555 / chattr +i 物理擋
  - Layer 2：cron watchdog 自動 revert
  - Layer 3：`scripts/check-cwd.sh` pre-edit guard

---

## 📝 Changelog

見 [`CHANGELOG.md`](./CHANGELOG.md)。

最近重要版本：
- `v1.3.0` (2026-07-01) — Phase 3 全部 6 sessions 完成
- `P0 Gmail 整合 v0-v7` (2026-07-17~18) — Email fallback + 永遠 LINE+Email 並行 + 4 種版型
- `B 方案 auto-create-order` (2026-07-16) — X-API-Token 認證
- `P9 Google Sheets sync` (2026-07-16) — 662 筆訂單寫入

---

## 🤝 接手者快速入口

新 session 接手時必讀：

1. 📘 [`NEW_SESSION_README.md`](./NEW_SESSION_README.md) — 系統狀態摘要（Round 34 整合，取代舊 HANDOFF.md / SESSION_NEXT_PROMPT.md）
2. 🗺 [`docs/OWNER_MANUAL.md`](./docs/OWNER_MANUAL.md) — 完整系統目錄 (§5)
3. 🎯 [`NEW_SESSION_README.md`](./NEW_SESSION_README.md) — 下個 session 開局 prompt（Round 34 整合）
4. 🔍 **`docs/.archive/SYSTEM_AUDIT_2026-07-19.md`**（已歸檔，內容已併入 NEW_SESSION_README.md） — audit 報告（已歸檔）
5. 🏛 [`docs/NEW_SESSION_HANDBOOK.md`](./docs/NEW_SESSION_HANDBOOK.md) — 接手手冊 + 三層位置架構

開始 session 第一件事：
```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 應 11 通過 / 0 警告 / 0 失敗
npm test                          # 應 53 套 + 1 integration 全綠
curl http://localhost:3000/healthz  # 應 dashboard:up, api_server:up, worker:up
```

---

## 📄 License

MIT — 本專案以內部使用為主，無公開 LICENSE 檔。

---

_維護者：brtclaw（與 Hubert「kkkchang」合作的 AI 開發助手）_
_模型：minimax/MiniMax-M3_
_最後更新：2026-07-19 03:00+_
