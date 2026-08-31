#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_TARGET:?BACKUP_TARGET is required}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY is required}"
[[ "$BACKUP_TARGET" == "/mnt/deledger-backups" ]] || { echo "refusing unexpected backup target" >&2; exit 2; }
mountpoint -q "$BACKUP_TARGET" || { echo "backup target is not a mounted filesystem" >&2; exit 2; }
artifact=""
while read -r _ candidate; do
  [[ -f "$candidate.sha256" ]] || continue
  if (cd "$BACKUP_TARGET" && sha256sum --check "$(basename "$candidate.sha256")" >/dev/null 2>&1); then
    artifact="$candidate"
    break
  fi
done < <(find "$BACKUP_TARGET" -maxdepth 1 -type f -name 'deledger-*.dump.age' -printf '%T@ %p\n' | sort -nr)
[[ -n "$artifact" ]] || { echo "no checksum-valid backup artifact" >&2; exit 2; }

restore_image="${DELEDGER_DB_IMAGE:-deledger-postgres:latest}"
docker image inspect "$restore_image" >/dev/null 2>&1 || { echo "restore database image is missing" >&2; exit 2; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
expected_migration="$(find "$repo_root/db/migrations" -maxdepth 1 -type f -name '*.cjs' -printf '%f\n' | sed 's/\.cjs$//' | sort | tail -n 1)"
[[ -n "$expected_migration" ]] || { echo "no migration files found" >&2; exit 2; }

label="deledger-restore-verify-$(date +%s)-$$"
temporary_dump="$(mktemp)"
cleanup() { rm -f -- "$temporary_dump"; docker rm -f "$label" >/dev/null 2>&1 || true; docker volume rm "${label}-data" >/dev/null 2>&1 || true; }
trap cleanup EXIT
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$artifact" > "$temporary_dump"
test -s "$temporary_dump"
docker run --name "$label" --detach --network none --volume "${label}-data:/var/lib/postgresql" \
  -e POSTGRES_DB=deledger_restore -e POSTGRES_PASSWORD=restore-only \
  "$restore_image" postgres -c hba_file=/etc/postgresql/pg_hba.conf -c shared_preload_libraries=pg_cron -c cron.database_name=deledger_restore -c cron.timezone=Asia/Bangkok >/dev/null
for attempt in $(seq 1 30); do
  docker exec "$label" pg_isready -U postgres -d deledger_restore >/dev/null 2>&1 && break
  [[ "$attempt" -lt 30 ]] || { echo "restore database did not become ready" >&2; exit 1; }
  sleep 1
done
docker cp "$temporary_dump" "$label:/tmp/restore.dump"
docker exec -e PGPASSWORD=restore-only "$label" pg_restore -U postgres --dbname deledger_restore --no-owner --no-privileges --exit-on-error /tmp/restore.dump >/dev/null

run_sql() {
  docker exec -e PGPASSWORD=restore-only "$label" psql -U postgres -d deledger_restore -Atqc "$1"
}

[[ "$(run_sql "SELECT name FROM public.pgmigrations ORDER BY run_on DESC, name DESC LIMIT 1")" == "$expected_migration" ]] || { echo "restore migration head mismatch" >&2; exit 1; }
[[ "$(run_sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail')")" == "7" ]] || { echo "restore table boundary mismatch" >&2; exit 1; }
[[ "$(run_sql "SELECT count(*) FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail') AND c.relrowsecurity AND c.relforcerowsecurity")" == "7" ]] || { echo "restore RLS boundary mismatch" >&2; exit 1; }
[[ "$(run_sql "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail') AND constraint_type IN ('PRIMARY KEY','FOREIGN KEY','CHECK','UNIQUE')")" -gt 0 ]] || { echo "restore constraints are missing" >&2; exit 1; }
[[ "$(run_sql "SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron'")" == "1" ]] || { echo "restore pg_cron extension is missing" >&2; exit 1; }
for table in app_user user_identity_email user_archive_period reporting_month balance_snapshot monthly_recurring_expense monthly_expense_detail; do
  [[ "$(run_sql "SELECT count(*) FROM public.$table")" =~ ^[0-9]+$ ]] || { echo "restore row-count check failed" >&2; exit 1; }
done
touch "$BACKUP_TARGET/.restore-verify.last-success"
printf 'restore verification complete: %s\n' "$(basename "$artifact")"
