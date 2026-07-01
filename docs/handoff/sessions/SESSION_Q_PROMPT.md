# Session Q — 客戶實測 4 大問題修整

> **建立時間**：2026-06-30 10:46
> **觸發**：Hubert 2026-06-30 10:46 實測真實 LINE 帳號,發現 4 個問題
> **狀態**：✅ 已完成（2026-07-01）
> **優先**：🔴 高(影響 production runtime)
> **證據**：2 commits `4e2376f` (菜單從 ignored_keywords 移除), `2d4c90f` (dashboard watchdog cron job)

---

## 1. Session 摘要

Hubert 第一次實測 A 方案真實客戶端,發現 4 個問題需要修整:

1. 🔴 **客戶問「菜單」時沒傳圖片**,回覆純文字菜單
2. 🟡 **錯誤訊息**: `:warning: :tools: create folder ~/.openclaw/workspace-external-user/memory/ → list files failed`
3. 🟡 **回覆卡住**(兩則訊息中一則沒送出)
4. 🔵 **Hubert 兩個詢問**:目前隔離了哪些關鍵字、有沒有 dashboard

---

## 2. 問題詳情 + 根因分析

### 問題 1🔴 客戶問菜單時沒傳圖片

**Hubert 報告**:
> 我之前應該有跟你說過客戶詢問菜單時,line bot 應以傳送圖片方式提供菜單。
> 剛剛嘗試了以客戶身分詢問菜單,出現文字菜單(錯誤)

**應該的行為**:客戶問「菜單」「看菜單」「看品項」「有什麼」「你們賣什麼」「餐牌」「menu」時,傳 3 張圖片 + 1 段文字:
- 主推肉品: `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/menu/menu_%E4%B8%BB%E6%8E%A8%E8%82%89%E5%93%81.jpg`
- 秘製小菜: `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/menu/menu_%E7%A7%98%E8%A3%BD%E5%B0%8F%E8%8F%9C.jpg`
- 限量加購品項: `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/menu/menu_%E9%99%90%E9%87%8F%E5%8A%A0%E8%B3%BC%E5%93%81%E9%A0%85.jpg`

