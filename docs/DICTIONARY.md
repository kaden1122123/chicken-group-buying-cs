# 雞味客服 路徑辭典 (PATH DICTIONARY)

> **目的**: 統一所有 shorthand → 絕對路徑,避免靠「相對記憶」猜測
> **最後更新**: Round 41 (2026-08-12, Hubert 要求新建)
> **維護者**: brtclaw
> **使用方式**: prompt / commit message / 文件中提到 shorthand 時,直接查本檔拿絕對路徑

---

## 一、三層架構 (Round 37 建立的 3-Layer Architecture)

| shorthand | 說明 | 絕對路徑 |
|-----------|------|----------|
| `L1` | dev repo(程式碼修改、git commit、跑 npm test) | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| `L2` | primary mirror(dashboard-server 跑的程式碼) | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |
| `L3` | external-user runtime(LLM 真的讀的 prompt + KB) | `/home/clawuser/.openclaw/agents/external-user/` |

**三層同步流程**:
- L1 → L2:`bash scripts/sync-mirror.sh from-legacy`
- L1 → L3 KB/Tool:`bash scripts/sync-runtime.sh`

---

## 二、核心檔案 (Core Files)

### 前端

### 前端

| shorthand | 絕對路徑 | 用途 |
|-----------|----------|------|
| `dashboard` | `L1/dashboard.html` | Dashboard 前端(訂單列表 + 圖表 + 按鈕) |
| `dashboard dir` | `L1/` | Dashboard 專案根目錄 |
| `dashboard-server` | `L1/scripts/dashboard-server.js` | Dashboard 後端 server(port 3000) |
| `api-server` | `L1/scripts/api-server.js` | 對外 API server(port 3001) |

### 後端模組

| shorthand | 絕對路徑 | 用途 |
|-----------|----------|------|
| `db` | `L1/src/storage/db.js` | SQLite Primary DB layer(Round 40 Step 1 新建) |
| `csvWriter` | `L1/src/order/csvWriter.js` | **Round 43 改**:writeOrder 只寫 DB;`exportDbToCsv()` 從 DB 自動 export CSV |
| `csvReader` | `L1/src/order/csvReader.js` | CSV 讀取(向後相容) |
| `orderFormatter` | `L1/src/order/orderFormatter.js` | 訂單格式化(Flex Message + CSV) |
| `sheetsSync` | `L1/src/storage/sheetsSync.js` | **Round 43 改**:collectAllOrders 改回只讀 CSV(配合「DB → CSV → Sheet」鏈) |
| `linePush` | `L1/src/handoff/linePush.js` | LINE Customer Push(Round 40 Step 4) |
| `emailNotifier` | `L1/src/handoff/emailNotifier.js` | Gmail OAuth 寄信 |
| `notifier` | `L1/src/handoff/notifier.js` | 老闆通知(manager-only) |
| `transferRules` | `L1/src/handoff/transferRules.js` | 13 種轉真人規則 |
| `triggers` | `L1/src/knowledge/triggers.js` | 意圖偵測 |
| `dateRule` | `L1/src/rules/dateRule.js` | 開團日期讀 config.open_dates |
| `orderStatus` | `L1/src/tools/orderStatus.js` | OpenClaw Tool get_order_status(Round 40 Step 5) |

### Prompt / 配置

| shorthand | 絕對路徑 | 用途 |
|-----------|----------|------|
| `main_idea` | `L1/docs/production-prompt/latest/main_idea.md` | LLM 系統 prompt(主) |
| `latest` | `L1/docs/production-prompt/latest/` | 當前生效的 production prompt |
| `config` | `L1/config/tenants/chicken.yaml` | 業務配置(open_dates / delivery / payment 等) |
| `secrets` | `/home/clawuser/.config/chicken/secrets/` | API tokens / OAuth(不可 commit) |

### 同步腳本

