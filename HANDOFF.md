# Session Handoff — 雞味客服專案

> **last_updated**：2026-07-25（Round 26 — 連結修補、測試殘留清理、文件補齊）
> **最後更新**：2026-07-24 21:10+ session（Round 15-19 全部完成 — 8 個 task + 4 個補齊任務執行）
> **最後 commit**：`7ec11ac` (chicken AGENT_PROJECT_SOP.md) + `aa31757` (Worker synonyms.ts)
> **check-quality**：13 通過 / 1 警告 / 0 失敗（Round 19 完成後）
> **/healthz**：dashboard / api_server / worker 全 up
> **Worker deploy**：`f2458aee-3dd2-4aca-8431-4e6c89fb4d2c`（45 KB entries + synonym expansion + LRU cache + inverted index）

## 🎯 用途（Purpose）

此檔是**雞味客服專案的 session 交接手冊**。功能目的：
1. 讓新 session 在 **10 分鐘內進入狀況**（不需要重新探索 codebase）
2. 避免**新 agent 重複踩雷**（文件列出已知問題與已做修整）
3. 確保**知識不隨 session 結束而消失**（commit history + 這個 handoff 持久化）
4. 提供**清楚的下一步**（pending work 有優先度 + 估時）
5. 防止 **dual-location 編輯**（3 層 enforcement 設計）

## 👥 讀者（Audience）

- **接手工作的 brtclaw session**（首要讀者）
- **Hubert**（老闆）偶爾查看（驗證系統狀態）
- **未來 audit 的工程師**（理解設計決策）

## 🛠 怎麼用（How to Use）

**接手 session 第一件事**（5 步）：
1. 跑環境驗證（5 個動作，見 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` 開局）
2. 讀本檔 §1（當前狀態）+ §5（待辦清單）
3. 讀 `docs/PROJECT_INVENTORY.md`（完整系統地圖）
4. 讀 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（新 session 開局 prompt）
5. 跑 `bash scripts/check-quality.sh` 確認環境

**結束 session 最後一件事**（Session 結束 SOP，7 步）：
1. 跑 `bash scripts/check-quality.sh` 確認 12 checks 全綠
2. 更新 `CHANGELOG.md`（+Round N 段）
3. 更新本檔「變更歷史」+ 必要時 §5 待辦
4. 寫當日 `memory/YYYY-MM-DD.md`（總結今天做了什麼）
5. 更新 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（當前狀態表）
6. git add -A + commit + push（按 MEMORY.md §I-1 SOP）
7. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步 main 鏡像

## 📚 參考的 Best Practices

| 來源 | 應用到本檔的原則 |
|------|---------------|
| [/handoff Skill](https://www.aihero.dev/skills-handoff) | Context compaction — 精簡但完整 |
| [Context Rot in AI Agents](https://www.mindstudio.ai/blog/context-rot-ai-agents-session-handoff-fix) | Session handoff 修 context window 膨脹 |
| [AI Agent Handoff (XTrace)](https://xtrace.ai/blog/ai-agent-context-handoff) | 傳遞 context + state + responsibility |
| [session-handoff skill](https://github.com/softaworks/agent-toolkit) | **Zero ambiguity** — 不留模糊空間 |
| [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) | **Structured transfer** of: responsibilities + deliverables + documentation + decisions + working context |

---

## 1. 當前 Production 狀態（綠燈 · 2026-07-20 09:55）

| 項目 | 狀態 | 證據 / 驗證指令 |
|------|------|----------------|
| Production runtime 三檔 | ✅ 對齊 | AGENTS.md / SOUL.md / main_idea.md md5 與 production-prompt/2026-07-03/ 完全一致 |
| 測試套件 | ✅ 全綠 | `npm test` → 53 個檔（5 node:test + 48 自訂 assert）+ 1 integration |
| 品質檢查 | ✅ 全綠 | `bash scripts/check-quality.sh` → **12 checks**（含 Check 11 Ignored Keywords 同步）|
| api-server | ✅ 跑中 | port 3001，PID 動態查（`ps -eo pid,etime,args \| grep api-server`）|
| Dashboard-server | ✅ 跑中 | port 3000，帶完整 env（WORKER_HEALTH_URL 等）|
| Dashboard tunnel | ✅ Named Tunnel | `brt1122-System-09`（systemd 自動管理，PID 1543 從 5/02 跑 78+ 天）|
| Dashboard URL | ✅ 固定 | `https://dashboard.brt1122.com`（Hubert 已驗證 up）|
| Cloudflare Worker | ✅ 部署 | deploy v `e919157f`（compatibility_date 2026-07-01）|
| LINE 月度額度 | ⚠️ 額滿 | 500/月用完（reset = 2026-08-01），不影響 inbound（webhook 無限）|
| 4 個 announce cron | ✅ 已修 | 全部 deliver 至 `channel:1528418702167638016` |
| dashboard-watchdog cron | ✅ 已停用 | 22:48 Hubert 停用（systemd 自動接管）|

