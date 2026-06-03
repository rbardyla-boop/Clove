#!/usr/bin/env bash
# Runs the Phase 2i live-ops per-room presentation override browser validation against the
# dev shim. The shim is started WITH admin enabled + an EPHEMERAL admin token (generated
# here, never committed) and NO EVENT_* operator vars, so the base presentation is the hard
# default and the test proves a per-room override layers on top (display-only). The spec
# receives the same token via ADMIN_TEST_TOKEN.
# Requires a Playwright install (set PW_REQUIRE_BASE to its node_modules parent if not local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_WS=8787
PORT_HTTP=8080
# Ephemeral, run-scoped dev admin token (NOT a real secret, never written to disk/repo).
TOKEN="${ADMIN_TEST_TOKEN:-dev-admin-$(date +%s)-$RANDOM}"

node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
ADMIN_ENABLED=true ADMIN_TOKEN="$TOKEN" PORT=$PORT_WS node "$ROOT/workers/arcade/dev-shim.mjs" &
SHIM_PID=$!
sleep 1
set +e
ADMIN_TEST_TOKEN="$TOKEN" BASE_URL="http://127.0.0.1:$PORT_HTTP" WS_URL="ws://127.0.0.1:$PORT_WS/arcade/ws" node "$ROOT/tests/arcade/presentation-overrides.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" "$SHIM_PID" 2>/dev/null || true
exit $CODE
