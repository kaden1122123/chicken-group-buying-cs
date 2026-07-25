# Session X4 — csvWriter retry 機制 + trigger 結果 cache

> **業務問題（CEO 視角）**：2 個性能/可靠性漏洞：
> 1. **csvWriter**：當前 lockfile 有鎖，但寫入失敗只 throw。客戶送「已付款」時若檔案短暫鎖住（其他 process 在寫），訂單會失敗掉
> 2. **knowledge/triggers**：LLM 每次觸發都重讀 04_delivery.md 等 KB 檔，浪費 IO
>
> **影響**：🟢 低（影響效能 + 偶發失敗，非阻斷性）
> **推薦**：做（1.5 小時、低-中風險）
> **狀態**：⏸ 待執行
> **優先**：🟢 低（nice-to-have）

---

## 必讀文件
1. `src/order/csvWriter.js`（現有 lockfile 邏輯）
2. `src/knowledge/triggers.js`（現有 KB loader）
3. `src/utils/logger.js`（retry 需要的 log 結構）

## Session X4 任務（CEO 視角）

開始時問 CEO 決策：

「2 個小漏洞：csvWriter 沒 retry（偶發 lock 衝突會掉訂單）、trigger 每次重讀 KB（浪費 IO）。
修 2 個改動，1.5 小時，做 / 不做？」

如果「做」，執行：

### X4-A：csvWriter 加 retry + 細節錯誤處理

- 設計：
  ```js
  async function writeOrderWithRetry(orderData, maxRetries=3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        writeOrder(orderData);
        return;  // 成功
      } catch (e) {
        if (i === maxRetries - 1) throw new Error(`CSV write failed after ${maxRetries} retries: ${e.message}`);
        logger.warn(`CSV write attempt ${i+1} failed, retrying...`, { err: e.message });
        await sleep(50 * (i + 1));  // backoff
      }
    }
  }
  ```
- 改 `writeOrder` 為內部函數（私有）
- 新匯出 `writeOrderWithRetry` 取代原 API
- 所有 caller（awaitingPayment.js 等）改用新函數

### X4-B：trigger 結果 cache（30 秒 TTL）

- 設計：
  ```js
  const triggerCache = new Map();  // {intent: {result, expiresAt}}
  const CACHE_TTL_MS = 30 * 1000;

  function loadKnowledgeForIntent(intent) {
    const cached = triggerCache.get(intent);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const result = doLoadKnowledge(intent);  // 實際讀 KB
    triggerCache.set(intent, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
  ```
- invalidate 機制：chicken.yaml 變更時清 cache（如有 file watcher；否則 TTL 自然過期）
- 風險：低（讀 cache，不影響寫入）

## 必跑 SOP
- I-1：2 個獨立 commit
- I-2：grep 引用點（writeOrder 的所有 caller）
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 2 個獨立 commit
2. retry 失敗必須 log 結構化 error
3. cache 失效必須 safe（不能讀到 stale 資料）
4. 真實訂單保護
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. **X4-A** csvWriter retry → 整合到 awaitingPayment + 既有 tests → npm test → commit
4. **X4-B** trigger cache + unit test → npm test → commit
5. 跑完整 check-quality.sh
6. 統一 push + rsync
7. 通知 Hubert

## 預期效益
- 訂單寫入失敗率 ↓（lock 衝突自動 retry）
- KB IO load ↓（30 秒 cache 內不重讀）
- LLM 對話 latency ↓（特別是高頻時）
- 為未來 Session O/P 升級鋪路（B 方案需要更低 latency）
