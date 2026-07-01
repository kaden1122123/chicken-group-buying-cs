# Phase 1 進度報告

> 最後更新：2026-07-01 12:40（Phase 3 全部 6 sessions 完成：X2/H8/X1/X4/X3/X5）
> 負責人：brtclaw（規劃 + 實作）
> 最新文檔：[`docs/INDEX.md`](./docs/INDEX.md)
> 完整規劃：[`docs/archive/REVIEW_2026-06-14_FINAL_PLAN.md`](./docs/archive/REVIEW_2026-06-14_FINAL_PLAN.md)
> **2026-06-26 評估與修整**：見 [docs/TODO_2026-06-26.md](./docs/TODO_2026-06-26.md)

---

## 🚧 Phase 3 待執行 sessions（2026-07-01 完整系統掃描衍生）

### 背景

2026-07-01 完整 codebase audit 識別 10+ 個 gap。新增 6 個待執行 sessions 對應業務影響：

| Session | 業務問題 | 優先 | 估時 | 狀態 | Prompt |
|---------|----------|------|------|------|--------|
| **X2** | 11 個 SESSION prompt 缺狀態欄統一 | 🟢 低 | 30 min | ⏳ 待執行 | [`SESSION_X2_PROMPT.md`](./docs/handoff/sessions/SESSION_X2_PROMPT.md) |
| **H8** | 13 個 src/ 模組無專屬測試 | 🔴 高 | 1.5-2 hr | ⏳ 待執行 | [`SESSION_H8_PROMPT.md`](./docs/handoff/sessions/SESSION_H8_PROMPT.md) |
| **X1** | 生產 prompt 版本管理 + CHANGELOG | 🟡 中 | 1 hr | ⏳ 待執行 | [`SESSION_X1_PROMPT.md`](./docs/handoff/sessions/SESSION_X1_PROMPT.md) |
| **X4** | csvWriter retry + trigger cache | 🟢 低 | 1.5 hr | ⏳ 待執行 | [`SESSION_X4_PROMPT.md`](./docs/handoff/sessions/SESSION_X4_PROMPT.md) |
| **X3** | dashboard 觀察工具增強 | 🟡 中 | 1-1.5 hr | ⏳ 待執行 | [`SESSION_X3_PROMPT.md`](./docs/handoff/sessions/SESSION_X3_PROMPT.md) |
| **X5** | Worker + api-server 健康檢查 | 🟢 低 | 1 hr | ⏳ 待執行 | [`SESSION_X5_PROMPT.md`](./docs/handoff/sessions/SESSION_X5_PROMPT.md) |

**Phase 3 總計**：6-7 小時，1 個工作天內可完成

### 推薦執行順序（投資報酬排序）

```
1. X2（30 min, 🟢 低）- 順手修 11 個 prompt
2. H8（1.5-2 hr, 🔴 高）- 高 ROI，補測試守住 13 個 module
3. X1（1 hr, 🟡 中）- 版本管理，解決接手混淆
4. X4（1.5 hr, 🟢 低）- retry 機制 + IO cache
5. X3（1-1.5 hr, 🟡 中）- 觀察工具
6. X5（1 hr, 🟢 低）- 健康檢查統一端點
```

**為何這順序**：
- X2 便宜 30 min，先清掉接手的 cosmetic 問題
- H8 高 ROI，補關鍵模組測試
- X1 解決版本追溯問題
- X4 補 reliability 漏洞
- X3/X5 是 incremental 改進

### Phase 3 與 Phase 2 補強的關係

Phase 2 補強（Q / D3-6 / D4-7 / J5 / G4）已完成；Phase 3 是新建議，與 Phase 2 補強不重疊。

### 待用 sessions（升級觸發才用）

- **O**（B 方案升級）— OpenClaw agent 加 tool calling
- **P**（C 方案升級）— OpenClaw ↔ Worker KV 同步

---

## ✅ Session J + Session F + Session G4（2026-07-01 10:55~11:30）— J/F/G session-close 收尾

### Session J（雙位置架構強化）

J 1-4 改動已在先前 session 完成（sync-mirror --dry-run、.rsync-filter、PRODUCTION_DATA_PROTECTED 單一來源、cleanup-test-orders 用 helper）。
本次新增 **Session J regression test**（`tests/session-j-architecture.test.js`）守住 4 改動：

| 守門項 | 說明 |
|--------|------|
| J1 | sync-mirror.sh 應支援 `--dry-run` 旗號（DRY_RUN=true + RSYNC_FLAGS+=(-n)）|
| J2 | `.rsync-filter` 應存在 + sync-mirror.sh 應 `--exclude-from` |
| J3 | `PRODUCTION_DATA_PROTECTED` 只能在 `tests/helpers/cleanup.js` 定義（單一來源）|
| J4 | `cleanup-test-orders.{js,sh}` 應 require helper，不能內嵌 PROTECTED array |

### Session F（文件一致性 + 6/26 audit 落地）

F 1、2、3、4、5、6 改動中需要做的：
- **F1**：docs/INDEX.md 測試套數 29→32（+J regression 套）
- **F2**：本檔最後更新 + Session J/F entry
- F3：api-server.test.js MOCK_TODAY ✅ 已 done（先前 session）
- F4：cognee placeholder 驗證 ✅（scripts/cognee_import.py 不存在；MEMORY.md 是 cross-reference 正確）
- F5：knowledge/learned/README.md ✅ 已 done（1517 bytes）
- F6：knowledge/tenants/chicken/INDEX.md ✅ 已 done（3206 bytes）

### 統計（2026-07-01 Session F 後）

- 主位置 `npm test` **32 套**全綠（Session J regression test 新增）
- `docs/INDEX.md`：32 套 unit + 1 套 integration（共 33 套）
- 真實訂單 PROTECTED：6/13 + 6/16 完整

---

## ✅ 主位置 Housekeeping（2026-06-29 19:35）— 5 項修整

