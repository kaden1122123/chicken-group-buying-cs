# Session L — API 文件化 Prompt

> **業務問題（CEO 視角）**：`api-server.js` 對外 HTTP API 沒有文件。Hubert 或未來工程師不知道有哪些端點、怎麼呼叫。
> **影響**：🟢 低（影響協作）
> **推薦**：做（1-2 小時、低風險）
> **狀態**：⏸ 待用
> **觸發**：升級時 — `openapi.yaml` 已寫，待需要 OpenAPI SDK 或外部串接時才需要更完整文件
> **涵蓋**：api-server HTTP 端點列表、auth、request/response schema

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session L：API 文件化。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session L 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session L）
3. scripts/api-server.js 現有程式（看所有 /api/* 端點）
4. MEMORY.md §I（SOP）

## Session L 任務（CEO 視角）

開始時問 CEO 決策：

「api-server.js 對外 API 沒文件，
未來整合或除錯都要讀 source code。建立 OpenAPI + Swagger UI，做 / 不做？」

如果「做」，執行 3 個項目：

### L1：openapi.yaml（OpenAPI 3.0 spec）
- 列出 api-server.js 所有端點
- 包含 path、method、parameters、request body、responses
- 從程式碼直接整理，避免文件漂移
- 存放：openapi.yaml（專案根目錄）

### L2：/api/docs endpoint serve Swagger UI
- api-server.js 加 GET /api/docs route
- serve Swagger UI HTML（內嵌 swagger-ui CDN）
- 或：serve openapi.yaml 靜態檔
- 不需要 npm install swagger-ui（純 HTML + JS）

### L3：README 或新檔加 curl 範例
- 列出每個端點的 curl 範例
- 包含：GET /api/health、POST /api/orders、GET /api/orders/:id 等
- 範例：curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{...}'

## 必跑 SOP
- I-1：每個 L1~L3 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認 api 端點引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 L1~L3 一個獨立 commit（3 commits 預期）
2. 既有 22 套測試不能破壞
3. 不新增 npm 依賴（純 HTML/JS）
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. L1 openapi.yaml → 驗證 yaml 語法 → commit
4. L2 /api/docs endpoint → npm test → commit
5. L3 curl 範例文件 → commit
6. 跑完整 check-quality.sh + npm test 全綠
7. 統一 push + rsync
8. 通知 Hubert

開始吧。
```