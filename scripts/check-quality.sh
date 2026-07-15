#!/bin/bash
# scripts/check-quality.sh
# Session P0 建立的自動化品質檢查腳本
#
# 目的：
#   - 防止「一環遞迴」事故（C2 漏 commit 等）
#   - 執行 MEMORY.md §I 結構性變更 SOP 的自動化部分
#   - 整合 6 項及格標準（D12 決策）
#
# 檢查項目：
#   1. npm test 全綠
#   2. 0 個 hardcode（vs chicken.yaml）
#   3. 0 個 dead config（已定義但 src 未讀）
#   4. 6/13 + 6/16 真實訂單仍在
#   5. 兩位置 rsync 一致
#   6. git working tree 狀態
#   7. ESLint 0 errors
#   8. KB Source of Truth（Session X1-D 新增）
#
# 使用方式：
#   bash scripts/check-quality.sh           # 跑全部檢查
#   bash scripts/check-quality.sh --strict  # 警告也視為失敗
#
# 退出碼：
#   0 = 全部通過
#   1 = 有失敗項目
#   2 = 有警告（--strict 模式才視為失敗）

# 注意：不用 set -e，因為 grep/condition 的 exit code 會誤觸發
# 我們手動追蹤 FAIL_COUNT / WARN_COUNT

# ─────────────────────────────────────────
# 設定
# ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STRICT_MODE=false

if [ "$1" = "--strict" ]; then
  STRICT_MODE=true
fi

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0

# 顏色輸出（若終端支援）
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

section() {
  echo ""
  echo -e "${BLUE}── $1 ──${NC}"
}

cd "$PROJECT_ROOT"

# ─────────────────────────────────────────
# 檢查 1: npm test
# ─────────────────────────────────────────
section "Check 1/9: npm test"

if npm test > /tmp/npm-test-output.log 2>&1; then
  # 動態計算 npm test 實際跑的測試檔數（數行首的 ▶▶▶ 行數，排除 shell trace）
  test_count=$(grep -c '^▶▶▶' /tmp/npm-test-output.log)
  pass "npm test 全綠（${test_count} 個測試檔）"
else
  fail "npm test 失敗（看 /tmp/npm-test-output.log）"
  tail -20 /tmp/npm-test-output.log
fi

# ─────────────────────────────────────────
# 檢查 2: 0 個 hardcode
# ─────────────────────────────────────────
section "Check 2/9: Hardcode 檢查"

# Session D3-6 修整：原 check 只查 5 個特定檔案，造成 src/index.js:151 / src/states/confirming.js:61
# 的 hardcode 漏網。改為 grep -r 掃描所有 src/，避免「換檔案 hardcode」就檢查不到。
#
# 採用「具體值」檢查（23257030422、Willy0221、'三峽','鶯歌'），不用太泛的「> 1000」
# — 後者會誤判「旁邊的 1000ms timeout」、「cache TTL = 1000」等不相關程式碼。
#
# 排除 src/config.js（yaml 範例或測試數值會在該檔出現，但不視為 hardcode）。

HARDCODES_FOUND=0

