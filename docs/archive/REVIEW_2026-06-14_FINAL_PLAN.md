# 雞肉團購客服 — 完整重新規劃

> 建立時間：2026-06-14 12:30 (Asia/Taipei)
> 維護者：brtclaw
> 狀態：⏸ Planning（80%）— 等 Hubert 檢查
> 性質：完整系統規劃，包含 Bug 修補、SOP 標準化、多租戶規模化、Phase 2、儀表板

---

## 目錄

- [0. 規劃原則](#0-規劃原則)
- [1. 重新理解 Bug 邏輯](#1-重新理解-bug-邏輯)
- [2. 多租戶規模化設計 ⭐ 核心](#2-多租戶規模化設計--核心)
- [3. SOP 完整版](#3-sop-完整版)
- [4. Bug 修補完整設計](#4-bug-修補完整設計)
- [5. Phase 2 規劃（Google Sheets）](#5-phase-2-規劃google-sheets)
- [6. 儀表板規劃](#6-儀錶板規劃)
- [7. 架構圖（單/多租戶對比）](#7-架構圖單多租戶對比)
- [8. 時程規劃（按天）](#8-時程規劃按天)
- [9. 待 Hubert 決策的問題](#9-待-hubert-決策的問題)

---

## 0. 規劃原則

這次規劃的 4 個核心原則：

1. **規模化先行**：在規劃階段就設計支援多租戶的資料結構與介面，避免後期 refactor
2. **細節導向**：所有規則、變數、介面都要明確標示，不留模糊空間
3. **可驗證**：每個設計都有對應的測試計畫與驗收標準
4. **可交接**：所有設計都要考慮未來給其他客戶接手的情境

---

## 1. 重新理解 Bug 邏輯

### 1.1 時間軸模型

```
時間軸：  ... ----[今天]----[明天]----[後天]---- ...
                    │          │          │
                  下單時間    配送日=    配送日=
                              今天       明天
```

### 1.2 訂購時間 × 配送日 × 時段的完整規則

**核心規則**：客戶必須在「配送日前一日 13:00 前」下單，且必須遵守更細的時段限制。

| 配送日 = 今天？ | 配送日 = 明天？ | 下單時間 | 上午時段（10-12）| 下午時段（16-18）|
|----------------|----------------|---------|----------------|----------------|
| ✅ 配送日 = 今天 | — | < 13:00 | ❌ 不可（已太趕，沒備料時間）| ❌ 不可 |
| ✅ 配送日 = 今天 | — | >= 13:00 | ❌ past_cutoff_today | ❌ past_cutoff_today |
| — | ✅ 配送日 = 明天 | < 13:00 | ✅ 可 | ✅ 可 |
| — | ✅ 配送日 = 明天 | 13:00-14:00 | ❌ past_order_cutoff | ❌ past_order_cutoff |
| — | ✅ 配送日 = 明天 | 14:00-18:00 | ❌ past_order_cutoff | ❌ past_order_cutoff |
| — | ✅ 配送日 = 明天 | >= 18:00 | ❌ past_order_cutoff | ❌ past_order_cutoff |
| — | — | 任意 | ✅ 可（後天以後）| ✅ 可（後天以後）|

**驗證結果**（已用時間 mock 跑過）：現有 `validateDate` 對這 12 種情境全部判斷正確。

### 1.3 Bug #1 根因

**程式碼層面**：✅ 正確
**Prompt 層面**：❌ 缺失關鍵規則

- `main_idea.md` 的「九、收單時間規則」只提到 13:00、14:00、18:00 這 3 個時間點
- **沒有**明確指出「配送日 = 今天 + 13:00 後不可下單」
- **沒有**明確指出「配送日 = 明天 + 過了 13:00 不可下單」
- LLM 在客戶「晚上 8 點想訂今天配送」時，prompt 沒強制要阻擋，於是自作主張繼續

### 1.4 Bug #2 根因

**程式碼層面**：
- 錯誤訊息顯示「整個開團日清單」，沒突出「下一個開團日」
- 沒有 `getNextOpenDate()` 函數

**Prompt 層面**：
- 有提到「引導客戶改到有開團的日期」，但沒指定「下一個」
- LLM 自主判斷時容易推薦「明天」或隨機日期

### 1.5 修補目標

- **程式碼**：強化 `dateRule` 與 `timeSlotRule`，加 `getNextOpenDate`，改進錯誤訊息
- **Prompt**：加強「配送時間限制」為不可錯誤資訊，明確列出所有邊界
- **測試**：補上 `tests/date.test.js` 涵蓋所有邊界
- **驗收**：Hubert 再次實測

---

## 2. 多租戶規模化設計 ⭐ 核心

### 2.1 為什麼現在就要做？

Hubert 的洞見：
> 個人建議在規劃階段就要有規模化的打算，不然到時候有真正客戶後，客服系統也早已敲板不適合多用戶開發，而導致需要維護原系統，後導致的麻煩。

**痛點預防**：
- 雞肉客戶的 `config.yaml`、知識庫、CSV 都有「雞肉」相關字眼
- 如果未來有第二個客戶（例如「鴨肉」），要嘛複製整個 codebase（維護負擔），要嘛 refactor（破壞性變更）
- 早期抽象成本低（重構只影響內部結構），晚期抽象成本高（要重寫業務邏輯）

### 2.2 規模化原則

1. **設定隔離**：所有客戶特定資料放在自己的目錄
2. **邏輯共用**：rules / states 邏輯通用，不因客戶而異
3. **介面抽象**：未來若要做完全多租戶，介面要能支援動態切換
4. **不過度工程**：現在只支援單租戶（雞肉），但程式碼結構要為多租戶預留空間

### 2.3 規模化檔案結構（規劃後）

```
chicken-group-buying-customer-service/
├── config/
│   ├── default.yaml                    # 預設值（所有客戶共用）
│   └── tenants/
│       ├── chicken.yaml                # 雞肉客戶的設定
│       └── [未來]_duck.yaml            # 未來鴨肉客戶
│
├── knowledge/
│   ├── base/                           # 通用知識結構範本
│   │   ├── TEMPLATE_01_product.md      # 商品菜單範本
│   │   ├── TEMPLATE_02_order_flow.md   # 下單流程範本
│   │   ├── TEMPLATE_03_payment.md      # 付款規則範本
│   │   ├── TEMPLATE_04_delivery.md     # 配送範圍範本
│   │   ├── TEMPLATE_05_promotion.md    # 優惠活動範本
│   │   ├── TEMPLATE_06_faq.md          # FAQ 範本
│   │   ├── TEMPLATE_07_transfer_rules.md
│   │   ├── TEMPLATE_08_owner_info.md   # 老闆資訊範本
│   │   ├── TEMPLATE_09_order_standard.md
│   │   ├── TEMPLATE_10_customer_tags.md
│   │   ├── TEMPLATE_11_lead_followup.md
│   │   └── TEMPLATE_12_reply_examples.md
│   └── tenants/
│       ├── chicken/
│       │   ├── 01_product.md           # 雞肉菜單（19 品項）
│       │   ├── 02_order_flow.md
│       │   ├── ... (12 個檔案)
│       └── [未來]/
│           └── ...
│
├── data/
│   └── orders/
│       ├── chicken/
│       │   └── 2026-06-16.csv
│       └── [未來]/
│           └── ...
│
├── src/
│   ├── config.js                       # 支援 TENANT_ID 環境變數
│   ├── knowledge/loader.js             # 支援 tenant-aware 路徑
│   ├── order/csvWriter.js              # 支援 tenant-aware 路徑
│   ├── rules/                          # 邏輯共用
│   ├── states/                         # 邏輯共用
│   └── handoff/                        # 邏輯共用（部分配置可抽離）
│
├── tests/
│   ├── tenant.test.js                  # 多租戶測試
│   └── ...
│
└── docs/
    ├── MULTI_TENANT_DESIGN.md
    ├── SOP.md
    └── ...
```

### 2.4 介面設計（為未來多租戶預留）

#### 2.4.1 `config.js` 介面

```js
// 現在：單租戶，讀 config.yaml
const { getOpenDates, getIgnoredKeywords } = require('./config');

// 未來：多租戶，根據 TENANT_ID 環境變數載入
const { getOpenDates, getIgnoredKeywords } = require('./config');
// 內部自動根據 process.env.TENANT_ID 載入對應的 tenants/{tenant_id}.yaml
// 若 TENANT_ID 未設定，預設 'chicken'（向下相容）
```

**實作策略**：
- `loadConfig(tenantId)` 內部根據 `tenantId` 讀 `config/tenants/{tenantId}.yaml`
- 若 `tenants/{tenantId}.yaml` 不存在，fallback 到 `config.yaml`（向下相容）
- 模組層級的 `getOpenDates()` 預設讀 `process.env.TENANT_ID` 的 tenant

#### 2.4.2 `knowledge/loader.js` 介面

```js
// 支援 tenant-aware 路徑
const { loadProductMenu } = require('./knowledge/loader');
// 內部讀 knowledge/tenants/{tenant_id}/01_product.md
```

#### 2.4.3 `order/csvWriter.js` 介面

```js
// 支援 tenant-aware 路徑
const { writeOrder } = require('./order/csvWriter');
// 內部寫 data/orders/{tenant_id}/{date}.csv
```

### 2.5 OpenClaw Agent 規模化

#### 2.5.1 現狀

每個客戶要單獨建一個 OpenClaw agent：
- `~/.openclaw/agents/external-user/` — 雞肉
- 未來要新增 `~/.openclaw/agents/another-tenant/`

**缺點**：每個 agent 都要單獨 deploy 設定。

#### 2.5.2 規模化設計

**方案 A：每個客戶獨立 agent**（簡單，雞肉現在這樣）
- 優點：設定簡單、故障隔離
- 缺點：OpenClaw 設定膨脹

**方案 B：Worker 端路由 + 動態 prompt 切換**
```
LINE 帳號 A (雞肉) → Worker (判定 account_id) → OpenClaw agent "external-user" with tenant=chicken
LINE 帳號 B (鴨肉) → Worker (判定 account_id) → OpenClaw agent "external-user" with tenant=duck
```

**優點**：
- OpenClaw 只用一個 agent
- 每個客戶的 SOUL.md / AGENTS.md / main_idea.md 動態載入
- 規模化最容易

**缺點**：
- 需修改 OpenClaw 支援 dynamic agent config
- 暫不考慮實作（OpenClaw 改動大）

**方案 C：Worker 端多帳號分流 + OpenClaw 多 agent**
```
Worker (判定 account_id) → 對應的 OpenClaw webhook 路徑
                                ↓
                          agents/chicken → 雞肉 prompt
                          agents/duck    → 鴨肉 prompt
```

**優點**：
- 不用改 OpenClaw
- 每個客戶完全獨立
- 部署簡單

**缺點**：
- 每個客戶都要在 OpenClaw 建獨立 agent
- Worker 程式碼要維護 account → path 對應表

**建議**：方案 C（短期方案）+ 預留方案 B 介面（長期方案）

### 2.6 規模化實作階段

**Phase A：路徑抽離（本週）**
- 把 `config.yaml` 移進 `config/tenants/chicken.yaml`
- 把 `knowledge/base/` 移進 `knowledge/tenants/chicken/`
- 把 `data/orders/` 移進 `data/orders/chicken/`
- 加 `TENANT_ID` 環境變數支援
- 行為對單租戶（雞肉）完全相同

**Phase B：介面抽象（Phase 2 期間）**
- `config.js` 改用 `loadConfig(tenantId)` 介面
- `knowledge/loader.js` 改用 `loadKnowledgeFor(tenantId, intent)` 介面
- `csvWriter.js` 改用 `writeOrderFor(tenantId, orderData)` 介面
- 全部向下相容（不傳 tenantId 預設 'chicken'）

**Phase C：第二個客戶時（未來）**
- 實際支援多租戶切換
- Worker 端動態決定 tenant_id
- 每個客戶的 prompt 動態載入

### 2.7 規模化的取捨

**不做**的事：
- ❌ 過度抽象成 framework（不要做雞肉客服 framework）
- ❌ 動態 prompt 系統（OpenClaw 改動大）
- ❌ 完整 multi-tenant SaaS 架構（過度工程）

**要做**的事：
- ✅ 檔案結構支援多租戶
- ✅ 介面支援 tenantId 參數
- ✅ 設定與資料隔離
- ✅ 範本可複製

---

## 3. SOP 完整版

> SOP = Standard Operating Procedure
> 目標：未來給其他客戶複製使用時，可以快速上手

### 3.1 人工設定清單（必須在設定時填入）

| 設定項 | 檔案位置 | 範例 | 備註 |
|--------|---------|------|------|
| 品牌名稱 | `config/tenants/{tenant}.yaml` → `official.brand_name` | 雞味研究所｜牧草放山雞 | 顯示在所有對外訊息 |
| LINE 社群 | `config/tenants/{tenant}.yaml` → `official.line_community` | @620boqol | |
| LINE 社群 URL | `config/tenants/{tenant}.yaml` → `official.line_community_url` | https://line.me/ti/g2/... | 阻擋訊息中提示用 |
| 銀行帳號 | `config/tenants/{tenant}.yaml` → `official.bank_account` | 銀行代碼：007（第一銀行）\|\| 帳號：23257030422 | 多組用 \|\| 分隔 |
| 街口 QR Code URL | `config/tenants/{tenant}.yaml` → `official.jko_qr_code_url` | https://...jpg | |
| LINE Pay ID | `config/tenants/{tenant}.yaml` → `official.line_pay.line_id` | Willy0221 | |
| 開團日期 | `config/tenants/{tenant}.yaml` → `open_dates` | 2026-06-16, 2026-06-18, ... | 每月初更新 |
| 配送範圍 | `config/tenants/{tenant}.yaml` → `delivery.areas.allowed` / `.denied` | 三峽、鶯歌 / 大溪、新店 | 不可模糊 |
| 配送時段 | `config/tenants/{tenant}.yaml` → `delivery.hours` | am: 10:00~12:00, pm: 16:00~18:00 | 格式：HH:MM~HH:MM |
| 免運門檻 | `config/tenants/{tenant}.yaml` → `delivery.minimum_order` | chicken: 半隻 380, side_dish_ntd: 350 | |
| 收單時間 | `config/tenants/{tenant}.yaml` → `cutoff` | order_close: 13:00, chicken_modify: 14:00, side_dish: 18:00 | |
| 通知對象 | `config/tenants/{tenant}.yaml` → `handoff.notify_owner.line_user_id` | Uf56650056d35626deb64165926a26182 | 客服老闆 LINE user ID |
| 白名單 | `config/tenants/{tenant}.yaml` → `security.allowed_line_users` | Uf56650056d35626deb64165926a26182 | 測試階段可暫時關閉 |
| `block_others` | `config/tenants/{tenant}.yaml` → `security.block_others` | false | 預設 false（開放），上線前改 true |
| 商品菜單 | `knowledge/tenants/{tenant}/01_product.md` | 19 個品項，含價格、規格、特色 | **單一真相源** |
| 配送範圍說明 | `knowledge/tenants/{tenant}/04_delivery.md` | 完整可配送/不可配送/不確定 | 給 LLM 看的語意化文件 |
| 付款方式 | `knowledge/tenants/{tenant}/03_payment.md` | 4 種付款方式 + 流程 | |
| 常見問題 | `knowledge/tenants/{tenant}/06_faq.md` | 至少 10 題 | 隨時間擴充 |
| 轉真人條件 | `knowledge/tenants/{tenant}/07_transfer_rules.md` | 14 種情況 | |
| 客戶標籤 | `knowledge/tenants/{tenant}/10_customer_tags.md` | 4 類標籤 | |
| 跟進話術 | `knowledge/tenants/{tenant}/11_lead_followup.md` | 7 種情境 | |
| 回覆範例 | `knowledge/tenants/{tenant}/12_reply_examples.md` | 完整對話範例 | |
| 接單 SOP | `knowledge/tenants/{tenant}/09_order_standard.md` | 10 步驟 | |
| 品牌風格 | `~/.openclaw/agents/{tenant}/SOUL.md` | 細心、體貼、有一點幽默 | 影響所有回覆 |
| 工作區規範 | `~/.openclaw/agents/{tenant}/AGENTS.md` | 必須轉真人清單 | 影響所有行為 |
| 完整 Prompt | `~/.openclaw/agents/{tenant}/knowledge/main_idea.md` | 完整 agent prompt | 影響 lazy load 章節 |
| 通知話術 | `config/tenants/{tenant}.yaml` → `handoff.customer_reply` | 感謝您的提問... | 客戶被轉真人時看到的 |

### 3.2 客製化標記（讓其他客戶接手時可快速識別）

#### 3.2.1 環境變數（部署時設定）

| 變數 | 範例值 | 用途 |
|------|-------|------|
| `TENANT_ID` | chicken / duck | 決定讀哪個 tenant 的 config |
| `LINE_BOT_TOKEN` | xxx | 該 tenant 的 LINE Bot token |
| `LINE_CHANNEL_SECRET` | xxx | LINE channel secret |
| `JKO_QR_CODE_URL` | https://... | 街口 QR Code（可選） |
| `HUBERT_LINE_USER_ID` | Ufxxx | 通知對象（可改名，泛化） |

#### 3.2.2 OpenClaw Agent 配置位置

| Agent | 位置 | 用途 |
|-------|------|------|
| `chicken` | `~/.openclaw/agents/chicken/` | 雞肉客戶 |
| `duck` | `~/.openclaw/agents/duck/` | 鴨肉客戶（未來）|

#### 3.2.3 客製化檢查清單（給接手者）

接手時要修改的檔案清單（按優先順序）：

1. `config/tenants/{your_tenant}.yaml` — 改所有官方資訊、開團日期、配送範圍
2. `knowledge/tenants/{your_tenant}/01_product.md` — 改商品菜單
3. `knowledge/tenants/{your_tenant}/03_payment.md` — 改付款方式
4. `knowledge/tenants/{your_tenant}/04_delivery.md` — 改配送範圍
5. `knowledge/tenants/{your_tenant}/06_faq.md` — 改 FAQ
6. `knowledge/tenants/{your_tenant}/07_transfer_rules.md` — 檢查轉真人條件
7. `~/.openclaw/agents/{your_tenant}/SOUL.md` — 改品牌名稱與風格
8. `~/.openclaw/agents/{your_tenant}/AGENTS.md` — 改工作區規範
9. `~/.openclaw/agents/{your_tenant}/knowledge/main_idea.md` — 改完整 prompt
10. Cloudflare Worker secrets — 設定新的 LINE token

### 3.3 部署步驟（從零到上線）

#### 步驟 1：建立 OpenClaw Agent

```bash
# 1. 複製範本
cp -r ~/.openclaw/agents/external-user ~/.openclaw/agents/your-tenant

# 2. 修改 SOUL.md（品牌名稱、風格）
# 3. 修改 AGENTS.md（工作區規範）
# 4. 修改 knowledge/main_idea.md（完整 prompt）
# 5. 設定環境變數 LINE_BOT_TOKEN / LINE_CHANNEL_SECRET
```

#### 步驟 2：建立 Cloudflare Worker

```bash
# 1. 複製範本
cp -r ~/openclaw-workspace/external-user/cloudflare-worker ~/your-worker

# 2. 修改 wrangler.toml（account_id / worker name）
# 3. 設定 secrets
cd ~/your-worker
echo "your-line-token" | wrangler secret put LINE_ACCESS_TOKEN
echo "your-line-secret" | wrangler secret put LINE_CHANNEL_SECRET

# 4. 設定 KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
# 把 id 填入 wrangler.toml

# 5. Deploy
wrangler deploy
```

#### 步驟 3：設定 LINE 官方帳號

```
1. LINE Developers 建立官方帳號
2. 取得 Channel Access Token + Channel Secret
3. 設定 Webhook URL：https://{your-worker}.workers.dev/webhook
4. 開啟 Webhook，關閉 Auto-reply
5. 設定關鍵字回覆（菜單、常見問題等 6 個）
6. 設定 Rich Menu（六宮格）
```

#### 步驟 4：設定租戶配置

```bash
# 1. 複製 tenant 範本
cp -r config/tenants/chicken.yaml config/tenants/your-tenant.yaml
# 2. 修改所有設定（見 3.1）
# 3. 複製知識庫
cp -r knowledge/tenants/chicken knowledge/tenants/your-tenant
# 4. 修改知識庫內容
# 5. 設定環境變數
export TENANT_ID=your-tenant
```

#### 步驟 5：測試

```bash
# 1. 啟動本地測試伺服器
node test_server.js

# 2. 用 curl 測試 webhook
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"message","source":{"userId":"U-test"},"message":{"type":"text","text":"菜單"}}'
# 預期：無回覆（被 ignored_keywords 攔截）

# 3. 跑單元測試
node tests/rules.test.js
node tests/handoff.test.js
node tests/date.test.js
node tests/config.test.js

# 4. 整合測試
node tests/integration.test.js

# 5. 用真實 LINE 帳號測試
# 6. 驗證 Webhook 設定
```

#### 步驟 6：上線

```bash
# 1. 確認安全設定
#    - block_others: true
#    - 白名單包含要使用的測試帳號

# 2. 切換 production 環境變數
export TENANT_ID=your-tenant
export NODE_ENV=production

# 3. 重新啟動 OpenClaw gateway
openclaw gateway restart

# 4. 監控
tail -f ~/.openclaw/logs/gateway.log
```

### 3.4 維運清單

| 頻率 | 任務 | 負責人 |
|------|------|-------|
| 每週日 | 公告下週開團時間 | Hubert |
| 每月初 | 更新 `config/tenants/{tenant}.yaml` 的 `open_dates` | Hubert |
| 每月 | 檢查 KV 中的付款資訊是否還在 | Hubert |
| 每季 | Review 知識庫內容（價格、配送範圍）| Hubert |
| 每年 | 檢查 LINE Pay ID 是否還有效 | Hubert |
| 每月 | 檢查錯誤率、轉真人率 | Hubert |
| 每季 | 檢查是否有 prompt injection 攻擊 | Hubert |
| 每年 | 更新 Cloudflare Worker + Node.js 依賴 | brtclaw |

### 3.5 故障排除

| 問題 | 症狀 | 排查步驟 |
|------|------|---------|
| Webhook 沒回應 | 客戶送訊息沒收到任何回覆 | 1. 檢查 Worker status / 2. 檢查 KV / 3. 檢查 OpenClaw gateway / 4. 檢查 LINE Webhook 設定 |
| 重複回覆 | 客戶收到兩次回覆 | 1. 檢查 LINE 關鍵字回覆是否關閉 / 2. 檢查 OpenClaw 是否有兩個 agent 接到 |
| 客戶被阻擋 | 非白名單用戶 | 1. 檢查 `config.security.allowed_line_users` / 2. 檢查 `block_others` 設定 |
| Handoff 沒通知 | 客戶被轉真人但 Hubert 沒收到通知 | 1. 檢查 `handoff.notify_owner.line_user_id` / 2. 檢查 LINE token / 3. 檢查 log |
| 訂單沒寫入 CSV | handoff 觸發但 CSV 沒更新 | 1. 檢查 `data/orders/` 權限 / 2. 檢查磁碟空間 |

---

## 4. Bug 修補完整設計

### 4.1 修補順序

依 Hubert 決策：先修程式碼（設計驗證）→ 再修 prompt（production 真正生效）

### 4.2 程式碼修補

#### 4.2.1 `dateRule.js` 加 `getNextOpenDate` 函數

```js
/**
 * 取得指定日期之後的下一個開團日
 * @param {string|Date} afterDate - 起始日期（含當天）
 * @returns {string|null} - YYYY-MM-DD 格式，null 表示本月之後無開團日
 */
function getNextOpenDate(afterDate) {
  const openDates = getOpenDates();
  if (openDates.length === 0) return null;
  const start = typeof afterDate === 'string' ? afterDate : formatDate(afterDate);
  const sorted = [...openDates].sort();
  // 找第一個 >= start 的開團日
  return sorted.find(d => d >= start) || null;
}

/**
 * 取得下一個開團日（若本月無，提示下個月）
 * @returns {{ date: string|null, month: string|null, hasNext: boolean }}
 */
function getNextOpenDateWithMonth() {
  const now = new Date();
  const todayStr = getTodayString();
  const next = getNextOpenDate(todayStr);

  if (next) {
    return { date: next, month: getCurrentMonth(), hasNext: true };
  }
  // 本月無開團日，找下個月（從外部設定讀取，或回傳 null）
  return { date: null, month: null, hasNext: false };
}
```

#### 4.2.2 改進 `validateDate` 錯誤訊息

```js
function getSuggestedNextOpenDate(currentDateStr) {
  // 跳過今天、跳過已收單日期，建議下一個可訂購的日期
  const now = new Date();
  const openDates = getOpenDates();
  for (const d of openDates) {
    const dd = new Date(d);
    if (d > currentDateStr && d > getTodayString()) {
      return d;
    }
  }
  return null;
}

// 改進後的錯誤訊息
function buildErrorMessage(errorType, inputDate) {
  const suggested = getNextOpenDateWithMonth();
  switch (errorType) {
    case 'not_open_date':
      return `不好意思，您選的日期（${formatDate(inputDate)}）目前沒有開團。下次有開團的日期是 ${suggested.date}，您可以改訂這天嗎？`;
    case 'past_cutoff_today':
      return `不好意思，今天已經超過 13:00 了，無法再下今天的訂單。下次有開團的日期是 ${suggested.date}，建議您改訂這天。`;
    case 'past_order_cutoff':
      return `不好意思，已經超過下單時間了（配送前一日 13:00 截止）。下次有開團的日期是 ${suggested.date}，您要改訂這天嗎？`;
    case 'not_this_month':
      return `不好意思，本月已無開團。下次有開團的日期是 ${suggested.date || '下個月'}，請問您要等下個月嗎？`;
    default:
      return '不好意思，您選的日期有問題。請重新選擇。';
  }
}
```

#### 4.2.3 `timeSlotRule.js` 加合併驗證

```js
/**
 * 驗證時段 × 配送日的組合
 * 配送前一日晚上時間不能訂「上午時段」（備料時間不足）
 * 配送前一日 18:00 後不能訂「下午時段」（小菜無法追加）
 *
 * @param {Date|string} deliveryDate
 * @param {string} timeSlot - 'morning' / 'afternoon' / 指定時間
 * @returns {{ valid: boolean, errorMessage: string|null, errorType: string|null }}
 */
function validateTimeSlotWithDate(deliveryDate, timeSlot) {
  const slot = getTimeSlot(timeSlot);
  if (!slot) {
    return { valid: false, errorMessage: '...', errorType: 'invalid_slot' };
  }

  const now = new Date();
  const dd = new Date(deliveryDate);
  const orderCutoff = new Date(dd);
  orderCutoff.setDate(orderCutoff.getDate() - 1);
  orderCutoff.setHours(13, 0, 0, 0);

  // 配送前一日 13:00 後已過收單時間
  if (now >= orderCutoff) {
    return { valid: false, errorMessage: '已過收單時間', errorType: 'past_order_cutoff' };
  }

  // 配送前一日 14:00 後不能訂上午時段
  if (slot === 'morning' && now.getHours() >= 14 && formatDate(now) === formatDate(orderCutoff)) {
    return { valid: false, errorMessage: '上午時段需前一天 14:00 前訂購', errorType: 'past_chicken_cutoff' };
  }

  return { valid: true, errorMessage: null, errorType: null };
}
```

### 4.3 Prompt 修補

#### 4.3.1 `main_idea.md` 加強「九、收單時間規則」

把現有章節改為：

```markdown
## 九、收單時間規則（嚴格遵守，不可妥協）

你必須記住以下時間節點，這些規則是不可違反的：

### 訂購時間表（配送前一日 vs 配送日）

| 配送日 = 今天 | 配送日 = 明天 | 配送日 = 後天或之後 |
|--------------|--------------|-------------------|
| 現在 < 13:00 → ❌ 不可下單（已太趕）| 現在 < 13:00 → ✅ 可下單 | 任意時間 → ✅ 可下單 |
| 現在 >= 13:00 → ❌ 不可下單（past_cutoff_today）| 現在 13:00-14:00 → ❌ 已過收單時間 | |
| | 現在 14:00-18:00 → ❌ 已過收單時間 | |
| | 現在 >= 18:00 → ❌ 已過收單時間 | |

### 完整規則

1. **配送日 = 今天**：
   - 13:00 之前 ❌ 不接受訂單（時間太趕，無備料時間）
   - 13:00 之後 ❌ 當天已截止
   - 回覆：「不好意思，配送日 = 今天 13:00 後已不收單。建議改訂下個開團日（YYYY-MM-DD）。」

2. **配送日 = 明天**：
   - 13:00 之後 ❌ 已過收單時間（無論上午/下午時段都不行）
   - 回覆：「不好意思，配送前一日 13:00 後已收單。建議改訂下個開團日（YYYY-MM-DD）。」

3. **配送日 = 後天或更遠**：
   - 任何時間 ✅ 可下單
   - 正常收集訂單資訊

### 執行紀律

- **必須強制執行**這些時間規則
- **不可因為客戶要求就妥協**（「拜託啦」「我真的很急」都不行）
- **不可擅自承諾**「可以加單」「可以延後」
- 收到客戶訊息時：
  1. 解析客戶想要的配送日
  2. 對照現在時間判斷是否符合規則
  3. 不符合 → 直接告知「下次有開團的日期是 YYYY-MM-DD，您要改訂這天嗎？」
  4. 符合 → 進入下單流程

### 範例

客戶：「我想訂今天下午配送」
- 配送日 = 今天 → 13:00 後已不收單
- 回覆：「不好意思，配送日 = 今天 13:00 後已不收單。建議改訂下個開團日（2026-06-16）。您要改訂這天嗎？」

客戶：「我想訂明天上午」
- 配送日 = 明天（2026-06-16）→ 現在時間若是 14:00 後，已過收單時間
- 回覆：「不好意思，配送前一日 13:00 後已收單。建議改訂下個開團日（2026-06-18）。」

客戶：「我想訂後天（2026-06-18）」
- 配送日 = 後天 → 任何時間可下單
- 進入下單流程
```

#### 4.3.2 `SOUL.md` 加強「不可錯誤資訊」

加一個 section：

```markdown
## ⚠️ 不可錯誤的核心時間規則

- 配送日 = 今天 + 現在 13:00 後 → 不可下單
- 配送日 = 明天 + 現在 13:00 後 → 不可下單
- 配送日 = 明天 + 現在 14:00 後 + 上午時段 → 不可下單（雞肉備料時間不足）
- 配送日 = 明天 + 現在 18:00 後 + 下午時段 → 不可下單（小菜無法追加）

這些規則不可因為客戶要求就妥協。發現違規時必須明確告知並推薦下個開團日。
```

### 4.4 測試修補

#### 4.4.1 新增 `tests/date.test.js`

涵蓋所有邊界：
- 12 種時間 × 配送日 × 時段組合
- `getNextOpenDate` 的所有 case
- 跨月份邊界
- 推薦下一個開團日的所有 case
- 錯誤訊息的「下一個開團日」內容

預估測試案例數：30+

#### 4.4.2 補 `tests/integration.test.js`

新增 date 與 timeSlot 的整合測試，確保 production Worker 邏輯與雞肉專案邏輯一致。

---

## 5. Phase 2 規劃（Google Sheets）

### 5.1 目標

取代本地 CSV，改用 Google Sheets 儲存訂單，讓 Hubert 隨時隨地查看。

### 5.2 架構

```
LINE → Cloudflare Worker → OpenClaw Gateway → external-user agent
                                              ↓
                                          雞肉 logic
                                              ↓
                                    ┌─────────┴─────────┐
                                    ↓                   ↓
                                本地 CSV         Google Sheets
                              (備援/離線)         (主儲存)
```

### 5.3 優缺點

**優點**：
- ✅ 即時查看（多裝置）
- ✅ 容易分享
- ✅ 公式可做簡單統計
- ✅ 與 Calendar 整合（開團日管理）

**缺點**：
- ❌ 需 Google Cloud 設定
- ❌ API 限制（per user per minute）
- ❌ 增加延遲（~500ms）

### 5.4 實作計畫

#### Step 1：建立 Google Cloud + Sheets
- 建立 GCP project
- 啟用 Sheets API
- 建立 service account
- 建立 Sheets 模板（訂單表 / 開團日表）
- 下載 credentials.json

#### Step 2：實作 `src/order/sheetsWriter.js`
```js
// 類似 csvWriter.js 的 API，但寫到 Google Sheets
class SheetsWriter {
  async writeOrder(orderData) {
    // 1. 確保 Sheet header 存在
    // 2. append 一行
  }
  async updateOrder(orderId, updates) {
    // 1. 找到對應 row
    // 2. 更新欄位
  }
}
```

#### Step 3：Fallback 機制
- 先嘗試 Sheets
- 失敗時 fallback 到本地 CSV
- 用 KV 紀錄最後成功寫入的時間

#### Step 4：定期同步
- 每 5 分鐘從 Sheets pull 最新開團日 → 更新 config
- 確保 config.yaml 與 Sheets 同步

### 5.5 規模化考量（多租戶）

- 每個 tenant 自己的 Google Sheets
- service account JSON 存在 `config/tenants/{tenant}/google-credentials.json`
- Sheets ID 存在 `config/tenants/{tenant}.yaml` 的 `storage.phase2.spreadsheet_id`

### 5.6 預估工作量

| 子任務 | 預估時間 |
|--------|---------|
| GCP 設定 + 取得 credentials | 0.5 天 |
| Sheets 模板建立 | 0.5 天 |
| `sheetsWriter.js` 實作 | 1 天 |
| Fallback 機制 | 0.5 天 |
| 定期同步（KV 排程）| 0.5 天 |
| 測試 | 1 天 |
| 文件 | 0.5 天 |
| **總計** | **4.5 天** |

---

## 6. 儀表板規劃

### 6.1 目標

讓 Hubert 不用打開 CSV 就能看：
- 訂單狀態
- 營收分析
- 客戶分析
- 異常警示

### 6.2 選項

#### 選項 A：Google Sheets Dashboard（簡單）
- 優點：不用寫程式，用 Sheets 內建功能
- 缺點：互動性低、無即時通知
- 預估：1 天
- 適合：MVP

#### 選項 B：Cloudflare Worker + HTML（中等）
- 優點：自訂化、即時、不依賴外部
- 缺點：要維護 Worker + 網頁
- 預估：3-5 天
- 適合：內部使用

#### 選項 C：獨立 Web App（複雜）
- 優點：完整功能、互動性高、可商業化
- 缺點：要架伺服器、維護成本高
- 預估：1-2 週
- 適合：未來多租戶時

### 6.3 建議路徑

**短期**：A（Sheets Dashboard）
**中期**：B（Cloudflare Worker + HTML）
**長期**：C（獨立 Web App）

### 6.4 儀表板內容

#### 1. 訂單總覽
- 今日 / 本週 / 本月訂單數
- 各狀態訂單數（pending / paid / confirmed / delivered / cancelled）
- 開團日當天的訂單列表

#### 2. 營收分析
- 本月營收
- 雞肉 vs 小菜 vs 加購品佔比
- 客戶終身價值
- 平均客單價

#### 3. 客戶分析
- 新客 vs 老客比例
- 各區域訂單分佈
- 客戶回購率

#### 4. 庫存警示
- 即將售完的品項
- 配送前最後 24 小時的訂單

#### 5. 異常警示
- 待處理 handoff
- 超過 24 小時未付款
- 開團日當天的訂單

### 6.5 規模化考量（多租戶）

- 短期（選項 A）：每個 tenant 自己的 Sheets
- 中期（選項 B）：用 tenant_id query param 切換資料
- 長期（選項 C）：完整 multi-tenant SaaS

### 6.6 預估工作量

| 選項 | 預估時間 |
|------|---------|
| A（Sheets Dashboard）| 1 天 |
| B（Cloudflare Worker + HTML）| 3-5 天 |
| C（獨立 Web App）| 1-2 週 |

---

## 7. 架構圖（單/多租戶對比）

### 7.1 現狀（單租戶）

```
LINE 用戶
  ↓
Cloudflare Worker
  (single-tenant logic)
  ↓
OpenClaw external-user agent
  (雞肉 prompt)
  ↓
雞肉 logic
  ↓
本地 CSV
```

### 7.2 規劃後（單租戶 + 規模化基礎）

```
LINE 用戶
  ↓
Cloudflare Worker
  (支援 TENANT_ID 環境變數)
  ↓
OpenClaw external-user agent
  (根據 TENANT_ID 動態載入 prompt)
  ↓
雞肉 logic
  (config.js 根據 TENANT_ID 載入 tenants/chicken.yaml)
  ↓
data/orders/chicken/*.csv
```

### 7.3 規模化後（多租戶，未來）

```
LINE 用戶 (雞肉)         LINE 用戶 (鴨肉)
  ↓                       ↓
Cloudflare Worker (共用，按 LINE account_id 路由)
  ↓                       ↓
OpenClaw Agent 1       OpenClaw Agent 2
  (chicken prompt)        (duck prompt)
  ↓                       ↓
雞肉 logic              鴨肉 logic
  (共用程式碼)            (共用程式碼)
  ↓                       ↓
data/orders/chicken/    data/orders/duck/
  ↓                       ↓
Google Sheets 1         Google Sheets 2
  (雞肉客戶)              (鴨肉客戶)
```

---

## 8. 時程規劃（按天）

依 Hubert 決策：不受「週」限制，按「天」延續。順序：Bug → 儀錶板/Google Sheet → 未來其他客戶SOP。

### Day 1-2：Bug 修補（程式碼 + Prompt + 測試）

| 時段 | 任務 |
|------|------|
| Day 1 上午 | 修 `dateRule.js` 加 `getNextOpenDate` + 改進錯誤訊息 |
| Day 1 下午 | 修 `timeSlotRule.js` 加合併驗證 + 改進錯誤訊息 |
| Day 2 上午 | 補 `tests/date.test.js` 涵蓋所有邊界 |
| Day 2 下午 | 修 prompt：`main_idea.md` 加強時間規則 + `SOUL.md` 加強不可錯誤資訊 |

### Day 3-4：SOP 完整版 + 多租戶規模化 Phase A

| 時段 | 任務 |
|------|------|
| Day 3 上午 | 撰寫 `docs/SOP.md` 完整版（含接手指南、部署、維運、故障排除）|
| Day 3 下午 | 多租戶 Phase A：把 `config.yaml` 移進 `config/tenants/chicken.yaml` |
| Day 4 上午 | 多租戶 Phase A：把 `knowledge/base/` 移進 `knowledge/tenants/chicken/` |
| Day 4 下午 | 多租戶 Phase A：把 `data/orders/` 移進 `data/orders/chicken/` + 測試 |

### Day 5：Google Sheets MVP（取代 CSV）

| 時段 | 任務 |
|------|------|
| Day 5 上午 | GCP 設定 + Sheets 模板 |
| Day 5 下午 | `sheetsWriter.js` 實作 + 測試 |

### Day 6：儀表板（選項 A — Sheets Dashboard）

| 時段 | 任務 |
|------|------|
| Day 6 全天 | 在 Sheets 中建立 dashboard（訂單總覽、營收分析、客戶分析）|

### Day 7：多租戶規模化 Phase B（介面抽象）

| 時段 | 任務 |
|------|------|
| Day 7 上午 | `config.js` 改用 `loadConfig(tenantId)` 介面 |
| Day 7 下午 | `knowledge/loader.js` + `csvWriter.js` 改用 tenant-aware 介面 |

### Day 8+：儀表板升級（選項 B — Cloudflare Worker + HTML）

| 時段 | 任務 |
|------|------|
| Day 8-9 | Cloudflare Worker 實作（讀 Sheets API）+ HTML dashboard |
| Day 10 | 測試 + 部署 |

### Day 11+：SOP 完整文件 + 接手演練

| 時段 | 任務 |
|------|------|
| Day 11 | 撰寫完整的 `docs/SOP.md`（含所有檢查清單、故障排除）|
| Day 12 | 模擬「另一個客戶接手」演練，驗證 SOP 完整性 |

---

## 9. 待 Hubert 決策的問題

我在動工前需要你確認：

### Q1：時程微調
- Day 1-2 修 Bug → Day 3-4 SOP + 多租戶 Phase A → Day 5 Google Sheets MVP → Day 6 儀表板 A → Day 7 多租戶 Phase B → Day 8+ 儀表板 B
- 這個時程你接受嗎？或要調整優先順序？

### Q2：多租戶 Phase A 範圍
- 「把檔案移到 tenant 目錄」是破壞性變更（要改 .git 路徑、所有 require 都要跟著改）
- 或是**保留向後相容**（檔案還在原處，但同時複製到 tenant 目錄）？
- 建議：保留向後相容，確保現有測試通過後再過渡

### Q3：Google Sheets 必要性
- 短期內 CSV 是否已經夠用？
- 還是確實需要 Sheets（因為要遠端查看）？

### Q4：儀表板選項
- 短期走選項 A（Sheets Dashboard，1 天）vs 直接選項 B（Cloudflare Worker + HTML，3-5 天）？
- 我的建議：A 先用，等 Google Sheets 整合完再看是否升級到 B

### Q5：規模化抽象程度
- 「抽離程度」要做到哪裡？
  - 方案 1：只抽離檔案路徑（最小）
  - 方案 2：抽離介面（`loadConfig(tenantId)`）+ 檔案路徑（推薦）
  - 方案 3：抽離所有 hardcoded 設定（最完整但工作量大）
- 我的建議：方案 2

### Q6：OpenClaw Agent 規模化
- 每個客戶獨立 agent（方案 C）vs 動態 prompt 切換（方案 B）？
- 我的建議：短期方案 C（不動 OpenClaw），長期評估方案 B

---

_本檔案為完整重新規劃，執行後會更新狀態為「已完成」_
