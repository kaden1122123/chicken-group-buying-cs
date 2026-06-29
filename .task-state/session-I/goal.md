# Session I Goal

**目標**：把 api-server.js / dashboard-server.js 推到 production-ready

**Commit 計畫**（5 commits）：
1. I1 graceful shutdown — SIGTERM + 10s timeout + in-flight wait
2. I2 CORS from config — 環境變數白名單
3. I3 rate limiting — 60 req/min/IP
4. I4 input validation — schema 必填 + 型別 + 長度
5. I5 dashboard-server yaml.dump — 字串 patch 取代

**決策**（Hubert 2026-06-29 11:23 確認）：
- CORS allow-origin：預設空（關閉），由 `API_CORS_ORIGINS` env 開啟
- rate limit：60 req/min/IP
- shutdown timeout：10 秒
- validation：必填 + 型別 + 長度

**約束**：
- 每 I 一步 1 commit，commit 前 git add -A + show
- 既有 26 套測試不能破壞
- npm run lint 0 errors
- 不動 config.yaml / chicken.yaml
- 不動 production runtime