| shorthand | 絕對路徑 | 用途 |
|-----------|----------|------|
| `sync-mirror` | `L1/scripts/sync-mirror.sh` | L1 → L2 |
| `sync-runtime` | `L1/scripts/sync-runtime.sh` | L1 → L3 KB+Tool |
| `sync-producer-config` | `L1/scripts/sync-producer-config.sh` | L1 → L2 chicken.yaml(cron 每分鐘) |
| `sync-config` | `L1/scripts/sync-config.sh` | L1 → L1 config.yaml(legacy fallback) |
| `sync-canonical` | `L1/scripts/sync-canonical.sh` | DEPRECATED(wrapper → sync-runtime) |
| `sync-kb` | `L1/scripts/sync-kb.sh` | DEPRECATED(wrapper → sync-runtime) |
| `cleanup-test-orders` | `L1/scripts/cleanup-test-orders.js` | 保護 6/13 + 6/16,刪其他測試 CSV |

---

## 三、Round 43 修改的檔案清單 (給 Hubert 檢查)

| 檔案 | 絕對路徑 | 修改內容 |
|------|----------|---------|
| `csvWriter` | `L1/src/order/csvWriter.js` | 移除 CSV 直接寫入 + 新增 `exportDbToCsv()` + 修改 `_triggerSheetsSync` 為 export → sheetsSync 鏈 |
| `sheetsSync` | `L1/src/storage/sheetsSync.js` | `collectAllOrders` 改回只讀 CSV(撤掉 Round 40 Step 2 DB 優先邏輯) |
| `data/orders/chicken/*.csv` | `L1/data/orders/chicken/` | 5 個 test data CSV 備份到 `.bak.pre-round43/` 後刪除(已加 `.gitignore`) |
| `.gitignore` | `L1/.gitignore` | 加 `data/orders/chicken/.bak.*` 排除備份 |
| `NEW_SESSION_HANDBOOK` | `L1/docs/NEW_SESSION_HANDBOOK.md` | §19 Round 43 架構重整 |
| `INDEX` | `L1/docs/INDEX.md` | Round 43 history 加入 |

commit(待 push):Round 43 架構重整

## 三、知識庫 (Knowledge Base)

### KB 目錄結構

| shorthand | 絕對路徑 |
|-----------|----------|
| `KB` | `L1/knowledge/tenants/chicken/` |
| `KB INDEX` | `L1/knowledge/tenants/chicken/INDEX.md` |

### KB 檔案(12 個)

| 檔名 | 絕對路徑 | 用途 |
|------|----------|------|
| `01_product` | `L1/knowledge/tenants/chicken/01_product.md` | 品項菜單 + 價格(Single Source of Truth) |
| `02_order_flow` | `L1/knowledge/tenants/chicken/02_order_flow.md` | 下單流程 + 收單時間 |
| `03_payment` | `L1/knowledge/tenants/chicken/03_payment.md` | 付款方式(轉帳/街口/LINE Pay/現金) |
| `04_delivery` | `L1/knowledge/tenants/chicken/04_delivery.md` | 配送區域 + 運費 |
| `05_promotion` | `L1/knowledge/tenants/chicken/05_promotion.md` | 促銷規則 |
| `06_faq` | `L1/knowledge/tenants/chicken/06_faq.md` | FAQ |
| `07_transfer_rules` | `L1/knowledge/tenants/chicken/07_transfer_rules.md` | 13 種轉真人規則 |
| `08_owner_info` | `L1/knowledge/tenants/chicken/08_owner_info.md` | Hubert 老闆資訊 |
| `10_customer_tags` | `L1/knowledge/tenants/chicken/10_customer_tags.md` | 客戶標籤 |
| `11_lead_followup` | `L1/knowledge/tenants/chicken/11_lead_followup.md` | 潛客跟進(7 情境 + 禁止) |
| `12_reply_examples` | `L1/knowledge/tenants/chicken/12_reply_examples.md` | 回覆範例 |

---

## 四、文件入口 (Docs Entry Points)

