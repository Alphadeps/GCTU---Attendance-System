#!/usr/bin/env bash
# Copy the whole production database (schema + data + migration history) to Neon.
#
# Usage:
#   OLD_DB_URL="postgres://...current direct URL..." \
#   NEW_DB_URL="postgresql://...Neon DIRECT url (host WITHOUT -pooler)..." \
#   bash scripts/migrate-to-neon.sh
#
# Requires pg_dump / pg_restore / psql version >= the source server version (use PostgreSQL 17 client tools).
# Stop writes (no open sessions, put the app in maintenance) before running so no data is lost.
set -euo pipefail

: "${OLD_DB_URL:?Set OLD_DB_URL to the current database direct postgres:// URL}"
: "${NEW_DB_URL:?Set NEW_DB_URL to the Neon direct (non -pooler) URL}"

if [[ "$NEW_DB_URL" == *"-pooler"* ]]; then
  echo "❌ NEW_DB_URL points at the Neon pooler. Use the direct connection string (no '-pooler' in the host)." >&2
  exit 1
fi

DUMP_FILE="gctu-backup-$(date +%Y%m%d-%H%M%S).dump"

echo "📦 Dumping current database to $DUMP_FILE ..."
pg_dump "$OLD_DB_URL" --format=custom --no-owner --no-acl --file="$DUMP_FILE"

echo "🔎 Checking the Neon database is empty ..."
TABLES=$(psql "$NEW_DB_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'")
if [[ "$TABLES" != "0" ]]; then
  echo "❌ Neon database already has $TABLES tables in 'public'. Use a fresh database/branch." >&2
  exit 1
fi

echo "🚚 Restoring into Neon ..."
pg_restore --dbname="$NEW_DB_URL" --no-owner --no-acl --exit-on-error "$DUMP_FILE"

echo "✅ Row counts (old vs new):"
for t in '"User"' '"Student"' '"Class"' '"Course"' '"AttendanceSession"' '"Attendance"' '"_prisma_migrations"'; do
  OLD=$(psql "$OLD_DB_URL" -tAc "select count(*) from $t")
  NEW=$(psql "$NEW_DB_URL" -tAc "select count(*) from $t")
  STATUS=$([[ "$OLD" == "$NEW" ]] && echo "ok" || echo "MISMATCH")
  printf "  %-22s %8s %8s  %s\n" "$t" "$OLD" "$NEW" "$STATUS"
done

echo "Done. Keep $DUMP_FILE as a backup."
