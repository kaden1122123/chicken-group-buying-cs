# External-user Agent 設定檔案

> 建立時間：2026-06-05
> 狀態：已建立，待 Hubert 審查

---

## 設定檔位置

| 檔案 | 路徑 |
|------|------|
| SOUL.md | `/home/clawuser/.openclaw/agents/external-user/SOUL.md` |
| AGENTS.md | `/home/clawuser/.openclaw/agents/external-user/AGENTS.md` |
| USER.md | `/home/clawuser/.openclaw/agents/external-user/USER.md` |
| memory/ | `/home/clawuser/.openclaw/agents/external-user/memory/` |

---

## 專案內的連結參考

本專案的技術架構文件也會引用這些設定檔：

- `04_技術架構/Agent_Prompt_設計.md`（待建立）→ 會連結到 SOUL.md
- `AGENTS.md`（本專案）→ 會說明與 external-user agent 的關係

---

## 為什麼放在 `.openclaw/agents/external-user/`？

根據 OpenClaw 的設計：
- `agents/<agent-id>/` 是每個 Agent 的根目錄
- SOUL.md、AGENTS.md、USER.md 是 OpenClaw 認定的標準設定檔案
- memory/ 是 Agent 的對話記憶目錄

**好處：**
1. OpenClaw 原生支援，自動讀取
2. 與其他 Agent 設定一致
3. 升級 OpenClaw 時不易遺失

---

## 與專案文件的關係

```
專案資料夾：
openclaw-workspace/others/chicken-group-buying-customer-service/
├── 04_技術架構/
│   ├── Agent_Prompt_設計.md    ← 技術實作層的 Prompt（給 Hermes 參考）
│   └── SOUL.md 備份/引用       ← 這裡不放 SOUL.md，只放連結

Agent 設定檔（實際讀取位置）：
.openclaw/agents/external-user/
├── SOUL.md                    ← AI 客服實際讀取的 Prompt
├── AGENTS.md                  ← AI 客服實際讀取的工作區規範
├── USER.md                    ← AI 客服實際讀取的用戶背景
└── memory/                    ← AI 客服的對話記憶
```

---

## 如何更新設定檔

編輯直接對應路徑即可，OpenClaw 會自動讀取最新內容：

```bash
# 編輯 SOUL.md
vim /home/clawuser/.openclaw/agents/external-user/SOUL.md

# 檢視 memory
ls /home/clawuser/.openclaw/agents/external-user/memory/
```

---

_本檔案說明設定檔的存放邏輯與專案間的連結關係。_