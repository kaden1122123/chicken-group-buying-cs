# Production Prompt 改動記錄 — 2026-07-03（+ 2026-07-15 補登）

> **對應 production runtime**：`~/.openclaw/agents/external-user/`
> **建立時間**：2026-07-03（Hubert 17:18 codebase audit 觸發）
> **最後更新**：2026-07-16（P7 訂單完整性規則加 + main_idea.md sync 到 production runtime）
> **觸發**：完整 codebase audit 發現多處 drift，本版合併修正後對應到 production runtime。

---

## 三層位置對齊（Session Q + 2026-07-15 補登主上線/測試端 區分）

依 ENGINEERING_HANDBOOK §6.6 的三層架構：

| 層級 | 路徑 | 角色 | 用途 |
|------|------|------|------|
| **主上線端** (production) | `~/.openclaw/agents/external-user/` | LLM runtime | 客戶實際對話時讀的 canonical |
| **測試端** (sandbox / dev) | `~/.openclaw/workspace-external-user/` | Claude Code workspace | 人類編輯、測試、staging |
| **本倉庫 source** | `docs/production-prompt/{version}/` (latest symlink) | version control | 透過 git 管理版本歷史 |

**新發現（2026-07-15）**：`AGENTS.md` 之前沒納入版本控制，只在「測試端」手動維護一份複本，導致 production runtime 的 AGENTS.md 是 2026-06-15 舊版（3985 bytes）。本版首次把 AGENTS.md 合併進 production-prompt/ 並 sync 到 production runtime 為 8880 bytes canonical。

---

## 改動摘要

### 1. AGENTS.md — 合併測試端重要內容（首次納入版本控制）

**問題**：
- production runtime `~/.openclaw/agents/external-user/AGENTS.md`（主上線端）是 2026-06-15 舊版（3985 bytes），缺 🚨 規則、開團截單時間、Session Q 路徑警告等
- 測試端 `~/.openclaw/workspace-external-user/AGENTS.md`（2026-06-30, 9490 bytes）有完整內容
- Session 65bdbccd 證實 LLM 在 production runtime 還在犯 `mkdir: cannot create directory` 錯誤（沒看到 Session Q 警告）

**改動**：
- 把 🚨 嚴厲禁止規則 §1-§5、開團截單時間表、Session Q 路徑警告、AGENTS vs SOUL 雙層架構說明合併進 `~/.openclaw/agents/external-user/AGENTS.md`（主上線端）
- 同步到 `docs/production-prompt/2026-07-03/AGENTS.md`（首次納入版本控制）
- 改 symlink `latest → 2026-07-03`
- `~/.openclaw/workspace-external-user/AGENTS.md`（測試端）保留 + 加 cross-reference 註記指向主上線端

### 2. config.yaml sync（2026-07-15 drift 修整）

**問題**：
- `config/tenants/chicken.yaml`（5061 bytes）改過至少 3 次（Session D3-2 加 delivery_fee_short_fallback、D3-3 加 areas 詳細清單、C C3 加 tenant section）
- 但 `scripts/sync-config.sh` 從未跑過
- `config.yaml`（10328 bytes，legacy fallback）內容漂移：缺 `tenant:` section、`delivery.delivery_fee_short_fallback`、`delivery.areas.allowed` 只有「三鶯生活圈」

**改動**：
- 跑 `bash scripts/sync-config.sh`，config.yaml 從 10328 bytes 縮到 6332 bytes（鏡像 chicken.yaml，去掉裝飾性分隔線）
- 加 `Check 9/9: config.yaml drift 預防` 到 `scripts/check-quality.sh`（每次 commit/push 自動檢查 mtime + missing keys）
- ADR-0003 補「drift 預防 SOP」段

### 3. check-quality.sh Check 9 — config drift 預防（2026-07-15 新增）

**目的**：防止「改 chicken.yaml 後忘記跑 sync-config.sh」再次發生。

**檢查範圍**（依 Hubert「系統要足夠完善」要求）：
1. **mtime 檢查**：config.yaml mtime 必須 ≥ chicken.yaml mtime
2. **missing keys 檢查**：chicken.yaml 的所有 top-level keys 必須出現在 config.yaml
3. **檔案存在性**：兩檔都必須存在才能比對

**緩解**：發現 drift 時不 fail（warn），提示跑 `bash scripts/sync-config.sh`。

### 4. main_idea.md §十二 訂單完整性規則（P7 · 2026-07-16 加）🚨

**問題**：
- 客戶下訂只給部分資訊（例如只說「我要一個雞屁股」），LLM 容易回「好的，訂單收到！」→ 污染 dashboard 資料（Hubert 手動建單時缺一堆資訊 → 來回問客戶 → 體驗差 + 工作量高）
- 之前 main_idea.md 沒有明確規範「訂單不完整時怎麼回」，LLM 憑印象回應

**改動**：
- `docs/production-prompt/2026-07-03/main_idea.md` §十二「接單時的標準流程」插入子章節「📋 訂單完整性規則（P7）」
- 內容包含：7 項必填欄位檢查清單、❌/✅ 範例對照、❌ 絕對不要、4 條原則
- 7 項必填：日期、品項、姓名、電話、地址（含社區名稱）、送達時段、付款方式

**雙位置對齊**：
- dev `docs/production-prompt/2026-07-03/main_idea.md` ↔ production runtime `~/.openclaw/agents/external-user/knowledge/main_idea.md`
- md5 一致：`1dfa48f0402a45cbf4852efe5a1c7acd`（file mode 664，不需要 chmod dance）
- 是無自動化 sync script（手動 `cp`，因為是 prompt 文字檔不是 code）

**未來預防**：
- 改 main_idea.md / AGENTS.md / SOUL.md 後必鬆同步 production runtime（不然 LLM 讀不到新規則）
- CHANGELOG.md 記錄變更作為 audit trail

---

## 不變的部分

- SOUL.md（2026-06-26 版本）：內容不變，僅跟版本號
- main_idea.md（2026-06-28 版本）：內容不變

---

## 驗證

- ✅ npm test 47 套全綠（prompt 改動不影響 code）
- ✅ check-quality.sh Check 1-9 全部通過（Check 9 新增）
- ✅ config.yaml 同步完成（sync-config.sh 跑過）
- ✅ symlink latest → 2026-07-03
- ✅ P7 訂單完整性規則加 main_idea.md §十二，sync 到 production runtime md5 一致（2026-07-16）

---

_本檔由 brtclaw 維護，Session Q-drift + 2026-07-15 收尾_
