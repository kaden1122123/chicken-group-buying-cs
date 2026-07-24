# 雞味客服 LINE Bot 測試 — 問題反應 SOP

> **作者**：brtclaw（2026-07-24 10:50 Round 19 建立）
> **適用對象**：Hubert（測試期間）+ 真人客服（交接期間）
> **目的**：測試中遇到奇怪地方時的快速反應流程

---

## 🚨 緊急程度分類

| 等級 | 情境 | 反應時間 | 處理者 |
|------|------|----------|--------|
| 🔴 P0 | 服務整體掛掉 / 客戶大量投訴 | 立即 | Hubert |
| 🟡 P1 | 單一功能壞 / KB 明顯誤判 | 30 分鐘 | brtclaw |
| 🟢 P2 | 小 bug / 邊界 case | 1 小時 | brtclaw next session |

---

## 🧪 測試前準備 checklist

開始測試前，確認 5 件事：

1. ✅ `/healthz` 回 `status: ok`，services 全 up
   ```bash
   curl http://localhost:3000/healthz
   ```
2. ✅ Worker endpoint alive（回 200 + stats）
   ```bash
   curl https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats
   ```
3. ✅ 真實訂單 6/13 + 6/16 csv 還在（測試不能誤刪）
   ```bash
   ls data/orders/chicken/2026-06-1{3,6}.csv
   ```
4. ✅ Dashboard tunnel 連得到
   ```bash
   curl https://dashboard.brt1122.com/healthz
   ```
5. ✅ Discord #chicken-group-buying-customer-service 在線

---

## 🔴 P0 緊急狀況

### 服務整體掛掉（/healthz 非 ok）

**症狀**：`status: ok` 變 `"status": "degraded"` 或連不上

**反應步驟**：
1. 立刻通知 Hubert：「雞味客服服務掛了，需緊急處理」
2. **不要自己重啟** — 改動前先抓 log
3. 抓 api-server / dashboard-server log：
   ```bash
   tail -100 /tmp/api-server.log
   tail -100 /tmp/dashboard-server.log
   ```
4. 截圖 log 給 Hubert + 記錄時間

**常見 root cause**：
- api-server / dashboard-server process 被 kill（看 `ps -eo pid,etime,comm,args | grep node`）
- 磁碟滿了（看 `df -h`）
- .env / secrets 檔案被誤改

### 客戶大量投訴 / Spam

**症狀**：Hubert 收到多封抱怨訊息

**反應步驟**：
1. 立刻把 line-bot rate limit 調緊（暫時擋大量訊息）
2. 通知 Hubert + 客戶狀態
3. 檢查 Worker logs（用 `wrangler tail` 看 LINE webhook 行為）

---

## 🟡 P1 單一功能異常

### 問題 1：客戶訊息沒回應

**症狀**：手機 LINE 傳訊息給雞味研究所，沒收到任何回應

**排查步驟**：
1. 確認 Worker 收到 webhook：
   ```bash
   cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
   wrangler tail  # 監看 Worker 實時 log
   ```
2. 看 webhook event type — 如果是 `unfollow` 或 `join`，本來就不回
3. 確認 LINE channel secret 在 Worker env 沒被改：
   ```bash
   wrangler secret list  # 看 secret names（不顯示 value）
   ```
4. 確認 main_idea.md / chicken.yaml 是最新版本：
   ```bash
   cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
   bash scripts/sync-canonical.sh
   bash scripts/sync-config.sh
   ```
5. 確認 api-server 在跑（Worker 轉發需要它）：
   ```bash
   curl -sS http://localhost:3001/api/health
   ```

### 問題 2：客戶訊息回應錯誤（KB 誤判）

**症狀**：客戶問「運費多少」卻收到雞肉品項的答案

**排查步驟**：
1. 重現問題：複製客戶訊息原文，curl Worker：
   ```bash
   curl "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=<客戶訊息原文>"
   ```
2. 看 `/api/knowledge` 回傳的 `entry.id` 和 `topic`，判斷是否命中錯誤 entry
3. 記錄到 `docs/KNOWN_ISSUES.md` 並 `memory/YYYY-MM-DD.md`
4. 修法選項：
   - **短期**：調 fuzzy threshold（`minCombined` 從 0.2 調到 0.3）
   - **中期**：加新 entry 把這個 query 收進 keywords
   - **長期**：換 semantic scoring（embeddings）

