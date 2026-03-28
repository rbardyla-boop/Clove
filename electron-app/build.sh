#!/bin/bash
# ─── OPERATOR'S DECK — BUILD SCRIPT ──────────────────────────────────────────
# Copies the static web app into the Electron wrapper and builds distributable.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
WEB_DIR="$SCRIPT_DIR/../web"  # Adjust this to point at your Cloudflare deploy directory

echo "╔═══════════════════════════════════════════════╗"
echo "║   OPERATOR'S DECK — ELECTRON BUILD            ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Copy web app files
echo "[1/4] Copying web app files into app/ directory..."
mkdir -p "$APP_DIR"

# Copy all HTML, JS, JSON, XML, TXT, PNG, JPG, ICO files
if [ -d "$WEB_DIR" ]; then
  cp "$WEB_DIR"/*.html "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.js   "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.json "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.xml  "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.txt  "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.png  "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.jpg  "$APP_DIR/" 2>/dev/null || true
  cp "$WEB_DIR"/*.ico  "$APP_DIR/" 2>/dev/null || true
  echo "   ✓ Copied from $WEB_DIR"
else
  echo "   ⚠ Web directory not found at $WEB_DIR"
  echo "   → Checking if app/ already has files..."
fi

FILE_COUNT=$(ls -1 "$APP_DIR"/*.html 2>/dev/null | wc -l)
echo "   → $FILE_COUNT HTML files in app/"

if [ "$FILE_COUNT" -eq 0 ]; then
  echo ""
  echo "   ✗ ERROR: No HTML files found. Copy your web app files into:"
  echo "     $APP_DIR/"
  echo ""
  echo "   Required at minimum: index.html + all drill HTML files + icons"
  exit 1
fi

# ── Step 2: Install dependencies
echo ""
echo "[2/4] Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# ── Step 3: Detect platform and build
echo ""
echo "[3/4] Building distributable..."

PLATFORM=$(uname -s)
case "$PLATFORM" in
  Darwin*)  echo "   → Building for macOS..."; npm run build:mac ;;
  Linux*)   echo "   → Building for Linux..."; npm run build:linux ;;
  MINGW*|MSYS*|CYGWIN*)  echo "   → Building for Windows..."; npm run build:win ;;
  *)        echo "   → Unknown platform: $PLATFORM — building all..."; npm run build:all ;;
esac

# ── Step 4: Report
echo ""
echo "[4/4] Build complete!"
echo ""
echo "Output files:"
ls -lh "$SCRIPT_DIR/dist/"* 2>/dev/null || echo "   Check dist/ directory"
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   DEPLOY COMPLETE — SHIP IT                    ║"
echo "╚═══════════════════════════════════════════════╝"
