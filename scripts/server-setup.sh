#!/usr/bin/env bash
# Runs ON THE SERVER (called by scripts/deploy.sh). Safe to run again for updates:
# keeps .env, the database and uploaded files; rebuilds and restarts the app.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"

# 1) Swap on small servers so the build doesn't run out of memory
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 2000 ] && ! $SUDO swapon --show | grep -q .; then
  say "Adding 2 GB swap (server has ${MEM_MB} MB RAM)"
  $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  $SUDO chmod 600 /swapfile && $SUDO mkswap /swapfile >/dev/null && $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

# 2) Docker + Compose
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
if ! $SUDO docker compose version >/dev/null 2>&1; then
  say "Installing Docker Compose plugin"
  ($SUDO apt-get update -qq && $SUDO apt-get install -y -qq docker-compose-plugin) ||
    $SUDO dnf install -y docker-compose-plugin || $SUDO yum install -y docker-compose-plugin
fi

# 3) Settings (.env) — created once, then kept
NEW_ADMIN_PASSWORD=""
if [ ! -f .env ]; then
  say "Creating settings (.env)"
  rand() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c "$1"; return 0; }
  PORT=80
  if (command -v ss >/dev/null && ss -ltn | awk '{print $4}' | grep -qE '(^|:)80$'); then PORT=8080; fi
  NEW_ADMIN_PASSWORD="PH-$(rand 12)"
  cp .env.example .env
  sed -i \
    -e "s|^APP_PORT=.*|APP_PORT=${PORT}|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 32)|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}|" \
    -e "s|^ADMIN_NAME=.*|ADMIN_NAME=${ADMIN_NAME:-Admin}|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 64)|" \
    -e "s|^TZ=.*|TZ=${APP_TZ:-UTC}|" \
    .env
  chmod 600 .env
fi
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2); PORT=${PORT:-8080}

# 4) Build + start
say "Building and starting ProjectHub (first time: a few minutes)"
$SUDO docker compose up -d --build

say "Waiting for the app"
ok=""
for i in $(seq 1 90); do
  if curl -fs "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "The app did not come up. Recent logs:"
  $SUDO docker compose logs --tail=80 app
  exit 1
fi

# 5) Firewall (only if ufw is active on the server)
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow "${PORT}/tcp" >/dev/null && echo "Opened port ${PORT} in ufw"
fi

# 6) Nightly backup at 02:15 (keeps 30)
chmod +x scripts/*.sh
CRON="15 2 * * * cd ${APP_DIR} && ./scripts/backup.sh >> backups/backup.log 2>&1"
if command -v crontab >/dev/null 2>&1; then
  { ( $SUDO crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' || true ; echo "$CRON" ) | $SUDO crontab - ; } || echo "(Could not set up the nightly backup — run scripts/backup.sh manually)"
else
  echo "(crontab not installed — nightly backup not scheduled)"
fi

echo
echo "PH_PORT=${PORT}"
[ -n "$NEW_ADMIN_PASSWORD" ] && echo "PH_ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}"
echo "PH_ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2)"
exit 0
