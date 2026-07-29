# ADR-0004: MEMORY.md 用 L1/L2/L3 三層結構

> **狀態**：Accepted
> **last_updated**：2026-07-29（Round 28 📐 補齊）
> **日期**：2026-06-23
> **決策者**：Hubert
> **背景文件**：[MEMORY.md (~/.openclaw/workspace/MEMORY.md)](../../../../.openclaw/workspace/MEMORY.md)（系統層檔案，不在本 repo 內）

---

## 背景（Context）

brtclaw 是個長期運作的 AI 助理。每次 session 開始要 load 記憶檔，但全部 load 浪費 context token。

舊版 MEMORY.md 是單層（一大坨），每次 session 開頭都讀全部。

## 決策（Decision）

**MEMORY.md 分三層結構**：

| 層 | 內容 | 讀取時機 |
|----|------|---------|
| **L1 核心** | 身份、約定、系統設定、使命 | 每次 session 必讀 |
| **L2 方法論** | 工作方法論、SOP | 參考用，按需讀 |
| **L3 索引** | 專案細節 | lazy load，點開才讀 |

## 理由

- **節省 context token**：session 開始只需讀 L1，節省 60% token
- **重要性分級**：L1 是 brtclaw 必須知道（身份、使命）；L3 是「想查再查」
- **保持長期記憶**：MEMORY.md 是 brtclaw 的「外部大腦」，跨 session 持續

## 後果（Consequences）

### 正面

- L1 約 200 行，session 開始讀完不耗 token
- L2 方法論（如 SOP、v2 工作方法論）只在需要時讀
- L3 專案索引指向「去那個檔案看」

### 負面

- brtclaw 可能「忘記」L2/L3 的細節（但這是設計目的 — 該看時再看）
- 新決策需要明確標記放在 L1/L2/L3 哪一層

### 緩解

- MEMORY.md 開頭明確說明三層結構與讀取時機
- L1 段落都標 `L1.` 前綴方便識別
- brtclaw 自己（透過 MEMORY.md）會記得「L3 索引要看再去查」

---

_本 ADR 解釋 brtclaw 記憶架構，未來設計多層記憶可參考_
