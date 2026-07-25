# Session C 啟動 Prompt

> 用途：複製下面的「Session C Prompt」區塊到新 session 的第一則訊息，brtclaw 自動銜接上下文開始執行。
> 對應 actions：C1、C2、C3、C4、C5
> 風險層級：高（結構性變更，需 Hubert 決策）
> 預估時間：2 小時
> **前置條件**：Session A + Session B 必須全部完成

---

## Session C Prompt（複製以下區塊到新 session）

```
你是 brtclaw。雞味客服專案的整理工作進入 Session C（結構性變更）。

⚠️ Session C 必須在 Session A + Session B 完成後執行，每個動作需先跟 Hubert 確認。

## 專案上下文（必讀背景）
- 專案根目錄（原位置，git 倉庫）：/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
- 主位置（production runtime）：/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/
- GitHub：https://github.com/kaden1122123/chicken-group-buying-cs
- 兩個位置用 rsync 鏡像
- 專案性質：LINE 官方帳號「雞味研究所」AI 客服系統
- 性質提醒：src/ 是「設計驗證 + 測試對象」，不是 production runtime

## 整理狀態檔（必讀）
路徑：/home/clawuser/.openclaw/workspace/.task-state/chicken-cleanup/
- goal.md（整體目標 + Session A/B/C 結構）
- steps.md（每個 Session 進度）← 開始前先讀這份
- errors.md（錯誤記錄）

## 預期已完成
- Session A ✅：commit 70d588d（純刪除與狀態更新）
- Session B ✅：同步 config.yaml + 重寫 REVIEW_GUIDE + 統一 src/ 角色 + 搬移 SESSION_BACKGROUND
- Session C 開始前先讀 steps.md 確認 B1-B4 全部完成

## Session C 任務（5 個結構性變更）

⚠️ **Session C 是高風險操作，每個變更需要先跟 Hubert 確認方案**

### C1. 資料夾定位決策
- 現況：原位置 + 主位置 = 雙位置架構
- 方案 A（推薦）：維持現狀，明確化「原位置 = git + 開發入口；主位置 = production runtime」
  - 更新 MIGRATION_HISTORY.md 反映現況
- 方案 B：把 .git 移到主位置（單一 workspace）
  - 改動大，但簡化流程
- Hubert 必須決定

### C2. knowledge/base/ 處理
- 現況：knowledge/base/ 與 knowledge/tenants/chicken/ 11/12 檔案 byte-identical
- 只有 04_delivery.md 不同（tenant 版較新）
- 方案 A（推薦）：刪除 knowledge/base/ 全部 12 個檔
  - 改 src/knowledge/loader.js 移除 fallback 邏輯
- 方案 B：保留 knowledge/base/ + 自動同步（每次改 tenants 同步到 base）
- Hubert 必須決定

### C3. config.yaml legacy 處理
- 現況：config.yaml 與 config/tenants/chicken.yaml 部分欄位可能仍不一致
- B1 已同步 open_dates，但其他欄位（block_others、allowed_line_users 等）需全量比對
- 方案 A（推薦）：config.yaml 繼續作為 fallback（向後相容）
  - 但需要定期同步關鍵欄位（可考慮加 script）
- 方案 B：刪除 config.yaml，要求所有環境用 config/tenants/{tenant}.yaml
  - 簡化但增加耦合
- Hubert 必須決定

### C4. docs/archive/planning-2026-06-12/ 處理
- 現況：16 個早期規劃文件，分散在 8 個子目錄
- 方案 A（推薦）：保留 archive，加 README.md 說明已歸檔
- 方案 B：整個 git rm（歷史全失）
- Hubert 必須決定

### C5. SPEC.md 重寫
- 現況：SPEC.md 只涵蓋 P1 規格，與現況脫節（CSV 26→27 欄、狀態數錯誤、src/ 角色錯誤等）
- 方案 A（推薦）：partial update（更新 CSV schema + 狀態數 + src/ 角色 + 已知偏差）
  - 預估 1 小時
- 方案 B：完整重寫 v2（耗時 ~2hr，涵蓋完整 v1.1 規格）
- Hubert 必須決定

## 執行流程
1. 讀取 steps.md 確認 Session A + B 完成
2. 一次只處理一個決策（C1 → C2 → C3 → C4 → C5）
3. 每個決策動作：
   a. 用訊息格式呈現方案給 Hubert：
      「C{n} 決策：{主題}。方案 A：{做法}（利：x、弊：y）。方案 B：{做法}（利：x、弊：y）。我推薦 A。請決定。」
   b. 等 Hubert 回覆（不預設）
   c. 執行變更
   d. commit（每個決策 1 個 commit）
   e. 更新 steps.md（追加 §Session C {C1-C5} 結果）
4. 全部完成後統一 push + rsync

## 約束
1. **高風險**：每個動作前必須明確 Hubert 決定，不要預設
2. 每完成一個決策立即 commit
3. 不要中途 push（Session C 結束時統一 push）
4. 不要中途 rsync（Session C 結束時統一 rsync 一次）
5. 同步狀態：每完成一個動作更新 steps.md
6. 若發現問題，更新 errors.md

## Session C 完成後
1. 更新 steps.md（標記 C1-C5 全部完成）
2. 更新 goal.md（標記 Session A/B/C 全部完成）
3. rsync 到主位置
4. 統一 push GitHub
5. 通知 Hubert 整體完成 + 列出所有 commit hashes + 三大改善摘要

## 你（brtclaw）的職責
- 開始前先讀 steps.md 確認 Session A + B 結果
- 對 Hubert 確認每個 C1-C5 方案（給推薦 + 利弊分析）
- 執行確認後的變更
- 每步驟 commit + 更新 steps.md
- Session 結束時更新 steps.md + 更新 goal.md + 通知 Hubert

開始吧。
```

---

## 使用方式

1. **先確認 Session A + B 完成**（讀 steps.md）
2. 開新 session
3. 完整複製「Session C Prompt」區塊（從 `你是 brtclaw...` 到 `開始吧。\````）
4. 貼到第一則訊息
5. brtclaw 自動讀取 `.task-state/chicken-cleanup/steps.md`，逐個處理 C1-C5

---

## 對應檔案

- `goal.md` §Session C — 動作清單
- `steps.md` §Session C — 進度記錄
- `errors.md` — 失敗記錄

---

## C1-C5 決策速查表

| # | 主題 | 方案 A（推薦） | 方案 B |
|---|------|----------------|--------|
| C1 | 資料夾定位 | 維持雙位置 + 明確化 | 單一 workspace（移 .git） |
| C2 | knowledge/base/ | 刪除 + 移除 loader fallback | 保留 + 自動同步 |
| C3 | config.yaml legacy | 保留 + 定期同步 | 刪除（要求 tenant-only）|
| C4 | planning-2026-06-12/ | 保留 + 加 README | 整個 git rm |
| C5 | SPEC.md | partial update | 完整重寫 v2 |

---

_本檔由 brtclaw 維護，2026-06-27 17:05_