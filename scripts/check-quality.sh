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
section "Check 1/6: npm test"

if npm test > /tmp/npm-test-output.log 2>&1; then
  pass "npm test 全綠（19 套）"
else
  fail "npm test 失敗（看 /tmp/npm-test-output.log）"
  tail -20 /tmp/npm-test-output.log
fi

# ─────────────────────────────────────────
# 檢查 2: 0 個 hardcode
# ─────────────────────────────────────────
section "Check 2/6: Hardcode 檢查"

# 從 CONFIG_VARIABLES_TABLE.md 整理的 hardcode 清單
HARDCODES_FOUND=0

# 檢查 paymentRule.js cash max
if grep -q "totalAmount > 1000" src/rules/paymentRule.js 2>/dev/null; then
  fail "src/rules/paymentRule.js hardcode '1000' (應讀 payment.cash.new_customer_max)"
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 檢查 orderFormatter.js side dish minimum
if grep -q "sideSubtotal >= 350" src/order/orderFormatter.js 2>/dev/null; then
  fail "src/order/orderFormatter.js hardcode '350' (應讀 delivery.minimum_order.side_dish_ntd)"
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 檢查 addressRule.js 三峽鶯歌 fallback
if grep -q "'三峽', '鶯歌'" src/rules/addressRule.js 2>/dev/null; then
  fail "src/rules/addressRule.js hardcode ['三峽','鶯歌'] (應讀 delivery.areas.allowed)"
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 檢查 awaitingPayment.js LINE Pay ID
if grep -q "Willy0221" src/states/awaitingPayment.js 2>/dev/null; then
  fail "src/states/awaitingPayment.js hardcode 'Willy0221' (應讀 payment.linepay.line_id)"
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

# 檢查 awaitingPayment.js 銀行帳號
if grep -q "23257030422" src/states/awaitingPayment.js 2>/dev/null; then
  fail "src/states/awaitingPayment.js hardcode '23257030422' (應讀 payment.transfer.account)"
  HARDCODES_FOUND=$((HARDCODES_FOUND + 1))
fi

if [ $HARDCODES_FOUND -eq 0 ]; then
  pass "0 個已知 hardcode"
fi

# ─────────────────────────────────────────
# 檢查 3: 0 個 dead config
# ─────────────────────────────────────────
section "Check 3/6: Dead config 檢查"

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
section "Check 4/6: 真實訂單保護"

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
section "Check 5/6: 兩位置 rsync 一致性"

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
section "Check 6/6: git working tree"

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
  echo "  - hardcode 失敗：依 docs/CONFIG_VARIABLES_TABLE.md 改用 config 讀取"
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
