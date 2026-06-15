# 多租戶規模化設計

> 建立時間：2026-06-14 14:30 (Asia/Taipei)
> 維護者：brtclaw
> 狀態：✅ Phase A + B 完成（向後相容，多租戶支援就緒）
> 性質：為未來多客戶複製設計的完整方案

---

## 一、設計原則

1. **規模化先行**：在規劃階段就設計支援多租戶的資料結構與介面
2. **向後相容**：現有雞肉客戶無需任何改動即可繼續運作
3. **邏輯共用**：rules / states 邏輯通用，不因客戶而異
4. **設定隔離**：所有客戶特定資料放在自己的目錄
5. **介面抽象**：未來若要做完全多租戶，介面要能支援動態切換

## 二、檔案結構（已實作）

```
chicken-group-buying-customer-service/
├── config/
│   ├── default.yaml                    # （未來）預設值，所有客戶共用
│   └── tenants/
│       ├── chicken.yaml                # 雞肉客戶的設定（從 config.yaml 移入）
│       └── [未來]_duck.yaml            # 未來鴨肉客戶
│
├── knowledge/
│   ├── base/                           # 向後相容：原檔案位置保留
│   │   └── 12 個知識檔案
│   ├── learned/                        # 向後相容
│   └── tenants/
│       └── chicken/                    # 雞肉客戶的知識庫（從 base/ 移入）
│           └── 12 個知識檔案
│
├── data/
│   └── orders/
│       ├── .gitkeep                    # 向後相容
│       └── chicken/                    # 雞肉客戶的訂單（從 orders/ 移入）
│           └── 2026-06-13.csv
│
├── src/
│   ├── config.js                       # ✅ 已升級：支援 TENANT_ID 環境變數
│   ├── knowledge/loader.js             # ✅ 已升級：tenant-aware 路徑
│   ├── order/csvWriter.js              # ✅ 已升級：tenant-aware 路徑
│   ├── order/csvReader.js              # ✅ 已升級：tenant-aware 路徑
│   ├── order/orderIdGenerator.js       # ✅ 已升級：tenant-aware 路徑
│   ├── rules/                          # 共用邏輯（所有客戶通用）
│   ├── states/                         # 共用邏輯
│   └── handoff/                        # 共用邏輯
│
└── docs/
    ├── MULTI_TENANT_DESIGN.md          # 本文件
    ├── SOP.md                          # 完整 SOP
    └── ...
```

## 三、介面設計（已實作）

### 3.1 `config.js`

```js
// 環境變數
process.env.TENANT_ID = 'chicken' // 預設為 chicken（向後相容）

// 路徑解析邏輯（多租戶 → 向後相容 fallback）
const TENANT_CONFIG_PATH = config/tenants/{TENANT_ID}.yaml
const LEGACY_CONFIG_PATH = config.yaml
function resolveConfigPath() {
  if (TENANT_CONFIG_PATH 存在) return TENANT_CONFIG_PATH
  if (LEGACY_CONFIG_PATH 存在) return LEGACY_CONFIG_PATH
  throw new Error(...)
}

// 介面（向下相容）
const { getTenantId, getConfigPath, getOpenDates, getIgnoredKeywords, ... } = require('./config')
```

### 3.2 `knowledge/loader.js`

```js
// 路徑解析
const TENANT_KB_PATH = knowledge/tenants/{TENANT_ID}/
const LEGACY_KB_PATH = knowledge/base/
// 自動選擇存在的路徑
```

### 3.3 `order/csvWriter.js`、`csvReader.js`、`orderIdGenerator.js`

```js
// 路徑解析
const TENANT_DATA_DIR = data/orders/{TENANT_ID}/
const LEGACY_DATA_DIR = data/orders/
// 自動選擇存在的路徑
```

## 四、向後相容驗證

```bash
# 行為不變
$ cd /path/to/chicken-group-buying-customer-service
$ node tests/rules.test.js    # 34/34 ✅
$ node tests/handoff.test.js  # 33/33 ✅
$ node tests/date.test.js     # 全通 ✅
$ node tests/config.test.js   # 全通 ✅
# ... 8 套全綠
```

## 五、OpenClaw Agent 規模化（方案 C）

### 5.1 現狀

