# 雞味客服主目錄檔案分類（Hubert 09:07 Task 2）

> **建立時間**：2026-07-25 09:10+ Round 21
> **目的**：列出 `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` 所有檔案按功能分類
> **維護**：每次新增/刪除檔案時更新

---

## 📁 1. 設定檔（Configuration）— 7 個

| 檔案 | 大小 | 功能 |
|------|------|------|
| `config.yaml` | 9.1KB | Auto-generated legacy fallback（mirror of chicken.yaml）|
| `.env.example` | 7.8KB | 環境變數範例（10 section + 換 bot checklist）|
| `config/tenants/chicken.yaml` | — | **Single source of truth**（永遠改這）|
| `openapi.yaml` | 13.8KB | API 規格文件（Swagger UI 用）|
| `package.json` | 3.4KB | npm config + scripts |
| `package-lock.json` | 145KB | npm lock |
| `.eslintrc.json` + `.eslintignore` | 1.9KB | ESLint 設定 |
| `.rsync-filter` | 0.8KB | rsync filter for main mirror |
| `.nvmrc` | 2B | Node 版本（20） |

---

## 📚 2. 文件（Documentation）— 11 個

| 檔案 | 大小 | 功能 |
|------|------|------|
| `HANDOFF.md` | 21KB | **主要 session 交接手冊**（當前狀態 + 變更歷史 + 待辦）|
| `CHANGELOG.md` | 20KB | Commit-level 變更歷史（Keep a Changelog 格式）|
| `README.md` | 10KB | 專案簡介 |
| `SPEC.md` | 8.8KB | 系統規格文件 |
| `REVIEW_GUIDE.md` | 15KB | Code review 指南 |
| `MIGRATION_HISTORY.md` | 6.6KB | 遷移歷史 |
| `dashboard.html` | 36KB | **主要 dashboard UI**（Server-rendered）|
| `PHASE1_PROGRESS.md` | 41KB | ⚠️ **LEGACY**（Round 1 進度，請勿 read）|
| `docs/AGENT_PROJECT_SOP.md` | 15KB | Round 19 新建 — 新 linebot/客服 專案建置 SOP |
| `docs/LINE_BOT_SETUP.md` | 6.3KB | Round 19 新建 — LINE bot 換本體 7 步 SOP |
| `docs/TESTING_TROUBLESHOOTING.md` | 6.1KB | Round 19 新建 — 測試中奇怪反應 SOP |
| `docs/STAGING.md` | 3.5KB | Round 19 新建 — Worker staging 環境 SOP |
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | — | 下個 session 開局 prompt |
| `docs/` | 多 | 完整 docs/ 子目錄（adr/ architecture/ handoff/ production-prompt/）|

---

## ⚙️ 3. 源碼（src/）— 27 個 .js 檔

| 子目錄 | 檔案數 | 功能 |
|--------|--------|------|
| `src/` (root) | 2 | `config.js`（env 載入）+ `index.js`（主 entry）|
| `src/states/` | 8 | 訂單狀態機（idle / awaitingInfo / awaitingPayment / confirming / completed / handoff / stateMachine）|
| `src/handoff/` | 6 | 真人交接（notifier / notificationFormat / receiptAnalyzer / transferRules / autoOrder / emailNotifier）|
| `src/rules/` | 8 | 業務規則引擎（menuRule / phoneRule / addressRule / priceRule / dateRule / timeSlotRule / paymentRule / index）|
| `src/order/` | 4 | 訂單管理（csvWriter / csvReader / orderFormatter / orderIdGenerator）|
| `src/storage/` | 1 | `sheetsSync.js`（Google Sheets 同步）|
| `src/middleware/` | 1 | `whitelist.js` |
| `src/utils/` | 多 | 工具（logger / sanitizer / 等）|

---

## 🔧 4. Scripts（scripts/）— 25 個

### 服務腳本（4 個）
| 檔案 | 功能 |
|------|------|
| `scripts/api-server.js` | HTTP API server（port 3001，HTTP Basic Auth）|
| `scripts/dashboard-server.js` | Dashboard server（port 3000，HTTP Basic Auth）|
| `scripts/dashboard.js` | Dashboard 模組（server-rendered HTML）|
| `scripts/send-digest.js` | 日報/週報發送（cron 用）|

### 同步腳本（4 個）
| 檔案 | 功能 |
|------|------|
| `scripts/sync-canonical.sh` | 同步 `docs/production-prompt/` → `~/.openclaw/agents/external-user/` |
| `scripts/sync-config.sh` | 同步 `config/tenants/chicken.yaml` → `config.yaml`（Round 16 dedup 修法）|
| `scripts/sync-mirror.sh` | rsync dev → main mirror |
| `scripts/main-enforce-readonly.sh` | re-apply chmod 555 防 drift |

