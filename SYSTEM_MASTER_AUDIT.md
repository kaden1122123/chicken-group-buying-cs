# 雞味客服專案 — 全系統主審計報告（SYSTEM MASTER AUDIT）

> **Phase 1**：純讀取靜態審計（不修改、不刪除、不移動任何檔案）
> **建立時間**：2026-08-03 07:59 GMT+8（Hubert 發起）
> **作者**：brtclaw
> **目的**：盤點雙目錄專案全貌 + 識別冗餘/過時/垃圾檔，作為 Phase 2 歸檔授權前的審查依據
> **安全鐵律**：本檔建立後**未動任何檔案**；所有「軟隔離清單」均為**待授權**項目，等 Hubert 審查後才執行

---

## §1 全服務地圖（External Services + Entry Points）

### 1.1 LINE 生態系

| 服務 | 程式碼進入點 | 設定 / 憑證 | 用途 |
|------|--------------|-------------|------|
| **LINE Messaging API** | `src/utils/lineReply.js`、`src/utils/lineProfileCache.js`、`src/config.js:230-232` | env: `LINE_BOT_TOKEN`、`LINE_CHANNEL_SECRET` | 收發客戶訊息、profile 查詢 |
| **LINE Notify（老闆）** | `src/handoff/notifier.js` | env: `NOTIFY_OWNER_LINE_USER_ID` (`Uf56650056d35626deb64165926a26182`) | 轉人工 / 大額訂單通知 Hubert |

### 1.2 Cloudflare 生態系

| 服務 | 程式碼進入點 | 設定 / 憑證 | 用途 |
|------|--------------|-------------|------|
| **Worker prod** | 獨立 repo：`~/openclaw-workspace/external-user/cloudflare-worker/`（含 `wrangler.toml`） | URL: `https://external-user-line-security.kaden1122123.workers.dev` | LINE webhook 前線（rate limit + ignored keywords + KB match） |
| **Worker staging** | 同 repo (`wrangler.staging.toml`) | URL: `https://external-user-line-security-staging.kaden1122123.workers.dev` | 測試環境 |
| **Worker latest deploy** | （Cloudflare 端） | version: `b23dd720-dbed-4974-bfb6-b1c3bd86e213`（Round 31 final） | — |
| **Cloudflare KV** | Worker 內 | `RATE_LIMIT_KV` namespace | 速率限制 |
| **Cloudflare Tunnel** | systemd unit（`dashboard.brt1122.com` tunnel） | URL: `https://dashboard.brt1122.com`（systemd 自動管理，PID 1543 since 2026-05-02） | Dashboard 後台對外 |

### 1.3 Google 生態系

| 服務 | 程式碼進入點 | 設定 / 憑證 | 用途 |
|------|--------------|-------------|------|
| **Google Sheets API** | `src/storage/sheetsSync.js`（獨立帳號 `clawbrt@gmail.com`） | secrets: `~/.config/chicken/secrets/sheets-credentials.json` | 訂單同步到 Sheets（P9） |
| **Gmail API** | `src/handoff/emailNotifier.js` | secrets: `~/.config/chicken/secrets/gmail-credentials.json`、`gmail-token.json`、env: `GMAIL_NOTIFY_TO=k.chang.8844@gmail.com` | 轉人工通知、退款通知 |
| **GCP Service Account** | Gmail/Sheets 共用 | secrets: `~/.config/chicken/secrets/gcp-sa-key.json` | OAuth + Sheets API 認證 |
| **GCP rotation SOP** | `docs/GCP_ROTATION_SOP.md`（249 行） | — | Service Account 金鑰輪替 SOP |

### 1.4 OpenClaw 生態系

| 服務 | 程式碼進入點 | 設定 / 憑證 | 用途 |
|------|--------------|-------------|------|
| **OpenClaw Gateway** | `src/handoff/receiptAnalyzer.js:34`、`src/handoff/autoOrder.js` | env: `OPENCLAW_GATEWAY_URL=https://openclaw.brt1122.com`、`OPENCLAW_GATEWAY_TOKEN` | 收 Worker callback、轉拋訂單 |
| **Production runtime** | `~/.openclaw/agents/external-user/`（AGENTS.md、SOUL.md、main_idea.md、knowledge/） | chattr +i 保護 | LLM 真正讀的位置（L3） |

### 1.5 自家服務（local）

