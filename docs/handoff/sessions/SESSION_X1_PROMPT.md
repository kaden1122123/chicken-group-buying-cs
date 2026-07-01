# Session X1 — 知識庫 / Production Prompt 版本管理 + CHANGELOG

> **業務問題（CEO 視角）**：完整系統掃描（2026-07-01）發現 5 個版本管理問題：
> 1. `docs/production-prompt/` 有 2 個版本目錄（2026-06-26 與 2026-06-28）並存，沒明確標記「當前版本是哪個」
> 2. 沒 `latest` symlink，新接手的 brtclaw 不確定該讀哪個
> 3. 沒 `CHANGELOG.md`，從 commit hash 對應 prompt 變更需要手動翻 git log
> 4. sandbox 端點（`~/.openclaw/workspace-external-user/knowledge/`）與本機端檔案分離，sync 機制不明確
> 5. `knowledge/tenants/chicken/INDEX.md` 已 done（Session F），但 12 個 KB 檔案的「是否仍為 single source of truth」沒自動驗證
>
> **影響**：🟡 中（影響接手效率 + 版本追溯）
> **推薦**：做（1 小時、低風險）
> **狀態**：⏸ 待執行
> **優先**：🟡 中

---

## 必讀文件
1. `docs/production-prompt/` 整個目錄結構
2. `~/.openclaw/workspace-external-user/knowledge/main_idea.md`（sandbox 端點，當前版本）
3. `~/.openclaw/agents/external-user/knowledge/main_idea.md`（另一個端點）
4. `docs/handoff/sessions/SESSION_Q_PROMPT.md`（最近 prompt 變更記錄）
5. MEMORY.md §I（SOP）

## Session X1 任務（CEO 視角）

開始時問 CEO 決策：

「5 個版本管理問題（無 symlink、沒 CHANGELOG、sandbox sync 不明、KB single-source-of-truth 沒驗證）。
1 小時 4 個低風險改動，做 / 不做？」

如果「做」，執行 4 個項目（每個 1 commit）：

### X1-A：production-prompt 加 `latest` symlink + 簡單 SUMMARY 索引
- 現況：`docs/production-prompt/2026-06-26/` 與 `docs/production-prompt/2026-06-28/` 並存
- 修法：
  - 建立 `docs/production-prompt/latest` symlink 指到 `2026-06-28/`
  - 建立 `docs/production-prompt/SUMMARY.md` 列出每個版本的：
    - 日期
    - 變更摘要（從 commit log 抓）
    - 當前是否使用（latest / archived）
- 風險：低（純檔案管理）

### X1-B：建立 CHANGELOG.md（從 Session A 開始回溯）
- 新檔：`CHANGELOG.md`（專案根目錄）
- 格式：Keep a Changelog + SemVer
- 內容：
  - v1.0.0（2026-06-26）：Phase 1 初版
  - v1.1.0（2026-06-28）：Handoff process + Prompt 修正
  - v1.2.0（2026-07-01）：Session D3+D4 統一 config 介面
  - v1.3.0（2026-07-01）：Session G ESLint + CI
- 風險：低（純文件）

### X1-C：sandbox 端點同步 SOP 寫進 ENGINEERING_HANDBOOK
- 現況：sandbox（`workspace-external-user`）+ LLM agent（`agents/external-user`）這兩個目錄的 sync 機制是「手動 rsync」+ 「symlink」
- 修法：在 `docs/ENGINEERING_HANDBOOK.md` 加 §三：
  - sandbox → LLM agent：symlink（已完成）
  - 反向（prompt 變更時）：ENGINEERING_HANDBOOK.md §6 commit 後流程
- 風險：低

### X1-D：knowledge/tenants/chicken/ 12 檔 single-source-of-truth 驗證腳本
- 現況：每個 prompt 章節對應一個知識檔，沒自動驗證「是否有 prompt 章節引用的內容，在 KB 檔找不到」
- 修法：新檔 `scripts/verify-kb-sources.js`
  - 讀 main_idea.md 找所有「參見 knowledge/tenants/chicken/XX.md」引用
  - 確認 KB 檔存在 + 主旨未變
  - 確認 KB 檔之間沒有內容重複（single source of truth）
- 整合進 `check-quality.sh` Check 8/8

## 必跑 SOP
- I-1：每個 X1-A~D commit 前 git add -A + status + stat + commit + show
- I-2：grep 引用點確認變動模組
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 4 個獨立 commit
2. 不改 sandbox prompt 內容（只 sync 機制）
3. 真實訂單保護
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. **X1-A** symlink + SUMMARY → commit
4. **X1-B** CHANGELOG.md → commit
5. **X1-C** ENGINEERING_HANDBOOK.md §三 → commit
6. **X1-D** verify-kb-sources.js + check-quality 整合 → npm test → commit
7. 跑完整 check-quality.sh
8. 統一 push + rsync
9. 通知 Hubert

## 預期效益
- 接手者一眼看到當前 prompt 版本（symlink）
- 改動歷史可追溯（CHANGELOG）
- sandbox / agent sync 不再失憶（ENGINEERING_HANDBOOK SOP）
- KB single source of truth 自動驗證（避免章節內容不一致）
