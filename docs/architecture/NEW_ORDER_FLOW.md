# 新訂單流程架構 v2 — 純 postback（Session E 決策 2026-06-28）

> **建立時間**：2026-06-28
> **維護者**：brtclaw
> **狀態**：✅ **決策完成、待實作**
> **決策**：**D 方案（純 postback）** + **api-server 用 systemd 管理**
> **取代**：本檔 v1（v1 為監聽式架構，6/16 實測失敗，見 [NOTES/2026-06-16-issues.md §整體檢討](../NOTES/2026-06-16-issues.md) 與下方的 v1 歷史章節）

---

## 零、本版決策摘要（2026-06-28 Session E）

| 決策項 | 選擇 | 理由 |
|--------|------|------|
| 訂單流程方向 | **D 純 postback** | 不用按鈕、客戶打「確認」文字即可，簡單可靠 |
| api-server 啟動方式 | **systemd** | Linux 原生、開機自動啟動、失敗重啟 |
| v1 監聽式架構 | 廢棄 | 6/16 實測失敗（quick reply 沒顯示、CSV 沒寫入）|

**為何放棄 v1（監聽式）與 v1.5（quick reply）**：
- v1 監聽式：依賴 session 檔案格式 + LLM 輸出格式，脆弱
- v1.5 quick reply：LLM 不會主動輸出 LINE 結構化訊息，按鈕沒顯示 → 訂單沒成立 → 客戶以為訂到了但後台沒收到 → 12 天無人發現 → 阻塞 production
- 共同問題：**靠 LLM 主動觸發**的設計不可靠，v2 改用**純文字契約**（客戶打關鍵字 → Worker 偵測 → 觸發 API）

---

## 一、v2 流程圖

```
1. 客戶發「我想訂購」
   ↓ OpenClaw → LLM 客服
2. LLM 詢問品項、日期、時段、地址、付款方式
   ↓ 客戶回答
3. LLM 整理訂單摘要（純文字回覆，含品項、總金額、運費）
   ↓ LLM 回覆
4. LLM 結尾加一句：
   「請回覆「確認」完成訂購，或回覆「取消」放棄」
   ↓ 客戶回覆
5. 客戶打「確認」（純文字訊息）
   ↓ LINE → Worker
6. Worker 偵測 postback 關鍵字「確認」
   ↓ Worker
7. Worker 從對話 context 取得訂單資料
   ↓ 解析 + 驗證
8. Worker 呼叫後端 API: POST http://localhost:3001/api/orders
   ↓ API
9. API 寫入 CSV（< 100ms）
   ↓ 回傳
10. Worker 回覆 LINE：
    「您的訂單已建立！訂單編號 PENDING-12345」
    ↓ 客戶看到
11. 訂單成立 ✅
```

**與 v1.5 的關鍵差異**：
- ❌ 不需要 LINE quick reply 按鈕
- ❌ 不需要 LLM 主動輸出 LINE 結構化訊息
- ❌ 不需要 LLM 加 `:::CONFIRM:::` 標記
- ✅ 純文字契約：客戶打字「確認」→ 觸發 API
- ✅ 訊息路由層（Worker）獨立負責訂單觸發

---

## 二、v2 流程詳解

### Step 1-2：LLM 客服對話
- LLM 負責所有 FAQ、菜單查詢、訂單詢問
- LLM 收集訂單必要資訊（品項、日期、時段、地址、付款）
- LLM 不負責觸發訂單，只負責對話

### Step 3-4：訂單摘要 + 確認請求
- LLM 整理成結構化摘要（純文字）
- 結尾加標準化確認請求語句
- 範例：

```
📋 訂單摘要
━━━━━━━━━━━━━━
品項：
  • 仿土雞 1 隻 (1100g) — $1100
  • 雞腿切塊 1 包 (500g) — $250
日期：2026-06-30（一）
時段：下午
地址：新北市三峽區…
付款：現金
━━━━━━━━━━━━━━
小計：$1350
運費：$0（滿額免運）
總計：$1350
━━━━━━━━━━━━━━
請回覆「確認」完成訂購
或回覆「取消」放棄
```

### Step 5：客戶回覆「確認」
- 客戶打純文字訊息「確認」
- LINE webhook 收到訊息事件
- Worker 接收事件

### Step 6-7：Worker 觸發 + 解析
- Worker 偵測訊息內容 = 「確認」
- 從對話 context 取出訂單資料
- 驗證資料完整性（品項、日期、地址都有）

### Step 8-9：API 寫入
- Worker 呼叫 `POST http://localhost:3001/api/orders`
- API 寫入 `data/orders/{date}.csv`
- 防止重複下單（order_id 唯一性檢查）

### Step 10-11：回覆 + 訂單成立
- Worker 收到 API response（含 order_id）
- 回覆 LINE 訊息「您的訂單已建立！訂單編號 PENDING-12345」
- 訂單成立

---

## 三、實作項目（未來 session）

> **本 session（E）只決定方向，不實作。實作在後續 session。**

### E 後續 Session 建議：Session N — v2 實作

| Task | 內容 | 估時 |
|------|------|------|
| N1 | Worker 加 postback 偵測邏輯（訊息內容 = 「確認」→ 觸發 API）| 2 小時 |
| N2 | Worker 對話 context 訂單資料取出 | 1 小時 |
| N3 | api-server.js 連線驗證（從 Worker 端打 API 測試）| 1 小時 |
| N4 | 雞肉 prompt 更新（main_idea.md 移除 quick reply 機制描述，加純文字確認契約）| 1 小時 |
| N5 | 刪除 v1 監聽式遺留（order-listener.js、order-listener.test.js）| 0.5 小時 |
| N6 | end-to-end 整合測試（模擬客戶打「確認」→ CSV 寫入）| 2 小時 |
| N7 | systemd service 設定（chicken-api.service）| 0.5 小時 |
| N8 | 實測（Hubert 用真實 LINE 帳號）| 1 小時 |
| **總計** | | **9 小時** |

