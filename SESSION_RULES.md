# SESSION RULES — 每次 New Session 必讀必遵守的規則手冊

> **作者**：brtclaw（2026-08-01 19:21+）
> **適用對象**：接手雞味客服工作的 brtclaw session（首要）、Hubert（偶爾查閱）
> **目的**：規定每次 new session 開啟時必跑、必遵守的規則，避免 drift / 一環遞迴
> **last_updated**：2026-08-01 19:21+（Round 34 整合）

---

## 📜 9 條規則（每次 new session 必跑必遵守）

### 規則 1：開局必跑 5 步環境驗證
跑完才開始工作（見 NEW_SESSION_PROMPT.md §5 步環境驗證）
- git status --short / check-quality.sh / npm test / /healthz / config-sync.log

### 規則 2：永遠只在 L1 dev repo 編輯
- 不要在 L2 main mirror 直接改（chmod 555 保護）
- 不要在 L3 production runtime 直接改（chattr +i 保護）
- 任何修改都先在 L1 → sync-mirror.sh from-legacy → sync-canonical.sh

### 規則 3：改 src/ 後必跑 npm test + check-quality.sh
```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
npm test
bash scripts/check-quality.sh
# 預期：15 套全綠 / 13 通過 / 0 失敗
```

### 規則 4：commit 前必跑 3 個 SOP（MEMORY.md §I-1）
```bash
git add -A
git status --short       # 確認所有改動都 staged
git diff --cached --stat  # 確認 commit 範圍
git commit -m "..."
git show HEAD --stat      # 立即驗證 commit 包含預期檔案
git push origin main
```

### 規則 5：每個 Task 一個 commit（不要 commit 整個 session）
- 一個 Task = 一個 commit（清晰 audit）
- 不要 `git add <single-file>`（會漏 commit）
- Session 結束時統一 push（不中途）

### 規則 6：Session 結束必跑 7 步 SOP（推薦「commit 不自動更新」）
1. `bash scripts/check-quality.sh` 確認全綠
2. 更新 CHANGELOG.md
3. 更新本檔（記錄 Round N summary）
4. 寫當日 memory/YYYY-MM-DD.md
5. 更新 active-tasks.md
6. **跑 `scripts/update-session-state.sh` 自動更新 session docs**（一次 commit，不 noise）
7. git add -A + commit + push

### 規則 6.5：不要在 commit 後自動跑 update-session-state.sh（避免 noise commits）
- ❌ **post-commit hook**：每次 code commit 都生成 3 個 auto-gen 改動（noise）
- ✅ **只在 Session end SOP Step 6**：跑一次 update-session-state.sh，統一 commit
- 設計理由：避免 commit history 充滿 auto-gen diff，干擾 git blame / code review
- 例外：emergency patch（如 main_idea.md 修錯）可手動單獨跑

### 規則 6.6：Context Window 監控
```bash
# 每次 commit 後主動估算
bash scripts/check-session-tokens.sh

# 閾值判斷：
# - < 60% (120K)：正常，可繼續工作
# - 60-70%：留意，不要讀大型檔案
# - 70-80%：下次 commit 完成就 end session
# - > 80%：立即跑 session-end SOP
```

### 規則 7：所有老闆通知走 Email（節省 LINE 額度）
LINE 月額度限制 500：
- 客戶轉真人 → channels: ['email']
- B 方案自動建單 → channels: ['email']
- 測試通知 → channels: ['email']
- Email 5s throttle（sendEmailWithThrottle）

### 規則 8：不要對系統造成不可逆的後果
- 永遠不要刪 `data/orders/chicken/2026-06-1{3,6}.csv`（真實訂單保護）
- 永遠不要 commit .env / secrets
- 永遠不要在 production runtime 用 pkill -f（會 self-kill）
- 改 .env 前必明確問 Hubert 並取得同意

### 規則 9：每個變更必留 audit trail
- commit message 必含「為何改」（不只是「改了什麼」）
- handoff / session summary 必含 Round N + 完成項目 + 下次第一件事
- 客戶邏輯錯亂 / bug 必在 docs/KNOWN_ISSUES.md 留紀錄

---

## 🎯 規則套用流程圖

```
New session
  ↓
[規則 1] 5 步環境驗證 ✅
  ↓
[規則 2] 在 L1 dev repo 工作
  ↓
實作：
  - 改 src/ → [規則 3] npm test + check-quality
  - 改 config → sync-config.sh
  - 改 KB → verify-kb-sources.js
  - 改 production prompt → sync-canonical.sh
  ↓
[規則 4 + 5] commit 前 SOP + 每 Task 一 commit
  ↓
Session 結束：
  [規則 6] 7 步 Session End SOP（含 update-session-state.sh）
  [規則 7] 所有老闆通知走 Email
  [規則 8] 不刪保護檔案 / 不 commit secrets
  [規則 9] 留 audit trail
```

---

## 📋 文件對應規則

| 規則 | 文件位置 | 觸發時機 |
|------|----------|----------|
| 規則 1 | NEW_SESSION_PROMPT.md | 開新 session |
| 規則 2 | docs/adr/0002-dual-location-architecture.md | 改任何檔案前 |
| 規則 3 | scripts/check-quality.sh + npm test | 改 src/ 後 |
| 規則 4 | MEMORY.md §I-1 + scripts/check-quality.sh | 每次 commit 前 |
| 規則 5 | ADR-0005 | 每次 commit |
| 規則 6 | docs/SESSION_END_SOP.md | Session 結束 |
| 規則 7 | src/handoff/notifier.js | 任何通知 |
| 規則 8 | this file + MEMORY.md | 任何危險操作 |
| 規則 9 | CHANGELOG.md + Round handoff | 每次 commit |

---

## 🔄 變更歷史

### 2026-08-01 19:21+（Round 34）

**首次建立（本檔）**

建立完整 9 條規則 + 規則對應文件 + 套用流程圖。

**對應配套檔案**：
- `NEW_SESSION_PROMPT.md`：Hubert 開新 session 貼的 prompt
- `scripts/update-session-state.sh`：auto-update 機制
- `MEMORY.md`（系統層）：L1/L2/L3 三層記憶結構

**核心設計目標**：
- 避免多 session 開發導致底層理解不一致（Hubert 13:17 訊息）
- 自動 enforce 規則（不依賴記憶）
- 文件是 single source of truth（不是 LLM 大腦）

---

_本檔由 brtclaw 維護，9 條規則在於讓接手 brtclaw session「首次執行就知道怎麼做」_
_對應 NEW_SESSION_PROMPT.md：可直接貼到 Discord 開新 session_
_對應 scripts/update-session-state.sh：commit 後自動更新_
