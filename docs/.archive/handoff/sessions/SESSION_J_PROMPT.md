# Session J — 雙位置架構強化 Prompt

> **業務問題（CEO 視角）**：`scripts/sync-mirror.sh` 沒有 dry-run，沒看就 sync 可能誤刪主位置的真實資料。`cleanup-test-orders.sh` 與 `tests/helpers/cleanup.js` 都有 PROTECTED 清單，兩處定義容易 drift。
> **影響**：🟢 低（影響操作安全性）
> **推薦**：做（1-2 小時、低風險）
> **狀態**：✅ 已完成（2026-06-29 改動 + 2026-07-01 regression test）
> **證據**：1 commit `1803bf5` (regression test) + pre-existing 2026-06-29 sync-mirror/.rsync-filter
> **涵蓋改動**：J1~J4（sync-mirror --dry-run、.rsync-filter、PROTECTED 單一來源、cleanup helper 統一）

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session J：雙位置架構強化。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session J 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session J）
3. scripts/sync-mirror.sh 現有程式
4. scripts/cleanup-test-orders.sh 現有程式
5. tests/helpers/cleanup.js 現有程式
6. MEMORY.md §I（SOP）

## Session J 任務（CEO 視角）

開始時問 CEO 決策：

「sync-mirror.sh 沒有 dry-run 可能誤刪資料，
cleanup-test-orders.sh 與 tests/helpers/cleanup.js PROTECTED 清單重複定義。
4 個低風險動作，做 / 不做？」

如果「做」，執行 4 個項目：

### J1：sync-mirror.sh 加 --dry-run 選項
- 新選項：`bash scripts/sync-mirror.sh from-legacy --dry-run`
- 行為：顯示會刪除/新增/修改的檔案清單，不真的執行
- 預設仍執行（向後相容），要明確加 --dry-run 才顯示
- 風險：低（純加 option）

### J2：sync-mirror.sh 加 --exclude-from .rsync-filter
- 新檔：`.rsync-filter` 列主位置特有的測試資料
- 範例：`data/orders/_csv_concurrency_test/`（測試 tenant）
- 風險：低（純加排除）

### J3：cleanup-test-orders.sh 整合 tests/helpers/cleanup.js 的 PRODUCTION_DATA_PROTECTED
- 現況：兩處都有 PROTECTED 清單（2026-06-13.csv + 2026-06-16.csv）
- 修法：cleanup-test-orders.sh 改用 Node 讀 PRODUCTION_DATA_PROTECTED
- 單一來源 = tests/helpers/cleanup.js
- 風險：低

### J4：cleanup-test-orders.sh 改用 require('../tests/helpers/cleanup.js')
- 現況：cleanup-test-orders.sh 是 bash 內嵌 array 定義 PROTECTED
- 修法：改為 node script，用 require 載入 helpers/cleanup.js
- 或：保留 bash 但用 node -e 讀 JSON
- 風險：低

## 必跑 SOP
- I-1：每個 J1~J4 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認 PROTECTED 清單引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 J1~J4 一個獨立 commit（4 commits 預期）
2. 既有 22 套測試不能破壞
3. 真實訂單保護（Session D SOP）持續生效
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. J1 sync-mirror --dry-run → bash scripts/sync-mirror.sh from-legacy --dry-run 驗證 → commit
4. J2 .rsync-filter → 驗證排除 → commit
5. J3 PROTECTED 單一來源 → npm test 驗證 → commit
6. J4 cleanup 改用 Node helper → npm test 驗證 → commit
7. 跑完整 check-quality.sh + npm test 全綠
8. 統一 push + rsync
9. 通知 Hubert

開始吧。
```