**會連帶改**：
- `scripts/api-server.js`（已存在，需驗證）
- `~/openclaw-workspace/external-user/cloudflare-worker/src/index.ts`（Worker postback 偵測）
- `~/.openclaw/agents/external-user/knowledge/main_idea.md`（雞肉 prompt）
- `~/.openclaw/agents/external-user/SOUL.md`（雞肉 SOUL，移除 quick reply 心智模型）
- `scripts/order-listener.js`（**刪除**）
- `tests/order-listener.test.js`（**刪除**）
- `/etc/systemd/system/chicken-api.service`（**新增**，Hubert 需 sudo）

---

## 四、api-server systemd 設定（v2 runtime）

### 為何用 systemd
- Linux 原生、零依賴
- 開機自動啟動
- 失敗自動重啟
- log 統一在 journalctl
- 不用 supervisor / PM2 多一層管理

### service 檔（草稿，Hubert 需 sudo 部署）

```ini
# /etc/systemd/system/chicken-api.service
[Unit]
Description=Chicken Customer Service API Server
After=network.target

[Service]
Type=simple
User=clawuser
WorkingDirectory=/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
Environment=API_USERNAME=api-user
Environment=API_PASSWORD=__SET_BY_HUBERT__
Environment=PORT=3001
Environment=NODE_ENV=production
ExecStart=/usr/bin/node scripts/api-server.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 部署指令（Hubert 執行）

```bash
# 1. 寫 service 檔
sudo tee /etc/systemd/system/chicken-api.service > /dev/null <<EOF
[Unit]
Description=Chicken Customer Service API Server
After=network.target

[Service]
Type=simple
User=clawuser
WorkingDirectory=/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
Environment=API_USERNAME=api-user
Environment=API_PASSWORD=__SET_BY_HUBERT__
Environment=PORT=3001
Environment=NODE_ENV=production
ExecStart=/usr/bin/node scripts/api-server.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 2. 重載 systemd
sudo systemctl daemon-reload

# 3. 啟動 + 開機自動啟動
sudo systemctl enable --now chicken-api.service

# 4. 驗證
sudo systemctl status chicken-api.service
curl http://localhost:3001/api/health
```

---

## 五、brtclaw 能做與不能做

### ✅ brtclaw 能做
- 寫程式（Worker postback 偵測、api-server 連線驗證）
- 寫 unit test / integration test
- 修改雞肉 prompt（main_idea.md）
- 修改雞肉 SOUL
- 刪除 order-listener 相關檔案
- 同步鏡像位置
- 推 GitHub
- 跑 check-quality.sh

### ⚠️ 需要 Hubert 配合
- **LINE 官方帳號設定**（如果有需要）
- **部署 systemd service**（sudo systemctl 指令）
- **設定 API_PASSWORD**（環境變數）
- **真實 LINE 測試**（需要客戶配合）

### ❌ brtclaw 沒辦法單獨做
- **改 OpenClaw 內部 tool 機制**（plugin SDK 複雜）
- **改 Cloudflare Tunnel**（需互動式登入）
- **systemd sudo 部署**（需 Hubert 權限）

---

## 六、為何 v2 方案最好

1. **完全可控**：純文字契約，LLM 只需輸出對話文字，不依賴結構化訊息
2. **完全可靠**：不依賴 quick reply 顯示、不依賴 LLM 觸發按鈕
3. **立即可實作**：Worker 端加關鍵字偵測即可，無需 OpenClaw 改動
4. **易除錯**：每步都可追蹤（LINE webhook log、Worker log、API log）
5. **易擴展**：未來加更多觸發關鍵字（「修改」、「查詢」等）很簡單
6. **systemd 保證 runtime**：失敗自動重啟、開機自動啟動

---

## 七、附錄：v1 歷史（保留供參考）

### v1 — 監聽式（2026-06-16 規劃，6/16 實測失敗）

**流程**：
```
客戶發 LINE → Worker → OpenClaw → LLM 完成 → 寫 session 檔
                                                      ↓
                                      order-listener 每 3 秒掃描
                                                      ↓
                                      解析 action blocks → 寫 CSV
```

**失敗原因**：
- 3 秒延遲
- 依賴 session 檔案格式（容易壞）
- 依賴 LLM 輸出特定格式（action blocks 容易算錯）
- 跨 OS 環境可能不同
- 監聽失敗沒人知道

### v1.5 — 主動觸發 + quick reply（2026-06-16 規劃）

**流程**：
```
客戶發「我想訂購」→ LLM → 訂單摘要 + quick reply 按鈕
                                          ↓ 客戶按按鈕
                              LINE postback → Worker → API → CSV
```

**失敗原因**（6/16 實測）：
- ❌ Quick Reply 按鈕沒顯示（LLM 沒輸出 LINE 結構化訊息）
- ❌ CSV 沒寫入（連鎖失敗：quick reply 失敗 → postback 失敗 → API 沒被呼叫）
- ❌ API-server 沒啟動（OpenClaw exec 無法保持 background）

詳見 [docs/NOTES/2026-06-16-issues.md](../NOTES/2026-06-16-issues.md)。

---

_本檔由 brtclaw 維護，Session E 2026-06-28 決策後建立 v2_
