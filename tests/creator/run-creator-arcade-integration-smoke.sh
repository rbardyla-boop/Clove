#!/usr/bin/env bash
# Creator Corner <-> Arcade Studio integration smoke runner.
# Builds the Arcade Studio dist, serves the REPO ROOT with a plain static file server (OFFLINE), and maps
# the production path /arcade-studio/ -> arcade-studio/dist/ (simulating the Option A static deploy), then
# runs the integration smoke against it. No deploy, no push, no production change.
# Requires Playwright (resolvable from the repo, or set PW_REQUIRE_BASE).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT_HTTP="${PORT_HTTP:-8098}"
export BASE_URL="http://127.0.0.1:${PORT_HTTP}"

# 1. Build Arcade Studio's relocatable dist (base './') — the artifact production publishes at /arcade-studio/.
( cd "$ROOT/arcade-studio" && npm run build ) >/tmp/as-integration-build.log 2>&1 \
  || { echo "FAIL: arcade-studio build"; tail -20 /tmp/as-integration-build.log; exit 1; }

# 2. Serve the REPO ROOT (so /arcade/creator/... the hub resolves) AND map the production path
#    /arcade-studio/ -> arcade-studio/dist/ — exactly how Option A will publish the built artifact.
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json",".map":"application/json"};
http.createServer((req,res)=>{try{let p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");if(p==="/arcade-studio"||p.startsWith("/arcade-studio/"))p="/arcade-studio/dist"+p.slice(14);let f=path.join(ROOT,p);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!
sleep 1
set +e
node "$ROOT/tests/creator/creator-arcade-integration-smoke.spec.mjs"
CODE=$?
set -e
kill "$HTTP_PID" 2>/dev/null || true
exit $CODE