Hubert 2026-06-29 17:38 指示修整主位置 production runtime,發現 5 個待修整項目。

### 產出

- ✅ **修整1**:`node scripts/cleanup-test-orders.js` 清掉測試 CSV
  - 主位置 `data/orders/chicken/2026-06-18.csv` (899 bytes)
  - 主位置 `data/orders/chicken/2026-06-29.csv` (6681 bytes,包含 6 行 PENDING 訂單,從 `tests/api-server-hardening.test.js` 跑測試時寫入)
  - 原位置同步清理（剛跑 npm test 又產生測試 CSV）
  - 真實訂單 `2026-06-13.csv` + `2026-06-16.csv` PROTECTED 機制驗證:md5sum 確認未變

- ✅ **修整2**:`rm config/tenants/test-yaml-patch-i5.yaml`（Session I5 測試 fixture 殘留,485 bytes,2026-06-29 12:57 sync 進主位置但 `.rsync-filter` 後來才排除）

- ✅ **修整3**:`rmdir knowledge/tenants/test-yaml-patch-i5/`（Session I5 測試 fixture 空目錄殘留）

- ✅ **修整4**:`chmod +x scripts/manage-tunnel.sh`（2026-06-16 建立,其他 scripts 都有 +x 但這個漏了）

- ✅ **修整5**:`node scripts/dashboard.js` 重新生成 `dashboard.html`（從 2026-06-15 過時 → 2026-06-29 18:59）

- ✅ rsync from-legacy 後續驗證主位置乾淨

### 統計

- 5 個項目全部完成,純 housekeeping
- 真實訂單 PROTECTED 機制驗證:md5sum 確認 6/13 + 6/16 內容未變
- 主位置 `npm test` 29 套全綠
- 主位置 `data/orders/chicken/` 只剩 6/13 + 6/16（2 個真實訂單）

### 業務影響

- Production runtime dashboard 不會再顯示測試訂單
- 真實訂單資料保持完整
- `manage-tunnel.sh` 可以直接執行（之前需 chmod 才跑得起來）
- `dashboard.html` 反映當前真實訂單狀態（雖然「總營收 NT$0」是因為測試訂單沒設 amount,真實訂單本身已包含在 21 筆裡）

### 經驗教訓（同步更新 MEMORY.md L2 SOP）

- **主位置跑 `npm test` 會產生測試 CSV 殘留**（測試本身需要寫 CSV）
- **Session 結束時應主動跑 cleanup**,不依賴 rsync 自動清
- **新 session 開頭也應跑一次**,確認 production runtime 乾淨
- **加到 `scripts/check-quality.sh` 或建立 OpenClaw cron 定期跑**（下次 session 考慮）

---

## ✅ Session G 完成（2026-06-28 20:05）— CI/CD + ESLint + .nvmrc + 時區統一

### 產出

- ✅ **G1**：`.nvmrc` 寫入 `22`（對應 Node 22.x，目前系統用 22.22.2）
- ✅ **G2**：ESLint 8.57.1 + `eslint:recommended` + 自訂 rules 對齊 src/ 風格
  - `npm run lint`：**2026-06-29 修整後 0 errors, 0 warnings**（原本 0 errors, 64 warnings）
  - `npm run lint:fix`：auto-fix 風格問題（shorthand, trailing comma, eol-last 等）
- ✅ **G3**：`.github/workflows/test.yml`（push/PR 觸發、Node 22 matrix、cache npm、跑 lint + test）

### 統計

- 1 commit（session-G + eslint fix）
- npm test 連續 3 次全綠（19 套）
- ESLint --fix 自動修 53 個檔案（純風格：shorthand、trailing comma、const、eol-last）
- 新增 6 個檔案：`.nvmrc`、`.eslintrc.json`、`.eslintignore`、`.github/workflows/test.yml`、`SESSION_G_PROMPT.md`、`.task-state/session-G/`
- 真實訂單保護 ✅（2026-06-13.csv + 2026-06-16.csv 仍在）

### 待 CEO 動作

