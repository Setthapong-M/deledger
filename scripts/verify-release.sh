#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'release check failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${CLOUDFLARE_TEAM_DOMAIN:?CLOUDFLARE_TEAM_DOMAIN is required}"
: "${CLOUDFLARE_ACCESS_AUD:?CLOUDFLARE_ACCESS_AUD is required}"
: "${CLOUDFLARE_TUNNEL_TOKEN:?CLOUDFLARE_TUNNEL_TOKEN is required}"
: "${BACKUP_MODE:?BACKUP_MODE is required (disabled or enforced)}"
[[ "$BACKUP_MODE" == "disabled" || "$BACKUP_MODE" == "enforced" ]] || fail "BACKUP_MODE must be disabled or enforced"
export DATABASE_URL CLOUDFLARE_TEAM_DOMAIN CLOUDFLARE_ACCESS_AUD CLOUDFLARE_TUNNEL_TOKEN BACKUP_MODE

[[ "$(node --version)" == "v22.23.1" ]] || fail "Node 22.23.1 required"
[[ "$(pnpm --version)" == "11.1.3" ]] || fail "pnpm 11.1.3 required"
for command in docker find stat; do require_command "$command"; done

secret_dir="${DELEDGER_SECRET_DIR:-/etc/deledger/secrets}"
[[ -d "$secret_dir" ]] || fail "Compose secret directory is required: $secret_dir"
for secret_name in postgres_password web_password maintenance_password operator_password; do
  secret_path="$secret_dir/$secret_name"
  [[ -r "$secret_path" ]] || fail "Compose secret is not readable: $secret_path"
  secret_mode="$(stat -c '%a' "$secret_path")"
  [[ "$secret_mode" =~ 0$ ]] || fail "Compose secret must not be world-readable: $secret_path"
done

compose=(docker compose)
if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
  [[ -r "$COMPOSE_ENV_FILE" ]] || fail "COMPOSE_ENV_FILE is not readable: $COMPOSE_ENV_FILE"
  compose+=(--env-file "$COMPOSE_ENV_FILE")
fi
compose+=(-f infra/compose.yaml)

if [[ "$BACKUP_MODE" == "enforced" ]]; then
  : "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required when BACKUP_MODE=enforced}"
  export BACKUP_AGE_RECIPIENT
  for command in age mountpoint sha256sum; do require_command "$command"; done
  backup_target=/mnt/deledger-backups
  [[ -d "$backup_target" ]] && mountpoint -q "$backup_target" || fail "backup mount is required"
  backup_artifact="$(find "$backup_target" -maxdepth 1 -type f -name 'deledger-*.dump.age' -printf '%T@ %p\n' | sort -nr | awk 'NR == 1 {print $2}')"
  [[ -n "$backup_artifact" && -f "$backup_artifact.sha256" ]] || fail "encrypted backup and checksum are required"
  if ! (cd "$backup_target" && sha256sum --check "$(basename "$backup_artifact.sha256")" >/dev/null); then
    fail "newest encrypted backup checksum is invalid"
  fi
  [[ -n "$(find "$backup_target" -maxdepth 1 -type f -name 'deledger-*.dump.age' -mmin -1560 -print -quit)" ]] || fail "encrypted backup is older than 26 hours"
  [[ -n "$(find "$backup_target" -maxdepth 1 -type f -name '.restore-verify.last-success' -mmin -11520 -print -quit)" ]] || fail "weekly restore marker is older than 8 days"
  if [[ -n "$(find "$backup_target" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.json' -o -name '*.key' -o -name '*.pem' -o -name '*identity*' \) -print -quit)" ]]; then
    fail "backup target contains a plaintext/export/key artifact"
  fi
  compose+=(--profile operations -f infra/compose.backup.yaml)
else
  printf 'release warning: BACKUP_MODE=disabled; database loss has no recovery path\n' >&2
fi

"${compose[@]}" config --quiet || fail "production Compose config is invalid"
compose_config="$("${compose[@]}" config)"
grep -q '^    internal: true$' <<<"$compose_config" || fail "data network must be internal"
if grep -q '^    ports:' <<<"$compose_config"; then
  fail "production Compose must not publish host ports"
fi

db_query() {
  local query="$1"
  "${compose[@]}" exec -T postgres sh -eu -c \
    'export PGPASSWORD="$(cat /run/secrets/postgres_password)"; psql --username postgres --dbname deledger --set ON_ERROR_STOP=1 --tuples-only --no-align --command "$1"' \
    deledger-release-check "$query" | tr -d '\r'
}

expect_db_value() {
  local label="$1" expected="$2" query="$3" actual
  actual="$(db_query "$query")" || fail "$label query failed"
  [[ "$actual" == "$expected" ]] || fail "$label"
}

expected_migration="$(find db/migrations -maxdepth 1 -type f -name '*.cjs' -printf '%f\n' | sed 's/\.cjs$//' | sort | tail -n 1)"
[[ -n "$expected_migration" ]] || fail "no migration files found"
expect_db_value "migration head is not current" "$expected_migration" \
  "SELECT name FROM public.pgmigrations ORDER BY run_on DESC, name DESC LIMIT 1"
