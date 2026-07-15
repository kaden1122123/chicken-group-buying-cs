#!/bin/bash
# main-enforce-readonly.sh — 自動 enforce main 鏡像位置為 read+execute only
#
# 觸發：openclaw cron（建議每 10 分鐘，跟 dashboard-watchdog 同週期）
# 用法：bash scripts/main-enforce-readonly.sh [--audit-only]
#
# 用途：即使 agent 想繞過 check-cwd.sh + Check 10，這個 watchdog 會自動
#       把 main 的 critical files 重新加 chmod 555（物理擋寫入）。
#
# 為什麼不 chattr +i：非 root 在 Linux ext4 不能設 immutable bit。
# chmod 555 對 owner 也生效（user 不能寫）— 對我們需求足夠強。

set -e

MAIN="/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service"
AUDIT_ONLY=false
[ "${1:-}" = "--audit-only" ] && AUDIT_ONLY=true

# Critical paths：永遠 read+execute only for owner (clamp 555)
PROTECTED=(
  "$MAIN/scripts/dashboard-server.js"
  "$MAIN/scripts/api-server.js"
  "$MAIN/scripts/check-quality.sh"
  "$MAIN/scripts/check-cwd.sh"
  "$MAIN/scripts/manage-tunnel.sh"
)

FOUND_DRIFT=0
LOG=""

for f in "${PROTECTED[@]}"; do
  if [ ! -f "$f" ]; then continue; fi
  PERM=$(stat -c '%a' "$f" 2>/dev/null)
  if [ "$PERM" != "555" ]; then
    LOG="$LOG  DRIFT: $f (perms=$PERM, expected 555)\n"
    FOUND_DRIFT=1
    if [ "$AUDIT_ONLY" = false ]; then
      chmod 555 "$f" 2>/dev/null
    fi
  fi
done

# src/ 整個 + docs/（recursive 555）
for d in "$MAIN/src" "$MAIN/docs"; do
  if [ ! -d "$d" ]; then continue; fi
  # 用 find 看任一檔案，如果不是 555 算 drift
  NON_555=$(find "$d" -type f ! -perm 555 2>/dev/null | head -1)
  if [ -n "$NON_555" ]; then
    LOG="$LOG  DRIFT: $d (not all files are 555, e.g. $NON_555)\n"
    FOUND_DRIFT=1
    if [ "$AUDIT_ONLY" = false ]; then
      chmod -R 555 "$d" 2>/dev/null
    fi
  fi
done

if [ $FOUND_DRIFT -eq 0 ]; then
  echo "✓ main immutable OK (all critical files chmod 555)"
  exit 0
else
  if [ "$AUDIT_ONLY" = true ]; then
    echo "⚠ Audit: drift detected"
  else
    echo "⚠ Auto-reverted drift:"
    printf "$LOG"
  fi
  exit 1
fi
