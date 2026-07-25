# Session O — B 方案升級（OpenClaw Tool Calling · 待用）

> **狀態**：⏸ 待用（升級觸發見下方決策 SOP）
> **設計**：A 方案的自動化升級版
> **配套**：本 prompt 須搭配 SESSION_N_PROMPT.md 一起讀

---

## 何時做 Session O

**升級觸發（任一條件成立）**：
- 每日 push 通知數 > 5 筆
- Hubert 每日手動建單 > 15 分鐘
- 客戶回饋「24h 內才聯絡」太慢
- 訂單錯誤率上升（手動建單出錯）

**升級時間**：4-6 小時

---

## 目標

把 A 方案（LLM 純文字 + Hubert 手動建單）升級為 B 方案（OpenClaw agent 加 tool calling），讓 LLM 自動呼叫 api-server 寫入訂單。

**核心改動**：
- OpenClaw 雞肉 agent 註冊 `api_call` tool（讓 LLM 呼叫外部 API）
- main_idea.md §十四 加 tool 使用指示
- api-server.js 增加 `POST /api/orders/auto` endpoint（給 LLM tool 用）

---

## 必讀文件

1. [SESSION_N_PROMPT.md](./SESSION_N_PROMPT.md) — A 方案現況
2. [../../architecture/NEW_ORDER_FLOW.md v2.1](../../architecture/NEW_ORDER_FLOW.md) — 架構演化
3. [../../production-prompt/2026-06-28/CHANGELOG.md](../../production-prompt/2026-06-28/CHANGELOG.md) — A 方案 prompt 改動
4. OpenClaw 雞肉 agent 設定（`~/.openclaw/agents/external-user/agent/`）

---

## B 方案設計

### 流程

```
1. 客戶發「我想訂購」→ LLM 詢問
2. LLM 整理訂單摘要 + 加「請回覆「確認」」提示
3. 客戶打「確認」
4. LLM 呼叫 OpenClaw tool `api_call`（POST /api/orders/auto）
5. api-server 寫入 CSV + 回傳 order_id
6. LLM reply 客戶「訂單已建立！編號 order_id」
7. LLM push 通知 Hubert（純確認用，不需手動建單）
```

### 與 A 方案差異

| 項目 | A 方案 | B 方案 |
|------|--------|--------|
| 訂單寫入 | Hubert 手動 | LLM 自動（透過 tool）|
| 客戶回覆時間 | 24h | 即時 |
| push 通知用途 | Hubert 建單依據 | 純確認 |
| 錯誤率 | 手動出錯可能 | 程式化（低）|
| 風險 | 低（手動可控）| 中（tool calling 失敗）|

---

## 實作步驟

### Step 1：OpenClaw 雞肉 agent 加 tool

**檔案**：`~/.openclaw/agents/external-user/agent/openclaw-agent.sqlite`（schema 改動）

**新增 tool**：`create_order`
- 輸入：order_data（品項、日期、時段、地址、付款、姓名、電話）
- 輸出：order_id 或 error
- 內部呼叫：`fetch('http://localhost:3001/api/orders/auto', { method: 'POST', body: JSON.stringify(order_data) })`

**注意**：tool 設計要符合 OpenClaw SDK 規範（待探索）

### Step 2：api-server.js 新增 endpoint

**檔案**：`scripts/api-server.js`

**新增**：`POST /api/orders/auto`
- 接收完整 order_data
- 自動寫入 CSV
- 回傳 order_id
- **不要**需 auth（內部 tool 用）
- 加 IP allowlist（只允許 localhost）

### Step 3：prompt 改動

**檔案**：`~/.openclaw/agents/external-user/knowledge/main_idea.md`

**§十四 改動**：
- LLM 看到客戶打「確認」→ 呼叫 `create_order` tool
- tool 回傳 order_id → LLM reply 客戶「訂單已建立！編號 XXX」
- LLM push 給 Hubert（純確認用）

### Step 4：測試

- unit test：api-server.js 的 `/api/orders/auto` endpoint
- integration test：LLM tool calling 流程（mock OpenClaw tool 介面）
- end-to-end test：客戶打「確認」→ CSV 寫入 → order_id 回傳

### Step 5：實測

- 真實 LINE 帳號測試
- 驗證客戶體驗（即時收到訂單編號）

---

## 風險與緩解

**風險 1**：OpenClaw tool calling 介面不熟悉，可能踩雷
**緩解**：先做 spike prototype（30 分鐘）驗證可行性

**風險 2**：LLM 用 tool 寫入錯資料（地址拼錯、金額算錯）
**緩解**：tool 內做 schema validation + 業務規則檢查（金額上限、地址格式）

**風險 3**：api-server 沒啟動 → LLM tool 呼叫失敗
**緩解**：tool 回傳明確錯誤訊息，LLM reply 客戶「系統忙碌，請稍後重試」

---

## 完成定義

- [ ] OpenClaw 雞肉 agent `create_order` tool 註冊完成
- [ ] api-server.js `/api/orders/auto` endpoint 完成（含 unit test）
- [ ] main_idea.md §十四 改為 B 方案
- [ ] integration test 全綠
- [ ] 真實 LINE 帳號實測通過
- [ ] push 通知機制改為「純確認」
- [ ] 累計 1 週穩定 → 考慮移除 A 方案的「Hubert 手動建單」流程

---

_本檔由 brtclaw 維護，Session N 2026-06-28 建立_