| shorthand | 絕對路徑 | 用途 |
|-----------|----------|------|
| `NEW_SESSION_HANDBOOK` | `L1/docs/NEW_SESSION_HANDBOOK.md` | 接手 SOP(架構 + 驗證 + 操作) |
| `OWNER_MANUAL` | `L1/docs/OWNER_MANUAL.md` | Hubert 日常操作 SOP |
| `GMAIL_SHEETS_WORKFLOW` | `L1/docs/GMAIL_SHEETS_WORKFLOW.md` | Gmail OAuth + Sheets 整合 |
| `INDEX` | `L1/docs/INDEX.md` | 單一文件入口 + Round 歷史 |
| `DICTIONARY`(本檔) | `L1/docs/DICTIONARY.md` | 路徑辭典(shorthand → 絕對路徑) |
| `docs` | `L1/docs/` | 所有文件根目錄 |
| `adr` | `L1/docs/adr/` | Architecture Decision Records |
| `reports` | `L1/docs/reports/` | 歷史報告(歸檔區) |

---

## 五、外部服務 IDs

| 服務 | ID / 路徑 |
|------|----------|
| LINE Channel | `@620boqol` |
| LINE 主管 ID(Hubert) | `Uf56650056d35626deb64165926a26182` |
| Google Spreadsheet ID | `12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA` |
| Sheet 名稱 | `工作表1`(簡體,**不是** `工作表一`) |
| Bank | 007 第一銀行 / `23257030422` |
| Dashboard 域名 | `https://dashboard.brt1122.com` |
| Cloudflare Worker(prod) | `https://external-user-line-security.kaden1122123.workers.dev` |
| Cloudflare Tunnel | `brt1122-System-09` |
| OpenClaw Gateway | `https://openclaw.brt1122.com` |
| brtclaw email(我) | `kaden1122123@gmail.com` |
| Hubert email | `k.chang.8844@gmail.com` |

---

## 六、Round 41 修改的檔案清單 (給 Hubert 檢查)

| 檔案 | 絕對路徑 | 修改內容 |
|------|----------|---------|
| `docs/INDEX.md` | `L1/docs/INDEX.md` | Round 38-40 history 補登 |
| `main_idea` | `L1/docs/production-prompt/2026-08-04/main_idea.md` | §5.3 移除「絕不寫死」+ 改用 config.open_dates |
| `01_product` | `L1/knowledge/tenants/chicken/01_product.md` | line 66 改寫 |
| `05_promotion` | `L1/knowledge/tenants/chicken/05_promotion.md` | line 9-10 改寫 |
| `06_faq` | `L1/knowledge/tenants/chicken/06_faq.md` | line 5 改寫 |
| `11_lead_followup` | `L1/knowledge/tenants/chicken/11_lead_followup.md` | line 16 改寫 + ❌ → 禁止 |
| `DICTIONARY`(新建) | `L1/docs/DICTIONARY.md` | 本檔(Round 41 新建) |

commit: `bb6021f`(Round 41 Bug 1+2+3 修法)
commit: pending(Dictionary 新建,待 commit)

---

## 七、OpenClaw / Hub Sessions

| 服務 | 路徑 / 端點 |
|------|------------|
| OpenClaw config | `/home/clawuser/.openclaw/openclaw.json` |
| OpenClaw agents | `/home/clawuser/.openclaw/agents/` |
| OpenClaw external-user agent | `/home/clawuser/.openclaw/agents/external-user/` |
| OpenClaw system workspace | `/home/clawuser/.openclaw/workspace/` |
| OpenClaw logs | `/home/clawuser/.openclaw/logs/` |
| exec-approvals | `/home/clawuser/.openclaw/exec-approvals.json` |
| workspace-external-user | `/home/clawuser/.openclaw/workspace-external-user/` |

---

_本檔由 Round 41(2026-08-12)新增。shorthand 新增時請同步更新本檔_
