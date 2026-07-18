# 雞味客服系統 — 完整 Audit 報告

> **作者**：brtclaw（2026-07-19 03:00+ 整理 session）
> **觸發**：Hubert 2026-07-19 03:02 GMT+8 指示「測試 code / 其他工具 / 檔案對齊 / 業界 best practices / 整理文件紀錄」
> **目的**：全面 audit 雞味客服系統所有面向，產出結構化文件讓後續 session 接手順暢
> **性質**：H/M/L 優先度分類 + 已自主執行 vs 待後續 session

---

## 0. Executive Summary

### 0.1 系統健康度（綠燈）

| 指標 | 結果 |
|------|------|
| `check-quality.sh` | ✅ 11 通過 / 0 警告 / 0 失敗 |
| `npm test` | ✅ 53 套測試 + 1 integration 全綠 |
| `/healthz` | ✅ dashboard=up, api_server=up, worker=up |
| `/api/health` | ✅ ok |
| services PID | api-server (PID 3711641, 1h+) / dashboard-server (PID 3719649, 帶完整 env) |
| 每日 Backup cron | ✅ 32K, 26 檔案, rotation 正常（2026-07-19 02:02）|

### 0.2 本次 Audit 範圍

| 面向 | 深度 | 狀態 |
|------|------|------|
| 1. 測試 code | 完整（53 套、framework、coverage）| ✅ |
| 2. 其他工具鏈（Cloudflare / api-server / GCP / GitHub / OpenClaw agent）| 完整（檔案、版本、secret、狀態）| ✅ |
| 3. 檔案對齊（config / production runtime / 攏長文件 / SESSION prompts）| 完整（md5 比對 + 狀態盤點）| ✅ |
| 4. 業界 best practices 整合 | 5 大主題（Cloudflare / API / LINE / Node.js / GitHub）| ✅ |

### 0.3 發現 N 個問題、自主執行 M 個修法、留 N 個給後續

- **發現 12 個**（含 H/M/L 各優先度）
- **本次 session 執行 5 個**（皆可逆、低風險）
- **留 7 個給後續 session**（含 H 級 2 個、M 級 3 個、L 級 2 個）

---

## 1. 測試 code 完整 audit

### 1.1 統計

| 項目 | 值 |
|------|-----|
| 測試檔案總數 | **53**（npm test list）+ **1 integration**（dashboard-server-test.js）|
| 使用 `node:test` 風格 | **5** 個：`autoOrder.test.js` / `awaitingPayment.test.js` / `emailNotifier.test.js` / `receiptAnalyzer.test.js` / `send-digest.test.js` |
| 使用自訂 `console.log ✓` + `assert` 風格 | **48** 個（老測試）|
| `it(/test(` 統計 | 66 個（新風格 subtest）|
| `✓/✔` 統計 | ~200+ 個（老風格 subtest）|
| Fixtures | `tests/fixtures/invalidOrders.json` + `tests/fixtures/validOrders.json` |
| Helpers | `tests/helpers/cleanup.js`（PRODUCTION_DATA_PROTECTED single source of truth）+ `tests/helpers/cleanup.test.js` |

### 1.2 已自主執行修法

- ✅ `tests/dashboard-server-yaml-fallback.test.js`：spawnSync 後 unlinkSync race condition
  - 修法：`try-catch` + `fs.existsSync` 避免 ENOENT
  - 驗證：連跑 3 次全綠

### 1.3 待後續 session（建議）

| 優先度 | 項目 | 工時估計 | 理由 |
|--------|------|----------|------|
| **M** | 統一測試 framework 到 `node:test`（Node.js native，無外部依賴）| 4-6 hr | 48 個自訂 assert 風格 → node:test：減少維護成本（移除自訂 framework）+ 業界 best practices（goldbergyoni/nodebestpractices 推薦 native test）|
| M | 加 coverage gate（`c8` 或 `node --experimental-test-coverage`）| 1 hr | 目前無 coverage 量化指標 |
| L | 整理測試 fixture（12 個 KB JSON + 2 個 order fixture）| 1 hr | 目前分散在 `tests/fixtures/` |
| L | 加 flaky test detection（連跑 10 次）| 0.5 hr | dashboard-server-yaml-fallback 已證實 flaky |

