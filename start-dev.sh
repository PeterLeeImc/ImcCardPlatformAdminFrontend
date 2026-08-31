#!/usr/bin/env bash
# 本機開發啟動 ImcCardPlatformAdminFrontend（Vite + React，需要 Node 18+）
# 用法：在 Git Bash 執行  ./start-dev.sh
# 開發時走 http://localhost:3001，/api 會被 vite.config.ts 的 proxy 轉發到
# http://localhost:8081（ImcCardPlatformBackend），要先另外啟動那個後端才能正常登入。
set -e

export PATH="/d/App/tools/node-v24.14.1-win-x64:$PATH"

cd "$(dirname "$0")"

echo "node=$(node --version)"

npm run dev