每個客戶要單獨建一個 OpenClaw agent：
- `~/.openclaw/agents/external-user/` — 雞肉（已存在）
- 未來要新增 `~/.openclaw/agents/{tenant_id}/` — 其他客戶

### 5.2 路徑結構

```
~/.openclaw/agents/
├── external-user/        # 雞肉客戶（向後相容，繼續使用這個名稱）
│   ├── SOUL.md
│   ├── AGENTS.md
│   ├── USER.md
│   └── knowledge/
│       └── main_idea.md
│
├── duck/                 # 未來鴨肉客戶
│   ├── SOUL.md
│   ├── AGENTS.md
│   ├── USER.md
│   └── knowledge/
│       └── main_idea.md
│
└── [其他客戶]/
```

### 5.3 Worker 端路由（待實作）

```typescript
// cloudflare-worker/src/index.ts
const TENANT_ROUTING = {
  // LINE channel_id → OpenClaw agent 路徑
  '534zsteg': '/line/534zsteg',  // 雞肉（現行設定）
  // 未來新增：
  // 'XXXXXXX': '/line/duck',
};

async function forwardToOpenClaw(event, env) {
  // 根據 event.destination 判斷 tenant
  const tenant = TENANT_ROUTING[event.destination] || 'default';
  const openclawPath = TENANT_ROUTING[tenant];
  // 轉發到對應的 OpenClaw webhook
  // ...（程式碼實作）
}
```

## 六、新增第二個客戶的步驟

### Step 1：建立目錄結構
```bash
mkdir -p config/tenants/duck
mkdir -p knowledge/tenants/duck
mkdir -p data/orders/duck
```

### Step 2：複製範本
```bash
cp config/tenants/chicken.yaml config/tenants/duck.yaml
cp -r knowledge/tenants/chicken/* knowledge/tenants/duck/
```

### Step 3：修改範本
- `config/tenants/duck.yaml`：改所有品牌、付款、配送資訊
- `knowledge/tenants/duck/*.md`：改商品、配送、FAQ 等

### Step 4：建立 OpenClaw Agent
```bash
cp -r ~/.openclaw/agents/external-user ~/.openclaw/agents/duck
# 修改 SOUL.md / AGENTS.md / main_idea.md
```

### Step 5：建立 Cloudflare Worker（或共用）
- 每個客戶一個 Worker，或共用 Worker 但 routing 不同

### Step 6：設定環境變數
```bash
# 在 OpenClaw 啟動時設定
export TENANT_ID=duck
# Worker 對應 LINE channel
```

### Step 7：測試
- 用真實 LINE 帳號測試
- 跑全部測試

## 七、規模化的取捨

**不做**的事（避免過度工程）：
- ❌ 過度抽象成 framework
- ❌ 動態 prompt 系統（OpenClaw 改動大）
- ❌ 完整 multi-tenant SaaS 架構

**要做**的事（合理抽象）：
- ✅ 檔案結構支援多租戶
- ✅ 介面支援 tenantId 參數
- ✅ 設定與資料隔離
- ✅ 範本可複製
- ✅ 環境變數切換

## 八、未來 Roadmap

| 階段 | 內容 | 預估時間 |
|------|------|---------|
| Phase A | 檔案抽離（路徑 tenant 化）| ✅ 完成（2026-06-14）|
| Phase B | 介面抽象（加 tenantId 參數）| ✅ 完成（2026-06-14）|
| Phase C | 第二個客戶時再做完全抽象 | 未來 |
| Phase D | OpenClaw 動態 prompt 切換 | 未來 |

## 九、常見問題

### Q1：為什麼不一次做完整 multi-tenant？
A：過早抽象會增加複雜度，沒有第二個客戶前不需要。Phase A + B 已經預留介面，未來擴展只需新增 `tenants/{new_tenant}/` 即可。

### Q2：config.yaml 要不要刪除？
A：保留！作為 fallback 機制，避免新環境沒有 `config/tenants/{TENANT_ID}.yaml` 時整個系統崩潰。

### Q3：客戶改了設定需要重啟嗎？
A：是的，目前 `config.js` 在 module load 時載入設定。改完設定後需要重啟 OpenClaw gateway。

### Q4：兩個客戶的設定會不會混淆？
A：不會。每個客戶讀自己的 `config/tenants/{tenant_id}.yaml`，透過 `TENANT_ID` 環境變數決定。
