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
local_postgres_password="${LOCAL_POSTGRES_PASSWORD:-deledger-local-postgres}"
local_web_password="${LOCAL_WEB_PASSWORD:-deledger-local-web}"
local_admin_database_url="${LOCAL_ADMIN_DATABASE_URL:-postgresql://postgres:${local_postgres_password}@127.0.0.1:${local_postgres_port}/deledger_local}"
local_web_database_url="${LOCAL_DATABASE_URL:-postgresql://deledger_web:${local_web_password}@127.0.0.1:${local_postgres_port}/deledger_local}"
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

"${compose[@]}" up -d --build --wait
DATABASE_URL="$local_admin_database_url" pnpm db:migrate

export DELEDGER_ENV=local
export APP_ORIGIN="${LOCAL_APP_ORIGIN:-http://127.0.0.1:${local_web_port}}"
export BUSINESS_TIME_ZONE=Asia/Bangkok
export DATABASE_URL="$local_web_database_url"

exec pnpm --dir web dev --hostname 127.0.0.1 --port "$local_web_port"
