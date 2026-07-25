# Session X3 — 觀察工具增強（dashboard 加 log panel + 錯誤率）

> **業務問題（CEO 視角）**：dashboard 只看訂單總覽（總金額、訂單數、客戶標籤）。故障排查時仍要翻 logs/ 目錄。比讀檔案慢且看不到錯誤率趨勢。
> **影響**：🟡 中（影響故障排查效率，但非阻斷性）
> **推薦**：做（1-1.5 小時、低風險）
> **狀態**：⏸ 待執行
> **優先**：🟡 中

---

## 必讀文件
1. `scripts/dashboard-server.js`（api-server 端）
2. `scripts/dashboard.js`（產生 admin.html 的 generator）
3. `src/utils/logger.js`（已實作的結構化 logger）
4. `admin.html`（當前 dashboard）

## Session X3 任務（CEO 視角）

開始時問 CEO 決策：

「dashboard 只看訂單，故障排查要翻 log。加 3 個觀察區塊（最近訂單 / LINE 訊息 / 錯誤率），1.5 小時，做 / 不做？」

如果「做」，執行 3 個項目：

### X3-A：GET /api/recent-orders 端點
- 從 `csvReader.js` 加新函數 `getRecentOrders(limit=20)`
- dashboard-server.js 加 API 路由
- 風險：低

### X3-B：結構化日誌查詢（GET /api/logs）
- 設計：基於 logger.js 寫到 JSON Lines（每日 rotation）
- 端點：GET /api/logs?date=YYYY-MM-DD&level=error|warn|all
- dashboard 加 log panel（filter by level / date）
- 風險：中（需要寫檔 + 讀檔）

### X3-C：錯誤率趨勢 widget
- 從 logs 計算每日 error 數 / total API 呼叫數 = 錯誤率
- 顯示最近 7 天趨勢（簡單 line chart，可用 Chart.js CDN）
- 風險：中（前端整合）

## 必跑 SOP
- I-1：3 個獨立 commit
- I-2：grep 引用點確認變動模組
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 3 個獨立 commit
2. 不引入新 framework（用原生 HTML + Chart.js CDN）
3. 真實訂單保護（讀 logs 不能寫入 data/orders/）
4. API auth 維持 Basic Auth
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. **X3-A** getRecentOrders + API 路由 → npm test + dashboard refresh → commit
4. **X3-B** 結構化日誌 + GET /api/logs → npm test + dashboard log panel → commit
5. **X3-C** 錯誤率 widget + Chart.js 整合 → 視覺驗證 → commit
6. 跑完整 check-quality.sh
7. 統一 push + rsync
8. 通知 Hubert

## 預期效益
- 故障時 1 個 dashboard 看最近 20 筆訂單 + 結構化日誌 + 錯誤率趨勢
- 不開 SSH + 翻 log 檔案
- 與 watchdog 整合：錯誤率 > 10% 觸發 LINE 通知（bonus）
- 對接 brt1122 後續 Session O（OpenClaw agent 升級時的監控基礎）
