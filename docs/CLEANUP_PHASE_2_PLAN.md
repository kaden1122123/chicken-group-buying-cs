# 雞味客服 — Cleanup Phase 2 修整計畫

> **建立時間**：2026-06-28 12:41
> **建立者**：brtclaw
> **觸發**：Hubert 2026-06-28 12:41 要求「掃描整個專案、列舉待加強、擬定多 sessions 修整計畫」
> **前置 Session**：A（純刪除）+ B（同步）+ C（結構）+ D（測試清理 + race condition）— 共 12 commits

---

## 零、現況摘要

### Session A-D 已完成 ✅

| Session | 重點 | Commits |
|---------|------|---------|
| A | 純刪除冗餘 | `70d588d` |
| B | 同步 + REVIEW_GUIDE + 文件統一 | `6a2d4d1`, `4d83124`, `68a3e32`, `732a3a0` |
| C | 結構性變更 | `5320128`, `7f68618`, `2750145`, `61cc299`, `6ebb595` |
| D | 測試清理 + CSV race | `84ec44f`, `338bec3` |

### 專案規模

- **程式碼**：src/ 共 **4850 行**（33 個 JS 檔）
- **測試**：tests/ 共 **3013 行**（19 套：17 既有 + helpers/cleanup + csv-writer-concurrency）
- **文件**：docs/ 共 **4740 行**（含 archive/ 規劃文件）
- **依賴**：2 個（js-yaml + proper-lockfile），總 node_modules 1.5M
- **雙位置架構**：原位置（git）+ 主位置（production runtime）

### npm test 狀態

19 套全綠（連續 3 次驗證）✅

---

## 一、待加強項目分類（11 大類、40+ 項）

### 🔴 A. 業務流程決策（最高優先，影響 production）

| # | 項目 | 位置 | 風險 | 阻塞 production？ |
|---|------|------|------|------------------|
| ~~A1~~ | **6/16 訂單流程方向** ✅ **決策完成**（D 純 postback）| `docs/architecture/NEW_ORDER_FLOW.md` v2 | 高 | ✅ 已解 |
| A2 | **api-server.test.js 用過期日期 2026-06-18**（測試可能壞）| `tests/api-server.test.js` | 低 | 否 |
| ~~A3~~ | **api-server 啟動方式** ✅ **決策完成**（systemd）| `docs/architecture/NEW_ORDER_FLOW.md` v2 §四 | 中 | ✅ 已解 |

### 🟡 B. 程式碼品質（中風險高 ROI）

| # | 項目 | 現況 | 影響 |
|---|------|------|------|
| B1 | **無 CI/CD** | 沒有 `.github/workflows/` | 手動跑測試、無 PR 檢查 |
| B2 | **無 ESLint/Prettier** | 完全沒裝 | code style 不一致、難以 onboarding |
| B3 | **無 Node 版本固定** | 沒有 `.nvmrc`、package.json 無 `engines` | 不同環境可能有相容性問題 |
| B4 | **無 husky / pre-commit** | 沒裝 | commit 時無自動 lint/test 檢查 |
| B5 | **無 CHANGELOG.md** | 沒有 | 版本演進難以追蹤、回顧時困難 |
| B6 | **無 API 文件** | api-server.js HTTP API 無對外文件 | 整合困難、除錯困難 |
| B7 | **無 backup mechanism** | data/orders/ 只有 2 個真實訂單 | 資料丟失風險 |
| B8 | **無 error tracking / monitoring** | 沒有 sentry、log aggregation | production 問題難以追蹤 |

### 🟡 C. 文件一致性（中優先）

