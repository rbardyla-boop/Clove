#!/usr/bin/env bash
# Phase 7C STAGING objectives smoke (real CityRoom DO). STAGING ONLY:
#   STAGING_CITY_WS_URL=wss://neon-arcade-mesh-staging.<acct>.workers.dev/arcade/city/ws bash tests/arcade/run-city-objectives-staging.sh
# The spec hard-refuses production-shaped hosts. Runtime ~2min (two real 45s-cooldown-separated objectives).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${STAGING_CITY_WS_URL:?STAGING_CITY_WS_URL is required (staging workers.dev host only)}"
node "$ROOT/tests/arcade/city-objectives-staging.spec.mjs"
