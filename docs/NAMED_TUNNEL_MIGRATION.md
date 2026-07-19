# Named Tunnel 轉移 SOP（Dashboard tunnel 從 Quick Tunnel 升級到 Named Tunnel）

> **作者**：brtclaw（2026-07-19 08:50+ session）
> **觸發**：Hubert 08:23 指示「轉移為 named tunnel，客服不能掛掉」
> **目的**：把 dashboard 的 Cloudflare tunnel 從 Quick Tunnel（URL 隨機、會 zombie、server-side close）升級到 Named Tunnel（固定 URL、穩定不挂）
> **狀態**：Round 14 開始（Hubert 自己跑 Cloudflare Dashboard 部分，我跑 script 修改部分）

---

## 🎯 為何需要 Named Tunnel

**Quick Tunnel（當前）問題**：
- ⚠️ URL 每次啟動變化（random `xxx.trycloudflare.com`）— 無法設為穩定訪問點
- ⚠️ Cloudflare server-side close idle connection（每 1-2 小時斷線）
- ⚠️ 每次重啟產 zombie PID → cleanup 殺 → 浪費資源（每天 144+ zombie）
- ⚠️ watchdog 必須持續重啟（每 10 分鐘）
- ⚠️ **客服風險**：每次 watchdog 重啟有 5-10 秒中斷（不可接受）

**Named Tunnel（升級目標）優勢**：
- ✅ 固定 URL（一旦設定不變）— 可設為穩定訪問點
- ✅ 不會 server-side close（PID 1543 證明：77 天 22 小時仍在跑）
- ✅ 無 zombie（PID 穩定）
- ✅ watchdog 不需要重啟（除非真的 crash）
- ✅ **客服風險降到 0**：tunnel 不會莫名掛掉

---

## 📋 轉移步驟（Hubert 自己跑 6 步）

### 步驟 1：在 Cloudflare Dashboard 建立 Named Tunnel

```
1. 開 https://one.dash.cloudflare.com/
2. 登入帳號（用 Hubert 自己的 Cloudflare account）
3. 左側選單：Zero Trust → Networks → Tunnels
4. 點「Create a tunnel」
5. Type 選「Cloudflared」
6. Tunnel name 輸入：chicken-dashboard
7. 點「Save tunnel」
8. 下一頁「Install and run your connector」：
   - 作業系統選「Debian / Ubuntu / Other」
   - Architecture 選「64-bit」
   - 複製顯示的安裝指令（會包含 tunnel token）
9. **重要**：先不要跑那個安裝指令，繼續步驟 2
```

### 步驟 2：下載 credentials JSON

```
10. 在 Tunnel 詳情頁面，往下捲找到「Use existing tunnel」區段
    ⚠️ 重要：不要用上面「Install and run a connector」區段的 token 指令（那是 remotely-managed tunnel 用的）
11. 在「Use existing tunnel」區段，找到「You can also download a JSON file for use with the command...」文字
12. 點旁邊的「Download」按鈕，下載 chicken-dashboard-xxxxx.json
13. 重新命名為 chicken-dashboard.json
14. 移到正確位置（在你本地 SSH 終端跑）：
    scp ~/Downloads/chicken-dashboard.json clawuser@100.114.197.9:/home/clawuser/.cloudflared/chicken-dashboard.json
    ssh clawuser@100.114.197.9 "chmod 600 /home/clawuser/.cloudflared/chicken-dashboard.json"

**⚠️ 不能沿用舊 JSON**：每個 tunnel 有獨立 UUID 和 credentials。
- 舊的 PID 1543 是 remotely-managed tunnel（用 --token 認證）
- chicken-dashboard 是 locally-managed tunnel（用 JSON 認證）
- 兩者完全不相容，必須重新下載
```

### 步驟 3：設定 Public Hostname

```
15. 在 Tunnel 詳情頁面，切到「Public Hostname」頁籤
16. 點「Add a public hostname」
17. Subdomain 輸入：dashboard（會變成 dashboard.brt1122.com 或你的 Cloudflare 網域）
18. Domain 選擇：你的 Cloudflare-managed 網域（不是 .localhost，因為 RFC 6761 reserved TLD）
19. Service 選「HTTP」
20. URL 輸入：localhost:3000
21. 點「Save hostname」
```

**注意**：如果沒有 Cloudflare-managed 網域：
- 選項 A：用 Cloudflare 註冊一個 domain（推薦 `brt1122.com` 或類似）
- 選項 B：用 Cloudflare for SaaS 自訂 hostname
- 選項 C：保留 Quick Tunnel 但用 named tunnel 的穩定性（要進階設定）

### 步驟 4：設定本機 Cloudflared

SSH 到雞味客服 server 後：

