# 雞肉團購 AI 客服 — SOP 完整版

> 建立時間：2026-06-14 14:45 (Asia/Taipei)
> 維護者：brtclaw
> 性質：雞肉團購客服系統的完整標準作業流程，給未來其他客戶接手用
> 版本：v1.0

---

## 目錄

- [一、系統概述](#一系統概述)
- [二、人工設定清單](#二人工設定清單)
- [三、客製化標記](#三客製化標記)
- [四、部署步驟](#四部署步驟)
- [五、維運清單](#五維運清單)
- [六、故障排除](#六故障排除)
- [七、給接手者的指南](#七給接手者的指南)
- [八、常見任務檢查清單](#八常見任務檢查清單)

---

## 一、系統概述

### 系統架構

```
LINE 用戶
  ↓
Cloudflare Worker (LINE 訊息過濾)
  ├ LINE Signature 驗證
  ├ Rate Limiting（per-user）
  ├ Prompt/SQL Injection 偵測
  ├ 付款關鍵字攔截
  └ **Ignored Keywords 攔截**（NEW 2026-06-14）
  ↓
OpenClaw Gateway
  ↓
雞肉客服 Agent (external-user)
  ├ SOUL.md (核心準則)
  ├ AGENTS.md (工作區規範)
  └ knowledge/main_idea.md (完整 Prompt)
  ↓
雞肉 logic（src/）⚠️ **設計驗證 + 測試對象，非 production runtime**
  ├ Rules (地址/電話/品項/日期/時段/付款/金額)
  ├ States (IDLE/AWAITING_INFO/CONFIRMING/AWAITING_PAYMENT/COMPLETED)
  ├ Handoff (14 種情況轉真人)
  └ Order (CSV 訂單儲存)
  ↑ Production runtime = 上方 OpenClaw agent（external-user）+ knowledge/main_idea.md
  ↓
data/orders/{tenant_id}/{date}.csv
```

### 關鍵特性

- **多租戶規模化**：可支援多個客戶，每個客戶的設定/知識庫/訂單隔離
- **自動配送時間管控**：根據「配送日 × 下單時間」自動判斷是否可下單
- **Human Handoff 機制**：14 種情況自動轉真人
- **雲端 Worker 防護**：防止 prompt injection、SQL injection、過量請求
- **知識庫單一真相源**：商品菜單從 `01_product.md` 動態載入，修改自動同步

---

## 二、人工設定清單

### 2.1 品牌與付款資訊（最重要）

| 設定項 | 檔案位置 | 範例 | 備註 |
|--------|---------|------|------|
| **品牌名稱** | `config/tenants/{tenant}.yaml` → `tenant.display_name` | 雞味研究所 | 顯示在所有對外訊息 |
| **AI 名字** | `~/.openclaw/agents/{tenant}/SOUL.md` | 小雞 🐔 | |
| **銀行帳號** | `config/tenants/{tenant}.yaml` → `official.bank_account` | 007（第一銀行）\|\| 23257030422 | 用 \|\| 分隔多組 |
| **街口 QR Code** | `config/tenants/{tenant}.yaml` → `official.jko_qr_code_url` | https://...jpg | |
| **LINE Pay ID** | `config/tenants/{tenant}.yaml` → `official.line_pay.line_id` | Willy0221 | |

### 2.2 開團與配送

| 設定項 | 檔案位置 | 範例 | 備註 |
|--------|---------|------|------|
| **開團日期** | `config/tenants/{tenant}.yaml` → `open_dates` | 2026-06-16, 2026-06-18 | **每月初更新** |
| **配送範圍** | `config/tenants/{tenant}.yaml` → `delivery.areas.allowed` | 三峽、鶯歌 | 不可模糊 |
| **配送時段** | `config/tenants/{tenant}.yaml` → `delivery.hours` | am: 10:00~12:00, pm: 16:00~18:00 | |
| **免運門檻** | `config/tenants/{tenant}.yaml` → `delivery.minimum_order` | chicken: 半隻 380, side_dish_ntd: 350 | |
| **收單時間** | `config/tenants/{tenant}.yaml` → `cutoff` | order_close: 13:00, chicken_modify: 14:00, side_dish: 18:00 | |

### 2.3 安全與通知

| 設定項 | 檔案位置 | 範例 | 備註 |
|--------|---------|------|------|
| **白名單** | `config/tenants/{tenant}.yaml` → `security.allowed_line_users` | Uf56650056d35626deb64165926a26182 | 上線前啟用 |
| **block_others** | `config/tenants/{tenant}.yaml` → `security.block_others` | false | 預設開放，上線前改 true |
| **通知對象** | `config/tenants/{tenant}.yaml` → `handoff.notify_owner.line_user_id` | Uf56650056d35626deb64165926a26182 | 客服老闆 LINE user ID |
| **忽略關鍵字** | `config/tenants/{tenant}.yaml` → `ignored_keywords` | 我要訂購, 菜單, 常見問題 | 與 Worker 同步 |

### 2.4 知識庫（12 個檔案）

每個檔案都在 `knowledge/tenants/{tenant}/`：

| 檔案 | 內容 | 範例 |
|------|------|------|
| `01_product.md` | 商品菜單 | 19 個品項，含價格、規格、特色 |
| `02_order_flow.md` | 下單流程 | 收單時間規則（11:00/13:00/14:00/18:00）|
| `03_payment.md` | 付款方式 | 4 種方式 + 流程 |
| `04_delivery.md` | 配送範圍 | 完整可配送/不可配送/不確定 |
| `05_promotion.md` | 優惠活動 | 公告規則 |
| `06_faq.md` | 常見問題 | 至少 10 題 |
| `07_transfer_rules.md` | 轉真人條件 | 14 種情況 |
| `08_owner_info.md` | 老闆資訊 | 禁止對外透露 |
| `09_order_standard.md` | 接單 SOP | 10 步驟 |
| `10_customer_tags.md` | 客戶標籤 | 4 類 |
| `11_lead_followup.md` | 跟進話術 | 7 種情境 |
| `12_reply_examples.md` | 回覆範例 | 完整對話 |

### 2.5 OpenClaw Agent 設定

| 檔案 | 內容 | 必改項目 |
|------|------|---------|
| `SOUL.md` | 核心準則 | 品牌名稱、AI 名字、訂購截止時間、付款帳號 |
| `AGENTS.md` | 工作區規範 | 品牌名稱、上線日期、必轉真人清單 |
| `knowledge/main_idea.md` | 完整 Prompt | 品牌名稱、配送時間規則、付款方式 |

---

## 三、客製化標記

### 3.1 環境變數

| 變數 | 範例值 | 用途 |
|------|-------|------|
| `TENANT_ID` | chicken / duck | 決定讀哪個 tenant 的 config |
| `LINE_BOT_TOKEN` | xxx | 該 tenant 的 LINE Bot token |
| `LINE_CHANNEL_SECRET` | xxx | LINE channel secret |
| `JKO_QR_CODE_URL` | https://... | 街口 QR Code |
| `HUBERT_LINE_USER_ID` | Ufxxx | 通知對象（可改名） |

### 3.2 客製化檢查清單（給接手者）

接手時要修改的檔案清單（按優先順序）：

1. ☐ `config/tenants/{your_tenant}.yaml` — 改所有官方資訊、開團日期、配送範圍
2. ☐ `knowledge/tenants/{your_tenant}/01_product.md` — 改商品菜單
3. ☐ `knowledge/tenants/{your_tenant}/03_payment.md` — 改付款方式
4. ☐ `knowledge/tenants/{your_tenant}/04_delivery.md` — 改配送範圍
5. ☐ `knowledge/tenants/{your_tenant}/06_faq.md` — 改 FAQ
6. ☐ `knowledge/tenants/{your_tenant}/07_transfer_rules.md` — 檢查轉真人條件
7. ☐ `~/.openclaw/agents/{your_tenant}/SOUL.md` — 改品牌名稱與風格
8. ☐ `~/.openclaw/agents/{your_tenant}/AGENTS.md` — 改工作區規範
9. ☐ `~/.openclaw/agents/{your_tenant}/knowledge/main_idea.md` — 改完整 prompt
10. ☐ Cloudflare Worker secrets — 設定新的 LINE token

---

## 四、部署步驟（從零到上線）

### 步驟 1：建立 OpenClaw Agent

```bash
# 1. 複製範本（從現有 external-user 複製）
cp -r ~/.openclaw/agents/external-user ~/.openclaw/agents/your-tenant

# 2. 修改 SOUL.md
#    - 改品牌名稱、AI 名字
#    - 改付款帳號
#    - 確認配送時間規則
vim ~/.openclaw/agents/your-tenant/SOUL.md

# 3. 修改 AGENTS.md
#    - 改品牌名稱、上線日期
vim ~/.openclaw/agents/your-tenant/AGENTS.md

# 4. 修改 knowledge/main_idea.md
#    - 改品牌名稱
#    - 改配送時間規則（如果不同）
#    - 改付款方式
vim ~/.openclaw/agents/your-tenant/knowledge/main_idea.md

# 5. 設定環境變數
export LINE_BOT_TOKEN=...
export LINE_CHANNEL_SECRET=...
```

### 步驟 2：建立 Cloudflare Worker

```bash
# 1. 複製範本
cp -r ~/openclaw-workspace/external-user/cloudflare-worker ~/your-worker

# 2. 修改 wrangler.toml
#    - account_id
#    - worker name
#    - KV namespace id
vim ~/your-worker/wrangler.toml

# 3. 設定 secrets
cd ~/your-worker
echo "your-line-token" | wrangler secret put LINE_ACCESS_TOKEN
echo "your-line-secret" | wrangler secret put LINE_CHANNEL_SECRET

# 4. 建立 KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
# 把 id 填入 wrangler.toml

# 5. Deploy
wrangler deploy
```

### 步驟 3：設定 LINE 官方帳號

```
1. LINE Developers 建立官方帳號
2. 取得 Channel Access Token + Channel Secret
3. 設定 Webhook URL：https://{your-worker}.workers.dev/webhook
4. 開啟 Webhook，關閉 Auto-reply
5. 設定關鍵字回覆（菜單、常見問題等 6 個）
6. 設定 Rich Menu（六宮格）
```

### 步驟 4：建立雞肉專案 tenant 配置

```bash
# 1. 複製 tenant 範本
cp -r config/tenants/chicken config/tenants/your-tenant

# 2. 修改所有設定（見 §2 人工設定清單）
vim config/tenants/your-tenant.yaml

# 3. 複製知識庫
cp -r knowledge/tenants/chicken knowledge/tenants/your-tenant
# 修改知識庫內容（見 §2.4）

# 4. 設定環境變數
export TENANT_ID=your-tenant
```

### 步驟 5：測試

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
node tests/whitelist.test.js
node tests/security.test.js
node tests/states.test.js
node tests/integration.test.js

# 4. 用真實 LINE 帳號測試
# 5. 驗證 Webhook 設定
```

### 步驟 6：上線

```bash
# 1. 確認安全設定
#    - config/tenants/{tenant}.yaml → security.block_others: true
#    - 白名單包含要使用的測試帳號

# 2. 切換 production 環境變數
export TENANT_ID=your-tenant
export NODE_ENV=production

# 3. 重新啟動 OpenClaw gateway
openclaw gateway restart

# 4. 監控
tail -f ~/.openclaw/logs/gateway.log
```

---

## 五、維運清單

### 5.1 定期任務

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

### 5.2 開團日更新 SOP

```bash
# 每月 1 號執行
# 1. 確認下個月的開團日期
# 2. 編輯 config/tenants/{tenant}.yaml
#    找到 open_dates: 區塊
#    新增下個月的開團日期
# 3. 重啟 OpenClaw gateway
# 4. 公告 LINE 社群
```

### 5.3 價格/品項更新 SOP

```bash
# 1. 修改 knowledge/tenants/{tenant}/01_product.md
#    （這是商品資料的單一真相源）
# 2. 自動同步到所有驗證邏輯（menuRule.js）
# 3. 測試
node tests/rules.test.js
# 4. 不需要重啟（除非有 cache 機制）
```

---

## 六、故障排除

### 6.1 常見問題

| 問題 | 症狀 | 排查步驟 |
|------|------|---------|
| **Webhook 沒回應** | 客戶送訊息沒收到任何回覆 | 1. 檢查 Worker status / 2. 檢查 KV / 3. 檢查 OpenClaw gateway / 4. 檢查 LINE Webhook 設定 |
| **重複回覆** | 客戶收到兩次回覆 | 1. 檢查 LINE 關鍵字回覆是否關閉 / 2. 檢查 OpenClaw 是否有兩個 agent 接到 |
| **客戶被阻擋** | 非白名單用戶 | 1. 檢查 `config.security.allowed_line_users` / 2. 檢查 `block_others` 設定 |
| **Handoff 沒通知** | 客戶被轉真人但 Hubert 沒收到通知 | 1. 檢查 `handoff.notify_owner.line_user_id` / 2. 檢查 LINE token / 3. 檢查 log |
| **訂單沒寫入 CSV** | handoff 觸發但 CSV 沒更新 | 1. 檢查 `data/orders/{tenant}/` 權限 / 2. 檢查磁碟空間 / 3. 檢查 TENANT_ID 環境變數 |
| **晚上下單未阻擋** | 客戶晚上 8 點想訂今天配送，AI 沒阻擋 | 1. 檢查 main_idea.md 第九章「收單時間規則」/ 2. 檢查 SOUL.md「訂購截止時間」|
| **推薦錯誤的開團日** | AI 推薦明天或不存在的日期 | 1. 檢查 config.open_dates / 2. 檢查 main_idea.md「下一個開團日查詢」|
| **商品價格錯誤** | AI 回答的價格與菜單不同 | 1. 檢查 knowledge/tenants/{tenant}/01_product.md / 2. 確認 menuRule.js 從此檔載入 |

### 6.2 緊急應變

| 情況 | 聯繫人 | 方式 |
|------|--------|------|
| 系統故障 | brtclaw | Discord |
| 知識庫錯誤 | Hubert | Discord |
| 安全事件 | brtclaw + Hubert | Discord |
| LINE 帳號被封 | Hubert + LINE 客服 | |

### 6.3 緊急停用

```bash
# 1. 停止 Cloudflare Worker
wrangler rollback

# 2. 關閉 LINE Webhook（在 LINE Developers Console）

# 3. 切換 block_others: true
vim config/tenants/{tenant}.yaml
# security:
#   block_others: true

# 4. 重啟 OpenClaw gateway
openclaw gateway restart
```

---

## 七、給接手者的指南

### 7.1 你需要了解的事

接手前，你必須了解：
1. **本系統是 OpenClaw 框架 + 雞肉客服 logic 的組合**
2. **設計文件在 `docs/` 目錄**（MULTI_TENANT_DESIGN.md, SOP.md, REVIEW_*.md）
3. **程式碼結構在 `src/`**（rules/states/handoff/order/utils/knowledge）
4. **測試在 `tests/`**（11 套單元測試 + 2 套整合測試，200+ 案例；2026-06-26 更新）

### 7.2 接手步驟

```
1. 讀完這份 SOP.md
2. 讀 MULTI_TENANT_DESIGN.md（了解多租戶設計）
3. 讀 REVIEW_2026-06-14_FINAL_PLAN.md（了解規劃脈絡）
4. 跑全部測試，確認 0 failure
5. 用「接手演練」清單（§7.3）驗證自己會用
6. 開始建立你的 tenant
```

### 7.3 接手演練（驗收清單）

完成這些任務證明你已準備好接手：

- [ ] 跑 `npm test`，確認 11 套單元測試全綠（含 P0-1/P0-2/P0-3 新增 3 套）
- [ ] 跑 `npm run test:api-server` 跟 `npm run test:dashboard-server`，確認整合測試全綠
- [ ] 修改 `config/tenants/chicken.yaml` 的某個設定（例如品牌名稱），重啟後生效
- [ ] 修改 `knowledge/tenants/chicken/01_product.md` 的某個品項價格，測試驗證邏輯生效
- [ ] 模擬晚上 8 點客戶想訂今天配送，確認 validateDate 正確擋下
- [ ] 模擬非開團日，確認 getNextOrderableOpenDate 推薦正確
- [ ] 模擬 handoff 觸發，確認 CSV 寫入正確
- [ ] 建立一個新的 `config/tenants/test-tenant.yaml`，驗證多租戶切換
- [ ] 設定 block_others: true，確認白名單外用戶被阻擋
- [ ] 部署 Worker 到 staging 環境，確認與 production 一致
- [ ] 寫一份自己的 SOP，補充這個沒涵蓋的情境

### 7.4 客製化建議

接手後可以客製化的部分（不影響核心邏輯）：
- ✅ 改品牌名稱、付款方式
- ✅ 改配送範圍、收單時間
- ✅ 改商品菜單（01_product.md）
- ✅ 改 FAQ、回覆範例
- ✅ 改 AI 名字、說話風格

不要客製化（會破壞核心邏輯）：
- ❌ 不要改 rules/ 內的判斷邏輯（除非理解全部影響）
- ❌ 不要改 states/ 內的狀態轉換
- ❌ 不要改 handoff/ 內的 14 種觸發條件
- ❌ 不要改 config.js 內的 YAML 載入邏輯
- ❌ 不要改 tests/（測試是設計驗證）

---

## 八、常見任務檢查清單

### 任務：新增開團日

- [ ] 編輯 `config/tenants/{tenant}.yaml`
- [ ] 在 `open_dates:` 區塊新增日期
- [ ] 重啟 OpenClaw gateway
- [ ] 公告 LINE 社群
- [ ] 跑 `node tests/config.test.js` 確認載入正確

### 任務：修改商品價格

- [ ] 編輯 `knowledge/tenants/{tenant}/01_product.md`
- [ ] 跑 `node tests/rules.test.js` 確認驗證邏輯正確
- [ ] 公告 LINE 社群（如適用）
- [ ] 不需重啟（動態載入）

### 任務：新增 handoff 觸發

- [ ] 編輯 `src/handoff/transferRules.js` 的 TRIGGER_PATTERNS
- [ ] 編輯 `src/handoff/notificationFormat.js` 的 HANDOFF_TITLES
- [ ] 跑 `node tests/handoff.test.js` 確認觸發邏輯正確
- [ ] 跑 `node tests/integration.test.js` 確認整合邏輯正確
- [ ] 更新 `knowledge/tenants/{tenant}/07_transfer_rules.md` 文檔

### 任務：新增客戶

- [ ] 完整 §四 部署步驟
- [ ] 完整 §七.3 接手演練
- [ ] 公告 LINE 社群

### 任務：緊急停用

- [ ] 完整 §6.3 緊急停用步驟
- [ ] 通知所有相關人員

---

_本檔案持續更新中。最新版本永遠在 `docs/SOP.md`_
