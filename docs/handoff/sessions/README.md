# Session Index — 後續修整 Sessions（CEO 視角）

> **建立時間**：2026-06-28 16:54
> **觸發**：Session P0 完成（Engineering Handbook + ADR + 自動化檢查）
> **最後更新**：2026-07-01 12:43（Phase 3 全部 6 sessions 完成）

---

## 快速導覽

| Session | 業務問題（CEO 視角）| 推薦 | 估時 | 狀態 |
|---------|---------------------|------|------|------|
| **E** | 客戶按「確認訂購」按鈕沒反應，訂單沒成立 | 🔴 高 | 1-2 小時決策 + 實作 | ✅ 已完成（2026-06-28，D → A 修正）|
| **D3** | 改 chicken.yaml 的業務規則沒效果（要工程師改 code）| 🔴 高 | 2-3 小時 | ✅ 已完成（2026-07-01）|
| **D4** | 9 個開關永遠當啟用（config 寫 false 沒用）| 🔴 高 | 2 小時 | ✅ 已完成（2026-07-01）|
| **F** | 文件寫的跟實際對不上（測試套數等）| 🟡 中 | 1.5 小時 | ✅ 已完成（2026-07-01）|
| **G** | 沒有自動化測試、沒有 ESLint | 🟡 中 | 2-3 小時 | ✅ 已完成（2026-06-28 + 2026-07-01 G4）|
| **H** | 6 個重要模組沒有 unit test | 🟡 中 | 3-4 小時 | ✅ 已完成（與 H8 合併,2026-07-01）|
| **H8** | 完整系統掃描 13 個 src/ 模組無專屬測試 | 🔴 高 | 1.5-2 小時 | ✅ 已完成（2026-07-01，共 4 commits）|
| **J** | sync-mirror 會誤刪主位置測試資料 | 🟢 低 | 1-2 小時 | ✅ 已完成（2026-06-29 + 2026-07-01 regression test）|
| **K** | log 格式不一致，難以除錯 | 🟢 低 | 2 小時 | ✅ 已完成（2026-06-29，K1-K4 + K3 followup）|

---

## 完整系統掃描衍生 sessions（2026-07-01）

經完整 codebase audit 後新增的 sessions 全部完成：

| Session | 業務問題（CEO 視角）| 推薦 | 估時 | 狀態 |
|---------|---------------------|------|------|------|
| **X1** | 生產 prompt 版本管理混亂 | 🟡 中 | 1 小時 | ✅ 已完成（2026-07-01，共 4 commits）|
| **X2** | 11 個 SESSION prompt 沒狀態欄 | 🟢 低 | 30 分鐘 | ✅ 已完成（2026-07-01）|
| **X3** | dashboard 只看訂單，故障排查需翻 log | 🟡 中 | 1-1.5 小時 | ✅ 已完成（2026-07-01，共 3 commits）|
| **X4** | csvWriter 沒 retry + trigger 沒 cache | 🟢 低 | 1.5 小時 | ✅ 已完成（2026-07-01，共 2 commits）|
| **X5** | 3 個 service 無統一健康端點 | 🟢 低 | 1 小時 | ✅ 已完成（2026-07-01，共 3 commits）|

---

## 待用 sessions（升級觸發才使用）

| Session | 觸發 | 狀態 |
|---------|------|------|
| **I** | api-server hardening（api-server 還沒 production 用，待 LLM 訂單成立時才需要）| ⏸ 待用升級觸發（**已完成** 2026-06-29 11:48，6 commits I1-I6） |
| **L** | API 文件化（openapi.yaml 已寫，待需要 OpenAPI SDK 才用）| ⏸ 待用 |
| **M** | Backup 機制（✅ 已完成 + 排程）| ✅ 已完成 |
| **O** | OpenClaw agent B 方案升級（4-6 小時）— 待用 | ⏸ 待用 |
| **P** | OpenClaw ↔ Worker KV 同步 C 方案升級（6-8 小時）— 待用 | ⏸ 待用 |