expect_db_value "all financial tables must use forced RLS" "7" \
  "SELECT count(*)::text FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail') AND c.relrowsecurity AND c.relforcerowsecurity"
expect_db_value "runtime roles must not bypass ownership controls" "3" \
  "SELECT count(*)::text FROM pg_roles WHERE rolname IN ('deledger_web','deledger_maintenance','deledger_operator') AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb"
expect_db_value "web role must not own financial tables" "0" \
  "SELECT count(*)::text FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace JOIN pg_roles AS r ON r.oid = c.relowner WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('app_user','user_identity_email','user_archive_period','reporting_month','balance_snapshot','monthly_recurring_expense','monthly_expense_detail') AND r.rolname = 'deledger_web'"
expect_db_value "calendar catch-up cron is not configured exactly" "1" \
  "SELECT count(*)::text FROM cron.job WHERE jobname = 'deledger-catch-up' AND schedule = '5 0 * * *' AND command = 'SELECT public.catch_up_reporting_months();' AND database = current_database()"

pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test:all

release_id="${DELEDGER_RELEASE_CHECK_ID:-$$}"
db_image="deledger-release-db:${release_id}"
web_image="deledger-release-web:${release_id}"
migrate_image="deledger-release-migrate:${release_id}"
backup_image=""
cleanup_images() {
  docker image rm "$migrate_image" "$web_image" "$db_image" >/dev/null 2>&1 || true
  if [[ -n "$backup_image" ]]; then
    docker image rm "$backup_image" >/dev/null 2>&1 || true
  fi
}
trap cleanup_images EXIT
docker build --tag "$db_image" -f db/Dockerfile .
docker build --tag "$web_image" -f web/Dockerfile .
docker build --tag "$migrate_image" -f infra/migrate/Dockerfile .

web_user="$(docker image inspect "$web_image" --format '{{.Config.User}}')"
[[ "$web_user" == "deledger" || "$web_user" == "1001:1001" ]] || fail "web image must run as the non-root deledger user"

assert_clean_web_image() {
  local image="$1"
  docker run --rm --entrypoint sh "$image" -eu -c '
    if find /app -type f \( \
      -name ".env" -o -name ".env.*" -o -path "*/.scratch/*" -o -path "*/prototypes/*" \
      -o -name "*.dump" -o -name "*.dump.age" -o -name "*.age" \
      -o -name "*.key" -o -name "*.pem" -o -name "export*.json" \
      -o -name "deledger-*.json" -o -name "*.json.enc" \
    \) -print -quit | grep -q .; then
      exit 1
    fi
    if grep -REq --include="*.map" "BEGIN [A-Z0-9 ]+PRIVATE KEY|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@" /app; then
      exit 1
    fi
  ' || fail "web image contains a forbidden runtime artifact or secret-bearing source map"
}

assert_clean_db_image() {
  local image="$1"
  docker run --rm --entrypoint sh "$image" -eu -c '
    if find /docker-entrypoint-initdb.d /etc/postgresql -type f \( \
      -name ".env" -o -name ".env.*" -o -path "*/.scratch/*" -o -path "*/prototypes/*" \
      -o -name "*.dump" -o -name "*.dump.age" -o -name "*.age" \
      -o -name "*.key" -o -name "*.json.enc" \
    \) -print -quit | grep -q .; then
      exit 1
    fi
  ' || fail "database image contains a forbidden runtime artifact"
}
assert_clean_migrate_image() {
  local image="$1"
  docker run --rm --entrypoint sh "$image" -eu -c '
    if find /app -type f \( \
      -name ".env" -o -name ".env.*" -o -path "*/.scratch/*" -o -path "*/prototypes/*" \
      -o -name "*.dump" -o -name "*.dump.age" -o -name "*.age" \
      -o -name "*.key" -o -name "*.pem" -o -name "*.json.enc" \
    \) -print -quit | grep -q .; then
      exit 1
    fi
  ' || fail "migration image contains a forbidden runtime artifact"
}
assert_clean_web_image "$web_image"
assert_clean_db_image "$db_image"
assert_clean_migrate_image "$migrate_image"

if [[ "$BACKUP_MODE" == "enforced" ]]; then
  backup_image="deledger-release-backup:${release_id}"
  docker build --tag "$backup_image" -f infra/backup/Dockerfile .
  docker run --rm --entrypoint sh "$backup_image" -eu -c '
    if find /usr/local/bin -type f \( \
      -name ".env" -o -name ".env.*" -o -path "*/.scratch/*" -o -path "*/prototypes/*" \
      -o -name "*.dump" -o -name "*.dump.age" -o -name "*.age" \
      -o -name "*.key" -o -name "*.pem" -o -name "*.json.enc" \
    \) -print -quit | grep -q .; then
      exit 1
    fi
  ' || fail "backup image contains a forbidden runtime artifact"
fi

printf 'release checks passed\n'