| # | 項目 | 位置 | 備註 |
|---|------|------|------|
| C1 | **INDEX.md 寫「11 套測試」已過時**（現 19 套）| `docs/INDEX.md` line 78 | Session C C5 SPEC partial update 已知未修 |
| C2 | **6/26 audit 剩餘 P1 未做** | （見下方 §二）| Hubert 當時未決策 |
| C3 | **6/26 audit 剩餘 P2 未做** | （見下方 §二）| Hubert 當時未決策 |
| C4 | **P0-5 cognee placeholder** 仍在 | `scripts/cognee_import.py`（已刪除，待確認）+ MEMORY.md 寫 ✅ | MEMORY 與實際不一致 |
| C5 | **knowledge/learned/ 空目錄** | `knowledge/learned/` 只有 .gitkeep | 規劃保留還是遺留？ |
| C6 | **knowledge/tenants/chicken/ 10 個 md 沒驗證清單** | `knowledge/tenants/chicken/` | 哪些是 active source of truth？ |

### 🟢 D. 測試覆蓋率（中風險中 ROI）

**0 個 test reference 的 module**（無專屬測試）：

| Module | 大小 | 風險 |
|--------|------|------|
| `src/utils/timeUtils.js` | 119 行 | 中（時間邏輯影響所有驗證） |
| `src/utils/lineReply.js` | 74 行 | 低（薄包裝） |
| `src/order/orderIdGenerator.js` | 73 行 | 中（訂單 ID 生成正確性） |
| `src/order/orderFormatter.js` | 180 行 | 高（金額計算、用戶顯示） |
| `src/order/csvReader.js` | 152 行 | 高（dashboard 讀取、客戶識別） |
| `src/handoff/notificationFormat.js` | 122 行 | 中（Hubert 看通知的內容） |

**State 測試覆蓋不均**：

- 已有：`states.test.js` 涵蓋基本轉換
- 可能不足：`awaitingPayment`、`completed`、`idle` 各 state 細節

**整合測試**：

- 有 `integration.test.js` 但只測 Worker 攔截邏輯
- **無 end-to-end 流程測試**：「客戶發訊息 → 處理 → 寫 CSV → LINE Push」全鏈路測試

### 🟢 E. 基礎設施（中風險）

| # | 項目 | 現況 | 影響 |
|---|------|------|------|
| E1 | **scripts/dashboard-server.js fallback**（P1-8） | ✅ 已完成 | — |
| E2 | **api-server.js 缺少 graceful shutdown** | SIGTERM/SIGINT 無處理 | production 重啟可能掉單 |
| E3 | **api-server.js 缺少 CORS** | 無 | 跨域限制 |
| E4 | **api-server.js 缺少 rate limiting** | 無 | DDoS 風險 |
| E5 | **無 staging environment** | dev/prod 沒分離 | 改 production 前無法測試 |
| E6 | **無 logging convention** | `console.log/error` 散落各處 | 難以聚合、難以除錯 |

### 🟢 F. 雙位置架構（低風險高 ROI）

| # | 項目 | 現況 | 影響 |
|---|------|------|------|
| F1 | **scripts/sync-mirror.sh --delete 太寬** | 會覆蓋主位置所有 untracked 檔案 | 主位置測試 CSV 會被清空 |
| F2 | **cleanup-test-orders.sh vs tests/helpers/cleanup.js** | 兩處 protected 清單 | 應為 single source of truth |
| F3 | **scripts/sync-mirror.sh 無 dry-run 選項** | 跑錯就會覆蓋 | 安全機制不足 |

### 🟢 G. 文檔細節（低風險）

| # | 項目 | 位置 | 影響 |
|---|------|------|------|
| ~~G1~~ | **NEW_ORDER_FLOW.md** ✅ **v2 已重寫** | `docs/architecture/NEW_ORDER_FLOW.md` v2 | 已解 |
| G2 | **PHASE1_PROGRESS.md 還提「11 套測試」** | `PHASE1_PROGRESS.md` line 18（已查） | 同 C1 |
| ~~G3~~ | **6/16 issues** ✅ **2026-06-28 Session E 決策完成** | `docs/NOTES/2026-06-16-issues.md` | 已解 |

---

## 二、6/26 audit 剩餘決策清單（Hubert 未決）

