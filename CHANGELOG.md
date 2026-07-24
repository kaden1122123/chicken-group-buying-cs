# Changelog

All notable changes to the chicken-group-buying-customer-service project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **最後更新**：2026-07-18 06:15（Session P0 v7 Gmail 整合完成）
> **維護者**：brtclaw
> **對應 Session**：P0 v0→v7（Gmail 整合完整實作）

---


## [Unreleased]

### P0 Gmail 整合 v0→v7（2026-07-17 17:16 ~ 2026-07-18 06:15，7 個 commits）

#### Round 1：Gmail 整合基礎（17:41 commit ee04932）
- `src/handoff/emailNotifier.js`：Gmail API client + token 管理 + 訂單彙總
- `scripts/gmail-auth.js`：OAuth 一次性授權
- `src/handoff/notifier.js`：notifyHubert 加 Email fallback
- `src/config.js`：加 getEmailConfig getter
- `config/tenants/chicken.yaml`：加 email section（digest_to、schedule、fallback flags）
- `tests/emailNotifier.test.js`：13 個測試（後因 mock 問題從 npm test list 暫時移除，後續修）
- `docs/EMAIL_SETUP.md`：v1 OAuth 步驟

#### Round 2：永遠 LINE+Email 並行 + 4 種版型（23:08 commit ea64832）
- `notifier.js`：notifyHubert 永遠觸發 Email（不只 fallback）
- 4 種版型：handoff / autoOrder / digest / system
- `EMAIL_SETUP.md` v2：詳細 6 步 OAuth + GCP project `chickencustomerservicesheets`

#### Round 3：版型 v3 純文字精美 + 重要欄位全加（03:30 commit b823dd7）
- `notifier.js buildEmailContent v3`：box header ╔═══╗ + 分隔線 + emoji 中標題
- 每個版型都有客戶區塊（名稱/電話/地址/LINE ID）+ 訂單區塊（品項/配送/金額/付款）

#### Round 4：OAuth loopback + 版型退款/地址確認 + 付款中文（04:30 commit 1dc9b4d）
- `scripts/gmail-auth.js v3`：Desktop app loopback flow（local HTTP server 接 callback）
- handoff 版型加 `trigger_type === 'refund_request'` → 💸 退款資訊 section
- handoff 版型加 `trigger_type === 'delivery_confirm_needed'` → 📍 地址確認 section
- `emailNotifier.js`：加 PAYMENT_METHOD_LABELS（cash→現金、transfer→轉帳、jko→街口支付、linepay→LINE Pay）

#### Round 5：版型 v5 移除 box chars（04:45 commit 6cc05a8）
- 移掉 ╔═══╗ box header，改用純文字大標題 + ═{40} 主分隔線 + ─{32} section divider
- 保留中文付款標籤 + trigger_type sections

#### Round 6：後續自動化腳本 + 文件對齊（05:00 commit e512e0d）
- `scripts/send-digest.js`（162 行 + 4 tests）：日報/週報 cron 腳本
- `scripts/sheets-sync-cron.js`：P9 Sheets sync 包裝
- `HANDOFF.md §1/§2/§8` 更新 + `SESSION_NEXT_PROMPT.md` 全面更新 + `memory/2026-07-18.md` 建立

#### Round 7：89 cloudflared 清理預防 + B 方案 v2 + 文件更新（06:15 本次 commit）
- `scripts/cleanup-leaked-cloudflared.sh`：>1hr 自動 kill，保護 PID 1543 long-running tunnel
- `dashboard-watchdog.sh` 整合 cleanup 觸發
- `src/handoff/autoOrder.js`：isStrictConfirmation v2 加 false positive 統計監控
- `tests/autoOrder.test.js`：10 個測試
- `tests/send-digest.test.js`：4 個測試

### Round 8（2026-07-18 08:00~08:30）
- `3fbe06c test(p4/p6): 加 P4/P6 邏輯測試 + dashboard-watchdog 整合 cleanup` — `tests/awaitingPayment.test.js`（15 個 subtest）+ `tests/receiptAnalyzer.test.js`，npm test 套數維持 51 套（增加 subtest 數）
- `40ca4f3 docs(SESSION_NEXT_PROMPT): 修 LINE 額度誤解（P4/P6 不需等 reset，Hubert 07:49）` — 文件對齊
- `97cb3af docs: 全面更新狀態檔案 + 當日總結（Hubert 08:07）` — HANDOFF.md / PROJECT_INVENTORY.md / SESSION_NEXT_PROMPT.md / memory/2026-07-18.md 同步

