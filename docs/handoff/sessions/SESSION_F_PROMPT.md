# Session F — 文件一致性 + 6/26 決策落地 Prompt

> **業務問題（CEO 視角）**：有些文件寫的跟實際對不上（INDEX.md 寫「11 套測試」但實際 19 套）。接手的人看舊文件會誤導。6/26 audit 有些事當時沒決定，累積著。
> **影響**：🟡 中（影響協作）
> **推薦**：做（1.5 小時、低風險）
> **狀態**：✅ 已完成（2026-07-01）
> **證據**：2 commits `7330217`, `b374955`
> **涵蓋改動**：F1（INDEX 套數 29→32）+ F2（PHASE1_PROGRESS 最後更新）+ 文件統一

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session F：文件一致性 + 6/26 audit 剩餘決策落地。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session F 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session F）
3. 6/26 audit：docs/TODO_2026-06-26.md（看 §九 決策清單）
4. MEMORY.md §I（SOP）

## Session F 任務（CEO 視角）

開始時問 CEO 決策：

「有些文件寫的跟實際對不上、6/26 audit 有些事沒決定。
6 個低風險動作（1.5 小時），做 / 不做？」

如果「做」，執行 6 個項目（每個 1 commit）：

### F1：更新 INDEX.md 測試套數
- 現況：docs/INDEX.md 寫「11 套單元測試 + 2 套整合測試」
- 改為：「17 套既有 + helpers/cleanup + csv-writer-concurrency = 19 套」
- 注意：REVIEW_GUIDE.md 已正確（17 套），只需同步 INDEX.md

### F2：更新 PHASE1_PROGRESS.md 測試套數
- 現況：寫「11 套」或舊版敘述
- 改為：與 INDEX.md 一致

### F3：api-server.test.js 用 mock time 修整
- 問題：測試用 `delivery_date: '2026-06-18'`，今天是 2026-06-28，validation 拒絕 400
- 修整：參考 tests/date.test.js 用 mock time（`process.env.MOCK_TODAY`）
- 影響：api-server.js 已有 MOCK_TODAY 支援（已驗證）

### F4：P0-5 cognee placeholder 處理
- 問題：MEMORY.md 寫「Cognee ✅」但實際 scripts/cognee_import.py（如果存在）是 placeholder
- 動作：grep 引用點確認無用 → git rm（如果存在）+ 更新 MEMORY.md 標 ⏸ placeholder
- 注意：先確認 scripts/cognee_import.py 是否還存在

### F5：knowledge/learned/ 空目錄處理
- 現況：knowledge/learned/ 只有 .gitkeep
- 動作 A：加 README.md 說明「learned/ 是預留給未來 LLM 學習資料的目錄」
- 動作 B：刪除整個目錄（如果決定不留）

### F6：knowledge/tenants/chicken/ 加 INDEX.md 驗證清單
- 現況：10 個 md 檔沒有統一索引
- 動作：建立 knowledge/tenants/chicken/INDEX.md
  - 列出 10 個檔案的用途
  - 標 single source of truth
  - 標哪些由 loader.js 讀取

## 必跑 SOP
- I-1：每個 F1~F6 commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 F1~F6 一個獨立 commit
2. F3 改測試要 npm test 驗證
3. F4 先 grep 確認 cognee_import.py 是否存在
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. 執行 F1 → commit
4. 執行 F2 → commit
5. 執行 F3 → npm test → commit
6. 執行 F4 → grep 確認 → commit
7. 執行 F5 → commit
8. 執行 F6 → commit
9. 跑 check-quality.sh
10. 統一 push + rsync
11. 通知 Hubert

開始吧。
```
