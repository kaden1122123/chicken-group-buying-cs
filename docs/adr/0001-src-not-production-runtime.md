# ADR-0001: src/ 不是 Production Runtime

> **狀態**：Accepted
> **last_updated**：2026-07-29（Round 28 📐 補齊）
> **日期**：2026-06-27（SPEC.md v1.1）
> **決策者**：Hubert
> **背景文件**：[SPEC.md v1.1 §變更紀錄](../../SPEC.md)

---

## 背景（Context）

雞味客服有兩個「執行環境」：

1. `src/` — 本倉庫的 JS 模組（rules / states / order / handoff / utils）
2. `~/.openclaw/agents/external-user/` — OpenClaw agent，由 LLM prompt 驅動

舊 SPEC（v1.0）把 src/ 描述為「production runtime」，但這不準確。真正的 production 是 OpenClaw agent，src/ 是「把 prompt 邏輯模組化拆解為可 unit test 的程式碼」。

## 決策（Decision）

**`src/` 是「設計驗證 + 測試對象」，不是 production runtime。**

- Production runtime：`~/.openclaw/agents/external-user/` 的 OpenClaw agent（由 SOUL.md + AGENTS.md + knowledge/main_idea.md 驅動）
- src/ 用途：把 prompt 邏輯模組化拆解為可 unit test 的程式碼
- 19 套 unit test 守門員：src/ 改了，測試沒破壞 → 邏輯仍正確

## 後果（Consequences）

### 正面

- src/ 可獨立 unit test，不需要啟動整個 OpenClaw agent
- src/ 可被多個 LLM prompt 重用（OpenClaw agent 模仿 src/ 邏輯）
- 修改 src/ 不直接影響 production，必須透過 commit + rsync + agent prompt 更新

### 負面

- 接手者容易搞錯（覺得 src/ 是 production，會想 deploy 整個 src/）
- src/ 與 production prompt 可能漂移（src/ 改了但 agent prompt 沒改）

### 緩解

- SPEC.md v1.1 明確標註 src/ 角色
- 本 Handbook（ENGINEERING_HANDBOOK.md）第一節強調此事
- ADR-0001（本檔）作為正式決策記錄
- INDEX.md / SOP.md 也明確標註 src/ 角色

---

_本 ADR 是雞味專案架構的基礎，所有接手者必讀_