| # | 主題 | audit 推薦 | 現況 | 推薦 Session |
|---|------|-----------|------|--------------|
| 1 | P0-5 cognee placeholder 處理 | A. 刪除 | MEMORY.md 仍寫 ✅ | Session E 或 F |
| 2-1 | P1-2 addressRule 動態讀 loader | 做 | 未做 | Session H |
| 2-2 | P1-4 paymentRule 統一 key | 選做 | 未做 | Session H |
| 2-3 | P1-6 community 欄位 | 做 | 已有 community-field.test.js，可能已做 | Session H 驗證 |
| 2-4 | P1-8 dashboard-server fallback | 做 | ✅ 已完成（Session 早期） | — |
| 2-5 | P1-9 yaml dump 修整 | 選做 | 未做 | Session I |
| 3-1 | P2-4 orderFormatter 重計算法 | 暫不做 | 未做（需業務決策） | Session I |
| 3-2 | P2-5 notifier/lineProfileCache 改用 config | 做 | ✅ 已完成（config-interface-adoption.test.js） | — |
| 3-3 | P2-10 SESSION_BACKGROUND 搬移 | 選做 | ✅ 已完成（Session B B4） | — |
| 4 | api-server.test.js 過期日期 | A. mock time | 未做 | Session F |

---

## 三、修整 Sessions 計畫（建議優先順序）

> **原則**：高風險高 ROI 先做；低風險快速收尾的批次做；大改動分多 session。

### ~~Session E — 業務流程決策（最高優先，1-2 小時）~~ ✅ 2026-06-28 完成

**目標**：決定 6/16 訂單流程方向 A-E 與 api-server 啟動方式

**項目**：
- E1. 評估 5 個方向 ✅
- E2. 與 Hubert 確認最終方向 → **D 純 postback** ✅
- E3. 確認 api-server 啟動方式 → **systemd** ✅
- E4. 重寫 NEW_ORDER_FLOW.md v2 反映新方向 ✅
- E5. 更新 NOTES/2026-06-16-issues.md 標記決策完成 ✅

**決策結果**：
- 流程方向：**D 純 postback**（Session E 19:00 決策）
- 啟動方式：**systemd**

**Session N 修正**（2026-06-28 19:30）：
- 探索發現 D 方案有架構難題（Worker 拿不到 LLM 對話歷史、OpenClaw 沒 tool calling、`handlePostbackEvent` 未實作）
- 改走 A 方案（LLM 純文字 + Hubert 手動建單）— 30 分鐘上線，零風險
- 詳見 [docs/handoff/sessions/SESSION_N_PROMPT.md](../handoff/sessions/SESSION_N_PROMPT.md) 與 [docs/architecture/NEW_ORDER_FLOW.md](../architecture/NEW_ORDER_FLOW.md) v2.1

### ~~Session N — v2 流程實作（9 小時）~~ ✅ 2026-06-28 19:30 完成（改 A 方案）

**目標**：實作決策的訂單流程

**項目**：
- ~~N1. Worker postback 偵測邏輯~~ — ❌ 廢止（A 方案不需要）
- ~~N2. Worker 對話 context 訂單資料取出~~ — ❌ 廢止（A 方案不需要）
- N3. api-server.js 連線驗證 — ⏸ 待用（A 方案不需 api-server，保留 B/C 升級用）
- **N4. main_idea.md 修整為 A 方案** — ✅ 已完成
- ~~N5. 刪除 v1 監聽式遺留~~ — ✅ Session A 已完成
- ~~N6. end-to-end 整合測試~~ — ⏸ 待用（A 方案不需要）
- ~~N7. systemd service 設定~~ — ⏸ 待用（A 方案不需 api-server）
- N8. 實測（真實 LINE 帳號）— ⏸ 待 Hubert 安排
- **Push 通知測試** — ⏸ 待第一次客戶確認時驗證

**會連帶改**：
- `~/.openclaw/agents/external-user/knowledge/main_idea.md`（N4）— ✅
- `docs/architecture/NEW_ORDER_FLOW.md` v2 → v2.1 — ✅
- `docs/production-prompt/2026-06-28/`（新目錄，prompt 版本快照）— ✅
- `docs/CLEANUP_PHASE_2_PLAN.md`（本檔）— ✅
- `docs/handoff/sessions/SESSION_N_PROMPT.md`（新檔）— ✅
- `docs/handoff/sessions/SESSION_O_PROMPT.md`（B 方案升級 prompt，新檔）— ✅
- `docs/handoff/sessions/SESSION_P_PROMPT.md`（C 方案升級 prompt，新檔）— ✅

