# 新訂單流程架構 v2.1 — A 方案過渡期（Session N 決策 2026-06-28）

> **建立時間**：2026-06-28
> **維護者**：brtclaw
> **狀態**：✅ **A 方案已上線（過渡期）**
> **決策演化**：
> - Session E（19:00）：D 方案（純 postback Worker 觸發 API）
> - Session N（19:30）：**A 方案（LLM 純文字 + Hubert 手動建單）**— 探索發現 D 方案有架構難題
> **取代**：本檔 v1（v1 為監聽式架構，6/16 實測失敗）、v2（D 方案，架構難題已廢止）

---

## 零、版本演化與決策紀錄

| 版本 | 時間 | 決策 | 狀態 | 備註 |
|------|------|------|------|------|
| v1 | 2026-06-16 | 監聽式 + quick reply | ❌ 失敗 | 實測失敗（按鈕沒顯示、CSV 沒寫入）|
| v2 | 2026-06-28 19:00 | D 方案：純 postback Worker 觸發 API | ⚠️ 廢止 | 探索發現 Worker 拿不到 LLM 對話歷史、OpenClaw 沒 tool calling |
| **v2.1** | **2026-06-28 19:30** | **A 方案：LLM 純文字 + Hubert 手動建單** | ✅ **已上線** | 30 分鐘上線，零架構風險，解除 12 天阻塞 |

### 為何 v2 D 方案廢止（Session N 探索發現）

**問題 1**：Worker 拿不到 LLM 對話歷史
- OpenClaw session 存在 `~/.openclaw/agents/external-user/agent/openclaw-agent.sqlite`
- Worker 只有 LINE 訊息事件，讀不到 LLM 上一輪對話
- 「Worker 對話 context 訂單資料取出」沒有現成的資料流

**問題 2**：OpenClaw 雞肉 agent 沒有 tool calling 機制
- `agent/` 目錄只有 `models.json`、SQLite、auth state
- 沒有 fetch / api_call tool 註冊
- 這是 v1.5 quick reply 失敗的**根因**— LLM 沒辦法觸發外部 API

**問題 3**：`handlePostbackEvent` 從未實作
- `cloudflare-worker/src/index.ts:558` 呼叫但函式不存在
- v1.5 從未真的收到 postback 所以沒爆炸（隱藏 bug）

### 為何 A 方案能上線

- 不改架構、不改 OpenClaw 核心、不改 Worker
- 只改 production prompt（main_idea.md §十四）
- 30 分鐘可上線，零風險
- push 通知 + 標籤既有機制，無需新設計

---

## 一、v2.1 A 方案流程

```
1. 客戶發「我想訂購」
   ↓ LLM（OpenClaw 雞肉 agent）
2. LLM 詢問品項、日期、時段、地址、付款（精簡對話）
   ↓ 客戶回答
3. LLM 整理訂單摘要（純文字）+ 加「請回覆「確認」」提示
   ↓ LLM reply 客戶
4. 客戶打「確認」（純文字訊息）
   ↓ LLM 偵測關鍵字
5. LLM 整理最終訂單摘要 + push 通知 Hubert（含完整訂單資料）
   ↓ LLM
6. LLM reply 客戶：「訂單已收到，老闆會在 24h 內聯絡您」
   ↓ 客戶看到
7. Hubert 看到 push 通知 → 手動到 dashboard 建單（過渡期手動流程）
```

### 觸發關鍵字（LLM 偵測客戶確認意圖）

- 確認、好、收到、yes、y、ok、okay、送出、提交、訂購、下單、go、confirm

**注意**：要結合對話上下文判斷，不能只看到「好」就觸發（客戶問「好嗎？」時的「好」不是確認訂單）。

### push 通知格式

```
🔔 【新訂單待確認】
👤 客戶：{LINE 名稱}
📞 電話：{電話}
📍 地址：{地址}
📝 訂單：
  - {品項 1} x{數量} {單價}
  - {品項 2} x{數量} {單價}
  - 配送日：{YYYY-MM-DD} {時段}
  - 付款：{方式}
  - 總計：$XXXX
⏰ 請於 24h 內到 dashboard 建單並聯絡客戶
```

---

## 二、v2.1 為何是過渡期

