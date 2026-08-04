#!/bin/bash
# scripts/run-tests.sh — Round 37 (Hubert 2026-08-03 21:19)
# 用途：npm test 入口，設定 NODE_ENV=test 確保所有測試不寄真實信件
# 防護：src/handoff/notifier.js + emailNotifier.js 都有 NODE_ENV guard
#
# Round 37.2：自動掃描 tests/*.test.js，跑完全部 + 累積 fail（不因一個 fail 就中斷）

export NODE_ENV=test
export CHICKEN_TEST_NO_SEND=1

# 自動抓所有 .test.js
TEST_FILES=$(find tests -maxdepth 1 -name "*.test.js" -type f | sort)

if [ -z "$TEST_FILES" ]; then
  echo "❌ 找不到任何 tests/*.test.js"
  exit 1
fi

COUNT=$(echo "$TEST_FILES" | wc -l)
echo "🧪 預備跑 $COUNT 個測試檔（NODE_ENV=test, 0 封真實信件）"

PASS_FILES=()
FAIL_FILES=()

for f in $TEST_FILES; do
  echo "▶▶▶ $f ◀◀◀"
  if node "$f" > /tmp/run-tests-r37-last.log 2>&1; then
    PASS_FILES+=("$f")
  else
    FAIL_FILES+=("$f")
    echo "❌ FAIL: $f"
    tail -5 /tmp/run-tests-r37-last.log | sed 's/^/    /'
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 測試結果彙總（Round 37）"
echo "═══════════════════════════════════════════════════════════"
echo "跑過:     $COUNT 個測試檔"
echo "通過:     ${#PASS_FILES[@]} 個"
echo "失敗:     ${#FAIL_FILES[@]} 個"

if [ ${#FAIL_FILES[@]} -gt 0 ]; then
  echo ""
  echo "❌ 失敗清單："
  for f in "${FAIL_FILES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "查看細節：cat /tmp/run-tests-r37-last.log（最後一個失敗）"
  exit 1
fi

echo ""
echo "✅ All $COUNT test files passed (NODE_ENV=test, 0 封真實信件)"