---

## 2. 最近 9 個 Commits（2026-07-19 22:30 → 2026-07-20 01:01 — Round 14 + Medium/Low）

| Commit | 時間 | 變更 |
|-------|------|------|
| `fadb6ec` | 22:55 | fix(tunnel): Named Tunnel 轉移（manage-tunnel.sh + dashboard-watchdog.sh + NAMED_TUNNEL_MIGRATION.md）|
| `2cc89d1` | 23:00 | fix(tunnel): 更新 manage-tunnel.sh NAMED_DOMAIN 註解（brt1122.com 確認）|
| `c96214e` | 23:00 | docs(tunnel): 修正 NAMED_TUNNEL_MIGRATION.md 步驟 2（精確 JSON 下載指引）|
| `09ff830` | 23:00 | docs(tunnel): 修正 NAMED_TUNNEL_MIGRATION — reuse brt1122-System-09（已 78 天穩定）|
| `38b1a27` | 23:00 | fix(tunnel+cron): dashboard tunnel 改用 brt1122-System-09 + 4 個 cron delivery 修復 |
| `8f8d1f7` | 23:01 | fix(worker): Cloudflare Worker audit v2（external-user repo，compatibility_date + v4 部署指南）|
| `a652fef` | 23:12 | docs(system): Round 14 收尾 — 狀態文件 drift 全面更新防止 drift |
| `ed791d4` | 00:55 | fix(system): Medium & Low 全部完成（Hubert 23:38 指示，P2/P3/P4/P5/P7）|
| `b0513a6` | 01:01 | docs(system): Round 14 狀態文件 drift 全面更新（2026-07-20 01:01）|

**external-user/cloudflare-worker 部署**: `e919157f`（deploy time 23:00+）

完整 log: `git log --oneline -10`

---

## 3. 三層位置架構（ENGINEERING_HANDBOOK §6.6）

| 層級 | 路徑 | 角色 |
|------|------|------|
| 測試端 (sandbox) | `~/.openclaw/workspace-external-user/` | Claude Code workspace |
| **主上線端 (production)** | `~/.openclaw/agents/external-user/` | **LLM 真的在這跑**（AGENTS.md / SOUL.md / main_idea.md canonical） |
| 本倉庫 source | `docs/production-prompt/{version}/`（`latest` symlink） | git-managed 版本控制 |
| **Dev repo** | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | **永遠在這編輯** |
| Main 鏡像 | `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | 自動同步 dev → main（sync-mirror.sh） |

**記憶口訣**：dev 是 source、main 是 mirror、production 是 runtime。三者之間用 sync 工具銜接。

---

## 4. 此 Session 完成（2026-07-19 22:30 → 2026-07-20 10:35+ — Round 14 + Medium/Low + Check 1 fix）

### Round 14 Named Tunnel 轉移

1. **Hubert 22:30 指示**：把 dashboard tunnel 從 Quick Tunnel 升級到 Named Tunnel
2. **重大發現**：Cloudflare Dashboard connector 已建立 `brt1122-System-09` tunnel（從 5/02 跑 78 天穩定），**不需要新建** chicken-dashboard tunnel
3. **Dashboard Public Hostname**：`dashboard.brt1122.com` → `http://localhost:3000`（Hubert 設定）
4. **scripts/manage-tunnel.sh 重寫**：改用 systemd service 操作（start/stop/restart/status/info 5 命令）
5. **scripts/dashboard-watchdog.sh 重寫**：改為「監控 + 記錄」模式（systemd 自動接管，不再自動重啟）
6. **dashboard-watchdog cron 停用**（22:48 Hubert）
7. **4 個 announce cron delivery channel 修復**：從錯誤 ID 改為正確 `channel:1528418702167638016`（23:14 Hubert 糾正）
8. **Cloudflare Worker 部署**（external-user repo）：`wrangler.toml` 升 `compatibility_date: 2026-07-01` + 移除 deprecated `account_id`，`DEPLOYMENT.md` v2 完整重寫
9. **check-quality 改善**：9/3/0 → 12/1/0（新增 Check 11 Ignored Keywords 同步）