**Phase 3 全部 6 sessions 完成 ✅**（X1/X2/X3/X4/X5/H8）
詳細 commit hash 與改動記錄：見 PHASE1_PROGRESS.md

**完整 13 個決策的 CEO 視角描述**：見 `docs/CEO_DECISION_GUIDE.md`

---

## Session Prompt 檔案位置

每個 session 在 `docs/handoff/sessions/` 下有對應的 prompt 檔：

```
docs/handoff/sessions/
├── README.md              (本檔)
├── SESSION_E_PROMPT.md    (業務流程方向)
├── SESSION_D3_PROMPT.md   (修 5 個 hardcode)
├── SESSION_D4_PROMPT.md   (修 9 個 dead config)
├── SESSION_F_PROMPT.md    (文件一致性)
├── SESSION_G_PROMPT.md    (CI/CD + ESLint)
├── SESSION_H_PROMPT.md    (補 6 個 helper 測試)
├── SESSION_H8_PROMPT.md   (補 13 個 src/ 模組測試 — H 延伸)
├── SESSION_I_PROMPT.md    (api-server production hardening)
├── SESSION_J_PROMPT.md    (雙位置架構強化)
├── SESSION_K_PROMPT.md    (監控 + logging)
├── SESSION_L_PROMPT.md    (API 文件化)
├── SESSION_M_PROMPT.md    (Backup + 排程)
├── SESSION_N_PROMPT.md    (v2 流程實作 A 方案)
├── SESSION_O_PROMPT.md    (B 方案升級 — OpenClaw agent tool calling)
├── SESSION_P_PROMPT.md    (C 方案升級 — OpenClaw ↔ Worker KV)
├── SESSION_Q_PROMPT.md    (客戶實測 4 大問題修整)
├── SESSION_X1_PROMPT.md   (生產 prompt 版本管理 + CHANGELOG)
├── SESSION_X2_PROMPT.md   (SESSION prompt 狀態欄統一)
├── SESSION_X3_PROMPT.md   (觀察工具 dashboard 增強)
├── SESSION_X4_PROMPT.md   (csvWriter retry + trigger cache)
└── SESSION_X5_PROMPT.md   (Worker + api-server 健康檢查)
```

---

## 使用方式

### Step 1：選一個 session

從上表選一個你想做的 session（看 CEO 視角的「業務問題」判斷優先順序）。

### Step 2：給決策

直接回 `E: D` 或 `D3: 做` 之類（看 CEO_GUIDE.md 格式）。

### Step 3：複製 prompt

從對應的 `SESSION_X_PROMPT.md` 複製「Prompt 區段」（從「你是 brtclaw」開始到「開始吧」結束）。

### Step 4：貼到新 session

在 Discord 新 session 貼上 prompt。

### Step 5：brtclaw 接手

新 session 的 brtclaw 會：
1. 自動讀必讀文件
2. 用 CEO 視角問決策（如有）
3. 執行 session
4. 結束時統一 push + rsync + 通知

---

## 建議執行順序

依 CEO 視角的影響排序：

```
1. E（業務流程 — 影響營收）✅ 已完成
2. D3（業務規則 — 影響營運彈性）✅ 已完成
3. D4（設定開關 — 影響控制能力）✅ 已完成
4. F（文件一致性 — 影響協作）✅ 已完成
5. H（測試覆蓋 — 影響品質）⏳ 待執行
6. H8（13 模組測試 — 影響品質+收入）⏳ 待執行 ← 新增
7. G（CI/CD — 影響效率）✅ 已完成（含 G4 lint gate）
8. J（雙位置 — 影響穩定）✅ 已完成
9. K（logging — 影響除錯）⏳ 待執行
10. X1（prompt 版本管理 — 影響接手效率）⏳ 待執行 ← 新增
11. X2（prompt 狀態欄 — 影響接手）⏳ 待執行 ← 新增（輕量 30 min）
12. X3（dashboard 觀察 — 影響故障排查）⏳ 待執行 ← 新增
13. X4（retry + cache — 影響偶發失敗）⏳ 待執行 ← 新增
14. X5（健康檢查 — 影響故障察覺）⏳ 待執行 ← 新增
```