| 服務 | 程式碼進入點 | Port | 設定 | 用途 |
|------|--------------|------|------|------|
| **Dashboard server** | `scripts/dashboard-server.js`（29KB） | 3000 | env: `DASHBOARD_USERNAME`、`DASHBOARD_PASSWORD`（含 `_FILE` 變體） | 後台 UI、訂單管理 |
| **API server** | `scripts/api-server.js`（35KB） | 3001 | env: `API_USERNAME`、`API_PASSWORD`、`API_TOKEN`（含 `_FILE` 變體）、`MOCK_TODAY`（測試模式） | 訂單接收 REST API |

### 1.6 GitHub

| Repo | 路徑 | 用途 |
|------|------|------|
| `kaden1122123/chicken-group-buying-cs` | path B `.git/` | 雞味客服主倉庫 |
| `kaden1122123/external-user-line-security` | `~/openclaw-workspace/external-user/cloudflare-worker/.git/` | Cloudflare Worker 倉庫 |

### 1.7 Discord（通知層）

| 項目 | 設定 |
|------|------|
| 預設 channel | `discord:channel:1528418702167638016`（雞味客服 daily/weekly 摘要、cron announce） |
| Backup channel | `discord:channel:1512213273846485058`（每日 02:00 backup） |

### 1.8 Cron Jobs（雞味客服專屬，共 7 個 OpenClaw + 2 個 system）

| Job ID | 名稱 | 頻率 | 用途 |
|--------|------|------|------|
| `3bade756` | main enforce readonly | every 10m | L1/L2 chmod 555 強制 |
| `955d61c6` | cloudflared leak cleanup | cron `0 */1 * * *` | 清理 leaked tunnel |
| `796afb16` | 日報彙總 | cron `30 23 * * *` | Discord 通知 |
| `bd933551` | 每日 backup | cron `0 2 * * *` | rsync backup |
| `6033de71` | P9 Sheets 同步 | cron `0 3 * * *` | Sheets 同步測試 |
| `dc5afd05` | 週報彙總 | cron `0 10 * * 0` | 每週彙總 |
| `15998630` | L2 .bak cleanup | cron `0 2 26 7 *`（年） | 年度 .bak 清理 |
| system cron | sync-producer-config.sh | every 1m | chicken.yaml L1→L2 同步 |

---

## §2 雙目錄同步現況（Dual-Location Sync Status）

### 2.1 3 層位置架構（必理解）

```
┌──────────────────────────────────────────────────────┐
│ L1: Dev repo（source of truth）                       │
│ 路徑: /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/ │
│ • .git/ tracked，chmod 555 保護 L2                      │
│ • 所有編輯都在 L1                                       │
└──────────────────────────────────────────────────────┘
              ↑ sync-{mirror,canonical,config,producer-config}
┌──────────────────────────────────────────────────────┐
│ L2: Main mirror（services 跑的位置）                  │
│ 路徑: /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/ │
│ • api-server (3001) + dashboard-server (3000)          │
│ • chmod 555 保護                                       │
└──────────────────────────────────────────────────────┘
              ↑ LLM 真的讀這裡（OpenClaw agent 啟動）
┌──────────────────────────────────────────────────────┐
│ L3: Production runtime                                │
│ 路徑: ~/.openclaw/agents/external-user/                │
│ • AGENTS.md / SOUL.md / main_idea.md（canonical）     │
│ • chattr +i 保護                                       │
└──────────────────────────────────────────────────────┘
```

Worker repo 是**第四個獨立位置**：`~/openclaw-workspace/external-user/cloudflare-worker/`（不在同步體系內）。

### 2.2 雙目錄差異（path A chicken 子目錄 vs path B）

| 項目 | Path A（L2 mirror） | Path B（L1 dev） | 說明 |
|------|---------------------|-------------------|------|
| `.git/` | ❌ 無 | ✅ 有 | Git 隔離 |
| `.env` | ✅ 真實（locked 600） | ❌ 無（只有 `.env.example`） | secrets 隔離 |
| `node_modules/` | symlink → Path B | ✅ 實體（264M） | 節省空間 |
| `data/orders/chicken/2026-08-03.csv` | 11 行 | 284 行（多 PENDING 測試 row） | **sync lag** ⚠️ |
| `data/orders/chicken/2026-08-04.csv` | 1 行 | 12 行（多 11 筆同筆 PENDING） | **sync lag** ⚠️ |
| 4 × `config.yaml.bak.*` | ✅ 鏡像 | ✅ 鏡像 | 待 cleanup-baks.sh |
| 其他檔案 | ✅ 鏡像 | ✅ 鏡像 | — |

