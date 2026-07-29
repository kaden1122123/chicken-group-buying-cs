# Round 歷史（chicken-group-buying-customer-service）

> **建立時間**：2026-07-28（HEARTBEAT 瘦身 Round）
> **last_updated**：2026-07-29（Round 28 📐 補齊）
> **建立者**：brtclaw
> **目的**：從 git log + CHANGELOG.md 重新生成雞味客服 round close-out 摘要，存入 chicken repo（跟程式碼一起走 git history）

---

## ⚠️ Round 編號說明（重要）

**雞味客服 round 編號歷史上有 3 個來源，三方對照會有出入**：

| 來源 | 特性 | 用途 |
|------|------|------|
| `git log` commit 訊息 | Round 19+ 開始有明確編號（"Round 19 C2" 等） | **本目錄檔名的 source of truth** |
| `CHANGELOG.md` | 段標題明確但有 drift（標題寫 "Round 15-19" 內含 "Round 1+2", "Round 15+16", "Round 18", "Round 19"）| 內容摘要最詳細 |
| `~/.openclaw/workspace/HEARTBEAT.md` | 2026-07-23 03:10 後**沒更新** — Round 編號錯位（"Round 17" 內容其實是 Round 19） | 已不維護，僅歷史 |
| `~/.openclaw/workspace/.task-state/active-tasks.md` | 跟 HEARTBEAT 同步 drift | 已不維護 |

**建議**：

- 從 **2026-07-24** 起，CHANGELOG.md 與 commit 訊息的 round 編號是 source of truth
- HEARTBEAT.md 與 active-tasks.md 已 **drift**，不要當 source of truth
- 新寫 round 檔時，**直接從 `git log` 抓 commit 訊息的 round 編號 + commit 對應內容**

---

## 檔案清單

### Round 15+16 — 2026-07-22 → 07-23 04:30+

檔案：[`ROUND_15+16_2026-07-22.md`](./ROUND_15+16_2026-07-22.md)

**內容**（CHANGELOG.md 段：

- **Sign B Worker deploy** (`e55767c` + deploy v `683f6f9b`)：Bug #1 fix 雙邊生效
- **Sign C-all** (8 commits `0a9cd0a` → `a649467` + `5ca4aba`)：統一 `node:test` 風格 48/48 套
- **Phase 3 sync-config.sh 修法** (`2bdc831`)：awk 提取舊 header bug fix（19 → 1 separator）
- **Phase 4 KB 整合** (Worker `969ea0f` + deploy v `2332e491`)：11 個 KB 檔 → 37 entries
- **Phase 5 Fuzzy match** (同 commit)：Levenshtein + Jaccard n-gram (maxDistance=3)

### Round 18 — 2026-07-23 04:50+

檔案：[`ROUND_18_2026-07-23.md`](./ROUND_18_2026-07-23.md)

**Bug 1+2+3 fix**（Worker `45bec2c` + deploy v `0141d117`）：

- **Bug 1 fix**：`fuzzyMatchKB` `bestScore` 從 `-Infinity` → `minCombined 0.2`（避免微弱 fuzzy 誤觸發）
- **Bug 2 fix**：加 `effectiveMaxDistance` 動態調整（length ≤2 → 0；length 3-5 → 1；6-8 → 2；9+ → 3）
- **Bug 3 fix**：`tests/kb-matching.test.mjs`（25 個 unit tests，全部 pass）

### Round 19 — 2026-07-24 10:49+

檔案：[`ROUND_19_2026-07-24.md`](./ROUND_19_2026-07-24.md)

**8 個 Task 全部完成**：

- **Task A**: `TESTING_TROUBLESHOOTING.md`（commit `9efdb1a`）
- **Task B**: LINE bot config 整合（commit `8ef89be` + Worker deploy v `dfa555f4`）
- **Task C1**: Semantic scoring via synonyms（Worker `aa31757` + deploy v `f2458aee`）
- **Task C2**: 客戶標籤自動判斷（commit `d5a7604`）
- **Task C3**: L2 .bak cleanup（commit `846fc76`）
- **Task C4**: Worker staging 環境（Worker `23bf5da`）
- **Task C5**: KB inverted index + LRU cache（Worker `6c3e2a7`）
- **Task D**: `AGENT_PROJECT_SOP.md`（commit `7ec11ac`）

### Round 20-22 — 2026-07-24 18:37+ → 2026-07-25

- Round 20：Workers AI embeddings（`@cf/baai/bge-m3`）+ customer-tags endpoint 整合
- Round 21：`/api/customer-tags/:userId` endpoint + dashboard UI panel（commit `e2131ba`）
- Round 22：合併 5 個 SOP（刪 3 + 新 3）減少 67% token（commit `0f61a39`）

> **Round 20-22 細節見 SESSION_NEXT_PROMPT.md「最近 5 個 chicken commits」段**（檔案在 `docs/handoff/sessions/`）

---

## 怎麼查詢

```bash
# 列出所有 round 檔
ls /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/docs/handoff/rounds/

# 對應到 git log
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
git log --oneline | grep -E "Round (15|16|17|18|19|20|21|22)"
```

---

## 為什麼把 round 檔放到 chicken repo？

1. **跟程式碼同 git history**：round 期間的 commit 跟 round 摘要對照簡單
2. **Hubert 接手 session 時直接讀**：雞味客服 session 開局時，brtclaw 從 `docs/handoff/` 讀
3. **比 HEARTBEAT.md（`~/.openclaw/workspace/`）更穩**：HEARTBEAT.md 5 天沒更新會 drift，但 git log 不會

---

_本檔由 brtclaw 在 2026-07-28 HEARTBEAT 瘦身 Round 建立_