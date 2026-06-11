#!/usr/bin/env bash
# Phase 7C two-WebSocket gather integration smoke vs the city dev shim (node-level, no browser).
# Runtime ~75s: includes the real, documented 45s objective cooldown (no override exists).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_WS=8788
PORT=$PORT_WS node "$ROOT/workers/arcade/city-dev-shim.mjs" &
SHIM_PID=$!
sleep 1
set +e
WS_URL="ws://127.0.0.1:$PORT_WS/arcade/city/ws" node "$ROOT/tests/arcade/city-objectives-two-client.spec.mjs"
CODE=$?
set -e
kill "$SHIM_PID" 2>/dev/null || true
exit $CODE