### 1.4 業界 best practices 整合

- **Node.js API Best Practices 2026**（blog.openreplay.com）：測試 pyramid、unit > integration > e2e
- **goldbergyoni/nodebestpractices**（100K+ stars）：「4. Testing And Overall Quality Practices」
- **Node.js native `node:test` 模組**：自 Node 20 起穩定，無需 Jest/Mocha 依賴
- **測試風格一致性**：本次 audit 確認雞味客服有兩種風格混用，建議統一

---

## 2. 其他工具鏈完整 audit

### 2.1 Cloudflare Worker

| 項目 | 值 |
|------|-----|
| 路徑 | `~/openclaw-workspace/external-user/cloudflare-worker/` |
| 主檔 | `src/index.ts`（23,495 bytes，6/30 last update）|
| 配置 | `wrangler.toml`（KV namespace ID `4e2769895f2c48adb7b57e00a335c59f`）|
| Account ID | `7f2546e81619908113f0d6c9e42b6b36` |
| Rate Limit | KV-based sliding window（60s/7req, 500/day）|
| DEPLOYMENT.md | 5/31 後**未更新**（⚠️ 文件 drift）|
| 已部署版本 | `.wrangler/state/` 內（具體版本未顯示）|

**功能模組**（從 `index.ts`）：
- LINE Webhook signature 驗證
- Rate Limiting（KV sliding window）
- Message Sanitization（Prompt injection、SQL injection、特殊字元）
- 轉發到 OpenClaw Gateway
- Payment intent classification（街口/轉帳/LINE Pay）
- Ignored Keywords 攔截（圖文選單/關鍵字回覆）

**已自主執行**：無（功能完整、運行中、文件 drift 標記）

**待後續 session**：

| 優先度 | 項目 | 理由 |
|--------|------|------|
| L | 更新 DEPLOYMENT.md（補充 v2.0 部署後的步驟 + wrangler 版本）| 5/31 後沒更新 |

### 2.2 api-server

| 項目 | 值 |
|------|-----|
| 路徑 | `scripts/api-server.js`（36 KB）|
| Port | 3001（PID 3711641，uptime 1h+）|
| 環境 | `API_USERNAME` / `API_PASSWORD_FILE` / `X_API_TOKEN_FILE` / `PORT` |
| OpenAPI | `openapi.yaml`（13.7 KB，6/29 last update）|
| Hardening | `api-server-hardening.test.js` ✅（Session I I1-I4）|
| 整合測試 | `api-server.test.js` ✅ |

**已自主執行**：無（功能完整、運行中）

### 2.3 GCP API

| 項目 | 值 |
|------|-----|
| Service Account JSON | `/home/clawuser/.config/chicken/secrets/google-service-account.json` |
| Project ID | `chickencustomerservicesheets`（`project_id` in JSON）|
| Private Key ID | `e4894458f811ee29b3c396f7dacac57dfcca684f` |
| Gmail OAuth Credentials | `/home/clawuser/.config/chicken/secrets/gmail-credentials.json` |
| OAuth Flow | Desktop app loopback（`redirect_uris: ["http://localhost"]`）|
| Client ID | `11296846529-rrb7n92bqco6ng0ted6j5l9u2ars1sm4.apps.googleusercontent.com` |
| 用途 | P9 Google Sheets sync + P0 Gmail 整合 |

**已自主執行**：無（檔案齊全、運作中）

**待後續 session**：

| 優先度 | 項目 | 理由 |
|--------|------|------|
| **M** | GCP service account key rotate（建立後 2+ 個月）| 業界 best practices 建議 90 天 rotate |
| L | 補 GCP 設定完整文件（`docs/GCP_SETUP.md`）| 目前只有 `docs/EMAIL_SETUP.md`（Gmail）|

### 2.4 GitHub repo

| 項目 | 值 |
|------|-----|
| URL | https://github.com/kaden1122123/chicken-group-buying-cs |
| Visibility | **private**（2026-07-17 04:31 Hubert 改）|
| Default branch | `main` |
| CI workflow | `.github/workflows/test.yml` ✅（lint + npm test + .nvmrc verify）|
| **README.md** | ⚠️ **缺失**（repo root 沒有 README.md）|
| Releases | 無 |
| Issues / PRs | 未追蹤 |
| Branches | 單一 `main` |

