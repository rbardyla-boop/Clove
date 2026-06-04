#!/usr/bin/env bash
# Runs the Phase 4E non-cash Host Rank browser smoke against the local city dev shim.
# Requires: a Playwright install (set PW_REQUIRE_BASE to its node_modules parent if not local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_WS=8788
PORT_HTTP=8080

# 1. static file server (serves .mjs/.js as JS) — same pattern as the other city runners
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
# 2. city dev shim (reuses the SAME pure city authority + event log + scheduler + host rank as the DO)
PORT=$PORT_WS node "$ROOT/workers/arcade/city-dev-shim.mjs" &
SHIM_PID=$!
sleep 1
set +e
BASE_URL="http://127.0.0.1:$PORT_HTTP" WS_URL="ws://127.0.0.1:$PORT_WS/arcade/city/ws" node "$ROOT/tests/arcade/city-host-rank.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" "$SHIM_PID" 2>/dev/null || true
exit $CODE