```bash
# 確認 .cloudflared/ 已有 credentials file
ls -la /home/clawuser/.cloudflared/

# 應看到：
# config.yml（已存在）
# chicken-dashboard.json（剛下載）

# 確認 config.yml 設定正確（已存在於 .cloudflared/config.yml）
cat /home/clawuser/.cloudflared/config.yml
# 應看到：
# tunnel: chicken-dashboard
# credentials-file: /home/clawuser/.cloudflared/chicken-dashboard.json
# ingress:
#   - hostname: dashboard.<your-domain>
#     service: http://localhost:3000
#   - service: http_status:404
```

**重要**：如果你的 hostname 不是 `dashboard.chicken.localhost`（應該不是，因為 `.localhost` 不能設為 Cloudflare hostname），需要更新 `config.yml` 的 hostname 段。

### 步驟 5：測試 Named Tunnel

```bash
# 在 SSH session 跑（不是 OpenClaw exec）
cloudflared tunnel run chicken-dashboard

# 應該看到：
# 2026-XX-XX INF Starting tunnel
# 2026-XX-XX INF Route via CNAME: dashboard.<your-domain>
# 2026-XX-XX INF Connection established connIndex=0

# 在另一個 terminal 測試訪問
curl https://dashboard.<your-domain>/healthz
# 應回 status ok（dashboard / api_server / worker 全 up）
```

如果成功 → Named Tunnel 設定完成。

如果失敗 → 檢查：
- DNS 是否生效（`dig dashboard.<your-domain>` 應該指向 Cloudflare tunnel）
- credentials file 是否正確（`cloudflared tunnel info chicken-dashboard`）
- config.yml 的 hostname 是否匹配

### 步驟 6：停止舊 Quick Tunnel + 啟用 Named Tunnel（我會自動處理）

我（brtclaw）會自動：
- 修改 `scripts/manage-tunnel.sh` 優先用 named tunnel
- 修改 `scripts/dashboard-watchdog.sh` 監控 named tunnel
- 把 `dashboard.chicken.localhost` 從 config.yml 改為實際 hostname

你（Hubert）只需要告訴我：
- 你的 Cloudflare 網域是什麼（例如 `brt1122.com`）
- 你的 subdomain 設定是什麼（例如 `dashboard`）

---

## 🔧 我（brtclaw）會自動做的事

### 自動修改 `scripts/manage-tunnel.sh`

從「只支援 Quick Tunnel」改為「Named Tunnel 優先，Quick Tunnel fallback」：

```bash
# 新邏輯：
start_named_tunnel() {
  if [ -f ~/.cloudflared/chicken-dashboard.json ]; then
    echo "=== 使用 Named Tunnel（穩定） ==="
    setsid cloudflared --no-autoupdate tunnel --config ~/.cloudflared/config.yml run chicken-dashboard > $TUNNEL_LOG 2>&1 &
    disown
    URL_FILE=$NAMED_URL_FILE  # URL 固定，不需要等連線
  else
    echo "=== Named Tunnel credentials 不存在，fallback 到 Quick Tunnel ==="
    start_quick_tunnel
  fi
}
```

### 自動修改 `scripts/dashboard-watchdog.sh`

從「重啟 Quick Tunnel」改為「檢查 Named Tunnel 狀態」：

```bash
# 新邏輯：
restart_tunnel() {
  if [ -f ~/.cloudflared/chicken-dashboard.json ]; then
    # Named Tunnel: 檢查 process 是否活的
    if ! pgrep -f "cloudflared tunnel run chicken-dashboard" > /dev/null; then
      echo "[watchdog] Named Tunnel 不在跑，重新啟動"
      cloudflared tunnel run chicken-dashboard > $TUNNEL_LOG 2>&1 &
    fi
  else
    # Quick Tunnel fallback: 用 manage-tunnel.sh 重啟
    bash scripts/manage-tunnel.sh start
  fi
}
```

### 自動更新 `.cloudflared/config.yml`

從 `dashboard.chicken.localhost` 改為實際 Cloudflare 網域（待你提供 domain）。

### 自動更新 `SESSION_NEXT_PROMPT.md`

加 Named Tunnel 環境變數說明（dashboard URL 從 random trycloudflare 變為固定 hostname）。

---

## ⚠️ 風險評估

| 風險 | 影響 | 緩解 |
|------|------|------|
| DNS 未生效 | tunnel 連不上 | 步驟 5 先測試訪問 |
| credentials 過期 | tunnel 認證失敗 | 1+ 年有效，但定期檢查 |
| Cloudflare 帳號被鎖 | tunnel 全停 | 維持備用 Quick Tunnel fallback |
| 雞味客服 LINE webhook 暫停 | 用戶訊息收不到 | 暫時停 webhook 不影響 dashboard |

---

## 📝 變更歷史

| 日期 | 變更 | 觸發 |
|------|------|------|
| 2026-07-19 08:50 | 初始建立 SOP | Hubert 08:23 指示 named tunnel 轉移 |

---

_本檔由 brtclaw 維護，轉移完成後更新狀態_