**已自主執行**：✅ **補 `README.md`**（GitHub repo best practices 2026 + Make a README 模板）

**待後續 session**：

| 優先度 | 項目 | 理由 |
|--------|------|------|
| L | 加 release tag workflow | 目前無 versioned release |
| L | 加 dependabot | 自動 PR dependency 更新 |

### 2.5 OpenClaw agent（production runtime）

| 項目 | 值 |
|------|-----|
| Path | `/home/clawuser/.openclaw/agents/external-user/` |
| Canonical files | `AGENTS.md` / `SOUL.md` / `knowledge/main_idea.md` |
| 副檔案 | `agent/`（auth profiles SQLite + import .bak ×2）/ `memory/` / `sessions/` |
| Memory | ⚠️ 只有 `memory/2026-06-05.md`（4 個月沒更新）|
| Sessions | 多個 `*.jsonl` + `*.trajectory.jsonl` + `*.trajectory-path.json` + 1 個 `.reset.2026-07-15T13-25-21.212Z`（重置檔）|
| Backup 檔 | ⚠️ 3 個 `.bak`：`AGENTS.md.bak.20260715` / `SOUL.md.bak.20260715-211622` / `SOUL.md.old.bak` |

**已自主執行**：無（production runtime 不直接編輯，由 sync-mirror 管控）

**待後續 session**：

| 優先度 | 項目 | 理由 |
|--------|------|------|
| **H** | production runtime AGENTS.md drift 修復（12 天沒同步）| `Check 10` 不抓 docs/production-prompt ↔ production runtime canonical drift（見 §3.2）|
| L | production runtime `.bak` 清理 | 風險高（建議手動）|

---

## 3. 檔案對齊 audit

### 3.1 config 對齊

| 對 | 結果 |
|----|------|
| `config.yaml` ↔ `config/tenants/chicken.yaml` | ✅ 同步（`check-quality.sh Check 9`）|
| Sync 工具 | `scripts/sync-config.sh` |
| Drift 預防 | `Check 9`（mtime + missing keys + 檔案存在性三層檢查）|

### 3.2 production runtime canonical 對齊（⚠️ Check 10 缺漏）

`scripts/check-quality.sh Check 10` 設計：
```bash
# 7 個 critical runtime files — sync-mirror.sh 應同步這些
for f in scripts/dashboard-server.js scripts/api-server.js \
         scripts/cleanup-test-orders.js scripts/check-quality.sh \
         src/order/csvWriter.js src/order/csvReader.js \
         src/utils/logger.js; do
```

**只檢查 dev repo ↔ main mirror**（`~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`）。

**不檢查** `docs/production-prompt/2026-07-03/` ↔ `~/.openclaw/agents/external-user/`（production runtime canonical）— 這是 Check 10 的缺漏。

#### 當前 md5 比對結果（2026-07-19 03:xx）

| 檔案 | docs/production-prompt/2026-07-03/ | production runtime | 狀態 |
|------|-----------------------------------|-------------------|------|
| AGENTS.md | `f4542f4c` (8880 bytes, 7/3) | `df9c63b7` (9583 bytes, 7/15) | ❌ **drift 12 天** |
| SOUL.md | `1f8dbc2f` | `1f8dbc2f` | ✅ 同步 |
| main_idea.md | `a00bbcdf` (51629 bytes) | `f7054a0b` | ❌ **drift**（不同 hash）|

**根因推測**：
- AGENTS.md：production 7/15 加了「CANONICAL — 此為 production runtime」標頭（14 行），但 docs 版本沒同步
- main_idea.md：兩邊都 7/17 5:50 附近更新過，但內容不一致（可能是當時合併衝突或修改分支不同）

**待後續 session**：

| 優先度 | 項目 | 建議修法 |
|--------|------|----------|
| **H** | 擴展 Check 10 抓 production runtime canonical drift | 加 md5 比對 3 個 canonical files（AGENTS.md / SOUL.md / main_idea.md），從 `~/.openclaw/agents/external-user/` 對 `docs/production-prompt/latest/` |
| **H** | 同步 AGENTS.md / main_idea.md 到 canonical 一致 | 把 production runtime 版本同步回 `docs/production-prompt/2026-07-03/` |

