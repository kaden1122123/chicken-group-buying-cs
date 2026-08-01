<!-- ⚠️ LEGACY — 內容已併入 NEW_SESSION_README.md（Round 34）

本檔是 2026-08-01 12:39 建立的「架構現況 + 新 Session 計畫」文件。
但 Round 34 整理後，內容已併入根目錄的：

  → NEW_SESSION_README.md §2 系統地圖 + §5 已知問題

新 session 接手時**請直接讀 NEW_SESSION_README.md**，不要讀本檔。
本檔保留的目的是：（1）git 歷史回查。

以下為原始內容（保留供 audit）：

-->
# 雞味客服 LINE Bot — 架構現況 + 新 Session 計畫

> **建立時間**：2026-08-01 12:39 GMT+8
> **作者**：brtclaw（Hubert 指示另開 session 整理架構，這份是給新 session 的接手文件）
> **目的**：當前完整架構快照 + 所有已知未關 bug + 整理方向
> **狀態**：Hubert 表示「還是怪怪的」，Round 33 sanitizeReplyText 沒修好根本問題；新 session 先整理架構，再 debug 併發 bug

---

## 1. 為何需要「架構整理」這個 session

Hubert 12:39 GMT+8 訊息：「**還有很多併發的 bug 我打算另開session 先整理整個目錄架構，理完架構後再開始debug**」。

問題清單：
- 兩個 chicken.yaml 路徑（LEGACY vs PRODUCTION）需要手動 sync（已加 cron 但只是 chicken.yaml 單檔）
- production prompt（main_idea.md）有 drift warning（runtime vs source）
- OpenClaw agents/external-user/ 有 18 個 .bak 檔案（6 versions × 3 files）堆積
- sessions/ 有 16384 個 entries，可能含舊的污染 context
- HANDOFF.md / SESSION_NEXT_PROMPT.md 已 stale（2026-07-25 / 2026-07-29）
- 「客服邏輯錯亂」可能源自 Round 32-33 期間 chat log 污染（sanitize 只能防未來）

---

## 2. 完整架構快照（2026-08-01 12:39）

### 2.1 資料流（LINE → Worker → OpenClaw → Chicken）

```
[客戶 LINE]
   ↓ webhook POST
[Cloudflare Worker]
   ↓ POST /line/534zsteg
[OpenClaw Gateway :18789]
   ↓ process via LLM + chicken repo state machine
[Chicken repo :3334 / port inside openclaw process]
   ↓ state machine + KB match + handoff
[chicken repo reply → OpenClaw → Worker → LINE]
```

**問題點**：
- 「客服邏輯錯亂」可能在這條鏈任一環節
- sanitizeReplyText 只能管 chicken repo 的 outbound
- OpenClaw pipeline 端若有作業訊息漏出，chicken repo 接不到也擋不了

### 2.2 檔案路徑全景

#### Chicken repo 路徑

| 用途 | 路徑 | 備註 |
|------|------|------|
| **Source（LEGACY）** | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | Hubert 編輯位置，git tracked |
| **Production（PRIMARY）** | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | OpenClaw 實際讀取位置 |

#### 兩個 chicken.yaml 現況（md5 已 sync）

```
0178d4a8430abbc10c368ddc0dd1d2e0  config/tenants/chicken.yaml（LEGACY）
0178d4a8430abbc10c368ddc0dd1d2e0  config/tenants/chicken.yaml（PRIMARY）
✓ md5 一致（cron sync-producer-config.sh 每分鐘跑）
```

#### 兩個 prompt 檔案