**實際的行為**:LLM 回覆長篇純文字菜單(從 sandbox `/workspace/knowledge/main_idea.md` 讀到的舊版,只有「# 十二、菜單知識庫」純文字列表,沒有圖片)

**根因分析**(2 個獨立問題):

**根因 A:Sandbox 看不到新版 main_idea.md**
- 主位置 `~/.openclaw/agents/external-user/knowledge/main_idea.md` (36,868 bytes,2026-06-28 19:33 更新)有「# 十一、菜單知識庫」圖片章節(2026-06-26 修整)
- Sandbox 內 LLM 看到的是 `/workspace/knowledge/main_idea.md`(從 session log `find` 結果)
- 兩個檔案**不是 symlink,內容也不同**:
  - 主位置:有「十一、菜單知識庫」圖片章節(line 398-430)
  - Sandbox:只有「# 十二、菜單知識庫」純文字章節(從 session log 顯示)
- **結論**:OpenClaw sandbox mount 沒對應到 `~/.openclaw/agents/external-user/knowledge/`,而是用另一個位置

**根因 B:Worker STEP 4.4 ignored_keywords 攔截**
- `cloudflare-worker/src/index.ts` line 106-113 定義 `DEFAULT_IGNORED_KEYWORDS`: `['我要訂購', '菜單', '常見問題', '黑羽放山雞介紹', '蔥鹽醬介紹', '吃法介紹']`
- STEP 4.4 (line 605) 對這些關鍵字 silently dropped,**完全不轉給 LLM**
- Worker 註解寫:「這些關鍵字是 LINE 官方帳號的圖文選單 / 關鍵字回覆自動產出,LINE 本身已經回覆了圖文訊息」
- **但實際情況**:客戶問「菜單」時,LINE 圖文選單設定**沒有回 3 張圖片**,而是回純文字菜單(這是 LINE 平台那邊的設定問題,或是沒有設定關鍵字回覆)
- 所以客戶看到「文字菜單」可能是 LINE 平台 fallback,不是 LLM 回應

**為什麼 session log 顯示 LLM 還是回應了菜單?**
- session 65bdbccd 中 LLM 確實有回覆菜單(從 session log 看到),因為客戶傳的是「我需要菜單」(包含「菜單」但 Worker 是「完全比對 ===」,所以沒被攔截)
- 但客戶真正問「菜單」(完全比對)就會被 Worker silently dropped

---

### 問題 2🟡 錯誤訊息 `:warning: :tools: create folder ~/.openclaw/workspace-external-user/memory/`

**實際錯誤**(從 session log):
```
{"tool":"exec","content":"mkdir: cannot create directory '/home/clawuser': Read-only file system"}
{"tool":"exec","content":"ls: cannot access '/home/clawuser/.openclaw/workspace-external-user/memory/': No such file or directory"}
```

**根因**:
- `~/.openclaw/workspace-external-user/` 目錄存在,但 sandbox 內 read-only
- `~/.openclaw/workspace-external-user/memory/` 不存在
- LLM 試圖建立但失敗
- **真正的 memory 位置**:`~/.openclaw/agents/external-user/memory/`(有 2026-04-07 等檔)
- AGENTS.md 寫的 memory 路徑是「`~/.openclaw/workspace-external-user/memory/`」(line 25 工作目錄結構那邊),**跟實際位置不一致**

**修法**:
- AGENTS.md 的「工作目錄結構」段修正記憶體路徑為 `~/.openclaw/agents/external-user/memory/`
- 或者把 memory folder symlink 到實際位置

---

### 問題 3🟡 回覆卡住

**Hubert 報告**:
> 目前我傳送兩則訊息,回覆貌似卡住了

**Session log 觀察**:
- 客戶傳「您好」→ LLM 回「您好～我是雞味研究所的小雞 🐔」(stop_reason: stop,應該送出)
- 客戶傳「我需要菜單」→ LLM 回完整菜單
- 客戶傳訂單細節 → LLM 回整理後的訂單
- 客戶傳「煙熏攻擊+玉米雞就好」 → LLM 回「了解～幫您更新訂單」
- 客戶傳「我是指煙熏攻擊+玉米雞就好 其他全部都各一盒」→ LLM 回「啊對不起 🙏 我上一則理解錯了,您是要全部 5 項都要對嗎?」

**結論**:
- LLM 每則都有回覆,沒有真的卡住
- 「卡住」可能是:
  - LINE 推送延遲(LLM 回覆快但 LINE 推送有時 delay)
  - 客戶手機上 LLM 回覆順序錯亂(被 push 通知吃掉)
  - LINE reply token 過期(免費 token 只能用 1 次,30 秒內)
- 嚴格來說不是「卡住」,是 LINE 推送體驗問題

**修法建議**:
- 短期:確認 Worker → OpenClaw Gateway → LLM → 回 LINE 的 pipeline 沒有斷
- 中期:加 push 通知 + reply token 管理

---

### 問題 4🔵 Hubert 的兩個詢問

#### Q1:目前隔離了哪些關鍵字?

**目前 ignored_keywords 清單**(6 個):
```yaml
# config/tenants/chicken.yaml (line 47-54)
ignored_keywords:
  - 我要訂購
  - 菜單
  - 常見問題
  - 黑羽放山雞介紹
  - 蔥鹽醬介紹
  - 吃法介紹

# config.yaml (legacy) 同上
# Cloudflare Worker DEFAULT_IGNORED_KEYWORDS 同上
```

**設計目的**:
- LINE 圖文選單自動回應(不讓 LLM 重複回)
- 節省 LLM token 成本
- 統一 LINE 圖文選單體驗

**為什麼這個設計跟 Hubert 預期衝突**:
- Hubert 預期:客戶問「菜單」時應該看到 3 張圖片(透過 LLM 從 prompt 拿)
- 實際:LIN 圖文選單設定可能沒有「菜單」這個關鍵字回覆,或是設定了純文字
- LINE 圖文選單設定在 LINE Official Account Manager 後台(不是程式碼)

#### Q2:有沒有一個 dashboard 可以看重要資訊、可調整的資訊?

**有!但目前沒在跑**:
- `scripts/dashboard-server.js` + `scripts/admin.html`(P0-4 修整)
- 提供 HTTP Basic Auth 介面
- 功能:
  - 看訂單列表(CSV 讀取)
  - 看/編輯訂單
  - 透過 yaml 字串 patch 改 chicken.yaml 設定(Session I5,2026-06-29)
  - 看狀態資訊(API server 連線、訂單統計)
- 啟動:`node scripts/dashboard-server.js`(port 預設)
- 對外訪問:透過 `manage-tunnel.sh start`(Cloudflare Quick Tunnel)

**當前狀態**:`ps aux | grep dashboard-server` 沒看到 process

**Auth 帳密**:`admin` / `***`(env: DASHBOARD_USERNAME, 看 SOUL.md 或 chicken.yaml)

---

## 3. Session Q 目標

修整 4 個問題,讓 production runtime 可以正常用圖片回應菜單 + 修正記憶路徑。

## 4. Session Q 任務清單

### Q1:菜單圖片回應修整(🔴 高優先)

**根因 A 修法**(讓 LLM 看到新版 main_idea.md):
- 調查 OpenClaw sandbox mount 設定:`/workspace/knowledge/` 對應到 host 的哪裡
- 把主位置 `~/.openclaw/agents/external-user/knowledge/main_idea.md` 同步到 sandbox 對應的位置
- 或建立 symlink

**根因 B 修法**(讓「菜單」觸發圖片):
- **方案 1**:從 `ignored_keywords` 移除「菜單」,讓 LLM 收到訊息並回圖片(需 LLM 真的能讀到 2026-06-28 版 main_idea.md)
- **方案 2**:在 LINE 圖文選單設定「菜單」關鍵字回覆 → 3 圖片 rich message
- **方案 3**:保持 ignored_keywords,但 Worker 在攔截時**主動**呼叫 LLM 取圖片回覆

**推薦**:**方案 1**(技術乾淨)或 **方案 2**(符合 LINE 平台設計)

### Q2:Memory 路徑修正(🟡 中)

- 修 AGENTS.md「工作目錄結構」段,把 `~/.openclaw/workspace-external-user/memory/` 改成 `~/.openclaw/agents/external-user/memory/`
- 或者建立 symlink:`ln -s ~/.openclaw/agents/external-user/memory ~/.openclaw/workspace-external-user/memory`
- **推薦**:修 AGENTS.md(避免 sandbox read-only 又踩坑)

### Q3:回覆卡住調查(🟡 中)

- 看 Worker → OpenClaw Gateway 是否有 retry/timeout 機制
- 確認 LLM 回覆時間是否超過 LINE reply token 30 秒限制
- 必要時加 push 通知備援

### Q4:Dashboard 啟動(🔵 低)

- 啟動 `node scripts/dashboard-server.js`
- 確認 auth 帳密
- 透過 manage-tunnel.sh 提供對外訪問
- 給 Hubert 一個「dashboard URL」

---

## 5. 必跑 SOP

- I-1:每個 Q1-Q4 commit 前 git add -A + status + stat + commit + show
- I-2:grep 引用點(4 個面向)
- I-3:每方案含「會連帶改 X、Y、Z」副作用

## 6. 約束

1. 不破壞真實訂單(2026-06-13.csv + 2026-06-16.csv PROTECTED)
2. 不更動 Cloudflare Worker 部署(除非明確計畫)
3. 修 AGENTS.md 後要做 dry-run(確保 LLM 能讀到)
4. Q4 dashboard 啟動要考慮 port 衝突(已經有 api-server 用 3457?)

## 7. 必讀文件

1. `docs/production-prompt/2026-06-28/main_idea.md` - 新版 prompt(菜單圖片章節)
2. `cloudflare-worker/src/index.ts` line 100-150 + 600-650 - ignored_keywords 邏輯
3. `config/tenants/chicken.yaml` - chicken.yaml 完整結構
4. `~/.openclaw/agents/external-user/AGENTS.md` - 規則檔
5. `scripts/dashboard-server.js` + `scripts/admin.html` - dashboard
6. `scripts/manage-tunnel.sh` - tunnel 管理
7. session log: `~/.openclaw/agents/external-user/sessions/65bdbccd-fa05-4a10-9c76-44498df8eba9.trajectory.jsonl`

## 8. 執行流程

1. 讀必讀文件
2. 給 Hubert 看方案 → 等確認
3. Q1 菜單圖片:
   - 2a 調查 sandbox mount 設定
   - 2b 從 ignored_keywords 移除「菜單」(若選擇方案 1)
   - 2c 驗證 LLM 能讀到新版 main_idea.md
   - 2d 實測:Hubert 傳「菜單」→ 收到 3 張圖片
4. Q2 Memory 路徑:
   - 修 AGENTS.md
   - 驗證 LLM 寫得到 daily memory
5. Q3 回覆卡住:
   - 查 OpenClaw + Worker pipeline
   - 加 retry/timeout(必要時)
6. Q4 Dashboard:
   - 啟動 dashboard-server
   - 透過 tunnel 對外
   - 給 Hubert URL + 帳密
7. 跑完整 check-quality.sh + npm test 全綠
8. 統一 push + rsync
9. 通知 Hubert

---

## 9. 相關檔案

- `docs/production-prompt/2026-06-28/CHANGELOG.md` - 2026-06-28 修整紀錄(含菜單圖片)
- `docs/architecture/NEW_ORDER_FLOW.md` v2.1 - A 方案架構
- `docs/handoff/sessions/SESSION_N_PROMPT.md` - A 方案上線紀錄

---

_本檔由 brtclaw 2026-06-30 10:46 建立,問題根因已從 session log + Worker source code 釐清_