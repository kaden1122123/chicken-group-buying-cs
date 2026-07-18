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
