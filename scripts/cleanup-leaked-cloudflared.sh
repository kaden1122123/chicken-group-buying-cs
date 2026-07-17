#!/bin/bash
# cleanup-leaked-cloudflared.sh — 清理 dashboard 測試遺留的 leaked cloudflared processes
# 2026-07-18 Session P0 v7：Hubert 04:55 反饋「89 cloudflared leaked processes 清理預防」

# 問題背景（prompt §P2 第 6 項）：
# - dashboard 測試用 `cloudflared tunnel --url http://localhost:3000` 累計 47-89 個 leaked processes
# - 根因：Cloudflare Quick Tunnel 有 TTL 但仍殘留
# - 解法：dashboard watchdog 應加 stale process cleanup（>1hr 自動 kill）

# 保護規則：
# - PID 1543 是 long-running OpenClaw external-user agent tunnel（--token ***），**不要殺**
# - 命名 tunnel（--token ***）不算 leaked，不殺
# - 只殺 quick tunnel（--url http://localhost:3000）且啟動 > 1hr 的

MAX_AGE_SECONDS=3600  # 1 小時（cloudflared quick tunnel 正常連線時間約 10-30 分鐘，>1hr 一定是 leaked）
PROTECTED_PIDS=(1543)  # long-running OpenClaw external-user agent tunnel（--token ***）

LOG="${LOG:-/home/clawuser/.openclaw/dashboard-watchdog.log}"

killed_count=0
skipped_count=0
protected_count=0
total_count=0

# 找出所有 cloudflared quick tunnel processes
while IFS=$'\t' read -r pid etime cmd; do
  [ -z "$pid" ] && continue
  total_count=$((total_count + 1))
  
  # 保護清單檢查
  is_protected=false
  for protected_pid in "${PROTECTED_PIDS[@]}"; do
    if [ "$pid" = "$protected_pid" ]; then
      protected_count=$((protected_count + 1))
      is_protected=true
      break
    fi
  done
  if [ "$is_protected" = true ]; then
    continue
  fi
  
  # 命名 tunnel（--token）跳過 — 只殺 quick tunnel（--url）
  if echo "$cmd" | grep -q -- "--token"; then
    skipped_count=$((skipped_count + 1))
    continue
  fi
  if ! echo "$cmd" | grep -q -- "--url http://localhost:3000"; then
    skipped_count=$((skipped_count + 1))
    continue
  fi
  
  # 解析 etime（格式：[[DD-]HH:]MM:SS）
  age_seconds=0
  if [[ "$etime" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
    # DD-HH:MM:SS
    age_seconds=$(( ${BASH_REMATCH[1]}*86400 + ${BASH_REMATCH[2]}*3600 + ${BASH_REMATCH[3]}*60 + ${BASH_REMATCH[4]} ))
  elif [[ "$etime" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
    # HH:MM:SS
    age_seconds=$(( ${BASH_REMATCH[1]}*3600 + ${BASH_REMATCH[2]}*60 + ${BASH_REMATCH[3]} ))
  elif [[ "$etime" =~ ^([0-9]+):([0-9]+)$ ]]; then
    # MM:SS
    age_seconds=$(( ${BASH_REMATCH[1]}*60 + ${BASH_REMATCH[2]} ))
  elif [[ "$etime" =~ ^([0-9]+)$ ]]; then
    # SS
    age_seconds=${BASH_REMATCH[1]}
  fi
  
  # 太老（>1hr）→ kill
  if [ "$age_seconds" -gt "$MAX_AGE_SECONDS" ]; then
    kill "$pid" 2>/dev/null
    if [ $? -eq 0 ]; then
      killed_count=$((killed_count + 1))
    fi
  fi
done < <(ps -eo pid,etime,args | grep "cloudflared tunnel" | grep -v grep | awk -F' ' '{printf "%s\t%s\t", $1, $2; for(i=3;i<=NF;i++) printf "%s ", $i; printf "\n"}')

# Log 結果
if [ "$killed_count" -gt 0 ]; then
  echo "[cleanup-cloudflared] $(date -Iseconds) 殺掉 $killed_count 個 leaked processes（>$MAX_AGE_SECONDS s），保護 $protected_count 個 PID（${PROTECTED_PIDS[*]}），跳過 $skipped_count 個非 quick tunnel" >> "$LOG"
fi

# 主動輸出（給 cron log 或手動跑用）
if [ "${VERBOSE:-0}" = "1" ]; then
  echo "[cleanup-cloudflared] 總計 $total_count / 殺 $killed_count / 保護 $protected_count / 跳過 $skipped_count"
fi

# Exit code: 0 = 正常（沒殺也算正常），1 = 有錯誤
exit 0
