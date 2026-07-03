#!/usr/bin/env bash
# Security regression runner — system-check.html ciphertext-aware diagnostics (ADR-052).
# Serves the repo root over a local static server (so od-core.js / scripts resolve offline)
# and runs the system-check ciphertext spec. Requires Playwright: set PW_REQUIRE_BASE to a node_modules parent.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_HTTP=8952
export BASE_URL="http://127.0.0.1:${PORT_HTTP}"

node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json",".wasm":"application/wasm"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
sleep 1
set +e
node "$ROOT/tests/security/system-check-ciphertext.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" 2>/dev/null || true
exit $CODE