**限制**：
- Hubert 每日手動建單 5-10 分鐘（可接受但非理想）
- 客戶回覆「確認」後 24h 才收到 Hubert 聯絡（UX 不完美）
- 無法做即時的訂單狀態查詢（Hubert 建單後才能查到）

**升級路徑**（依真實訂單模式決定優先）：

| Session | 方案 | 描述 | 預估時程 |
|---------|------|------|----------|
| Session O | B | OpenClaw agent 加 tool calling | 4-6 小時 |
| Session P | C | OpenClaw ↔ Worker KV 同步（完整版）| 6-8 小時 |

- **B 方案**：LLM 透過 OpenClaw tool calling 自動呼叫 api-server，客戶即時收到「訂單已建立」
- **C 方案**：OpenClaw 把每筆 pending 訂單同步到 Cloudflare Worker KV，客戶打「確認」→ Worker 從 KV 拿 → 升級為正式

升級決策依「真實訂單模式」判斷（每日訂單量、Hubert 手動建單時間、客戶體驗）。

---

## 三、v2.1 實作項目（已完成 ✅）

| Task | 內容 | 狀態 | 備註 |
|------|------|------|------|
| N1 | Worker postback 偵測邏輯 | ❌ 廢止 | A 方案不需要 |
| N2 | Worker 對話 context 訂單資料取出 | ❌ 廢止 | A 方案不需要 |
| N3 | api-server.js 連線驗證 | ⏸ 待用 | A 方案不需 api-server，但保留作為 B/C 升級用 |
| N4 | main_idea.md 修整為 A 方案 | ✅ 完成 | §十四 + §十二 + §十六 範例改為 A 方案 |
| N5 | 刪除 v1 監聽式遺留 | ✅ 已完成（Session A）| — |
| N6 | end-to-end 整合測試 | ⏸ 待用 | A 方案不需要，B/C 升級時再做 |
| N7 | systemd service 設定 | ⏸ 待用 | A 方案不需 api-server |
| N8 | 實測（真實 LINE 帳號）| ⏸ 待 Hubert 安排 | — |
| **Push 通知測試** | LLM push 機制驗證 | ⏸ 待測 | 第一次客戶確認時驗證 |

---

## 四、v2.1 為何最好（過渡期）

1. **30 分鐘內可上線**（只改 prompt）
2. **零風險**（不改架構、不改 OpenClaw 核心）
3. **立即解除 production 阻塞**（已 12 天）
4. **累積真實訂單資料**（後續 B/C 設計有依據）
5. **LLM 純文字對話**，可靠性高
6. **push 通知 + 標籤**既有機制，無需新設計

---

## 五、附錄：v1 與 v2 歷史

### v1 — 監聽式（2026-06-16 規劃，6/16 實測失敗）

**流程**：
```
客戶發 LINE → Worker → OpenClaw → LLM 完成 → 寫 session 檔
                                                      ↓
                                      order-listener 每 3 秒掃描
                                                      ↓
                                      解析 action blocks → 寫 CSV
```

**失敗原因**：
- 3 秒延遲
- 依賴 session 檔案格式（容易壞）
- 依賴 LLM 輸出特定格式（action blocks 容易算錯）
- 跨 OS 環境可能不同
- 監聽失敗沒人知道

### v2 — D 方案純 postback（2026-06-28 19:00 Session E 決策，已廢止）

**理想流程**：
```
客戶打「確認」→ Worker 偵測 → 從對話 context 取訂單 → 呼叫 API → 寫入 CSV
```

**廢止原因**：
- Worker 拿不到 LLM 對話歷史（OpenClaw session 在 SQLite）
- OpenClaw 雞肉 agent 沒有 tool calling 機制
- `handlePostbackEvent` 函式從未實作（隱藏 bug）

詳見 [docs/NOTES/2026-06-16-issues.md](../NOTES/2026-06-16-issues.md)。

### 升級 Session Reference

- [docs/handoff/sessions/SESSION_O_PROMPT.md](../handoff/sessions/SESSION_O_PROMPT.md) — B 方案（OpenClaw tool calling）
- [docs/handoff/sessions/SESSION_P_PROMPT.md](../handoff/sessions/SESSION_P_PROMPT.md) — C 方案（OpenClaw ↔ Worker KV 同步）

---

_本檔由 brtclaw 維護，Session E/N 2026-06-28 決策後建立 v2.1_

---

