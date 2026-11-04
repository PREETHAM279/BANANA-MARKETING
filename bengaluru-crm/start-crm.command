#!/bin/bash
# Bengaluru Sales CRM - one-click start for macOS.
# Double-click in Finder. First run: 2-4 minutes (downloads and builds). After that: a few seconds.
source "$(dirname "$0")/scripts/mac/common.sh"

bold "Bengaluru Sales CRM"
if is_running; then
  info "Already running at $URL - opening your browser."
  print_phone_access
  open "$URL"
  exit 0
fi

ensure_node
info "Using Node $(node -v) from $(dirname "$(command -v node)")"

STAMP="node_modules/.crm-deps-stamp"
if [ ! -d node_modules ] || [ ! -f "$STAMP" ] || [ package-lock.json -nt "$STAMP" ] || [ package.json -nt "$STAMP" ]; then
  bold "Installing dependencies (first run takes a few minutes)..."
  npm install --no-audit --no-fund >>"$LOG" 2>&1 || fail "Installing dependencies failed."
  touch "$STAMP"
fi

bold "Preparing your database..."
npx prisma migrate deploy >>"$LOG" 2>&1 || fail "Database setup failed."
node scripts/seed.mjs 2>&1 | tee -a "$LOG" | sed 's/^/  /' || fail "Importing research data failed."
node scripts/backup.mjs --daily 2>&1 | tee -a "$LOG" | sed 's/^/  /'

BUILD_STAMP=".next/.crm-build-stamp"
SRC_HASH="$(find src prisma package-lock.json next.config.mjs postcss.config.mjs tsconfig.json -type f -print0 2>/dev/null | sort -z | xargs -0 shasum 2>/dev/null | shasum | awk '{print $1}')"
if [ ! -f "$BUILD_STAMP" ] || [ "$(cat "$BUILD_STAMP" 2>/dev/null)" != "$SRC_HASH" ]; then
  bold "Building the website (about a minute)..."
  node node_modules/next/dist/bin/next build >>"$LOG" 2>&1 || fail "Building the website failed."
  echo "$SRC_HASH" >"$BUILD_STAMP"
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Port $PORT is already used by another app. Add CRM_PORT=3200 to .env.local (copy .env.example) and start again."
fi

bold "Starting..."
# server.mjs serves the CRM on this Mac, and on your Wi-Fi only if you switched on Phone access.
CRM_PORT="$PORT" nohup node server.mjs >>"$LOG" 2>&1 </dev/null &
echo $! >"$PID_FILE"
disown 2>/dev/null || true
for _ in $(seq 1 60); do
  is_running && break
  sleep 1
done
is_running || fail "The CRM did not start."

bold "Bengaluru Sales CRM is running:  $URL"
print_phone_access
info "Your data is saved in: $APP_DIR/data/crm.db"
info "You can close this window - the CRM keeps running in the background."
info "To stop it, double-click stop-crm.command."
open "$URL"
