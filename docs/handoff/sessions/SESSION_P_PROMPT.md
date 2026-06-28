# Session P — C 方案升級（OpenClaw ↔ Worker KV 同步 · 待用）

> **狀態**：⏸ 待用（升級觸發見下方決策 SOP）
> **設計**：B 方案的架構強化版
> **配套**：本 prompt 須搭配 SESSION_N/O_PROMPT.md 一起讀

---

## 何時做 Session P

**升級觸發（任一條件成立）**：
- 每日 push 通知數 > 20 筆
- 需要即時訂單狀態查詢
- 客戶投訴「查不到訂單」
- 要支援 LINE Rich Menu「查訂單」「修改訂單」等多功能
- B 方案無法滿足需求（如 Rich Menu 整合）

**升級時間**：6-8 小時

---

## 目標

把 B 方案（OpenClaw tool calling）升級為 C 方案（OpenClaw ↔ Worker KV 同步），達到架構最完整版：
- OpenClaw 把每筆 pending 訂單同步到 Cloudflare Worker KV
- 客戶打「確認」→ Worker 從 KV 拿 → 升級為正式
- 支援 Rich Menu「查訂單」即時查詢

**核心改動**：
- OpenClaw 雞肉 agent 寫入訂單時，**同步**到 Cloudflare Worker KV
- Cloudflare Worker 新增「從 KV 拿訂單 → 升級為正式」邏輯
- 實作 `handlePostbackEvent` 函式（補 v1.5 留下的隱藏 bug）
- api-server.js 不需改（沿用 B 方案 endpoint）

---

## 必讀文件

1. [SESSION_N_PROMPT.md](./SESSION_N_PROMPT.md) — A 方案現況
2. [SESSION_O_PROMPT.md](./SESSION_O_PROMPT.md) — B 方案設計
3. [../architecture/NEW_ORDER_FLOW.md v2.1](../architecture/NEW_ORDER_FLOW.md) — 架構演化
4. [~/openclaw-workspace/external-user/cloudflare-worker/src/index.ts](../../../openclaw-workspace/external-user/cloudflare-worker/src/index.ts) — Worker 程式碼（line 558 缺 `handlePostbackEvent` 實作）

---

## C 方案設計

### 流程

```
1. 客戶發「我想訂購」→ LLM（OpenClaw）詢問
2. LLM 整理訂單摘要 → 呼叫 tool `create_pending_order`
3. tool 內部：
   a. 寫入 CSV（pending 狀態）
   b. 同步到 Cloudflare Worker KV（key: `pending:{userId}`）
   c. 回傳 pending_id
4. LLM reply 客戶「請從下方選單點「確認訂購」或打「確認」」
   - LINE Rich Menu「確認訂購」按鈕 postback data: `confirm_order:{pending_id}`
   - 或客戶打純文字「確認」
5. 客戶點按鈕或打「確認」：
   - 按鈕走：Worker 接收 postback → `handlePostbackEvent` → 從 KV 拿 pending → 升級為正式
   - 文字走：LLM 偵測「確認」→ 呼叫 tool `confirm_pending_order` → 升級為正式
6. 訂單正式成立 → reply 客戶「訂單已建立！編號 order_id」
7. push 通知 Hubert
```

### 與 B 方案差異

| 項目 | B 方案 | C 方案 |
|------|--------|--------|
| 訂單狀態 | 即時建立 | pending → 正式（兩階段）|
| 觸發方式 | LLM 自動 | Worker + LLM 雙路徑 |
| Rich Menu 整合 | 不支援 | 支援「確認訂購」按鈕 |
| 訂單狀態查詢 | 不支援 | 支援（從 KV 拿） |
| 架構複雜度 | 中 | 高 |
| 風險 | 中 | 中高 |

---

## 實作步驟

### Step 1：Cloudflare Worker KV 設計

**新增 KV namespace**：`ORDER_KV`

**Key 設計**：
- `pending:{userId}` — 該用戶最新一筆 pending 訂單（JSON）
- `order:{order_id}` — 正式訂單（從 api-server 同步）
- `user_orders:{userId}` — 該用戶所有訂單 ID（list）

**TTL**：pending 24h（過期自動清）、order 永久

