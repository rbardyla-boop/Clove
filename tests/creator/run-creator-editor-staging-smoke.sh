#!/usr/bin/env bash
# Creator Editor STAGING-ROOT smoke runner (R3, Option A — LOCAL ONLY).
# Builds the single staging artifact root with scripts/build-creator-editor-staging.mjs (which itself
# builds + strips + guards the Arcade Studio candidate), serves that root with a plain static file
# server (OFFLINE — no Worker, no mapping needed: /arcade-studio/ is a real directory in the root),
# then runs the staging smoke against it. No deploy, no push, no production change.
# Requires Playwright (resolvable from the repo, or set PW_REQUIRE_BASE).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGING="${STAGING_ROOT_DIR:-/tmp/creator-editor-staging-root}"
PORT_HTTP="${PORT_HTTP:-8099}"
export BASE_URL="http://127.0.0.1:${PORT_HTTP}"

# 1. Assemble the staging root (guards refuse leaks / forbidden surfaces / weak CSP / non-false loader).
node "$ROOT/scripts/build-creator-editor-staging.mjs" --out "$STAGING" || { echo "FAIL: staging build"; exit 1; }

# 2. Serve the STAGING ROOT as the document root (so /arcade/creator/... AND /arcade-studio/ both resolve).
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$STAGING" &
HTTP_PID=$!
sleep 1
set +e
node "$ROOT/tests/creator/creator-editor-staging-smoke.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" 2>/dev/null || true
exit $CODE
