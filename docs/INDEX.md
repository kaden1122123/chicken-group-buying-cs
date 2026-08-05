# 雞味客服 文件 INDEX（Round 37.15 重整）

> **最後更新**：2026-08-05 09:46（Round 37.15 docs/ 歸檔大清掃）
> **本檔為手動編輯**：docs/ 結構由 `scripts/sync-canonical.sh` 維護

---

## 📊 Round 37.15 重整後結構

| 目錄 | 檔案數 | 用途 |
|------|-------|------|
| `docs/`（根目錄） | **4** | 永久常駐手冊 |
| `docs/reports/` | **15** | 歷史審計、測試報告、操作 SOP、開發指南 |
| `docs/adr/` | — | Architecture Decision Records |
| `docs/handoff/` | — | Session handoff 紀錄 |
| `docs/production-prompt/` | — | L3 runtime canonical 檔（AGENTS.md / SOUL.md / main_idea.md）|

---

## 🔥 必讀（4 個永久常駐手冊 · `docs/` 根目錄）

| 檔案 | 用途 |
|------|------|
| **`docs/OWNER_MANUAL.md`** | Hubert 日常操作總手冊（owner 視角）|
| **`docs/NEW_SESSION_HANDBOOK.md`** | 新 session 接手 SOP（brtclaw 視角）|
| **`docs/GMAIL_SHEETS_WORKFLOW.md`** | Gmail OAuth + Google Sheets 同步工作流 |
| **`docs/INDEX.md`**（本檔）| 單一文件入口 |

---

## 📋 `docs/reports/` 歷史報告（15 個 · 歸檔區）

### 業務實測報告

| 檔案 | Round | 行數 |
|------|-------|------|
| `docs/reports/BUSINESS_FLOW_VERIFICATION.md` | 37.14 | 301 |
| `docs/reports/E2E_INTEGRATION_REPORT.md` | 35 | 269 |

### 操作 / 工程手冊

| 檔案 | 用途 |
|------|------|
| `docs/reports/OPERATIONS.md` | LINE bot + staging + secrets SOP |
| `docs/reports/DEVELOPMENT.md` | 測試 + 開發 + Troubleshooting |
| `docs/reports/ENGINEERING_HANDBOOK.md` | 完整工程手冊（架構 + 模組）|
| `docs/reports/CEO_DECISION_GUIDE.md` | 商業 / 戰略決策指南 |
| `docs/reports/PROJECT_INVENTORY.md` | 專案盤點 |

### SOP / 教學

| 檔案 | 用途 |
|------|------|
| `docs/reports/SESSION_END_SOP.md` | Session 結束 5 動作 SOP |
| `docs/reports/KNOWN_ISSUES.md` | 已知問題與 workaround |
| `docs/reports/EMAIL_SETUP.md` | Gmail OAuth setup 教學 |
| `docs/reports/GCP_ROTATION_SOP.md` | GCP service account key rotation |
| `docs/reports/API_CURL.md` | Dashboard API curl 範例 |
| `docs/reports/HUBERT_USER_GUIDE.md` | Hubert 操作指南（Dashboard + Cron）|
| `docs/reports/MULTI_TENANT_DESIGN.md` | 多租戶架構設計 |
| `docs/reports/NAMED_TUNNEL_MIGRATION.md` | Cloudflare Tunnel 遷移紀錄 |
| `docs/reports/TEST_MAP.md` | 測試套件與覆蓋率地圖 |

---

## 🤖 System-level 狀態（`~/.openclaw/workspace/`）

| 檔案 | 用途 |
|------|------|
| `HEARTBEAT.md` | Cron jobs + 系統狀態 |
| `MEMORY.md` | brtclaw 長期記憶 + 工作方法論 |
| `SOUL.md` | brtclaw 人格設定 |
| `memory/YYYY-MM-DD.md` | 每日 session summary |

---

## 🔧 Worker repo（`external-user-line-security`）

- 原始碼：`src/index.ts`
- 部署：Cloudflare Workers + R2 public URLs
- Dashboard 設定檔：環境變數（不在程式碼內）

---

## 🔗 快速連結

- **Dashboard**: `https://dashboard.brt1122.com`
- **Worker prod**: `https://external-user-line-security.kaden1122123.workers.dev`
- **OpenClaw Gateway**: `https://openclaw.brt1122.com`
- **Google Sheet**（訂單）：`https://docs.google.com/spreadsheets/d/12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA`
- **LINE Developer Console**: https://developers.line.biz/console/

---

_本檔結構於 Round 37.15（2026-08-05）由 brtclaw 手動重整_
_下次 docs/ 結構變動請同步更新本檔_