# 銀行帳號 23257030422 — 應從 chicken.yaml 的 payment.transfer.account 讀
if grep -rE "23257030422" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" > /dev/null; then
  echo ""
  echo -e "${RED}✗ src/ 仍有 hardcode 銀行帳號 23257030422（應讀 payment.transfer.account）${NC}"
  grep -rnE "23257030422" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" | head -5
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# LINE Pay ID Willy0221 — 應從 chicken.yaml 的 payment.linepay.line_id 讀
if grep -rE "Willy0221" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" > /dev/null; then
  echo ""
  echo -e "${RED}✗ src/ 仍有 hardcode LINE Pay ID Willy0221（應讀 payment.linepay.line_id）${NC}"
  grep -rnE "Willy0221" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" | head -5
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 配送範圍 ['三峽','鶯歌'] — 應從 chicken.yaml 的 delivery.areas.allowed 讀
if grep -rE "'三峽'.*'鶯歌'|'鶯歌'.*'三峽'" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" > /dev/null; then
  echo ""
  echo -e "${RED}✗ src/ 仍有 hardcode 配送範圍 fallback（應讀 delivery.areas.allowed）${NC}"
  grep -rnE "'三峽'.*'鶯歌'|'鶯歌'.*'三峽'" src/ --include="*.js" 2>/dev/null | grep -v "src/config.js" | head -5
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 現金上限 totalAmount > 1000 — 應從 chicken.yaml 的 payment.cash.new_customer_max 讀
# 只匹配「totalAmount > 1000」這類型比對，不會誤判其他 1000
if grep -rE "totalAmount > 1000" src/ --include="*.js" 2>/dev/null > /dev/null; then
  echo ""
  echo -e "${RED}✗ src/ 仍有 hardcode 'totalAmount > 1000'（應讀 payment.cash.new_customer_max）${NC}"
  grep -rnE "totalAmount > 1000" src/ --include="*.js" 2>/dev/null | head -5
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 小菜免運門檻 sideSubtotal >= 350 — 應從 chicken.yaml 的 delivery.minimum_order.side_dish_ntd 讀
if grep -rE "sideSubtotal >= 350" src/ --include="*.js" 2>/dev/null > /dev/null; then
  echo ""
  echo -e "${RED}✗ src/ 仍有 hardcode 'sideSubtotal >= 350'（應讀 delivery.minimum_order.side_dish_ntd）${NC}"
  grep -rnE "sideSubtotal >= 350" src/ --include="*.js" 2>/dev/null | head -5
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

if [ $HARDCODES_FOUND -eq 0 ]; then
  pass "0 個已知 hardcode (grep -r 全 src/ 掃描)"
fi

# ─────────────────────────────────────────
# 檢查 3: 0 個 dead config
# ─────────────────────────────────────────
section "Check 3/9: Dead config 檢查"

# 從 CONFIG_VARIABLES_TABLE.md 整理的 dead config 旗標
# 注意：這些是「應該被讀取」的旗標，目前 src/ 完全沒有讀取它們
DEAD_CONFIGS_FOUND=0

for flag in "storage.phase1" "storage.phase2" "payment.cash.enabled" "payment.transfer.enabled" "payment.jko.enabled" "payment.linepay.enabled" "handoff.notify_owner.enabled" "official.line_pay.enabled" "security.input_sanitization"; do
  if ! grep -q "$flag" src/config.js 2>/dev/null; then
    warn "Dead config flag: $flag (chicken.yaml 有定義但 src/config.js 沒暴露 getter)"
    DEAD_CONFIGS_FOUND=$((DEAD_CONFIGS_FOUND + 1))
  fi
done

if [ $DEAD_CONFIGS_FOUND -eq 0 ]; then
  pass "0 個 dead config 旗標"
fi

# ─────────────────────────────────────────
# 檢查 4: 真實訂單仍在
# ─────────────────────────────────────────
section "Check 4/9: 真實訂單保護"

REAL_ORDERS_DIR="data/orders/chicken"
MISSING_ORDERS=0

for order_file in "2026-06-13.csv" "2026-06-16.csv"; do
  if [ ! -f "$REAL_ORDERS_DIR/$order_file" ]; then
    fail "真實訂單 $REAL_ORDERS_DIR/$order_file 不見了（git checkout HEAD -- 還原）"
    MISSING_ORDERS=$((MISSING_ORDERS + 1))
  fi
done

# 額外：git tracked 狀態檢查
for order_file in "2026-06-13.csv" "2026-06-16.csv"; do
  if ! git ls-files --error-unmatch "$REAL_ORDERS_DIR/$order_file" > /dev/null 2>&1; then
    fail "$REAL_ORDERS_DIR/$order_file 不在 git tracked 清單"
    MISSING_ORDERS=$((MISSING_ORDERS + 1))
  fi
done

if [ $MISSING_ORDERS -eq 0 ]; then
  pass "6/13 + 6/16 真實訂單完整（git tracked + 磁碟存在）"