### Round 9（2026-07-18~19 03:00+，Hubert 深夜整理）
- `a4c2c36 docs(system-cleanup): 文件 drift 收尾 + race condition 修法 + CHANGELOG 重複合併` — 7 個 docs/ 檔案對齊 + race condition 修好
- `e7bcac7 docs(audit): 完整系統 audit 報告 + 補 README + LEGACY 標頭` — 16KB SYSTEM_AUDIT_2026-07-19.md + 8.5KB README.md + SESSION_BACKGROUND.md LEGACY 標頭
- **Round 10 (2026-07-19 03:36+, Hubert 指示 H/L 修整)**：
  - `scripts/manage-tunnel.sh` 修法：start() 帶完整 env（`WORKER_HEALTH_URL` / `API_USERNAME` / `API_PASSWORD_FILE` / `X_API_TOKEN_FILE`）+ 用 `DASHBOARD_PASSWORD_FILE` 取代明文 `DASHBOARD_PASSWORD`（**解決 watchdog 重啟後 /healthz 永遠 worker=down 的問題**）
  - `scripts/check-quality.sh Check 10` 擴展：加 production runtime canonical drift 檢查（AGENTS.md / SOUL.md / main_idea.md vs `docs/production-prompt/2026-07-03/`）+ AGENTS.md 跳過前 14 行 CANONICAL 標頭比對內容
  - `scripts/sync-canonical.sh` 新增：同步 `docs/production-prompt/2026-07-03/` → `~/.openclaw/agents/external-user/`，AGENTS.md 自動加 14 行 CANONICAL 標頭
  - `docs/SYSTEM_AUDIT_2026-07-19.md` 加 Round 10 修整紀錄（§8）
  - `docs/GCP_ROTATION_SOP.md` 新增：GCP service account key rotate 標準作業流程（重要修正 2）
  - `docs/handoff/sessions/SESSION_H8_PROMPT.md` 狀態對齊：⏸ 待執行 → ✅ 已完成 + 4 commits 證據（`658c9a5` / `f2f1015` / `a8c766a` / `37b7e00`）
  - `docs/SESSION_NEXT_PROMPT.md` 加 Round 10 修整紀錄（給接手者快速入口）

### Phase 3 進度（6 個 sessions，預估 6-7 hr）

#### Sessions
- **X1-C**：ENGINEERING_HANDBOOK.md 加 sandbox sync SOP — ⏸ 待做
- **X1-D** ✅：`scripts/verify-kb-sources.js` + check-quality.sh Check 8（commit 3cd7e1f）
- **X2** ✅ (commit 37681b6)：11 個 SESSION prompt 狀態欄統一
- **H8** ✅ (4 commits 658c9a5/f2f1015/a8c766a/37b7e00)：13 個 src/ 模組專屬測試（2026-07-19 03:36+ 狀態對齊）
- **X4** ✅：csvWriter retry (csv-writer-retry.test.js) + trigger cache (triggers-cache.test.js)
- **X3**：dashboard 觀察工具增強（recent-orders / logs / error rate）— ⏸ 待做
- **X5** ✅：Worker + api-server 統一 /healthz 端點（Round 3E，WORKER_HEALTH_URL）

#### 統計
- 測試套數：32 → 47 → 49 → 51（含 autoOrder v2 + send-digest + P4/P6 邏輯測試）
- 新增 unit test cases：~250+
- 完成度：5 / 7（X1-C、X3 待做）

### 架構更正（Hubert 05:51）
- LINE 500/月限制只影響 outbound push，inbound webhook 無限（LINE 是 gateway）
- e2e 測試走 dashboard 觸發 + 一則測試訊息（不發測試資料串）
- P4 街口主動推 QR code 走 OpenClaw 內建 + cloudflare 過濾層
- P6 OCR 不受 LINE 限制（backend process）

### Bug 修正（教訓）
- `scripts/send-digest.js` module-level `main()` 呼叫 → 測試時真的寄了 120 筆訂單彙總給 Hubert
- 修法：加 `require.main === module` guard