### 問題 3：客戶訊息卡在轉真人沒回應

**症狀**：客戶觸發 handoff（退款/客訴 等）但 Hubert 沒收到 LINE 通知

**排查步驟**：
1. 確認 notify_owner 設定：
   ```bash
   grep -A 3 "notify_owner:" config/tenants/chicken.yaml
   ```
2. 確認 line-bot-token 在 `/home/clawuser/.config/chicken/secrets/` mode 600
3. 看 api-server log 有沒有 `[notifyHubert]` 錯誤
4. 測試 notify：手動 call api-server endpoint

### 問題 4：客戶訊息走 LLM 但答錯

**症狀**：KB 沒命中 → fallback 到 LLM → LLM 答非所問

**排查步驟**：
1. 確認 KB 真的沒命中（curl `/api/knowledge?q=...`）
2. 確認 main_idea.md 是最新且正確
3. 看 OpenClaw Gateway log（dashboard URL）
4. 修法：把這個 query 模式加到 KB 當新 entry

---

## 🟢 P2 邊界 case / 小 bug

### 問題 5：fuzzy match 誤觸發（false positive）

**症狀**：客戶問「完全不相关」卻命中某個 entry

**排查步驟**：
1. Re-run 單元測試：
   ```bash
   cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
   node --test tests/kb-matching.test.mjs
   ```
2. 如果 test 通過但 production 失敗，可能是 deployment cache
3. 重新 deploy：
   ```bash
   wrangler deploy
   ```
4. 加記錄到 `memory/YYYY-MM-DD.md`

### 問題 6：客戶訊息包含 emoji / 特殊字元沒回應

**症狀**：客戶用 😂 / 「」/ 全形空格 等，AI 卡住

**排查步驟**：
1. 確認 message sanitizer（`index.ts` line 81-100）有處理
2. 加 log 看實際 messageText
3. 修 sanitizer regex

### 問題 7：客戶訂單寫入失敗

**症狀**：客戶完成訂單流程但 dashboard 沒出現

**排查步驟**：
1. 看 api-server log 有 `[writeOrder]` 錯誤
2. 檢查 `data/orders/chicken/` 是否有新 csv
3. 檢查 disk space：`df -h /`
4. 檢查 chicken.yaml storage 設定

---

## 🔍 Debug 工具清單

### 查 Worker 實時 log
```bash
cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker
wrangler tail --format=pretty
```

### 查 api-server log
```bash
tail -200 /tmp/api-server.log | grep -E "ERROR|WARN|notifyHubert"
```

### 查 dashboard-server log
```bash
tail -200 /tmp/dashboard-server.log
```

### 查 KB 匹配結果（不透過 LINE）
```bash
curl "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge?q=<訊息>"
curl "https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats"
```

### 重啟服務（最後手段）
```bash
# api-server
ps aux | grep "scripts/api-server" | grep -v grep | awk '{print $2}' | xargs kill
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
  PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown

# dashboard-server
ps aux | grep "scripts/dashboard-server" | grep -v grep | awk '{print $2}' | xargs kill
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
nohup env DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health \
  PORT=3000 \
  node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown
```

---

## 📞 聯絡 / 升級

| 角色 | 負責 | 聯絡 |
|------|------|------|
| 第一線 | brtclaw（OpenClaw Agent） | Discord #chicken-group-buying-customer-service |
| 升級 | Hubert（老闆） | LINE `Uf56650056d35626deb64165926a26182` |
| 真人客服 | Hubert 處理 | 同上 |

---

## 📝 問題回報格式

發現問題時，把這 5 欄填好貼到 #chicken-group-buying-customer-service：

```
🚨 [P?] 問題簡述
📅 時間：YYYY-MM-DD HH:MM
👤 客戶訊息原文：（貼原文，不是改寫）
🎯 預期回應：（你覺得應該答什麼）
❌ 實際回應：（客戶收到什麼，或 AI 沒回）
📎 證據：（curl 結果、log 截圖、KB 匹配結果）
```

---

_本檔由 brtclaw 維護，每次發生新問題類型時更新_
_最後更新：2026-07-24 10:50_
