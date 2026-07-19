# Dashboard Tunnel 設定（基於 brt1122-System-09 Named Tunnel）

> **作者**：brtclaw（2026-07-19 22:30+ session 修整）
> **重要修正**：原 SOP 假設要新建 `chicken-dashboard` named tunnel，但實際上 `brt1122-System-09` 已經是穩定的 named tunnel（從 5/02 跑，78 天穩定），**不需要新建 tunnel**！
> **狀態**：Round 14 修整 — 重複確認 + 整理

---

## 🎯 為何不需要新建 tunnel

`brt1122-System-09` named tunnel（UUID `256e22ec-d01f-4f78-83f6-c929889173eb`）已經：
- ✅ 從 2026-05-02 穩定運行（78+ 天）
- ✅ 用 token 認證（Cloudflare Tunnel 的另一種 locally-managed 方式）
- ✅ 系統服務 `cloudflared.service`（systemd 自動重啟）
- ✅ 狀態 `Connected`（Cloudflare Dashboard 顯示）

**完全符合 Named Tunnel 升級目標**（穩定、無 zombie、URL 固定、不會 server-side close）。

---

## 📋 Hubert 需要做的（精確 4 步）

### 步驟 1：暫停 dashboard-watchdog（避免 zombie 累積）

```bash
# 暫停 cron 觸發（避免 watchdog 一直重啟 Quick Tunnel 產 zombie）
openclaw cron update 36d2ca19-c566-4914-9c91-623f9a659326 --enabled=false

# 或編輯 crontab（如果 cron 用 Linux 內建）
crontab -e  # 把 dashboard-watchdog 那行註解掉
```

**原因**：watchdog 重啟的是 Quick Tunnel（`--url`），每次重啟產 zombie。Named Tunnel 由 systemd 自動管理，不需要 watchdog 重啟。

### 步驟 2：看 Tunnel 詳情（Dashboard 已設什麼 hostname？）

1. Cloudflare Dashboard → Zero Trust → Networks → Tunnels
2. 點 `brt1122-System-09`
3. **Public Hostname** 頁籤
4. 截圖告訴我設定的 hostname 是什麼

**預期設定**：`dashboard.brt1122.com` → `http://localhost:3000`

### 步驟 3：清理 zombie cloudflared processes

```bash
# 殺掉重複的 PID（保留 PID 1543 systemd service，殺 3816647 + 3847646）
kill 3816647 3847646

# 驗證只 PID 1543 還在跑（systemd 自動重啟）
ps -eo pid,etime,args | grep cloudflared | grep -v grep
```

### 步驟 4：告訴我截圖結果，我立即做：

| 動作 | 說明 |
|------|------|
| 更新 `~/.cloudflared/config.yml` | 如果 hostname 不是 `dashboard.brt1122.com`，加 ingress 規則 |
| 修改 `scripts/manage-tunnel.sh` | 改 `NAMED_TUNNEL_NAME=brt1122-System-09`，移除 JSON credentials 邏輯 |
| 修改 `scripts/dashboard-watchdog.sh` | 移除重啟邏輯（systemd 自動重啟）|
| 更新 `SESSION_NEXT_PROMPT.md` | 加 systemd service 重啟 SOP（取代 manage-tunnel.sh）|

---

## 🧹 Round 14 修整紀錄

| 時間 | 動作 | 結果 |
|------|------|------|
| 22:30 | Hubert 跑 Cloudflare Dashboard connector | 確認 `brt1122-System-09` 已 Connected |
| 22:31 | 檢查 server | 發現 PID 1543 已穩定跑 78 天（同一個 tunnel）|
| 22:32 | 修正 SOP | 不需新建 chicken-dashboard，reuse brt1122-System-09 |
| 待 | 截圖 Dashboard Public Hostname | 等 Hubert 提供 |

---

## ❓ 常見問題

**Q：為什麼 systemd service 的 tunnel 也會自動 Connected？**
A：`cloudflared` 是官方 client，連線 Cloudflare edge。systemd 啟動 → cloudflared 用 token 認證 → 建立 tunnel connection → 持續保持連線。

**Q：需要 dashboard.brt1122.com 是 Cloudflare-managed 域名嗎？**
A：是。需要在 Cloudflare 註冊 `brt1122.com` 網域，然後 Public Hostname 才能設定 `dashboard.brt1122.com`。

**Q：dashboard URL 會變嗎？**
A：不會。Named Tunnel URL 是固定的，設什麼 hostname 就是什麼。

---

_本檔由 brtclaw 維護，每次 tunnel 設定變更時更新_
