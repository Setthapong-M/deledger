#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
source_container=deledger_test-postgres-test-1
source_database="$(docker exec -e PGPASSWORD=test-only-placeholder "$source_container" psql -U postgres -d deledger_test -Atqc 'SELECT current_database()')"
[[ "$source_database" == deledger_test ]] || { echo 'refusing backup smoke outside deledger_test' >&2; exit 2; }
label="deledger-backup-smoke-$(date +%s)-$$"
image="${label}-image"
cleanup() {
  docker rm -f "$label" >/dev/null 2>&1 || true
  docker volume rm "${label}-artifacts" "${label}-keys" "${label}-data" >/dev/null 2>&1 || true
  docker image rm "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker build -q -t "$image" -f infra/backup/Dockerfile . >/dev/null
docker volume create "${label}-artifacts" >/dev/null
docker volume create "${label}-keys" >/dev/null
docker run --rm --user 0 --entrypoint sh -v "${label}-keys:/keys" "$image" -ec 'umask 077; age-keygen -o /keys/key >/dev/null 2>&1'
recipient="$(docker run --rm --user 0 --entrypoint age-keygen -v "${label}-keys:/keys:ro" "$image" -y /keys/key)"
docker run --rm --user 0 --network deledger_test_data -v "${label}-artifacts:/mnt/deledger-backups" \
  -e BACKUP_TARGET=/mnt/deledger-backups -e BACKUP_AGE_RECIPIENT="$recipient" \
  -e DATABASE_URL=postgresql://postgres:test-only-placeholder@postgres-test:5432/deledger_test "$image"
docker run --rm --user 0 --entrypoint sh -v "${label}-artifacts:/mnt/deledger-backups:ro" "$image" -ec 'cd /mnt/deledger-backups; sha256sum --check *.sha256; test "$(find . -type f | wc -l)" = 2'
docker run -d --name "$label" --network none -v "${label}-data:/var/lib/postgresql" \
  -e POSTGRES_DB=deledger_restore -e POSTGRES_PASSWORD=restore-only postgres:18.6-bookworm >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$label" pg_isready -U postgres -d deledger_restore >/dev/null 2>&1; then break; fi
  [[ "$attempt" -lt 30 ]] || exit 1
  sleep 1
done
docker run --rm --user 0 --entrypoint sh -v "${label}-keys:/keys:ro" -v "${label}-artifacts:/mnt/deledger-backups:ro" "$image" \
  -ec 'age --decrypt -i /keys/key /mnt/deledger-backups/*.dump.age' | \
  docker exec -i -e PGPASSWORD=restore-only "$label" pg_restore -U postgres -d deledger_restore --no-owner --no-privileges --exit-on-error
query() { docker exec -e PGPASSWORD=restore-only "$label" psql -U postgres -d deledger_restore -Atqc "$1"; }
expected_migration="$(find api/prisma/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -1)"
[[ "$(query 'SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1')" == "$expected_migration" ]]
[[ "$(query "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('app_user','user_identity_email','user_identity_phone','local_session','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail') AND c.relrowsecurity AND c.relforcerowsecurity")" == 9 ]]
for table in app_user user_identity_email user_identity_phone local_session user_archive_period reporting_month balance_snapshot monthly_recurring_expense monthly_expense_detail; do
  source_count="$(docker exec -e PGPASSWORD=test-only-placeholder "$source_container" psql -U postgres -d deledger_test -Atqc "SELECT count(*) FROM public.$table")"
  [[ "$(query "SELECT count(*) FROM public.$table")" == "$source_count" ]]
done
printf 'Encrypted backup/restore smoke passed: migration head and all nine tables/RLS/row counts\n'
