# Session G — 步驟歷史

> 對應 goal.md。每次 Session 結束更新本檔。

---

## Session G — 2026-06-28 20:10 ✅

**狀態**：完成
**Commit**：`ef54879`（`01ac0b4..ef54879`，已 pushed）
**rsync**：✅ 主位置已同步

### 動作結果

| # | 動作 | 結果 |
|---|------|------|
| G1 | 建立 `.nvmrc` | ✅（寫入 `22`，對應 Node 22.22.2）|
| G2 | 安裝 ESLint + 自訂 config 對齊 src/ 風格 | ✅（0 errors, 64 warnings）|
| G3 | 建立 `.github/workflows/test.yml` | ✅（push/PR 觸發、Node 22 + cache）|
| - | ESLint --fix 自動修 53 個檔案 | ✅（純風格：shorthand、trailing comma、const、eol-last）|
| - | 更新 PHASE1_PROGRESS.md | ✅（加 Session G 完成段）|
| - | 更新 REVIEW_GUIDE.md | ✅（17 → 19 套測試）|
| - | 更新 ENGINEERING_HANDBOOK.md | ✅（加 §7.2 CI/CD + §6.5 修 lint）|
| - | 建立 SESSION_G_PROMPT.md | ✅（archive 用，供未來 session）|
| - | 建立 .task-state/session-G/goal.md | ✅（任務狀態）|

### 統計

- 62 files changed, 4007 insertions(+), 274 deletions(-)
- 56 modified + 6 new
- npm test 連續 3 次全綠（19 套）
- npm run lint：0 errors, 64 warnings（exit 0）
- 真實訂單保護 ✅（2026-06-13.csv + 2026-06-16.csv）

### 事實查核修正

| 階段 | 我以為 | 實際 |
|------|--------|------|
| 初評估 | 105 個 `==` 違規（regex bug）| 0 個 `==` 違規（Python 精準統計）|
| 試裝 standard | src/ 100% 合規 | src/ 有 766 違規（space-before-function-paren、comma-dangle 等差異）|
| 試裝 semistandard | src/ 應該只差在 `;` | 還有 305 違規（comma-dangle 等）|
| 最終用 eslint:recommended + 自訂 | 應該 0 error | 11 error + 57 warning（修後 0 error, 64 warning）|

### 技術決策記錄

#### 為何用 `eslint:recommended` + 自訂 rules 而非 `semistandard`

src/ 風格不完全對齊 semistandard：
- semistandard：`comma-dangle: never`, `space-before-function-paren: always`
- src/：`comma-dangle: yes`（137 處）, `space-before-function-paren: named=never`

如果用 semistandard，需要修 100+ 個檔案的風格（風險高）。
改用 eslint:recommended + 自訂 rules 對齊 src/ 既有風格，套上去 0 error。

#### 為何用 ESLint 8 而非 9

- ESLint 9 用 flat config (`eslint.config.js`)
- `eslint-plugin-node` 對 ESLint 9 支援還不完整
- ESLint 8.57.1 是 stable + 所有 plugin 相容

### 待 CEO 動作

- ⏸ 去 GitHub repo Settings → Actions → Enable workflow
- URL: https://github.com/kaden1122123/chicken-group-buying-cs/settings/actions

### 驗證

- [x] commit `ef54879` 包含 62 個檔案（已驗證 `git show HEAD --stat`）
- [x] push GitHub ✅
- [x] rsync 主位置 ✅
- [x] 驗證主位置真實訂單仍在 ✅
- [x] npm test 連續 3 次全綠 ✅
- [x] npm run lint 0 errors ✅
- [x] working tree 乾淨 ✅
- [x] 通知 Hubert ✅（本檔 + Discord reply）

---

## 已知問題（與 G 無關，留待後續 session）

### Hardcode（5 個，Session D3 待 CEO 決策）

- `src/rules/paymentRule.js`: `'1000'` (現金上限)
- `src/order/orderFormatter.js`: `'350'` (免運門檻)
- `src/rules/addressRule.js`: `['三峽','鶯歌']` (配送範圍)
- `src/states/awaitingPayment.js`: `'Willy0221'` (LINE Pay ID)
- `src/states/awaitingPayment.js`: `'23257030422'` (銀行帳號)

### Dead config flag（9 個，Session D4 待 CEO 決策）

storage.phase1/2、payment.*.enabled、handoff.notify_owner.enabled、official.line_pay.enabled、security.input_sanitization

### Lint warnings（64 個，多為 no-unused-vars）

- src/index.js 6 個未使用 import（handleConfirming、isCancelReply 等）— 可能是 stub 或 refactor 留下
- src/config.js 3 個未使用變數（currentListKey、currentListIndent、parentIndent）
- 其他分散在多個檔案

這些警告不擋 CI，列為下輪重構目標。

---

_本檔由 brtclaw 維護_