# Session I — 安全 + Production Hardening Prompt

> **業務問題（CEO 視角）**：`api-server.js` 還沒 production-ready。沒有 graceful shutdown、沒有 CORS、沒有 rate limiting、沒有 input validation。dashboard-server 的 yaml.dump 已知會破壞格式（P1-9）。
> **影響**：🟡 中（production 風險）
> **推薦**：做（2-3 小時、中風險）
> **狀態**：⏸ 待用
> **觸發**：升級時 — api-server 需要進入 production runtime 才用（LLM 訂單成立時觸發）
> **涵蓋**：graceful shutdown / CORS / rate limiting / input validation / yaml.dump 格式保護

---

## 業務背景補充（2026-06-29 更新）

H session 完成後的專案現況：
- ✅ 測試 26 套（25 unit + 1 integration，npm test 全綠）
- ✅ ESLint 0 errors, 0 warnings（修整完成）
- ✅ CI 基礎就緒（`.github/workflows/test.yml`）
- ✅ orderFormatter 整隻 = 2 盒 bug 已修（H4 commit，isWhole 從 loadProductMenu 讀）
- ⚠️ Session I 仍推薦：api-server / dashboard-server production hardening

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session I：安全 + production hardening。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session I 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session I）
3. scripts/api-server.js 現有程式（注意：MOCK_TODAY 是測試 hack，不要動）
4. scripts/dashboard-server.js 現有程式（注意：js-yaml fallback 已實作）
5. tests/api-server.test.js 現有測試（既有 14 個 case）
6. tests/dashboard-server-test.js 現有測試
7. MEMORY.md §I（SOP）

## Session I 任務（CEO 視角）

開始時問 CEO 決策：

「api-server.js 缺 graceful shutdown / CORS / rate limiting / input validation，
dashboard-server 的 yaml.dump 會破壞格式。
5 個 production hardening 動作，做 / 不做？」

如果「做」，執行 5 個項目（每個 1 commit）：

### I1：graceful shutdown（scripts/api-server.js）
- 監聽 SIGTERM 與 SIGINT
- 收到 signal 時：停止接受新 connection、等待 in-flight request 完成（最多 10 秒）、關閉 server
- 避免客戶看到「突然斷線」錯誤
- 從 config 讀 timeout（避免 hardcode）
- **會連帶改**：
  - 新增 gracefulShutdown() 函式
  - server.close() + 等待 active sockets
  - 預期：既有 14 個 api-server.test.js 仍 PASSED（測試不會測 signal handler）

### I2：CORS（scripts/api-server.js）
- 加 Access-Control-Allow-Origin header
- 預設允許 Worker domain（從 config 讀取，避免 hardcode）
- 處理 OPTIONS preflight request
- **會連帶改**：
  - 加 CORS middleware
  - config.yaml / config.js 新增 api.cors_allowed_origins 欄位
  - 新增測試：OPTIONS 請求回 204 + CORS headers
  - **注意**：現有 api-server.test.js 沒測 CORS，加測試確保不破壞既有功能

### I3：rate limiting（scripts/api-server.js）
- 簡單 IP-based token bucket
- 預設：每 IP 每分鐘 60 個 request
- 超過回 429 Too Many Requests
- 從 config 讀取上限（避免 hardcode）
- **會連帶改**：
  - 新增 rate limit middleware
  - 記憶體內 IP → {count, lastReset} map（不持久化）
  - config 新增 api.rate_limit_per_minute 欄位
  - 新增測試：第 61 個 request 回 429

### I4：input validation（scripts/api-server.js）
- POST /api/orders body schema 驗證
- 必填欄位檢查、型別檢查、長度上限
- 驗證失敗回 400 + 明確錯誤訊息
- **會連帶改**：
  - 新增 validateOrderBody() 函式
  - 加長度上限（user_line_name ≤ 100、address ≤ 500 等）
  - 新增測試：缺欄位 / 型別錯 / 超長字串 都回 400
  - **注意**：既有 api-server.test.js 有 happy path 測試，確保不破壞

### I5：dashboard-server yaml.dump 修整（P1-9）
- 問題：yaml.dump 會加引號、改格式，破壞 yaml 結構
- 修法：改用字串 patch（保留原 yaml 格式）
  - 讀原 yaml 檔案
  - 解析修改的 keys
  - 用 regex 替換對應的 lines
  - 保留其他內容不動
- 或：用自寫的 serializer（取代 yaml.dump）
- **會連帶改**：
  - scripts/dashboard-server.js 改寫 config 寫入邏輯
  - 測試：修改後 yaml 格式跟原檔一致（無引號、無 key 順序亂）
  - 既有 dashboard-server-test.js 仍 PASSED

## 預期決策點（請 CEO 確認）

- CORS 允許來源（`*` / 特定 domain / 關閉）
- rate limit 數值（`60 req/min` / `100 req/min` / `30 req/min`）
- graceful shutdown timeout（`5s` / `10s` / `15s`）
- input validation 嚴格程度（只驗必填 / 驗必填+型別 / 驗必填+型別+長度）

## 不在 Session I 範圍（獨立排程）

- **P2-4** orderFormatter 與 priceRule 演算法統一：兩個函式 signature 不同（orderFormatter 收 `{chicken_items,...}`，priceRule 收 `Array<{name, quantity}>`），合併風險大且需要大量測試更新。建議排到 Session I 之後的獨立 session。
- H session 已修整 `orderFormatter.calculatePrice` 的 isWhole bug（整隻 = 2 盒，commit 6a854e3），此問題不再存在。

## 必跑 SOP
- I-1：每個 I1~I5 commit 前 git add -A + status + stat + commit + show（MEMORY.md §I）
- I-2：grep 確認引用點（特別是 api-server.test.js 是否有測試覆蓋新功能）
- I-3：每方案含「會連帶改 X、Y、Z」副作用分析
- I-4：每個改完跑 npm test（26 套全綠）+ npm run lint（0 errors/warnings）

## 約束
1. 每個 I1~I5 一個獨立 commit（5 commits 預期）
2. 每個改完立即 npm test 驗證
3. 既有 26 套測試不能破壞
4. 不改 production runtime（OpenClaw agent）
5. 不改 MOCK_TODAY 邏輯（測試 hack，獨立存在）
6. 不中途 push / rsync（最後統一）

## 執行流程
1. 讀必讀文件（4 份必讀 + 現有 api-server / dashboard-server 程式）
2. 給 Hubert 看決策（5 個 production hardening 動作，做 / 不做）→ 等回覆
3. 預期決策點：
   - CORS 允許來源
   - rate limit 數值
   - shutdown timeout
   - input validation 嚴格程度
4. I1 graceful shutdown → npm test → npm run lint → commit
5. I2 CORS → npm test → npm run lint → commit
6. I3 rate limiting → npm test → npm run lint → commit
7. I4 input validation → npm test → npm run lint → commit
8. I5 dashboard-server yaml dump → npm test → npm run lint → commit
9. 跑完整 check-quality.sh + 連續 3 次 npm test 全綠 + npm run lint 0 errors
10. 統一 push + rsync
11. 更新 REVIEW_GUIDE.md（測試套數如果有新增）+ PHASE1_PROGRESS.md
12. 通知 Hubert（5 個 commit 摘要）

## 開始吧
```