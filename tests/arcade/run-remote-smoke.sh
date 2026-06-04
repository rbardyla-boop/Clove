#!/usr/bin/env bash
# Phase 3B — run the Neon Circuit remote smoke (tests/arcade/remote-smoke.spec.mjs).
#
# Two modes:
#
#   REMOTE  — point at a deployed arcade (staging/production). Provide URLs by env:
#       BASE_URL=https://arcade.example.com \
#       WS_URL=wss://neon-arcade-mesh.<sub>.workers.dev/arcade/ws \
#       EXPECT_ENVIRONMENT=production EXPECT_ADMIN_ENABLED=false \
#       [ADMIN_TOKEN=… EXPECT_ADMIN_ENABLED=true] \
#       bash tests/arcade/run-remote-smoke.sh
#     API_URL defaults to the WS_URL host over http(s). Nothing is mutated and no
#     secret is printed. Set ALLOW_REMOTE_ADMIN_MUTATION=true only if you intend to
#     allow state-changing admin ops (this harness still never calls reset).
#
#   LOCAL/DRY (default, when WS_URL is unset) — boot a static server + the REAL Worker
#     via `wrangler dev` (needs Node >= 22) and smoke that. Exercises the production
#     Worker + Durable Objects locally, with EXPECT_ENVIRONMENT=development.
#
# Playwright resolves from PW_REQUIRE_BASE (set it to a node_modules parent that has
# `playwright` if it is not project-local).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPEC="$ROOT/tests/arcade/remote-smoke.spec.mjs"

# ── Remote mode: URLs already provided → run the spec as-is. ──────────────────
if [ -n "${WS_URL:-}" ]; then
  echo "# remote-smoke: REMOTE mode (WS_URL provided)"
  exec node "$SPEC"
fi

# ── Local/dry mode: boot static server + real Worker (wrangler dev). ──────────
echo "# remote-smoke: LOCAL/DRY mode (booting static server + wrangler dev)"

# Locate a Node >= 22 for wrangler (project shells often default to Node 18).
node_major() { "$1" --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }
NODE22_BIN="${NODE22_BIN:-}"
if [ -z "$NODE22_BIN" ]; then
  if [ "$(node_major node)" -ge 22 ] 2>/dev/null; then
    NODE22_BIN="$(dirname "$(command -v node)")"
  else
    for d in "$HOME"/.nvm/versions/node/v22*/bin; do
      [ -x "$d/node" ] && NODE22_BIN="$d" && break
    done
  fi
fi
if [ -z "$NODE22_BIN" ] || [ ! -x "$NODE22_BIN/node" ]; then
  echo "FAIL local mode needs Node >= 22 for wrangler dev (set NODE22_BIN=/path/to/node22/bin)."
  echo "     Or run in REMOTE mode by exporting WS_URL/BASE_URL of a deploy."
  exit 2
fi
echo "# using Node $("$NODE22_BIN/node" --version) for wrangler dev"

PORT_WS=8787
PORT_HTTP=8080
# Ephemeral, throwaway admin token for the local both-gate check (dev only).
DEV_ADMIN_TOKEN="dev-smoke-$(date +%s)-$$"

# 1. static file server (serves .mjs as JS)
node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=process.argv[1];const MIME={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req,res)=>{try{const p=path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/,"");const f=path.join(ROOT,p);const b=fs.readFileSync(f);res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end("nf");}}).listen('"$PORT_HTTP"',"127.0.0.1");
' "$ROOT" &
HTTP_PID=$!

# 2. real Worker + Durable Objects via wrangler dev (default env => development).
(
  cd "$ROOT/workers/arcade" && \
  PATH="$NODE22_BIN:$PATH" npx wrangler dev --local --ip 127.0.0.1 --port "$PORT_WS" \
    --var ADMIN_TOKEN:"$DEV_ADMIN_TOKEN" >/tmp/neon-remote-smoke-wrangler.log 2>&1
) &
WRANGLER_PID=$!

cleanup() {
  kill "$HTTP_PID" 2>/dev/null
  # wrangler dev spawns a detached workerd grandchild that surviving the parent
  # would orphan; reap the whole chain, scoped to THIS run's unique port + token so
  # we never touch another wrangler instance.
  kill "$WRANGLER_PID" 2>/dev/null
  pkill -P "$WRANGLER_PID" 2>/dev/null
  pkill -f "wrangler dev --local --ip 127.0.0.1 --port $PORT_WS" 2>/dev/null
  pkill -f "workerd serve.*entry=127.0.0.1:$PORT_WS" 2>/dev/null
  pkill -f "ADMIN_TOKEN:$DEV_ADMIN_TOKEN" 2>/dev/null
  true
}
trap cleanup EXIT

# 3. wait for the Worker health endpoint to come up (compile can take ~20s first run).
echo -n "# waiting for wrangler dev health"
READY=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT_WS/arcade/health" >/dev/null 2>&1; then READY=1; break; fi
  echo -n "."
  sleep 1
done
echo ""
if [ "$READY" != "1" ]; then
  echo "FAIL wrangler dev did not become healthy in time. Last log lines:"
  tail -20 /tmp/neon-remote-smoke-wrangler.log 2>/dev/null
  exit 1
fi

# 4. run the smoke against the local real Worker (development env, admin enabled).
BASE_URL="http://127.0.0.1:$PORT_HTTP" \
WS_URL="ws://127.0.0.1:$PORT_WS/arcade/ws" \
API_URL="http://127.0.0.1:$PORT_WS" \
EXPECT_ENVIRONMENT="development" \
EXPECT_ADMIN_ENABLED="true" \
ADMIN_TOKEN="$DEV_ADMIN_TOKEN" \
node "$SPEC"
CODE=$?
exit $CODE
