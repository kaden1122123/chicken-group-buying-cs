# Session E — 業務流程方向決策 Prompt

> **業務問題（CEO 視角）**：客戶訂完雞、看完摘要，要按「確認訂購」按鈕才會真的寫進訂單系統。但按鈕現在沒顯示，所以訂單根本沒成立。你需要手動看 LINE 訊息建立訂單，營收損失風險。
> **影響**：🔴 高（影響營收）
> **推薦**：D（純 postback）

---

## Prompt 區段（複製以下到新 session）

```
你是 brtclaw。雞味客服 Session E：決定 6/16 訂單流程方向。

## 必讀文件（依序讀）
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session E 段）
2. 6/16 issues：docs/NOTES/2026-06-16-issues.md（5 個方向 A~E）
3. NEW_ORDER_FLOW：docs/architecture/NEW_ORDER_FLOW.md（為何失敗）
4. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session E）
5. MEMORY.md §I（SOP）

## Session E 任務（CEO 視角）

你要用「CEO 視角」問 Hubert 決策（不要列函數）。

### 開始時問的決策（CEO 視角）

問 1（業務）：
「客戶訂完雞要按確認按鈕才會寫進訂單，但按鈕沒顯示。
5 種做法：A 自動 / B LLM 辨識 / C webhook / D 純 postback（推薦）/ E 完全手動。
你選哪個？」

問 2（api-server 啟動）：
「api-server background 啟動方式：systemd / supervisor / nohup / PM2？
你選哪個？」

## 必跑 SOP（MEMORY.md §I）
- I-1：每個 commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點，dead code 與 active 分開列
- I-3：每方案含「會連帶改 X、Y、Z」副作用

## 約束
1. 不要列函數描述（用 CEO 視角）
2. 決策階段不 commit
3. 落實到文件階段每個 Task 一個 commit
4. 不中途 push / rsync（Session 結束時統一）

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看 CEO 視角決策（問 1 + 問 2）→ 等回覆
3. 決策後落實到文件：
   - E1：重寫 docs/architecture/NEW_ORDER_FLOW.md v2 反映新方向
   - E2：更新 docs/NOTES/2026-06-16-issues.md 標記決策完成
   - E3：更新 docs/CLEANUP_PHASE_2_PLAN.md 標記 Session E 完成
4. 跑 bash scripts/check-quality.sh
5. 統一 push + rsync
6. 通知 Hubert

## 結束時
- 更新 .task-state/chicken-cleanup/steps.md
- 更新 .task-state/chicken-cleanup/goal.md
- 統一 push + rsync
- 通知 Hubert（含決策摘要 + 後續實作 Session 建議）

開始吧。
```
