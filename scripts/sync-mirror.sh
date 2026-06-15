#!/bin/bash
# sync-mirror.sh
# 同步雞肉專案兩個鏡像位置

set -e

PRIMARY=/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service
LEGACY=/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

if [ "$1" = "from-primary" ]; then
  echo "同步：主位置 → 原位置"
  rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='dashboard.tmp.html' \
    "$PRIMARY/" "$LEGACY/"
elif [ "$1" = "from-legacy" ]; then
  echo "同步：原位置 → 主位置"
  rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='dashboard.tmp.html' \
    "$LEGACY/" "$PRIMARY/"
else
  echo "用法: $0 [from-primary|from-legacy]"
  echo "  from-primary: 從主位置（external-user workspace）同步到原位置（openclaw-workspace）"
  echo "  from-legacy:  從原位置同步到主位置"
  exit 1
fi
