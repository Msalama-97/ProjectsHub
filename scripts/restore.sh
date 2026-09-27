#!/usr/bin/env bash
# Restore a database backup (and optionally uploads).
# Usage:  ./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.dump [backups/uploads-YYYYMMDD-HHMMSS.tar.gz]
# WARNING: replaces the current data.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_FILE=${1:?Give the .dump file to restore}
read -r -p "This will REPLACE all current ProjectHub data. Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "Cancelled"; exit 1; }
docker compose stop app
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$DB_FILE"
if [ -n "${2:-}" ]; then
  docker compose start app
  docker compose exec -T app sh -c 'rm -rf /data/uploads && tar xzf - -C /data' < "$2"
fi
docker compose start app
echo "Restore complete."
