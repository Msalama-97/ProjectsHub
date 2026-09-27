#!/bin/bash
# Double-click to run ProjectHub on this Mac WITHOUT Docker.
# Uses the bundled Node.js and a built-in PostgreSQL engine (PGlite).
# Data is stored in run-local/data. Keep this window open while you use the app;
# close it (or press Ctrl+C) to stop.
cd "$(dirname "$0")"
ROOT="$(pwd)"
RL="$ROOT/run-local"

if [ ! -x "$RL/runtime/node" ]; then
  echo "The run-local folder is missing. Ask Claude to rebuild it."
  read -r -p "Press Enter to close."; exit 1
fi

# Settings (admin login, timezone, port) from .env
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
export PORT="${APP_PORT:-8080}"
export EMBEDDED_DB=true
export EMBEDDED_DB_DIR="$RL/data/db"
export UPLOAD_DIR="$RL/data/uploads"
export WEB_DIR="$RL/app/public"
export MIGRATIONS_DIR="$RL/app/migrations"
export NODE_ENV=production

if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "ProjectHub is already running — opening it."
  open "http://localhost:$PORT"
  read -r -p "Press Enter to close."; exit 0
fi

echo "== ProjectHub (local, no Docker) =="
echo "Starting on http://localhost:$PORT ..."
echo "Keep this window open while using the app. Close it or press Ctrl+C to stop."
echo

# Open the browser once the app answers
( for i in $(seq 1 60); do
    if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then open "http://localhost:$PORT"; break; fi
    sleep 1
  done ) &

cd "$RL/app"
"$RL/runtime/node" dist/index.js
echo
echo "ProjectHub stopped."
read -r -p "Press Enter to close."