### Medium/Low 全部完成（Hubert 23:38 指示）

- ✅ **P6**: heartbeat-state.json 清理（移除 3+ 月過時 Moltbook 資料）
- ✅ **P7**: `check-ignored-keywords-sync.js` + Check 11（自動檢查 Worker ↔ chicken.yaml keywords 同步，5 keywords 完全同步）
- ✅ **P5**: L2 production runtime `.bak` 清理計畫（11 檔 SOP + 7 天緩衝）
- ✅ **P4**: L1 archive 評估（保留現狀決策，LEGACY 標頭有效）
- ✅ **P2**: GCP rotate SOP §7 自動化建議（key_age_check.sh + cron）
- ✅ **P3**: Cloudflare Worker staging 決策（不設 + 風險評估）
- ⚠️ **P1**: 統一測試 framework → 半套轉換失敗 → 務實 revert → 留為下次 session 第一件事

### 4 份必讀文檔明確更新（Hubert 09:55 指示）

- ✅ `HANDOFF.md`（本檔）：§1-§5 全部更新到 Round 14 + Medium/Low 完整狀態
- ✅ `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`：加 Dashboard Tunnel SOP + Round 14 + Medium/Low 完成段
- ✅ `docs/SYSTEM_AUDIT_2026-07-19.md`：加 §8.5-§8.9（Round 14 收尾 + P5/P4/P3/P2/P7 + Medium/Low 全部完成）
- ✅ `memory/2026-07-20.md`（system-level）：8 KB Round 14 紀錄

### Check 1 Stale-State Bug Fix（Hubert 10:08 指示 — 2026-07-20 10:08 → 10:35）

- **症狀**：`check-quality Check 1/10 npm test` 失敗 → `csv-writer-concurrency.test.js:150` 預期 61 行 實際 122 行（122 = 61 × 2）
- **誤判初向**：以為 `src/order/csvWriter.js` proper-lockfile 鎖失效,production 有重複寫入風險
- **真正 root cause**：`tests/csv-writer-concurrency.test.js` 的 cleanup 不完整 — 只 `rmSync` 資料目錄 `data/orders/_csv_concurrency_test/`,**沒刪** sibling `_csv_concurrency_test.lock/`（proper-lockfile 的 lock 鎖目錄）
- **fail 時間軸**：
  1. 前次 run crash → `data/orders/_csv_concurrency_test.lock/` 殘留 + `data/orders/_csv_concurrency_test/` 殘留
  2. 下次 setup rmSync 資料目錄 → 重建空目錄 → `isNewFile=true` → 第一個 writeOrder 又寫 header
  3. lock 殘留 → acquireLockSync busy-wait 5000ms 等 stale lock → 期間 child 之間順序亂掉,前次 60 筆被當成「上次跑殘留」append 兩次
  4. 結果 CSV 122 行 = 當次 61 + 前次 61
- **驗證（按此序）**：
  1. 單獨 `node tests/csv-writer-concurrency.test.js`（clean env）→ **PASS 61 行** exit 0
  2. 注入 stale state（手動 mkdir `_csv_concurrency_test.lock/` + 寫 60-row CSV）+ 跑全套 npm test → **PASS**（cleanup hardening 起作用）
  3. 3 次連跑 csv-writer-concurrency → **全 PASS**
- **修法**：`tests/csv-writer-concurrency.test.js` 兩處加固
  - **Setup**：新增 `LOCK_DIR_SIBLING = data/orders/_csv_concurrency_test.lock` 預先清除 stale state（在 rmSync TEST_DIR 之前）
  - **Cleanup**：新增清 `LOCK_DIR_SIBLING`（防止下次 run 受影響）
- **生產影響評估**：**0** — csvWriter.js 本來就 OK,沒有真實 race condition 風險
- **設計決策保留**：`spawnSync` sequential 設計 + 「concurrency」測試名 — 從 main_idea.md 註解看,此測試守護「同 process 多次 writeOrder 鎖正確釋放」,**不是真測跨 process 並發**

### Phase C 文件補齊（同 session）