fi

# ─────────────────────────────────────────
# 檢查 5: 兩位置 rsync 一致性
# ─────────────────────────────────────────
section "Check 5/9: 兩位置 rsync 一致性"

MAIN_LOCATION="/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service"

if [ ! -d "$MAIN_LOCATION" ]; then
  warn "主位置不存在：$MAIN_LOCATION（跳過 rsync 檢查）"
elif ! command -v rsync > /dev/null 2>&1; then
  warn "rsync 指令不存在（跳過）"
else
  # 用 rsync --dry-run 比較兩位置
  DIFF_OUTPUT=$(rsync -avn --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='dashboard.tmp.html' \
    "$PROJECT_ROOT/" "$MAIN_LOCATION/" 2>&1)

  if echo "$DIFF_OUTPUT" | grep -q "^[*]deleting\|^>f"; then
    warn "主位置有 5+ 個檔案會被 rsync 刪除（建議先看 dry-run）"
  else
    pass "兩位置 rsync 一致（無需刪除）"
  fi
fi

# ─────────────────────────────────────────
# 檢查 6: git working tree 狀態
# ─────────────────────────────────────────
section "Check 6/9: git working tree"

cd "$PROJECT_ROOT"

# 未提交變更
UNCOMMITTED=$(git status --short | wc -l)
if [ "$UNCOMMITTED" -eq 0 ]; then
  pass "working tree 乾淨（無未提交變更）"
else
  warn "working tree 有 $UNCOMMITTED 個未提交變更"
  git status --short | head -10
fi

# 未推送 commits
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l || echo "0")
if [ "$UNPUSHED" -eq 0 ]; then
  pass "無未推送 commits"
else
  warn "有 $UNPUSHED 個 commits 未推到 origin/main"
fi

# ─────────────────────────────────────────
# 檢查 7: ESLint 0 errors（Session G4 修整）
# ─────────────────────────────────────────
section "Check 7/9: ESLint 檢查"

# Session G4 修整：本地 check-quality.sh 也跑 lint，與 GitHub Actions 一致防漏網
# warning 不擋 CI（與 .eslintrc.json "rules" 設計一致）但 error 必擋

if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
  if LINT_OUTPUT=$(npm run lint 2>&1); then
    pass "npm run lint 0 errors（與 GitHub Actions 一致）"
  else
    fail "npm run lint 有 errors（push 會被 CI 擋，先修）"
    echo "$LINT_OUTPUT" | tail -10
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  warn "package.json 無 lint script（Session G 未執行）"
fi

# ─────────────────────────────────────────
# ─────────────────────────────────────────
# 檢查 8: KB Source of Truth 驗證（Session X1-D，2026-07-15 補回實作）
# 背景：原本 X1-D commit 3cd7e1f 寫「+ check-quality.sh Check 8」但只改 header 註解、
#       沒插實作，導致 verify-kb-sources.js 從未被任何 check 觸發。
# 範圍：12 個 KB 檔存在/非空/不重複/與 INDEX.md 一致/無 legacy duplicate
# 詳見：scripts/verify-kb-sources.js 內 4 個 sub-checks
# ─────────────────────────────────────────
section "Check 8/9: KB Source of Truth 驗證"

if [ -f "scripts/verify-kb-sources.js" ]; then
  if node scripts/verify-kb-sources.js > /tmp/verify-kb-output.log 2>&1; then
    pass "KB 12 檔案存在、內容不重複、與 INDEX.md 一致、無 legacy duplicate"
  else
    fail "KB Source of Truth 驗證失敗（看 /tmp/verify-kb-output.log）"
    cat /tmp/verify-kb-output.log
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  warn "scripts/verify-kb-sources.js 不存在（跳過）"
fi

# ─────────────────────────────────────────
# 檢查 9: config.yaml drift 預防 (Decision 2B + 2026-07-15)
# 目的：防止「改 chicken.yaml 後忘跑 sync-config.sh」
#       （依 Hubert 「系統要足夠完善」要求做多層檢查）
# 範圍：mtime + missing top-level keys + 檔案存在性
# 詳見：docs/adr/0003-config-legacy-fallback.md v2 §補充
# ─────────────────────────────────────────
section "Check 9/9: config.yaml drift 預防"