**決策結果**：
- 流程方向：**A 方案**（LLM 純文字 + Hubert 手動建單過渡期）
- 詳見 [docs/architecture/NEW_ORDER_FLOW.md](../architecture/NEW_ORDER_FLOW.md) v2.1
- 詳見 [docs/production-prompt/2026-06-28/CHANGELOG.md](../production-prompt/2026-06-28/CHANGELOG.md)
- 升級路徑：Session O（B 方案）→ Session P（C 方案）

**風險**：低（已上線，Hubert 手動建單過渡期）

**估時**：30 分鐘（vs 原估 9 小時，A 方案 0 改架構）

---

### ~~Session F — 文件一致性 + 6/26 決策落地（1.5 小時）~~ ✅ 2026-06-28 完成

**目標**：低風險快速收尾的文件修整

**項目**：
- F1. **更新 INDEX.md 測試套數**（11→19）✅
- F2. **更新 PHASE1_PROGRESS.md 測試套數引用**（如還有）✅
- F3. **api-server.test.js 用 mock time**（決策 4）✅ **已實作**（scripts/api-server.js:27-43 MOCK_TODAY 環境變數）
- F4. **P0-5 cognee placeholder 處理**（決策 1 — 推薦刪除 + 更新 MEMORY.md）✅ **不存在**（`scripts/cognee_import.py` 已刪除；MEMORY.md 是 cross-reference 到獨立的 `cognee/` 專案目錄，是正確的）
- F5. **knowledge/learned/ 處理**（保留空目錄 + 加 README 說明用途，或刪除）✅ 保留 + 加 README.md
- F6. **knowledge/tenants/chicken/ 10 個 md 驗證清單**（加 INDEX 列出 single source of truth）✅ 12 個 md 完整 INDEX 已建立

**會連帶改**：
- `docs/INDEX.md` ✅
- `PHASE1_PROGRESS.md` ✅
- `knowledge/learned/README.md` ✅（新檔）
- `knowledge/tenants/chicken/INDEX.md` ✅（新檔）

**未變更的（已驗證）**：
- `tests/api-server.test.js` — MOCK_TODAY 已實作於 api-server.js
- `MEMORY.md` — cognee 是 cross-reference，不是 placeholder

**風險**：🟢 低（純文件）

**估時**：30 分鐘（vs 原估 1.5 小時，因 F3 + F4 已實作 / 不存在）

---

### Session G — CI/CD + 程式碼品質基礎（中風險，2-3 小時）

**目標**：建立自動化品質控管

**項目**：
- G1. **加 .github/workflows/test.yml**（每次 push 跑 npm test）
- G2. **加 ESLint**（統一 code style，airbnb 或 standard）
- G3. **加 .nvmrc**（固定 Node 22.x）
- G4. **package.json 加 engines 欄位**（要求 Node 22+）
- G5. **加 husky + pre-commit hook**（commit 前跑 npm test）
- G6. **加 CHANGELOG.md**（從 v1.0.0 開始，記錄 Session A-D 變更）

**會連帶改**：
- `.github/workflows/test.yml`（新檔）
- `.eslintrc.json` 或 `eslint.config.js`（新檔）
- `.nvmrc`（新檔）
- `package.json`（engines + devDependencies）
- `.husky/pre-commit`（新檔）
- `CHANGELOG.md`（新檔）
- 可能改 30+ 檔以符合 ESLint（風險點）

**風險**：中
- ESLint 可能誤判現有 code style
- husky 在 OpenClaw 環境可能未生效

**緩解**：
- ESLint 第一次跑用 `--fix` 自動修正
- husky 設定 fallback（手動跑也行）

**估時**：2-3 小時

---

### Session H — 測試覆蓋率補強（3-4 小時）

**目標**：為 6 個無專屬測試的 module 加 unit test，並補強 state 測試

