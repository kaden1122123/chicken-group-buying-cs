# Session B 啟動 Prompt

> 用途：複製下面的「Session B Prompt」區塊到新 session 的第一則訊息，brtclaw 自動銜接上下文開始執行。
> 對應 actions：B1、B2、B3、B4
> 風險層級：中（同步 + 重寫 + 搬移）
> 預估時間：1-1.5 小時

---

## Session B Prompt（複製以下區塊到新 session）

```
你是 brtclaw。雞味客服專案的整理工作進入 Session B（同步與重寫）。

## 專案上下文（必讀背景）
- 專案根目錄（原位置，git 倉庫）：/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
- 主位置（production runtime）：/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/
- GitHub：https://github.com/kaden1122123/chicken-group-buying-cs
- 兩個位置用 rsync 鏡像（scripts/sync-mirror.sh from-legacy）
- 專案性質：LINE 官方帳號「雞味研究所」AI 客服系統
- 性質提醒：`src/` 是「設計驗證 + 測試對象」，**不是 production runtime**（production 跑 ~/.openclaw/agents/external-user/）

## 整理狀態檔（必讀）
路徑：/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/
- goal.md（整體目標 + Session A/B/C 結構）
- steps.md（每個 Session 進度）← 開始前先讀這份
- errors.md（錯誤記錄）

## Session A 已完成 ✅
- Commit：70d588d（6 files changed, +7/-654）
- 動作：刪除 DAILY_SUMMARY_2026-06-12.md、archive/historical/...workflow.txt、REVIEW_2026-06-14_BUGS_PLANNING.md；NEW_ORDER_FLOW.md 狀態更新；FOLLOWUP_PLAN 與 PLAN_V2 加 cross-reference
- 詳見 steps.md §Session A 結果

## Session B 任務（4 個動作）

### B1. 同步 config.yaml 的 open_dates
- 問題：config.yaml 有 6 個 open_dates（含過期 2026-06-06, 2026-06-13）；config/tenants/chicken.yaml 有 4 個（2026-06-16, 18, 23, 26）
- 程式優先讀 chicken.yaml，但 fallback 會用 config.yaml（會誤推過期日期）
- 動作：把 chicken.yaml 的 open_dates 同步到 config.yaml
- 風險：低
- 預期 commit：chore(config): 同步 config.yaml open_dates 與 chicken.yaml

### B2. 重寫 REVIEW_GUIDE.md
- 問題：CSV schema 寫 16 欄，實際 csvWriter.js 是 27 欄；測試套數寫 8 套，實際 18 套（16 unit + 2 integration）
- 動作：以 csvWriter.js 為 single source of truth，更新 REVIEW_GUIDE.md
  - CSV schema：16 → 27 欄（複製 src/order/csvWriter.js 第 17-44 行的 CSV_HEADERS 陣列）
  - test count：8 → 18 套
- 風險：低
- 預期 commit：docs(review-guide): 重寫對應現況 27 欄 CSV schema 與 18 套測試

### B3. 統一 src/ 角色描述
- 問題：多份文件把 src/ 描述成「production runtime」，但實際是「設計驗證+測試對象」
- production 真正跑的是 ~/.openclaw/agents/external-user/ OpenClaw agent
- 動作：更新以下文件的 src/ 角色描述（runtime → 設計驗證+測試對象）：
  - docs/INDEX.md
  - docs/SOP.md（§一 系統架構圖）
  - PHASE1_PROGRESS.md（頂部說明）
  - docs/handoff/SESSION_BACKGROUND.md（背景說明）
- 風險：低
- 預期 commit：docs: 統一 src/ 角色描述為「設計驗證+測試對象」

### B4. 搬移 SESSION_BACKGROUND.md
- 問題：docs/handoff/SESSION_BACKGROUND.md 是 session 銜接 prompt，不是設計文件
- 動作：
  1. 在專案根目錄建立 .openclaw-internal/ 目錄
  2. git mv docs/handoff/SESSION_BACKGROUND.md .openclaw-internal/SESSION_BACKGROUND.md
  3. 更新所有引用 SESSION_BACKGROUND.md 的地方（搜 grep -r "SESSION_BACKGROUND"）
- 風險：中（要改 INDEX.md 等引用）
- 預期 commit：chore: SESSION_BACKGROUND.md 搬移到 .openclaw-internal/

## 推薦執行順序
B1 → B2 → B3 → B4（風險由低到中）

## 約束
1. 每完成一個動作立即 commit（不要累積）
2. 不要 push（brtclaw 統一處理 push）
3. 不要 rsync（Session B 結束時統一 rsync 一次）
4. 編輯前先讀現有內容確認
5. 同步狀態：每完成一個動作更新 steps.md（追加 §Session B 結果）
6. 若發現問題，更新 errors.md

## Session B 完成後
1. 更新 steps.md（標記 B1-B4 完成 + commit hashes）
2. 更新 goal.md（必要時）
3. rsync 到主位置（bash scripts/sync-mirror.sh from-legacy）
4. 不要 push（留給 Hubert 或下次 session 統一處理）
5. 通知 Hubert Session B 完成 + 列出 4 個 commit hashes

## 你（brtclaw）的職責
- 開始前先讀 steps.md 確認 Session A 結果
- 執行 B1-B4（按推薦順序）
- 每步驟 commit + 更新 steps.md
- Session 結束時更新 steps.md + 通知 Hubert

開始吧。
```

---

## 使用方式

1. 開新 session（任何 channel）
2. 完整複製「Session B Prompt」區塊（從 `你是 brtclaw...` 到 `開始吧。\````）
3. 貼到第一則訊息
4. brtclaw 自動讀取 `.task-state/chicken-cleanup/steps.md`，知道 Session A 完成，開始執行 B1-B4

---

## 對應檔案

- `goal.md` §Session B — 動作清單
- `steps.md` §Session B — 進度記錄
- `errors.md` — 失敗記錄

---

_本檔由 brtclaw 維護，2026-06-27 17:05_