# Bug 分析 & 修補規劃 — 2026-06-14

> 建立時間：2026-06-14 09:50 (Asia/Taipei)
> 維護者：brtclaw
> 狀態：Planning（80%）
> 性質：完整 Bug 根因分析 + 修補方案 + SOP 標準化 + Phase 2/儀表板 規劃

---

## 零、Hubert 實測回報的 Bugs

### Bug #1：晚上訂購邏輯失效
- 描述：客戶輸入開團日期已是當天（晚上），客服仍嘗試進入訂單確認環節
- 規則：開團時間 = 送貨時間，前一天下午 1 點前才能訂購
- 晚上時間已經無法配送（不管是上午還是下午的時段）

### Bug #2：推薦日期錯誤
- 描述：推薦的日期是「明天」或「不存在的日期」，而非「下一個有開團的日期」

### 補充要求
- 未來需要 SOP 標準化文件（人工設定清單 + 客製化標記）
- 接下來 Phase 2（Google Sheets 整合）& 儀表板 的 planning

---

## 一、Bug #1 根因分析

### 程式碼層面（已驗證邏輯正確）

`src/rules/dateRule.js` 的 `validateDate` 確實有處理 4 種情況：
- ✅ not_this_month（不是當月）
- ✅ not_open_date（今天沒有開團）
- ✅ past_cutoff_today（已超過當天 13:00）
- ✅ past_order_cutoff（已超過配送前一日 13:00）

測試結果（已用時間 mock 驗證）：
- 客戶在 2026-06-15 晚上 9 點想訂 2026-06-16 配送 → ✅ 正確擋下（past_order_cutoff）
- 客戶在 2026-06-16 晚上 8 點想訂 2026-06-16 配送 → ✅ 正確擋下（past_cutoff_today）

### Prompt 層面（production 真正的問題）

`~/.openclaw/agents/external-user/knowledge/main_idea.md` 的「九、收單時間規則」章節：
```
### 13:00 對外收單
13:00 收單後，原則上不可棄單或改天。

### 14:00 前
14:00 前需要給 Willy 確認過的訂單。
14:00 後雞肉不可追加。

### 18:00 前
18:00 前可以追加小菜、變更時段。
18:00 後如果已經打完單，原則上不能再變更。
```

**缺失的規則**：
1. ❌ 沒有「配送日 = 今天 + 現在 13:00 後 → 完全不可下單」
2. ❌ 沒有「配送日 = 明天 + 下午/晚上時段 → 上午時段配送可能來不及」
3. ❌ 沒有「時段 × 配送前一日時間」的合併判斷
4. ❌ 沒有強制 LLM 執行 `validateDate` 的阻擋邏輯

**結論**：LLM 在收到客戶「晚上 8 點想訂今天配送」的訊息時，prompt 沒有明確告訴它要阻擋，所以 LLM 自作主張進入確認環節。

### 修補方案

**A. Prompt 加強**（主要修法，影響 production）
- 在 main_idea.md「九、收單時間規則」加上下列規則：
  - 配送日 = 今天 + 現在時間 >= 13:00 → 不可下單
  - 配送日 = 明天 + 現在時間 >= 14:00 + 上午時段 → 不可下單（備料時間不足）
  - 配送日 = 明天 + 現在時間 >= 18:00 + 下午時段 → 不可下單（小菜無法追加）
  - 配送日 = 明天 + 現在時間 >= 13:00 → 已過收單時間，原則上不可下單
- 在 SOUL.md 加強「配送時間限制」為不可錯誤資訊

**B. 程式碼加強**（次要，補強設計）
- `validateDate` 加入「配送日 = 今天 + 13:00 後」更明確的錯誤訊息（已是 past_cutoff_today，但要強化）
- `timeSlotRule` 加入時段 × 配送日的組合驗證（上午/下午 × 配送前一日時間）
- 新增 `tests/date.test.js` 補上所有邊界 case

