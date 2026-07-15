#!/bin/bash
# check-cwd.sh — Pre-edit CWD guard
#
# 防止在 production 鏡像位置（main）誤編輯檔案
# 觸發場景：Session J 雙位置架構下，未來 session 容易 PWD 搞混
#
# 用法：
#   bash scripts/check-cwd.sh scripts/dashboard-server.js
#   bash scripts/check-cwd.sh /full/path/to/file force   # force 覆蓋警告
#
# 退出代碼：
#   0 = 在安全位置（dev repo 或其他位置）
#   1 = 在 main 位置（危險；除非 force，否則 block）
#
# 整合建議：
#   1. 加入 Claude Code settings.json hooks.PreToolUse → 任何 Edit/Write 都先跑此 script
#   2. 加入 pre-commit hook：`bash scripts/check-cwd.sh $(git diff --name-only --cached)`
#   3. 加入 CI：`bash scripts/check-cwd.sh $(git diff --name-only origin/main..HEAD)`

set -e

FILE_PATH="${1:?Usage: $0 <file> [force]

範例：
  $0 scripts/dashboard-server.js
  $0 /full/path/to/file.js force
}"

DEV_REPO="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"
MAIN_LOC="/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service"

# 解析絕對路徑（realpath 可解析相對路徑與 symlink）
ABS=$(realpath "$FILE_PATH" 2>/dev/null || echo "$(pwd)/$FILE_PATH")

# 判斷是否在 main 位置
if [[ "$ABS" == "$MAIN_LOC"* ]]; then
  echo "❌ 警告：嘗試在 main（production 鏡像）位置編輯"
  echo "   檔案：$ABS"
  echo ""
  echo "正確做法（永遠）："
  echo "  1. cd $DEV_REPO"
  echo "  2. 在 dev 編輯 + 跑 bash scripts/check-quality.sh"
  echo "  3. git commit + git push"
  echo "  4. 同步 main: cd $DEV_REPO && bash scripts/sync-mirror.sh from-legacy"
  echo ""
  if [ "${2:-}" = "force" ]; then
    echo "⚠️  force 模式覆寫，繼續（下次請避免 — 透過 Check 10 仍會持續監測 drift）"
    exit 0
  fi
  exit 1
fi

# dev repo 內則鼓勵通過（最低成本路徑）
if [[ "$ABS" == "$DEV_REPO"* ]]; then
  echo "✓ 編輯位置：dev repo"
  exit 0
fi

# 其他位置（如 /tmp/）OK 但提醒
echo "⚠️  編輯位置不在標準 dev repo 或 main 鏡像"
echo "   檔案：$ABS"
echo "   標準編輯位置：$DEV_REPO"
exit 0