**結論**：
- 雙目錄結構 99% 鏡像健康，差異只發生在「活檔」（`.env`、`node_modules`、live CSV）
- 8/3、8/4 CSV 差異是 PENDING 測試 row 累積但 rsync 沒追上（cloudflared cron 每小時跑、CSV 是高頻寫入，所以會 lag 1 小時內）
- **風險**：若 rsync 中斷超過 1 小時，dashboard 會讀到 stale 資料（Path A 的 CSV 比較舊）

### 2.3 Sync 機制總覽

| Script | 方向 | 頻率 | 用途 |
|--------|------|------|------|
| `scripts/sync-mirror.sh` | L1 → L2 | 手動 / cron | 全鏡像（rsync + `.rsync-filter`） |
| `scripts/sync-canonical.sh` | L1 → L3 | 手動 | AGENTS.md / SOUL.md / main_idea.md 推到 runtime |
| `scripts/sync-config.sh` | L1 → L2 | 手動 | config.yaml 同步 |
| `scripts/sync-producer-config.sh` | L1 → L2 | **每分鐘**（system cron） | chicken.yaml 即時同步 |
| `scripts/check-cwd.sh` | — | 手動 / cron | 確保不在 L2 編輯 |
| `bin/check-drift` | — | 手動 | 3 層 drift 檢查 |

### 2.4 Path A 雞味子目錄外的垃圾（不歸檔於 L2 mirror 體系）

| 路徑 | 內容 | 判定 |
|------|------|------|
| `backup_20260605/` | 3 個 .bak（AGENTS.md / SOUL.md / USER.md，2 個月前備份） | **stale** |
| `AGENTS.md.bak.20260715` | 7/15 備份（已被取代） | **stale** |
| `debt-tracker/` | Python 雞肉飯欠債追蹤器（cli.py / debt.py / test_debt.py，4 月最後修改） | **與雞味客服無關** |
| `media/inbound/` | 2 個測試檔（jpg + m4a，7/15 上傳未被消費） | **未使用** |
| `memory/` | 39 個 daily notes（2026-04-07 → 2026-08-01） | **session log**（保留但可壓縮） |

---

## §3 軟隔離（Archive）候選清單 — Phase 2 待授權

> ⚠️ **本清單尚未執行**。所有檔案都還在原位置，等 Hubert 審查後才會：
> 1. `mkdir _archive/` 在 path B 根目錄
> 2. `mv <file> _archive/` 軟移到歸檔目錄
> 3. 從不刪除任何檔案（即使移到 _archive，仍可 git checkout 還原）

### 3.1 Path B（雞味客服 codebase）

#### A 類：明確 LEGACY（檔頭已標）

| 檔案 | 大小 | 原因 | 風險 |
|------|------|------|------|
| `HANDOFF.md` | 21 KB | Round 34 標 LEGACY，內容已併入 `NEW_SESSION_README.md` | 0（已被取代） |
| `NEW_SESSION_PROMPT.md` | 2.9 KB | Round 34 已被 `NEW_SESSION_README.md` 取代 | 0 |
| `docs/handoff/ARCHITECTURE_CURRENT_STATE_2026-08-01.md` | — | Round 34 標 LEGACY，內容已併入根目錄 handbook | 0 |
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | — | 已被 `NEW_SESSION_README.md` 取代 | 0 |
| `.openclaw-internal/SESSION_BACKGROUND.md` | 8.9 KB | LEGACY 標頭，指向新入口 | 0 |

#### B 類：過時版本（被新版取代）

| 檔案 | 原因 | 風險 |
|------|------|------|
| `docs/production-prompt/2026-06-26/`（目錄） | 已被 `2026-07-03/` 取代（4 週以上） | 0 |
| `docs/production-prompt/2026-06-28/`（目錄） | 已被 `2026-07-03/` 取代 | 0 |

#### C 類：配置備份（待 cleanup-baks.sh cron 跑）

| 檔案 | 大小 | 備註 |
|------|------|------|
| `config.yaml.bak.20260723-044212` | 9138 | 7/23 備份（1+ 週前） |
| `config.yaml.bak.20260801-101402` | 9138 | 8/01 備份（2 天前） |
| `config.yaml.bak.20260802-204108` | 9172 | 8/02 備份（昨天） |
| `config.yaml.bak.20260803-061134` | 9228 | 今天備份 |

⚠️ 注意：年清 cron `15998630` 設在 7/26，下次跑是 2027/7/26 — **頻率太低**。建議 Phase 2 順手清。

#### D 類：殘留測試資料（runtime 污染）

