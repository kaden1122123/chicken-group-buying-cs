# Session G — 步驟歷史

> 對應 goal.md。每次 Session 結束更新本檔。

---

## Session G.1 — 2026-06-28 20:23 ✅

**狀態**：完成（CI 真的綠了）
**Commit**：`df8e7a9`（`ef54879..df8e7a9`，已 pushed + CI ✅）
**rsync**：✅ 主位置已同步

### 問題發現（Hubert 抓到）

第一次 commit (`ef54879`) 我以為 `npm run lint exit 0 = session 完成`。
實際上 lint 通過但 `npm test` 在 CI fail。

**真實失敗原因**：
- GitHub Actions runner 用 UTC 時區
- `tests/date.test.js:73` 用 `mockTime('2026-06-15T14:00:00+08:00')` 模擬台北時間
- 程式碼用 `current.getHours()` 取小時，但這是系統時區的小時
- UTC 環境下 `14:00 +08:00 = 06:00 UTC`，所以 `getHours() = 6 < 13`
- 沒過收單時間 → 推薦 2026-06-16（測試期望跳過到 2026-06-18）

### 本機重現驗證

```bash
TZ=UTC npm test        # exit 1, date.test.js:73 fail（重現 CI fail）
TZ=Asia/Taipei npm test # exit 0（19 套全綠）
```

### 修法（最小改動）

`.github/workflows/test.yml` 加 `env: TZ: Asia/Taipei`：

```yaml
jobs:
  test:
    env:
      TZ: Asia/Taipei
    runs-on: ubuntu-latest
    ...
```

### CI 結果（commit `df8e7a9`）

跑 GitHub Actions run `28322040839`，全部 success：

```
✓ Set up job
✓ Checkout repository
✓ Setup Node.js 22
✓ Install dependencies (npm ci)
✓ Run linter (npm run lint)
✓ Run unit tests (npm test)
✓ Verify .nvmrc
```

**真的綠了** ✅

### Session 完成的嚴謹定義

這次教訓（Hubert 抓到）：

| 之前我以為 | 實際應該是 |
|------------|-----------|
| `npm run lint` exit 0 = lint 過 | 還要 CI 實際跑綠 |
| 本機 npm test 全綠 = 測試過 | 不同時區 / 環境可能 fail |
| commit + push = session 完成 | CI 真的 success 才算完成 |

未來 brtclaw session SOP 加入：

1. Commit + push 後必須實際看 CI 結果（用 `gh run view`）
2. CI 真的 success 才回報「session 完成」
3. 如果 CI fail，繼續修，不算完成

---

## Session G — 2026-06-28 20:10 ⚠️（**CI fail，已被 G.1 修正**）

**狀態**：第一次 commit 失敗（lint 過但 npm test fail）
**Commit**：`ef54879`（`01ac0b4..ef54879`，已 pushed 但 CI fail）

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
- [x] commit `df8e7a9` 修正時區（已驗證 CI 真的 success）
- [x] push GitHub ✅（`df8e7a9` 推到 origin/main）
- [x] rsync 主位置 ✅（`.nvmrc`、`.eslintrc.json`、`.github/workflows/test.yml` 都在主位置）
- [x] 驗證主位置真實訂單仍在 ✅
- [x] npm test 連續 3 次全綠 ✅（本機）
- [x] npm run lint 0 errors ✅（本機 + CI 都綠）
- [x] **GitHub Actions 真的綠** ✅（run 28322040839，10 步全 success）
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