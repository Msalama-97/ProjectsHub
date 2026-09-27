#!/bin/bash
# Double-click to start ProjectHub (macOS). Opens it in your browser when ready.
cd "$(dirname "$0")"
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin"
PORT=$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2); PORT=${PORT:-8080}
echo "== Starting ProjectHub =="

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop is not installed. Opening the download page..."
  open "https://www.docker.com/products/docker-desktop/"
  echo "Install it (choose 'Apple Silicon' or 'Intel' to match your Mac), open it once,"
  echo "then double-click this file again."
  read -r -p "Press Enter to close."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Opening Docker Desktop (this can take up to a minute)..."
  open -a Docker
  for i in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; printf "."; done; echo
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker didn't start. Open Docker Desktop yourself, accept its terms if asked, then try again."
  read -r -p "Press Enter to close."
  exit 1
fi

[ -f .env ] || cp .env.example .env

echo "Building and starting (first time takes a few minutes)..."
if ! docker compose up -d --build; then
  echo; echo "Something went wrong — copy the text above and send it to Claude."
  read -r -p "Press Enter to close."
  exit 1
fi

echo "Waiting for the app to be ready..."
for i in $(seq 1 60); do curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 2; printf "."; done; echo
if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  open "http://localhost:$PORT"
  echo; echo "ProjectHub is running at http://localhost:$PORT"
  echo "Sign in with ADMIN_EMAIL / ADMIN_PASSWORD from the .env file in this folder."
else
  echo "The app didn't respond. Recent logs:"; docker compose logs --tail=60 app
fi
echo "You can close this window — the app keeps running. Use 'Stop ProjectHub.command' to stop it."
read -r -p "Press Enter to close."