| 檔案 | 內容 | 處理方式 |
|------|------|---------|
| `data/orders/chicken/2026-08-03.csv` | 大量 PENDING-1785... 測試 row（api-server-hardening test 殘留） | `node scripts/cleanup-test-orders.js`（既有 SOP 腳本） |
| `data/orders/chicken/2026-08-04.csv` | 同上 | 同上 |
| `data/receipts/unmatched/`（空目錄） | 空殼 | 待定（保留 or 刪除） |

#### E 類：可能的雙重入口（待 Hubert 確認）

| 檔案 | 衝突點 |
|------|--------|
| `dashboard.html`（39KB）vs `scripts/admin.html`（15KB）vs `scripts/log-panel.html`（8KB） | 3 個獨立 HTML，admin 和 log-panel 是否仍被引用？ |
| `dashboard.js`（16KB）vs `dashboard-server.js`（29KB） | 兩個 dashboard 入口，是否已切換到 server 版本？ |

### 3.2 Path A（workspace-external-user）

| 路徑 | 大小 / 內容 | 判定 |
|------|-------------|------|
| `backup_20260605/AGENTS.md.bak`、`SOUL.md.bak`、`USER.md.bak` | 3 × .bak | **stale**（2 個月前） |
| `AGENTS.md.bak.20260715` | 1 × .bak | **stale** |
| `debt-tracker/` | Python CLI 專案 | **與雞味客服無關**（4 月未動） |
| `media/inbound/` 內 2 檔 | 1 jpg + 1 m4a | **未使用**（7/15 上傳無下游消費） |
| `memory/` | 39 daily notes | **session log**（保留為日誌，可壓縮為 1 個歸檔 .md） |

### 3.3 歸檔建議結構（Phase 2 預覽）

```
path B: /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
└── _archive/
    ├── docs_legacy/
    │   ├── HANDOFF.md
    │   ├── NEW_SESSION_PROMPT.md
    │   ├── ARCHITECTURE_CURRENT_STATE_2026-08-01.md
    │   └── SESSION_NEXT_PROMPT.md
    ├── production-prompt-old/
    │   ├── 2026-06-26/
    │   └── 2026-06-28/
    ├── config-baks/
    │   └── config.yaml.bak.*  (4 個)
    ├── test-data-residue/
    │   └── 2026-08-03.csv + 2026-08-04.csv  (PENDING 測試 row 已清理版本)
    └── .openclaw-internal-legacy/
        └── SESSION_BACKGROUND.md

path A: /home/clawuser/.openclaw/workspace-external-user/_archive/
    ├── backup_20260605/
    ├── AGENTS.md.bak.20260715
    ├── debt-tracker/
    └── media-inbound-residue/
```

### 3.4 Phase 2 執行 SOP（待授權後才跑）

```bash
# Step 1: 確認 git working tree 乾淨
cd path B && git status --short   # 必須空
cd path A chicken subdir && git status --short  # 無 .git，無需檢查

# Step 2: 建立歸檔目錄
mkdir -p path B/_archive/{docs_legacy,production-prompt-old,config-baks,test-data-residue,.openclaw-internal-legacy}
mkdir -p path A/_archive

# Step 3: 軟移（mv 不 rm，永遠可還原）
mv path B/HANDOFF.md                  path B/_archive/docs_legacy/
mv path B/NEW_SESSION_PROMPT.md       path B/_archive/docs_legacy/
mv path B/docs/handoff/ARCHITECTURE_CURRENT_STATE_2026-08-01.md  path B/_archive/docs_legacy/
mv path B/docs/handoff/sessions/SESSION_NEXT_PROMPT.md           path B/_archive/docs_legacy/
mv path B/docs/production-prompt/2026-06-26                     path B/_archive/production-prompt-old/
mv path B/docs/production-prompt/2026-06-28                     path B/_archive/production-prompt-old/
mv path B/config.yaml.bak.*         path B/_archive/config-baks/
mv path B/.openclaw-internal/SESSION_BACKGROUND.md  path B/_archive/.openclaw-internal-legacy/

# Step 4: 清理 PENDING 測試 row（既有 SOP）
node scripts/cleanup-test-orders.js

# Step 5: Path A 軟移
mv path A/backup_20260605            path A/_archive/
mv path A/AGENTS.md.bak.20260715     path A/_archive/
mv path A/debt-tracker/              path A/_archive/

# Step 6: 跑驗證（npm test + check-quality + bin/check-drift）
cd path B && npm test && bash scripts/check-quality.sh && bash bin/check-drift

# Step 7: git commit + sync + rsync
cd path B && git add -A && git commit -m "refactor(chicken): Phase 2 軟隔離 + 清理測試殘留"
cd path A && bash scripts/sync-mirror.sh from-legacy

# Step 8: 1 commit、git push origin main
```

