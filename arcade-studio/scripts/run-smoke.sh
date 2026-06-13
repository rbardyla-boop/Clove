#!/usr/bin/env bash
# Build, serve the production bundle, and run the headless browser smoke. Local-only.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-4173}"
npm run build

npm run preview -- --port "$PORT" >/tmp/arcade-studio-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

# wait for the server
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/" >/dev/null 2>&1; then break; fi
  sleep 1
done

node scripts/smoke-headless.mjs "http://localhost:${PORT}"
