#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_TARGET:?BACKUP_TARGET is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
if [[ -n "${POSTGRES_PASSWORD_FILE:-}" ]]; then
  [[ -r "$POSTGRES_PASSWORD_FILE" ]] || { echo "POSTGRES_PASSWORD_FILE is not readable" >&2; exit 2; }
  export PGPASSWORD="$(tr -d '\r\n' < "$POSTGRES_PASSWORD_FILE")"
fi
[[ "$BACKUP_TARGET" == "/mnt/deledger-backups" ]] || { echo "refusing unexpected backup target" >&2; exit 2; }
mountpoint -q "$BACKUP_TARGET" || { echo "backup target is not a mounted filesystem" >&2; exit 2; }

timestamp="$(TZ=Asia/Bangkok date +%Y%m%d-%H%M%S)-$$"
artifact="$BACKUP_TARGET/deledger-$timestamp.dump.age"
checksum="$artifact.sha256"
temporary_dump="$(mktemp "$BACKUP_TARGET/.deledger-dump.XXXXXX")"
temporary_checksum="$(mktemp "$BACKUP_TARGET/.deledger-checksum.XXXXXX")"
temporary_checksum_ready="$temporary_checksum.ready"
cleanup() { rm -f -- "$temporary_dump" "$temporary_checksum" "$temporary_checksum_ready"; }
trap cleanup EXIT

pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" > "$temporary_dump"
test -s "$temporary_dump"
sha256sum "$temporary_dump" > "$temporary_checksum"
mv -- "$temporary_dump" "$artifact"
sed "s#  .*#  $(basename "$artifact")#" "$temporary_checksum" > "$temporary_checksum_ready"
mv -- "$temporary_checksum_ready" "$checksum"
rm -f -- "$temporary_checksum"
find "$BACKUP_TARGET" -maxdepth 1 -type f -name 'deledger-*.dump.age' -mtime +30 -delete
find "$BACKUP_TARGET" -maxdepth 1 -type f -name 'deledger-*.dump.age.sha256' -mtime +30 -delete
printf 'backup complete: %s\n' "$(basename "$artifact")"
