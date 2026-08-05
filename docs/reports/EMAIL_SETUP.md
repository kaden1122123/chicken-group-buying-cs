# Gmail 整合設定指南（v2 — 2026-07-17）

> **Session P0（2026-07-17）**：雞味客服 LINE 額度 500/月限制的備援通知通道 + 全量通知。
>
> **v2 更新**：Hubert 22:53 決定 — Email 不再只是 fallback，**所有 `notifyHubert` 呼叫都同時寄 Email**（LINE + Email 並行）。
> **last_updated**：2026-07-27（Round 27 確認仍適用，無改動）

---

## 📌 為什麼需要 Gmail

- LINE Free plan 月度額度 500 訊息（2026-07-16 已額滿，reset = 2026-08-01）
- 老闆的訂單通知不能因此中斷，且需要 Email 留底（LINE 訊息會被洗掉）
- Gmail API 免費額度 500 億 quota units/day（實際無限）
- OAuth 2.0 refresh_token 永久有效（除非撤銷）

---

## 🎨 Email 版型設計（Hubert 22:53 確認）

所有 `notifyHubert(message, { type })` 呼叫會根據 `type` 自動套用對應版型：

### 1️⃣ handoff 版型（轉真人通知）

**Subject**：`【雞味研究所】🔔 轉真人通知 (2026-07-17 22:53)`

```
時間: 2026/7/17 22:53:00
類型: handoff

[客戶訊息原文]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
請儘速登入 dashboard 處理
https://100.114.197.9:3000/admin
```

### 2️⃣ autoOrder 版型（B 方案自動建單）

**Subject**：`【雞味研究所】🤖 B 方案自動建單 (2026-07-17 22:53)`

```
時間: 2026/7/17 22:53:00
類型: autoOrder

🔔 【B 方案自動建單】客戶王小明已確認訂單：
order_id: ORD-20260717-001
配送: 2026-07-19 下午
金額: NT$ 380
請確認付款狀態 ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
請確認付款狀態 ✓
https://100.114.197.9:3000/admin
```

### 3️⃣ digest 版型（訂單彙總）

**Subject**：`【雞味研究所】📊 訂單彙總 (2026-07-17 23:00)`

```
時間: 2026/7/17 23:00:00
類型: digest

== 雞味研究所 今日訂單彙總 (2026-07-17) ==

總筆數: 8
已完成: 5
待處理: 3

--- 訂單清單 ---
1. 2026-07-17 中午 | 王小明 | NT$380 | transfer | confirmed
2. 2026-07-17 下午 | 李小華 | NT$760 | jko | pending_handoff
3. ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
https://100.114.197.9:3000/admin
```

### 4️⃣ system 版型（系統通知）

**Subject**：`【雞味研究所】⚙️ 系統通知 (2026-07-17 22:53)`

```
時間: 2026/7/17 22:53:00
類型: system

🔔 AI 客服測試通知 — 系統運作正常
```

> **呼叫端對應**：
> - `src/states/handoff.js:114` → `{ type: 'handoff' }`
> - `src/handoff/autoOrder.js:94` / `:193` → `{ type: 'autoOrder' }`
> - `src/handoff/notifier.js testNotification` → `{ type: 'system' }`
> - 預設（沒傳 type）→ `system`

> **未來可調**：如果你想改某個版型（例如 handoff 要加客戶電話），跟我說。

---

## 🔐 GCP Project 確認

**Hubert 22:53 指定的 project**：

| 項目 | 值 |
|------|-----|
| Project 名稱 | `ChickenCustomerServiceSheets` |
| Project ID | `chickencustomerservicesheets` |

> **這個 project 已經有 Google service account**（`/home/clawuser/.config/chicken/secrets/google-service-account.json`）給 P9 Sheets sync 用。
> Gmail OAuth 是另外的 credentials，**不會跟 service account 衝突**。

---

## 📝 OAuth 一次性設定步驟（Hubert 操作，10 分鐘）

### Step 0: 確認 GCP project 切換