CHICKEN_CONFIG="$PROJECT_ROOT/config/tenants/chicken.yaml"
LEGACY_CONFIG="$PROJECT_ROOT/config.yaml"

if [ ! -f "$CHICKEN_CONFIG" ]; then
  warn "config/tenants/chicken.yaml 不存在（跳過 drift 檢查）"
elif [ ! -f "$LEGACY_CONFIG" ]; then
  warn "config.yaml 不存在（無 fallback 但 chicken.yaml 還在，OK）"
else
  DRIFT_FOUND=0

  # 1. mtime 檢查：config.yaml 必須 ≥ chicken.yaml（sync 後才允許 commit）
  CHICKEN_MTIME=$(stat -c %Y "$CHICKEN_CONFIG")
  LEGACY_MTIME=$(stat -c %Y "$LEGACY_CONFIG")
  if [ "$LEGACY_MTIME" -lt "$CHICKEN_MTIME" ]; then
    DELTA_MIN=$(( (CHICKEN_MTIME - LEGACY_MTIME) / 60 ))
    warn "config.yaml mtime 比 chicken.yaml 老 ${DELTA_MIN}分鐘 → 須跑: bash scripts/sync-config.sh"
    DRIFT_FOUND=1
  fi

  # 2. missing top-level keys 檢查：防 fallback 功能缺漏（如 tenant/delivery_fee 等）
  CHICKEN_KEYS=$(grep -oE "^[a-z_]+:" "$CHICKEN_CONFIG" | sort -u)
  LEGACY_KEYS=$(grep -oE "^[a-z_]+:" "$LEGACY_CONFIG" | sort -u)
  MISSING=$(comm -23 <(echo "$CHICKEN_KEYS") <(echo "$LEGACY_KEYS"))
  if [ -n "$MISSING" ]; then
    MISSING_LIST=$(echo "$MISSING" | tr '\n' ' ' | sed 's/ $//')
    warn "config.yaml 缺少 chicken.yaml 的 top-level keys: ${MISSING_LIST}"
    DRIFT_FOUND=1
  fi

  if [ "$DRIFT_FOUND" -eq 0 ]; then
    pass "config.yaml 與 chicken.yaml mtime + keys 皆同步"
  fi
fi

# ─────────────────────────────────────────

# 總結
# ─────────────────────────────────────────
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}品質檢查總結${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}通過${NC}: $PASS_COUNT"
echo -e "${YELLOW}警告${NC}: $WARN_COUNT"
echo -e "${RED}失敗${NC}: $FAIL_COUNT"

echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}✗ 品質檢查失敗${NC}（$FAIL_COUNT 項失敗）"
  echo ""
  echo "修復建議："
  echo "  - npm test 失敗：先修測試"
  echo "  - npm run lint 有 errors：先跑 npm run lint:fix 看是否能 auto-fix，否則手動修"
  echo "  - hardcode 失敗：依 docs/KNOWN_ISSUES.md F1~F4、Session D3 prompt 修整"
  echo "  - dead config 失敗：依 docs/KNOWN_ISSUES.md W1~W9、Session D4 prompt 修整"
  echo "  - 真實訂單消失：git checkout HEAD -- data/orders/chicken/"
  exit 1
fi

if [ $WARN_COUNT -gt 0 ] && [ "$STRICT_MODE" = true ]; then
  echo -e "${YELLOW}✗ 嚴格模式失敗${NC}（有 $WARN_COUNT 項警告）"
  exit 2
fi

if [ $WARN_COUNT -gt 0 ]; then
  echo -e "${YELLOW}⚠ 品質檢查通過（含 $WARN_COUNT 項警告，建議處理）${NC}"
else
  echo -e "${GREEN}✓ 品質檢查全部通過${NC}"
fi

exit 0