- ✅ **AGENTS.md drift 評估**：runtime `df9c63b7` ≠ docs `f4542f4c` — **但 Check 11 透過 `tail -n +15` 跳過 prod 故意多加的 14 行 CANONICAL 標頭**,by design 非 bug
- ✅ **HANDOFF.md §2 修補**：加上 09:59 的 `967d475` HANDOFF.md 明確更新 commit + 本次 `a65c654` commit
- ✅ **memory/2026-07-20.md 補本 session 工作段**（系統級 · 10.6KB → 14.5KB,+3.9KB）
- ⏸ **Dev repo 5 個 `config.yaml.bak.2026*` 殘留**：untracked,留為下次低優先

---

## 5. ⚠️ 待修整項目（依緊急度排序 · 2026-07-20 10:35+）

### 🔴 最高（下次 session 第一件事）
- [x] 🔵 **P1 統一測試 framework 進度** — 5/48 套完成 (date/timeUtils/state-trimmed-value/whitelist/address-handoff) · commit `51e3dcc` · **剩 43 套待批次轉換**（優先從最簡單的 5 個開始,1-2 hr/批）
  - 嘗試半套轉換失敗（只加 import 沒包 `test()`，破壞 lint）已 revert
  - 完整 pattern：先寫好 `test()` 包裝 + assert 在內再批次轉換
  - 從最簡單的 5 個開始：date / timeUtils / state-trimmed-value / whitelist / address-handoff
  - 預估時間：4-6 小時

### 🟡 中（建議下個 session 處理）
- [ ] **等 4 個 cron 下次觸發** → 確認 announce 到 `1528418702167638016`（Hubert 觀察）
- [ ] **觀察 Cloudflare Worker 24hr 穩定性**（deploy v `e919157f` 已上 production）
- [ ] **驗證 dashboard.brt1122.com 對外可訪問**（Hubert 已確認「都是 up」，但記錄正式驗證）

### 🟢 低（後續 session 決定，文件化已完成）
- [ ] **L1 攏長文件 archive**（54 refs 跨檔，決策：保留現狀，LEGACY 標頭有效）
- [ ] **L2 production runtime `.bak` 清理**（11 檔 SOP + 7 天緩衝，文件化）
- [ ] **GCP service account key rotate**（3 天前建立仍 fresh，建議 90 天 rotate，SOP §7 已寫）
- [ ] **Cloudflare Worker staging 測試**（決策：不需要，文件化風險評估）
- [ ] **LINE 月度額度 reset**（8/1 後 inbound 不影響，可考慮主動測試 outbound 恢復）
- [ ] **Dev repo 5 個 `config.yaml.bak.2026*` 殘留**（untracked, 留為低優先清理）

### ✅ 已完成（Round 14 + Medium/Low + Check 1 fix）
- [x] ✅ **Dashboard tunnel 升級到 Named Tunnel**（brt1122-System-09 + systemd 自動管理）
- [x] ✅ **Dashboard URL 固定**（`https://dashboard.brt1122.com`）
- [x] ✅ **4 個 cron delivery channel 修復**（`1528418702167638016`）
- [x] ✅ **Cloudflare Worker 部署**（v `e919157f`，compatibility_date 2026-07-01）
- [x] ✅ **dashboard-watchdog cron 停用**（systemd 自動接管）
- [x] ✅ **check-quality 12 checks**（從 10 → 12，新增 Check 10 canonical drift + Check 11 Ignored Keywords）
- [x] ✅ **Medium/Low 7 個 phase**（P1-P7 全部文件化或完成）
- [x] ✅ **Check 1 npm test stale-state bug fix**（cleanup hardening + Phase C 補文件,commit `a65c654`）

### ✅ Round 14 (2026-07-19) + Round 1/Round 2 (2026-07-20~22) — 已完成