**C. 測試補強**（確保 regression 不再發生）
- 新增專門測試「晚上訂購」邊界
- Mock 各種時間，驗證 validateDate 行為
- 確保不只程式碼對，prompt 也是對的

---

## 二、Bug #2 根因分析

### 程式碼層面

`validateDate` 錯誤訊息目前是：
```
不好意思，今天沒有開團喔，本月開團日期 2026-06-06、2026-06-13、2026-06-16、2026-06-18、2026-06-23、2026-06-26。
```

**問題**：
1. 顯示整個清單，沒有突出「下一個開團日」
2. 「今天沒有開團」措辭不精確（客戶可能指「明天」或「某天」）
3. 沒有用「建議您改訂下個開團日：2026-06-16」這種具體引導

### Prompt 層面

main_idea.md「五、品牌與開團規則」有提到：
```
若客戶想訂的日期不是本週開團日，請用業務角度自然引導客戶改到有開團的日期。
```

但 LLM 自主判斷時可能推薦錯誤的日期（不是「下一個」開團日，而是「最近一個」或「明天」）。

### 修補方案

**A. 程式碼加強**
- 在 `dateRule.js` 新增 `getNextOpenDate(afterDate)` 函數
- 改進 `validateDate` 錯誤訊息：
  - not_open_date：「不好意思，您選的日期沒有開團。下次有開團的日期是 2026-06-16（週二），您可以改訂這天嗎？」
  - past_cutoff_today：「不好意思，今天已經 13:00 後了，無法再下今天的訂單。下次有開團的日期是 2026-06-16，您要改訂這天嗎？」
  - past_order_cutoff：「不好意思，已經超過下單時間了。下次有開團的日期是 2026-06-16，建議您改訂這天。」
  - not_this_month：「不好意思，本月已經沒有開團了。下次有開團的日期是 2026-07-XX，請問您要等下個月嗎？」

**B. Prompt 加強**
- 在 main_idea.md 加強「推薦下一個開團日」的具體指引
- 提供固定範例回覆

**C. 測試補強**
- 測試 `getNextOpenDate(2026-06-14)` 應回傳 2026-06-16
- 測試 `getNextOpenDate(2026-06-20)` 應回傳 2026-06-23
- 測試 7 月無資料時的 fallback

---

## 三、完整修補計畫

### Phase 1：Bug 修復（執行順序）

1. **程式碼：`dateRule.js` 加 `getNextOpenDate` + 改進錯誤訊息**
2. **程式碼：`timeSlotRule.js` 加時段 × 日期合併驗證**
3. **程式碼：`validateDate` 強化「配送日 = 今天」的錯誤訊息**
4. **測試：新增 `tests/date.test.js` 涵蓋所有邊界**
5. **測試：補上「晚上訂購」回歸測試**
6. **Prompt：main_idea.md 加強「配送時間限制」章節**
7. **Prompt：SOUL.md 加強「不可錯誤資訊」包含配送時間**
8. **驗證：Hubert 再次實測**

### Phase 2：SOP 標準化文件

目標：未來給其他客戶複製使用時，可以快速上手

**內容規劃**：

#### 1. 人工設定清單（必須在設定時填入）

