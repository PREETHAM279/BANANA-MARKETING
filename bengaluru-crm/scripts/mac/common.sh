#!/bin/bash
# Shared helpers for the .command launchers (macOS). Sourced, not run directly.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR" || exit 1
LOG_DIR="$APP_DIR/logs"
LOG="$LOG_DIR/server.log"
PID_FILE="$APP_DIR/.crm.pid"
mkdir -p "$LOG_DIR" "$APP_DIR/data" "$APP_DIR/backups"

PORT="${CRM_PORT:-}"
if [ -z "$PORT" ] && [ -f "$APP_DIR/.env.local" ]; then
  PORT="$(grep -E '^[[:space:]]*CRM_PORT=' "$APP_DIR/.env.local" | tail -1 | cut -d= -f2 | tr -d '"'"'"'[:space:]')"
fi
PORT="${PORT:-3100}"
URL="http://localhost:$PORT"

bold() { printf "\n\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
fail() {
  printf "\n\033[31m%s\033[0m\n" "$*"
  echo "  Details are in: $LOG"
  read -r -p "Press Enter to close this window..." _
  exit 1
}

is_running() { curl -fsS --max-time 2 "$URL/api/health" >/dev/null 2>&1; }

node_ok() {
  command -v node >/dev/null 2>&1 && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>18||(a===18&&b>=18)?0:1)' 2>/dev/null
}

# Uses your installed Node.js (18.18+). If there is none, downloads the official
# Node.js 22 LTS build for this Mac into ./.runtime (no admin rights, checksum verified).
ensure_node() {
  if [ -x "$APP_DIR/.runtime/node/bin/node" ]; then export PATH="$APP_DIR/.runtime/node/bin:$PATH"; fi
  if node_ok; then return 0; fi
  bold "Node.js 18.18+ not found - downloading a private copy (one time, about 45 MB)..."
  local arch narch base sums file sha tmp got
  arch="$(uname -m)"
  case "$arch" in
    arm64) narch=arm64 ;;
    x86_64) narch=x64 ;;
    *) fail "Unsupported Mac processor: $arch" ;;
  esac
  base="https://nodejs.org/dist/latest-v22.x"
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || fail "Could not reach nodejs.org - check your internet connection."
  file="$(printf '%s\n' "$sums" | awk '{print $2}' | grep -E "^node-v22\.[0-9]+\.[0-9]+-darwin-$narch\.tar\.gz$" | head -1)"
  [ -n "$file" ] || fail "Could not find a Node.js download for darwin-$narch."
  sha="$(printf '%s\n' "$sums" | awk -v f="$file" '$2==f {print $1}')"
  tmp="$(mktemp -d)"
  curl -fL --progress-bar "$base/$file" -o "$tmp/$file" || fail "Node.js download failed."
  got="$(shasum -a 256 "$tmp/$file" | awk '{print $1}')"
  [ "$got" = "$sha" ] || fail "Node.js download failed its checksum check - stopped for safety."
  rm -rf "$APP_DIR/.runtime/node" && mkdir -p "$APP_DIR/.runtime/node"
  tar -xzf "$tmp/$file" -C "$APP_DIR/.runtime/node" --strip-components=1 || fail "Could not unpack Node.js."
  rm -rf "$tmp"
  export PATH="$APP_DIR/.runtime/node/bin:$PATH"
  node_ok || fail "Node.js setup failed."
}

server_pids() {
  local pids=""
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then pids="$(cat "$PID_FILE")"; fi
  local listen
  listen="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  for p in $listen; do
    # only our own Next.js server (its working directory is this folder)
    if lsof -a -p "$p" -d cwd -Fn 2>/dev/null | grep -q "^n$APP_DIR\$"; then pids="$pids $p"; fi
  done
  echo "$pids" | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u | tr '\n' ' '
}

stop_server() {
  local pids
  pids="$(server_pids)"
  if [ -z "${pids// /}" ]; then return 1; fi
  kill $pids 2>/dev/null
  for _ in $(seq 1 20); do
    is_running || break
    sleep 0.5
  done
  is_running && kill -9 $pids 2>/dev/null
  rm -f "$PID_FILE"
  return 0
}
