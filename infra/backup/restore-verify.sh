#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_TARGET:?BACKUP_TARGET is required}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY is required}"
[[ "$BACKUP_TARGET" == "/mnt/deledger-backups" ]] || { echo "refusing unexpected backup target" >&2; exit 2; }
mountpoint -q "$BACKUP_TARGET" || { echo "backup target is not a mounted filesystem" >&2; exit 2; }
artifact="$(find "$BACKUP_TARGET" -maxdepth 1 -type f -name 'deledger-*.dump.age' -printf '%T@ %p\n' | sort -nr | awk 'NR == 1 {print $2}')"
[[ -n "$artifact" && -f "$artifact.sha256" ]] || { echo "no valid backup artifact" >&2; exit 2; }
(cd "$BACKUP_TARGET" && sha256sum --check "$(basename "$artifact.sha256")") >/dev/null

label="deledger-restore-verify-$(date +%s)-$$"
temporary_dump="$(mktemp)"
cleanup() { rm -f -- "$temporary_dump"; docker rm -f "$label" >/dev/null 2>&1 || true; docker volume rm "${label}-data" >/dev/null 2>&1 || true; }
trap cleanup EXIT
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$artifact" > "$temporary_dump"
test -s "$temporary_dump"
docker run --name "$label" --detach --network none --volume "${label}-data:/var/lib/postgresql/data" -e POSTGRES_PASSWORD=restore-only postgres:18.6 >/dev/null
for attempt in $(seq 1 30); do docker exec "$label" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$label" createdb -U postgres deledger_restore >/dev/null
docker cp "$temporary_dump" "$label:/tmp/restore.dump"
docker exec "$label" pg_restore -U postgres --dbname deledger_restore --no-owner --no-privileges /tmp/restore.dump >/dev/null
docker exec "$label" psql -U postgres -d deledger_restore -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail')" | grep -qx '7'
touch "$BACKUP_TARGET/.restore-verify.last-success"
printf 'restore verification complete: %s\n' "$(basename "$artifact")"