### 品質 / 維護腳本（6 個）
| 檔案 | 功能 |
|------|------|
| `scripts/check-quality.sh` | 13 項品質檢查（npm test + hardcode + dead config + L1 archive 等）|
| `scripts/cleanup-baks.sh` | L2 production runtime `.bak` 清理（7-day buffer，Round 19）|
| `scripts/cleanup-test-orders.js` | 清測試訂單（保護 6/13 + 6/16 真實）|
| `scripts/cleanup-leaked-cloudflared.sh` | 雲端 process 清理 |
| `scripts/check-cwd.sh` | pre-edit guard（避免在 main mirror 編輯）|
| `scripts/check-ignored-keywords-sync.js` | keywords 同步檢查 |

### 客戶 / 客服腳本（3 個）
| 檔案 | 功能 |
|------|------|
| `scripts/customer-tags.js` | 客戶標籤自動判斷（Round 19，5 類 23 規則）|
| `scripts/sheets-sync-cron.js` | Google Sheets 同步（cron `6033de71`）|
| `scripts/gmail-auth.js` | Gmail OAuth 一次性授權 |

### 監控 / 基礎設施腳本（5 個）
| 檔案 | 功能 |
|------|------|
| `scripts/dashboard-watchdog.sh` | Dashboard health check |
| `scripts/manage-tunnel.sh` | Cloudflare Named Tunnel 管理 |
| `scripts/backup.sh` + `backup_smoke_test.sh` | 每日備份 + 測試 |
| `scripts/key_age_check.sh` | GCP service account key 過期檢查（cron `356045d8`）|
| `scripts/setup-google-sheets.sh` | Google Sheets 初次設定 |

### Dashboard UI 子檔（2 個）
| 檔案 | 功能 |
|------|------|
| `scripts/admin.html` | Admin panel |
| `scripts/log-panel.html` | Log viewer |

---

## 🧪 5. 測試（tests/）— 30 個 .test.js + helpers + fixtures

- 5 個 `node:test` 風格（含 Round 19 C5 + Round 18 Bug 1+2 fix tests）
- 25 個自訂 assert 風格（老測試）
- `tests/helpers/cleanup.js` — 真實訂單保護
- `tests/fixtures/` — 測試 fixture

---

## 💾 6. 資料（data/）— 訂單 CSV

```
data/orders/chicken/
├── 2026-06-13.csv  （PROTECTED 真實訂單）
├── 2026-06-16.csv  （PROTECTED 真實訂單）
└── YYYY-MM-DD.csv  （其他日期訂單）
```

`data/orders/archive/` — 備份

---

## 📖 7. 知識庫（knowledge/）

```
knowledge/tenants/chicken/
├── 01_product.md            (3.6KB)  產品資訊
├── 02_order_flow.md         (3.8KB)  下單流程
├── 03_payment.md            (2.9KB)  付款方式
├── 04_delivery.md            (2.1KB)  配送
├── 05_promotion.md          (2.2KB)  優惠
├── 06_faq.md                (4.4KB)  FAQ
├── 07_transfer_rules.md     (9.0KB)  轉真人規則
├── 08_owner_info.md         (1.6KB)  老闆資訊
├── 09_order_standard.md      (3.2KB)  訂單標準
├── 10_customer_tags.md      (2.9KB)  客戶標籤
├── 11_lead_followup.md      (3.9KB)  潛客跟進
├── 12_reply_examples.md     (4.0KB)  回覆範例
└── INDEX.md                 (3.2KB)  索引
```

`knowledge/learned/` — 學習資料

---

## 💾 8. 備份檔案（需注意）

| 檔案 | 備註 |
|------|------|
| `config.yaml.bak.20260723-030124` | ⚠️ Round 16 sync-config.sh 修法前產生 |
| `config.yaml.bak.20260723-0400-master` | ⚠️ Round 16 master 備份 |
| `config.yaml.bak.20260723-044212` | ⚠️ Round 16 dedup 修法前最後備份 |

> **建議**：7/26 跑 `bash scripts/cleanup-baks.sh --force` 一併清掉（會在 Round 21 Task 5 執行）

---

## 🔐 9. 隱藏目錄（不該編輯）

- `.git/` — Git 控制
- `node_modules/` — npm 套件（145KB lock）
- `.openclaw-internal/` — OpenClaw 內部狀態

---

## 📊 檔案總數

| 類別 | 數量 |
|------|------|
| 設定檔 | 7 |
| 文件 | 13+ |
| 源碼 | 27 .js |
| Scripts | 25 |
| 測試 | 30+ |
| 資料 CSV | 2 PROTECTED + N |
| KB .md | 12 + INDEX |
| 備份 .bak | 3（待清）|
| **總計** | **120+** |

---

_本檔由 brtclaw 維護，每次新增/刪除檔案時更新_
_對應 Hubert 09:07 Task 2「告訴我目前主目錄有哪些不同功能檔案」_
_最後更新：2026-07-25 09:10+_
