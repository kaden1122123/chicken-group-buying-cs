# Production Prompt 改動記錄 — 2026-06-28

> 對應 production runtime：`~/.openclaw/agents/external-user/`
>
> 本檔案是「2026-06-28 Session N」中對 production prompt 的改動記錄。
> 觸發：Session E 雞味客服訂單流程決策，採 A 方案（LLM 純文字 + Hubert 手動建單過渡期）。

---

## 改動摘要

### 1. main_idea.md — 訂單流程改為 v2 A 方案

**問題**：
- v1.5 quick reply 架構 6/16 實測失敗（按鈕沒顯示、CSV 沒寫入）
- Session E 決策 D（Worker 獨立觸發 API）實作有架構難題：
  - Worker 拿不到 LLM 對話歷史（OpenClaw session 在 SQLite）
  - OpenClaw 雞肉 agent 沒有 tool calling 機制
  - `handlePostbackEvent` 函式從未實作（v1.5 隱藏 bug）
- 訂單流程已卡 12 天，影響 production

**改動**：
- §十二「⚡ 訂單確認流程」：A2 架構 → v2 A 方案
- §十四「訂單確認流程」：A2 架構整章重寫為 v2 A 方案
- §十六「客戶要訂購」範例：改為 A 方案 LLM 主動引導
- §十六「訂單確認（過渡期用）」：A2 描述改為 A 方案 push 通知 + reply 範例

**A 方案核心**：
- LLM 純文字對話收集訂單（品項、日期、時段、地址、付款）
- 客戶打「確認」關鍵字（確認/好/收到/yes/ok/送出/提交/訂購/下單/go/confirm）→ 觸發
- LLM reply 客戶「訂單已收到，老闆會 24h 內聯絡」
- LLM **push 通知 Hubert**（完整訂單資料）
- **Hubert 手動到 dashboard 建單**（過渡期手動流程）

**會連帶改**：
- production runtime `~/.openclaw/agents/external-user/knowledge/main_idea.md`（已套用）
- `docs/architecture/NEW_ORDER_FLOW.md` v2 → v2.1（A 方案過渡期版）
- `docs/CLEANUP_PHASE_2_PLAN.md`（更新 Session N 狀態）
- `docs/NOTES/2026-06-16-issues.md`（補充 A 方案決策）
- `docs/handoff/sessions/SESSION_N_PROMPT.md`（A 方案執行記錄 + 升級路徑）

---

## 後續升級路徑

| 階段 | 方案 | 描述 | 預估時程 |
|------|------|------|----------|
| **現在（本檔）** | A | LLM 純文字 + Hubert 手動建單 | 已上線 |
| Session O | B | OpenClaw agent 加 tool calling | 4-6 小時 |
| Session P | C | OpenClaw ↔ Worker KV 同步（完整版）| 6-8 小時 |

升級決策依「真實訂單模式」判斷（每日訂單量、Hubert 手動建單時間、客戶體驗）。

---

## 不變的部分

- §一 ~ §十一（核心任務、服務目標、核心價值、人格、開團規則、付款、外送、作業流程、收單時間、社群公告、菜單知識庫）— 全部保留不動
- §十三（客戶標籤規則）— 保留
- §十五（必須轉交真人的情況）— 保留
- §十七（最終行為準則）— 保留

只有「訂單建立流程」相關章節（§十二 part、§十四、§十六 部分範例）改動。

---

## 驗證

- ✅ 19 套 unit test 仍全綠（main_idea.md 是 prompt，不是 code）
- ✅ prompt 改動不影響既有 code
- ✅ push 通知機制（§十二）既已運作
- ✅ dashboard 建單功能既已運作

---

_本檔由 brtclaw 維護，Session N 2026-06-28_
