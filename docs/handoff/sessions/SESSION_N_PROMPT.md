# Session N — 訂單流程實作（A 方案 · 已上線）

> **時間**：2026-06-28 19:30
> **狀態**：✅ 已完成
> **觸發**：Session E 決策 D 方案實作探索發現架構難題，改走 A 方案
> **文件版本**：NEW_ORDER_FLOW.md v2.1
> **配套 prompt 版本**：`docs/production-prompt/2026-06-28/`

---

## 0. Session N 摘要

**目標**：實作 Session E 決策的訂單流程

**結果**：
- ❌ D 方案（純 postback Worker 觸發 API）— **廢止**
- ✅ A 方案（LLM 純文字 + Hubert 手動建單）— **已上線**

**為何改 A 方案**：
1. Worker 拿不到 LLM 對話歷史（OpenClaw session 在 SQLite）
2. OpenClaw 雞肉 agent 沒有 tool calling 機制
3. `handlePostbackEvent` 函式從未實作（v1.5 隱藏 bug）
4. A 方案 30 分鐘可上線，零架構風險，立即解除 12 天阻塞

---

## 1. A 方案流程

```
1. 客戶發「我想訂購」→ LLM 詢問品項、日期、時段、地址、付款
2. LLM 整理訂單摘要（純文字）+ 加「請回覆「確認」」提示
3. 客戶打「確認」關鍵字
4. LLM 整理最終訂單摘要 + push 通知 Hubert（含完整訂單資料）
5. LLM reply 客戶「訂單已收到，老闆會 24h 內聯絡您」
6. Hubert 看到 push 通知 → 手動到 dashboard 建單
```

**觸發關鍵字**：`確認、好、收到、yes、y、ok、okay、送出、提交、訂購、下單、go、confirm`

---

## 2. 已完成的變更

### 2.1 Production prompt

- `~/.openclaw/agents/external-user/knowledge/main_idea.md`
  - §十二「⚡ 訂單確認流程」：A2 架構 → v2 A 方案
  - §十四「訂單確認流程」：A2 整章重寫為 v2 A 方案
  - §十六「客戶要訂購」範例：改為 A 方案 LLM 主動引導
  - §十六「訂單確認（過渡期用）」：A2 描述改為 A 方案 push + reply 範例

### 2.2 Production prompt 版本快照

- `docs/production-prompt/2026-06-28/`
  - `CHANGELOG.md`（改動記錄）
  - `main_idea.md`（完整快照）
  - `SOUL.md`（完整快照，無變動）

### 2.3 架構文件

- `docs/architecture/NEW_ORDER_FLOW.md` v2 → v2.1
  - 零章節：版本演化 + 決策紀錄
  - 一章節：v2.1 A 方案流程圖
  - 二章節：v2.1 為何是過渡期 + 升級路徑
  - 三章節：v2.1 實作項目（含 N1-N8 廢止說明）
  - 四章節：v2.1 為何最好
  - 五章節：v1/v2 歷史

### 2.4 修整計畫

- `docs/CLEANUP_PHASE_2_PLAN.md`
  - Session E 標記完成（含 Session N 修正說明）
  - 新增 Session N 章節（A 方案 30 分鐘完成）
  - Session 優先順序：E ✅ → N ✅ → F → G → H → I → J → K → L → M
  - 升級 session O/P 標記「待用」

### 2.5 問題筆記

- `docs/NOTES/2026-06-16-issues.md`
  - 加入「Session N 修正」段（A 方案決策依據）
  - 更新升級路徑（Session O/P）
  - 交叉引用 SESSION_N/O/P prompts

### 2.6 工作方法論

- `~/.openclaw/workspace/MEMORY.md`
  - L2 §C 加「C-2 自主決策規則」（Hubert 2026-06-28 明確指示）
  - 規則：發現新問題 → 全面了解 → 找解方 → 走推薦解法（不丟回給 Hubert）
  - 例外：戰略決策、不可逆操作、業務資訊仍該問

---

## 3. 升級路徑（Session O / Session P）

### Session O — B 方案（4-6 小時，待用）

**情境**：每日訂單 > 5 筆、Hubert 手動建單時間成本高、客戶回饋 24h 太久

**目標**：OpenClaw agent 加 tool calling
- LLM 透過 OpenClaw tool calling 自動呼叫 api-server
- 客戶即時收到「訂單已建立」
- 自動 push 給 Hubert（仍可手動覆蓋）

**Prompt 見**：[SESSION_O_PROMPT.md](./SESSION_O_PROMPT.md)

### Session P — C 方案（6-8 小時，待用）

**情境**：每日訂單 > 20 筆、需要即時訂單狀態查詢、要支援 Rich Menu 多功能

**目標**：OpenClaw ↔ Worker KV 同步
- OpenClaw 把每筆 pending 訂單同步到 Cloudflare Worker KV
- 客戶打「確認」→ Worker 從 KV 拿 → 升級為正式
- 架構最完整，支援 Rich Menu「查訂單」功能

**Prompt 見**：[SESSION_P_PROMPT.md](./SESSION_P_PROMPT.md)

### 升級決策 SOP

每日 push 通知數 > 5 筆 → 考慮 Session O
每日 push 通知數 > 20 筆 + 客戶投訴 → 必走 Session P
Hubert 每日手動建單 > 15 分鐘 → 必走 Session O
其他 → 維持 A 方案過渡期

---

## 4. 文件改動清單

| 檔案 | 變更 | 狀態 |
|------|------|------|
| `~/.openclaw/agents/external-user/knowledge/main_idea.md` | A 方案 prompt 改動 | ✅ |
| `~/.openclaw/agents/external-user/SOUL.md` | 無變動 | ✅ |
| `docs/production-prompt/2026-06-28/CHANGELOG.md` | 新建 | ✅ |
| `docs/production-prompt/2026-06-28/main_idea.md` | 新建（快照）| ✅ |
| `docs/production-prompt/2026-06-28/SOUL.md` | 新建（快照）| ✅ |
| `docs/architecture/NEW_ORDER_FLOW.md` | v2 → v2.1 | ✅ |
| `docs/CLEANUP_PHASE_2_PLAN.md` | Session E/N 標記完成 | ✅ |
| `docs/NOTES/2026-06-16-issues.md` | 補充 A 方案決策 | ✅ |
| `docs/handoff/sessions/SESSION_N_PROMPT.md` | 新建（本檔）| ✅ |
| `docs/handoff/sessions/SESSION_O_PROMPT.md` | 新建（B 方案升級）| ✅ |
| `docs/handoff/sessions/SESSION_P_PROMPT.md` | 新建（C 方案升級）| ✅ |
| `~/.openclaw/workspace/MEMORY.md` | C-2 自主決策規則 | ✅ |
| `.task-state/chicken-cleanup/goal.md` | 更新 | ✅ |
| `.task-state/chicken-cleanup/steps.md` | 更新 | ✅ |

---

## 5. 驗證

- ✅ npm test（19 套全綠）
- ✅ production prompt 改動不影響既有 code
- ✅ push 通知機制既已運作（§十二）
- ✅ dashboard 建單功能既已運作
- ✅ check-quality.sh 通過
- ⏸ 真實 LINE 帳號實測（待 Hubert 安排）

---

_本檔由 brtclaw 維護，Session N 2026-06-28_
