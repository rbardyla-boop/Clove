#!/usr/bin/env bash
# Runs the Phase 1i cabinet ADR-043 starter-floor smoke against the local
# dev shim (same transport as run-two-client.sh). Requires a Playwright install
# (set PW_REQUIRE_BASE to its node_modules parent if not project-local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_WS=8787
PORT_HTTP=8080

# 1. static file server (serves .mjs as JS)
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
# 2. dev shim (reuses production ticket authority module)
PORT=$PORT_WS node "$ROOT/workers/arcade/dev-shim.mjs" &
SHIM_PID=$!
sleep 1
set +e
BASE_URL="http://127.0.0.1:$PORT_HTTP" WS_URL="ws://127.0.0.1:$PORT_WS/arcade/ws" node "$ROOT/tests/arcade/starter-floor.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" "$SHIM_PID" 2>/dev/null || true
exit $CODE
