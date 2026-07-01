# Session Index — 後續修整 Sessions（CEO 視角）

> **建立時間**：2026-06-28 16:54
> **觸發**：Session P0 完成（Engineering Handbook + ADR + 自動化檢查）
> **最後更新**：2026-07-01（Session D3+D4 文件收尾 + E 狀態更新）

---

## 快速導覽

| Session | 業務問題（CEO 視角）| 推薦 | 估時 | 狀態 |
|---------|---------------------|------|------|------|
| **E** | 客戶按「確認訂購」按鈕沒反應，訂單沒成立 | 🔴 高 | 1-2 小時決策 + 實作 | ✅ 已完成（2026-06-28，D → A 修正）|
| **D3** | 改 chicken.yaml 的業務規則沒效果（要工程師改 code）| 🔴 高 | 2-3 小時 | ✅ 已完成（2026-07-01）|
| **D4** | 9 個開關永遠當啟用（config 寫 false 沒用）| 🔴 高 | 2 小時 | ✅ 已完成（2026-07-01）|
| **F** | 文件寫的跟實際對不上（測試套數等）| 🟡 中 | 1.5 小時 | ⏳ 待執行 |
| **G** | 沒有自動化測試、沒有 ESLint | 🟡 中 | 2-3 小時 | ⏳ 待執行 |
| **H** | 6 個重要模組沒有 unit test | 🟡 中 | 3-4 小時 | ⏳ 待執行 |
| **J** | sync-mirror 會誤刪主位置測試資料 | 🟢 低 | 1-2 小時 | ⏳ 待執行 |
| **K** | log 格式不一致，難以除錯 | 🟢 低 | 2 小時 | ⏳ 待執行 |

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
└── SESSION_H_PROMPT.md    (補 helper 測試)
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
1. E（業務流程 — 影響營收）
2. D3（業務規則 — 影響營運彈性）
3. D4（設定開關 — 影響控制能力）
4. F（文件一致性 — 影響協作）
5. H（測試覆蓋 — 影響品質）
6. G（CI/CD — 影響效率）
7. J（雙位置 — 影響穩定）
8. K（logging — 影響除錯）
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
| **P0** | ✅（待 commit）| 新檔：HANDBOOK + 5 ADR + check-quality.sh + KNOWN_ISSUES + CEO_GUIDE |
| E | ⏳ 待決策 | — |
| D3 | ⏳ 待決策 | — |
| D4 | ⏳ 待決策 | — |
| F~K | ⏳ 待決策 | — |

---

_本檔由 brtclaw 維護，每次有新 session prompt 加入時更新_