| 設定項 | 檔案位置 | 範例 | 備註 |
|--------|---------|------|------|
| 品牌名稱 | `config.yaml.official.brand_name` | 雞味研究所｜牧草放山雞 | |
| LINE 社群 | `config.yaml.official.line_community` | @620boqol | |
| 銀行帳戶 | `config.yaml.official.bank_account` | 銀行代碼：007（第一銀行）\|\| 帳號：23257030422 | |
| 街口 QR Code | `config.yaml.official.jko_qr_code_url` | https://... | |
| LINE Pay ID | `config.yaml.official.line_pay.line_id` | Willy0221 | |
| 開團日期 | `config.yaml.open_dates` | 2026-06-16, 2026-06-18, ... | 每月初更新 |
| 配送範圍 | `config.yaml.delivery.areas` | 三峽、鶯歌 | |
| 免運門檻 | `config.yaml.delivery.minimum_order.side_dish_ntd` | 350 | |
| 收單時間 | `config.yaml.cutoff` | 13:00, 14:00, 18:00 | |
| 通知對象 | `config.yaml.handoff.notify_owner.line_user_id` | Uf56650056d35626deb64165926a26182 | 客服老闆的 LINE user ID |
| 白名單 | `config.yaml.security.allowed_line_users` | Uf56650056d35626deb64165926a26182 | 上線前啟用 |
| 商品菜單 | `knowledge/base/01_product.md` | 19 個品項 | 品項/價格/規格 |
| 商品圖片 | `chicken-group-buying-customer-service_Hubert-info/menu/` | 主推肉品、小菜、加購品 | |
| 常見問題 | `knowledge/base/06_faq.md` | 19 題 | |
| 轉真人條件 | `knowledge/base/07_transfer_rules.md` | 14 種 | |
| 通知話術 | `config.yaml.handoff.customer_reply` | 感謝您的提問... | |
| 風格 | `SOUL.md` | 細心、體貼、親切、有一點幽默 | |

#### 2. 客製化標記（讓其他客戶接手時可快速識別）

| 標記 | 出現位置 | 用途 |
|------|---------|------|
| `{{BRAND_NAME}}` | SOUL.md / config.yaml | 品牌名稱 |
| `{{BANK_ACCOUNT}}` | config.yaml / SOUL.md | 銀行帳號 |
| `{{LINE_PAY_ID}}` | config.yaml / SOUL.md | LINE Pay ID |
| `{{OPEN_DATES}}` | config.yaml | 開團日期清單 |
| `{{DELIVERY_AREA}}` | config.yaml | 配送範圍 |
| `{{SUPPORT_PHONE}}` | config.yaml | 客服電話（選填） |
| `{{STYLE_NOTE}}` | SOUL.md | 文案語氣偏好 |

#### 3. 部署步驟

1. 設定 Cloudflare Worker
   - 建立 KV namespace
   - 設定 secrets (LINE_CHANNEL_SECRET, LINE_ACCESS_TOKEN, JKO_QR_CODE_URL)
   - wrangler deploy
2. 設定 OpenClaw external-user agent
   - 編輯 `~/.openclaw/agents/external-user/SOUL.md`
   - 編輯 `~/.openclaw/agents/external-user/knowledge/main_idea.md`
   - 編輯 `~/.openclaw/.env` (LINE_BOT_TOKEN, LINE_CHANNEL_SECRET)
3. 設定 LINE 官方帳號
   - 建立官方帳號
   - 設定 Webhook URL: `https://external-user-line-security.{account}.workers.dev/webhook`
   - 設定關鍵字回覆（菜單、常見問題等 6 個關鍵字）
4. 設定 Rich Menu（六宮格）
5. 填入開團日期
6. 測試（用真實 LINE 帳號）

#### 4. 維運清單

| 頻率 | 任務 |
|------|------|
| 每週日 | 公告下週開團時間 |
| 每月初 | 更新 `config.yaml.open_dates` |
| 每月 | 檢查 KV 中的付款資訊是否還在 |
| 每季 | Review 知識庫內容（價格、配送範圍）|
| 每年 | 檢查 LINE Pay ID 是否還有效 |

---

## 四、Phase 2 & 儀表板 規劃

### Phase 2：Google Sheets 整合

**目標**：取代本地 CSV，改用 Google Sheets 儲存訂單

**架構**：
```
LINE → Cloudflare Worker → OpenClaw Gateway → external-user agent
                                              ↓
                                          雞肉專案 logic（rules / states）
                                              ↓
                                          Google Sheets API
                                              ↓
                                          Google Sheets
```

