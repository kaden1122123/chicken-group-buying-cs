# 雞味客服 文件 INDEX（單一入口）

> **作者**：brtclaw（2026-07-25 11:58+ Round 22 建立）
> **目的**：接手 session 5 分鐘上手 — 看這份就夠
> **對應 Round 22 合併**：原 `INDEX.md` (141 lines LEGACY) + 5 個 SOP 合併後重整

---

## 🔥 必讀（每個 session 開頭都讀，5 個 file）

| 檔案 | 用途 | 行數 |
|------|------|------|
| `HANDOFF.md` | 主要 session 交接手冊（§1 現狀 + §7 變更歷史）| 286 |
| `CHANGELOG.md` | Commit-level 變更歷史 | 700+ |
| `OPERATIONS.md` (NEW) | LINE bot + staging + secrets 完整 SOP（取代 3 個舊 SOP）| 205 |
| `DEVELOPMENT.md` (NEW) | 測試 + 開發 + Troubleshooting（取代 2 個舊 SOP）| 268 |
| `INDEX.md` (本檔) | 單一入口 | 150 |

---

## 📋 通用文件（按需查）

| 檔案 | 用途 |
|------|------|
| `README.md` | 專案簡介 |
| `SPEC.md` | 系統規格文件 |
| `MAIN_DIR_FILES.md` | 主目錄檔案按功能分類（Round 21 建立）|
| `REVIEW_GUIDE.md` | Code review 指南 |
| `MIGRATION_HISTORY.md` | 遷移歷史 |
| `PROJECT_INVENTORY.md` | 完整系統地圖 |
| `CEO_DECISION_GUIDE.md` | 給 CEO 看的決策指南 |
| `KNOWN_ISSUES.md` | 已知問題清單 |
| `ENGINEERING_HANDBOOK.md` | 工程慣例 + §6.6 三層位置架構 |
| `API_CURL.md` | API curl 範例（手動測試）|
| `EMAIL_SETUP.md` | Gmail OAuth 設定 |
| `AGENT_PROJECT_SOP.md` | 新 linebot/客服 專案建置 18 步 SOP |
| `GCP_ROTATION_SOP.md` | GCP service account key rotate SOP |
| `MULTI_TENANT_DESIGN.md` | 多租戶設計 |

---

## 🧪 系統層狀態（`~/.openclaw/workspace/`）

| 檔案 | 用途 |
|------|------|
| `HEARTBEAT.md` | Cron jobs + 系統狀態（OpenClaw system-level）|
| `memory/heartbeat-state.json` | 系統狀態 JSON |
| `.task-state/active-tasks.md` | 進行中的任務 |
| `memory/YYYY-MM-DD.md` | 每日 session summary |
| `MEMORY.md` | brtclaw 長期記憶 + 工作方法論 |
| `SOUL.md` | brtclaw 人格設定 |

---

## 🤖 Worker repo（`external-user-line-security`）

| 檔案 | 用途 | 狀態 |
|------|------|------|
| `wrangler.toml` | Production Worker 設定 | ✅ |
| `wrangler.staging.toml` | Staging Worker 設定 | ✅ |
| `src/kb-content.ts` | 45 KB entries + fuzzy match | ✅ |
| `src/embeddings.ts` | Workers AI semantic scoring (NEW Round 20) | ✅ |
| `src/synonyms.ts` | ❌ 已刪除（Round 20 改用 Workers AI 取代）| — |
| `src/index.ts` | LINE webhook + KB match + LLM 轉發 | ✅ |
| `docs/STAGING.md` | ⚠️ **已合併到 chicken `OPERATIONS.md`**（刪除）| — |
| `docs/STAGING_SECRETS_SETUP.md` | ⚠️ **已合併到 chicken `OPERATIONS.md`**（刪除）| — |

---

## 🗑 LEGACY 檔案（Round 22 標記，請勿 read）

| 檔案 | 原因 | 取代 |
|------|------|------|
| `PHASE1_PROGRESS.md` | Phase 1 舊進度（2026-06-29 後）| git log |
| `docs/CLEANUP_PHASE_2_PLAN.md` | Phase 2 舊 plan | git log |
| `docs/TODO_2026-06-26.md` | 6/26 舊 TODO | git log |
| `docs/DAILY_SUMMARY_2026-06-26.md` | 6/26 舊日誌 | memory/2026-06-26.md |
| `docs/SYSTEM_AUDIT_2026-07-19.md` | 7/19 audit（671 lines 完整）| 移到 `docs/.archive/` |
| `docs/SOP.md` | 舊 SOP（已被 OPERATIONS + DEVELOPMENT 取代）| 移到 `docs/.archive/` |
| `docs/TESTING_GUIDE.md` | ⚠️ **已合併到 `DEVELOPMENT.md`**（刪除）| — |
| `docs/TESTING_TROUBLESHOOTING.md` | ⚠️ **已合併到 `DEVELOPMENT.md`**（刪除）| — |
| `docs/LINE_BOT_SETUP.md` | ⚠️ **已合併到 `OPERATIONS.md`**（刪除）| — |

---

## 📊 文件統計（Round 22 合併後）

| 類別 | 合併前 | 合併後 | 節省 |
|------|-------|-------|------|
| SOP 文件 | 5 個 (521 行) | 2 個 (473 行) | -48 行（-9%）|
| 測試/開發文件 | 2 個 (1007 行) | 1 個 (268 行) | -739 行（-73%）|
| 必讀（5 個）| — | 5 個 | 接手 5 分鐘 |
| 總 docs/ | 25+ 個 | 15 個 | -10 個（-40%）|
| **接手 session token** | ~30K | **~10K** | **-67%** |

---

## 🔗 快速連結（外部）

- **Worker URL (prod)**: `https://external-user-line-security.kaden1122123.workers.dev`
- **Worker URL (staging)**: `https://external-user-line-security-staging.kaden1122123.workers.dev`
- **Dashboard**: `https://dashboard.brt1122.com`（admin / dashboard-pwd）
- **LINE Developer Console**: https://developers.line.biz/console/
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

## 📞 升級（碰到問題時找誰）

| 角色 | 負責 | 聯絡 |
|------|------|------|
| 第一線 | brtclaw | Discord #chicken-group-buying-customer-service |
| 升級 | Hubert | LINE `Uf56650056d35626deb64165926a26182` |
| 真人客服 | Hubert | 同上 |

---

_本檔由 brtclaw 維護，每個 round 結束時 review_
_取代舊 `docs/INDEX.md` (141 lines LEGACY)_
_對應 Round 22 文件清空計畫_
_最後更新：2026-07-25 11:58+_
