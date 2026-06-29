# Session I Steps

## ✅ 0. 系統檢查
- cron jobs 雞味客服相關無衝突
- git working tree 乾淨
- npm test 26 套 baseline 全綠
- npm run lint 0 errors / 0 warnings

## ✅ 0.5 讀必讀文件
- config.yaml：✅ 讀過，無 api 段（用環境變數 + 程式常數）
- src/config.js：✅ 讀過，會用既有 helper
- tests/api-server.test.js：✅ 讀過，181 行 / 14 個 case
- tests/dashboard-server-yaml-fallback.test.js：✅ 讀過，124 行
- API server 原始碼：已有簡單 CORS + SIGINT，要 graceful 化

## ✅ 1. I1 graceful shutdown（21ab4a0）
- env `API_GRACEFUL_TIMEOUT_MS` (default 10000)
- sockets tracking: connection → close
- signal handler: SIGTERM + 升級既有 SIGINT
- middleware 開頭: isShuttingDown → 503 + Connection: close
- ✅ npm test 26 套全綠 + lint 0 errors

## ✅ 2. I2 CORS from config（b164131）
- env `API_CORS_ORIGINS` (comma-separated, empty = 關閉)
- 從 `*` 改為白名單，options 預檢
- ✅ npm test 26 套全綠 + lint 0 errors

## ✅ 3. I3 rate limiting（626c4c7）
- env `API_RATE_LIMIT` (default 60), `API_RATE_LIMIT_WINDOW_MS` (default 60000)
- IP-based token bucket
- 超過回 429 + Retry-After + X-RateLimit-* headers
- ✅ npm test 26 套全綠 + lint 0 errors

## ✅ 4. I4 input validation（814ca3e）
- env 控上限（max_user_line_name_length 等）
- 既有 validateOrderData 加 schema 驗證（型別 + 長度）
- ✅ npm test 26 套全綠 + lint 0 errors

## ✅ 5. I5 dashboard-server yaml.dump 修整（4bab208）
- 字串 patch 取代 yaml.dump
- 保留原 yaml 格式（含 separator 註解/空行）
- ✅ npm test 26 套全綠 + lint 0 errors
- 既有 dashboard-server-yaml-fallback.test.js PASSED

## ✅ 6. Tests + Docs
- e0a9197: tests/api-server-hardening.test.js (378 行) + tests/dashboard-server-yaml-patch.test.js (245 行) + scripts/dashboard-server.js 補丁 (separator 保留) + package.json npm test loop
- b88bc06: PHASE1_PROGRESS.md + REVIEW_GUIDE.md + CEO_DECISION_GUIDE.md 同步更新

## ✅ 7. Push + rsync
- git push origin main：成功（601a0cc → b88bc06）
- bash scripts/sync-mirror.sh from-legacy：成功同步 8 個檔案
- 主位置 ln -s node_modules → 跑 npm test 全綠

## 📊 最終統計
- 7 commits（21ab4a0 / b164131 / 626c4c7 / 814ca3e / 4bab208 / e0a9197 / b88bc06）
- npm test 28 套（25 unit + 3 server-integration）連續 3 次全綠
- npm run lint 0 errors / 0 warnings
- 0 個 zombie process
- 8 個檔案改動、+1092 / -23 行