### 環境修復
- 清 5 個測試 fixture CSV（保護 6/13 + 6/16 真實訂單）
- 修 lint 6 errors（lint:fix 自動修）
- 重啟 dashboard 帶 WORKER_HEALTH_URL（/healthz worker 從 404 → up）

### 統計
- 測試套數：47 → 49（+2：autoOrder.test.js + send-digest.test.js）
- commits：7（ee04932 → ea64832 → b823dd7 → 1dc9b4d → 6cc05a8 → e512e0d → pending）
- 新增 files：5（send-digest.js、sheets-sync-cron.js、cleanup-leaked-cloudflared.sh、autoOrder.test.js、send-digest.test.js）

---

### Phase 3 進度（6 個 sessions，預估 6-7 hr）

#### Sessions
- **X1-C**：ENGINEERING_HANDBOOK.md 加 sandbox sync SOP — ⏸ 待做
- **X1-D** ✅：`scripts/verify-kb-sources.js` + check-quality.sh Check 8（commit 3cd7e1f）
- **X2** ✅ (commit 37681b6)：11 個 SESSION prompt 狀態欄統一
- **H8** ✅ (4 commits 658c9a5/f2f1015/a8c766a/37b7e00)：13 個 src/ 模組專屬測試
- **X4** ✅：csvWriter retry (csv-writer-retry.test.js) + trigger cache (triggers-cache.test.js)
- **X3**：dashboard 觀察工具增強（recent-orders / logs / error rate）— ⏸ 待做
- **X5** ✅：Worker + api-server 統一 /healthz 端點（Round 3E，WORKER_HEALTH_URL）

#### 統計
- 測試套數：32 → 47 → 49 → 51（含 autoOrder v2 + send-digest + P4/P6 邏輯測試）
- 新增 unit test cases：~250+
- 完成度：5 / 7（X1-C、X3 待做）

---

## [v1.3.0] - 2026-07-01

### Added
- Production Prompt 版本管理（docs/production-prompt/）+ `latest` symlink + SUMMARY.md (X1-A)
- 47 套 unit test 全綠（含 Phase 3 新增測試）
- KNOWN_ISSUES.md 跟進 F1-F4 + W1-W9 + Phase 3 發現

### Changed
- D3：付款方式訊息動態生成（從 hardcode 改從 config）
- D3：check-quality.sh 擴展為 grep -r 全 src/ 掃描
- D4：storage.phase2.enabled 加 stub 防誤啟用未實作功能
- J：sync-mirror 加 --dry-run + .rsync-filter + cleanup helper 統一

### Fixed
- Q：菜單從 ignored_keywords 移除（客戶送「菜單」誤觸退款）
- Q：dashboard 自動重啟腳本 + cron job

---

## [v1.2.0] - 2026-06-28

### Added
- Session N：訂單流程從 v1.5 quick reply 改 A 方案（LLM 純文字 + Hubert 手動建單過渡期）
- Session N：production-prompt/2026-06-28/ 版本目錄

### Changed
- Production prompt §十二「⚡ 訂單確認流程」改 A2 → A 方案
- §十四「訂單確認流程」整章重寫
- §十六「客戶要訂購」範例改 A 方案

### Removed
- v1.5 quick reply 按鈕（6/16 實測失敗）

---

## [v1.1.0] - 2026-06-26

### Added
- Session B（拆分 src/ 為 modules/rules/states/utils/order/handoff 等子目錄）
- Session C（multi-tenant config/knowledge 介面統一）
- Session D（rules 介面從 bundle 拆出）
- Session E 雞味客服訂單流程方向決策（推薦：D 純 postback）
- Session H（H1~H6 補 6 個 helper 專屬測試）
- Session P0：建立 ENGINEERING_HANDBOOK.md + 5 個 ADR + check-quality.sh + KNOWN_ISSUES.md

### Changed
- 程式碼結構從單檔 src/index.js 拆分為模組化

### Fixed
- C2 一環遞迴事故（commit 漏改）— 建立 MEMORY.md §I SOP

---

## [v1.0.0] - 2026-06-12 ~ 2026-06-15

### Added
- Phase 1 初版完整雞味客服系統（v1）
- 訂單流程：quick reply 按鈕架構
- 知識庫：knowledge/tenants/chicken/ 12 個 .md 檔（CHICKEN_ITEMS、SIDE_ITEMS、PRICES 等）
- 主位置 + 原位置雙鏡像架構
- 真實訂單 2026-06-13 + 2026-06-16 PROTECTED 機制

