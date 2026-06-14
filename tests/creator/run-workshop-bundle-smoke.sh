#!/usr/bin/env bash
# Creator Corner public beta — STATIC/LOCAL workshop bundle smoke runner.
# Builds the isolated workshop bundle, serves it with a plain static file server (OFFLINE — no Worker),
# then runs the bundle smoke against it. No deploy, no push, no production change.
# Requires Playwright: set PW_REQUIRE_BASE to a node_modules parent if not resolvable from the repo.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUNDLE="${WORKSHOP_BUNDLE_DIR:-/tmp/creator-corner-workshop}"
PORT_HTTP="${PORT_HTTP:-8097}"
export BASE_URL="http://127.0.0.1:${PORT_HTTP}"

# 1. Build the isolated bundle (guards refuse forbidden surfaces / non-false loader flag).
node "$ROOT/scripts/build-creator-workshop-bundle.mjs" --out "$BUNDLE" || exit 1

# 2. Serve the BUNDLE ROOT (not the repo) so /arcade/creator/... resolves from bundled files only.
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$BUNDLE" &
HTTP_PID=$!
sleep 1
set +e
node "$ROOT/tests/creator/workshop-bundle-smoke.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" 2>/dev/null || true
exit $CODE