### Step 2：OpenClaw 雞肉 agent tool 改動

**改 `create_order` tool**（B 方案）→ `create_pending_order` tool：
- 寫入 CSV（pending 狀態）
- **同步**到 Cloudflare Worker KV
- 回傳 pending_id

**新增 `confirm_pending_order` tool**：
- 從 KV 拿 pending
- 呼叫 api-server 升級為正式
- 清除 KV pending

### Step 3：Cloudflare Worker 補實作

**檔案**：`cloudflare-worker/src/index.ts`

**新增 `handlePostbackEvent` 函式**（補 v1.5 bug）：
```typescript
async function handlePostbackEvent(
  event: LINEEvent,
  env: Env
): Promise<{ reason: string }> {
  const data = event.postback?.data || '';
  if (data.startsWith('confirm_order:')) {
    const pendingId = data.split(':')[1];
    // 從 KV 拿 pending
    // 呼叫 api-server 升級
    // reply LINE 客戶
    return { reason: 'order_confirmed' };
  }
  return { reason: 'unknown_postback' };
}
```

**改 `fetch` handler**：line 557-560 從「block」改為「呼叫 handlePostbackEvent」

### Step 4：api-server.js 新增 endpoint

**新增**：`POST /api/orders/:pending_id/confirm`
- 從 KV 拿 pending（透過 OpenClaw 介面）
- 升級為正式
- 回傳 order_id

### Step 5：prompt 改動

**檔案**：`~/.openclaw/agents/external-user/knowledge/main_idea.md`

**§十四 改動**：
- LLM 整理訂單 → 呼叫 `create_pending_order` tool
- 客戶打「確認」→ 呼叫 `confirm_pending_order` tool
- 客戶點 Rich Menu「確認訂購」按鈕 → Worker 處理（LLM 收到訂單已建立事件）

### Step 6：LINE Rich Menu 設定（需 Hubert 操作）

**LINE Manager 設定**：
- 新增「確認訂購」按鈕（postback: `confirm_order:{pending_id}`）
- 注意：postback data 需動態帶 pending_id，可能要用「DateTime picker」或「Rich Menu action」

**注意**：LINE Rich Menu postback 設計有限制，可能要繞路

### Step 7：測試

- unit test：Cloudflare Worker `handlePostbackEvent`
- integration test：OpenClaw ↔ Worker KV 同步
- end-to-end test：客戶點按鈕 → 訂單建立
- end-to-end test：客戶打「確認」→ 訂單建立

### Step 8：實測

- 真實 LINE 帳號測試（點按鈕 + 打「確認」兩條路徑）
- 驗證 Rich Menu 整合

---

## 風險與緩解

**風險 1**：Cloudflare Worker KV 同步失敗（網路問題）
**緩解**：api-server 為 source of truth，KV 只是 cache；KV 失敗時 LLM 仍可走純 tool 路徑

**風險 2**：LINE Rich Menu postback 動態 data 設計有限制
**緩解**：若 Rich Menu 不能帶動態 data，Rich Menu 改為「啟動 LLM 對話」讓 LLM 用對話方式完成

**風險 3**：`handlePostbackEvent` 實作錯誤可能影響現有 postback 事件
**緩解**：先在 staging 環境測試，確保其他 postback 事件不受影響

**風險 4**：OpenClaw ↔ Worker KV 同步增加複雜度，難除錯
**緩解**：加詳細 log（每步記錄），建立 monitoring 機制

---

## 完成定義

- [ ] Cloudflare Worker KV namespace 設定
- [ ] `handlePostbackEvent` 函式實作（補 v1.5 bug）
- [ ] OpenClaw 雞肉 agent `create_pending_order` + `confirm_pending_order` tool
- [ ] api-server.js `/api/orders/:pending_id/confirm` endpoint
- [ ] main_idea.md §十四 改為 C 方案
- [ ] LINE Rich Menu「確認訂購」按鈕設定
- [ ] unit + integration + end-to-end test 全綠
- [ ] 真實 LINE 帳號實測通過（兩條路徑）
- [ ] monitoring 機制建立
- [ ] 累計 1 週穩定 → 考慮移除 A 方案的過渡期 push 通知

---

_本檔由 brtclaw 維護，Session N 2026-06-28 建立_