| 用途 | 路徑 |
|------|------|
| Source prompt | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/docs/production-prompt/2026-07-03/main_idea.md` |
| Runtime prompt | `/home/clawuser/.openclaw/agents/external-user/main_idea.md` |
| check-quality | ⚠ production runtime canonical vs docs/production-prompt/2026-07-03 drift |

#### Worker repo

| 用途 | 路徑 |
|------|------|
| Source | `/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/` |
| Latest deploy | `b23dd720-dbed-4974-bfb6-b1c3bd86e213` |
| Bindings | RATE_LIMIT_KV + 8 env vars（已無 [ai] binding） |

#### OpenClaw Agents

| 用途 | 路徑 |
|------|------|
| Agent config | `/home/clawuser/.openclaw/agents/external-user/` |
| 內含 | `AGENTS.md` `SOUL.md` `main_idea.md` `knowledge/` `memory/` `sessions/` `agent/` `USER.md` |

### 2.3 Chicken repo src/ 結構

```
src/
├── config.js                # chicken.yaml loader（lazy reload，無需重啟）
├── index.js                 # webhook entry
├── knowledge/
│   ├── loader.js           # KB load from knowledge/tenants/chicken/*.md
│   └── triggers.js
├── middleware/
│   └── whitelist.js
├── order/
│   ├── csvReader.js
│   ├── csvWriter.js
│   ├── orderFormatter.js   # formatOrderSummary 客戶訂單摘要
│   └── orderIdGenerator.js
├── rules/
│   ├── addressRule.js
│   ├── dateRule.js          # getUpcomingOpenDates + validateDate
│   ├── menuRule.js         # parseItems + findAmbiguousCandidates + validateMenu
│   ├── paymentRule.js
│   ├── phoneRule.js
│   ├── priceRule.js
│   ├── timeSlotRule.js
│   └── index.js
├── states/
│   ├── stateMachine.js
│   ├── idle.js
│   ├── awaitingInfo.js     # 處理 ambiguous menu 等
│   ├── awaitingPayment.js
│   ├── confirming.js
│   ├── completed.js
│   └── handoff.js
├── storage/
│   └── sheetsSync.js
├── utils/
│   ├── lineReply.js        # textReply + flexReply + sanitizeReplyText
│   ├── lineProfileCache.js
│   ├── logger.js           # warn/error → process.stderr
│   ├── sanitizer.js
│   ├── timeUtils.js
│   └── timezone.js
└── handoff/
    ├── notifier.js         # notifyHubert + sendEmailWithThrottle
    ├── emailNotifier.js    # Gmail API 整合
    ├── autoOrder.js        # B 方案 auto-create-order
    ├── notificationFormat.js
    ├── receiptAnalyzer.js
    └── transferRules.js
