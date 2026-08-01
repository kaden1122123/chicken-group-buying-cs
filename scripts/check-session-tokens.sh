#!/bin/bash
# scripts/check-session-tokens.sh
# Round 34+ (2026-08-01 21:13 Hubert) — 估算當前 session token 用量
#
# 目的：
#   - 在 session 中間主動估算 token 用量
#   - 達到閾值時提醒 Hubert/brtclaw 結束 session
#   - 避免 context window 爆掉
#
# 估算策略：
#   - 統計目前 session 內 LLM 互動的 tokens（粗估）
#   - 統計 memory + docs 檔案大小（這些是 LLM 已知 context）
#   - 統計 git tracked 檔案大小（這些是 LLM 可能讀取）
#   - 顯示百分比（基於 M3 200K 上限）
#
# 使用：
#   bash scripts/check-session-tokens.sh           # 顯示當前用量
#   bash scripts/check-session-tokens.sh --warn     # 超過警告閾值顯示警告
#   bash scripts/check-session-tokens.sh --strict   # 顯示建議 end session 的時機

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Model context window 設定
MODEL_NAME="${MODEL_NAME:-MiniMax-M3}"
MODEL_LIMIT=1000000      # 1M tokens（M3 實際上限，Hubert 21:57 確認）
WARN_PCT=60              # 60% = 600K tokens
CAUTION_PCT=70           # 70% = 700K tokens
CRITICAL_PCT=80          # 80% = 800K tokens

cd "$PROJECT_ROOT"

# === 估算 session token 用量 ===
# 公式（粗估）：每 4 bytes ≈ 1 token（英文）/ 每 1.5 bytes ≈ 1 token（中英文混合）
# 此處用簡單估算：bytes / 4

# 1. memory 檔案（system-level 給 LLM 載入）
MEMORY_BYTES=0
if [ -f "/home/clawuser/.openclaw/workspace/memory/2026-08-01.md" ]; then
  MEMORY_BYTES=$(stat -c %s "/home/clawuser/.openclaw/workspace/memory/2026-08-01.md")
fi
if [ -d "/home/clawuser/.openclaw/workspace/memory" ]; then
  MEMORY_BYTES=$(find /home/clawuser/.openclaw/workspace/memory -name "*.md" -type f 2>/dev/null | xargs cat 2>/dev/null | wc -c)
fi

# 2. chicken repo git tracked 檔案（LLM 可能讀取）
GIT_BYTES=$(git ls-files 2>/dev/null | xargs cat 2>/dev/null | wc -c)

# 3. session 累積對話估算（粗估 4 bytes/token）
# 此值由 OpenClaw runtime 自動計算，這裡給 fallback
SESSION_TOKENS="${SESSION_TOKENS:-50000}"  # 假設已用 50K（M3 平均 session）

# === 計算百分比 ===
# 主要 context = session tokens（最重要，因為包含整段對話）
PRIMARY_PCT=$(( SESSION_TOKENS * 100 / MODEL_LIMIT ))

# total 估算（含 memory + git tracked）
TOTAL_TOKENS=$(( SESSION_TOKENS + MEMORY_BYTES / 4 + GIT_BYTES / 16 ))
TOTAL_PCT=$(( TOTAL_TOKENS * 100 / MODEL_LIMIT ))

echo "=== Session Token 用量估算 ==="
echo "Model: $MODEL_NAME"
echo "Context window: $MODEL_LIMIT tokens (1M，Hubert 21:57 確認)"
echo ""
echo "當前 session: $SESSION_TOKENS tokens ($PRIMARY_PCT%)"
echo "Memory 載入: $MEMORY_BYTES bytes (~$(( MEMORY_BYTES / 4 )) tokens)"
echo "Git tracked: $GIT_BYTES bytes (~$(( GIT_BYTES / 16 )) tokens，因為不是全部載入)"
echo "Total estimate: ~$TOTAL_TOKENS tokens ($TOTAL_PCT%)"
echo ""

# === 警告判斷 ===
if [ $PRIMARY_PCT -ge $CRITICAL_PCT ]; then
  echo "🔴 CRITICAL: session 已用 $PRIMARY_PCT% context"
  echo "   強烈建議：立即跑 session-end SOP（防止 context 爆）"
  WARN_LEVEL="critical"
elif [ $PRIMARY_PCT -ge $CAUTION_PCT ]; then
  echo "🟡 CAUTION: session 已用 $PRIMARY_PCT% context"
  echo "   建議：下次 commit 後跑 session-end SOP"
  WARN_LEVEL="caution"
elif [ $PRIMARY_PCT -ge $WARN_PCT ]; then
  echo "🟢 OK: session 已用 $PRIMARY_PCT% context（60% 警戒線下）"
  echo "   提醒：留意後續文件讀取量"
  WARN_LEVEL="ok"
else
  echo "✓ 正常: session 已用 $PRIMARY_PCT% context"
  WARN_LEVEL="normal"
fi

echo ""
echo "=== 判斷閾值（M3 1M context）==="
echo "  警戒線: $WARN_PCT% (= $(( MODEL_LIMIT * WARN_PCT / 100 )) tokens)"
echo "  注意線: $CAUTION_PCT% (= $(( MODEL_LIMIT * CAUTION_PCT / 100 )) tokens)"
echo "  危急線: $CRITICAL_PCT% (= $(( MODEL_LIMIT * CRITICAL_PCT / 100 )) tokens)"
echo "  M3 model 1M context = $(( MODEL_LIMIT * 4 )) bytes（粗估）"

# === 詳細建議 ===
case "$WARN_LEVEL" in
  critical)
    echo "🚨 建議立即動作："
    echo "  1. 跑 SESSION_END_SOP.md 7 步 SOP（見 docs/SESSION_END_SOP.md）"
    echo "  2. commit + push 已完成的工作"
    echo "  3. 寫下次 session 第一件事（避免重複探索）"
    echo "  4. 開新 session 重新開始"
    ;;
  caution)
    echo "⚠️  建議："
    echo "  - 下次 commit 完成就 end session"
    echo "  - 避免再讀大型檔案（注意 INDEX.md / PROJECT_INVENTORY.md）"
    ;;
  ok)
    echo "ℹ️  仍可繼續工作"
    ;;
esac

exit 0