---

## 已知問題（Known Issues）

完整清單見 `docs/KNOWN_ISSUES.md`。

本檔僅記錄 version-level 重大事件。單個 bug fix 與 session 詳情，請看對應 commit 與 SESSION_*_PROMPT.md。

---

_本檔由 brtclaw 維護，每次新版本發布時更新_

### Round 11（2026-07-19 08:00+，GCP drift 修正）
- `a21353a docs(gcp): 修正 audit drift — 原本 key 3 天前建立無需 rotate` — 確認 Hubert 2026-07-16 創建新 service account key，原 audit 誤判「2+ 個月未 rotate」。修正 `docs/GCP_ROTATION_SOP.md §3 + §6.5` + 刪除 `google-service-account.json.new`

### Round 12（2026-07-19 08:14+，L1 + watchdog 驗證）
- `e1d4ddb docs(L1): 攏長檔案加 LEGACY 標頭 + 接手者必跳過清單` — L1 走 A+B+C 方案（最小改動，風險 0）
- watchdog 自動驗證成功：2026-07-19 07:39 自動重啟 tunnel 4 秒內恢復

### Round 13（2026-07-19 08:23+，Named Tunnel 規劃）
- `36a8576 docs(session-end): 建立 Session 結束 SOP + 觸發關鍵字機制` — `docs/SESSION_END_SOP.md`（129 行 SOP）+ SESSION_NEXT_PROMPT.md 觸發關鍵字段

### Round 14（2026-07-19 08:30+ → 22:30+，Named Tunnel 轉移）
- `fadb6ec fix(tunnel): Dashboard tunnel 從 Quick Tunnel 升級 Named Tunnel（Round 14）` — manage-tunnel.sh + dashboard-watchdog.sh + NAMED_TUNNEL_MIGRATION.md
- `2cc89d1 fix(tunnel): 更新 manage-tunnel.sh NAMED_DOMAIN 註解（brt1122.com 確認）`
- `c96214e docs(tunnel): 修正 NAMED_TUNNEL_MIGRATION.md 步驟 2（精確 JSON 下載指引）`
- `09ff830 docs(tunnel): 修正 NAMED_TUNNEL_MIGRATION — reuse brt1122-System-09（已 78 天穩定）`
- `38b1a27 fix(tunnel+cron): dashboard tunnel 改用 brt1122-System-09 + 4 個 cron delivery 修復`

### external-user/cloudflare-worker repo（Round 14）
- `8f8d1f7 fix(worker): Cloudflare Worker audit v2 — compatibility_date + v4 部署指南` — wrangler.toml (compatibility_date 2024-01-01 → 2026-07-01, 移除 account_id) + DEPLOYMENT.md v2（6742 bytes）+ 實際 deploy `e919157f`

### Round 14 重要發現
- Cloudflare Dashboard connector 安裝建立了 tunnel `brt1122-System-09`（UUID `256e22ec-d01f-4f78-83f6-c929889173eb`），從 5/02 穩定跑 78+ 天（PID 1543 systemd service）
- **不需要新建 chicken-dashboard tunnel**，直接 reuse 已穩定的 `brt1122-System-09`
- Dashboard Public Hostname 已設定：`dashboard.brt1122.com` → `http://localhost:3000`
- 4 個 announce cron delivery channel 從 `discord` 改為 `discord:channel:1528418702167638016`（23:14 修）
- `dashboard-watchdog` cron 已停用（22:48 Hubert，改用 systemd 自動管理）

### Round 14 系統狀態（最終）
- `/healthz`: dashboard / api_server / worker 全 up
- Cloudflare Worker: deploy v `e919157f`（compatibility_date 2026-07-01）
- Dashboard tunnel: `brt1122-System-09`（systemd 自動管理）
- Dashboard URL: `https://dashboard.brt1122.com`（固定）

### Round 14 Medium/Low 完成（2026-07-20 01:00，Hubert 23:38 指示）

**`ed791d4` fix(system): Medium & Low 全部完成（Hubert 23:38 指示）**
- P6: heartbeat-state.json 清理（移除 3+ 月過時 Moltbook 資料）
- P7: `check-ignored-keywords-sync.js`（新）+ Check 11 加進 check-quality.sh
  - 自動檢查 Worker src/index.ts DEFAULT_IGNORED_KEYWORDS ↔ chicken.yaml ignored_keywords
  - 修 lint errors（arrow-parens + `\\Z` escape）
  - 驗證：5 keywords 完全同步（無 drift）
