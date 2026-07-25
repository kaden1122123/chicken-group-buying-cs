# 雞味客服 — Engineering Handbook

> **目標讀者**：新工程師 / brtclaw 新 session / 未來接手者
> **閱讀時間**：30 分鐘內掌握全貌
> **建立時間**：2026-06-28（Session P0）
> **last_updated**：2026-07-25（Round 26 — 連結修補）
> **維護者**：brtclaw
> **版本**：v1.0

---

## 一、TL;DR — 一頁搞懂

**這是什麼**：雞肉團購 LINE 官方帳號「雞味研究所」的 AI 客服系統。

**核心事實**：
- LINE 用戶訊息 → Cloudflare Worker → OpenClaw Agent → 回覆
- `src/` 是**設計驗證 + 測試對象**，**不是 production runtime**（很重要！）
- 真實 production：`~/.openclaw/agents/external-user/`（由 LLM prompt 驅動，不是 src/）
- `src/` 做的事：把 prompt 邏輯拆成可 unit test 的 JS 模組

**目前狀態**：
- Phase 1：CSV 本地儲存（已啟用）
- 測試：19 套全綠（17 既有 + helpers/cleanup + csv-writer-concurrency）
- 已知問題：8 處 hardcode、10 個 dead config flag、6 個 helper 無單元測試
- 業務流程：6/16 訂單流程方向未定（影響 production）
- **CI/CD**（2026-06-28 Session G）：GitHub Actions 自動跑 `npm test` + `npm run lint`

---

## 二、專案本質（必讀）

### src/ 不是 production runtime

這是接手者最容易搞錯的事。

