# Gmail 整合設定指南

> **Session P0（2026-07-17）**：雞味客服 LINE 額度 500/月限制的備援通知通道。
> 用途：當 LINE push 失敗 / 額滿時，仍能用 Email 通知老闆。
> 與 LINE 並行觸發，兩者獨立失敗互不影響。

---

## 為什麼需要 Gmail

- LINE Free plan 月度額度 500 訊息，2026-07-16 已額滿（reset = 2026-08-01）
- 老闆的訂單通知不能因此中斷
- Gmail API 免費額度 500 億 quota units/day（實際無限）
- OAuth 2.0 refresh_token 永久有效（除非撤銷）

---

## 一次性設定步驟（只需跑一次）

### Step 1: GCP project 確認

Gmail API 需要 OAuth 2.0 credentials。雞味客服目前已有 Google service account（`/home/clawuser/.config/chicken/secrets/google-service-account.json`），是給 Sheets sync 用的。

**問題**：Gmail API 用 user credentials（代表使用者寄信）而不是 service account，所以**需要另外建立 OAuth 2.0 Client ID**。

**GCP project 選擇**（兩個選項）：

| 選項 | 優點 | 缺點 |
|------|------|------|
| **A. 用 P9 Sheets 同個 project** | 設定簡單、單一 project 管理 | 與 Sheets 共用 quota |
| **B. 新建雞味客服專用 project** | 乾淨分離、quota 獨立 | 多一個 project 管理 |

**推薦 A**：雞味客服用量小，不會碰到 quota 問題。

### Step 2: 啟用 Gmail API

1. 到 [GCP Console](https://console.cloud.google.com/)
2. 選擇 GCP project（如果走 A 選項，就是 P9 Sheets 那個）
3. 左選單 → **APIs & Services** → **Library**
4. 搜尋 "Gmail API"
5. 點 **Gmail API** → **Enable**
6. 等 1-2 分鐘傳播

### Step 3: 建立 OAuth 2.0 Client ID

1. 左選單 → **APIs & Services** → **Credentials**
2. 上方 **Create Credentials** → **OAuth client ID**
3. 若跳出「OAuth consent screen」設定：
   - User type: **External**（個人 Gmail 帳號）
   - App name: **雞味客服**
   - User support email: 你的 email
   - Developer contact: 你的 email
   - Scopes: 留空（下個步驟再加）
   - Test users: 加 `clawbrt@gmail.com`（要授權的 Gmail 帳號）
   - 儲存
4. 回到 Create OAuth client ID：
   - Application type: **Desktop app**（推薦，本地 callback 簡單）
   - Name: **雞味客服 Gmail**
   - **Create**
5. 下載 JSON 檔案（會自動下載）

### Step 4: 放 credentials.json 到 XDG secrets

```bash
# 下載的檔案可能是 client_secret_XXXX.json
mv ~/Downloads/client_secret_*.json /home/clawuser/.config/chicken/secrets/gmail-credentials.json
chmod 600 /home/clawuser/.config/chicken/secrets/gmail-credentials.json
```

### Step 5: 跑 OAuth 授權腳本

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node scripts/gmail-auth.js
```

會看到：
1. 一段 Google 授權 URL
2. browser 自動開啟（或手動複製貼上）
3. 登入 `clawbrt@gmail.com`（或你想用的帳號）
4. 看到「Gmail API wants to access your Google Account」→ 「Allow」
5. 複製授權碼貼回 terminal

完成！refresh_token 會自動存到 `/home/clawuser/.config/chicken/secrets/gmail-token.json`（mode 600）。

### Step 6: 驗證設定

```bash
# 寄一封測試信
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node -e "
  const { sendEmail } = require('./src/handoff/emailNotifier');
  sendEmail({
    to: 'k.chang.8844@gmail.com',
    subject: '【雞味研究所】Gmail 整合測試',
    body: '如果你看到這封信，代表 Gmail 整合成功！\n時間：' + new Date().toISOString()
  }).then(r => console.log('結果:', r));
"
```

檢查信箱（k.chang.8844@gmail.com）有沒有收到信。

---

## 觸發點設計

Gmail 與 LINE 並行觸發，設計原則：

| 場景 | LINE | Email |
|------|------|-------|
| 一般 handoff 通知 | ✅ 主通道 | ❌ 不寄（避免雜訊） |
| LINE push 失敗（429 / 額滿） | ❌ 跳過 | ✅ 備援 |
| handoff 緊急（`urgent: true`） | ✅ 立即 | ✅ 立即（並行） |
| 訂單彙總日報 | ❌ | ✅ 每日 23:00 |
| 訂單彙總週報 | ❌ | ✅ 週日 10:00 |

`notifyHubert` 介面擴充：
```js
notifyHubert(message, {
  urgent: false,  // true = LINE + Email 並行
})
```

---

## 檔案結構

```
config/tenants/chicken.yaml     # +email section
src/handoff/emailNotifier.js    # Gmail API client
src/handoff/notifier.js         # notifyHubert 擴充
scripts/gmail-auth.js           # OAuth 授權 script
tests/emailNotifier.test.js     # 單元測試
docs/EMAIL_SETUP.md             # 本檔
~/.config/chicken/secrets/
  ├─ gmail-credentials.json     # OAuth Client ID（mode 600）
  └─ gmail-token.json           # refresh_token（mode 600）
```

---

## 故障排除

### Q: 授權後沒拿到 refresh_token？

A: 可能原因：
- GCP project 的 OAuth consent screen 設為 "Testing"，且 `clawbrt@gmail.com` 沒加入 test users
- 之前已授權過同樣 scope，沒撤銷權限

解法：
1. 撤銷權限：https://myaccount.google.com/permissions → 找到「雞味客服 Gmail」→ Remove access
2. 重跑 `node scripts/gmail-auth.js`

### Q: 寄信失敗 "invalid_grant"？

A: refresh_token 過期或被撤銷。重跑 Step 5 授權。

### Q: 寄信失敗 "Insufficient Permission"？

A: GCP project 沒啟用 Gmail API。回 Step 2 啟用。

### Q: 不想用 Desktop app 怎麼辦？

A: 改用 Web application：
- Application type: Web application
- Authorized redirect URIs: 加 `http://localhost:8765`
- 但仍可下載 credentials.json 走同樣流程

---

## 參考資料

- [Google Identity OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