**優點**：
- ✅ 多裝置即時查看
- ✅ 不用 pull CSV
- ✅ 容易分享給其他人
- ✅ 公式可以做簡單統計
- ✅ 與 Google Calendar 整合可以做開團日管理

**缺點**：
- ❌ 需要 Google Cloud 設定（service account）
- ❌ API 限制（per user per minute）
- ❌ 增加延遲

**實作步驟**：
1. 建立 Google Cloud project + service account
2. 開 Google Sheets API + 取得 credentials
3. 建立 Sheets 模板（訂單表 / 開團日表）
4. 改 `src/order/csvWriter.js` → `src/order/sheetsWriter.js`
5. 設定 fallback：若 Sheets API 失敗，仍寫本地 CSV
6. 同步定時任務：每 5 分鐘從 Sheets pull 最新開團日 → 更新 config

**優先級**：🟡 中（Phase 1 CSV 已經能運作，可延後）

### 儀表板

**目標**：讓 Hubert 不用打開 CSV 就能看訂單狀態、營收、客戶分析

**選項**：

#### A. Google Sheets Dashboard（簡單）
- 優點：不用寫程式，直接用 Sheets 內建功能
- 缺點：互動性低、無法即時通知
- 預估：1 天可完成
- 適合：MVP

#### B. Cloudflare Worker + HTML（中等）
- 優點：自訂化、即時、不依賴外部
- 缺點：要維護 Worker + 網頁
- 預估：3-5 天
- 適合：內部使用

#### C. 獨立 Web App（複雜）
- 優點：完整功能、互動性高、可商業化
- 缺點：要架伺服器、維護成本高
- 預估：1-2 週
- 適合：未來多租戶時

**建議**：先 A（Sheets Dashboard），等規模變大再升級到 B 或 C

**儀表板內容**：
1. 訂單總覽
   - 今日 / 本週 / 本月訂單數
   - 各狀態訂單數（pending / paid / confirmed / delivered）
2. 營收分析
   - 本月營收
   - 雞肉 vs 小菜 vs 加購品 佔比
   - 客戶終身價值
3. 客戶分析
   - 新客 vs 老客比例
   - 各社區/區域訂單分佈
4. 庫存警示
   - 即將售完的品項
   - 配送前最後 24 小時的訂單
5. 異常警示
   - 待處理 handoff
   - 超過 24 小時未付款
   - 開團日當天的訂單

---

## 五、未來規劃：多租戶支援

目標：讓其他客戶可以快速複製雞肉團購客服的系統

**改進點**：
1. **抽離雞肉專屬設定**：
   - 全部用 `{{VARIABLE}}` 標記
   - 提供 `template-config.yaml` 範本
2. **通用化文案**：
   - 移除雞肉相關的菜單名稱
   - 提供「餐飲業通用」版本
3. **知識庫範本化**：
   - 讓知識庫結構通用
   - 客戶只需填內容

**時程**：
- Phase 1：完成 SOP 標準化（本週）
- Phase 2：完成 Google Sheets 整合（2 週）
- Phase 3：完成儀錶板（1 週）
- Phase 4：多租戶抽離（2 週）

---

## 六、本次（Day）執行清單

1. ✅ 記錄實測結果到 PHASE1_PROGRESS.md
2. ⏳ 修 Bug #1（dateRule / timeSlotRule + prompt）
3. ⏳ 修 Bug #2（getNextOpenDate + 改進錯誤訊息 + prompt）
4. ⏳ 補測試（tests/date.test.js）
5. ⏳ 撰寫 SOP 標準化文件
6. ⏳ 更新 PHASE1_PROGRESS.md
7. ⏳ 撰寫 Phase 2 規劃文件
8. ⏳ 撰寫儀錶板規劃文件
9. ⏳ Git commit + 報告給 Hubert

---

_本檔案為滾動式更新，執行後會變成「已完成」狀態_
