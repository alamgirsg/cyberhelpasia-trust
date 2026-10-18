#!/usr/bin/env bash
#
# Timestamped, gzipped backup of the Trust platform's PostgreSQL, with retention.
# Run from the project directory on the VPS (where docker-compose.yml lives):
#
#   ./scripts/backup.sh
#
# Env: BACKUP_DIR (default ./backups), RETAIN (default 14 newest kept).
# Schedule it daily with cron — see the README "Backups" section.
#
# Restore a backup into the running database:
#   gunzip -c backups/trust-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U trust -d trust
#
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN="${RETAIN:-14}"
mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/trust-$ts.sql.gz"

# -T: no TTY, so this works under cron. pg_dump runs inside the db container; the database
# is never exposed off the Docker network, so this is the supported way to reach it.
docker compose exec -T db pg_dump -U trust -d trust | gzip -9 > "$out"

# Guard against a truncated/empty dump (e.g. the container was down): a real dump is never tiny.
if [ "$(stat -c%s "$out" 2>/dev/null || echo 0)" -lt 1000 ]; then
  echo "Backup at $out looks too small — is the db container up? Leaving it for inspection." >&2
  exit 1
fi
echo "Backup written: $out ($(du -h "$out" | cut -f1))"

# Retention: keep only the newest $RETAIN backups.
ls -1t "$BACKUP_DIR"/trust-*.sql.gz 2>/dev/null | tail -n +"$((RETAIN + 1))" | xargs -r rm -f
echo "Kept the newest $RETAIN backups in $BACKUP_DIR."
