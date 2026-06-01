#!/usr/bin/env bash
# Runs the HiveWorld testbed Phase 1 UI smoke (Playwright). Requires a Playwright
# install (set PW_REQUIRE_BASE to its package.json if not project-local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_HTTP=8080

# static file server (serves .mjs as JS)
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
sleep 1
set +e
BASE_URL="http://127.0.0.1:$PORT_HTTP" node "$ROOT/tests/hiveworld/phase1-ui-smoke.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" 2>/dev/null || true
exit $CODE