### 3.3 攏長文件清單（22KB+）

| 檔案 | 行數 | 大小 | 最後更新 | 評估 |
|------|------|------|----------|------|
| `PHASE1_PROGRESS.md` | 875 | 40 KB | 2026-07-03 | ⚠️ 過時（9 個 P 都完成後沒更新）+ 可考慮移到 `docs/archive/` |
| `docs/TODO_2026-06-26.md` | 432 | 28 KB | 2026-06-26 | ⚠️ 過時（多個項目已 commit）+ 可考慮移到 `docs/archive/` |
| `docs/CLEANUP_PHASE_2_PLAN.md` | 481 | 22 KB | 2026-06-28 | ⚠️ 過時（Phase 2 已大部分完成）+ 可考慮移到 `docs/archive/` |
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | 468 | 27 KB | 2026-07-18 | ✅ 當前權威入口 |
| `HANDOFF.md` | 369 | 22 KB | 2026-07-18 | ✅ 當前（與 SESSION_NEXT_PROMPT 高度重複）|
| `docs/CEO_DECISION_GUIDE.md` | 503 | 19 KB | 2026-07-18 | ✅ 當前（13 個 session 決策）|
| `docs/ENGINEERING_HANDBOOK.md` | 488 | 17 KB | 2026-07-03 | ⚠️ X1-C「sandbox sync SOP」未加（待做）|
| `docs/PROJECT_INVENTORY.md` | 253 | 13 KB | 2026-07-18 | ✅ 當前 |
| `docs/production-prompt/SUMMARY.md` | 65 | 3.3 KB | 2026-07-18 | ✅ 當前 |

**待後續 session**：

| 優先度 | 項目 | 建議 |
|--------|------|------|
| L | `PHASE1_PROGRESS.md` / `TODO_2026-06-26.md` / `CLEANUP_PHASE_2_PLAN.md` 移到 `docs/archive/` | 內容已被當前文件（CHANGELOG.md / SESSION_NEXT_PROMPT.md）取代 |
| L | HANDOFF.md 精簡（部分內容已移到 SESSION_NEXT_PROMPT.md）| 兩份高度重複 |

### 3.4 SESSION prompts 狀態分布（22 個）

| 狀態 | 個數 | 清單 |
|------|------|------|
| 🔴 紅（失敗/未完成）| 4 | D3 / D4 / E / H8 |
| 🟡 黃（進行中）| 8 | F / G / H / I / K / Q / X1 / X3 |
| 🟢 綠（基本完成）| 5 | J / L / M / X4 / X5 |
| ✅ 完成（最終確認）| 2 | N / NEXT_PROMPT |
| ⏸ 暫停 | 3 | O / P / X2 |

**待後續 session**：

| 優先度 | 項目 | 建議 |
|--------|------|------|
| M | D3 / D4 / E / H8 狀態更新（已 commit 但狀態欄未改）| 把 commit 對應到狀態欄 |
| L | O / P / X2 決定是否歸檔或重啟 | 6/28 建立以來未動 |

---

## 4. 業界 best practices 整合（爬文 2026-07-19）

### 4.1 Cloudflare Workers 2026

- **官方文檔**：https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- **重點**：
  - Code patterns、configuration guidance for fast/reliable/observable/secure Workers
  - 建議使用 **Rate Limiting API**（取代 KV 手寫限流）— Workers 內建 binding 更高效
  - 雞味客服目前用 KV sliding window，是早期做法，未來可考慮升級

### 4.2 LINE Messaging API 2026

- **官方 SDK**：https://line.github.io/line-bot-sdk-nodejs/guide/webhook.html
- **Webhook 模式**：plain HTTP(S) server，ngrok 可用於 dev
- **Secret 管理**：使用 `wrangler secret put` 設定 `LINE_CHANNEL_SECRET` + `LINE_ACCESS_TOKEN`（不要寫進 wrangler.toml）
- **Rate Limit**：LINE 500/月 outbound（free plan），inbound webhook 無限

### 4.3 Node.js API Best Practices 2026

