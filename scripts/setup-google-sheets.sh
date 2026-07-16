#!/bin/bash
# scripts/setup-google-sheets.sh
# P9：Google Sheets OAuth setup helper（2026-07-16 加）
#
# 目的：用 clawbrt@gmail.com 建立 Google Cloud project + service account
#       取得 JSON key file → 放到 /home/clawuser/.config/chicken/secrets/google-service-account.json
#
# 使用：bash scripts/setup-google-sheets.sh

set -e

CREDS_FILE="/home/clawuser/.config/chicken/secrets/google-service-account.json"
CHICKEN_YAML="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/config/tenants/chicken.yaml"

echo "=== P9 Google Sheets OAuth Setup ==="
echo ""
echo "⚠️  本腳本只能做準備 + 驗證。Google Cloud project / service account 需要在 browser 手動建立。"
echo ""

# ============================================================================
# Step 1: 確認 credentials 目錄存在
# ============================================================================
mkdir -p "$(dirname "$CREDS_FILE")"
chmod 700 "$(dirname "$CREDS_FILE")"

# ============================================================================
# Step 2: 檢查 credentials 是否已存在
# ============================================================================
if [ -f "$CREDS_FILE" ]; then
    echo "✅ Service account JSON 已存在：$CREDS_FILE"
    echo ""
    echo "Service account email:"
    python3 -c "import json; d = json.load(open('$CREDS_FILE')); print('  ' + d.get('client_email', 'MISSING'))" 2>/dev/null || echo "  (無法解析 JSON，請確認格式)"
    echo ""
else
    echo "❌ Service account JSON 不存在：$CREDS_FILE"
    echo ""
    echo "請依下列步驟在 browser 設定（用 clawbrt@gmail.com 登入）："
    echo ""
    echo "=== Browser 操作步驟 ==="
    echo ""
    echo "Step 1: 建立 Google Cloud Project"
    echo "  1. 開啟 https://console.cloud.google.com/"
    echo "  2. 確認登入帳號是 clawbrt@gmail.com（不是 kaden1122123@gmail.com）"
    echo "  3. 點左上角專案下拉 → New Project"
    echo "  4. Project name: chicken-customer-service-sheets"
    echo "  5. Location: 選一個 organization（沒有就 No organization）"
    echo "  6. 建立"
    echo ""
    echo "Step 2: 啟用 Google Sheets API"
    echo "  1. 左選單 → APIs & Services → Library"
    echo "  2. 搜尋 'Google Sheets API'"
    echo "  3. 點進去 → Enable"
    echo ""
    echo "Step 3: 建立 Service Account"
    echo "  1. 左選單 → APIs & Services → Credentials"
    echo "  2. Create Credentials → Service Account"
    echo "  3. Service account name: chicken-sheets-sync"
    echo "  4. Service account ID: 自動產生（例如 chicken-sheets-sync@...）"
    echo "  5. Skip optional steps → Done"
    echo ""
    echo "Step 4: 下載 JSON key"
    echo "  1. 點剛才建立的 service account → Keys 頁籤"
    echo "  2. Add Key → Create new key → JSON"
    echo "  3. 下載的 JSON file 重新命名為 google-service-account.json"
    echo "  4. mv 到 $CREDS_FILE"
    echo "  5. chmod 600 $CREDS_FILE"
    echo ""
    echo "Step 5: 建立 Google Sheets + 分享給 service account"
    echo "  1. 開 https://sheets.google.com/（確認登入 clawbrt@gmail.com）"
    echo "  2. 建立新試算表，名稱 '雞味客服訂單'"
    echo "  3. 從 URL 複製 spreadsheet_id（例：https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit）"
    echo "  4. Share → 加入 service account email（從 Step 3 拿）為 Editor"
    echo ""
    echo "Step 6: 更新 chicken.yaml"
    echo "  編輯 $CHICKEN_YAML"
    echo "  storage:"
    echo "    phase2:"
    echo "      enabled: true  # 改 true"
    echo "      spreadsheet_id: '<從 Step 5 URL 複製>'"
    echo ""
    echo "Step 7: 跑 sync 測試"
    echo "  cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"
    echo "  node -e \"const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets({dryRun:true}).then(r => console.log(JSON.stringify(r, null, 2)));\""
    echo ""
    echo "Step 8: 啟用 + 測試實際 sync"
    echo "  node -e \"const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets().then(r => console.log(JSON.stringify(r, null, 2)));\""
    echo ""
    exit 1
