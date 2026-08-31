#!/usr/bin/env bash
set -euo pipefail

compose_file="${DELEDGER_COMPOSE_FILE:-/home/admin/vault/deledger/infra/compose.yaml}"
runtime_env="${DELEDGER_RUNTIME_ENV_FILE:-/etc/deledger/runtime.env}"

[[ -r "$runtime_env" ]] || { echo "runtime environment is not readable" >&2; exit 2; }

exec /usr/bin/docker compose --env-file "$runtime_env" -f "$compose_file" exec -T postgres sh -eu -c '
  export PGPASSWORD="$(tr -d "\r\n" < /run/secrets/postgres_password)"
  exec psql --username postgres --dbname deledger --set ON_ERROR_STOP=1 --command "SELECT public.catch_up_reporting_months();"
'