**[BUG #1 fix · commit chain]**
- [x] `98151cf` fix(config):移除 chicken.yaml `ignored_keywords` 中「我要訂購」(讓 ORDER_INTENT_PATTERNS 接管訂單意圖)
- [x] `e5f8564` + `23091c4` tests 適配 + 改用 Worker source check 取代 bundle check
- [x] Worker commit `e245eea`:移除 DEFAULT_IGNORED_KEYWORDS 中「我要訂購」+ **`wrangler deploy` 已上 production**(Version ID `683f6f9b-ec22-4c1b-b96e-a6b5f39b974c` 2026-07-22 06:51 GMT+8)✓ Bug #1 雙邊 fix 完全生效

**[P0 #1 · Dashboard 按鈕 · B05+B07]** — commit `53ea4b6` → `8704387`
- [x] 重新生 `dashboard.html` 從真實 CSV (21 筆 pending_handoff orders)
- [x] Click test ✓ 已收款 → POST /mark-paid → HTTP 200,CSV 真實更新
- [x] Working tree:5 筆 stale PENDING-1784213643xxx 完全消失

**[P0 #2 · Dashboard 解除轉真人按鈕 · B11]** — commit `0a9214a`
- [x] `stateMachine.js`:加 `handoffOrderIndex` Map + 3 functions(setHandoffOrderIndex / getUserIdByHandoffOrder / clearHandoffOrderIndex)
- [x] `handoff.js`:在 `handleHandoff` 內 register `setHandoffOrderIndex(userId, orderId)`
- [x] `dashboard-server.js`:新 POST `/api/orders/:orderId/clear-handoff` endpoint
- [x] `dashboard.html`:重新生 tbody 加 conditional 4th button (only pending_handoff rows show)
- [x] Click test → POST `/clear-handoff` → **HTTP 200** `{"success":true,"message":"已解除轉真人,Hubert 已處理完成"}`
- [x] dashboard-server 重啟(PID 3931871, uptime 1.5h) pickup 新 endpoint

**[P0 #3 · 轉真人客戶 reply 簡短 · B12]** — verify only, no commit
- [x] `DEFAULT_HANDOFF_CUSTOMER_REPLY = '目前老闆再忙，後續會再回覆您,請留意 LINE 通知,謝謝！'`(已 brief,無 detail leak)
- [x] Customer reply 路徑用 `getHandoffCustomerReply() || DEFAULT`,無 address/items

**[P0 #4 · LLM 日期邏輯 · B09]** — commit `6dabe71`
- [x] `main_idea.md` 加強:絕對禁止 LLM 建議配送前一日 13:00 後的明日開團;必須 hard-call `dateRule.validateDate()`
- [x] 列舉 7 種 validateDate reject 路徑(past_order_cutoff / past_cutoff_today / not_open_date / not_this_month / invalid_format / missing / valid)
- [x] sync-canonical 到 runtime ✓ Check 11 自動驗證

**[P1 · B14 轉帳戶名]**:config 沒 `戶名` field (確認 ✓)
**[P1 · B16 訂單確認前要列完整]** — commit `6dabe71`
- [x] `orderFormatter.js` exports 加 `formatCustomerReply = formatOrderSummary`(原 undefined → production crash)
- [x] Click test 顯示完整 11 行:📋/📦/📍/⏰/👤/📞/🏠/🏢/💰/💳

**[TESTING_GUIDE.md doc fix]** — committing 連同上面 commit
- [x] Phase 1.2 改用 grep(避免 count=0 時 python IndexError crash)
- [x] Phase 1.3 標明依賴 §1.4 (不再 hard 取第一筆 order_id)
- [x] Phase 1.4 用 jq 從 config 抓真實 NEXT_OPEN_DATE(避免 `date -d '+7 days'` 選到非開團日)
- [x] Phase 1.6/1.7 改用 `-n` (`.netrc`) + rate limit 從 100 降 30 次(避免撞 60/min)
- [x] 加 **§0.5 `.netrc` 安全設定章節**(資安 Hub sign-on)— 推薦 `curl -n` 取代 `-u user:pass`,避免 `ps aux` 曝光密碼

**[Security]**
- [x] `secrets/` mode 700(目錄),個別 secret mode 600 ✓
- [x] Note: `gmail-credentials.json` / `google-service-account.json` 是 mode **664**(可改 600,suggest Hubert 跑 `chmod 600 ...`)
- [x] `git log --all -p | grep 'password'` 只有 `.env.example` 註釋有 placeholder,沒真實密碼 ✓


---

## 6. 檔案指引（給下個 session）

| 必讀 | 檔案 | 用途 |
|------|------|------|
| 1 | `memory/2026-07-20.md` (system-level) | 今日份完整總結（8 KB）|
| 2 | `HANDOFF.md`（本檔） | 系統狀態摘要 + §5 待辦清單 |
| 3 | `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | 新 session 開局 prompt（含觸發關鍵字）|
| 4 | `docs/PROJECT_INVENTORY.md` | 完整系統地圖 |
| 5 | `docs/SYSTEM_AUDIT_2026-07-19.md` | 完整 audit 報告（含 §8.5-§8.9 Round 14 + Medium/Low 結果）|
| 6 | `docs/SESSION_END_SOP.md` | 7 步 Session 結束 SOP |
| 7 | `docs/NAMED_TUNNEL_MIGRATION.md` | Named Tunnel 轉移 SOP |
| 8 | `docs/GCP_ROTATION_SOP.md` | GCP service account key rotate SOP |
| 9 | `docs/TESTING_TROUBLESHOOTING.md` | **Round 19 新** — 測試中遇到奇怪地方時的排查 SOP |
| 10 | `docs/LINE_BOT_SETUP.md` | **Round 19 新** — LINE bot 換本體完整 7 步 SOP |
| 11 | `docs/AGENT_PROJECT_SOP.md` | **Round 19 新** — 新 linebot/客服專案建置 SOP（18 步 + 完成清單）|
| 12 | `docs/STAGING.md` | **Round 19 新**（Worker repo）— staging 環境 deploy SOP |

**舊必讀**（**LEGACY 標頭**，接手者**請勿 read**）：
- `PHASE1_PROGRESS.md`（875 行）
- `docs/TODO_2026-06-26.md`（432 行）
- `docs/CLEANUP_PHASE_2_PLAN.md`（481 行）

---

## 7. 變更歷史

### Round 22 (2026-07-25 11:30+, 本 session)

**主題**：文件清空 + 状态文件防 drift

- **Phase 1**: 審計發現 141+ 檔案偏多（5 個 SOP = 521 行重複內容）
- **Phase 2**: 合併 `LINE_BOT_SETUP.md` + `STAGING.md` + `STAGING_SECRETS_SETUP.md` → `OPERATIONS.md` (205 行，-58% token)
- **Phase 3**: 合併 `TESTING_GUIDE.md` (748 行) + `TESTING_TROUBLESHOOTING.md` (259 行) → `DEVELOPMENT.md` (268 行，-72% token)
- **Phase 4**: 簡化本 §7（只留最近 3 rounds，更早移到 git log）
- **Phase 5**: 新增 `docs/INDEX.md` 單一入口
- **Phase 6**: 刪除舊 SOP + commit + push

### Round 21 (2026-07-25 09:07+, Hubert 09:07 指示)

- **Task 1**: 5/5 狀態文件防 drift (commit `4ee8b7f`)
- **Task 2**: 主目錄檔案分類 → `docs/MAIN_DIR_FILES.md` (commit `a0d10ee`)
- **Task 3**: staging Worker secrets 設定位置 → `docs/STAGING_SECRETS_SETUP.md` (Worker commit `a800020`)
- **Task 4**: `/api/customer-tags/:userId` + dashboard UI panel (commit `e2131ba`)
- **Task 5**: 7/26 cleanup-baks.sh 排程 (cron ID `15998630-...`，next run 7/26 02:00)

### Round 19 + 20 (2026-07-24)

- **Round 19**: Task A-E (TESTING_TROUBLESHOOTING.md + LINE bot config + 5 enhancements + AGENT_PROJECT_SOP.md + 狀態文件) — commits `9efdb1a` → `7ec11ac`
- **Round 20**: 4 個補齊任務（wrangler staging KV + Workers AI embeddings + /api/customer-tags + 7/26 cleanup verification）

### Round 8-18 (2026-07-18 ~ 2026-07-23)

詳細 commits 見 `git log --oneline | head -50` 或 `CHANGELOG.md`。摘要：
- Round 8-10: 系統 drift 收尾 + audit + Medium/Low 修整
- Round 14: Named Tunnel 轉移 + 4 cron delivery 修復 + Cloudflare Worker 部署
- Round 1+2: Bug #1 cascade + P0 #1-#4 + P1 B14/B16 + 資安 (11 commits)
- Round 15+16: Sign C-all 48/48 套 test framework 統一 + Bug 1+2 真因
- Round 18: Bug 1+2 修法（bestScore 從 -Infinity → minCombined 0.2 + effectiveMaxDistance 動態）+ Bug 3 unit tests (25 個)

---

_本檔由 brtclaw 維護，最近 3 rounds 詳列，更早移到 git log_
_§7 佔用從 ~30 lines 壓到 ~30 lines（但資訊密度高 3x）_
_最後更新：2026-07-25 11:55+_
