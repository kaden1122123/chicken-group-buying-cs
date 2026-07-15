# Session Handoff — 雞味客服專案

> 此檔為當前 production 狀態摘要 + 未完成修整清單
> **最後更新**：2026-07-15 17:09 session（commit 3e3e993 + dashboard PASSWORD_FILE fallback + check-cwd.sh + 本檔）
> **用法**：未來 session 接手時先讀此檔（10 分鐘內可進入狀況）

---

## 1. 當前 Production 狀態（綠燈）

| 項目 | 狀態 | 證據 / 驗證指令 |
|------|------|----------------|
| Production runtime 三檔 | ✅ 對齊 | AGENTS.md / SOUL.md / main_idea.md md5 與 production-prompt/2026-07-03/ 完全一致 |
| 測試套件 | ✅ 全綠 | `npm test` → 49 unit + 1 integration |
| 品質檢查 | ✅ 全綠 | `bash scripts/check-quality.sh` → 11 checks, 0 fail |
| api-server | ✅ 跑中 | PID 3455982, port 3001 |
| Dashboard-server | ✅ 跑中（修過） | PID 3461715, port 3000, /tmp/dash-pwd fallback |

---

## 2. 最近 4 個 Commits

- **3e3e993** feat(check-quality): Check 10 雙位置檔案 md5 同步 + dashboard 密碼檔支援
- **953da66** fix(check-quality): 補 Check 8 X1-D 實作 + Check 9 缺 pass 訊息
- **47baeae** docs(audit): AGENTS.md × 2 收尾 + config drift 修整 + Check 9 drift 預防
- **decd2b6** docs(audit): 完整 codebase audit + drift 修整（Hubert 17:18 觸發）

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

## 4. 此 Session 完成（2026-07-15）

### 完整 audit（11 維度）
- REVIEW_GUIDE 套數 30 → 49
- CEO_GUIDE 5 個 session 狀態對齊（H/X1/X2/X3/X5）
- HEARTBEAT.md 18 個 cron jobs 完整對齊
- INDEX.md 套數更新（47→48）
- .env.example 6 → 30 env
- ENGINEERING_HANDBOOK 移除不存在腳本引用
- ADR-0003 加 drift 預防 SOP + backup 政策

### AGENTS.md × 2 合併
- 以主上線端 `agents/external-user/AGENTS.md` 為 canonical（8880 bytes md5 `f4542f4c`）
- 合併 🚨 嚴厲禁止規則 + 開團截單時間 + Session Q 路徑警告
- workspace-external-user/AGENTS.md 加 cross-reference（測試端）
- main → test 端分層明確

### Config drift 修整
- `bash scripts/sync-config.sh` 同步 chicken.yaml → config.yaml（10328→6332 bytes）
- 補上 Session D3-2/D3-3 漏的 keys + `tenant:` section
- ADR-0003 v2 加 drift 預防 SOP

### Check 完整性修整
- **Check 8（KB Source of Truth）** 補回實作（原 X1-D commit 3cd7e1f 只有 header 註解沒插實作）
- **Check 9（config drift 預防）** mtime + missing keys + 檔案存在性三層檢查
- **Check 10（雙位置檔案 md5 一致）** 新增，依 SSoT + Git mirror pattern

### Dashboard 密碼修整
- Root cause：OpenClaw exec 工具自動 redact process.env 中密碼字串
- commit 3e3e993：dashboard-server.js 加 DASHBOARD_PASSWORD_FILE 支援
- **本次新增** `/tmp/dash-pwd` 預設 fallback：dashboard-watchdog 透過 manage-tunnel.sh 重啟無 env 時仍能讀到密碼

---

## 5. ⚠️ 待修整項目（依緊急度排序）

### 緊急（30 分鐘內）
- [x] Dashboard PASSWORD_FILE fallback（本次完成，待 commit）
- [ ] **清理 89 個 leaked cloudflared processes**：`pkill -9 cloudflared` 即可清理
- [ ] **Manual Test Plan 11 步驟**（從 LINE bot 測試開始）— 見 [reference note]

