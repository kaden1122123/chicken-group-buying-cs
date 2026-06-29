# Session I — 安全 + Production Hardening Prompt

> **業務問題（CEO 視角）**：`api-server.js` 還沒 production-ready。沒有 graceful shutdown、沒有 CORS、沒有 rate limiting、沒有 input validation。dashboard-server 的 yaml.dump 已知會破壞格式（P1-9）。
> **影響**：🟡 中（production 風險）
> **推薦**：做（2-3 小時、中風險）

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session I：安全 + production hardening。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session I 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session I）
3. scripts/api-server.js 現有程式
4. scripts/dashboard-server.js 現有程式
5. MEMORY.md §I（SOP）

## Session I 任務（CEO 視角）

開始時問 CEO 決策：

「api-server.js 缺 graceful shutdown / CORS / rate limiting / input validation，
dashboard-server 的 yaml.dump 會破壞格式。
6 個 production hardening 動作，做 / 不做？」

如果「做」，執行 6 個項目：

### I1：graceful shutdown（scripts/api-server.js）
- 監聽 SIGTERM 與 SIGINT
- 收到 signal 時：停止接受新 connection、等待 in-flight request 完成（最多 10 秒）、關閉 server
- 避免客戶看到「突然斷線」錯誤

### I2：CORS（scripts/api-server.js）
- 加 Access-Control-Allow-Origin header
- 預設允許 Worker domain（從 config 讀取，避免 hardcode）
- 處理 OPTIONS preflight request

### I3：rate limiting（scripts/api-server.js）
- 簡單 IP-based token bucket
- 預設：每 IP 每分鐘 60 個 request
- 超過回 429 Too Many Requests
- 從 config 讀取上限（避免 hardcode）

### I4：input validation（scripts/api-server.js）
- POST /api/orders body schema 驗證
- 必填欄位檢查、型別檢查、長度上限
- 驗證失敗回 400 + 明確錯誤訊息

### I5：dashboard-server yaml.dump 修整（P1-9）
- 問題：yaml.dump 會加引號、改格式，破壞 yaml 結構
- 修法：改用字串 patch（保留原 yaml 格式）
- 或：用自寫的 serializer（取代 yaml.dump）

### I6：orderFormatter 重計算法（P2-4）
- 問題：orderFormatter.calculatePrice 與 priceRule 演算法不一致
- 修法：orderFormatter 改呼叫 priceRule.calculatePrice（單一來源）

## 必跑 SOP
- I-1：每個 I1~I6 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認 production hardening 引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 I1~I6 一個獨立 commit（6 commits 預期）
2. 每個改完立即 npm test 驗證
3. 既有 22 套測試不能破壞
4. 不改 production runtime（OpenClaw agent）
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. I1 graceful shutdown → npm test → commit
4. I2 CORS → npm test → commit
5. I3 rate limiting → npm test → commit
6. I4 input validation → npm test → commit
7. I5 dashboard-server yaml dump → npm test → commit
8. I6 orderFormatter 重算 → npm test → commit
9. 跑完整 check-quality.sh + 連續 3 次 npm test 全綠
10. 統一 push + rsync
11. 更新 REVIEW_GUIDE.md（測試套數如果有新增）
12. 通知 Hubert

開始吧。
```