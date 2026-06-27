# 新訂單流程架構（不靠監聽）

> 建立時間：2026-06-16
> 維護者：brtclaw
> 狀態：⚠️ **Failed 2026-06-16 實測** — 規劃保留供參考，**新方向見下方**
> 為何改：監聽式 order-listener 不靠譜，Hubert 要求即時觸發

> ⚠️ **2026-06-27 更新**：本檔原規劃於 6/16 實測時**失敗**（LINE quick reply 沒顯示、CSV 沒寫入）。完整問題分析見 [`docs/NOTES/2026-06-16-issues.md`](../NOTES/2026-06-16-issues.md)，內含 5 個新方向 A~E 評估待決定。本檔保留作為「為何放棄監聽式」的歷史參考，新流程方向由 NOTES 決定後再寫 v2。

---

## 一、為何放棄監聽式

**舊架構（監聽式）**：

客戶發 LINE → Worker → OpenClaw → LLM 完成 → 寫 session 檔
                                                          ↓
                                          order-listener 每 3 秒掃描
                                                          ↓
                                          解析 action blocks → 寫 CSV

**問題**：
- ❌ 有 3 秒延遲
- ❌ 依賴 session 檔案格式（容易壞）
- ❌ 依賴 LLM 輸出特定格式（action blocks 容易算錯）
- ❌ 跨 OS 環境可能不同
- ❌ 監聽失敗沒人知道

**新架構（主動觸發）**：

客戶主動 trigger + LINE quick reply callback → Worker → API → CSV

---

## 二、新流程（推薦方案）

### 流程圖

```
1. 客戶發「我想訂購」
   ↓ LLM 客服
2. LLM 詢問品項、日期、時段
   ↓ 客戶回答
3. LLM 整理訂單摘要
   ↓ LLM 回覆
4. 「請按下方按鈕確認訂購」+ LINE quick reply 按鈕
   ↓ 客戶按「確認訂購」
5. LINE 發 webhook postback → Worker
   ↓ Worker
6. Worker 解析 postback，呼叫後端 API
   ↓ API
7. 寫入 CSV（立即，< 100ms）
   ↓ Worker 回覆
8. 「您的訂單已建立！訂單編號 PENDING-12345」
```

### 關鍵特性
- ✅ **完全即時**：客戶按按鈕到寫入 CSV < 1 秒
- ✅ **完全可靠**：不依賴監聽、不依賴 session 檔案
- ✅ **不需 LLM 觸發**：LLM 只負責客服問答，訂單由結構化訊息處理
- ✅ **易除錯**：每步都可追蹤
- ✅ **易擴展**：未來加 quick reply 選項（如付款方式）很簡單

---

## 三、實作步驟

### Step 1（brtclaw）：建立 HTTP API server
**檔案**：`scripts/api-server.js`

**端點**：
- `POST /api/orders` — 建立訂單（從 LINE postback 來）
- `POST /api/orders/:id/payment` — 更新付款狀態（後續）
- `GET /api/orders` — 查詢訂單（給 dashboard 用）

**安全**：
- HTTP Basic Auth（環境變數 `API_USERNAME` / `API_PASSWORD`）
- 防止重複下單（order_id 唯一性檢查）

**測試**：
- 單元測試（writeOrder 寫入）
- 整合測試（POST /api/orders）

### Step 2（Hubert + brtclaw）：LINE 訊息設計
**檔案**：`~/.openclaw/agents/external-user/knowledge/main_idea.md`

新增「十四、訂單確認流程」：
- LLM 整理訂單摘要後，必須附帶 LINE quick reply 按鈕
- 按鈕：postback data 為 `confirm_order:{order_data}`
- 客戶按「確認訂購」→ LINE 發 webhook postback

### Step 3（brtclaw）：Worker 接收 postback
**檔案**：`~/openclaw-workspace/external-user/cloudflare-worker/src/index.ts`

**流程**：
- 收到 `event.type === 'postback'`
- 解析 `event.postback.data`
- 如果是 `confirm_order`：
  - 解析 LINE 訊息（從 postback data）
  - 呼叫 API: `POST https://api.example.com/orders`
  - 回覆 LINE 訊息「訂單已建立！編號 PENDING-12345」
- 如果是 `cancel_order`：
  - 回覆「好的，已取消」

### Step 4（brtclaw）：清理監聽式
- 刪除 `scripts/order-listener.js`
- 刪除 `tests/order-listener.test.js`
- 簡化 main_idea.md（移除「十二、訂單寫入機制」）

### Step 5（Hubert + brtclaw）：實測
- 用真實 LINE 帳號測試
- 驗證流程

---

## 四、檔案變更清單

| 檔案 | 變更 | 誰做 |
|------|------|------|
| `scripts/api-server.js` | **新增**：HTTP API server | brtclaw |
| `tests/api-server.test.js` | **新增**：整合測試 | brtclaw |
| `cloudflare-worker/src/index.ts` | **修改**：處理 postback | brtclaw |
| `main_idea.md` | **修改**：加「十四、訂單確認流程」 | brtclaw |
| `main_idea.md` | **修改**：移除「十二、訂單寫入機制」 | brtclaw |
| `scripts/order-listener.js` | **刪除** | brtclaw |
| `tests/order-listener.test.js` | **刪除** | brtclaw |

---

## 五、brtclaw 能做與不能做

### ✅ brtclaw 能做
- 寫 `scripts/api-server.js`（HTTP API）
- 寫整合測試
- 修改 Cloudflare Worker
- 修改雞肉專案的 prompt（main_idea.md）
- 刪除 order-listener 相關檔案
- 同步鏡像位置
- 推 GitHub

### ⚠️ 需要 Hubert 配合
- **LINE 官方帳號設定**（quick reply 按鈕需要 LINE 後台設定）
- **部署 Worker**（wrangler deploy）
- **設定環境變數**（API_USERNAME / API_PASSWORD）
- **真實 LINE 測試**（需要客戶配合）

### ❌ brtclaw 沒辦法單獨做
- **改 OpenClaw 內部 tool 機制**（plugin SDK 複雜）
- **改 OpenClaw 設定檔**（openclaw.json 改動風險大）
- **改 Cloudflare Tunnel**（需互動式登入）

---

## 六、為何這個方案最好

1. **完全即時**：客戶按按鈕到寫入 CSV < 1 秒（vs 監聽的 3 秒延遲）
2. **完全可靠**：不依賴監聽、session 檔案、LLM 輸出格式
3. **完全可控**：每個環節都可手動介入
4. **易除錯**：LINE 有 webhook 紀錄、Worker 有 log、API 有 log
5. **易擴展**：未來加 quick reply 選項（如付款方式、地址修改）很簡單
6. **符合 LINE 最佳實踐**：quick reply 是 LINE 官方推薦的互動方式

---

_本檔案於 2026-06-16 規劃完成_
