#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

local_postgres_port="${LOCAL_POSTGRES_PORT:-55433}"
local_web_port="${LOCAL_WEB_PORT:-3000}"
local_api_port="${LOCAL_API_PORT:-3001}"
local_identity_password="${LOCAL_IDENTITY_PASSWORD:-deledger-local-identity}"
local_postgres_password="${LOCAL_POSTGRES_PASSWORD:-deledger-local-postgres}"
local_web_password="${LOCAL_WEB_PASSWORD:-deledger-local-web}"
local_admin_database_url="${LOCAL_ADMIN_DATABASE_URL:-postgresql://postgres:${local_postgres_password}@127.0.0.1:${local_postgres_port}/deledger_local}"
local_web_database_url="${LOCAL_DATABASE_URL:-postgresql://deledger_web:${local_web_password}@127.0.0.1:${local_postgres_port}/deledger_local}"
local_identity_database_url="${LOCAL_IDENTITY_DATABASE_URL:-postgresql://deledger_identity:${local_identity_password}@127.0.0.1:${local_postgres_port}/deledger_local}"
compose=(docker compose -f infra/compose.local.yaml --project-name deledger_local)

validate_local_database_url() {
  local value="$1"
  local expected_user="$2"
  if ! node --input-type=module - "$value" "$expected_user" <<'NODE'
const value = process.argv[2];
const expectedUser = process.argv[3];
try {
  const parsed = new URL(value);
  if (parsed.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/deledger_local" || parsed.username !== expectedUser) process.exit(1);
} catch {
  process.exit(1);
}
NODE
  then
    printf 'local development database must be %s on loopback at /deledger_local\n' "$expected_user" >&2
    exit 1
  fi
}

validate_local_database_url "$local_admin_database_url" postgres
validate_local_database_url "$local_web_database_url" deledger_web
validate_local_database_url "$local_identity_database_url" deledger_identity

"${compose[@]}" up -d --build --wait
pnpm --dir api generate
MIGRATION_DATABASE_URL="$local_admin_database_url" DATABASE_URL="$local_admin_database_url" pnpm db:migrate

export DELEDGER_ENV=local
export APP_ORIGIN="${LOCAL_APP_ORIGIN:-http://127.0.0.1:${local_web_port}}"
export BUSINESS_TIME_ZONE=Asia/Bangkok
export BACKUP_MODE=disabled
HOSTNAME=127.0.0.1 PORT="$local_api_port" DATABASE_URL="$local_web_database_url" IDENTITY_DATABASE_URL="$local_identity_database_url" pnpm --dir api dev &
api_pid=$!
cleanup() { kill "$api_pid" "${web_pid:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
env -i PATH="$PATH" HOME="$HOME" DELEDGER_ENV=local API_ORIGIN="http://127.0.0.1:${local_api_port}" pnpm --dir web dev --hostname 127.0.0.1 --port "$local_web_port" &
web_pid=$!
wait -n "$api_pid" "$web_pid"
