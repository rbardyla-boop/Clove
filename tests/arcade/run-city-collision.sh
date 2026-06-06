#!/usr/bin/env bash
# Runs the Phase 7B city walkable-boundary browser smoke against the local city dev shim.
# Requires: a Playwright install (set PW_REQUIRE_BASE to its node_modules parent if not local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_WS=8790
PORT_HTTP=8082

# 1. static file server (serves .mjs/.js as JS)
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
# 2. city dev shim (reuses the SAME pure city authority as the CityRoom DO)
PORT=$PORT_WS node "$ROOT/workers/arcade/city-dev-shim.mjs" &
SHIM_PID=$!
sleep 1
set +e
BASE_URL="http://127.0.0.1:$PORT_HTTP" WS_URL="ws://127.0.0.1:$PORT_WS/arcade/city/ws" node "$ROOT/tests/arcade/city-collision.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" "$SHIM_PID" 2>/dev/null || true
exit $CODE