**項目**：
- H1. **src/utils/timeUtils.js** 加 15+ 測試（getTimeSlot, formatDate, getCurrentOpenDates, isWithinOrderTime, getTodayString, parseDateInput）
- H2. **src/utils/lineReply.js** 加 5+ 測試（textReply, flexReply, quickReply, imageReply 結構）
- H3. **src/order/orderIdGenerator.js** 加 5+ 測試（generateOrderId 格式、generatePendingOrderId、getMaxSequence）
- H4. **src/order/orderFormatter.js** 加 10+ 測試（calculatePrice、formatItemsDisplay、formatOrderSummary）
- H5. **src/order/csvReader.js** 加 10+ 測試（getOrderById、getOrdersByDate、getCustomerByPhone、isReturningCustomer）
- H6. **src/handoff/notificationFormat.js** 加 5+ 測試（formatLINENotification 各 type）
- H7. **state-trimmed-value.test.js 補強**：完整覆蓋 awaitingPayment, completed, idle 各 state

**會連帶改**：
- 新增 6 個測試檔（每個 module 一個）
- 補強既有測試

**風險**：中
- 測試設計可能誤判函數語意
- 需驗證既有 19 套測試不被破壞

**緩解**：每個新測試先 npm test 驗證，再進下一個

**估時**：3-4 小時

---

### Session I — 安全與 production hardening（2-3 小時）

**目標**：api-server.js production-ready

**項目**：
- I1. **graceful shutdown**（SIGTERM/SIGINT handler，等待 in-flight request 完成）
- I2. **CORS**（允許 Worker domain）
- I3. **rate limiting**（簡單 IP-based token bucket）
- I4. **input validation**（POST /api/orders body schema）
- I5. **P1-9 dashboard-server yaml dump 修整**（字串 patch 取代 yaml.dump）
- I6. **P2-4 orderFormatter 重計算法**（與 priceRule 統一）

**會連帶改**：
- `scripts/api-server.js`
- `scripts/dashboard-server.js`
- `src/order/orderFormatter.js`
- `src/rules/priceRule.js`
- 可能新增 middleware

**風險**：中
- graceful shutdown 邏輯可能漏掉 edge case
- rate limiting 用第三方套件或自寫

**估時**：2-3 小時

---

### Session J — 雙位置架構強化（1-2 小時）

**目標**：改善 sync-mirror 與 cleanup 機制

**項目**：
- J1. **scripts/sync-mirror.sh 加 dry-run 選項**（`--dry-run` 顯示會改動的檔案）
- J2. **scripts/sync-mirror.sh 加 --exclude-from .rsync-filter**（避免覆蓋主位置 untracked 測試資料）
- J3. **cleanup-test-orders.sh 整合 tests/helpers/cleanup.js 的 PRODUCTION_DATA_PROTECTED**（single source of truth）
- J4. **cleanup-test-orders.sh 改用 require('../tests/helpers/cleanup.js')** 而非 inline bash array

**會連帶改**：
- `scripts/sync-mirror.sh`
- `scripts/cleanup-test-orders.sh`
- `.rsync-filter`（新檔）

**風險**：低

**估時**：1-2 小時

---

### Session K — 監控與 logging（中風險，2 小時）

**目標**：建立結構化 logging 與 error tracking

**項目**：
- K1. **結構化 logging helper**（src/utils/logger.js：JSON 格式 + log level）
- K2. **替換散落的 console.log/error**（src/ + scripts/）
- K3. **環境變數控制 log level**（LOG_LEVEL=info|warn|error）
- K4. **可選 sentry/error tracking 整合**（如需要）

**會連帶改**：
- `src/utils/logger.js`（新檔）
- 改 src/ 30+ 檔 console.log → logger.info
- `scripts/api-server.js`、`scripts/dashboard-server.js` 也改

**風險**：中
- 大規模替換 console.log 可能漏
- logger 設計不當會影響除錯

**緩解**：先建立 logger + 一個 module 試用，驗證後再批次替換

**估時**：2 小時

---

### Session L — API 文件化（低風險，1-2 小時）