- **來源**：https://blog.openreplay.com/nodejs-api-best-practices-2026/ + https://github.com/goldbergyoni/nodebestpractices
- **重點**：
  - 100K+ stars 的 goldbergyoni 列表：4. Testing And Overall Quality Practices
  - 推薦使用 **Node.js native `node:test`**（自 Node 20 穩定，無需 Jest/Mocha 依賴）
  - **結構化 logging**（JSON 格式，便於聚合分析）— 雞味客服已有 `src/utils/logger.js` ✅
  - **Error handling**：try-catch + 統一 error class — 雞味客服已建立（`src/utils/`）

### 4.4 GitHub README best practices 2026

- **來源**：https://github.com/orgs/community/discussions/176605 + https://www.kunalganglani.com/blog/write-good-readme-guide
- **15 Essential Sections**（dev.to）：Project Title、Description、Installation、Usage、Configuration、Contributing、License、Tests、Authors、Acknowledgments、Roadmap、Support、Changelog、API Reference、Tech Stack
- **核心原則**：訪客 10 秒內能判斷是否符合需求
- **雞味客服本次補 README**：涵蓋 Title、Description、Tech Stack、Installation、Usage、Configuration、Tests、API Reference、Architecture、Security、Changelog、License

### 4.5 Documentation Best Practices（handbook / ADR / handoff）

- **Session-handoff skill**（github.com/softaworks/agent-toolkit）：**Zero ambiguity** — 不留模糊空間
- **Project Handover Templates**（plane.so）：**Structured transfer** of: responsibilities + deliverables + documentation + decisions + working context
- **ADR（Architecture Decision Records）**：5 個 ADR 已在 `docs/adr/` ✅
  - `0001-src-not-production-runtime.md`
  - `0002-dual-location-architecture.md`
  - `0003-config-legacy-fallback.md`
  - `0004-memory-three-tier-structure.md`
  - `0005-session-based-changes.md`

---

## 5. 本次 session 自主執行修法（清單）

### 5.1 ✅ 已完成（commit `a4c2c36`，已 push + sync）

| 變更 | 檔案 | 影響 |
|------|------|------|
| 合併重複 `## [Unreleased]` 段 | `CHANGELOG.md` | 結構清晰 |
| 套數 49 → 51 + 8 個 P 完成狀態 | `docs/INDEX.md` | 文件對齊 |
| W10 移到已修復段 | `docs/KNOWN_ISSUES.md` | 警示解除 |
| §8 Gmail 整合完成狀態表 | `docs/PROJECT_INVENTORY.md` | 文件對齊 |
| README 最後更新日期 | `docs/handoff/sessions/README.md` | 文件對齊 |
| latest symlink 對齊 2026-07-03 | `docs/production-prompt/SUMMARY.md` | 文件對齊 |
| spawnSync race condition 修法 | `tests/dashboard-server-yaml-fallback.test.js` | flaky test 修好 |

### 5.2 ✅ 已完成（本次 session 準備 commit）

| 變更 | 檔案 | 影響 |
|------|------|------|
| 完整 audit 報告 | `docs/SYSTEM_AUDIT_2026-07-19.md`（本檔）| 後續 session 入口 |
| 補 GitHub README | `README.md` | 公開 repo 入口（雖然 private，但接手者友善）|
| 標記為 LEGACY v2 | `.openclaw-internal/SESSION_BACKGROUND.md` | 提示接手者用 SESSION_NEXT_PROMPT.md |

### 5.3 ✅ 環境驗證 + 系統修整

| 動作 | 結果 |
|------|------|
| 環境驗證 | check-quality 11/11 + 0 警告（從原本 10/10 + 1 警告改善）|
| npm test | 53 套 + 1 integration 全綠 |
| /healthz 三服務 | dashboard=up, api_server=up, worker=up |
| 重啟 dashboard-server | PID 3719649，帶完整 env（`WORKER_HEALTH_URL` / `API_USERNAME` / `API_PASSWORD_FILE` / `X_API_TOKEN_FILE`）|
| 本機 .bak 清理 | 14 個舊 `config.yaml.bak.*` 刪除（保留 5 個最新）|

---

## 6. 待後續 session 處理（7 個 · 按優先度）

### 6.1 H 級（高優先 · 建議下次 session 第一件事處理）