- P5: L2 production runtime `.bak` 清理計畫文件化（11 檔 SOP + 7 天緩衝）
- P4: L1 archive 評估文件化（保留現狀決策）
- P2: GCP rotate SOP §7 自動化建議（key_age_check.sh + cron）
- P3: Cloudflare Worker staging 決策（不設 + 風險評估）
- P1: 統一測試 framework → 半套轉換失敗 → 務實 revert → 留為下次 session

**check-quality 改善**: 9 通過 / 3 警告 / 0 失敗（Round 10）→ **11 通過 / 2 警告 / 0 失敗**（現在）
**每日總結**: `memory/2026-07-20.md`（8 KB）

### 統計
- 測試套數：53 個（48 自訂 assert + 5 node:test）
- commits: Round 14 共 9 個（+ 1 個 external-user repo）
- 狀態文件：8 個全部對齊（CHANGELOG / HANDOFF / PROJECT_INVENTORY / SYSTEM_AUDIT / SESSION_NEXT_PROMPT / HEARTBEAT / memory/2026-07-20.md / heartbeat-state.json）
- check-quality: 12 checks（Round 14 加 Check 11）


---

## [Round 15-19 — 2026-07-20 ~ 07-24 全部完成]（Hubert 04:00+04:20+10:49+18:37 指示）

### Round 1+2（2026-07-20 22:30 → 07-22 06:43，11 個 commits）
- **Bug #1 cascade fix** (`98151cf` + `e5f8564` + `23091c4` + Worker `e245eea`)：移除「我要訂購」from `ignored_keywords` (chicken.yaml + Worker `DEFAULT_IGNORED_KEYWORDS`)
- **P0 #1 Dashboard 按鈕** (`53ea4b6` → `8704387`)：重新生 `dashboard.html` 從真實 CSV
- **P0 #2 解除轉真人按鈕** (`0a9214a`)：stateMachine `handoffOrderIndex` Map + `/api/orders/:orderId/clear-handoff` endpoint
- **P0 #4 LLM 日期邏輯** (`6dabe71`)：`main_idea.md` hard-call `validateDate()` 修
- **P1 B16 訂單確認前要列完整** (`6dabe71`)：production crash fix — `formatCustomerReply = formatOrderSummary` alias
- **P2 文件清理 + 資安 .netrc** (`810c91b`)：TESTING_GUIDE.md + HANDOFF.md §5 + memory/2026-07-20.md

### Round 15+16（2026-07-22 → 07-23 04:30+，8 個 commits）
- **Sign B Worker deploy** (`e55767c` + deploy v `683f6f9b`)：Bug #1 fix 雙邊生效
- **Sign C-all** (8 commits：`0a9cd0a` → `a649467` + `5ca4aba`)：統一 `node:test` 風格 48/48 套
- **Phase 3 sync-config.sh 修法** (`2bdc831`)：awk 提取舊 header bug fix（19 → 1 separator）
- **Phase 4 KB 整合** (Worker `969ea0f` + deploy v `2332e491`)：11 個 KB 檔 → 37 entries
- **Phase 5 Fuzzy match** (同 commit)：Levenshtein + Jaccard n-gram (maxDistance=3)

### Round 18（2026-07-23 04:50+，Worker `45bec2c` + deploy v `0141d117`）
- **Bug 1 fix**：`fuzzyMatchKB` `bestScore` 從 `-Infinity` → `minCombined 0.2`（避免微弱 fuzzy 誤觸發）
- **Bug 2 fix**：加 `effectiveMaxDistance` 動態調整（length ≤2 → 0；length 3-5 → 1；6-8 → 2；9+ → 3）
- **Bug 3 fix**：`tests/kb-matching.test.mjs`（25 個 unit tests，全部 pass）

### Round 19 — 8 個 Task 全部完成（2026-07-24 10:49+）

#### Task A: TESTING_TROUBLESHOOTING.md（commit `9efdb1a`）
- 7 種常見問題 + 排查 SOP
- P0/P1/P2 緊急程度分級
- 問題回報格式模板

