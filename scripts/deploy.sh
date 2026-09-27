#!/usr/bin/env bash
# Deploy (or update) ProjectHub on a Linux server over SSH. Run from your Mac/Linux machine.
#   ./scripts/deploy.sh root@13.140.183.156
# You'll be asked for the server password once (unless you use an SSH key).
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:?Usage: ./scripts/deploy.sh user@server-ip}"
HOST="${TARGET#*@}"
REMOTE_DIR="/opt/ProjectHub"

# One SSH connection reused for every step → one password prompt
CTL="$HOME/.ssh/projecthub-%r@%h:%p"
mkdir -p "$HOME/.ssh"
SSH=(ssh -o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=15m -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
trap '"${SSH[@]}" -O exit "$TARGET" >/dev/null 2>&1 || true' EXIT

echo "== Connecting to $TARGET"
"${SSH[@]}" "$TARGET" "echo Connected to \$(hostname) — \$(. /etc/os-release 2>/dev/null; echo \${PRETTY_NAME:-Linux})"

echo "== Uploading ProjectHub to $REMOTE_DIR"
COPYFILE_DISABLE=1 tar czf - \
  --exclude='./run-local' --exclude='./_transfer' --exclude='*/node_modules' --exclude='*/dist' \
  --exclude='./.env' --exclude='./backups/*.dump' --exclude='./backups/*.tar.gz' --exclude='./backups/uploads-*' \
  --exclude='.DS_Store' --exclude='*.command' --exclude='./server-login.txt' . |
  "${SSH[@]}" "$TARGET" "mkdir -p $REMOTE_DIR && tar --warning=no-unknown-keyword -xzf - -C $REMOTE_DIR"

# Reuse the admin email/name/timezone from the local .env for the first setup
ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2 || true)
ADMIN_NAME=$(grep -E '^ADMIN_NAME=' .env 2>/dev/null | cut -d= -f2 || true)
APP_TZ=$(grep -E '^TZ=' .env 2>/dev/null | cut -d= -f2 || true)

echo "== Setting up the server"
OUT=$(mktemp)
"${SSH[@]}" -t "$TARGET" "ADMIN_EMAIL='${ADMIN_EMAIL:-admin@example.com}' ADMIN_NAME='${ADMIN_NAME:-Admin}' APP_TZ='${APP_TZ:-UTC}' bash $REMOTE_DIR/scripts/server-setup.sh" | tee "$OUT"

PORT=$(grep -a 'PH_PORT=' "$OUT" | tail -1 | cut -d= -f2 | tr -d '\r')
PASS=$(grep -a 'PH_ADMIN_PASSWORD=' "$OUT" | tail -1 | cut -d= -f2 | tr -d '\r' || true)
EMAIL=$(grep -a 'PH_ADMIN_EMAIL=' "$OUT" | tail -1 | cut -d= -f2 | tr -d '\r')
rm -f "$OUT"
URL="http://$HOST"; [ "${PORT:-80}" != "80" ] && URL="http://$HOST:$PORT"

{
  echo "ProjectHub server: $URL"
  echo "Admin email: $EMAIL"
  [ -n "$PASS" ] && echo "Admin password (first login — change it in Settings): $PASS"
  echo "Deployed: $(date)"
} > server-login.txt

echo
echo "============================================================"
echo " ProjectHub is live:  $URL"
echo " Admin email:         $EMAIL"
[ -n "$PASS" ] && echo " Admin password:      $PASS   (change it after signing in)"
echo " Saved to server-login.txt in the ProjectHub folder."
echo "============================================================"
echo "If the page doesn't open from your browser, allow TCP port ${PORT:-80} in your"
echo "cloud provider's firewall / security group for this server."
command -v open >/dev/null && open "$URL" || true
