# Windows PowerShell backup:  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path backups | Out-Null
docker compose exec -T db sh -c "pg_dump -U `$POSTGRES_USER -d `$POSTGRES_DB -Fc -f /tmp/db.dump"
docker compose cp db:/tmp/db.dump "backups/db-$stamp.dump"
docker compose cp app:/data/uploads "backups/uploads-$stamp"
Write-Host "Saved backups\db-$stamp.dump and backups\uploads-$stamp"