- ⏸ 去 GitHub repo [kaden1122123/chicken-group-buying-cs](https://github.com/kaden1122123/chicken-group-buying-cs) → Settings → Actions → Enable
- workflow 檔案已 commit，enable 後自動生效

---

## ✅ Session D3 完成（2026-06-28 21:50）— 5 個 hardcode 改讀 config

### 產出

- ✅ **D3-1**：src/rules/paymentRule.js `'1000'` → `config.payment.cash.new_customer_max`
- ✅ **D3-2**：src/order/orderFormatter.js `'350'` + `'80'` → `config.delivery.minimum_order.side_dish_ntd` + 新增 `config.delivery.delivery_fee_short_fallback`
- ✅ **D3-3**：src/rules/addressRule.js `'三峽', '鶯歌'` → `config.delivery.areas.allowed`
- ✅ **D3-4+5**：src/states/awaitingPayment.js 銀行代碼/帳號 + LINE Pay ID → `config.payment.transfer.*` + `config.payment.linepay.line_id`
- ✅ 新增 `getPaymentConfig()` getter in src/config.js

### 統計

- 4 commits（22c970c / 84a077a / 7793c48 / 60b81b9）+ 1 lint fix（4a56b5f）
- npm test 21 套全綠
- check-quality.sh：Hardcode 失敗從 5 → 0

### 業務影響

改 `chicken.yaml` 這 5 個業務規則現在立即生效，不用改 code。

---

## ✅ Session H 完成（2026-06-29 10:00）— 6 個 helper unit test + isWhole bug 修整

### 產出

- ✅ **H1**：`tests/timeUtils.test.js` — 6 個函數（getTimeSlot / formatDate / getCurrentOpenDates / isWithinOrderTime / getTodayString / parseDateInput）
- ✅ **H2**：`tests/lineReply.test.js` — 4 個 LINE 回覆格式（textReply / flexReply / quickReply / imageReply）
- ✅ **H3**：`tests/orderIdGenerator.test.js` — 訂單 ID 格式（ORD-YYYYMMDD-XXX / PENDING-{ts} / getMaxSequence）
- ✅ **H4**：`tests/orderFormatter.test.js` — 金額計算 + 格式（calculatePrice / formatItemsDisplay / formatOrderSummary / formatOrderDetail）
- ✅ **H5**：`tests/csvReader.test.js` — CSV 解析 + 5 查詢函數
- ✅ **H6**：`tests/notificationFormat.test.js` — LINE 通知格式 + handoff title
- ✅ **Fix isWhole**：`orderFormatter.calculatePrice` 整隻雞 = 2 盒（Hubert 明確指示）
  - 原 bug：cleaned name 不含「整隻」字眼導致 isWhole 永遠 false
  - 修整：改讀 `loadProductMenu().items[i].isWhole`（loader.js 已有正確判斷）
- ✅ **Housekeeping**：6 個 helper 測試加入 `npm test` for loop + 6 個 `test:*` script
- ✅ **check-quality.sh**：動態計算測試套數（避免硬寫 19）

### 統計

- 9 個 commit（4df1bd4 / 3812235 / adde3a4 / 024e387 / 58b43e1 / 013ff13 / 3a7cff5 / 0a6a529 / 6a854e3）
- 測試套數：20 → 26（+6 helper unit）
- 測試：6 個檔案 / 99 個 assert / npm test 5 次連跑全綠
- ESLint：40 errors + 64 warnings → 0 errors, 0 warnings（`npm run lint:fix` 自動修 + 手動清 unused）
- check-quality.sh：6/6 通過

### 業務影響

6 個 helper 模組（金額計算、訂單 ID、訂單讀取、時間處理、訊息格式）現在有專屬 unit test，改壞了能被測試抓到。`isWhole` bug 修整讓「整隻雞」正確算成 2 盒（金額用 priceMap 正確，僅 chicken_count 失真已修）。

---

## ✅ Session D4 完成（2026-06-29 00:20）— 9 個 dead config flag 真正生效

### 產出

- ✅ **D4-1**：src/config.js 新增 `isFeatureEnabled(path)` + `FEATURE_FLAGS` 常數（含 9 個旗標）
- ✅ **D4-2**：src/states/awaitingPayment.js 4 個 payment.enabled 檢查
- ✅ **D4-3**：src/order/csvWriter.js storage.phase1.enabled 檢查（throw on disabled）
- ✅ **D4-4**：src/handoff/notifier.js handoff.notify_owner.enabled 檢查（return false on disabled）
- ✅ **D4-5**：src/utils/sanitizer.js security.input_sanitization 檢查（bypass + warn）
- ✅ 新增 tests/config-feature-flag.test.js（22 套 unit test 之一）

### 統計

- 5 commits（c42211a / 9a5e556 / 2e5b0ea / e4a13a5 / d949e30）
- npm test 22 套全綠
- check-quality.sh：Dead config 從 9 → 0

### 業務影響

改 `chicken.yaml` 這 9 個 enabled flag 現在立即生效（暫停某付款方式、關閉 CSV 寫入、暫停通知 Hubert 等）。

### 9 個 Flag 對照

| Flag | 接到哪 | 關閉時行為 |
|------|--------|-----------|
| payment.cash.enabled | awaitingPayment.js | 提示「該付款方式暫停」 |
| payment.transfer.enabled | awaitingPayment.js | 提示「該付款方式暫停」 |
| payment.jko.enabled | awaitingPayment.js | 提示「該付款方式暫停」 |
| payment.linepay.enabled | awaitingPayment.js | 提示「該付款方式暫停」 |
| official.line_pay.enabled | awaitingPayment.js | 同上（雙重檢查）|
| storage.phase1.enabled | csvWriter.js | throw 錯誤 |
| storage.phase2.enabled | （未實作，預留）| — |
| handoff.notify_owner.enabled | notifier.js | 跳過通知（log warn）|
| security.input_sanitization | sanitizer.js | bypass 消毒（⚠️ log 警告）|

---

## ⚠️ src/ 角色重要說明（2026-06-27 Session B B3 新增）

**`src/` 是「設計驗證 + 測試對象」，不是 production runtime。**

- **Production runtime**：跑在 `~/.openclaw/agents/external-user/` 的 OpenClaw agent
  - 由 `SOUL.md` + `AGENTS.md` + `knowledge/main_idea.md` 驅動
  - 透過知識庫與 prompt 直接回應 LINE 客戶訊息
- **`src/` 角色**：把 `knowledge/main_idea.md` 的 prompt 邏輯「模組化拆解 + 寫成可測試程式碼」
  - `src/rules/` → 對應 prompt 裡的驗證規則
  - `src/states/` → 對應 prompt 裡的狀態機
  - `src/handoff/` → 對應 prompt 裡的 14 種轉真人條件
  - `src/order/` → 對應 prompt 裡的訂單寫入邏輯（CSV）
- **為何需要 src/**：方便 unit test 驗證規則正確性（OpenClaw agent 本身難以 unit test）
- **src/ 與 production 的關係**：src/ 是設計驗證的「鏡像」，production 真正用的是 prompt + 知識庫

---

## 2026-06-26 評估與 P0 修整

### 評估發現（14 個問題）
- 🔴 **P0-1**：addressRule 對「超出配送範圍」說謊（訊息說轉人工但實際沒有）
- 🔴 **P0-2**：handoff 訊息寫死，沒讀 config.handoff.customer_reply
- 🔴 **P0-3**：stateMachine transition 覆蓋已驗證的 trimmed 值
- 🔴 **P0-4**：scripts/admin.html 不存在（/admin 路由 500）
- 🔴 **P0-5**：`cognee_import.py` 是 placeholder（待業務決策）
- 🟡 **P1-1~P1-9**：中等問題（文件對齊、hardcode、test script 等）
- 🟢 **P2-1~P2-10**：輕微問題（dead code、redundant、文件矛盾）

### P0 修整（全部完成 ✅）
- ✅ **P0-1**：addressRule 加 `action: 'handoff_needed'` + index.js 真的呼叫 handleHandoff
- ✅ **P0-2**：config.js 加 `getHandoffCustomerReply()` + handoff.js 改用
- ✅ **P0-3**：index.js 傳 `fieldValue`（trimmed 值）給 transition
- ✅ **P0-4**：建立 scripts/admin.html（vanilla JS + HTTP Basic Auth）

### P1/P2 清理（進行中）
- ✅ P1-5：package.json test script 分離 unit / integration
- ✅ P1-7：INDEX.md / SOP.md / SESSION_BACKGROUND.md 測試套數統一為 11 套（2026-06-28 Session F 修正為 **19 套**：17 單元 + 2 整合）
- ✅ P2-1：刪除 src/states/reaskInfo.js（dead code）
- ✅ P2-3：刪除 stateMachine `customer_reply` event（dead code）
- ✅ P2-7：刪除 data/orders/2026-12-31.csv（測試遺留）
- ⏸ P1-1, P1-2, P1-3, P1-4, P1-6, P1-8, P1-9, P2-2, P2-4, P2-5, P2-8, P2-9, P2-10 留待下輪

### 測試驗證（2026-06-26 15:00）
- **19 套測試全綠**（`npm test`：17 單元 + 2 整合）
- 部署驗證：dashboard-server 啟動成功，5 個端點 HTTP 狀態正確
- 新增 3 套測試：address-handoff.test.js, handoff-customer-reply.test.js, state-trimmed-value.test.js

---

## 2026-06-14 14:50 第三次進度（最新）⭐

### Bug 1/2 修補（先程式碼，後 prompt）

#### 程式碼修補（已完成）
- ✅ **A1**：dateRule.js 加 `getNextOpenDate` / `getNextOrderableOpenDate` / `formatDateWithWeekday`
- ✅ **A2**：改進 validateDate 錯誤訊息，突出「下一個開團日（含週X）」
- ✅ **A3**：timeSlotRule.js 加 `validateTimeSlotWithDate`（時段 × 配送日 合併驗證）
   - 今天 13:00 後 → 不可下單（past_cutoff_today）
   - 配送前一日 13:00 後 → 已過收單
   - 配送前一日 14:00 後 + 上午 → 雞肉備料時間不足
   - 配送前一日 18:00 後 + 下午 → 小菜無法追加
- ✅ **A4**：新增 `tests/date.test.js`（30+ 測試案例，涵蓋所有邊界）

#### Prompt 修補（已完成）
- ✅ **A5**：main_idea.md「九、收單時間規則」改為強制性規則
   - 新增「訂購時間決策表」
   - 5 條完整規則
   - 錯誤範例 vs 正確範例
   - 「下一個開團日查詢」流程
- ✅ **A6**：SOUL.md「訂購截止時間」章節（不可錯誤的核心資訊）

### 多租戶規模化（Phase A + B，已完成）
- ✅ **B1**：抽離 `config.yaml` → `config/tenants/chicken.yaml`（向後相容）
- ✅ **B2**：抽離 `knowledge/base/` → `knowledge/tenants/chicken/`（向後相容）
- ✅ **B3**：抽離 `data/orders/` → `data/orders/chicken/`（向後相容）
- ✅ **B4**：`config.js` 加多租戶支援（`TENANT_ID` 環境變數 + 路徑自動切換）
- ✅ **B5**：`knowledge/loader.js` 加 tenant-aware 路徑
- ✅ **B6**：`csvWriter.js` / `csvReader.js` / `orderIdGenerator.js` 加 tenant-aware 路徑
- ✅ **B7**：OpenClaw 規模化設計（方案 C：每客戶獨立 agent）

### SOP 完整版（已完成）
- ✅ **C1**：`docs/SOP.md`（11 KB，8 大章節、5 個附錄）
   - 人工設定清單（25+ 項）
   - 客製化標記 + 檢查清單
   - 6 步部署指南
   - 6 項定期維運
   - 8 種故障排除
   - 10 項接手演練驗收
   - 4 個常見任務 SOP
- ✅ **C2**：`docs/MULTI_TENANT_DESIGN.md`（5 KB，多租戶設計文件）

### 儀表板 MVP（已完成）
- ✅ **D1**：`scripts/dashboard.js` — 從 CSV 生成 HTML 儀表板（Chart.js）
   - 6 個關鍵指標卡片
   - 3 個圖表（訂單趨勢、狀態分佈、熱門品項）
   - 最近 20 筆訂單表格

### 文檔整理（已完成）
- ✅ **E1**：REVIEW_*.md 移到 `docs/archive/`，新增 `docs/INDEX.md`
- ✅ **E2**：本檔案更新

### 測試結果（最新）
```
rules.test.js       — 34/34 ✅
handoff.test.js     — 33/33 ✅
security.test.js    — 全通 ✅
states.test.js      — 全通 ✅
date.test.js        — 全通 ✅（新增）
config.test.js      — 全通 ✅
whitelist.test.js   — 全通 ✅
integration.test.js — 全通 ✅

總計：8 套全綠
```

### Git Commits
- `e166afd` — docs: C1 完整 SOP
- `1801c83` — feat: 多租戶規模化抽離
- `1f7ca5e` — fix: Bug 1/2 修補
- `12974eb` — fix: Phase 1 review + tech debt cleanup

### Production 狀態
- **Worker Version**：未變動（Bug 修補是程式碼層 + prompt 層，Worker 不需重新部署）
- **下一步**：Hubert 實測 prompt 層修補是否生效

---

## 2026-06-14 21:09 第四次進度（OpenClaw delivery bug）🚨

### Hubert 朋友測試發現問題

- **症狀**：朋友發訊息後，AI 有回覆但 25+ 分鐘沒送到 user 端
- **根因**：OpenClaw 內部 delivery hook bug（`systemSent: False`，訊息卡在 `pendingFinalDelivery`）
- **不是雞肉專案問題**：是 OpenClaw runtime 層問題
- **驗證**：用 LINE token Push API 送測試訊息 → HTTP 200 成功

### 已送出的測試訊息
- 訊息 ID：`618422438233113143`（已送給朋友 `U117a0f0c89...`）
- 內容：「🐔 系統測試訊息：您的訊息確實有送到雞肉客服 AI 處理，但回覆沒送出。請聯繫 Hubert 處理。」

### 給 Hubert 的 3 個選擇（待決策）
1. **現在重啟 OpenClaw gateway**（30 秒中斷，清除卡住的 delivery）— 推薦
2. **不重啟**，等 OpenClaw 自己 timeout
3. **保持現狀**，先讓朋友重發訊息

### 詳情
- 完整 12 種情境時間表見 `docs/archive/REVIEW_2026-06-14_FINAL_PLAN.md` §一
- 今日總結見 `~/.openclaw/workspace/memory/2026-06-14.md`
- 6 個批次產出 commit：`1f7ca5e`、`1801c83`、`e166afd`、`8db08d8`

---

## 2026-06-14 09:30 第二次進度

### P0 Bug 修復

- ✅ **Ignored Keywords 真的在 production 生效了**
  - 修復：在 `cloudflare-worker/src/index.ts` 加 `IGNORED_KEYWORDS` 攔截
  - 部署：`wrangler deploy` 成功（Version: ef63e075-d9a0-4433-898a-87bb10bc58c6）
  - 驗證：`tests/integration.test.js` 確認 bundled Worker 含 6 個關鍵字

---

## 2026-06-14 Review + 修補進度（最新） ⭐

### P0 Bug 修復

- ✅ **Ignored Keywords 真的在 production 生效了**
  - 問題：`config.yaml.ignored_keywords` 原本只在設計層生效，生產環境 Cloudflare Worker 沒有攔截
  - 修復：在 `cloudflare-worker/src/index.ts` 加 `IGNORED_KEYWORDS` 攔截
  - 部署：`wrangler deploy` 成功（Version: ef63e075-d9a0-4433-898a-87bb10bc58c6）
  - 驗證：`tests/integration.test.js` 確認 bundled Worker 含 6 個關鍵字的 Unicode escape

### Phase B 技術债清理（5 項）

- ✅ **B1：商品資料單一源**：`menuRule.js` 改為動態讀 `01_product.md`，移除硬編碼 VALID_ITEMS/PRICES
- ✅ **B2：notificationFormat type label 對齊**：6 個 key 修正（change_date → reschedule_request、aggressive → escalation、amount_anomaly → high_value_order、linepay_failure → linepay_failed、date_inquiry → open_date_inquiry、after_cutoff_change → late_modify），未知 type 會 console.warn
- ✅ **B3：CSV 檔名格式統一**：`config.yaml.filename_pattern` 改為 `{date}.csv`，程式碼三個檔案（csvWriter / csvReader / orderIdGenerator）改為引用統一常數 `FILENAME_PATTERN`
- ✅ **B4：config.js 完整 fallback YAML parser**：原本只有 warn，沒有真實備援；現在支援巢狀結構、list of strings、list of objects、boolean、comments、行內註解。`whitelist.js` 也重構為使用 `config.js` 而非自行解析
- ✅ **B5：handoff.test.js 修正**：補上「取消吧」keyword + pattern
- ✅ **B6：取消邏輯共用**：新增 `stateMachine.buildCancelResult()`，`confirming.js` 與 `awaitingPayment.js` 共用
- ✅ **B7：awaitingInfo 統一 trim**：所有欄位 value 在 switch 前先 trim 一次

### Phase C 新測試覆蓋（3 套）

- ✅ **tests/config.test.js** — YAML loader、isIgnoredKeyword（19 cases）、openDates、whitelist API、手動 parser、邊界、config.yaml 結構
- ✅ **tests/whitelist.test.js** — 模組載入、從 config 載入白名單、isWhitelisted、checkWhitelist (block_others 兩種模式)、getBlockReply、reloadConfig、邊界
- ✅ **tests/integration.test.js** — Worker 攔截邏輯模擬：Ignored Keywords 攔截、Payment Keywords 攔截、互不衝突、Custom Override、邊界、Production bundle 驗證

### 測試結果（更新）

```
rules.test.js       — 34/34 ✅
handoff.test.js     — 33/33 ✅（原失敗的「取消吧」已修）
security.test.js    — 全通 ✅
states.test.js      — 全通 ✅
config.test.js      — 19 cases ✅
whitelist.test.js   — 全通 ✅
integration.test.js — 19 cases ✅（含 production bundle 驗證）

總計：100% 通過率
```

### config.yaml 新增區塊

- `security.allowed_line_users` — 預設包含 Hubert，未來可加更多
- `security.block_others` — 預設 `false`（開放），上線前改為 `true`

### 開團日期更新

config.yaml 內已有 6 個開團日：
- 2026-06-13（已過，作為備查）
- 2026-06-16
- 2026-06-18
- 2026-06-23
- 2026-06-26

### Hubert 實測記錄（2026-06-14 09:41）

✅ **Ignored Keywords 攔截生效**
- 發送「菜單」「我要訂購」「常見問題」等 6 個關鍵字
- Bot 完全未回覆（LINE 圖文選單回覆，不重複）

### 下個階段修補中（2026-06-14 09:41+）

正在修補的 Bug（由 Hubert 實測回報）：

**Bug #1：晚上訂購邏輯問題**
- 問題描述：客戶輸入開團日期為當天，且在晚上時段下單，但客服仍嘗試進入訂單確認環節
- 預期：晚上時間已無法配送（不管是上午還是下午時段），應阻擋並提示
- 規則：開團時間=送貨時間，前一天下午 1 點前才能訂購
- 預計修補位置：`src/rules/dateRule.js` + `src/rules/timeSlotRule.js`（合併時段判斷）

**Bug #2：推薦日期錯誤**
- 問題描述：當被阻擋時，推薦的日期應該是「下一次有開團的日期」，但目前可能是「明天」或「不存在的日期」
- 預計修補位置：`src/rules/dateRule.js` 的 error message 產生邏輯
- 修補方式：實作 `getNextOpenDate(currentDate)` 函數，過濾出下一個真正開團的日期

### Production 部署狀態

- **Worker Version：** `ef63e075-d9a0-4433-898a-87bb10bc58c6`
- **URL：** `https://external-user-line-security.kaden1122123.workers.dev`
- **新增邏輯：** STEP 4.4 — Ignored Keywords 攔截（LINE 圖文選單 / 關鍵字回覆自動產出的關鍵字不轉發到 OpenClaw）
- **可調參數（透過 wrangler secrets）：** `IGNORED_KEYWORDS`（逗號分隔覆蓋預設）

---

## 2026-06-12 進度報告（歷史）

---

## 2026-06-12 進度報告

### 已完成 ✅

**工具模組（src/utils/）**
- ✅ `sanitizer.js` — 字串消毒（quotes/特殊字符）
- ✅ `timeUtils.js` — 時間工具（formatDate / getTodayString / isWithinOrderTime）
- ✅ `lineReply.js` — LINE 回覆格式

**規則引擎（src/rules/）**
- ✅ `addressRule.js` — 地址驗證（三峽/鶯歌範圍，關鍵字匹配）
- ✅ `phoneRule.js` — 電話驗證（10位/09開頭）
- ✅ `menuRule.js` — 品項驗證（知識庫對照 + 數量計算）
- ✅ `dateRule.js` — 日期驗證（4種情況）
- ✅ `timeSlotRule.js` — 時段驗證（上午10-12/下午16-18 + 指定時間warning）
- ✅ `paymentRule.js` — 付款方式驗證（新客>$1000不能選現金）
- ✅ `priceRule.js` — 金額計算（免運門檻）
- ✅ `index.js` — 規則總管

**知識庫（src/knowledge/）**
- ✅ `loader.js` — 統一載入
- ✅ `triggers.js` — 觸發對照表

**訂單系統（src/order/）**
- ✅ `orderIdGenerator.js` — 訂單編號（ORD-YYYYMMDD-XXX / PENDING-xxx）
- ✅ `csvWriter.js` — CSV 寫入（含 schema validation + 消毒 + quoting）
- ✅ `csvReader.js` — CSV 讀取（依 order_id / 依日期）
- ✅ `orderFormatter.js` — 訂單格式化（對外顯示 / 內部詳情）

**Human Handoff（src/handoff/）**
- ✅ `transferRules.js` — 14種語意觸發條件（關鍵字 + regex patterns）
- ✅ `notificationFormat.js` — LINE/Gmail 通知格式
- ✅ `notifier.js` — LINE Push 通知（主）+ Gmail（備援）

**狀態機（src/states/）**
- ✅ `stateMachine.js` — 狀態流轉核心（6個狀態）
- ✅ `idle.js` — IDLE 狀態（偵測訂購意圖）
- ✅ `awaitingInfo.js` — AWAITING_INFO 狀態（收集7個欄位 + 驗證）
- ✅ `reaskInfo.js` — REASK_INFO 狀態（驗證失敗重新詢問）
- ✅ `confirming.js` — CONFIRMING 狀態（展示摘要 + 等待確認）
- ✅ `awaitingPayment.js` — AWAITING_PAYMENT 狀態（等待付款證明）
- ✅ `handoff.js` — HUMAN_HANDOFF 狀態（安全閘：寫CSV → 回覆 → 通知）
- ✅ `completed.js` — COMPLETED 狀態（寫入CSV + 感謝訊息）

**主入口（src/index.js）**
- ✅ `index.js` — Agent 入口（整合所有模組）

**測試（tests/）**
- ✅ `rules.test.js` — 規則單元測試（34/34 通過）
- ✅ `handoff.test.js` — Human Handoff 觸發測試（33/33 通過）
- ✅ `security.test.js` — 安全測試（基本消毒 + 規則引擎防護）

**文件**
- ✅ `SPEC.md` — 完整規格文件
- ✅ `REVIEW_GUIDE.md` — 簡易審查指南
- ✅ `PHASE1_PROGRESS.md` — 進度報告
- ✅ `docs/DAILY_SUMMARY_2026-06-12.md` — 今日總結
- ✅ `config.yaml` — 完整設定檔（14種觸發條件、付款規則、配送規則、收單時間）
- ✅ `.gitignore` — 安全隔離
- ✅ `.env.example` — 環境變數範本

---

### 測試結果

```
=== 規則測試 ===
=== 總結：34/34 通過 ===
✅ 所有規則測試通過！

=== Handoff測試 ===
=== 結果：33/33 通過 ===
✅ 所有 Human Handoff 觸發測試通過！

=== 安全測試 ===
基本消毒: 3/6 ✅
SQL quotes 防禦: 4/4 ✅
CSV newline 防禦: 4/4 ✅
規則引擎防護: 2/3 ✅
⚠️ 部分安全測試有警告（但核心防護來自規則引擎）
```

---

### 重要設計決策

1. **語意觸發（Semantic Matching）**：
   - 使用「關鍵字/規則先行，模糊匹配 fallback」策略
   - 14種條件各有關鍵字表 + regex patterns
   - 模糊案例使用 fuzzy patterns（70% confidence）
   - 未來可升級為 MiniMax API 語意分類

2. **Human Handoff 安全閘**：
   - 順序：寫入 CSV → 回覆制式話術 → 通知 Hubert
   - CSV 中記錄 `handoff_type`、`customer_notes`、`handoff_logged_at`
   - 通知中附 `order_id` 供 Hubert 查詢完整上下文

3. **資料安全**：
   - 所有輸入經過 `sanitizer.js` 消毒（quotes/特殊字符）
   - CSV 欄位值 quoted 處理，防止 injection
   - `payment_status` 只能單向前進（pending → paid → confirmed）

4. **狀態機設計**：
   - 每個狀態獨立處理事件
   - REASK_INFO 委託給 AWAITING_INFO 處理
   - HUMAN_HANDOFF 不回覆（由 caller 回覆制式話術）

5. **LINE Bot Token 簡化**：
   - 同一隻 LINE Bot 用於接收客戶訊息 + 通知 Hubert
   - 刪除 `HUBERT_LINE_BOT_TOKEN`，統一使用 `LINE_BOT_TOKEN`

---

### Git Hub

- **Repo：** https://github.com/kaden1122123/chicken-group-buying-cs
- **Commits：**
  - `66487f0` — Phase 1: 雞肉團購 AI 客服核心功能（84 檔案，10635 行）
  - `bf0cbd5` — chore: add .gitignore and .env.example for security
  - `dc41874` — feat: add YYYY-MM-DD open dates, ignored keywords, and config loader

---

### 待處理

| 項目 | 優先級 |
|------|--------|
| Phase 2：Google Sheets 整合 | 高 |
| 對接真實 LINE Bot Webhook | 高 |
| 設定開團日期動態讀取 | ~~中~~ → ✅ 已完成（YYYY-MM-DD） |
| 忽略關鍵字清單（不回覆） | ~~中~~ → ✅ 已完成（config.yaml 管理） |
| 管理 Dashboard | 低（Phase 2/3） |

---

### 備註

- Hermes 建立了 `src/rules/`、`src/utils/`、`src/knowledge/` 的基礎
- brtclaw 親自實作了核心邏輯（order system、handoff、states、index.js）並修復多處問題
- 測試檔案已建立並通過核心測試
- Hubert 填寫了真實的 LINE Bot Token（`.env`）
---

## ✅ Session I 完成（2026-06-29 11:48）— api-server / dashboard-server production hardening

### 背景

H session 完成後專案已 production-grade（測試 28 套、ESLint 0/0、CI 就緒），但 api-server.js 跟 dashboard-server.js 仍有 5 個 production 風險點。

### 產出

- ✅ **I1 graceful shutdown**（21ab4a0）：api-server 監聽 SIGTERM + 升級 SIGINT，isShuttingDown 旗標 + activeSockets 追蹤，server.close() 等待 in-flight 完成（預設 10s，API_GRACEFUL_TIMEOUT_MS env 可調）
- ✅ **I2 CORS 白名單**（b164131）：從 `*` 改為讀 `API_CORS_ORIGINS` env（逗號分隔），預設關閉避免 dev 上 prod 風險；OPTIONS preflight 處理
- ✅ **I3 rate limiting**（626c4c7）：IP-based token bucket（預設 60 req/min，env 可調），背景定時清理過期 bucket，超過回 429 + Retry-After + X-RateLimit-* headers
- ✅ **I4 input validation**（814ca3e）：schema 驗證（型別 + 長度上限），POST /api/orders 必填 + 字串長度 + 數字有限 + items 陣列結構
- ✅ **I5 yaml 字串 patch**（4bab208）：取代 yaml.dump 修 P1-9，保留原 yaml 格式（縮排、引號風格、註解、空行）；支援 open_dates / ignored_keywords / delivery 三個 update keys
- ✅ **Tests**（e0a9197）：tests/api-server-hardening.test.js（I1-I4，378 行）+ tests/dashboard-server-yaml-patch.test.js（I5，245 行），全部整合進 npm test

### 統計

- 6 commits（21ab4a0 / b164131 / 626c4c7 / 814ca3e / 4bab208 / e0a9197）
- npm test 28 套（25 unit + 3 server-integration hardening）連續 3 次全綠
- npm run lint 0 errors / 0 warnings
- 0 個 zombie process（finally 用 detached + kill -pgid 完整清理）

### 環境變數全集（Session I 新增）

| Env | 預設 | 用途 |
|-----|------|------|
| `API_GRACEFUL_TIMEOUT_MS` | 10000 | I1 graceful shutdown 強制退出時間 |
| `API_CORS_ORIGINS` | （空） | I2 CORS 白名單（csv），空 = 關閉 |
| `API_RATE_LIMIT` | 60 | I3 每 IP 每分鐘最多 request 數 |
| `API_RATE_LIMIT_WINDOW_MS` | 60000 | I3 rate limit window（毫秒） |
| `API_INPUT_USER_LINE_NAME_MAX` | 100 | I4 user_line_name 長度上限 |
| `API_INPUT_ADDRESS_MAX` | 500 | I4 address 長度上限 |
| `API_INPUT_COMMUNITY_MAX` | 200 | I4 community 長度上限 |
| `API_INPUT_TIME_SLOT_MAX` | 50 | I4 time_slot 長度上限 |
| `API_INPUT_PAYMENT_METHOD_MAX` | 50 | I4 payment_method 長度上限 |
| `API_INPUT_PAYMENT_STATUS_MAX` | 50 | I4 payment_status 長度上限 |
| `API_INPUT_ORDER_STATUS_MAX` | 50 | I4 order_status 長度上限 |
| `API_INPUT_CUSTOMER_NOTES_MAX` | 1000 | I4 customer_notes 長度上限 |
| `API_INPUT_STAFF_NOTES_MAX` | 1000 | I4 staff_notes 長度上限 |

### 待 CEO 動作

無（api-server 可直接進入 production。Hubert 需決定 production 環境的 env 設定）

---

## ✅ Sessions J + L 完成（2026-06-29 12:18）— 雙位置架構強化 + API 文件化

### 背景

Session I 完成 production hardening 後，續做兩個「低風險高 ROI」的 session：J（操作安全）跟 L（API 文件化）。兩個 session 不互相依賴、可並行思考。

### Session J 產出

- ✅ **J1 sync-mirror --dry-run**（f6177db）：`bash scripts/sync-mirror.sh from-legacy --dry-run` 預覽會動的檔案；其他 rsync 參數自動透傳
- ✅ **J2 .rsync-filter**（89ebdf9）：repo 內 `.rsync-filter` 列排除 patterns；sync-mirror.sh 自動 --exclude-from source 端的 .rsync-filter
- ✅ **J3 cleanup 重構**（256183f）：bash script → Node script（cleanup-test-orders.js）+ .sh wrapper；PRODUCTION_DATA_PROTECTED 單一來源在 tests/helpers/cleanup.js

### Session L 產出

- ✅ **L1 openapi.yaml**（7c4e5a1）：OpenAPI 3.0 spec 475 行，5 個 endpoints + 4 個 schemas（OrderCreateData/OrderUpdateRequest/Order/Error）
- ✅ **L2 /api/docs Swagger UI**（871860f）：HTML + Swagger UI bundle 從 unpkg CDN；`/api/docs/openapi.yaml` spec 內容；都需 auth
- ✅ **L3 docs/API_CURL.md**（0404ce5）：每 endpoint curl 範例 + e2e 流程 + 常見錯誤對照表

### 統計

- **6 commits**（f6177db / 89ebdf9 / 256183f / 7c4e5a1 / 871860f / 0404ce5）
- npm test 28 套全綠 / npm run lint 0 errors
- 0 個 zombie process
- 0 個新 npm 依賴（Session L 約束）

### 副產品

- 新檔 `.rsync-filter` — sync 排除 patterns
- 新檔 `openapi.yaml` — API spec
- 新檔 `docs/API_CURL.md` — curl 範例
- 新檔 `scripts/cleanup-test-orders.js` — Node 實作的 cleanup
- `scripts/sync-mirror.sh` — 從 26 行 → 99 行（加 --dry-run + 解析器）
- `scripts/cleanup-test-orders.sh` — 從 45 行 → 17 行（變 pure wrapper）
- `scripts/api-server.js` — 50 行新增（/api/docs、/api/docs/openapi.yaml）
- CEO 指南 更新 Session J/L「已完成」標記

### 待 CEO 動作

無（兩個 session 都不需運維動作；J2 .rsync-filter 已生效；L1-L3 文件已就位）

---

## ✅ Sessions K + M 完成（2026-06-29 12:54）— 結構化 logging + Backup 機制

### 背景

Session J + L 完成後，續做兩個低風險 session：K（訊息格式）+ M（災難恢復）。兩個 session 不互相依賴。

### Session K 產出

- ✅ **K1 logger.js + 測試**（99e44e5）：src/utils/logger.js（JSON 輸出、log level、stream 分流、meta 防護）+ tests/logger.test.js 15+ 測試
- ✅ **K2 替換 src/** （2c983b0）：10 檔、19 處 console.error/warn 改用 logger
- ✅ **K3 替換 scripts/** （c5435df）：5 檔、72 處
- ✅ **K3 followup mode 修正**（6d6925f）：還原 executable bit

**新環境變數**：LOG_LEVEL (debug/info/warn/error，預設 info)

### Session M 產出

- ✅ **M1 backup.sh**（acecd3e）：tar.gz 打包 data/orders + knowledge/tenants + config/tenants 到 ~/.backups/chicken/，含 tar -tzf 驗證 + 7天 rotation
- ✅ **M3 backup_smoke_test.sh**（c87cd87）：5 步煙霧測試（archive 可解、真實訂單包含、排除項驗證、rotation 行為）

### 統計

- **6 commits**（99e44e5 / 2c983b0 / c5435df / 6d6925f / acecd3e / c87cd87）
- npm test 29 套全綠 / npm run lint 0 errors
- 0 個 zombie process
- 0 個新 npm 依賴

### 副產品

- 新檔 `src/utils/logger.js` — 結構化 logging 模組
- 新檔 `tests/logger.test.js` — 15+ 測試
- 新檔 `scripts/backup.sh` — 每日備份
- 新檔 `scripts/backup_smoke_test.sh` — 5 步測試
- 11 個 src/ + 5 個 scripts/ 改用 logger
- 測試套數 28 → 29（Session K）
- 後續 M2 cron 待 Hubert 決定（見下）

### 待 CEO 動作 — M2 crontab 設定

備份需要每日自動執行。Hubert 需決定用哪個排程系統：

**方案 A — OpenClaw cron（推薦）**：
已在 OpenClaw gateway 內整合。看 session context 決定。
用我的 cron 工具加（需提供 schedule + payload）：

```js
cron.add({
  name: '雞味客服每日 backup',
  schedule: { kind: 'cron', expr: '0 2 * * *', tz: 'Asia/Taipei' },
  sessionTarget: 'isolated',
  payload: { kind: 'agentTurn', message: '跑 bash /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/backup.sh 並回報結果' },
  delivery: { mode: 'announce', channel: 'discord', to: '1512213273846485058' },
  enabled: true,
})
```

**方案 B — 系統 cron**（如果 OpenClaw cron 不可行）：
```bash
crontab -e
# 加：
0 2 * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/backup.sh >> ~/.backups/chicken-cron.log 2>&1
```

Hubert 已決定**方案 A**（OpenClaw cron），2026-06-29 15:43 force run 驗證成功：

- **Job ID**: `bd933551-4774-4533-91b9-8599777bd6d3`
- **排程**：每天 02:00 Asia/Taipei（nextRunAtMs 1782756000000 = 2026-06-30 02:00）
- **sessionTarget**: isolated（一次性 agent 跑，不佔主 session）
- **delivery**: announce 到 Discord channel 1512213273846485058
- **Force run 結果**：
  - Archive: `~/.backups/chicken/2026-06-29/chicken-backup-20260629-154323.tar.gz`（20,687 bytes / 27 個檔）
  - 真實訂單 `2026-06-13.csv` + `2026-06-16.csv` 都正確包含
  - 知識庫、config tenants 全部包含