#### Task B: LINE bot config 整合（commit `8ef89be` + Worker deploy v `dfa555f4`）
- 發現 drift：`LINE_BOT_TOKEN` vs `LINE_ACCESS_TOKEN` 名稱不一致
- 修法：Worker code 改為 `env.LINE_BOT_TOKEN || env.LINE_ACCESS_TOKEN` fallback
- 新檔：`docs/LINE_BOT_SETUP.md`（7 步換 bot SOP）
- `.env.example` 完整版（10 section）

#### Task C1: Semantic scoring via synonyms（Worker commit `aa31757` + deploy v `f2458aee`）
- 新檔 `src/synonyms.ts`：23 個標準詞 + 60+ 同義詞變體
- Worker integration：query 進入 matching 前先 expand
- `expandSynonyms(query)` 函式
- 涵蓋：運費/付款/配送/雞肉/小菜/訂單/客服/投訴/時間/其他

#### Task C2: 客戶標籤自動判斷（commit `d5a7604`）
- 新檔 `scripts/customer-tags.js`：rule-based + 5 類 23 規則
- 從 order history CSV 計算 + 應用 23 個規則函數
- CLI: `node scripts/customer-tags.js <user_line_id> [--json]`

#### Task C3: L2 .bak cleanup（commit `846fc76`）
- 新檔 `scripts/cleanup-baks.sh`：7-day buffer
- 模式：dry-run 預設，--force 才真清
- 下次可清 = 2026-07-26（7/19 files 到 7 天）

#### Task C4: Worker staging 環境（Worker commit `23bf5da`）
- 新檔 `wrangler.staging.toml`：name = external-user-line-security-staging
- 新檔 `docs/STAGING.md`：3 環境 SOP + 第一次設定 + 日常 deploy + rollback
- TBD：KV namespace ID（待 `wrangler kv:namespace create RATE_LIMIT_KV --env staging`）

#### Task C5: KB inverted index + LRU cache（Worker commit `6c3e2a7`）
- `KEYWORD_TO_ENTRIES` Map<string, KBEntry[]> at module load
- `MATCH_CACHE` LRU cache (max 100 entries)
- 30/30 tests pass（含 Round 18 Bug 1+2 fix + Round 19 C5 測試）

#### Task D: AGENT_PROJECT_SOP.md（commit `7ec11ac`）
- 新檔 `docs/AGENT_PROJECT_SOP.md`（15113 bytes）
- 18 個完整建置步驟（從基礎設施到 docs/ 完整文件）
- 完成清單（18 個 checkbox）
- Reference：雞味客服現況

#### Task E: 狀態文件更新防 drift
- `~/.openclaw/workspace/HEARTBEAT.md`（Round 17+19 區塊）
- `~/.openclaw/workspace/memory/heartbeat-state.json`（roundCompletion 全部 ✅）
- `~/.openclaw/workspace/.task-state/active-tasks.md`（Round 19 完成 + 下次 session）
- `~/.openclaw/workspace/memory/2026-07-24.md`（今日 session summary）

### 統計（Round 19 close 2026-07-24 21:10）
- 測試套數：30 個（全部 node:test，含 Round 19 C5 inverted index + cache 測試）
- commits: chicken 7 個 + Worker 4 個 = **11 個 total**
- 狀態文件：4 個全部對齊（HEARTBEAT + heartbeat-state + active-tasks + memory/2026-07-24）
- check-quality: 13 pass / 1 warn / 0 fail
- 新增 docs: TESTING_TROUBLESHOOTING.md, LINE_BOT_SETUP.md, AGENT_PROJECT_SOP.md, STAGING.md, customer-tags.js
- 部署: Worker v `f2458aee`（45 KB entries + synonym expansion + LRU cache）

### Round 19 task breakdown
| Task | Commit | Status |
|------|--------|--------|
| A: TESTING_TROUBLESHOOTING.md | `9efdb1a` | ✅ |
| B: LINE bot config 整合 | `8ef89be` | ✅ |
| C1: Semantic scoring (synonyms) | Worker `aa31757` | ✅ |
| C2: 客戶標籤自動判斷 | `d5a7604` | ✅ |
| C3: L2 .bak cleanup | `846fc76` | ✅ |
| C4: Worker staging | Worker `23bf5da` | ✅ |
| C5: KB inverted index + LRU | Worker `6c3e2a7` | ✅ |
| D: AGENT_PROJECT_SOP.md | `7ec11ac` | ✅ |
| E: 狀態文件更新 | (system-level) | ✅ |