---

## 必跑 SOP（每個 session 都用）

不管做哪個 session，brtclaw 都會跑：

1. **I-1 Commit 前 SOP**（MEMORY.md §I）：
   ```bash
   git add -A
   git status --short
   git diff --cached --stat
   git commit -m "..."
   git show HEAD --stat  # 驗證
   ```

2. **I-2 事實查核 SOP**：grep 引用點、dead code 與 active 分開、副作用分析

3. **I-3 方案描述 SOP**：每方案含「會連帶改 X、Y、Z」

4. **品質檢查**：
   ```bash
   bash scripts/check-quality.sh
   ```

5. **真實訂單保護**：絕對不能刪 `data/orders/chicken/2026-06-13.csv` 或 `2026-06-16.csv`

---

## 與已完成的 Sessions 對照

| Session | 狀態 | 對應 commits |
|---------|------|-------------|
| A | ✅ | `70d588d` |
| B | ✅ | `6a2d4d1`, `4d83124`, `68a3e32`, `732a3a0` |
| C | ✅ | `5320128`, `7f68618`, `2750145`, `61cc299`, `6ebb595` |
| D | ✅ | `84ec44f`, `338bec3` |
| **P0** | ✅ | HANDBOOK + 5 ADR + check-quality.sh + KNOWN_ISSUES + CEO_GUIDE |
| **E** | ✅ | 6/28（决策 D → N 修正為 A 方案）|
| **D3** | ✅ | `335e9e1`, `2fbde28`, `a6de28c`, `5301843`（2026-07-01）|
| **D4** | ✅ | `06fea37`（2026-07-01）+ pre-existing multi-commit |
| **F** | ✅ | `7330217`, `b374955`（2026-07-01）|
| **G** | ✅ | `475416d` (G4 lint gate) + pre-existing 2026-06-28 |
| **J** | ✅ | `1803bf5` (regression test) + pre-existing 2026-06-29 |
| **Q** | 客戶實測 4 個 production bug（菜單圖片 / memory 路徑 / 回覆卡住 / Dashboard 未啟動） | 🔴 高 | 2-3 小時 | 🟡 部分完成（Q1 ✅ / Q2 ✅ / Q3 ✅ 結論收斂 / Q4 🟡 watchdog cron OK，背景啟動 SOP 未正式化） |
| **H** | 6 個 helper 沒有 unit test | 🟡 中 | 3-4 小時 | ✅ 已完成（與 H8 合併，2026-07-01） |
| **H8** | 完整系統掃描 13 個 src/ 模組無專屬測試 | 🔴 高 | 1.5-2 小時 | ✅ 已完成（2026-07-01，共 4 commits） |
| K | ⏳ 待執行 | — |
| X1~X5 | ⏳ 待執行 | —（session prompts 已建立於 `SESSION_X{1..5}_PROMPT.md`）|
| I / L / M | ⏸ 待用或已完成 | I ✅ (2026-06-29)、L 待升級時用、M ✅ |
| O / P | ⏸ 待用（升級觸發）| — |

---

## 2026-07-01 完整系統掃描結論

經本次 audit，識別的 gap 與提議的新 sessions 已 sync：
- 6 個新 prompt 已建立：`SESSION_H8_PROMPT.md`、`SESSION_X{1..5}_PROMPT.md`
- 預估總工時 6-7 小時，依序執行可在 1 個工作天內完成
- 推薦起點：**X2**（30 分鐘，順手）→ **H8**（最大 ROI）→ **X1** → **X4** → **X3** → **X5**

---

_本檔由 brtclaw 維護，每次有新 session prompt 加入時更新_