1. 打開 [GCP Console](https://console.cloud.google.com/)
2. **頂部 project 選擇器** → 搜尋 `chickencustomerservicesheets` → 點選
3. 確認左上角顯示「ChickenCustomerServiceSheets」

> ⚠️ **重要**：所有後續步驟都要在這個 project 下做，不然會找不到 credentials。

---

### Step 1: 啟用 Gmail API

1. 左選單 → **APIs & Services** → **Library**
   （或直接開 https://console.cloud.google.com/apis/library?project=chickencustomerservicesheets）
2. 搜尋框輸入 `Gmail API`
3. 點 **Gmail API**（Google 官方，有藍色勾勾）
4. 點 **Enable** 按鈕
5. 等 1-2 分鐘傳播（頁面會跳轉到 API 詳細頁）
6. 看到「API enabled」就 OK

> 💡 如果已經啟用過，會直接看到「API enabled」與「Manage」按鈕。

---

### Step 2: 設定 OAuth consent screen（如果還沒設過）

1. 左選單 → **APIs & Services** → **OAuth consent screen**
   （或 https://console.cloud.google.com/apis/credentials/consent?project=chickencustomerservicesheets）
2. 如果跳出「Configure consent screen」：
   - **User type**：選 **External**（個人 Gmail 帳號用）
   - 點 **Create**
3. **App information** 頁面：
   - **App name**：`雞味客服 Gmail`（顯示在授權畫面）
   - **User support email**：選你自己的 email
   - **App logo**：略過（不影響功能）
   - **Application home page**：略過
   - **Application privacy policy link**：略過
   - **Authorized domains**：留空
   - **Developer contact information**：填你的 email
   - 點 **Save and Continue**
4. **Scopes** 頁面：
   - 點 **Add or Remove Scopes**
   - 搜尋 `gmail.send` → 勾選 `https://www.googleapis.com/auth/gmail.send`
   - 點 **Update** → **Save and Continue**
5. **Test users** 頁面：
   - 點 **Add Users**
   - 輸入 `clawbrt@gmail.com`（要授權的 Gmail 帳號）
   - 點 **Add User** → **Save and Continue**
6. **Summary** 頁面 → 點 **Back to Dashboard**

> ⚠️ **Publishing status 設為 Testing**（預設）：這樣只有 test users 才能授權，不會被 Google 阻擋。
> 之後要正式上線再改「In production」。

---

### Step 3: 建立 OAuth 2.0 Client ID

1. 左選單 → **APIs & Services** → **Credentials**
   （或 https://console.cloud.google.com/apis/credentials?project=chickencustomerservicesheets）
2. 上方 **+ Create Credentials** → **OAuth client ID**
3. **Application type**：選 **Desktop app** ← 重要！
   > 為什麼不用 Web application？Desktop app 本地 callback 簡單，refresh_token 永久有效，不用架 server。
4. **Name**：`雞味客服 Gmail`
5. （Optional）**Authorized redirect URIs**：留空（Desktop app 會用 loopback）
6. 點 **Create**
7. 跳出「OAuth client created」視窗 → 點 **Download JSON**（或下載圖示）
8. 檔名會是 `client_secret_XXXXX-XXXXX.apps.googleusercontent.com.json`

> ⚠️ **不要選 Web application**：會需要設定 redirect URI、處理 authorization code 交換，複雜很多。

---

### Step 4: 放 credentials.json 到 XDG secrets

```bash
# 假設下載的檔案在 ~/Downloads/
mv ~/Downloads/client_secret_*.json /home/clawuser/.config/chicken/secrets/gmail-credentials.json
chmod 600 /home/clawuser/.config/chicken/secrets/gmail-credentials.json
ls -la /home/clawuser/.config/chicken/secrets/gmail-credentials.json
# 應該看到 -rw------- 1 clawuser clawuser ... gmail-credentials.json
```

> 🔒 **chmod 600 是必要的** — OpenClaw exec 會檢查 secrets 檔案權限，過寬會被擋。

---

### Step 5: 跑 OAuth 授權腳本

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node scripts/gmail-auth.js
```

**預期流程**：
1. Terminal 印出「請在 browser 開啟以下 URL 並完成授權」+ 一段 Google 授權 URL
2. **手動複製 URL** 到 browser（或按 Enter 自動開）
3. Google 帳號選擇頁 → 選 `clawbrt@gmail.com`
4. 看到「Google hasn't verified this app」→ 點 **Advanced** → **Go to 雞味客服 Gmail (unsafe)**
   > 因為 OAuth consent screen 還在 Testing 階段，會有這個警告，正常。
5. 看到授權畫面「雞味客服 Gmail wants to access your Google Account」
6. 確認勾選「Send email on your behalf」→ 點 **Allow**
7. 看到「Please copy this code...」頁面 → **複製授權碼**
8. 貼回 terminal（授權碼 prompt）
9. 按 Enter
10. Terminal 印出「✓ Token 已存到 .../gmail-token.json」

> 💡 **如果沒拿到 refresh_token**：terminal 會警告「沒拿到 refresh_token」。這通常發生在 GCP project 之前已授權過同樣 scope。
> **解法**：到 https://myaccount.google.com/permissions → 找到「雞味客服 Gmail」→ **Remove access** → 重跑 Step 5。

---

### Step 6: 驗證設定

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node -e "
  const { notifyHubert } = require('./src/handoff/notifier');
  notifyHubert('🎉 Gmail 整合測試 — 如果你看到這封信，代表設定成功！時間：' + new Date().toISOString(), { type: 'system' })
    .then(() => console.log('LINE + Email 都已觸發'))
    .catch(e => console.error('錯誤:', e.message));
"
```

**預期結果**：
1. 你手機 LINE 收到「🎉 Gmail 整合測試」訊息
2. 你 Email（`k.chang.8844@gmail.com`）收到主旨為「【雞味研究所】⚙️ 系統通知 (...)」的信

兩個都收到就代表 Gmail 整合完成 ✅

---

## 📂 檔案結構

```
config/tenants/chicken.yaml     # +email section
src/handoff/emailNotifier.js    # Gmail API client
src/handoff/notifier.js         # notifyHubert 加 LINE+Email 並行
src/config.js                   # +getEmailConfig getter
scripts/gmail-auth.js           # OAuth 授權 script
tests/emailNotifier.test.js     # 單元測試
docs/EMAIL_SETUP.md             # 本檔
~/.config/chicken/secrets/
  ├─ gmail-credentials.json     # OAuth Client ID（mode 600）
  └─ gmail-token.json           # refresh_token（mode 600）
```

---

## 🔧 故障排除

### Q: 「找不到 Gmail credentials」

A: 確認 `/home/clawuser/.config/chicken/secrets/gmail-credentials.json` 存在 + chmod 600。

### Q: 「invalid_grant」錯誤

A: refresh_token 過期或被撤銷。
1. 撤銷：https://myaccount.google.com/permissions → 找到「雞味客服 Gmail」→ Remove access
2. 重跑 `node scripts/gmail-auth.js`

### Q: 「Insufficient Permission」

A: Gmail API 沒啟用。回 Step 1。

### Q: 「access_denied」或「This app's request is invalid」

A: OAuth consent screen 的 test users 沒加 `clawbrt@gmail.com`。回 Step 2 加。

### Q: 「redirect_uri_mismatch」

A: Application type 選錯了。應該選 **Desktop app**，不是 Web application。回 Step 3 重做。

### Q: Email 收到但 subject 是亂碼

A: 不可能！我用 RFC 2047 base64 編碼中文 subject，Gmail 會自動解碼。如果真的亂碼，回報 brtclaw。

### Q: 我不想用 Desktop app 怎麼辦？

A: 可以用 Web application，但要：
1. 設定 Authorized redirect URIs：`http://localhost:8765`
2. credentials.json 裡 redirect_uris[0] 改為 `http://localhost:8765/callback`
3. 跑 `node scripts/gmail-auth.js` 時會在 port 8765 起 local server 接 callback

---

## 📚 參考資料

- [Google Identity OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