**目標**：api-server.js HTTP API 對外文件

**項目**：
- L1. **加 OpenAPI/Swagger spec**（openapi.yaml）
- L2. **api-server.js 加 /api/docs endpoint**（serve swagger UI）
- L3. **README 加 curl 範例**

**會連帶改**：
- `openapi.yaml`（新檔）
- `scripts/api-server.js`
- `README.md` 或新檔

**風險**：低

**估時**：1-2 小時

---

### Session M — Backup 機制（低風險，1 小時）

**目標**：data/orders/ 與 knowledge/tenants/ 自動備份

**項目**：
- M1. **scripts/backup.sh**（每日 tar.gz 到 ~/.backups/chicken/）
- M2. **加 crontab**（每日 02:00 跑 backup.sh）
- M3. **backup rotation**（保留 7 天，超過刪除）

**會連帶改**：
- `scripts/backup.sh`（新檔）
- crontab 設定

**風險**：低

**估時**：1 小時

---

## 四、Session 優先順序彙總

| 優先 | Session | 主題 | 估時 | 風險 | 狀態 |
|------|---------|------|------|------|------|
| 1 | ~~**E**~~ | ~~業務流程決策~~ | 1-2 小時 | 🔴 高 | ✅ 2026-06-28 完成 |
| 1.5 | ~~**N**~~ | ~~v2 流程實作（D 純 postback + systemd）~~ | ~~9 小時~~ | 🟡 中 | ✅ 2026-06-28 完成（改 A 方案，30 分鐘） |
| 1.6 | **O**（待用）| B 方案升級（OpenClaw tool calling）| 4-6 小時 | 🟡 中 | ⏸ 待用（依真實訂單模式決定優先） |
| 1.7 | **P**（待用）| C 方案升級（OpenClaw ↔ Worker KV 同步）| 6-8 小時 | 🟡 中 | ⏸ 待用 |
| 2 | ~~**F**~~ | ~~文件一致性 + 6/26 決策落地~~ | ~~1.5 小時~~ | 🟢 低 | ✅ 2026-06-28 完成（30 分鐘） |
| 3 | **G** | CI/CD + 程式碼品質基礎 | 2-3 小時 | 🟡 中 | ⏸ 待執行 |
| 4 | **H** | 測試覆蓋率補強 | 3-4 小時 | 🟡 中 | ⏸ 待執行 |
| 5 | **I** | 安全與 production hardening | 2-3 小時 | 🟡 中 | ⏸ 待執行 |
| 6 | **J** | 雙位置架構強化 | 1-2 小時 | 🟢 低 | ⏸ 待執行 |
| 7 | **K** | 監控與 logging | 2 小時 | 🟡 中 | ⏸ 待執行 |
| 8 | **L** | API 文件化 | 1-2 小時 | 🟢 低 | ⏸ 待執行 |
| 9 | **M** | Backup 機制 | 1 小時 | 🟢 低 | ⏸ 待執行 |
| **總計** | | | **10-11 小時**（A 方案已上線，B/C 升級待用） | | |

**建議執行順序**：E ✅ → N ✅ → **F → G → H → I → J → K → L → M**（O/P 升級 session 依真實訂單模式決定）

---

## 五、執行原則（沿用 Session C SOP）

每次 Session 必跑：
1. **I-1 Commit 前 SOP**：`git add -A` + `git status` + `git diff --cached --stat` + commit + `git show HEAD --stat`
2. **I-2 事實查核 SOP**：grep 引用點（4 個面向）+ dead/active 分開
3. **I-3 方案描述 SOP**：每方案含「會連帶改 X、Y、Z」副作用

每個 Task 一個 commit，避免堆疊。

結束時統一 push + rsync，更新 steps.md + goal.md。

---

## 六、本檔案更新時機

- Session 開始前：讀本檔確認該 Session 在 §三 中的位置與項目
- Session 結束時：在 steps.md 加 session 紀錄
- 所有 Session 完成後：更新本檔標記完成（或歸檔）

---

_本檔由 brtclaw 維護，Session A-D 完成後建立_
