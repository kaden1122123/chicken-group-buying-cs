# Session X5 — Worker + api-server 健康檢查端點 + watchdog 延伸

> **業務問題（CEO 視角）**：完整系統掃描（2026-07-01）發現 3 個監控漏洞：
> 1. **Worker**（Cloudflare Worker `external-user-line-security`）：dashboar watchdog 只看 dashboard port 3000，不知道 Worker 是否還活著
> 2. **api-server**（port 3001）：沒在背景跑（OpenClaw exec 不保持 child）。即使有個 webhook 來，不知道 api-server 是否能接到
> 3. **統一健康檢查介面**：3 個 service（dashboard / api-server / Worker）各跑各的，沒單一 GET /healthz 端點
>
> **影響**：🟢 低（影響故障察覺速度，非阻斷性）
> **推薦**：做（1 小時、低風險）
> **狀態**：⏸ 待執行
> **優先**：🟢 低（nice-to-have，但便宜）

---

## 必讀文件
1. `scripts/watchdog 已在跑的 cron job`（36d2ca19，每 10 分鐘）
2. `scripts/dashboard-server.js`（dashboard 已有 Basic Auth）
3. `scripts/api-server.js`（api-server 有 graceful shutdown）
4. `~/.openclaw/agents/external-user/sessions/`（LLM session log）
5. `~/.cloudflared/`（Worker deployment records）

## Session X5 任務（CEO 視角）

開始時問 CEO 決策：

「3 個 service（Worker / api-server / dashboard）各自健康狀態沒統一端點。
加 1 個 GET /healthz 統一端點 + 延伸 watchdog，1 小時，做 / 不做？」

如果「做」，執行：

### X5-A：dashboard-server 加 GET /healthz（公開、不需 auth）

- 設計：
  ```js
  app.get('/healthz', (req, res) => {
    res.json({
      status: 'ok',
      dashboard: 'up',
      api_server: pingApiServer(),  // 嘗試連線 3001
      worker: pingWorker(),  // GET https://external-user-line-security.kaden1122123.workers.dev/webhook
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
  ```
- 風險：低（純新增端點）

### X5-B：cron watchdog 改為呼叫 /healthz（取代目前只看 dashboard port）

- 現況：`dashboard-watchdog.sh` 檢查 `localhost:3000/`
- 修法：改為 `curl /healthz`，驗證 status: 'ok'
- 失敗時 log 哪些 service down（更具體的 alert）

### X5-C：api-server background 啟動 SOP（應用 MOCK_TODAY 經驗）

- 現況：api-server 用 nohup background 跑，但每次 exec 結束都 kill child
- 修法：在 ENGINEERING_HANDBOOK.md §五 寫 SOP：
  ```bash
  # SSH 內執行
  cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
  setsid nohup bash scripts/start-api-server.sh > /tmp/api-server.log 2>&1 < /dev/null &
  ```
  並寫 `scripts/start-api-server.sh` 給這個獨立命令

## 必跑 SOP
- I-1：3 個獨立 commit
- I-2：grep 引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 3 個獨立 commit
2. /healthz 公開（不需 auth）但只暴露「up/down」不暴露詳細狀態（防枚舉攻擊）
3. 真實訂單保護
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. **X5-A** /healthz 端點 + npm test 驗證 → commit
4. **X5-B** watchdog 改用 /healthz → 手動測試 1 次 → commit
5. **X5-C** start-api-server.sh + ENGINEERING_HANDBOOK SOP → 驗證可啟動 → commit
6. 跑完整 check-quality.sh
7. 統一 push + rsync
8. 通知 Hubert

## 預期效益
- 1 個端點看到所有 service 健康度
- 故障排查從「3 個 script 各看各的」變「打開 dashboard 看 /healthz」
- 為 Session X3 觀察工具鋪基礎（healthz 是 widget 之一）
- api-server 啟動 SOP 標準化（新人接手不卡住）