| | 位置 | 角色 |
|---|------|------|
| **Production runtime** | `~/.openclaw/agents/external-user/` | OpenClaw agent，LLM prompt 驅動 |
| **src/** | 本倉庫 `src/` | 把 prompt 邏輯拆成可測試的 JS 模組 |
| **tests/** | 本倉庫 `tests/` | 驗證 src/ 邏輯正確 |

詳細說明見 [SPEC.md](../SPEC.md)「v1.0 → v1.1 變更」段。

### 為什麼這樣設計

- **LLM 不可靠**：直接靠 LLM 寫 CSV / 處理訂單容易出錯
- **驗證機制**：用 src/ 模組化邏輯 + 19 套 unit test 驗證
- **生產用 prompt**：OpenClaw agent 用 prompt 引導 LLM 模仿 src/ 的邏輯
- **測試守門員**：src/ 改了，19 套測試沒破壞 → 邏輯仍正確

---

## 三、系統架構

```
┌─────────────┐
│ LINE 用戶    │
└──────┬──────┘
       │ LINE message
       ▼
┌─────────────────────┐
│ Cloudflare Worker    │ ← 過濾（Ignored/Payment/Injection/Rate limit）
│ (cloudflare-worker/) │
└──────┬──────────────┘
       │ 乾淨訊息
       ▼
┌─────────────────────┐
│ OpenClaw Gateway     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ OpenClaw Agent       │ ← production runtime（NOT in this repo）
│ external-user        │   - SOUL.md
│ ~/.openclaw/agents/  │   - AGENTS.md
│                     │   - knowledge/main_idea.md
└──────┬──────────────┘    - MEMORY.md（用 SOUL 觀察）
       │ LLM 回覆 + tool calls
       ▼
┌─────────────────────┐
│ src/ 邏輯驗證        │ ← 本倉庫
│ (本專案 src/)        │   - 把 prompt 邏輯模組化
│                     │   - 19 套 unit test 守門
└─────────────────────┘

（資料儲存）
- data/orders/{tenant}/{date}.csv（Phase 1）
- 規劃 Google Sheets（Phase 2，未啟用）
```

---

## 四、雙位置架構（為何）

**兩個位置**：
| 位置 | 路徑 | 角色 |
|------|------|------|
| **原位置** | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | brtclaw 工作目錄 + git 倉庫 + GitHub |
| **主位置** | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | production runtime 鏡像 |

**為何雙位置**（不是 bug 是設計）：
1. **Git 隔離**：原位置是 git，主位置不帶 `.git` 歷史
2. **Secrets 隔離**：主位置 `.env`（真實 API keys）不進 git
3. **私人物料隔離**：Hubert 個人資料夾只在原位置
4. **執行環境純淨**：部署時不被 git metadata 污染

**同步**：`scripts/sync-mirror.sh from-legacy`（原 → 主）

詳細：見 [MIGRATION_HISTORY.md](../MIGRATION_HISTORY.md)

---

## 五、檔案結構導覽（30 秒搞懂每個資料夾）

```
chicken-group-buying-customer-service/
├── src/                     ← 可測試 JS 邏輯（設計驗證 + 測試對象）
│   ├── index.js             ← 訊息處理主入口（handleMessage, handleWebhookEvent）
│   ├── config.js            ← 統一設定介面（getXxx() 函式）
│   ├── states/              ← 狀態機（idle / awaitingInfo / confirming / handoff / completed）
│   ├── rules/               ← 驗證規則（address / phone / menu / payment / date / price / timeSlot）
│   ├── order/               ← CSV 寫讀 + 訂單格式化（csvWriter/csvReader/orderFormatter/orderIdGenerator）
│   ├── knowledge/           ← 知識庫 loader（loader.js, triggers.js）
│   ├── handoff/             ← 轉真人邏輯（notifier / transferRules / notificationFormat）
│   ├── utils/               ← 工具（sanitizer / timeUtils / lineReply / lineProfileCache）
│   └── middleware/          ← whitelist.js
├── tests/                   ← 19 套單元測試
├── docs/                    ← 文件（見 §十 文件地圖）
├── knowledge/tenants/chicken/  ← 知識庫單一來源（10 個 md 檔）
├── config/                  ← 多租戶設定（chicken.yaml 為 single source of truth）
├── scripts/                 ← 工具腳本（api-server / dashboard-server / sync-mirror / cleanup / sync-config）
├── data/orders/chicken/     ← CSV 訂單（git tracked 真實訂單：2026-06-13.csv, 2026-06-16.csv）
└── .openclaw-internal/      ← 內部文件（brtclaw session 用，不對外）
```

---

## 六、開發流程（如何改東西）

### 6.1 改 src/ 邏輯

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/

# 1. 改 src/ 邏輯
vim src/rules/addressRule.js

# 2. 跑測試驗證
npm test                          # 連續 3 次全綠

# 3. 跑 lint 檢查（ESLint 0 errors required）
npm run lint                      # 0 errors, 64 warnings (warning 不擋 CI)

# 4. 跑品質檢查（pre-commit 自動跑）
bash scripts/check-quality.sh

# 5. Commit
git add -A
git status --short
git diff --cached --stat
git commit -m "fix(rules): ..."

# 6. Push + rsync 到主位置
git push origin main
bash scripts/sync-mirror.sh from-legacy
```

### 6.2 改 config

⚠️ **Single source of truth = `config/tenants/chicken.yaml`**

```bash
# 1. 改 chicken.yaml
vim config/tenants/chicken.yaml

# 2. 同步到 config.yaml（legacy fallback）
bash scripts/sync-config.sh

# 3. 驗證
npm test
```

### 6.3 改知識庫

⚠️ **Single source of truth = `knowledge/tenants/chicken/*.md`**

`config.yaml` 的 `delivery.areas` 是 legacy 摘要（已過於簡化），實際範圍從 `04_delivery.md` 讀。

### 6.4 加新測試

```bash
# 1. 寫 tests/xxx.test.js（風格：assert + console.log + ALL PASSED 結尾）
# 2. 加到 package.json test script
# 3. 跑驗證
npm test
npm run lint
```

### 6.6 Prompt 版本變更 → Sandbox / LLM Agent 同步（SOP，Session X1-C 新增）

> **觸發**：修改了 `docs/production-prompt/2026-06-28/main_idea.md` 或 SOUL.md
> **目的**：確保 sandbox 端點與 production LLM agent 同步到最新 prompt

#### 架構
- **生產 LLM agent**：`~/.openclaw/agents/external-user/`
- **sandbox**：`/home/clawuser/.openclaw/workspace-external-user/`
- **本倉庫 source**：`docs/production-prompt/2026-06-28/`（透過 `latest` symlink）

#### 同步流向

| 方向 | 機制 | 腳本 |
|------|------|------|
| Sandbox → LLM agent | symlink（已完成） | 已設定 `~/.openclaw/agents/external-user/knowledge` → sandbox knowledge |
| 本倉庫 → Sandbox | 手動 rsync | 由 `scripts/sync-mirror.sh to-legacy` 負責（含 prompt KB） |
| 反向（prompt 變更） | §6.6 下方流程 | 3 步驟 |

#### Prompt 變更 SOP

1. **修改 source**：
   - 改 `docs/production-prompt/2026-06-28/main_idea.md`（當前 latest 版本）
   - 或新建版本 `docs/production-prompt/YYYY-MM-DD/` 並切換 `latest` symlink

2. **驗證**：
   ```bash
   bash scripts/check-quality.sh   # Check 8 / 8 verify-kb-sources（X1-D 補）
   ```

3. **同步到 sandbox**（待寫腳本，未來 X 系列）：
   - 手動：`rsync -av docs/production-prompt/latest/main_idea.md ~/.openclaw/workspace-external-user/knowledge/`
   - 驗證 sandbox：`cat ~/.openclaw/workspace-external-user/knowledge/main_idea.md | head -5` 對齊 source

4. **同步 LLM agent**（透過 symlink 自動）：
   - LLM agent 讀 `~/.openclaw/agents/external-user/knowledge/main_idea.md`
   - 若是 symlink 到 sandbox，sandbox 同步完即生效
   - 若不是 symlink，手動：`cp sandbox/knowledge/main_idea.md ~/.openclaw/agents/external-user/knowledge/`

5. **更新 CHANGELOG + SUMMARY.md**：
   - `CHANGELOG.md` 加版本條目
   - `docs/production-prompt/SUMMARY.md` 變更歷史段加一行

6. **Commit**：
   - `git add -A` + commit + push

#### 注意事項

- ⚠️ **沙箱 production prompt 與 src/ 邏輯需同步**：若 main_idea.md 改了處理流程，src/ 也要改對應邏輯，並寫 unit test 守住
- ⚠️ **不直接改 sandbox**：所有 prompt 變更走本倉庫，sandbox 只是鏡像
- ⚠️ **LLM agent 重啟**：若修改了 SOUL.md，可能需要重啟 agent

---

### 6.5 修 lint 違規

```bash
# 1. 跑 lint 看違規
npm run lint

# 2. auto-fix 可修的（trailing comma、shorthand、eol-last 等）
npm run lint:fix

# 3. 手動修剩下的 error（warning 不需處理）

# 4. 驗證
npm run lint
```

### 6.7 api-server background 啟動（SOP，Session X5-C 新增）

> **背景**：api-server 不能用 `openclaw exec` 保持 background（exec 結束會 kill child）
> **需求**：偶爾需要 api-server 長期跑（如 X5-C 的健康檢查 ping）
> **狀態**：Ticket demand-based（自動由 watchdog / user 手動）

#### 如何 background 啟動 api-server

```bash
# 1. SSH 到主位置
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# 2. nohup + setsid + disown：3 重防護避免 exec 結束殺掉 child
nohup setsid env PORT=3001 \
  LOG_DIR=$HOME/.openclaw/api-server-logs \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 < /dev/null &
disown

# 3. 驗證 alive
sleep 2
curl -s http://localhost:3001/healthz | head -5
```

#### 化為可重複 SOP（未來可變成 systemd / cron）

**當前做法**：`scripts/dashboard-watchdog.sh` + openclaw cron job `36d2ca19` 雞味客服 dashboard watchdog（每 10 分鐘自動重啟 dashboard）。api-server 暫無 background SOP，使用 `setsid nohup` 手動啟動（見下方範例）。

未來選項：
- **systemd service**（推薦） — 重啟策略、logging 整合
- **tmux session** — 適合 manual / dev
- **PM2** — multi-process management
- **openclaw cron agentTurn** — Session X5 已建立雞味客服 dashboard watchdog 模式，可複製套用至 api-server

#### 驗證 Production healthz

```bash
# dashboard 的 /healthz 会 ping api-server
curl http://localhost:3000/healthz
```

参考：scripts/api-server.js 有 graceful shutdown 信號處理（SIGTERM/SIGINT）。

---

## 七、品質檢查（自動化）

### 7.1 pre-commit 自動檢查

`scripts/check-quality.sh` 會跑：

| # | 檢查 | 失敗處理 |
|---|------|---------|
| 1 | `npm test` 全綠 | 阻擋 commit |
| 2 | 0 個 hardcode（vs chicken.yaml）| 警告（不阻擋）|
| 3 | 0 個 dead config（已存在但 src 未讀）| 警告 |
| 4 | 6/13 + 6/16 真實訂單仍在 | 阻擋 commit |
| 5 | 兩位置 rsync 一致 | 警告 |
| 6 | git working tree 乾淨（commit 前）| 警告 |

### 7.2 CI/CD（GitHub Actions）

`.github/workflows/test.yml` 在 push / pull_request 自動跑：

1. checkout
2. setup Node.js 22（從 `.nvmrc` 讀）
3. cache npm
4. `npm ci` 安裝依賴
5. `npm run lint`（ESLint，0 errors 必須）
6. `npm test`（19 套測試必須全綠）

**待 CEO 動作**：去 GitHub repo Settings → Actions → Enable 才會生效。

### 7.2 Session 結束時檢查

- 跑 `scripts/check-quality.sh` 確認全綠
- 完整 audit：`git log --stat` 看 commit 範圍
- 統一 push + rsync
- 更新 `.task-state/chicken-cleanup/steps.md`

---

## 八、常見任務

### 加新的驗證規則（如「電子郵件驗證」）

1. 新增 `src/rules/emailRule.js`（參考 `phoneRule.js` 風格）
2. 在 `src/rules/index.js` 的 `validateAll` 加呼叫
3. 新增 `tests/email-rule.test.js`
4. 更新 `REVIEW_GUIDE.md` 測試清單
5. commit + push

### 加新的狀態（如「待補款」）

1. 在 `src/states/stateMachine.js` 加 `STATES.AWAITING_TOPUP`
2. 新增 `src/states/awaitingTopup.js`
3. 在 `src/index.js` switch 加 case
4. 在 `config/tenants/chicken.yaml` 的 `security.status_flow.order_status` 加
5. 更新 CSV schema 與 `csvWriter.js` CSV_HEADERS（如需新欄位）
6. 加測試
7. commit + push

### 修 hotfix（緊急 production bug）

1. 修 src/ + 修對應測試
2. `npm test` 全綠
3. `git commit` + `git push`
4. `bash scripts/sync-mirror.sh from-legacy`（立即同步到 production）
5. 在 Hubert 通知修復完成

---

## 九、測試現況（19 套）

```
tests/rules.test.js                    ← rules/* 整合測試
tests/states.test.js                   ← 狀態機轉換
tests/handoff.test.js                  ← 轉真人邏輯
tests/security.test.js                 ← 輸入消毒
tests/date.test.js                     ← 日期驗證
tests/config.test.js                   ← config 介面
tests/whitelist.test.js                ← 白名單 middleware
tests/integration.test.js              ← Cloudflare Worker 攔截邏輯
tests/address-handoff.test.js          ← P0-1: addressRule handoff 觸發
tests/handoff-customer-reply.test.js   ← P0-2: handoff 讀 config
tests/state-trimmed-value.test.js      ← P0-3: state 保留 trimmed 值
tests/parse-items-dedup.test.js        ← P1-3: menuRule 去重
tests/address-dynamic-keywords.test.js ← P1-2: addressRule 動態讀 loader
tests/community-field.test.js          ← P1-6: community 欄位
tests/dashboard-server-yaml-fallback.test.js ← P1-8: dashboard fallback
tests/config-interface-adoption.test.js ← P2-5: notifier 改用 config 介面
tests/helpers/cleanup.test.js          ← Session D D1: 測試清理 helper
tests/csv-writer-concurrency.test.js   ← Session D D2: CSV race condition
```

---

## 十、文件地圖（按角色）

### 接手者必讀（30 分鐘）

1. **本檔（ENGINEERING_HANDBOOK.md）** — 30 分鐘 overview
2. [SPEC.md](../SPEC.md) — Phase 1 完整規格
3. [MIGRATION_HISTORY.md](../MIGRATION_HISTORY.md) — 雙位置架構說明

### 開發者必讀

4. [SOP.md](./.archive/SOP.md) — 標準作業流程（已歸檔）
5. [REVIEW_GUIDE.md](../REVIEW_GUIDE.md) — 19 套測試審查指南
6. [MULTI_TENANT_DESIGN.md](./MULTI_TENANT_DESIGN.md) — 多租戶規模化設計
7. [docs/adr/](./adr/) — 5 個關鍵架構決策

### 維運者必讀

8. [PHASE1_PROGRESS.md](./.archive/PHASE1_PROGRESS.md) — Phase 1 進度（已歸檔）
9. [TODO_2026-06-26.md](./.archive/TODO_2026-06-26.md) — 6/26 audit 報告（已歸檔）
10. [CLEANUP_PHASE_2_PLAN.md](./.archive/CLEANUP_PHASE_2_PLAN.md) — 多 sessions 修整計畫（已歸檔）

### 架構決策記錄（ADR）

| # | 主題 | 為何重要 |
|---|------|---------|
| 0001 | src/ 不是 production runtime | 接手者最容易搞錯 |
| 0002 | 雙位置架構（原 + 主）| 看似 bug 是設計 |
| 0003 | config.yaml 是 legacy fallback | single source of truth 是 chicken.yaml |
| 0004 | MEMORY.md 用 L1/L2/L3 三層結構 | 控制 LLM context load |
| 0005 | Session-based 變更 + 每 Task 一 commit | 避免「一環遞迴」 |

---

## 十一、給未來接手者的 checklist

接手這個專案時，跑一次這 13 個檢查：

- [ ] 讀完本 Handbook（30 分鐘）
- [ ] 跑 `npm test` 確認 19 套全綠
- [ ] 跑 `bash scripts/check-quality.sh` 看結果
- [ ] 看 [docs/adr/](./adr/) 5 個架構決策
- [ ] 看 [CLEANUP_PHASE_2_PLAN.md](./.archive/CLEANUP_PHASE_2_PLAN.md) 了解待修整項目
- [ ] 確認 `.env`（主位置）有真實 LINE Bot Token
- [ ] 確認 `data/orders/chicken/` 有 2026-06-13.csv 與 2026-06-16.csv 真實訂單
- [ ] 確認 git remote 是 `kaden1122123/chicken-group-buying-cs`
- [ ] 確認 `scripts/sync-mirror.sh` 正常運作
- [ ] 確認 production runtime（OpenClaw agent）有對應 prompt

完成後你應該能：
- 在 30 分鐘內 understand 系統全貌
- 在 1 小時內改一個小 bug
- 在 1 天內加一個新功能

---

## 十二、品質保證（如何驗證改動不破壞系統）

### 自動化檢查

```bash
bash scripts/check-quality.sh
```

檢查 6 項：
1. `npm test` 全綠
2. 0 個 hardcode（與 chicken.yaml 不一致）
3. 0 個 dead config flag
4. 6/13 + 6/16 真實訂單仍在
5. 兩位置 rsync 一致
6. git working tree 狀態

### CEO / PM 視角

- 看 `docs/KNOWN_ISSUES.md` 知道現有哪些問題待修（每個問題都有「影響」描述）
- 看 `docs/CEO_DECISION_GUIDE.md` 知道每個待修整 session 的業務影響（功能性描述，不列函數）

### Session 結束時必跑

- 跑 `bash scripts/check-quality.sh`
- 完整 audit：`git log --stat`
- 統一 push + rsync
- 更新 `.task-state/chicken-cleanup/steps.md`

---

_本檔由 brtclaw 維護，協作方法論的核心入口_
