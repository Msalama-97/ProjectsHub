#!/usr/bin/env bash
# Back up the database and uploaded documents into ./backups
# Usage (from the ProjectHub folder):  ./scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/db-$STAMP.dump"
docker compose exec -T app tar czf - -C /data uploads > "backups/uploads-$STAMP.tar.gz"
echo "Saved backups/db-$STAMP.dump and backups/uploads-$STAMP.tar.gz"
# Keep only the 30 newest of each
ls -1t backups/db-*.dump 2>/dev/null | tail -n +31 | xargs -r rm --
ls -1t backups/uploads-*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm --
