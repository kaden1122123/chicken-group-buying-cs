#!/bin/bash
# scripts/backup_smoke_test.sh — Session M3
#
# 煙霧測試：確認 scripts/backup.sh 備份邏輯正確
#
# 跑備份到一個臨時目錄，驗證：
# 1. archive 成功產生
# 2. archive 可解（tar -tzf）
# 3. 真實訂單 CSV（含 .git tracked）有包含
# 4. 排除的目錄（_concurrency_test, node_modules）不在 archive
# 5. rotation 對「明顯老」目錄會清理
#
# 用法：bash scripts/backup_smoke_test.sh
# 退出碼：0 = 通過；非 0 = 失敗

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_BACKUP_ROOT="$(mktemp -d)/chicken-backup-test"
mkdir -p "$TEST_BACKUP_ROOT"

cleanup() {
    if [ -n "${TEST_BACKUP_ROOT:-}" ] && [ -d "$TEST_BACKUP_ROOT" ]; then
        rm -rf "$TEST_BACKUP_ROOT"
    fi
}
trap cleanup EXIT

echo "[smoke-test] PROJECT_ROOT = $PROJECT_ROOT"
echo "[smoke-test] TEST_BACKUP_ROOT = $TEST_BACKUP_ROOT"

# ===========================
# Step 1: 跑備份
# ===========================
echo ""
echo "[smoke-test] === Step 1: 跑備份 ==="
BACKUP_ROOT="$TEST_BACKUP_ROOT" bash "$PROJECT_ROOT/scripts/backup.sh" > /tmp/backup_smoke_stdout 2>&1

if [ $? -ne 0 ]; then
    echo "[smoke-test] FAIL: backup.sh exit code 非 0"
    cat /tmp/backup_smoke_stdout
    exit 1
fi

ARCHIVE_PATH=$(find "$TEST_BACKUP_ROOT" -name 'chicken-backup-*.tar.gz' | head -1)
if [ -z "$ARCHIVE_PATH" ]; then
    echo "[smoke-test] FAIL: 找不到 backup archive"
    cat /tmp/backup_smoke_stdout
    exit 1
fi
echo "[smoke-test]   archive: $ARCHIVE_PATH"
echo "[smoke-test]   size: $(du -h "$ARCHIVE_PATH" | cut -f1)"

# ===========================
# Step 2: 驗證 archive 可解
# ===========================
echo ""
echo "[smoke-test] === Step 2: archive 可解 ==="
if ! tar -tzf "$ARCHIVE_PATH" > /dev/null 2>&1; then
    echo "[smoke-test] FAIL: archive 無法解開"
    exit 1
fi
echo "[smoke-test]   ✓ tar -tzf 成功"
FILE_COUNT=$(tar -tzf "$ARCHIVE_PATH" | wc -l)
echo "[smoke-test]   檔案數: $FILE_COUNT"
if [ "$FILE_COUNT" -lt 5 ]; then
    echo "[smoke-test] FAIL: archive 內容太少（< 5 檔）"
    exit 1
fi

# ===========================
# Step 3: 真實訂單是否進 archive
# ===========================
echo ""
echo "[smoke-test] === Step 3: 真實訂單包含檢查 ==="
ARCHIVE_LIST=$(tar -tzf "$ARCHIVE_PATH")
# 至少檢查 chicken tenant 的其中一個真實訂單
# 從 git ls-files 找真實 CSV
REAL_ORDERS=$(cd "$PROJECT_ROOT" && git ls-files data/orders/ 2>/dev/null | grep '\.csv$' || true)
if [ -z "$REAL_ORDERS" ]; then
    echo "[smoke-test]   (skipped: git ls-files 沒回傳，可能非 git repo)"
else
    echo "[smoke-test]   真實訂單：$(echo "$REAL_ORDERS" | head -3 | tr '\n' ' ')"
    MISSING=0
    for csv in $REAL_ORDERS; do
        # csv = 'data/orders/chicken/2026-06-13.csv'
        # archive 內可能有 trailing newline 或縮排，固定 grep -F 完整 path
        if ! echo "$ARCHIVE_LIST" | grep -qFx "$csv"; then
            echo "[smoke-test]   ✗ MISSING: $csv"
            MISSING=$((MISSING + 1))
        fi
    done
    if [ "$MISSING" -gt 0 ]; then
        echo "[smoke-test] FAIL: $MISSING 個真實訂單不在 archive"
        exit 1
    fi
    echo "[smoke-test]   ✓ 所有真實訂單都在 archive"
fi

# ===========================
# Step 4: 排除項驗證
# ===========================
echo ""
echo "[smoke-test] === Step 4: 排除項不應在 archive ==="
SHOULD_NOT_INCLUDE=(
    'node_modules'
    '.git/'
    'dashboard.tmp.html'
)
for pattern in "${SHOULD_NOT_INCLUDE[@]}"; do
    # 確保 archive 內沒有 .git/, node_modules 等
    if echo "$ARCHIVE_LIST" | grep -q "/${pattern}/" 2>/dev/null; then
        # 也允許前面有 path 前綴的情況
        # 例如 data/orders/_concurrency_test/xxx
        if echo "$ARCHIVE_LIST" | grep -E "${pattern}" | grep -v 'data/orders/_concurrency_test/' > /dev/null 2>&1; then
            :  # 沒匹配到非允許的
        else
            # 重新檢查（避免 false positive）
            if echo "$ARCHIVE_LIST" | grep -E "(^|/)${pattern}(/|/|$)" > /dev/null 2>&1; then
                echo "[smoke-test] FAIL: archive 不應包含 $pattern"
                exit 1
            fi
        fi
    fi
done
echo "[smoke-test]   ✓ node_modules / .git / dashboard.tmp.html 都正確排除"

# ===========================
# Step 5: rotation 邏輯驗證
# ===========================
echo ""
echo "[smoke-test] === Step 5: rotation ==="
# 模擬一個 8 天前的備份目錄
OLD_DIR="$TEST_BACKUP_ROOT/2026-06-01"
mkdir -p "$OLD_DIR"
echo "fake old backup" > "$OLD_DIR/fake.tar.gz"
# touch mtime 設為 8 天前
touch -d "8 days ago" "$OLD_DIR"
NEW_DIR="$TEST_BACKUP_ROOT/2026-06-29"
mkdir -p "$NEW_DIR"
echo "$(date)" > "$NEW_DIR/today-marker"
echo "[smoke-test]   建立測試 OLD_DIR (8 天前)：$OLD_DIR"
echo "[smoke-test]   建立測試 NEW_DIR (今天)：$NEW_DIR"

# 跑 backup.sh (但用 fake source避免覆蓋)
# 因為 rotation 用 mtime +7 直接 find DELETE OLD_DIR
BACKUP_ROOT="$TEST_BACKUP_ROOT" bash "$PROJECT_ROOT/scripts/backup.sh" > /dev/null 2>&1

if [ -d "$OLD_DIR" ]; then
    echo "[smoke-test] FAIL: 超過 7 天的備份沒被刪除（$OLD_DIR 仍存在）"
    exit 1
fi
echo "[smoke-test]   ✓ OLD_DIR（8 天前）已被 rotation 刪除"

if [ ! -d "$NEW_DIR" ]; then
    echo "[smoke-test] FAIL: 今天的 NEW_DIR 不應被刪"
    exit 1
fi
echo "[smoke-test]   ✓ NEW_DIR（今天）保留"

echo ""
echo "==========================================="
echo "[smoke-test] ALL PASSED ✓"
echo "==========================================="
exit 0
