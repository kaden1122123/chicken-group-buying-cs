# 雞味客服 — Session D 啟動 Prompt

> **使用方式**：新 session 開始時，把「Prompt 區段」複製貼到第一則訊息，brtclaw 就會銜接所有上下文。
> **建立時間**：2026-06-28 02:20
> **對應交接文件**：`/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/SESSION_D_HANDOFF.md`

---

## Prompt 區段（複製以下區段到新 session）

```
你是 brtclaw。雞味客服專案進入 Session D（修復 audit 發現的不足）。

## ⚠️ Session D 開始前必讀（依序）
1. 交接文件：/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/SESSION_D_HANDOFF.md
2. 步驟歷史：/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/steps.md
3. 整體目標：/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/goal.md
4. 工作方法論（特別是 I 段 SOP）：/home/clawuser/.openclaw/workspace/MEMORY.md

## 專案上下文
- 專案根目錄（原位置，git 倉庫）：/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
- 主位置（production runtime）：/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/
- 兩個位置用 rsync 鏡像（scripts/sync-mirror.sh from-legacy）
- GitHub：https://github.com/kaden1122123/chicken-group-buying-customer-service/cs
- 性質：LINE 官方帳號「雞味研究所」AI 客服系統
- 性質提醒：src/ 是「設計驗證 + 測試對象」，不是 production runtime

## Session D 任務（P0 兩個項目）
D1. 測試清理機制（避免 6/26 慘痛教訓重演）
   - 現況：至少 11 個 test 沒有 afterEach 清理 CSV
   - 動作：搜尋寫入 CSV 的測試 + 加 afterEach 清理 + 驗證 npm test 連續 3 次全綠
   - 估時：1 小時

D2. CSV race condition（影響 production 穩定性）
   - 現況：src/order/csvWriter.js line 97, 144 用 appendFileSync/writeFileSync，高併發會 race
   - 動作：安裝 proper-lockfile + 改 csvWriter.js 用 lock 序列化寫入 + 加併發測試
   - 估時：2-3 小時

## 必跑 SOP（MEMORY.md I 段 — 避免 Session C C2 事故重演）
- I-1 Commit 前 SOP：git add -A + git status + git diff --cached --stat + commit + git show HEAD --stat 驗證
- I-2 事實查核 SOP：grep 4 個面向（代碼/文件/設定/production prompt），dead code 與 active 引用分開列
- I-3 方案描述 SOP：每個方案必含「會連帶改 X、Y、Z」副作用分析

## 執行流程
1. 讀取 SESSION_D_HANDOFF.md（必讀）
2. 做事實查核（I-2 SOP）
3. 給 Hubert 看方案（I-3 SOP）→ 等確認
4. 執行 D1 → 跑測試 → Commit（I-1 SOP）→ 更新 steps.md
5. 執行 D2 → 跑併發測試 → Commit（I-1 SOP）→ 更新 steps.md
6. 完整 audit（git log --stat）
7. 統一 push + rsync
8. 更新 goal.md（標記 Session D 完成）
9. 通知 Hubert

## 約束
1. 高風險：每個 Task 前必須明確 Hubert 決定，不要預設
2. 每完成一個 Task 立即 commit（不堆疊）
3. 不要中途 push（Session D 結束時統一 push）
4. 不要中途 rsync（Session D 結束時統一 rsync 一次）
5. 同步狀態：每完成一個動作更新 steps.md
6. 若發現問題，更新 errors.md

## Session D 完成後
1. 更新 steps.md（標記 D1、D2 完成）
2. 更新 goal.md（標記 Session D 完成）
3. rsync 到主位置
4. 統一 push GitHub
5. 通知 Hubert 整體完成 + 列出所有 commit hashes + 三大改善摘要

## 你（brtclaw）的職責
- 開始前先讀 SESSION_D_HANDOFF.md + steps.md + MEMORY.md I 段
- 對 Hubert 確認每個 Task 方案（給推薦 + 利弊分析 + 副作用）
- 執行確認後的變更
- 每步驟 commit + 更新 steps.md（必跑 I-1 SOP）
- Session 結束時更新 steps.md + 更新 goal.md + 通知 Hubert
- 必跑 MEMORY.md I 段 3 個 SOP（避免 C2 漏 commit 事故重演）

開始吧。
```

---

## Prompt 使用說明

### 步驟 1：複製 Prompt 區段
複製上面「Prompt 區段」的完整內容（從「你是 brtclaw」開始到「開始吧。」結束）。

### 步驟 2：貼到新 session
在 Discord / 主 session / 任何新 session 的第一則訊息貼上。

### 步驟 3：等待 brtclaw 開始
brtclaw 會：
1. 自動讀取 SESSION_D_HANDOFF.md
2. 確認前任 session 結果（steps.md + goal.md）
3. 跑 MEMORY.md I 段 3 個 SOP
4. 開始 D1 與 D2

---

## 為何這樣設計

### 為何要有交接文件
- Session 跨日/跨設備時，brtclaw 無法保留記憶
- 交接文件 = brtclaw 的「外部記憶」
- 必讀清單讓 brtclaw 知道「從哪開始」

### 為何 Prompt 要強調 SOP
- Session C 發生 C2 commit 漏改事故
- MEMORY.md I 段整合 3 個 SOP 避免重犯
- Prompt 必跑 SOP 是 brtclaw 的「強制防線」

### 為何每個 Task 1 個 commit
- Session C 經驗：堆疊多個 Task → 漏 commit → 救火
- 分開 commit = 隨時可以 revert 單一 Task
- 每次 commit 後立即驗證 = 提早發現問題

---

_本檔由 brtclaw 維護，Session D 開始時複製 Prompt 區段即可_
