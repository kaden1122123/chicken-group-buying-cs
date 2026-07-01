# Changelog

All notable changes to the chicken-group-buying-customer-service project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **最後更新**：2026-07-01
> **維護者**：brtclaw
> **對應 Session**：X1-B（建立根目錄 CHANGELOG，從 Session A 回溯）

---

## [Unreleased]

### Phase 3 待執行（6 個 sessions，預估 6-7 hr）

#### Sessions
- **X1-C**：ENGINEERING_HANDBOOK.md 加 sandbox sync SOP
- **X1-D**：`scripts/verify-kb-sources.js` + check-quality.sh Check 8
- **X2** ✅ (commit 37681b6)：11 個 SESSION prompt 狀態欄統一
- **H8** ✅ (4 commits 658c9a5/f2f1015/a8c766a/37b7e00)：13 個 src/ 模組專屬測試
- **X4**：csvWriter retry + trigger cache
- **X3**：dashboard 觀察工具增強（recent-orders / logs / error rate）
- **X5**：Worker + api-server 統一 /healthz 端點

#### 統計
- 測試套數：32 → 47（+15 / +47%）
- 新增 unit test cases：~250+

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