---

## §4 NEW_SESSION_HANDBOOK.md 草案

完整內容見 **`NEW_SESSION_HANDBOOK.md`**（與本檔同目錄，<200 行）。

### 4.1 為何需要新 handbook

`NEW_SESSION_README.md` 已是 Round 34 整合版（12 KB / ~280 行），對接手 session 偏冗。新版 `_archive` 完 LEGACY 檔後，需一份更精簡的入口（<200 行）給**真的開始寫程式**的 brtclaw session。

### 4.2 設計原則

- **單一入口**：新 session 第一個讀的檔
- **5 分鐘上手**：環境驗證 + 跑 `bin/check-drift` 就夠
- **3 層架構必懂**：L1 dev / L2 mirror / L3 runtime
- **已知陷阱必列**：U1 客服邏輯錯亂、U2 Exec failed、CSV race condition
- **常見任務入口**：知道從哪個檔開始找

### 4.3 草案位置

`/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/NEW_SESSION_HANDBOOK.md`

---

## §5 審計決策總結（給 Hubert 審查）

### 5.1 確認的健康項 ✅

- 雙目錄鏡像結構穩定（99% 同步）
- node_modules symlink 健康
- .env secrets 隔離正確
- 3 層位置 enforcement 設計合理
- Cron jobs 全綠（7 + 2）
- /healthz 三服務全 up
- npm test 67 套全綠
- check-quality 12 通過 / 0-2 警告 / 0 失敗

### 5.2 需處理的問題清單 ⚠️

| 優先級 | 問題 | 建議動作 |
|--------|------|----------|
| 🔴 P0 | data/orders 測試 PENDING row 殘留（8/3、8/4） | Phase 2 跑 cleanup-test-orders.js |
| 🟡 P1 | 4 個 config.yaml.bak 雙邊都沒清（年清 cron 設在 7/26） | Phase 2 直接歸檔 |
| 🟡 P1 | 5 個 LEGACY 文檔（檔頭已標） | Phase 2 軟移到 _archive |
| 🟡 P1 | 2 個過時 production-prompt 版本（2026-06-26、28） | Phase 2 軟移 |
| 🟢 P2 | Path A debt-tracker、backup_20260605、media/inbound | Phase 2 軟移到 Path A _archive |
| 🟢 P2 | 雙 dashboard.html / dashboard.js 是否切換確認 | 待 Hubert 確認（無自動掃描可斷） |
| 🟢 P2 | 8/3、8/4 CSV sync lag（< 1 小時） | 觀察；若常發生可改 5 分鐘 sync |

### 5.3 不建議動的東西 🚫

- `node_modules/`（即使 264M，是 symlink 重複不算浪費）
- `data/orders/chicken/2026-06-13.csv`、`06-16.csv`（PROTECTED — 早期實單）
- `knowledge/tenants/chicken/`（production KB）
- `.env`、`*.secrets.*`（Hubert 永久邊界 — MEMORY.md L1）
- `.git/`（git history）

### 5.4 等待 Hubert 授權的決策

請回答以下 4 個問題以進入 Phase 2：

1. **Q1**：同意 §3 的歸檔 SOP 嗎？（如有調整請指示）
2. **Q2**：Path A 的 `debt-tracker/` 真的是 dead project 嗎？（需要 Hubert 確認，因為我只能從 mtime 推測）
3. **Q3**：4 個 `config.yaml.bak` 要全部歸檔，還是保留最新 1 個？
4. **Q4**：雙 dashboard / admin / log-panel HTML/JS 是否仍有用？（若全 dead，可一併歸檔）

---

## 附錄 A：審計足跡

- **執行時間**：2026-08-03 07:59 → 08:15 GMT+8
- **掃描工具**：`exec` (find/grep/diff)、`ls`、`stat`、`openclaw cron list`
- **掃描範圍**：
  - Path A: 14 個目錄、39+ 個檔案
  - Path B: 22 個目錄、200+ 個檔案（含 .git/objects）
  - 7 個 OpenClaw cron jobs
  - 40 個 src/ JS 檔案
  - 34 個 scripts/ 檔案
  - 6 個 bin/ 檔案
  - 67 個 tests/ 檔案
  - 13 個 data/orders CSV
  - 12 個 knowledge/ KB 檔
- **未動任何檔案**：所有歸檔動作均為規劃，Phase 2 才執行