| # | 項目 | 建議修法 | 工時 |
|---|------|----------|------|
| H1 | `scripts/manage-tunnel.sh start()` 啟動 dashboard-server 沒帶完整 env | 改用 `SESSION_NEXT_PROMPT.md`「服務重啟 SOP」的 env 模板（帶 `WORKER_HEALTH_URL` 等）+ 用 `DASHBOARD_PASSWORD_FILE` 取代明文 `DASHBOARD_PASSWORD` | 0.5 hr |
| H2 | `scripts/check-quality.sh Check 10` 不抓 production runtime canonical drift | 擴展 Check 10 加 md5 比對 3 個 canonical files（`~/.openclaw/agents/external-user/{AGENTS,SOUL,knowledge/main_idea}.md` vs `docs/production-prompt/2026-07-03/{AGENTS,SOUL,main_idea}.md`） | 1 hr |

### 6.2 M 級（中優先 · 1-2 天內）

| # | 項目 | 建議修法 | 工時 |
|---|------|----------|------|
| M1 | 測試 framework 不一致（5 node:test vs 48 自訂 assert）| 統一到 `node:test`（Node.js native，無外部依賴）| 4-6 hr |
| M2 | GCP service account key rotate | 用 `gcloud iam service-accounts keys create` 建立新 key，rotate 雞味客服 secrets 內的檔案 | 0.5 hr |
| M3 | `docs/handoff/sessions/SESSION_D3/D4/E/H8_PROMPT.md` 狀態欄未對應 commit | 對應到 commit hash，狀態更新為 ✅ | 0.5 hr |

### 6.3 L 級（低優先 · 待後續 session 決定）

| # | 項目 | 建議修法 | 工時 |
|---|------|----------|------|
| L1 | 攏長文件移到 `docs/archive/`（PHASE1_PROGRESS / TODO_2026-06-26 / CLEANUP_PHASE_2_PLAN）| `git mv` 後 update `docs/INDEX.md` 移除條目 | 0.5 hr |
| L2 | production runtime `.bak` 清理（AGENTS.md.bak / SOUL.md.bak ×2 + agent/*.bak ×2）| 確認舊版本不再需要後刪除（謹慎，建議手動）| 0.5 hr |

---

## 7. 給接手者的快速入口

### 7.1 必讀 4 份文檔

1. **`HANDOFF.md`**（369 行）— 雞味客服系統狀態摘要 + 待辦清單
2. **`docs/PROJECT_INVENTORY.md`**（253 行）— 完整系統目錄與檔案清單
3. **`docs/handoff/sessions/SESSION_NEXT_PROMPT.md`**（468 行）— 下個 session 開局 prompt
4. **`docs/SYSTEM_AUDIT_2026-07-19.md`**（本檔）— 完整 audit 報告 + 待修整清單

### 7.2 健康度指標

```bash
# 跑這個就知道系統綠不綠
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 應 11 通過 / 0 警告 / 0 失敗
npm test                          # 應 53 套 + 1 integration 全綠
curl http://localhost:3000/healthz  # 應 dashboard:up, api_server:up, worker:up
```

### 7.3 三層位置架構（必懂）

| 層級 | 路徑 | 角色 |
|------|------|------|
| **本倉庫 source**（dev） | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | git tracked, **永遠在這編** |
| **Main 鏡像** | `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | services 跑的位置，chmod 555 |
| **Production runtime** | `~/.openclaw/agents/external-user/` | LLM 真的在這讀（AGENTS.md / SOUL.md / main_idea.md）|

### 7.4 記憶口訣（LM 大腦也要懂）

- 「人格、設定、當前運作」→ `~/.openclaw/workspace/`
- 「未來計畫、blueprint、專案文件」→ `openclaw-workspace/others/`
- 「未來計畫（blueprint）絕不放進系統級」— 會污染 LLM 大腦

---

## 8. 修整紀錄

| 日期 | Session | 主要動作 |
|------|---------|----------|
| 2026-07-18 09:00 | 第一輪整理 | 文件 drift 收尾 + race condition 修法 + .bak 清理 + /healthz 修好（commit `a4c2c36`）|
| 2026-07-19 03:00+ | 第二輪 audit（Hubert 指示）| 完整 audit 報告 + 補 README + 標記 SESSION_BACKGROUND.md（本次 commit）|

---

_本檔由 brtclaw 維護，每次大規模 audit 後更新_
_下次 audit 建議時機：7 個待修整項目完成後、或下個 Phase 結束時_