### 中優先（今日內）
- [ ] ENGINEERING_HANDBOOK.md 加 §雙位置段落（講清 main 不是編輯目標、dev 才編）
- [ ] Pre-commit hook 自動跑 sync-mirror.sh
- [ ] Pre-edit guard hook（Claude Code settings.json 或 git pre-commit 整合 check-cwd.sh）
- [ ] Manual Test Plan 文件化到 `docs/handoff/TEST_PLAN.md`

### 長期（下 session）
- [ ] dashboard-server.js 改 session-based auth（避免瀏覽器 cache HTTP Basic 的 quirk）
- [ ] /tmp/dash-pwd backup SOP（重啟 vs 持久性）
- [ ] 包成 Helm/systemd service 統一管理 3 個 services
- [ ] cloudflare-worker code 完整 review（之前測試發現只有 `cloudflare-worker` 在 `/home/clawuser/openclaw-workspace/external-user/` 不在本 repo）

---

## 6. 檔案指引（給下個 session）

### 核心位置
- **Production runtime**: `~/.openclaw/agents/external-user/`
- **Dev repo**: `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **Main 鏡像**: `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
- **Git remote**: https://github.com/kaden1122123/chicken-group-buying-cs

### 重要文檔
- `docs/CEO_DECISION_GUIDE.md` — 13 個 session 決策（CEO 視角）
- `docs/ENGINEERING_HANDBOOK.md` — 工程慣例（含 §6.6 三層位置架構）
- `docs/INDEX.md` — 文檔索引
- `docs/handoff/sessions/SESSION_X_PROMPT.md` — 13 個 session prompts
- `docs/production-prompt/2026-07-03/CHANGELOG.md` — production runtime 變更記錄
- `HANDOFF.md`（**此檔**）— session handoff 摘要

### 下個 session 開頭必跑指令

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 11 checks 應全綠
npm test                          # 49 unit + 1 integration
git log --oneline -10             # 看最近 commit
cat HANDOFF.md                    # 讀此檔
```

### Q&A（常見問題快速答）

**Q: Dashboard 登入帳密？**
A: `admin / ChickenTest2026`，檔於 `/tmp/dash-pwd`（mode 600）

**Q: api-server 帳密？**
A: `api-user / 環境變數 API_PASSWORD`（在 OpenClaw SERVICE_MANAGED_ENV_KEYS 清單）

**Q: 怎麼改 chicken.yaml？**
A: 編輯 `config/tenants/chicken.yaml` 後跑 `bash scripts/sync-config.sh`

**Q: 怎麼動 prompt？**
A: 開新版 `docs/production-prompt/YYYY-MM-DD/`，commit 後改 `latest` symlink 指向

**Q: Tailscale 怎麼用？**
A: 從任一登入 Tailscale 的 PC 瀏覽 `http://100.114.197.9:3000/admin`，用 `admin / ChickenTest2026`，**用無痕模式避免瀏覽器 cache 舊 `***` 憑證**

**Q: 怎麼確認現在是 dev repo 不是 main？**
A: `pwd`，應為 `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service`。或 `bash scripts/check-cwd.sh <要編的檔>`（已存在但尚未 commit）

---

## 7. 整潔紀律提醒

1. **永遠在 dev repo 編輯**（`pwd` 確認）
2. **commit 前**：跑 `bash scripts/check-quality.sh`
3. **push 前**：跑 `bash scripts/sync-mirror.sh from-legacy`（避免 main drift）
4. **重啟 dashboard**：`env PORT=3000 node scripts/dashboard-server.js`（無密碼，自動 fallback `/tmp/dash-pwd`）
5. **清測試訂單**：`node scripts/cleanup-test-orders.js`（保護 6/13 + 6/16 真實訂單）
6. **心跳檢查**：`dashboard-watchdog`（cron `36d2ca19`）每 10 分鐘檢查 /healthz 並重啟
7. **預防未來 session 搞混目錄**：用 `scripts/check-cwd.sh <file>` 或整合到 Claude Code hooks

---

## 8. 變更歷史

| 版本 | 日期 | 主要變更 |
|------|------|----------|
| v1 | 2026-07-15 17:09 | 初次建立（本 session）|

---

**由 2026-07-15 17:09 session 建立**
更新方式：每次 session 結束時覆寫，或加日期版本（`docs/handoff/SESSION_HANDOFF_<date>.md`）