fi

# ============================================================================
# Step 3: 驗證 JSON 結構
# ============================================================================
echo "=== 驗證 service account JSON 結構 ==="

REQUIRED_FIELDS=("client_email" "private_key" "project_id" "type")
MISSING=()

for field in "${REQUIRED_FIELDS[@]}"; do
    value=$(python3 -c "import json; d = json.load(open('$CREDS_FILE')); print(d.get('$field', ''))" 2>/dev/null)
    if [ -z "$value" ]; then
        MISSING+=("$field")
    else
        case "$field" in
            "client_email")
                echo "  ✓ client_email: $value"
                ;;
            "type")
                echo "  ✓ type: $value"
                ;;
            "project_id")
                echo "  ✓ project_id: $value"
                ;;
            "private_key")
                echo "  ✓ private_key: ${value:0:50}... (truncated)"
                ;;
        esac
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "❌ JSON 缺少必要欄位：${MISSING[*]}"
    echo "   請重新下載 service account JSON key"
    exit 1
fi

# ============================================================================
# Step 4: 驗證 chicken.yaml 配置
# ============================================================================
echo ""
echo "=== 驗證 chicken.yaml 配置 ==="

SPREADSHEET_ID=$(grep -A 10 "phase2:" "$CHICKEN_YAML" | grep "spreadsheet_id:" | awk '{print $2}' | tr -d "'\"")
PHASE2_ENABLED=$(grep -A 10 "phase2:" "$CHICKEN_YAML" | grep "enabled:" | head -1 | awk '{print $2}')

if [ -z "$SPREADSHEET_ID" ] || [ "$SPREADSHEET_ID" = "" ]; then
    echo "❌ storage.phase2.spreadsheet_id 未設定"
    echo "   請在 $CHICKEN_YAML 填入 Google Sheets ID（從 spreadsheet URL 複製）"
    exit 1
fi
echo "  ✓ spreadsheet_id: $SPREADSHEET_ID"

if [ "$PHASE2_ENABLED" != "true" ]; then
    echo "⚠️  storage.phase2.enabled = $PHASE2_ENABLED（請改為 true）"
else
    echo "  ✓ phase2.enabled: true"
fi

# ============================================================================
# Step 5: 測試 OAuth token 取得（不實際呼叫 Sheets API）
# ============================================================================
echo ""
echo "=== 測試 OAuth token 取得（dry-run）==="

cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node -e "
const { getAccessToken } = require('./src/storage/sheetsSync');
const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('$CREDS_FILE', 'utf8'));
getAccessToken(creds)
  .then(token => {
    console.log('✅ Access token 取得成功');
    console.log('   Token length:', token.length, 'chars');
    console.log('   Token preview:', token.substring(0, 20) + '...');
  })
  .catch(err => {
    console.error('❌ Token 取得失敗：', err.message);
    process.exit(1);
  });
"

echo ""
echo "=== Setup 完成 ==="
echo ""
echo "下一步："
echo "  1. 確認 chicken.yaml storage.phase2.enabled = true"
echo "  2. 跑 dry-run 測試："
echo "     node -e \"const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets({dryRun:true}).then(r => console.log(JSON.stringify(r, null, 2)));\""
echo "  3. 跑實際 sync："
echo "     node -e \"const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets().then(r => console.log(JSON.stringify(r, null, 2)));\""