```

### 2.4 OpenClaw Cron Jobs（雞味客服相關）

| Cron Name | Schedule | Status | Owner |
|-----------|----------|--------|-------|
| 雞味客服 main enforce readonly | every 10m | ✅ ok | chicken |
| 雞味客服 cloudflared leaked cleanup | `0 */1 * * *` | ✅ ok | chicken |
| 雞味客服日報彙總（測試中）| `30 23 * * *` | ✅ ok | chicken |
| 雞味客服週報彙總（測試中）| `0 10 * * 0` | ✅ ok | chicken |
| 雞味客服每日 backup | `0 2 * * *` | ✅ ok | chicken |
| 雞味客服 P9 Sheets 同步（測試中）| `0 3 * * *` | ✅ ok | chicken |
| 雞味客服 GCP service account key age check | `0 9 1 * *` | ✅ ok | chicken |
| 雞味客服 L2 .bak cleanup | `0 2 26 7 *` | ✅ ok | chicken |

### 2.5 Ports 現況

| Port | Service | PID |
|------|---------|-----|
| 18789 | OpenClaw Gateway | 506897 |
| 3334 | chicken API（gateway 內部）| 506897 |
| 3000/3001 | dashboard/api-server | 408057/408238 |

### 2.6 docs/ 結構（27 個檔案）

```
docs/
├── adr/                        # Architecture Decision Records
├── architecture/               # Round 22 前有的架構文件
├── handoff/
│   ├── rounds/                 # ROUND_15-33 handoff docs（9 個）
│   ├── sessions/               # SESSION_NEXT_PROMPT.md + README.md
│   └── ARCHITECTURE_CURRENT_STATE_2026-08-01.md（本檔）
├── production-prompt/
│   ├── 2026-06-26/
│   ├── 2026-06-28/
│   ├── 2026-07-03/             # current canonical
│   ├── latest → 2026-07-03
│   └── SUMMARY.md
├── INDEX.md
├── HANDOFF.md                  # ⚠ stale 2026-07-25
├── CEO_DECISION_GUIDE.md
├── DEVELOPMENT.md
├── ENGINEERING_HANDBOOK.md
├── OPERATIONS.md
├── KNOWN_ISSUES.md
├── PROJECT_INVENTORY.md
└── ...（其餘 ~15 個 SOP 文件）
```

### 2.7 knowledge/tenants/chicken/ 結構（13 個檔案）

```
knowledge/tenants/chicken/
├── INDEX.md
├── 01_product.md          # 雞/鴨/鵝品項定義（供 disambiguation 用）
├── 02_order_flow.md
├── 03_payment.md
├── 04_delivery.md
├── 05_promotion.md
├── 06_faq.md
├── 07_transfer_rules.md
├── 08_owner_info.md
├── 09_order_standard.md
├── 10_customer_tags.md
├── 11_lead_followup.md
└── 12_reply_examples.md
```

---

## 3. 所有已知未關 bug 與議題（Round 32-33 + 「還是怪怪的」）

### 3.1 客戶「客服邏輯錯亂」（最高優先 — 客戶體驗問題）

**症狀**：Hubert 11:55 報告「自從這則訊息後，客服就怪怪的了」，12:39 仍回報「還是怪怪的」。

**推測 root cause**（SanitizeReplyText 沒修好）：
- A. OpenClaw pipeline 端的 LLM context 被 Round 32-33 期間的污染訊息破壞（chicken repo 的 sanitize 防不到 OpenClaw 端）
- B. OpenClaw session 本身累積了 broken state（需要 rebuild session）
- C. chat log 中有 `Exec failed: ....` 訊息被 LLM 「看到」後誤解（即使 outbound 已 sanitize，inbound LLM context 仍含）
- D. LLM 自身的回覆邏輯有 bug（非作業訊息問題）

**調查方向**：
1. 翻 OpenClaw pipeline source 找 `Exec failed` 訊息源頭
2. 從 OpenClaw session 重建客戶 context（清掉污染）
3. 查 OpenClaw session DB / SQLite 看實際 chat log

### 3.2 Round 33 仍待驗證的修法

| 修法 | 狀態 | 待驗證 |
|------|------|--------|
| Bug 1（LINE → Gmail）| notifier.js + autoOrder.js 已改 | 等下次測試用戶通知確認只走 Gmail |
| Bug 2（兩週開團日）| dateRule.js + main_idea.md 已改 | 等客戶實際問開團日時 LLM 主動列出 |
| Bug 3（sanitize outbound）| lineReply.js sanitizeReplyText 已加 | 客戶「還是怪怪的」證明 sanitize 不夠，要追污染源 |

### 3.3 Round 32 仍待驗證

- 架構統一（LEGACY 為 source of truth + cron sync）是否穩定跑（觀察 `/tmp/chicken-config-sync.log`）

### 3.4 雙 chicken.yaml 同步相關議題

- LEGACY vs PRIMARY 兩份檔案，目前用 cron sync chicken.yaml。但若有人改 PRIMARY，sync 會把 LEGACY 蓋掉（逆向覆寫風險）
- 建議新 session 評估：是否改成單向 sync + PRIMARY 為 read-only

### 3.5 Production Prompt Drift

- check-quality Check 11 一直在警告 production runtime canonical vs docs/production-prompt/2026-07-03 drift
- 修法未實作（chat log 已污染）

### 3.6 docs/ stale 議題

- `HANDOFF.md` last_updated 2026-07-25
- `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` last_updated 2026-07-29
- `docs/INDEX.md` 檔案清單可能 stale
- 這些都是雞味客服開始新 session 的入口，stale 會讓接手混亂

### 3.7 OpenClaw agents/external-user/ 雜亂

```
AGENTS.md.bak.20260719-034307
AGENTS.md.bak.20260719-034656
AGENTS.md.bak.20260720-224319
AGENTS.md.bak.20260723-025017
AGENTS.md.bak.20260723-025414
AGENTS.md.bak.20260723-044212   (6 versions)
SOUL.md.bak.*                     (6 versions)
main_idea.md.bak.*                (6 versions)
```

共 18 個 .bak 檔案堆積。Round 26 的 cleanup-baks.sh 可能沒正常跑。

### 3.8 sessions/ 累積

`/home/clawuser/.openclaw/agents/external-user/sessions/` 有 16384 entries。可能是 OpenClaw session DB 累積，需要 prune 或 migrate。

### 3.9 worker repo 議題

- worker 沒有 git remote（push 會失敗，Hubert 手動 pull + 部署）
- tests/ 4 個檔案（75 tests）
- Round 31 完成 4 個 hotfixes 後沒新功能

### 3.10 雞味客服其他專案

- `data/orders/chicken/` 有 6 個 CSV（PROTECTED 6/13 + 6/16 + 其他測試訂單）
- P9 Sheets 同步（cron 跑測試中）
- dashboard-admin endpoint 可線上改 chicken.yaml（已有 `updateTenantConfig` 函式）

---

## 4. 架構整理建議方向（新 session 參考）

### 4.1 第一優先：客戶「客服邏輯錯亂」（核心症狀）

**建議方向**：
- 翻 OpenClaw source 找 `Exec failed` 訊息源頭
- 從 OpenClaw session 重建客戶 context
- 檢視 chat log 找實際污染訊息

### 4.2 第二優先：清理堆積檔案

**建議方向**：
- 刪除 `agents/external-user/*.bak` 18 個檔案
- Prune `sessions/` 累積資料
- 跑 `scripts/cleanup-baks.sh` 確認 cron 正常

### 4.3 第三優先：更新 stale docs

**建議方向**：
- 重寫 `HANDOFF.md` 反映 Round 32-33 + 架構現況
- 重跑 `scripts/generate-next-prompt.sh` 更新 `SESSION_NEXT_PROMPT.md`
- 更新 `INDEX.md` 套數與檔案清單

### 4.4 第四優先：雙路徑 chicken.yaml 整理

**建議方向**：
- 評估是否要將 LEGACY 與 PRIMARY 完全分離（git vs runtime）
- 強化 cron sync 邏輯（避免雙向覆寫）
- 考慮用 symlink 取代 rsync（單一 source of truth）

### 4.5 第五優先：Production Prompt Drift

**建議方向**：
- 加 cron 自動 sync docs/production-prompt/{latest} → ~/.openclaw/agents/external-user/main_idea.md
- 或在 OpenClaw pipeline 加 hot-reload

---

## 5. 立即可執行（給新 session 開工用）

```bash
# 1. 確認當前狀態
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh
git log --oneline -5
git status

# 2. 看 OpenClaw session 找污染源
ls /home/clawuser/.openclaw/agents/external-user/sessions/ | head -5

# 3. 看 sync log 確認 cron 正常
tail -30 /tmp/chicken-config-sync.log

# 4. 看 stale docs
ls -la HANDOFF.md docs/INDEX.md docs/handoff/sessions/SESSION_NEXT_PROMPT.md

# 5. 清理 .bak 堆積
ls /home/clawuser/.openclaw/agents/external-user/*.bak.*
```

---

## 6. Round 32-33 完整變更清單（給新 session 知道哪些已修過）

### Round 32（commit ba9654d，2026-08-01 10:30）

1. Bug 2a（dateRule.js）：過濾 `>= today` 再取前 3 個開團日
2. Bug 2c（menuRule.js + awaitingInfo.js）：parseItems 重構 + findAmbiguousCandidates + 客戶「煙燻 1」列出 5 候選
3. Bug 1（orderFormatter.js）：移除裝飾標頭
4. Bug 1+2d（main_idea.md §訂單確認）：移除 code block 模板
5. 架構統一（b 方案）：LEGACY 為 source of truth + sync-producer-config.sh + crontab 每分鐘

### Round 33（commit df33737，2026-08-01 12:30）

1. Bug 1（notifier.js + autoOrder.js）：測試用戶通知走 Gmail（channels:['email']）+ 5s throttle
2. Bug 2（dateRule.js + main_idea.md）：getUpcomingOpenDates({weeks=2}) + LLM prompt 主動提示兩週
3. Bug 3（lineReply.js）：sanitizeReplyText + 黑名單 pattern + 套用 textReply/flexReply

### Round 33 handoff + state files（commit c0dd8a4）

- ROUND_33_2026-08-01.md handoff doc
- HEARTBEAT.md 更新到 12:30
- active-tasks.md 更新 Round 33 狀態
- memory/2026-08-01-1155.md session summary
- ARCHITECTURE_CURRENT_STATE_2026-08-01.md（本檔）

---

## 7. 預期新 session 的工作流程

```
Day 1（架構整理）:
- [ ] 翻 OpenClaw source 找 Exec failed 源頭
- [ ] 從 OpenClaw session 重建客戶 context
- [ ] 清理 .bak 堆積（18 個）
- [ ] Prune sessions/ 累積
- [ ] 更新 HANDOFF.md + INDEX.md + SESSION_NEXT_PROMPT.md
- [ ] 重寫雙路徑 chicken.yaml sync 邏輯（避免雙向覆寫）

Day 2（debug 併發 bug）:
- [ ] 確認「客服邏輯錯亂」是否修好
- [ ] Round 33 3 個修法 production 驗證
- [ ] 雙 chicken.yaml 同步穩定性
- [ ] 客戶測試新對話是否正常
```

---

## References

- HEARTBEAT.md（2026-08-01 12:30 更新）
- active-tasks.md（2026-08-01 12:30 更新）
- ROUND_33_2026-08-01.md handoff doc
- memory/2026-08-01-1155.md session summary
- memory/2026-08-01.md daily note（Round 32）
- chicken repo commits: c0dd8a4 (docs), df33737 (Round 33), ba9654d (Round 32)
- worker repo commit: 148d7df (Post Round 31 Hotfix #4)

---

_本檔由 brtclaw 在 2026-08-01 12:39 應 Hubert 指示建立，給新 session 整理架構用_
