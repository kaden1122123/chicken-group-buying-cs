# Session K — 結構化 Logging Prompt

> **業務問題（CEO 視角）**：程式裡到處 `console.log` / `console.error`，訊息格式不一致。出問題很難 grep、沒辦法依「嚴重程度」過濾。
> **影響**：🟡 中（影響除錯效率）
> **推薦**：做（2 小時、中風險）
> **狀態**：✅ **已完成（2026-06-29）**
> **證據**：4 commits `99e44e5` (K1 logger.js)、`2c983b0` (K2 src/)、`c5435df` (K3 scripts/)、`6d6925f` (K3 followup)
> **最後更新**：2026-07-03（Session 結束文件 drift 修整）

### 子題狀態

| 項目 | 改動 | commit |
|------|------|--------|
| **K1** | 新增 `src/utils/logger.js` + 15+ 測試（JSON 輸出 + log level + stream 分流 + meta 防護） | `99e44e5` |
| **K2** | 替換 src/ 10 檔、共 19 處 console.* → logger.* | `2c983b0` |
| **K3** | 替換 scripts/ 5 檔、共 72 處 console.* → logger.* | `c5435df` |
| **K3 followup** | 還原 executable bit（cleanup-test-orders.js + dashboard-server-test.js） | `6d6925f` |
| **K4** | LOG_LEVEL 環境變數（K1 已實作） | `99e44e5` |

**新環境變數**：`LOG_LEVEL=debug|info|warn|error`（預設 info）
**新檔**：`src/utils/logger.js`、`tests/logger.test.js`

### 後續 X3-B 延伸

Phase 3 X3-B 加了 `LOG_DIR` 環境變數（讓 warn/error 寫入 daily JSON Lines）— 是 Session K 的補完延伸。
Phase 3 X3-C 加了 `/api/logs` + `/api/log-stats` 與 `log-panel.html` — 是 Session K 的可觀察化。

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session K：結構化 logging。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session K 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session K）
3. MEMORY.md §I（SOP）

## Session K 任務（CEO 視角）

開始時問 CEO 決策：

「console.log 散落各處，沒結構、沒 log level，
出問題很難找。建立 src/utils/logger.js 做結構化 logging，做 / 不做？」

如果「做」，執行 4 個項目：

### K1：新建 src/utils/logger.js
- API：logger.info(msg, meta), logger.warn(msg, meta), logger.error(msg, meta)
- 輸出格式：JSON（timestamp + level + msg + meta）
- 環境變數：LOG_LEVEL=info|warn|error（預設 info）
- 不破壞既有 console.error 在 sanitize/notifier 內的特殊用法
- 提供 tests/logger.test.js（10+ 測試）

### K2：替換 src/ 散落的 console.log
- grep -rn "console\.log" src/ 找出所有位置
- 改為 logger.info / logger.warn / logger.error
- 注意：tests/console.log 保留（測試輸出）
- 注意：sanitizer/notifier 的 console.warn 保留為 logger.warn

### K3：替換 scripts/ 散落的 console.log
- grep -rn "console\.log\|console\.warn\|console\.error" scripts/
- 改為 logger.* 或保留（端點日誌）
- api-server.js 統一用 logger 方便 production 除錯

### K4：環境變數 LOG_LEVEL 控制
- 從 process.env.LOG_LEVEL 讀取
- 預設 'info'，低於 level 不輸出
- 範例：LOG_LEVEL=warn 時 info 不輸出

## 必跑 SOP
- I-1：每個 K1~K4 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認 console.* 引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 K1~K4 一個獨立 commit（4 commits 預期）
2. K1 完成先跑 logger.test.js 驗證再進 K2
3. 既有 22 套測試不能破壞
4. tests/ 內的 console.log 保留（測試輸出必要）
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. K1 logger.js + tests/logger.test.js → npm test → commit
4. K2 替換 src/ console.* → npm test → commit
5. K3 替換 scripts/ console.* → npm test → commit
6. K4 LOG_LEVEL 環境變數 → npm test → commit
7. 跑完整 check-quality.sh + 連續 3 次 npm test 全綠
8. 統一 push + rsync
9. 更新 REVIEW_GUIDE.md（測試套數 22 → 23）
10. 通知 Hubert

開始吧。
```