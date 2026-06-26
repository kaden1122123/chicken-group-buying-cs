# Production Prompt 改動記錄 — 2026-06-26

> 對應 production runtime：`~/.openclaw/agents/external-user/`
>
> 本檔案是「2026-06-26 測試回合」中對 production prompt 的改動記錄，
> 並存一份 prompt 完整內容（SOUL.md + main_idea.md）作為 reference。

---

## 改動摘要

### 1. SOUL.md — 人設強化

**問題**：Hubert 測試時 bot 仍然透露 AI 身份。

**改動**：
- 在「自我介紹原則」表下新增「絕對禁止字眼清單」段落
- 列出**完整**禁止字眼：❌ 「我是 AI」「機器人」「chatbot」「程式」「助理」「小幫手」「作為人工智慧」「語言模型」「AI 助手」
- 禁止透露**內部機制**：❌ 「我會被部署到」「我的訓練資料」「讓我查詢/載入知識庫」「我需要轉發/推送/通知真人」
- 修話術：「我幫您轉給老闆查地址」→「我請老闆幫您看」
- 不小心生成出來時**不**道歉，直接改寫重述

**為何這樣改**：原本 SOUL.md 雖寫「不主動提及 AI / 機器人身份」是隱性規則，但 LLM 在對話中仍會「自我標籤」。明確禁止字眼清單 + 禁止內部機制詞彙，更直接約束 LLM 行為。

### 2. main_idea.md 第五 A 節 — 開團日期讀 config.yaml

**問題**：Hubert 測試時 bot 只檢查「明天下午 1 點前訂購」時間邏輯，**沒**讀 config.yaml 的 `open_dates`。

**改動**：
- 原本 hardcode 清單（`2026-06-16, 18, 23, 26`）+ 「以此清單為準」違反 single source of truth
- 改為動態讀取 `config/tenants/chicken.yaml` → `open_dates`
- 新增伪代碼範例，明確 LLM 應做：
  1. 讀 open_dates
  2. 判斷客戶日期是否在內
  3. 在內：再判斷收單時間
  4. 不在：說「那天沒有開團」並推薦下一個
- **不可**只靠「明天下午 1 點前」時間判斷

**為何這樣改**：原本 hardcode 違反 single source of truth，config.yaml 改了不會同步。每次客戶訊息都讀 YAML 確保資料最新。

### 3. main_idea.md 第十一節 — 菜單圖片

**問題**：原本是純文字回應（"主要品項：鹽水雞..."），Hubert 想要 3 張 R2 圖片。

**改動**：
- 原本「## 十一、菜單知識庫」是**空章節**（只剩標題，後接「## 十一、通知管理員」重複編號）
- 改為**完整章節**，列出：
  - 觸發關鍵詞（菜單/看品項/有什麼/menu 等）
  - 3 張 R2 圖片 URL（**原始未轉義**）
  - 回覆模板（1 文字 + 3 圖片）
  - 重要守則（不附加價格清單、三張都要傳）
  - 例外情境（圖片失敗時退回文字）
- 「## 詢問菜單」範例段落也更新為圖片版

**為何這樣改**：圖片比文字清楚，雞肉/小菜/加購品三類分開也方便客戶瀏覽。

### 4. main_idea.md 章節編號清理

**問題**：原 `## 十一、通知管理員` 跟 `## 十一、接單時的標準流程` 編號重複。

**改動**：
- 通知管理員改為 `## 十二、通知管理員（Hubert）守則 🚨`
- 接單流程仍是 `## 十二、接單時的標準流程`（後續章節已遞增為十三、十四、十五、十六、十七）

**為何這樣改**：章節編號混亂（# 跟 ## 混用、編號重複），LLM 看 markdown 主要看結構（# vs ##），編號只是文本。但通知管理員是核心章節，獨立編號較清楚。

---

## 未修但已知問題

### CSV 寫入 bug
- 22 筆 PENDING 訂單的 `user_line_name=Unknown`（2026-06-13.csv）
- 已在 src/utils/lineProfileCache.js 修（P2-5 改用 config 介面 + fallback）
- **但 production runtime 仍用舊版**（因為 production 不用 src/）
- 需下次 prompt 改動時順手把「lineProfileCache fallback 邏輯」也加進 prompt

### 6/16 quick reply 失敗
- 對應 2026-06-16.csv 只有 header
- 根因在 Cloudflare Worker（不在 OpenClaw 內）
- `docs/NOTES/2026-06-16-issues.md` 有詳細筆記
- 5 個修整方向 A-E 評估待定

---

## 配套檔案

- `SOUL.md` — production SOUL.md 完整內容
- `main_idea.md` — production main_idea.md 完整內容
- ../../TODO_2026-06-26.md — 詳細評估與修整過程
- ../../DAILY_SUMMARY_2026-06-26.md — 今日總結

---

## 同步建議

每次 production prompt 改動：
1. 改 `~/.openclaw/agents/external-user/SOUL.md` 或 `main_idea.md`
2. 同步 copy 到 `docs/production-prompt/{日期}/`
3. 寫 CHANGELOG.md 記錄改動
4. commit 進雞肉 git

**未來**可在 prompt 頂部加 `# Last updated: {日期}` 方便追蹤。
